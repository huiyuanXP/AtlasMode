import { afterEach, expect, test, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, unlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import type {
  AnnotationDetail,
  AnnotationPage,
  AnnotationHistoryPage,
  CodeSnapshot,
  Plan,
  Project,
  RecordKind,
  StoragePort,
} from "@codemap/core";
import { createServer } from "../../apps/server/src/server.js";
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});
const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const gateSignal = gate;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "kn01-http-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const roots = [join(root, "a"), join(root, "b")];
  for (const path of roots) {
    await mkdir(join(path, ".codemap"), { recursive: true });
    await writeFile(
      join(path, ".codemap", "structure.json"),
      JSON.stringify({ schemaVersion: 1, folders: [], dependencyRules: [] }),
    );
    await writeFile(join(path, "a.ts"), "export function same(){return 1;}\n");
    await writeFile(join(path, "b.ts"), "export function same(){return 2;}\n");
  }
  const path = join(root, "records.sqlite"),
    db = new SqliteStorage(path);
  cleanup.push(() => db.close());
  const sql = new Database(path);
  cleanup.push(() => {
    sql.close();
  });
  let fault: ((kind: RecordKind, id: string) => boolean) | undefined,
    phase: "before" | "after" = "before";
  const port: StoragePort = {
    get: (k, id) => db.get(k, id),
    list: (k) => db.list(k),
    delete: (k, id) => db.delete(k, id),
    close: () => db.close(),
    transaction: (fn) => db.transaction(fn),
    put: (k, id, v) => {
      if (phase === "before" && fault?.(k, id))
        throw new Error("owned snapshot publication fault");
      db.put(k, id, v);
      if (phase === "after" && fault?.(k, id))
        throw new Error("owned snapshot publication fault");
    },
  };
  const source = new SourceIndexer();
  let forced: CodeSnapshot | undefined;
  let barrier: ReturnType<typeof gate> | undefined;
  let entered: ReturnType<typeof gate> | undefined;
  const service = new WorkspaceService({
    storage: port,
    structureFiles: new StructureFileStore(),
    indexer: {
      readSource: (r, p) => source.readSource(r, p),
      index: async (r, p) => {
        entered?.resolve();
        if (barrier) await barrier.promise;
        return forced ?? source.index(r, p);
      },
    },
  });
  const projects: Project[] = [];
  for (const r of roots) projects.push(await service.openProject(r));
  const app = await createServer({ service });
  cleanup.push(() => app.close());
  const base = await app.listen({ host: "127.0.0.1", port: 0 });
  const collection = (index = 0) =>
    `/api/projects/${projects[index]!.id}/annotations`;
  async function request(method: string, url: string, body?: unknown) {
    const response = await fetch(base + url, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  }
  const create = async (index = 0, bound = true) => {
    const snapshot = service.getSnapshot(projects[index]!.id),
      node = snapshot.nodes.find(
        (n) => n.kind === "function" && n.filePath === "a.ts",
      )!;
    const response = await request("POST", collection(index), {
      text: "保留原文\n",
      author: " 架构维护者 ",
      source: "agent",
      isConstraint: true,
      binding: bound
        ? { snapshotId: snapshot.id, target: { kind: "node", id: node.id } }
        : null,
    });
    expect(response.status).toBe(200);
    return response.json as AnnotationDetail;
  };
  const raw = () =>
    sql.prepare("SELECT rowid,kind,id,value FROM records ORDER BY rowid").all();
  const history = () =>
    sql
      .prepare(
        "SELECT rowid,kind,id,value FROM records WHERE kind='approvals' OR (kind='settings' AND (id LIKE 'approved-%' OR id='annotation-review-legacy-v1')) ORDER BY rowid",
      )
      .all();
  return {
    root,
    roots,
    projects,
    db,
    sql,
    service,
    source,
    app,
    request,
    collection,
    create,
    raw,
    history,
    setFault: (f: typeof fault, p: typeof phase = "before") => {
      fault = f;
      phase = p;
    },
    force: (s: CodeSnapshot) => {
      forced = s;
    },
    block: () => {
      barrier = gate();
      entered = gate();
      return {
        entered: entered.promise,
        release: () => {
          barrier!.resolve();
          barrier = undefined;
          entered = undefined;
        },
      };
    },
  };
}
function revision(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  return f.db.get<Plan>("plans", id)!.revision;
}
const edit = (revision: number, text = "编辑后") => ({
  expectedRevision: revision,
  text,
  author: "作者二",
  isConstraint: false,
});
test("real HTTP CRUD preserves actor/source, CAS, independent history and deletion", async () => {
  const f = await fixture(),
    note = await f.create(),
    id = note.annotation.id,
    url = `${f.collection()}/${id}`;
  expect(note.annotation).toMatchObject({
    revision: 1,
    author: "架构维护者",
    source: "agent",
    text: "保留原文\n",
    isConstraint: true,
  });
  expect((await f.request("PUT", url, edit(1))).json.annotation).toMatchObject({
    revision: 2,
    author: "作者二",
    source: "agent",
    text: "编辑后",
    isConstraint: false,
  });
  expect((await f.request("PUT", url, edit(1))).status).toBe(409);
  expect(
    (
      await f.request("PUT", url + "/binding", {
        expectedRevision: 2,
        target: null,
      })
    ).json.resolution.status,
  ).toBe("unbound");
  expect(
    (await f.request("DELETE", url, { expectedRevision: 3 })).json,
  ).toMatchObject({ id, revision: 4 });
  expect((await f.request("GET", url)).status).toBe(404);
  expect((await f.request("GET", f.collection())).json.total).toBe(0);
  const history = (await f.request("GET", url + "/history?limit=2"))
    .json as AnnotationHistoryPage;
  expect(history).toMatchObject({ total: 4, limit: 2, truncated: true });
  expect(history.items.map((v) => v.action)).toEqual(["delete", "detach"]);
  expect(
    (await f.request("GET", url + "/history?offset=3&limit=1")).json.items[0]
      .annotation,
  ).toEqual(note.annotation);
  expect(
    (await f.request("GET", `${f.collection(1)}/${id}/history`)).status,
  ).toBe(404);
  expect(
    (await f.request("PUT", `${f.collection(1)}/${id}`, edit(4))).status,
  ).toBe(404);
});
test.each([
  [
    "POST",
    "",
    {
      text: "x",
      author: "a",
      source: "user",
      isConstraint: false,
      binding: null,
      revision: 1,
    },
  ],
  [
    "POST",
    "",
    {
      text: " ",
      author: "a",
      source: "user",
      isConstraint: false,
      binding: null,
    },
  ],
  ["PUT", "/record", { ...edit(1), binding: null }],
  ["PUT", "/record", { ...edit(1), source: "user" }],
  ["PUT", "/record/binding", { expectedRevision: 1, target: null, text: "no" }],
  [
    "PUT",
    "/record/binding",
    { expectedRevision: 1, target: null, snapshotId: "bad" },
  ],
  ["DELETE", "/record", { expectedRevision: 1, author: "no" }],
  ["DELETE", "/record", { expectedRevision: 0 }],
  ["GET", "?limit=101", undefined],
  ["GET", "?status=unknown", undefined],
  ["GET", "?offset=9007199254740992", undefined],
  ["GET", "?unexpected=1", undefined],
  ["GET", "/record/history?status=orphan", undefined],
] as const)(
  "strict notes request %s %s rejects unknown/unsafe fields before mutation",
  async (method, suffix, body) => {
    const f = await fixture(),
      before = f.raw();
    expect(
      (await f.request(method, f.collection() + suffix, body)).status,
    ).toBe(400);
    expect(f.raw()).toEqual(before);
  },
);
test("source deletion atomically orphans multiple notes and invalidates each plan exactly once; return never rebinds", async () => {
  const f = await fixture(),
    first = await f.create(),
    second = await f.create(),
    p = f.projects[0]!,
    plan = f.service.createPlan({ projectId: p.id, title: "plan" }).plan;
  await f.service.approvePlan(plan.id, plan.revision);
  const old = f.history();
  await unlink(join(f.roots[0]!, "a.ts"));
  const refreshed = await f.request(
    "POST",
    `/api/projects/${p.id}/refresh`,
    {},
  );
  expect(refreshed.status).toBe(200);
  const snapshot = refreshed.json as CodeSnapshot;
  expect(f.service.getSnapshot(p.id).id).toBe(snapshot.id);
  const page = (await f.request("GET", f.collection() + "?status=orphan"))
    .json as AnnotationPage;
  expect(page.total).toBe(2);
  for (const n of page.items)
    expect(n.annotation).toMatchObject({
      revision: 2,
      binding: { state: "orphan", orphanedAtSnapshotId: snapshot.id },
    });
  expect(revision(f, plan.id)).toBe(2);
  expect(f.history()).toEqual(old);
  expect(
    (await f.request("GET", `/api/plans/${plan.id}/approved`)).status,
  ).toBe(409);
  await writeFile(
    join(f.roots[0]!, "a.ts"),
    "export function same(){return 1;}\n",
  );
  await f.service.refreshIndex(p.id);
  expect(
    (await f.request("GET", `${f.collection()}/${first.annotation.id}`)).json
      .resolution.status,
  ).toBe("orphan");
  expect(revision(f, plan.id)).toBe(2);
  const current = f.service.getSnapshot(p.id),
    target = current.nodes.find(
      (n) => n.kind === "function" && n.filePath === "b.ts",
    )!;
  const reb = await f.request(
    "PUT",
    `${f.collection()}/${second.annotation.id}/binding`,
    {
      expectedRevision: 2,
      snapshotId: current.id,
      target: { kind: "node", id: target.id },
    },
  );
  expect(reb.status).toBe(200);
  expect(reb.json.annotation).toMatchObject({
    revision: 3,
    text: second.annotation.text,
    binding: { target: { id: target.id }, selectedSnapshotId: current.id },
  });
  expect(f.history()).toEqual(old);
});
test.each([
  "snapshots",
  "projects",
  "annotations",
  "history",
  "plans",
] as const)(
  "publication + reconcile roll back every raw SQLite row on %s write before/after fault",
  async (point) => {
    for (const phase of ["before", "after"] as const) {
      const f = await fixture();
      await f.create();
      await f.create();
      const p = f.projects[0]!,
        plan = f.service.createPlan({ projectId: p.id, title: "atomic" }).plan;
      await f.service.approvePlan(plan.id, 1);
      const before = f.raw(),
        snapshot = f.service.getSnapshot(p.id);
      await unlink(join(f.roots[0]!, "a.ts"));
      f.setFault(
        (kind, id) =>
          point === "history"
            ? kind === "settings" && id.startsWith("annotation-revision:")
            : kind === point,
        phase,
      );
      expect(
        (await f.request("POST", `/api/projects/${p.id}/refresh`, {})).status,
      ).toBe(500);
      expect(f.raw()).toEqual(before);
      expect(f.service.getSnapshot(p.id)).toEqual(snapshot);
      f.setFault(undefined);
      expect(
        (await f.request("POST", `/api/projects/${p.id}/refresh`, {})).status,
      ).toBe(200);
      expect(revision(f, plan.id)).toBe(2);
    }
  },
);
test("partial capture does not write orphan history or invalidate plan; structure errors do not block independent knowledge", async () => {
  const f = await fixture(),
    note = await f.create(),
    p = f.projects[0]!,
    plan = f.service.createPlan({ projectId: p.id, title: "unknown" }).plan,
    old = f.service.getSnapshot(p.id);
  f.force({
    ...old,
    id: "partial-owned",
    contentHash: "partial",
    nodes: [],
    relations: [],
    coverage: {
      ...old.coverage,
      availability: {
        complete: false,
        unavailablePaths: ["a.ts"],
        excludedPaths: [],
      },
    },
  });
  await f.service.refreshIndex(p.id);
  const current = (
    await f.request("GET", `${f.collection()}/${note.annotation.id}`)
  ).json as AnnotationDetail;
  expect(current.resolution.status).toBe("unknown");
  expect(current.annotation).toEqual(note.annotation);
  expect(revision(f, plan.id)).toBe(1);
  await writeFile(join(f.roots[0]!, ".codemap", "structure.json"), "{broken");
  expect(
    (await f.request("PUT", `${f.collection()}/${note.annotation.id}`, edit(1)))
      .status,
  ).toBe(200);
  expect(
    (await f.request("GET", `${f.collection()}/${note.annotation.id}/history`))
      .json.total,
  ).toBe(2);
});
test("refresh queue captures current SID before queued binding and rejects stale selection without a second write", async () => {
  const f = await fixture(),
    note = await f.create(),
    p = f.projects[0]!,
    old = f.service.getSnapshot(p.id),
    before = f.raw();
  await writeFile(
    join(f.roots[0]!, "b.ts"),
    "export function same(){return 3;}\n",
  );
  const gate = f.block(),
    refresh = f.service.refreshIndex(p.id);
  await gate.entered;
  let finished = false;
  const target = old.nodes.find(
    (n) => n.kind === "function" && n.filePath === "b.ts",
  )!;
  const arrived = gateSignal();
  const original = f.service.bindAnnotation.bind(f.service);
  vi.spyOn(f.service, "bindAnnotation").mockImplementation(
    (projectId, id, input) => {
      arrived.resolve();
      return original(projectId, id, input);
    },
  );
  // Real HTTP reaches the facade while the same project's index operation is blocked.
  const request = f
    .request("PUT", `${f.collection()}/${note.annotation.id}/binding`, {
      expectedRevision: 1,
      snapshotId: old.id,
      target: { kind: "node", id: target.id },
    })
    .then((v) => {
      finished = true;
      return v;
    });
  await arrived.promise;
  expect(finished).toBe(false);
  expect(f.raw()).toEqual(before);
  gate.release();
  await refresh;
  expect((await request).status).toBe(409);
  expect(
    (await f.request("GET", `${f.collection()}/${note.annotation.id}`)).json
      .annotation,
  ).toEqual(note.annotation);
});
test("content edit invalidates current v1 approval; export remains historical and old raw approval bytes survive", async () => {
  const f = await fixture(),
    note = await f.create(),
    p = f.projects[0]!,
    plan = f.service.createPlan({ projectId: p.id, title: "review" }).plan;
  await f.service.approvePlan(plan.id, 1);
  const old = f.history();
  expect(
    (await f.request("GET", `/api/plans/${plan.id}/approved`)).status,
  ).toBe(200);
  await f.request("PUT", `${f.collection()}/${note.annotation.id}`, edit(1));
  expect(
    (await f.request("GET", `/api/plans/${plan.id}/approved`)).status,
  ).toBe(409);
  const exported = (
    await f.request("GET", `/api/plans/${plan.id}/export?format=json`)
  ).json;
  expect(exported.annotationContext.annotations).toEqual([note.annotation]);
  expect(exported.valid).toBe(false);
  expect(f.history()).toEqual(old);
});

test("binding checks exact captured SID and domain ownership; request failure never mutates notes", async () => {
  const f = await fixture(),
    note = await f.create(),
    snapshot = f.service.getSnapshot(f.projects[0]!.id),
    other = f.service.getSnapshot(f.projects[1]!.id);
  const before = f.raw(),
    url = `${f.collection()}/${note.annotation.id}/binding`;
  for (const [input, status, code] of [
    [
      {
        expectedRevision: 1,
        snapshotId: "old-owned",
        target: { kind: "node", id: snapshot.nodes[0]!.id },
      },
      409,
      "SNAPSHOT_CHANGED",
    ],
    [
      {
        expectedRevision: 1,
        snapshotId: snapshot.id,
        target: { kind: "node", id: other.nodes[0]!.id },
      },
      400,
      "INVALID_INPUT",
    ],
    [
      {
        expectedRevision: 1,
        snapshotId: snapshot.id,
        target: { kind: "relation", id: snapshot.nodes[0]!.id },
      },
      400,
      "INVALID_INPUT",
    ],
  ] as const) {
    const response = await f.request("PUT", url, input);
    expect(response.status).toBe(status);
    expect(response.json.code).toBe(code);
    expect(f.raw()).toEqual(before);
  }
  expect(
    (await f.request("GET", `${f.collection()}/${"x".repeat(201)}`)).status,
  ).toBe(414); // Existing Fastify transport limit rejects this before route schema parsing.
  expect((await f.request("GET", `${f.collection()}/record%00`)).status).toBe(
    400,
  );
  expect(
    (await f.request("GET", "/api/projects/missing/annotations")).status,
  ).toBe(404);
});
test("notes remain independent without a snapshot and persist through fresh Workspace and HTTP reopen", async () => {
  const f = await fixture(),
    p = f.projects[0]!,
    note = await f.create();
  f.db.put("projects", p.id, { id: p.id, name: p.name, path: p.path });
  expect(
    (await f.request("GET", `${f.collection()}/${note.annotation.id}`)).json
      .resolution.status,
  ).toBe("unknown");
  expect(
    (await f.request("PUT", `${f.collection()}/${note.annotation.id}`, edit(1)))
      .status,
  ).toBe(200);
  const independent = await f.request("POST", f.collection(), {
    text: "independent",
    author: "用户",
    source: "user",
    isConstraint: false,
    binding: null,
  });
  expect(independent.status).toBe(200);
  expect(
    (
      await f.request(
        "PUT",
        `${f.collection()}/${note.annotation.id}/binding`,
        {
          expectedRevision: 2,
          snapshotId: "none",
          target: { kind: "node", id: "any" },
        },
      )
    ).status,
  ).toBe(409);
  const service = new WorkspaceService({
    storage: f.db,
    indexer: new SourceIndexer(),
    structureFiles: new StructureFileStore(),
  });
  const reopened = await createServer({ service });
  cleanup.push(() => reopened.close());
  const base = await reopened.listen({ host: "127.0.0.1", port: 0 });
  const response = await fetch(base + f.collection());
  expect(response.status).toBe(200);
  const page = (await response.json()) as AnnotationPage;
  expect(page.total).toBe(2);
  expect(
    page.items.find((item) => item.annotation.id === note.annotation.id)
      ?.annotation,
  ).toMatchObject({ revision: 2, source: "agent", author: "作者二" });
  const history = await fetch(
    base + `${f.collection()}/${note.annotation.id}/history`,
  );
  expect(((await history.json()) as AnnotationHistoryPage).total).toBe(2);
  expect(
    f.db.list<Plan>("plans").filter((plan) => plan.projectId === p.id),
  ).toEqual([]);
});
test("reopening a project publishes disappearance and reconcile together through the same queue", async () => {
  const f = await fixture(),
    note = await f.create(),
    p = f.projects[0]!,
    plan = f.service.createPlan({ projectId: p.id, title: "reopen" }).plan;
  await unlink(join(f.roots[0]!, "a.ts"));
  const opened = await f.request("POST", "/api/projects", { path: p.path });
  expect(opened.status).toBe(200);
  expect(opened.json.id).toBe(p.id);
  const record = (
    await f.request("GET", `${f.collection()}/${note.annotation.id}`)
  ).json as AnnotationDetail;
  expect(record.annotation).toMatchObject({
    revision: 2,
    binding: { state: "orphan", orphanedAtSnapshotId: opened.json.snapshotId },
  });
  expect(revision(f, plan.id)).toBe(2);
});

test("raw knowledge bypass invalidates current approval and tampered capture fails closed without rewriting history", async () => {
  const f = await fixture(),
    note = await f.create(),
    p = f.projects[0]!,
    plan = f.service.createPlan({
      projectId: p.id,
      title: "strict review",
    }).plan;
  const approved = await f.service.approvePlan(plan.id, 1),
    approval = approved.approval!,
    before = f.history();
  f.sql
    .prepare("UPDATE records SET value=? WHERE kind='annotations' AND id=?")
    .run(
      JSON.stringify({ ...note.annotation, text: "raw bypass" }),
      note.annotation.id,
    );
  const invalid = await f.request("GET", `/api/plans/${plan.id}/approved`);
  expect(invalid.status).toBe(409);
  expect(invalid.json.code).toBe("NOT_APPROVED");
  expect(f.history()).toEqual(before);
  const key = `approved-annotations:${approval.id}`,
    context = f.db.get<{
      annotations: AnnotationDetail["annotation"][];
      version: 1;
      projectId: string;
      snapshotId: string;
    }>("settings", key)!;
  f.db.put("settings", key, {
    ...context,
    annotations: context.annotations.map((n) => ({
      ...n,
      text: "tampered historical capture",
    })),
  });
  const tampered = f.history();
  for (const url of [
    `/api/plans/${plan.id}/approved`,
    `/api/plans/${plan.id}/export?format=json`,
  ]) {
    const response = await f.request("GET", url);
    expect(response.status).toBe(409);
    expect(response.json.code).toBe("APPROVAL_CONTEXT_INVALID");
  }
  expect(f.history()).toEqual(tampered);
});
test("reused immutable snapshot identity reconciles stored facts rather than unpublished replacement values", async () => {
  const f = await fixture(),
    note = await f.create(),
    p = f.projects[0]!,
    old = f.service.getSnapshot(p.id),
    plan = f.service.createPlan({
      projectId: p.id,
      title: "immutable facts",
    }).plan;
  f.force({ ...old, nodes: [], relations: [] });
  await f.service.refreshIndex(p.id);
  expect(f.service.getSnapshot(p.id)).toEqual(old);
  expect(
    (await f.request("GET", `${f.collection()}/${note.annotation.id}`)).json
      .annotation,
  ).toEqual(note.annotation);
  expect(revision(f, plan.id)).toBe(1);
});
