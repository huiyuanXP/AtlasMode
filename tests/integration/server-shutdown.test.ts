import { expect, test } from "vitest";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { CodeSnapshot, Project } from "@codemap/core";
import { createServer } from "@codemap/server";
import { WorkspaceService } from "@codemap/service";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { startProduction, http } from "../support/production.mjs";

// These connections have not submitted a complete request or started any
// application work. They must not prevent the installed shutdown handler from
// draining the server and closing SQLite inside the helper's unchanged bound.
test.each(["raw", "partial headers", "partial body"])(
  "compiled server shuts down with a %s connection",
  async (state) => {
    const root = await mkdtemp(join(tmpdir(), "atlas-shutdown-"));
    let server;
    let socket: Socket | undefined;
    const evidence: Record<string, unknown> = { state, root };
    try {
      server = await startProduction(root);
      evidence.pid = server.child.pid;
      socket = createConnection({ host: "127.0.0.1", port: server.port });
      const errors: string[] = [];
      socket.on("error", (error) => errors.push(error.message));
      socket.resume();
      await once(socket, "connect");
      const closed = once(socket, "close");
      if (state !== "raw") {
        socket.write(
          state === "partial headers"
            ? `GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:${server.port}\r\n`
            : `POST /api/projects HTTP/1.1\r\nHost: 127.0.0.1:${server.port}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{`,
        );
      }
      expect(await http(server.url, "/api/health")).toEqual({ status: "ok" });
      evidence.localPort = socket.localPort;
      evidence.bytesWritten = socket.bytesWritten;
      evidence.openAtStop = !socket.destroyed;
      const start = performance.now();
      server.child.once("disconnect", () => {
        evidence.handlerEmittedAndIpcDisconnectedMs = performance.now() - start;
      });
      try {
        await server.stop();
      } finally {
        evidence.stopMs = performance.now() - start;
        evidence.exitCode = server.child.exitCode;
        evidence.signalCode = server.child.signalCode;
        evidence.socketErrors = errors;
      }
      await closed;
      expect(server.child.exitCode).toBe(0);
      expect(server.child.signalCode).toBeNull();
    } finally {
      socket?.destroy();
      await server?.stop();
      await rm(root, { recursive: true, force: true });
      await expect(access(root)).rejects.toThrow();
      evidence.cleaned = true;
      console.log(JSON.stringify(evidence));
    }
  },
  20000,
);

test("shutdown preserves slow complete requests before discarding incomplete pipelined bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-shutdown-work-"));
  const target = join(root, "target");
  const database = join(root, "store.sqlite");
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const partialReceived = Promise.withResolvers<void>();
  const storage = new SqliteStorage(database);
  const indexer = new SourceIndexer();
  const service = new WorkspaceService({
    storage,
    indexer: {
      async index(path, projectId) {
        entered.resolve();
        await release.promise;
        return indexer.index(path, projectId);
      },
    },
  });
  const app = await createServer({ service });
  let socket: Socket | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await mkdir(target);
    await writeFile(
      join(target, "entry.ts"),
      "export function entry() { return 1; }\n",
    );
    app.server.on("request", (request) => {
      if (request.headers["content-length"] === "100")
        partialReceived.resolve();
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing TCP address");
    socket = createConnection({ host: "127.0.0.1", port: address.port });
    await once(socket, "connect");
    const closed = once(socket, "close");
    let response = "";
    socket.on("data", (chunk) => {
      response += chunk.toString();
    });
    const body = JSON.stringify({ path: target });
    socket.write(
      `POST /api/projects HTTP/1.1\r\nHost: 127.0.0.1:${address.port}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}POST /api/projects HTTP/1.1\r\nHost: 127.0.0.1:${address.port}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{`,
    );
    await Promise.all([entered.promise, partialReceived.promise]);
    let drained = false;
    let timedOut = false;
    deadline = setTimeout(() => {
      timedOut = true;
      socket?.destroy();
    }, 10000);
    const closing = app.close().then(() => {
      storage.close();
      drained = true;
    });
    // Normal indexing can exceed six seconds. Shutdown must await accepted
    // work, not impose a shorter request timeout or close its SQLite store.
    await delay(6100);
    expect(drained).toBe(false);
    expect(socket.destroyed).toBe(false);
    expect(response).toBe("");
    release.resolve();
    await Promise.all([closing, closed]);
    expect(timedOut).toBe(false);
    expect(response).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
    const [headers, json] = response.split("\r\n\r\n");
    const length = Number(headers.match(/content-length: (\d+)/i)?.[1]);
    expect(Buffer.byteLength(json)).toBe(length);
    const project = JSON.parse(json) as Project;
    expect(project.path).toBe(target);
    const reopened = new SqliteStorage(database);
    try {
      expect(reopened.get<Project>("projects", project.id)).toEqual(project);
      expect(
        reopened.get<CodeSnapshot>("snapshots", project.snapshotId!)?.nodes,
      ).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "entry" })]),
      );
    } finally {
      reopened.close();
    }
  } finally {
    clearTimeout(deadline);
    release.resolve();
    socket?.destroy();
    await app.close();
    storage.close();
    await rm(root, { recursive: true, force: true });
    await expect(access(root)).rejects.toThrow();
  }
}, 15000);
