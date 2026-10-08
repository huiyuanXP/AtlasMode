import { afterEach, expect, test } from "vitest";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as profiles from "./profile.js";
import { buildInvocation, createNativeRunner } from "./native.js";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
});
const context = {
  projectId: "selected-project",
  input: { channel: "plan" as const, message: "x" },
  prompt: "x",
  apiUrl: "http://127.0.0.1:12345",
  tools: ["propose_plan"],
};
async function config(base: string, profile?: string) {
  const root = await mkdtemp(join(tmpdir(), "atlas-profile-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "config.toml"), base);
  if (profile) await writeFile(join(root, "mimo.config.toml"), profile);
  return root;
}
test("file profile inherits its selected base provider and only model/provider inference settings cross isolation", async () => {
  expect(profiles.loadCodexSelection).toBeTypeOf("function");
  const root = await config(
    'model="base-model"\nmodel_provider="oneapi"\nmodel_reasoning_effort="high"\n[model_providers.oneapi]\nname="oneapi"\nbase_url="https://first.invalid/v1"\nwire_api="responses"\nenv_key="FIRST_KEY"\n[model_providers.mimo]\nname="mimo"\nbase_url="https://mimo.invalid/v1"\nwire_api="responses"\nenv_key="MIMO_API_KEY"\n[profiles.mimo]\nmodel="ignored-inline"\n[mcp_servers.foreign]\ncommand="dangerous"\n[features]\nshell_tool=true',
    'model="mimo-model"\nmodel_provider="mimo"\nmodel_reasoning_effort="low"',
  );
  const env = {
    CODEX_HOME: root,
    CODEMAP_CODEX_PROFILE: "mimo",
    MIMO_API_KEY: "fixture-key",
  };
  const selection = await profiles.loadCodexSelection(env);
  expect(selection.metadata).toEqual({
    profile: "mimo",
    model: "mimo-model",
    modelProvider: "mimo",
    authentication: "api-environment",
  });
  const run = buildInvocation(
    "codex",
    "/trusted/codex",
    context,
    root,
    env,
    selection,
  );
  expect(run.args).toContain('model="mimo-model"');
  expect(run.args).toContain('model_provider="mimo"');
  expect(run.args).toContain('model_reasoning_effort="low"');
  expect(run.args).toContain("--ignore-user-config");
  expect(run.args).not.toContain("--profile");
  expect(run.args.join("\n")).not.toContain("dangerous");
  expect(run.args.join("\n")).not.toContain("foreign");
  expect(run.args.join("\n")).not.toContain("fixture-key");
  expect(run.env?.MIMO_API_KEY).toBe("fixture-key");
  expect(run.env?.CODEX_HOME).toBe(root);
});
test("default selection uses base model/provider and trusted explicit model override while inline fallback profile works", async () => {
  expect(profiles.loadCodexSelection).toBeTypeOf("function");
  const root = await config(
    'model="base"\nmodel_provider="local"\n[model_providers.local]\nname="local"\nbase_url="http://localhost:9999/v1"\nwire_api="responses"\n[profiles.fallback]\nmodel="profile"',
  );
  expect(
    (await profiles.loadCodexSelection({ CODEX_HOME: root })).metadata,
  ).toEqual({ model: "base", modelProvider: "local", authentication: "none" });
  expect(
    (
      await profiles.loadCodexSelection({
        CODEX_HOME: root,
        CODEMAP_CODEX_PROFILE: "fallback",
        CODEMAP_AGENT_MODEL: "override",
      })
    ).metadata.model,
  ).toBe("override");
});
test("selected file profile retains the provider model catalog needed for native model metadata", async () => {
  const root = await config(
    'model="base"\nmodel_provider="api"\n[model_providers.api]\nname="api"\nenv_key="API_KEY"',
    'model="custom-model"\nmodel_catalog_json="/trusted/models.json"',
  );
  const selected = await profiles.loadCodexSelection({
    CODEX_HOME: root,
    CODEMAP_CODEX_PROFILE: "mimo",
    API_KEY: "fixture-key",
  });
  expect(selected.overrides).toContain(
    'model_catalog_json="/trusted/models.json"',
  );
});
test("inline bearer and headers move to private runtime env instead of argv; OpenAI auth ignores env-key gate", async () => {
  expect(profiles.loadCodexSelection).toBeTypeOf("function");
  const root = await config(
    'model="base"\nmodel_provider="proxy"\n[model_providers.proxy]\nname="proxy"\nbase_url="https://proxy.invalid/v1"\nwire_api="responses"\nexperimental_bearer_token="fixture-bearer-secret"\n[model_providers.proxy.http_headers]\nX-Custom="fixture-header-secret"',
  );
  const selection = await profiles.loadCodexSelection({ CODEX_HOME: root });
  const run = buildInvocation(
    "codex",
    "/trusted/codex",
    context,
    root,
    { CODEX_HOME: root },
    selection,
  );
  expect(selection.metadata.authentication).toBe("api-environment");
  expect(run.args.join("\n")).not.toContain("fixture-bearer-secret");
  expect(run.args.join("\n")).not.toContain("fixture-header-secret");
  expect(Object.values(run.env ?? {})).toContain("fixture-bearer-secret");
  expect(Object.values(run.env ?? {})).toContain("fixture-header-secret");
  await writeFile(
    join(root, "config.toml"),
    'model_provider="proxy"\n[model_providers.proxy]\nname="proxy"\nrequires_openai_auth=true\nenv_key="ABSENT_KEY"',
  );
  expect(
    (await profiles.loadCodexSelection({ CODEX_HOME: root })).metadata
      .authentication,
  ).toBe("openai-account");
});
test("unsafe/missing profile, missing required environment and malformed TOML fail safely without token excerpts", async () => {
  expect(profiles.loadCodexSelection).toBeTypeOf("function");
  const root = await config(
    'model_provider="api"\n[model_providers.api]\nname="api"\nenv_key="ABSENT_KEY"',
  );
  for (const env of [
    { CODEX_HOME: root },
    { CODEX_HOME: root, CODEMAP_CODEX_PROFILE: "../escape" },
    { CODEX_HOME: root, CODEMAP_CODEX_PROFILE: "missing" },
  ])
    await expect(profiles.loadCodexSelection(env)).rejects.toThrow();
  await writeFile(
    join(root, "config.toml"),
    'experimental_bearer_token="fixture-do-not-expose',
  );
  try {
    await profiles.loadCodexSelection({ CODEX_HOME: root });
    throw Error("expected failure");
  } catch (error) {
    expect(String(error)).not.toContain("fixture-do-not-expose");
  }
});
const posixTest = test.skipIf(process.platform === "win32");
posixTest(
  "API-env profile readiness succeeds without account login and preserves configured model/provider",
  async () => {
    const root = await config(
      'model="base"\nmodel_provider="api"\n[model_providers.api]\nname="api"\nbase_url="https://api.invalid/v1"\nwire_api="responses"\nenv_key="EXISTING_API_KEY"',
    );
    const command = join(root, "test-cli.mjs"),
      log = join(root, "login-probed");
    const flags = [
      "shell_tool",
      "shell_snapshot",
      "shell_snapshot_v2",
      "daemon_auto_start",
      "unified_exec",
      "code_mode",
      "code_mode_host",
      "browser_use",
      "browser_use_external",
      "browser_use_full_cdp_access",
      "in_app_browser",
      "computer_use",
      "apps",
      "plugins",
      "hooks",
      "multi_agent",
      "multi_agent_v2",
      "image_generation",
      "view_image",
      "skill_search",
      "skill_mcp_dependency_install",
      "workspace_dependencies",
      "artifact",
      "remote_plugin",
    ];
    await writeFile(
      command,
      `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';const args=process.argv.slice(2);if(args.includes('--help'))console.log('--json --ignore-user-config --ignore-rules --ephemeral --sandbox');else if(args[0]==='features')console.log(${JSON.stringify(flags.map((k) => k + " stable false").join("\n"))});else if(args[0]==='login'){writeFileSync(${JSON.stringify(log)},'login');console.error('Not logged in');process.exitCode=1;}\n`,
      { mode: 0o755 },
    );
    const backend = createNativeRunner({
      CODEMAP_AGENT_PROVIDER: "codex",
      CODEMAP_AGENT_COMMAND: command,
      CODEX_HOME: root,
      EXISTING_API_KEY: "fixture-api-key",
    });
    expect(await backend.status()).toMatchObject({
      available: true,
      model: "base",
      modelProvider: "api",
      authentication: "api-environment",
    });
    await expect(readFile(log, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await writeFile(
      join(root, "config.toml"),
      'model="account-model"\nmodel_provider="api"\n[model_providers.api]\nname="api"\nrequires_openai_auth=true\nenv_key="ABSENT_ENV_IGNORED"',
    );
    const account = createNativeRunner({
      CODEMAP_AGENT_PROVIDER: "codex",
      CODEMAP_AGENT_COMMAND: command,
      CODEX_HOME: root,
    });
    expect(await account.status()).toMatchObject({
      available: false,
      model: "account-model",
      authentication: "openai-account",
    });
    expect(await readFile(log, "utf8")).toBe("login");
  },
);
