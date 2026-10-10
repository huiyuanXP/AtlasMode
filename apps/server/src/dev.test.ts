import { afterEach, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtemp,
  realpath,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
async function fixture(
  extra: Record<string, string> = {},
  aliasedParent = false,
) {
  let parent = tmpdir();
  if (aliasedParent) {
    const container = await mkdtemp(join(tmpdir(), "atlas-dev-alias-"));
    cleanup.push(() => rm(container, { recursive: true, force: true }));
    await mkdir(join(container, "actual"));
    parent = join(container, "alias");
    await symlink(join(container, "actual"), parent, "junction");
  }
  // Child process.cwd() resolves temporary-directory aliases on macOS.
  const root = await realpath(await mkdtemp(join(parent, "atlas-dev-")));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, content: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  };
  await put("package.json", '{"type":"module"}');
  await put("scripts/dev.mjs", "");
  await copyFile("scripts/dev.mjs", join(root, "scripts/dev.mjs"));
  for (const name of ["core", "indexer", "storage", "service", "mcp", "server"])
    await put(
      `${["server", "mcp"].includes(name) ? "apps" : "packages"}/${name}/package.json`,
      JSON.stringify({
        type: "module",
        scripts: {
          build: "tsc -p tsconfig.json",
          ...(extra.CUSTOM_BUILD && name === "core"
            ? { [extra.CUSTOM_BUILD]: "node custom-build.mjs" }
            : {}),
        },
      }),
    );
  await put(
    "node_modules/typescript/package.json",
    '{"name":"typescript","type":"module"}',
  );
  // The compiler is a live executable. The old npm lifecycle wrapper creates
  // it as a grandchild; the repaired supervisor must own this process directly.
  await put(
    "node_modules/typescript/bin/tsc",
    `import {appendFileSync,writeFileSync} from 'node:fs';
import {basename} from 'node:path';
const root=process.env.DEV_FIXTURE_ROOT;
appendFileSync(root+'/builds.txt',basename(process.cwd())+'\\n');
if(process.env.FAIL_BUILD)process.exit(9);
if(process.env.ACTIVE_BUILD){
  writeFileSync(root+'/compiler.pid',String(process.pid));
  process.on('SIGTERM',()=>process.exit(0));
  setInterval(()=>{},100);
}`,
  );
  await put(
    "npm-cli.mjs",
    `import {spawn} from 'node:child_process';
import {join} from 'node:path';
const root=process.env.DEV_FIXTURE_ROOT,name=process.argv.at(-1).slice('@codemap/'.length);
const compiler=spawn(process.execPath,[join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],{cwd:join(root,name==='server'?'apps':'packages',name),stdio:'inherit'});
compiler.on('exit',code=>process.exit(code??1));`,
  );
  const childCode = (name: string) =>
    `import {writeFileSync} from 'node:fs';writeFileSync(process.env.DEV_FIXTURE_ROOT+'/${name}.pid',String(process.pid));writeFileSync(process.env.DEV_FIXTURE_ROOT+'/${name}.cwd',process.cwd());writeFileSync(process.env.DEV_FIXTURE_ROOT+'/${name}.proxy',process.env.CODEMAP_DEV_PROXY??'');process.on('SIGTERM',()=>process.exit(0));process.on('SIGINT',()=>process.exit(0));setInterval(()=>{},100);${name === "server" ? "if(process.env.FAIL_SERVER)setTimeout(()=>process.exit(7),150);" : ""}`;
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
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("tests/support/graceful-preload.mjs")).href,
      "scripts/dev.mjs",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        npm_execpath: join(root, "npm-cli.mjs"),
        DEV_FIXTURE_ROOT: root,
        ...extra,
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let output = "";
  child.stdout!.on("data", (data) => (output += data));
  child.stderr!.on("data", (data) => (output += data));
  const exited = once(child, "exit");
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
    for (const name of ["server", "web", "compiler"])
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
  return { root, child, exited, ready, pid, output: () => output };
}
// Shell-driven launch, launch before builds, swallowed failure, or orphaned children breaks observable supervision.
test.each([
  "handler",
  "aliased-parent",
  ...(process.platform === "win32" ? [] : ["signal"]),
])(
  "dev builds prerequisites and reaps children through %s shutdown",
  async (mode) => {
    const run = await fixture({}, mode === "aliased-parent");
    await run.ready();
    expect(
      (await readFile(join(run.root, "builds.txt"), "utf8")).trim().split("\n"),
    ).toEqual(["core", "indexer", "storage", "service", "mcp", "server"]);
    expect(await readFile(join(run.root, "web.cwd"), "utf8")).toBe(
      join(run.root, "apps/web"),
    );
    expect(await readFile(join(run.root, "server.proxy"), "utf8")).toBe("1");
    const server = await run.pid("server"),
      web = await run.pid("web");
    if (mode !== "signal") run.child.send({ testSignal: "SIGTERM" });
    else run.child.kill("SIGTERM");
    expect(await run.exited).toEqual([0, null]);
    expect(() => process.kill(server, 0)).toThrow();
    expect(() => process.kill(web, 0)).toThrow();
  },
  15000,
);
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

test("shutdown during an active prerequisite build stops its live compiler before supervisor exit", async () => {
  const run = await fixture({ ACTIVE_BUILD: "1" });
  const deadline = Date.now() + 10000;
  let compiler: number | undefined;
  while (Date.now() < deadline && run.child.exitCode === null) {
    try {
      compiler = await run.pid("compiler");
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  expect(compiler).toBeDefined();
  expect(() => process.kill(compiler!, 0)).not.toThrow();
  run.child.send({ testSignal: "SIGTERM" });
  expect(await run.exited).toEqual([0, null]);
  expect(() => process.kill(compiler!, 0)).toThrow();
  await expect(readFile(join(run.root, "server.pid"))).rejects.toMatchObject({
    code: "ENOENT",
  });
}, 15000);

test("custom prerequisite build or lifecycle steps fail clearly instead of being bypassed", async () => {
  for (const custom of ["build", "prebuild", "postbuild"]) {
    const run = await fixture({ CUSTOM_BUILD: custom });
    const result = await Promise.race([
      run.exited,
      new Promise((resolve) =>
        setTimeout(() => resolve("still running"), 1000),
      ),
    ]);
    expect(result).toEqual([1, null]);
    expect(run.output()).toContain("Unsupported prerequisite build for core");
    await expect(readFile(join(run.root, "builds.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  }
}, 15000);
