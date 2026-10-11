import { afterEach, expect, test, vi } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { request as httpRequest } from "node:http";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import {
  getLayoutTarget,
  LAYOUT_LIMITS,
  type CodeSnapshot,
  type Project,
} from "@codemap/core";
import { createServer } from "./server.js";
import { projectQueries } from "./queries.js";
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});
function snapshot(n = 3, r = 2): CodeSnapshot {
  return {
    id: "s",
    projectId: "p",
    contentHash: "hash",
    createdAt: "now",
    gitRevision: null,
    nodes: Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      kind: i === 2 ? "external" : "function",
      name: "source-secret",
      filePath: "source-secret",
      signature: "source-secret",
    })),
    relations: Array.from({ length: r }, (_, i) => ({
      id: `r${i}`,
      sourceId: "n0",
      targetId: i % 2 ? null : "n1",
      type: "calls",
      resolution: i % 2 ? "unresolved" : "resolved",
      evidence: { filePath: "source-secret", line: 1, text: "source-secret" },
    })),
    diagnostics: [],
    coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
  };
}
async function fixture(s = snapshot()) {
  const root = await mkdtemp(join(tmpdir(), "perf02-b-http-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "untouched.ts");
  await writeFile(source, "export const untouched = 1;\n");
  const path = join(root, "records.sqlite"),
    db = new SqliteStorage(path);
  cleanup.push(() => db.close());
  const p: Project = { id: "p", name: "fixture", path: root, snapshotId: s.id };
  db.put("projects", p.id, p);
  db.put("snapshots", s.id, s);
  for (const kind of [
    "plans",
    "approvals",
    "views",
    "groups",
    "policies",
    "settings",
    "annotations",
  ] as const)
    db.put(kind, `sentinel-${kind}`, { untouched: kind });
  const sql = new Database(path);
  cleanup.push(() => {
    sql.close();
  });
  const files = new StructureFileStore();
  const service = new WorkspaceService({
    storage: db,
    structureFiles: files,
    indexer: {
      index: async () => {
        throw Error("unexpected indexing");
      },
      readSource: async () => {
        throw Error("unexpected source read");
      },
    },
  });
  const app = await createServer({ service });
  cleanup.push(() => app.close());
  const base = await app.listen({ host: "127.0.0.1", port: 0 });
  const raw = () =>
    sql.prepare("SELECT rowid,kind,id,value FROM records ORDER BY rowid").all();
  const request = async (
    body: unknown = { expectedSnapshotId: "s" },
    id = "p",
    suffix = "",
    headers: Record<string, string> = {},
  ) => {
    const url = `${base}/api/projects/${id}/layout-target${suffix}`;
    if (headers.Host)
      return new Promise<{
        status: number;
        text: string;
        json: ReturnType<typeof JSON.parse>;
      }>((resolve, reject) => {
        const req = httpRequest(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              const text = Buffer.concat(chunks).toString();
              resolve({
                status: res.statusCode!,
                text,
                json: JSON.parse(text),
              });
            });
          },
        );
        req.on("error", reject);
        req.end(JSON.stringify(body));
      });
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, text, json: JSON.parse(text) };
  };
  return { service, db, raw, request, source, files, base };
}
test("public core export and real SQLite HTTP return every raw fact at exact caps without source or writes", async () => {
  const s = snapshot(5000, 20000),
    f = await fixture(s),
    before = f.raw(),
    source = await readFile(f.source, "utf8");
  const get = vi.spyOn(f.service, "getSnapshot");
  const put = vi.spyOn(f.db, "put");
  const del = vi.spyOn(f.db, "delete");
  const response = await f.request();
  expect(response.status).toBe(200);
  expect(response.json).toEqual(getLayoutTarget(s, "s"));
  expect(response.json.counts.byKind.external).toBe(1);
  expect(response.json.nodes.map((n: { id: string }) => n.id)).toEqual(
    s.nodes.map((n) => n.id),
  );
  expect(response.json.relations.map((r: { id: string }) => r.id)).toEqual(
    s.relations.map((r) => r.id),
  );
  expect(response.text).not.toContain("source-secret");
  expect(get).toHaveBeenCalledExactlyOnceWith("p");
  expect(put).not.toHaveBeenCalled();
  expect(del).not.toHaveBeenCalled();
  expect(f.raw()).toEqual(before);
  expect(await readFile(f.source, "utf8")).toBe(source);
});
test.each([
  [5001, 2, "node_budget"],
  [3, 20001, "relation_budget"],
] as const)(
  "HTTP raw caps %i/%i reject completely with truthful totals",
  async (n, r, reason) => {
    const f = await fixture(snapshot(n, r)),
      before = f.raw(),
      response = await f.request();
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      status: "rejected",
      reason,
      counts: { nodes: n, relations: r },
    });
    expect(response.json).not.toHaveProperty("nodes");
    expect(response.json).not.toHaveProperty("relations");
    expect(f.raw()).toEqual(before);
  },
);
test("HTTP UTF8 response accepts exact 8MiB and rejects cap+1 before serialization of full target", async () => {
  const s = snapshot(1, 0);
  s.nodes[0]!.id = "界😀";
  const first = getLayoutTarget(s, "s");
  expect(first.status).toBe("ready");
  const initial = Buffer.byteLength(JSON.stringify(first));
  s.nodes[0]!.id += "a".repeat(LAYOUT_LIMITS.bytes - initial);
  const f = await fixture(s),
    before = f.raw(),
    exact = await f.request();
  expect(exact.status).toBe(200);
  expect(Buffer.byteLength(exact.text)).toBe(LAYOUT_LIMITS.bytes);
  expect(exact.json.status).toBe("ready");
  const over = {
    ...s,
    id: "s2",
    nodes: [{ ...s.nodes[0]!, id: s.nodes[0]!.id + "a" }],
  };
  f.db.put("snapshots", "s2", over);
  f.db.put("projects", "p", {
    id: "p",
    name: "fixture",
    path: "unused",
    snapshotId: "s2",
  });
  const newBefore = f.raw(),
    rejected = await f.request({ expectedSnapshotId: "s2" });
  expect(rejected.json).toMatchObject({
    status: "rejected",
    reason: "byte_budget",
  });
  expect(rejected.json).not.toHaveProperty("nodes");
  expect(Buffer.byteLength(rejected.text)).toBeLessThan(1000);
  expect(f.raw()).toEqual(newBefore);
  expect(before).toHaveLength(newBefore.length - 1);
});
test.each([
  {},
  { expectedSnapshotId: " " },
  { expectedSnapshotId: 2 },
  { expectedSnapshotId: "s", budget: 80 },
  { expectedSnapshotId: "s", source: true },
])("strict body rejects %j without capturing or writes", async (body) => {
  const f = await fixture(),
    before = f.raw(),
    get = vi.spyOn(f.service, "getSnapshot");
  expect((await f.request(body)).status).toBe(400);
  expect(get).not.toHaveBeenCalled();
  expect(f.raw()).toEqual(before);
});
test("stale current snapshot, unknown project, ownership mismatch and extra query fail closed", async () => {
  const f = await fixture(),
    before = f.raw();
  expect((await f.request({ expectedSnapshotId: "old" })).json).toMatchObject({
    code: "SNAPSHOT_CHANGED",
  });
  expect((await f.request({ expectedSnapshotId: "old" })).status).toBe(409);
  expect((await f.request(undefined, "missing")).status).toBe(404);
  expect((await f.request(undefined, "p", "?budget=1")).status).toBe(400);
  expect(f.raw()).toEqual(before);
  f.db.put("snapshots", "s", { ...snapshot(), projectId: "foreign" });
  const foreign = f.raw();
  expect((await f.request()).status).toBe(404);
  expect(f.raw()).toEqual(foreign);
});
test.each([
  { Host: "evil.example" },
  { Origin: "https://evil.example" },
] as Record<string, string>[])(
  "existing Host/Origin boundary rejects %j before query and mutation",
  async (headers) => {
    const f = await fixture(),
      before = f.raw(),
      get = vi.spyOn(f.service, "getSnapshot"),
      response = await f.request(undefined, "p", "", headers);
    expect(response.status).toBe(403);
    expect(response.json.code).toBe("UNTRUSTED_REQUEST");
    expect(get).not.toHaveBeenCalled();
    expect(f.raw()).toEqual(before);
  },
);
test("query captures once and returns that snapshot even if publication changes immediately after read", async () => {
  const f = await fixture();
  const s = snapshot();
  vi.spyOn(f.service, "getSnapshot").mockImplementationOnce(() => {
    f.db.put("snapshots", "s2", { ...s, id: "s2" });
    f.db.put("projects", "p", {
      id: "p",
      name: "fixture",
      path: "unused",
      snapshotId: "s2",
    });
    return s;
  });
  expect(
    projectQueries(f.service).layoutTarget("p", { expectedSnapshotId: "s" }),
  ).toEqual(getLayoutTarget(s, "s"));
  expect(f.service.getSnapshot("p").id).toBe("s2");
  expect(() =>
    projectQueries(f.service).layoutTarget("p", { expectedSnapshotId: "s" }),
  ).toThrow(/SNAPSHOT_CHANGED/);
});
