import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

export type AgentEvent =
  | { type: "message"; text: string }
  | {
      type: "activity";
      tool: string;
      status: "running" | "completed" | "failed";
    };
export type ProcessResult = { ok: true } | { ok: false; code: string };
export interface RunningAgent {
  done: Promise<ProcessResult>;
  stop(): Promise<void>;
}
export interface ProcessInvocation {
  command: string;
  args: string[];
  cwd: string;
  prompt: string;
  provider: "codex" | "claude";
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  graceMs?: number;
}
/** The detached process group belongs exclusively to this invocation; never kill by executable name. */
export function startProcess(
  input: ProcessInvocation,
  emit: (event: AgentEvent) => void,
): RunningAgent {
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: input.env ?? process.env,
    shell: false,
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const decoder = new StringDecoder("utf8");
  let buffer = "",
    bytes = 0,
    failure: string | undefined,
    stopping: Promise<void> | undefined;
  let sawText = false,
    sawError = false;
  const seen = new Set<string>();
  const toolIds = new Map<string, string>();
  let resolveClose!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  let resolveExit!: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });
  const grace = input.graceMs ?? 2000;
  async function signalTree(force: boolean) {
    if (!child.pid) return;
    if (process.platform === "win32") {
      // taskkill's /T is the native Windows ownership-aware descendant walk.
      await new Promise<void>((resolve) => {
        const killer = spawn(
          "taskkill",
          ["/PID", String(child.pid), "/T", ...(force ? ["/F"] : [])],
          { shell: false, stdio: "ignore", windowsHide: true },
        );
        killer.once("error", () => resolve());
        killer.once("exit", () => resolve());
      });
    } else {
      try {
        process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
  }
  function groupAlive() {
    if (!child.pid) return false;
    if (process.platform === "win32")
      return child.exitCode === null && child.signalCode === null;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch {
      return false;
    }
  }
  function cleanup() {
    if (stopping) return stopping;
    stopping = (async () => {
      await signalTree(false);
      // CLI exit does not mean its MCP/grandchildren exited. Keep ownership until group cleanup.
      const deadline = Date.now() + grace;
      while (groupAlive() && Date.now() < deadline)
        await new Promise((r) => setTimeout(r, 20));
      if (groupAlive()) await signalTree(true);
      await exited;
    })();
    return stopping;
  }
  function fail(code: string) {
    failure ??= code;
    void cleanup();
  }
  function message(text: unknown) {
    if (typeof text !== "string" || !text.trim() || seen.has(text)) return;
    seen.add(text);
    sawText = true;
    emit({ type: "message", text });
  }
  function activity(name: unknown, status: "running" | "completed" | "failed") {
    if (typeof name !== "string") return;
    const tool = name.replace(/^mcp__atlasmode__/, "");
    if (!/^[a-z_]{1,80}$/.test(tool)) {
      fail("AGENT_PROTOCOL");
      return;
    }
    emit({ type: "activity", tool, status });
  }
  function parse(line: string) {
    if (!line.trim()) return;
    let event: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      event = value as Record<string, unknown>;
    } catch {
      fail("AGENT_PROTOCOL");
      return;
    }
    if (typeof event.type !== "string") {
      fail("AGENT_PROTOCOL");
      return;
    }
    if (input.provider === "codex") {
      if (event.type === "error" || event.type === "turn.failed") {
        sawError = true;
        fail("AGENT_FAILED");
        return;
      }
      if (event.type.startsWith("item.")) {
        const item = event.item as Record<string, unknown> | undefined;
        if (!item || typeof item.type !== "string") {
          fail("AGENT_PROTOCOL");
          return;
        }
        if (
          ![
            "agent_message",
            "mcp_tool_call",
            "reasoning",
            "todo_list",
          ].includes(item.type)
        ) {
          fail("AGENT_UNSAFE_TOOL");
          return;
        }
        if (item.type === "agent_message" && event.type === "item.completed")
          message(item.text);
        if (item.type === "mcp_tool_call") {
          if (item.server !== "atlasmode") {
            fail("AGENT_UNSAFE_TOOL");
            return;
          }
          activity(
            item.tool,
            event.type === "item.completed"
              ? item.error || item.status === "failed"
                ? "failed"
                : "completed"
              : "running",
          );
        }
      }
    } else {
      if (event.type === "assistant") {
        const content = (event.message as { content?: unknown[] } | undefined)
          ?.content;
        if (!Array.isArray(content)) {
          fail("AGENT_PROTOCOL");
          return;
        }
        for (const raw of content) {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            fail("AGENT_PROTOCOL");
            return;
          }
          const block = raw as Record<string, unknown>;
          if (block.type === "text") message(block.text);
          if (block.type === "tool_use") {
            if (
              typeof block.name !== "string" ||
              !block.name.startsWith("mcp__atlasmode__")
            ) {
              fail("AGENT_UNSAFE_TOOL");
              return;
            }
            if (typeof block.id !== "string") {
              fail("AGENT_PROTOCOL");
              return;
            }
            toolIds.set(block.id, block.name);
            activity(block.name, "running");
          }
        }
      }
      if (event.type === "result") {
        if (event.is_error === true) {
          sawError = true;
          fail("AGENT_FAILED");
        } else message(event.result);
      }
      if (event.type === "user") {
        const content = (event.message as { content?: unknown[] } | undefined)
          ?.content;
        if (Array.isArray(content))
          for (const raw of content) {
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
              fail("AGENT_PROTOCOL");
              return;
            }
            const block = raw as Record<string, unknown>;
            if (
              block.type === "tool_result" &&
              typeof block.tool_use_id === "string"
            ) {
              const tool = toolIds.get(block.tool_use_id);
              if (tool) {
                activity(
                  tool,
                  block.is_error === true ? "failed" : "completed",
                );
                toolIds.delete(block.tool_use_id);
              }
              /* results remain private; gateway journals writes */
            }
          }
      }
    }
  }
  child.stdout.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) {
      fail("AGENT_OUTPUT_LIMIT");
      return;
    }
    buffer += decoder.write(chunk);
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0 && !failure) {
      parse(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
    }
  });
  // Never forward provider stderr: it may contain account tokens or source/code-mode dumps.
  child.stderr.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) fail("AGENT_OUTPUT_LIMIT");
  });
  child.stdin.on("error", () => {});
  child.once("error", () => {
    failure ??= "AGENT_UNAVAILABLE";
    resolveExit();
  });
  child.once("close", () => resolveClose());
  child.once("exit", (code) => {
    if (code !== 0) failure ??= "AGENT_FAILED";
    resolveExit();
  });
  child.stdin.end(input.prompt);
  const timer = setTimeout(
    () => fail("AGENT_TIMEOUT"),
    input.timeoutMs ?? 120000,
  );
  timer.unref();
  const done = (async (): Promise<ProcessResult> => {
    await exited;
    clearTimeout(timer);
    await cleanup();
    await closed;
    buffer += decoder.end();
    if (!failure && buffer.trim()) parse(buffer);
    if (!failure && (!sawText || sawError)) failure = "AGENT_PROTOCOL";
    return failure ? { ok: false, code: failure } : { ok: true };
  })();
  return {
    done,
    stop: async () => {
      failure ??= "AGENT_CANCELLED";
      await cleanup();
      await done;
    },
  };
}
