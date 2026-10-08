import { afterEach, expect, test } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeRunner } from "./native.js";
import { startProcess, type RunningAgent } from "./process.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
});
// If either boundary reaches spawn on Windows, this real child writes a sentinel.
test("Windows native readiness and process start refuse before probing or spawning any executable", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-windows-refusal-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const sentinel = join(root, "spawned");
  const command = join(root, "probe.mjs");
  await writeFile(
    command,
    `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'probed');\n`,
    { mode: 0o755 },
  );
  const original = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { ...original, value: "win32" });
  let run: RunningAgent | undefined;
  try {
    const backend = createNativeRunner({
      CODEMAP_AGENT_PROVIDER: "codex",
      CODEMAP_AGENT_COMMAND: command,
    });
    const status = await backend.status();
    expect(status).toMatchObject({
      configured: true,
      available: false,
      provider: "codex",
    });
    expect(status.reason).toContain("Windows");
    await expect(
      backend.start(
        {
          projectId: "p",
          input: { channel: "plan", message: "x" },
          prompt: "x",
          apiUrl: "http://127.0.0.1:1",
          tools: [],
        },
        () => {},
      ),
    ).rejects.toThrow("AGENT_PLATFORM_UNSUPPORTED");
    expect(() => {
      run = startProcess(
        {
          command: process.execPath,
          args: [
            "-e",
            `require('node:fs').writeFileSync(${JSON.stringify(sentinel)},'spawned')`,
          ],
          cwd: root,
          prompt: "",
          provider: "codex",
        },
        () => {},
      );
    }).toThrow("AGENT_PLATFORM_UNSUPPORTED");
    await expect(readFile(sentinel, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  } finally {
    Object.defineProperty(process, "platform", original);
    await run?.stop();
  }
});
