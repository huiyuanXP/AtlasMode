import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Project } from "@codemap/core";
import { WorkspaceService } from "@codemap/service";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
export const legacyId = "pol01-owned-db-policy";
export const v1 = (purpose = "用户职责说明；待人工判断") => ({
  schemaVersion: 1,
  ownerMetadata: { team: "owned acceptance", keep: [1, null, "中文"] },
  folders: [
    {
      path: "src",
      purpose,
      allowed: ["src/**"],
      forbidden: ["vendor/**"],
      custom: { retained: true },
    },
  ],
  dependencyRules: [
    {
      from: "src/**",
      mustNotImport: ["vendor/**"],
      reason: "metadata only",
      customRule: 7,
    },
  ],
});
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((done, fail) =>
    server.close((e) => (e ? fail(e) : done())),
  );
  return port;
}
async function portClosed(port: number) {
  return new Promise<boolean>((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      done(false);
    });
    socket.once("error", (error: NodeJS.ErrnoException) =>
      done(error.code === "ECONNREFUSED"),
    );
    socket.once("timeout", () => {
      socket.destroy();
      done(false);
    });
  });
}
function pidAbsent(pid: number | null) {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}
/** Owns only synthetic files, its own SQLite connection and explicitly spawned child PIDs. */
export async function pol01Fixture(mode: "source" | "compiled" = "source") {
  const root = await mkdtemp(join(tmpdir(), "atlas-pol01-acceptance-")),
    projectPath = join(root, "project"),
    data = join(root, "data"),
    path = join(projectPath, ".codemap", "structure.json"),
    marker = join(root, "TARGET_EXECUTED"),
    database = join(data, "atlasmode.sqlite"),
    config = join(root, "runtime-tsconfig.json");
  await mkdir(join(projectPath, ".codemap"), { recursive: true });
  await mkdir(join(projectPath, "src"));
  await writeFile(path, JSON.stringify(v1(), null, 2));
  const source = join(projectPath, "src", "main.ts");
  await writeFile(
    source,
    `import { writeFileSync } from "node:fs";\nexport function owned() { return 1; }\nwriteFileSync(${JSON.stringify(marker)}, "executed");\nthrow new Error("Target source must never execute");\n`,
  );
  const sourceDigest = digest(await readFile(source));
  const aliases = Object.fromEntries(
    ["core", "service", "storage", "indexer"].map((name) => [
      `@codemap/${name}`,
      [resolve(`packages/${name}/src/index.ts`)],
    ]),
  );
  await writeFile(
    config,
    JSON.stringify(
      {
        extends: resolve("tsconfig.base.json"),
        compilerOptions: { paths: aliases },
      },
      null,
      2,
    ),
  );
  // Genuine preexisting DB-only row in a stopped, owned DB. No automatic migration.
  const storage = new SqliteStorage(database);
  let project: Project;
  try {
    const service = new WorkspaceService({
      storage,
      indexer: new SourceIndexer(),
      structureFiles: new StructureFileStore(),
    });
    project = await service.openProject(projectPath);
    storage.put("policies", legacyId, {
      id: legacyId,
      projectId: project.id,
      pathPrefix: "src",
      purpose: "DB original",
      forbiddenDependencies: ["vendor"],
    });
  } finally {
    storage.close();
  }
  const records: Record<string, unknown>[] = [];
  const connections: (() => Promise<void>)[] = [];
  let active: Awaited<ReturnType<typeof start>> | undefined;
  const env: Record<string, string> = {
    ...process.env,
    TSX_TSCONFIG_PATH: config,
    CODEMAP_DATA_DIR: data,
    CODEMAP_WORKSPACE_ROOT: "",
  };
  if (env.NO_COLOR !== undefined) delete env.FORCE_COLOR;
  async function start() {
    const port = await freePort(),
      url = `http://127.0.0.1:${port}`;
    const args =
      mode === "source"
        ? ["--import", "tsx", resolve("apps/server/src/index.ts")]
        : [resolve("apps/server/dist/index.js")];
    const child = spawn(
      process.execPath,
      [
        "--import",
        new URL("./graceful-preload.mjs", import.meta.url).href,
        ...args,
      ],
      {
        env: { ...env, CODEMAP_PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    let output = "";
    child.stdout!.on("data", (bytes) => {
      output += bytes;
    });
    child.stderr!.on("data", (bytes) => {
      output += bytes;
    });
    const exit = once(child, "close");
    let stopped = false;
    const stop = async () => {
      if (stopped) return;
      stopped = true;
      if (child.exitCode === null && child.signalCode === null)
        child.send({ testSignal: "SIGTERM" });
      const force = setTimeout(() => child.kill("SIGKILL"), 10000);
      let result;
      try {
        result = await exit;
      } finally {
        clearTimeout(force);
      }
      const closed = await portClosed(port);
      assert(pidAbsent(child.pid ?? null), "owned API PID must disappear");
      assert.deepEqual(result, [0, null], output);
      const reopened = new SqliteStorage(database);
      let freshRows;
      try {
        freshRows = {
          plans: reopened.list("plans").length,
          approvals: reopened.list("approvals").length,
        };
      } finally {
        reopened.close();
      }
      records.push({
        kind: "server",
        mode,
        pid: child.pid,
        port,
        exit: result,
        shutdown: "installed-production-handler-via-IPC",
        stdioClosed: true,
        pidAbsent: true,
        freshDatabaseReopened: freshRows,
        portClosed: closed,
        output,
      });
      assert.equal(closed, true, "owned API port must close");
    };
    try {
      const deadline = Date.now() + 15000;
      while (
        Date.now() < deadline &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        try {
          if ((await fetch(`${url}/api/health`)).ok) return { url, port, stop };
        } catch {
          /* bounded startup poll */
        }
        await delay(40);
      }
      throw new Error(`Owned ${mode} API startup failed: ${output}`);
    } catch (error) {
      await stop();
      throw error;
    }
  }
  active = await start();
  async function raw<T>(suffix: string, method = "GET", body?: unknown) {
    assert(active);
    const response = await fetch(active.url + suffix, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as T };
  }
  async function json<T>(suffix: string, method = "GET", body?: unknown) {
    const response = await raw<T>(suffix, method, body);
    assert(
      response.status >= 200 && response.status < 300,
      JSON.stringify(response),
    );
    return response.body;
  }
  async function mcp() {
    assert(active);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args:
        mode === "source"
          ? ["--import", "tsx", resolve("apps/mcp/src/index.ts")]
          : [resolve("apps/mcp/dist/index.js")],
      env: {
        ...env,
        CODEMAP_API_URL: active.url,
        CODEMAP_MCP_PROJECT_ID: project.id,
      },
      stderr: "pipe",
      cwd: process.cwd(),
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    const client = new Client({
      name: "pol01-owned-stdio-acceptance",
      version: "1.0.0",
    });
    let closed = false;
    const stop = async () => {
      if (closed) return;
      closed = true;
      const pid = transport.pid;
      await client.close();
      for (let tries = 0; tries < 25 && !pidAbsent(pid); tries++)
        await delay(40);
      const absent = pidAbsent(pid);
      records.push({ kind: "mcp-stdio", mode, pid, pidAbsent: absent, stderr });
      assert.equal(absent, true, "owned SDK stdio child must exit");
    };
    connections.push(stop);
    await client.connect(transport);
    return {
      client,
      stop,
      call: async <T>(name: string, args: Record<string, unknown>) => {
        const result = await client.callTool({ name, arguments: args });
        if (!Array.isArray(result.content))
          throw new Error("Missing MCP content");
        const block = result.content[0];
        if (!block || block.type !== "text" || typeof block.text !== "string")
          throw new Error("Missing MCP text");
        return {
          isError: result.isError === true,
          body: JSON.parse(block.text) as T,
        };
      },
    };
  }
  const invariants = async () => {
    assert.equal(
      digest(await readFile(source)),
      sourceDigest,
      "target source bytes changed",
    );
    await assert.rejects(access(marker), { code: "ENOENT" });
  };
  const close = async () => {
    try {
      for (const stop of connections.splice(0).reverse()) await stop();
      await active?.stop();
      await invariants();
    } finally {
      await writeFile(
        join(root, "runtime-receipt.json"),
        JSON.stringify(
          {
            root,
            database,
            rootCleanup: "retained-evidence",
            sourceDigest,
            records,
          },
          null,
          2,
        ),
      );
      console.info(
        JSON.stringify({
          receipt: "POL01_SQLITE_STDIO_OWNED",
          root,
          runtime: join(root, "runtime-receipt.json"),
          records,
          rootCleanup: "retained-evidence",
        }),
      );
    }
  };
  return {
    root,
    data,
    path,
    project,
    source,
    marker,
    database,
    mode,
    raw,
    json,
    mcp,
    invariants,
    close,
    url: () => {
      assert(active);
      return active.url;
    },
    restart: async () => {
      assert(active);
      await active.stop();
      active = await start();
    },
    transport: (input: string | URL | Request, init?: RequestInit) => {
      assert(active);
      return fetch(new URL(String(input), active.url), init);
    },
  };
}
