import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FastifyInstance } from "fastify";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import { createServer } from "./server.js";
export { createServer } from "./server.js";

function dataDirectory(): string {
  if (process.env.CODEMAP_DATA_DIR)
    return resolve(process.env.CODEMAP_DATA_DIR);
  if (process.platform === "win32")
    return join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "AtlasMode",
    );
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "AtlasMode");
  return join(
    process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
    "AtlasMode",
  );
}
async function main(): Promise<void> {
  let storage: SqliteStorage | undefined, app: FastifyInstance | undefined;
  let stopping = false;
  let signal: (() => void) | undefined;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await app?.close();
    } finally {
      storage?.close();
      if (signal) {
        process.removeListener("SIGINT", signal);
        process.removeListener("SIGTERM", signal);
      }
    }
  };
  try {
    const rawPort = process.env.CODEMAP_PORT ?? "4310";
    if (
      !/^\d+$/.test(rawPort) ||
      !Number.isInteger(Number(rawPort)) ||
      Number(rawPort) < 1 ||
      Number(rawPort) > 65535
    )
      throw new Error("CODEMAP_PORT must be an integer from 1 to 65535.");
    storage = new SqliteStorage(join(dataDirectory(), "atlasmode.sqlite"));
    const service = new WorkspaceService({
      storage,
      indexer: new SourceIndexer(),
    });
    if (process.env.CODEMAP_WORKSPACE_ROOT)
      await service.openProject(process.env.CODEMAP_WORKSPACE_ROOT);
    const candidate = fileURLToPath(
      new URL("../../web/dist/", import.meta.url),
    );
    let webRoot: string | undefined;
    try {
      if ((await stat(join(candidate, "index.html"))).isFile())
        webRoot = candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    app = await createServer({ service, webRoot });
    await app.listen({ host: "127.0.0.1", port: Number(rawPort) });
    signal = () => {
      void shutdown().catch((error) => {
        console.error(`Unable to stop AtlasMode: ${(error as Error).message}`);
        process.exitCode = 1;
      });
    };
    process.once("SIGINT", signal);
    process.once("SIGTERM", signal);
    console.log(
      `AtlasMode API listening on 127.0.0.1:${rawPort}${webRoot ? " (built web assets available)" : " (web build unavailable)"}`,
    );
  } catch (error) {
    console.error(`Unable to start AtlasMode: ${(error as Error).message}`);
    process.exitCode = 1;
    await shutdown();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  await main();
