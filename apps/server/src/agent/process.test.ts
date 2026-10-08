import { afterEach, expect, test } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as processBridge from "./process.js";
const fixture = fileURLToPath(
  new URL("./test-fixtures/cli.mjs", import.meta.url),
);
// Native CLI process lifecycle is explicitly unsupported on Windows.
const posixTest = test.skipIf(process.platform === "win32");
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
async function start(mode: string, options: Record<string, unknown> = {}) {
  expect(processBridge.startProcess).toBeTypeOf("function");
  const cwd = await mkdtemp(join(tmpdir(), "atlas-agent-test-"));
  cleanup.push(() => rm(cwd, { recursive: true, force: true }));
  const events: processBridge.AgentEvent[] = [];
  const run = processBridge.startProcess(
    {
      command: process.execPath,
      args: [fixture, mode],
      cwd,
      prompt: "$(touch sentinel); `echo pwned` 中文",
      provider: "codex",
      ...options,
    },
    (e) => events.push(e),
  );
  cleanup.push(() => run.stop());
  return { run, events, cwd };
}
posixTest(
  "stdin text and argument arrays stay literal; split JSONL produces final public text",
  async () => {
    const { run, events, cwd } = await start("echo", {
      args: [fixture, "echo", "$(touch sentinel)"],
    });
    expect(await run.done).toEqual({ ok: true });
    const e = events.find((e) => e.type === "message");
    expect(e?.type).toBe("message");
    const value = JSON.parse(e && "text" in e ? e.text : "");
    expect(value).toEqual({
      prompt: "$(touch sentinel); `echo pwned` 中文",
      args: ["$(touch sentinel)"],
      cwd,
    });
  },
);
posixTest(
  "normalizes Codex tool status and Claude text without duplicate final result",
  async () => {
    const a = await start("tool");
    expect(await a.run.done).toEqual({ ok: true });
    expect(a.events).toContainEqual({
      type: "activity",
      tool: "propose_plan",
      status: "completed",
    });
    const b = await start("claude", { provider: "claude" });
    expect(await b.run.done).toEqual({ ok: true });
    expect(b.events.filter((e) => e.type === "message")).toEqual([
      { type: "message", text: "真实协议模拟文本" },
    ]);
    expect(b.events).toContainEqual({
      type: "activity",
      tool: "search_functions",
      status: "running",
    });
    expect(b.events).toContainEqual({
      type: "activity",
      tool: "search_functions",
      status: "completed",
    });
  },
);
posixTest.each([
  ["invalid", "AGENT_PROTOCOL"],
  ["oversize", "AGENT_OUTPUT_LIMIT"],
  ["auth", "AGENT_FAILED"],
  ["native", "AGENT_UNSAFE_TOOL"],
])("fails closed on %s without exposing stderr", async (mode, code) => {
  const { run, events } = await start(mode);
  expect(await run.done).toMatchObject({ ok: false, code });
  expect(JSON.stringify(events)).not.toContain("SECRET");
  expect(JSON.stringify(events)).not.toContain("secret");
});
posixTest("missing executable and timeout return safe errors", async () => {
  const a = await start("echo", { command: "/definitely-not-atlas-agent" });
  expect(await a.run.done).toMatchObject({
    ok: false,
    code: "AGENT_UNAVAILABLE",
  });
  const b = await start("hang", { timeoutMs: 40, graceMs: 40 });
  expect(await b.run.done).toMatchObject({ ok: false, code: "AGENT_TIMEOUT" });
});
posixTest("cancel waits for owned grandchild termination", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-tree-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "pid");
  const { run } = await start("tree", {
    args: [fixture, "tree", file],
    graceMs: 40,
  });
  let pid = 0;
  for (let i = 0; i < 100; i++) {
    try {
      pid = Number(await readFile(file, "utf8"));
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  expect(pid).toBeGreaterThan(0);
  await run.stop();
  expect(await run.done).toMatchObject({ ok: false, code: "AGENT_CANCELLED" });
  // A killed zombie can persist until init reaps it on Linux; it must no longer run.
  if (process.platform === "linux") {
    let stat = "";
    try {
      stat = await readFile(`/proc/${pid}/stat`, "utf8");
    } catch {}
    expect(stat === "" || stat.includes(") Z ")).toBe(true);
  } else expect(() => process.kill(pid, 0)).toThrow();
});

posixTest(
  "malformed Claude JSON blocks fail safely without throwing into the HTTP process",
  async () => {
    const { run } = await start("claudeinvalid", { provider: "claude" });
    expect(await run.done).toMatchObject({ ok: false, code: "AGENT_PROTOCOL" });
  },
);
