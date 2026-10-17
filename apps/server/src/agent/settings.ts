import { chmod, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { parse } from "smol-toml";
import { z } from "zod";
import { createNativeRunner, probe, resolveAgentCommand } from "./native.js";
import { createResponsesRunner } from "./direct.js";
import { loadCodexSelection } from "./profile.js";
import type { AgentRunner } from "./types.js";

const KEY_ENV = "ATLASMODE_SETTINGS_API_KEY";
const safeName = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const settingsSchema = z.strictObject({
  provider: z.enum(["off", "codex", "claude", "responses"]),
  codexProfile: z.string().regex(safeName).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  apiBaseUrl: z.string().trim().max(500).optional(),
  /** Write-only. `null` clears a stored key; absent keeps it. */
  apiKey: z
    .string()
    .min(1)
    .max(4096)
    .refine((v) => !/[\r\n]/.test(v))
    .nullable()
    .optional(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
interface Stored {
  provider: SettingsInput["provider"];
  codexProfile?: string;
  model?: string;
  apiBaseUrl?: string;
  apiKey?: string;
}
export interface PublicSettings {
  provider: Stored["provider"];
  codexProfile?: string;
  model?: string;
  apiBaseUrl?: string;
  /** A key saved through Settings (stored 0600). */
  apiKeyConfigured: boolean;
  /** The server launch environment already provides a key; used when none is saved. */
  apiKeyEnvironment: boolean;
}

/** Persisted user choice. The API key is stored 0600 beside the database and is never returned. */
export class AgentSettingsStore {
  private current: Stored | undefined;
  constructor(private readonly file: string) {}
  async load(): Promise<Stored | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Stored &
        Record<string, unknown>;
      const { apiKey, ...rest } = parsed;
      const checked = settingsSchema.omit({ apiKey: true }).safeParse(rest);
      this.current = checked.success
        ? { ...checked.data, ...(typeof apiKey === "string" ? { apiKey } : {}) }
        : undefined;
    } catch {
      this.current = undefined;
    }
    return this.current;
  }
  get(): Stored | undefined {
    return this.current;
  }
  async save(input: SettingsInput): Promise<Stored> {
    const { apiKey, ...rest } = input;
    const keep = apiKey === undefined ? this.current?.apiKey : apiKey ?? undefined;
    const next: Stored = { ...rest, ...(keep ? { apiKey: keep } : {}) };
    await mkdir(dirname(this.file), { recursive: true });
    const temp = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
    await chmod(temp, 0o600);
    await rename(temp, this.file);
    this.current = next;
    return next;
  }
  publicView(env: NodeJS.ProcessEnv): PublicSettings {
    const s = this.current;
    const apiKeyEnvironment = !!env[env.CODEMAP_AGENT_API_KEY_ENV ?? "OPENAI_API_KEY"];
    if (s)
      return {
        provider: s.provider,
        codexProfile: s.codexProfile,
        model: s.model,
        apiBaseUrl: s.apiBaseUrl,
        apiKeyConfigured: !!s.apiKey,
        apiKeyEnvironment,
      };
    const p = env.CODEMAP_AGENT_PROVIDER;
    return {
      provider: p === "codex" || p === "claude" || p === "responses" ? p : "off",
      codexProfile: env.CODEMAP_CODEX_PROFILE || undefined,
      model: env.CODEMAP_AGENT_MODEL || undefined,
      apiBaseUrl: env.CODEMAP_AGENT_API_BASE_URL || undefined,
      apiKeyConfigured: false,
      apiKeyEnvironment,
    };
  }
}

/** Saved settings override the launch environment; absent settings keep launch behavior. */
export function environmentFor(
  base: NodeJS.ProcessEnv,
  stored: Stored | undefined,
): NodeJS.ProcessEnv {
  if (!stored) return base;
  const env: NodeJS.ProcessEnv = { ...base };
  for (const k of [
    "CODEMAP_AGENT_PROVIDER",
    "CODEMAP_CODEX_PROFILE",
    "CODEMAP_AGENT_MODEL",
    "CODEMAP_AGENT_API_BASE_URL",
  ])
    delete env[k];
  if (stored.provider !== "off") env.CODEMAP_AGENT_PROVIDER = stored.provider;
  if (stored.codexProfile) env.CODEMAP_CODEX_PROFILE = stored.codexProfile;
  if (stored.model) env.CODEMAP_AGENT_MODEL = stored.model;
  if (stored.provider === "responses") {
    if (stored.apiBaseUrl) env.CODEMAP_AGENT_API_BASE_URL = stored.apiBaseUrl;
    if (stored.apiKey) {
      env.CODEMAP_AGENT_API_KEY_ENV = KEY_ENV;
      env[KEY_ENV] = stored.apiKey;
    }
  }
  return env;
}
export function buildRunner(env: NodeJS.ProcessEnv): AgentRunner {
  return env.CODEMAP_AGENT_PROVIDER === "responses"
    ? createResponsesRunner(env)
    : createNativeRunner(env);
}
/** Delegating runner so settings can change the provider without restarting the server. */
export function createSwitchableRunner(initial: AgentRunner) {
  let current = initial;
  const runner: AgentRunner = {
    status: () => current.status(),
    start: (context, emit) => current.start(context, emit),
  };
  return { runner, replace: (next: AgentRunner) => (current = next) };
}

export interface CliProbe {
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  /** Ready to connect with one click. */
  ready: boolean;
  detail?: string;
  profiles?: string[];
  model?: string;
  modelProvider?: string;
  authentication?: "api-environment" | "openai-account" | "none";
}
export interface ProbeResult {
  platformSupported: boolean;
  codex: CliProbe;
  claude: CliProbe;
}
const firstLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean)
    ?.slice(0, 120);
async function listCodexProfiles(env: NodeJS.ProcessEnv): Promise<string[]> {
  const home = env.CODEX_HOME ?? join(homedir(), ".codex");
  const names = new Set<string>();
  try {
    for (const f of await readdir(home)) {
      const m = /^(.+)\.config\.toml$/.exec(f);
      if (m?.[1] && safeName.test(m[1])) names.add(m[1]);
    }
  } catch {}
  try {
    const base = parse(await readFile(join(home, "config.toml"), "utf8")) as {
      profiles?: Record<string, unknown>;
    };
    for (const k of Object.keys(base.profiles ?? {}))
      if (safeName.test(k)) names.add(k);
  } catch {}
  return [...names].sort();
}
/** Read-only status probes run when the settings dialog opens. No model call is made. */
export async function probeClis(
  env: NodeJS.ProcessEnv,
  profile?: string,
): Promise<ProbeResult> {
  const platformSupported = process.platform !== "win32";
  const codexCmd = await resolveAgentCommand("codex", env);
  const claudeCmd = await resolveAgentCommand("claude", env);
  const codex: CliProbe = { installed: !!codexCmd, loggedIn: false, ready: false };
  const claude: CliProbe = { installed: !!claudeCmd, loggedIn: false, ready: false };
  await Promise.all([
    (async () => {
      if (!codexCmd) return;
      const [version, login] = await Promise.all([
        probe(codexCmd, ["--version"], env),
        probe(codexCmd, ["login", "status"], env),
      ]);
      codex.version = firstLine(version.text);
      codex.loggedIn =
        login.code === 0 && !/not logged in/i.test(login.text);
      codex.profiles = await listCodexProfiles(env);
      try {
        const sel = await loadCodexSelection({
          ...env,
          ...(profile ? { CODEMAP_CODEX_PROFILE: profile } : {}),
        });
        codex.model = sel.metadata.model;
        codex.modelProvider = sel.metadata.modelProvider;
        codex.authentication = sel.metadata.authentication;
        codex.ready =
          sel.metadata.authentication === "api-environment" ||
          (sel.metadata.authentication === "openai-account" && codex.loggedIn);
      } catch (error) {
        codex.detail = (error as Error).message;
      }
    })(),
    (async () => {
      if (!claudeCmd) return;
      const [version, auth] = await Promise.all([
        probe(claudeCmd, ["--version"], env),
        probe(claudeCmd, ["auth", "status"], env),
      ]);
      claude.version = firstLine(version.text);
      claude.loggedIn =
        auth.code === 0 && !/not logged in|"loggedIn"\s*:\s*false/i.test(auth.text);
      claude.ready = claude.loggedIn;
    })(),
  ]);
  if (!platformSupported) {
    codex.ready = false;
    claude.ready = false;
  }
  return { platformSupported, codex, claude };
}
