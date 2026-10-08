import { expect, test } from "vitest";
import { createNativeRunner, buildInvocation } from "./native.js";
import type { AgentContext } from "./types.js";
const context: AgentContext = {
  projectId: "trusted-project",
  input: { channel: "plan", message: "$(unsafe)" },
  prompt: "user text",
  apiUrl: "http://127.0.0.1:12345",
  tools: ["propose_plan", "get_project_summary"],
};
// This checks the actual spawn boundary consumed by the runner, rather than source/config text.
test.skipIf(process.platform === "win32")(
  "Codex invocation disables native execution and uses required per-run scoped MCP in trusted cwd",
  () => {
    const run = buildInvocation(
      "codex",
      "/trusted/codex",
      context,
      "/tmp/empty-trusted",
      {
        PATH: "/bin",
        CODEMAP_AGENT_MODEL: "user-model",
        NODE_OPTIONS: "--require hostile",
        CODEX_THREAD_ID: "old",
      },
    );
    expect(run.cwd).toBe("/tmp/empty-trusted");
    expect(run.prompt).toBe("user text");
    expect(run.args).toContain("--ignore-user-config");
    expect(run.args).toContain("--ignore-rules");
    expect(run.args[run.args.indexOf("--sandbox") + 1]).toBe("read-only");
    for (const name of [
      "shell_tool",
      "unified_exec",
      "code_mode",
      "code_mode_host",
      "browser_use",
      "computer_use",
      "apps",
      "plugins",
      "hooks",
      "multi_agent",
    ])
      expect(
        run.args.some((v, i) => v === "--disable" && run.args[i + 1] === name),
      ).toBe(true);
    const mcp = run.args.find((v) => v.startsWith("mcp_servers.atlasmode="));
    expect(mcp).toContain("required=true");
    expect(mcp).toContain(
      'enabled_tools=["propose_plan","get_project_summary"]',
    );
    expect(mcp).toContain('CODEMAP_MCP_PROJECT_ID="trusted-project"');
    expect(mcp).toContain("/apps/mcp/dist/index.js");
    expect(run.args).toContain('web_search="disabled"');
    expect(run.env?.NODE_OPTIONS).toBeUndefined();
    expect(run.env?.CODEX_THREAD_ID).toBeUndefined();
    expect(run.args).toContain("user-model");
  },
);
test.skipIf(process.platform === "win32")(
  "Claude invocation has no builtins or inherited settings and only bounded MCP tools",
  () => {
    const run = buildInvocation(
      "claude",
      "/trusted/claude",
      context,
      "/tmp/trusted",
      {},
    );
    expect(run.args[run.args.indexOf("--tools") + 1]).toBe("");
    expect(run.args).toContain("--strict-mcp-config");
    expect(run.args[run.args.indexOf("--setting-sources") + 1]).toBe("");
    const mcp = JSON.parse(run.args[run.args.indexOf("--mcp-config") + 1]!);
    expect(Object.keys(mcp.mcpServers)).toEqual(["atlasmode"]);
    expect(mcp.mcpServers.atlasmode.env.CODEMAP_API_URL).toBe(context.apiUrl);
  },
);
test("default disabled, missing executable and unsupported flags truthfully report unavailable", async () => {
  expect(await createNativeRunner({}).status()).toMatchObject({
    configured: false,
    available: false,
    provider: null,
  });
  expect(
    await createNativeRunner({
      CODEMAP_AGENT_PROVIDER: "codex",
      CODEMAP_AGENT_COMMAND: "/missing-agent",
    }).status(),
  ).toMatchObject({ configured: true, available: false });
  const noFlags = await createNativeRunner({
    CODEMAP_AGENT_PROVIDER: "codex",
    CODEMAP_AGENT_COMMAND: process.execPath,
  }).status();
  expect(noFlags.available).toBe(false);
  expect(noFlags.reason).toContain(
    process.platform === "win32" ? "Windows" : "isolation flags",
  );
});
