import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startProcess, type ProcessInvocation } from "./process.js";
import type { AgentContext, AgentRunner, AgentStatus } from "./types.js";

const disabledFeatures = [
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
/** Administrator environment is trusted. No executable, flags or model comes from Chat input. */
export async function resolveAgentCommand(
  command: string,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  const candidates = isAbsolute(command)
    ? [command]
    : command.includes("/") || command.includes("\\")
      ? []
      : (env.PATH ?? "")
          .split(delimiter)
          .flatMap((dir) =>
            process.platform === "win32"
              ? [join(dir, command + ".exe"), join(dir, command)]
              : [join(dir, command)],
          );
  for (const path of candidates) {
    try {
      if ((await stat(path)).isFile()) return path;
    } catch {}
  }
}
async function probe(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; text: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let text = "",
      settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, 5000);
    timer.unref();
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, text });
    };
    const collect = (chunk: Buffer) => {
      if (text.length + chunk.length > 65536) {
        child.kill();
        finish(null);
      } else text += chunk.toString();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", () => finish(null));
    child.once("exit", finish);
  });
}
export function buildInvocation(
  provider: "codex" | "claude",
  command: string,
  context: AgentContext,
  cwd: string,
  env: NodeJS.ProcessEnv,
): ProcessInvocation {
  const mcpEntry = fileURLToPath(
    new URL("../../../mcp/dist/index.js", import.meta.url),
  );
  const mcpEnv = {
    CODEMAP_API_URL: context.apiUrl,
    CODEMAP_MCP_PROJECT_ID: context.projectId,
    CODEMAP_MCP_CHANNEL: context.input.channel,
  };
  const args =
    provider === "codex"
      ? [
          "exec",
          "--json",
          "--sandbox",
          "read-only",
          "--ephemeral",
          "--ignore-user-config",
          "--ignore-rules",
          "--skip-git-repo-check",
          "--color",
          "never",
          ...disabledFeatures.flatMap((feature) => ["--disable", feature]),
          "-c",
          'web_search="disabled"',
          "-c",
          'approval_policy="never"',
          "-c",
          `mcp_servers.atlasmode={command=${JSON.stringify(process.execPath)},args=[${JSON.stringify(mcpEntry)}],env={${Object.entries(
            mcpEnv,
          )
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(
              ",",
            )}},required=true,enabled_tools=${JSON.stringify(context.tools)}}`,
          ...(env.CODEMAP_AGENT_MODEL
            ? ["--model", env.CODEMAP_AGENT_MODEL]
            : []),
          "-",
        ]
      : [
          "--print",
          "--output-format",
          "stream-json",
          "--verbose",
          "--tools",
          "",
          "--strict-mcp-config",
          "--setting-sources",
          "",
          "--disable-slash-commands",
          "--no-session-persistence",
          "--no-chrome",
          "--settings",
          JSON.stringify({ disableAllHooks: true }),
          "--mcp-config",
          JSON.stringify({
            mcpServers: {
              atlasmode: {
                command: process.execPath,
                args: [mcpEntry],
                env: mcpEnv,
              },
            },
          }),
          "--allowedTools",
          context.tools.map((name) => "mcp__atlasmode__" + name).join(","),
          ...(env.CODEMAP_AGENT_MODEL
            ? ["--model", env.CODEMAP_AGENT_MODEL]
            : []),
        ];
  // Do not inherit ephemeral in-agent hooks, provider selection or arbitrary NODE preloads.
  const runEnv = { ...env };
  for (const key of Object.keys(runEnv))
    if (key.startsWith("CODEX_") && key !== "CODEX_HOME") delete runEnv[key];
  delete runEnv.NODE_OPTIONS;
  delete runEnv.NODE_PATH;
  return { command, args, cwd, prompt: context.prompt, provider, env: runEnv };
}
export function createNativeRunner(
  env: NodeJS.ProcessEnv = process.env,
): AgentRunner {
  const selected = env.CODEMAP_AGENT_PROVIDER;
  const provider =
    selected === "codex" || selected === "claude" ? selected : null;
  let checked: Promise<{ status: AgentStatus; command?: string }> | undefined;
  const inspect = () =>
    (checked ??= (async () => {
      const status: AgentStatus = {
        provider,
        configured: !!selected,
        available: false,
      };
      const unavailable = (
        reason: string,
      ): { status: AgentStatus; command?: string } => ({
        status: { ...status, reason },
      });
      if (!selected)
        return unavailable(
          "Local Agent is disabled. Configure CODEMAP_AGENT_PROVIDER to connect.",
        );
      if (!provider)
        return unavailable("Unsupported Agent provider. Use codex or claude.");
      const command = await resolveAgentCommand(
        env.CODEMAP_AGENT_COMMAND ?? provider,
        env,
      );
      if (!command)
        return unavailable(
          "Agent executable is unavailable. Install the selected CLI or configure its trusted absolute path.",
        );
      const help = await probe(
        command,
        provider === "codex" ? ["exec", "--help"] : ["--help"],
        env,
      );
      const required =
        provider === "codex"
          ? [
              "--json",
              "--ignore-user-config",
              "--ignore-rules",
              "--ephemeral",
              "--sandbox",
            ]
          : [
              "--tools",
              "--strict-mcp-config",
              "--setting-sources",
              "--disable-slash-commands",
              "--no-session-persistence",
              "--no-chrome",
            ];
      if (help.code !== 0 || required.some((flag) => !help.text.includes(flag)))
        return unavailable(
          "CLI lacks required isolation flags. Update the CLI before connecting.",
        );
      if (provider === "codex") {
        const features = await probe(command, ["features", "list"], env);
        if (
          features.code !== 0 ||
          disabledFeatures.some(
            (flag) => !new RegExp("^" + flag + "\\s", "m").test(features.text),
          )
        )
          return unavailable(
            "CLI cannot verify required tool restrictions. Update the CLI before connecting.",
          );
      }
      const login = await probe(
        command,
        provider === "codex" ? ["login", "status"] : ["auth", "status"],
        env,
      );
      if (
        login.code !== 0 ||
        /not logged in|"loggedIn"\s*:\s*false/i.test(login.text)
      )
        return unavailable(
          "Agent CLI is not logged in. Sign in locally with the selected CLI and restart the service.",
        );
      try {
        await stat(
          fileURLToPath(new URL("../../../mcp/dist/index.js", import.meta.url)),
        );
      } catch {
        return unavailable(
          "AtlasMode MCP build is unavailable. Build the MCP workspace before connecting.",
        );
      }
      return { status: { ...status, available: true }, command };
    })());
  return {
    status: async () => (await inspect()).status,
    start: async (context, emit) => {
      const ready = await inspect();
      if (!ready.status.available || !ready.command || !provider)
        throw new Error("AGENT_UNAVAILABLE");
      const cwd = await mkdtemp(join(tmpdir(), "atlasmode-agent-"));
      try {
        const run = startProcess(
          buildInvocation(provider, ready.command, context, cwd, env),
          emit,
        );
        const done = run.done.finally(() =>
          rm(cwd, { recursive: true, force: true }),
        );
        return {
          done,
          stop: async () => {
            await run.stop();
            await done;
          },
        };
      } catch (error) {
        await rm(cwd, { recursive: true, force: true });
        throw error;
      }
    },
  };
}
