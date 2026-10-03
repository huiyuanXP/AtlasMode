import { afterEach, expect, test } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer as netServer } from "node:net";
import { pathToFileURL } from "node:url";

const children: ChildProcess[] = [];
const roots: string[] = [];
afterEach(async () => {
  for (const child of children.splice(0))
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await once(child, "exit");
    }
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function freePort() {
  const s = netServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const port = (s.address() as { port: number }).port;
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return port;
}
async function launch(extra: Record<string, string | undefined> = {}) {
  const root = await mkdtemp(join(tmpdir(), "atlas-cli-"));
  roots.push(root);
  const port = await freePort();
  let output = "";
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("tests/support/graceful-preload.mjs")).href,
      "--import",
      "tsx",
      "apps/server/src/index.ts",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CODEMAP_PORT: String(port),
        CODEMAP_DATA_DIR: join(root, "data"),
        CODEMAP_WORKSPACE_ROOT: undefined,
        ...extra,
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  children.push(child);
  child.stdout!.on("data", (data) => (output += data));
  child.stderr!.on("data", (data) => (output += data));
  const exited = once(child, "exit");
  const url = `http://127.0.0.1:${port}`;
  async function ready() {
    const until = Date.now() + 10000;
    while (
      Date.now() < until &&
      child.exitCode === null &&
      child.signalCode === null
    ) {
      try {
        const result = await fetch(`${url}/api/health`);
        if (result.ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect.fail(`CLI never became ready: ${output}`);
  }
  return { root, child, url, ready, exited, output: () => output };
}
// Failure to assemble ports, implicit cwd project, missing listen, or broken shutdown fails actual process behavior.
test.each(["handler", ...(process.platform === "win32" ? [] : ["signal"])])(
  "CLI serves real data and closes SQLite through %s shutdown",
  async (mode) => {
    const run = await launch();
    await run.ready();
    expect(await (await fetch(`${run.url}/api/projects`)).json()).toEqual([]);
    const fixture = join(run.root, "fixture");
    await mkdir(fixture);
    await writeFile(
      join(fixture, "main.ts"),
      "export function live() { return 7; }",
    );
    const project = (await (
      await fetch(`${run.url}/api/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: fixture }),
      })
    ).json()) as { id: string; snapshotId: string };
    const snapshot = (await (
      await fetch(`${run.url}/api/projects/${project.id}/snapshot`)
    ).json()) as { nodes: { id: string; name: string }[] };
    const live = snapshot.nodes.find((n) => n.name === "live")!;
    expect(live).toBeDefined();
    expect(
      await (
        await fetch(
          `${run.url}/api/projects/${project.id}/functions/${live.id}`,
        )
      ).json(),
    ).toMatchObject({
      node: { name: "live" },
      dataSource: "code",
      snapshotId: project.snapshotId,
    });
    expect(
      await (
        await fetch(
          `${run.url}/api/projects/${project.id}/source?filePath=main.ts`,
        )
      ).json(),
    ).toMatchObject({ content: "export function live() { return 7; }" });
    if (mode === "handler") run.child.send({ testSignal: "SIGTERM" });
    else run.child.kill("SIGTERM");
    expect(await run.exited).toEqual([0, null]);
    await expect(fetch(`${run.url}/api/health`)).rejects.toThrow();
    // Reopening persistence after process shutdown demonstrates committed state, not only an open port.
    const { SqliteStorage } = await import("@codemap/storage");
    const storage = new SqliteStorage(
      join(run.root, "data", "atlasmode.sqlite"),
    );
    expect(storage.list("projects")).toHaveLength(1);
    storage.close();
  },
  15000,
);
test("CLI validates port before startup and reports launch failure cleanly", async () => {
  const run = await launch({ CODEMAP_PORT: "4310oops" });
  expect((await run.exited)[0]).toBe(1);
  expect(run.output()).toContain("CODEMAP_PORT");
  const unavailable = await launch({
    CODEMAP_WORKSPACE_ROOT: join(run.root, "missing"),
  });
  expect((await unavailable.exited)[0]).toBe(1);
  expect(unavailable.output()).toContain("Unable to start");
}, 15000);
test("CLI opens an explicitly configured default workspace", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "atlas-default-"));
  roots.push(fixture);
  await writeFile(join(fixture, "main.js"), "export function configured() {}");
  const run = await launch({ CODEMAP_WORKSPACE_ROOT: fixture });
  await run.ready();
  expect(await (await fetch(`${run.url}/api/projects`)).json()).toEqual([
    expect.objectContaining({ path: fixture }),
  ]);
  run.child.send({ testSignal: "SIGINT" });
  expect(await run.exited).toEqual([0, null]);
}, 15000);
