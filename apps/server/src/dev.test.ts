import { afterEach, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
async function fixture(extra: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), "atlas-dev-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, content: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  };
  await put("package.json", '{"type":"module"}');
  await put("scripts/dev.mjs", "");
  await copyFile("scripts/dev.mjs", join(root, "scripts/dev.mjs"));
  await put(
    "npm-cli.mjs",
    `import {appendFileSync} from 'node:fs';appendFileSync('builds.txt',process.argv.slice(2).join(' ')+'\\n');if(process.env.FAIL_BUILD)process.exit(9);`,
  );
  const childCode = (name: string) =>
    `import {writeFileSync} from 'node:fs';writeFileSync(process.env.DEV_FIXTURE_ROOT+'/${name}.pid',String(process.pid));writeFileSync(process.env.DEV_FIXTURE_ROOT+'/${name}.cwd',process.cwd());process.on('SIGTERM',()=>process.exit(0));process.on('SIGINT',()=>process.exit(0));setInterval(()=>{},100);${name === "server" ? "if(process.env.FAIL_SERVER)setTimeout(()=>process.exit(7),150);" : ""}`;
  await put("apps/server/src/index.ts", childCode("server"));
  await put("apps/web/package.json", '{"type":"module"}');
  await put(
    "node_modules/vite/package.json",
    '{"name":"vite","type":"module","exports":{"./package.json":"./package.json"}}',
  );
  await put("node_modules/vite/bin/vite.js", childCode("web"));
  const require = createRequire(import.meta.url);
  await symlink(
    dirname(require.resolve("tsx/package.json")),
    join(root, "node_modules/tsx"),
    "junction",
  );
  const child = spawn(process.execPath, ["scripts/dev.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      npm_execpath: join(root, "npm-cli.mjs"),
      DEV_FIXTURE_ROOT: root,
      ...extra,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout!.on("data", (data) => (output += data));
  child.stderr!.on("data", (data) => (output += data));
  const exited = once(child, "exit");
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
    for (const name of ["server", "web"])
      try {
        process.kill(
          Number(await readFile(join(root, `${name}.pid`), "utf8")),
          "SIGKILL",
        );
      } catch {}
  });
  async function ready() {
    const end = Date.now() + 10000;
    while (
      Date.now() < end &&
      child.exitCode === null &&
      child.signalCode === null
    ) {
      try {
        await readFile(join(root, "server.pid"));
        await readFile(join(root, "web.pid"));
        return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect.fail(`dev children never ready: ${output}`);
  }
  const pid = async (name: string) =>
    Number(await readFile(join(root, `${name}.pid`), "utf8"));
  return { root, child, exited, ready, pid };
}
// Shell-driven launch, launch before builds, swallowed failure, or orphaned children breaks observable supervision.
test("dev builds dependency packages before directly spawning server and web and reaps both on signal", async () => {
  const run = await fixture();
  await run.ready();
  expect(
    (await readFile(join(run.root, "builds.txt"), "utf8")).trim().split("\n"),
  ).toEqual([
    "run build -w @codemap/core",
    "run build -w @codemap/indexer",
    "run build -w @codemap/storage",
    "run build -w @codemap/service",
    "run build -w @codemap/server",
  ]);
  expect(await readFile(join(run.root, "web.cwd"), "utf8")).toBe(
    join(run.root, "apps/web"),
  );
  const server = await run.pid("server"),
    web = await run.pid("web");
  run.child.kill("SIGTERM");
  expect(await run.exited).toEqual([0, null]);
  expect(() => process.kill(server, 0)).toThrow();
  expect(() => process.kill(web, 0)).toThrow();
}, 15000);
test("a development child failure exits with failure and stops the other child", async () => {
  const run = await fixture({ FAIL_SERVER: "1" });
  await run.ready();
  const web = await run.pid("web");
  expect((await run.exited)[0]).toBe(7);
  expect(() => process.kill(web, 0)).toThrow();
}, 15000);
test("a failed prerequisite build aborts before launching runtime children", async () => {
  const run = await fixture({ FAIL_BUILD: "1" });
  expect((await run.exited)[0]).toBe(9);
  await expect(readFile(join(run.root, "server.pid"))).rejects.toMatchObject({
    code: "ENOENT",
  });
}, 15000);
