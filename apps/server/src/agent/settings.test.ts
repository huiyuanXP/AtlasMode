import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  AgentSettingsStore,
  environmentFor,
  settingsSchema,
} from "./settings.js";

it("stores the API key 0600, never exposes it, keeps it when omitted and clears on null", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atlas-settings-"));
  const file = join(dir, "agent-settings.json");
  const store = new AgentSettingsStore(file);
  await store.save({ provider: "responses", model: "m", apiKey: "sk-secret" });
  // Windows has no POSIX permission bits (stat reports 0666 regardless of
  // chmod), so owner-only mode can only be asserted on POSIX platforms. Every
  // other assertion below still runs everywhere.
  if (process.platform !== "win32")
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  expect(JSON.stringify(store.publicView({}))).not.toContain("sk-secret");
  expect(store.publicView({}).apiKeyConfigured).toBe(true);
  await store.save({ provider: "responses", model: "m2" });
  expect(store.get()?.apiKey).toBe("sk-secret");
  await store.save({ provider: "responses", model: "m2", apiKey: null });
  expect(JSON.parse(await readFile(file, "utf8")).apiKey).toBeUndefined();
  const reloaded = new AgentSettingsStore(file);
  expect((await reloaded.load())?.model).toBe("m2");
});

it("an environment key is reported separately and never counted as a saved key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atlas-settings-"));
  const store = new AgentSettingsStore(join(dir, "s.json"));
  expect(store.publicView({ OPENAI_API_KEY: "k" })).toMatchObject({
    apiKeyConfigured: false,
    apiKeyEnvironment: true,
  });
  await store.save({ provider: "codex" });
  expect(store.publicView({})).toMatchObject({
    apiKeyConfigured: false,
    apiKeyEnvironment: false,
  });
});

it("saved settings override launch env without leaking the key into a shared variable name", () => {
  const env = environmentFor(
    { CODEMAP_AGENT_PROVIDER: "claude", OPENAI_API_KEY: "launch" },
    { provider: "responses", model: "m", apiKey: "sk-saved" },
  );
  expect(env.CODEMAP_AGENT_PROVIDER).toBe("responses");
  expect(env.CODEMAP_AGENT_API_KEY_ENV).toBe("ATLASMODE_SETTINGS_API_KEY");
  expect(env.ATLASMODE_SETTINGS_API_KEY).toBe("sk-saved");
  expect(environmentFor({ X: "1" }, undefined).X).toBe("1");
  expect(
    environmentFor({ CODEMAP_AGENT_PROVIDER: "codex" }, { provider: "off" })
      .CODEMAP_AGENT_PROVIDER,
  ).toBeUndefined();
});

it("rejects unsafe profile names, unknown fields and multi-line keys", () => {
  expect(settingsSchema.safeParse({ provider: "codex", codexProfile: "../x" }).success).toBe(false);
  expect(settingsSchema.safeParse({ provider: "codex", command: "/bin/sh" }).success).toBe(false);
  expect(settingsSchema.safeParse({ provider: "responses", apiKey: "a\nb" }).success).toBe(false);
  expect(settingsSchema.safeParse({ provider: "codex", codexProfile: "mimo" }).success).toBe(true);
});
