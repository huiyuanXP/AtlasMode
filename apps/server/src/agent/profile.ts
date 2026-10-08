import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";

export type CodexAuthentication = "api-environment" | "openai-account" | "none";
export interface CodexSelection {
  metadata: {
    profile?: string;
    model?: string;
    modelProvider: string;
    authentication: CodexAuthentication;
  };
  overrides: string[];
  environment: Record<string, string>;
  accountStore?: string;
}
export class CodexConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexConfigError";
  }
}
type Table = Record<string, unknown>;
const table = (value: unknown): Table =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Table)
    : {};
const invalid = () =>
  new CodexConfigError(
    "Selected Codex configuration is invalid or unsupported. Check the local CLI configuration.",
  );
async function readConfig(
  path: string,
  optional = false,
): Promise<Table | undefined> {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > 1024 * 1024) throw invalid();
    const text = await readFile(path, "utf8");
    if (Buffer.byteLength(text) > 1024 * 1024) throw invalid();
    // Parser errors can quote source lines containing credentials. Never surface them.
    try {
      return parse(text) as Table;
    } catch {
      throw invalid();
    }
  } catch (error) {
    if (optional && (error as NodeJS.ErrnoException).code === "ENOENT")
      return undefined;
    if (error instanceof CodexConfigError) throw error;
    throw new CodexConfigError(
      "Cannot read the selected local Codex configuration.",
    );
  }
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw invalid();
  return value;
}
function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, string(v)]),
  );
}
/** Encode only the validated inference table; credential values never enter overrides. */
function inline(value: unknown): string {
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (value && typeof value === "object" && !Array.isArray(value))
    return (
      "{" +
      Object.entries(value)
        .map(([key, v]) => JSON.stringify(key) + "=" + inline(v))
        .join(",") +
      "}"
    );
  throw invalid();
}
const providerStrings = [
  "name",
  "base_url",
  "wire_api",
  "env_key",
  "model_catalog_url",
];
const providerBooleans = [
  "requires_openai_auth",
  "supports_websockets",
  "supports_standalone_web_search",
];
const providerIntegers = [
  "request_max_retries",
  "stream_max_retries",
  "stream_idle_timeout_ms",
  "websocket_connect_timeout_ms",
];
const rootStrings = [
  "model",
  "model_catalog_json",
  "model_reasoning_effort",
  "model_reasoning_summary",
  "model_verbosity",
];
const rootIntegers = [
  "model_context_window",
  "model_max_output_tokens",
  "model_auto_compact_token_limit",
];
function endpoint(value: string) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw invalid();
  } catch {
    throw new CodexConfigError(
      "Selected provider endpoint is unsupported. Credential-bearing endpoint URLs are not passed to CLI arguments.",
    );
  }
}
/** Read trusted account config, then transport only selected inference/provider fields. */
export async function loadCodexSelection(
  env: NodeJS.ProcessEnv,
): Promise<CodexSelection> {
  const home = env.CODEX_HOME ?? join(homedir(), ".codex");
  const base = (await readConfig(join(home, "config.toml"), true)) ?? {};
  const profile = env.CODEMAP_CODEX_PROFILE || undefined;
  let layer: Table = {};
  if (profile) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(profile))
      throw new CodexConfigError(
        "CODEMAP_CODEX_PROFILE must be a safe local profile name.",
      );
    const file = await readConfig(join(home, profile + ".config.toml"), true);
    const fallback = table(base.profiles)[profile];
    if (file) layer = file;
    else if (
      fallback &&
      typeof fallback === "object" &&
      !Array.isArray(fallback)
    )
      layer = table(fallback);
    else throw new CodexConfigError("Selected Codex profile does not exist.");
  }
  const chosen = { ...base, ...layer };
  const modelProvider =
    chosen.model_provider === undefined
      ? "openai"
      : string(chosen.model_provider);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(modelProvider)) throw invalid();
  const baseProvider = table(table(base.model_providers)[modelProvider]),
    profileProvider = table(table(layer.model_providers)[modelProvider]);
  const exists =
    Object.keys(baseProvider).length > 0 ||
    Object.keys(profileProvider).length > 0;
  if (!exists && modelProvider !== "openai")
    throw new CodexConfigError(
      "Selected model provider is not defined in the local base/profile configuration.",
    );
  const provider = { ...baseProvider, ...profileProvider };
  if (
    provider.auth !== undefined ||
    provider.aws !== undefined ||
    provider.gateway_oauth !== undefined ||
    (provider.query_params !== undefined &&
      Object.keys(stringMap(provider.query_params)).length > 0)
  )
    throw new CodexConfigError(
      "Selected provider uses unsupported command, AWS, gateway or query authentication/options.",
    );
  const safeProvider: Table = {};
  for (const key of providerStrings)
    if (provider[key] !== undefined) {
      safeProvider[key] = string(provider[key]);
      if (key === "base_url" || key === "model_catalog_url")
        endpoint(safeProvider[key] as string);
    }
  for (const key of providerBooleans)
    if (provider[key] !== undefined) {
      if (typeof provider[key] !== "boolean") throw invalid();
      safeProvider[key] = provider[key];
    }
  for (const key of providerIntegers)
    if (provider[key] !== undefined) {
      if (!Number.isSafeInteger(provider[key]) || Number(provider[key]) < 0)
        throw invalid();
      safeProvider[key] = provider[key];
    }
  const environment: Record<string, string> = {};
  const envHeaders =
    provider.env_http_headers === undefined
      ? {}
      : stringMap(provider.env_http_headers);
  if (provider.http_headers !== undefined) {
    let index = 0;
    for (const [header, value] of Object.entries(
      stringMap(provider.http_headers),
    )) {
      const name = "ATLASMODE_CODEX_HEADER_" + index++;
      environment[name] = value;
      envHeaders[header] = name;
    }
  }
  if (Object.keys(envHeaders).length) {
    for (const name of Object.values(envHeaders))
      if (environment[name] === undefined && !env[name])
        throw new CodexConfigError(
          "Selected provider requires environment credentials/headers unavailable to this service.",
        );
    safeProvider.env_http_headers = envHeaders;
  }
  const requiresOpenAI = exists ? provider.requires_openai_auth === true : true;
  if (provider.experimental_bearer_token !== undefined) {
    if (requiresOpenAI || provider.env_key !== undefined)
      throw new CodexConfigError(
        "Selected provider has conflicting inline and account/environment authentication settings.",
      );
    environment.ATLASMODE_CODEX_BEARER_TOKEN = string(
      provider.experimental_bearer_token,
    );
    safeProvider.env_key = "ATLASMODE_CODEX_BEARER_TOKEN";
  }
  let authentication: CodexAuthentication = requiresOpenAI
    ? "openai-account"
    : "none";
  if (!requiresOpenAI && safeProvider.env_key !== undefined) {
    const name = string(safeProvider.env_key);
    if (!environment[name] && !env[name])
      throw new CodexConfigError(
        "Selected provider API environment credential is unavailable to this service.",
      );
    authentication = "api-environment";
  }
  const inference: Table = {};
  for (const key of rootStrings)
    if (chosen[key] !== undefined) inference[key] = string(chosen[key]);
  for (const key of rootIntegers)
    if (chosen[key] !== undefined) {
      if (!Number.isSafeInteger(chosen[key]) || Number(chosen[key]) < 1)
        throw invalid();
      inference[key] = chosen[key];
    }
  if (env.CODEMAP_AGENT_MODEL) inference.model = env.CODEMAP_AGENT_MODEL;
  let accountStore: string | undefined;
  if (chosen.cli_auth_credentials_store !== undefined) {
    accountStore = string(chosen.cli_auth_credentials_store);
    if (!["file", "keyring", "auto", "ephemeral"].includes(accountStore))
      throw invalid();
    inference.cli_auth_credentials_store = accountStore;
  }
  const overrides = Object.entries(inference).map(
    ([key, value]) => key + "=" + inline(value),
  );
  overrides.push("model_provider=" + inline(modelProvider));
  if (exists)
    overrides.push(
      "model_providers=" + inline({ [modelProvider]: safeProvider }),
    );
  return {
    metadata: {
      ...(profile ? { profile } : {}),
      ...(typeof inference.model === "string"
        ? { model: inference.model }
        : {}),
      modelProvider,
      authentication,
    },
    overrides,
    environment,
    accountStore,
  };
}
