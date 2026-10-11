import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DomainError,
  type CodeSnapshot,
  type Plan,
  type Project,
  type RecordKind,
  type StoragePort,
} from "@codemap/core";
import { SqliteStorage } from "@codemap/storage";
import { Annotations } from "../../packages/service/src/annotations.js";
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const action of cleanup.splice(0).reverse()) action();
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "kn01-service-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "records.db"),
    db = new SqliteStorage(path);
  cleanup.push(() => db.close());
  const project: Project = {
    id: "p",
    name: "p",
    path: join(root, "source"),
    snapshotId: "s1",
  };
  db.put("projects", project.id, project);
  db.put("projects", "other", { ...project, id: "other" });
  let current: CodeSnapshot = {
    id: "s1",
    projectId: "p",
    createdAt: "2026-10-10T00:00:00.000Z",
    gitRevision: null,
    contentHash: "hash",
    nodes: [
      { id: "a", kind: "function", name: "same", filePath: "src/a.ts" },
      { id: "b", kind: "function", name: "same", filePath: "src/b.ts" },
    ],
    relations: [],
    diagnostics: [],
    coverage: {
      files: ["src/a.ts", "src/b.ts"],
      excludedPatterns: [],
      unresolvedCount: 0,
      availability: { complete: true, unavailablePaths: [], excludedPaths: [] },
    },
  };
  let fail: ((kind: RecordKind, id: string) => boolean) | undefined;
  const port: StoragePort = {
    get: (kind, id) => db.get(kind, id),
    list: (kind) => db.list(kind),
    put: (kind, id, value) => {
      if (fail?.(kind, id)) throw new Error("injected storage failure");
      db.put(kind, id, value);
    },
    delete: (kind, id) => db.delete(kind, id),
    transaction: (fn) => db.transaction(fn),
    close: () => db.close(),
  };
  const projectRead = (id: string) => {
    const result = db.get<Project>("projects", id);
    if (!result) throw new DomainError("NOT_FOUND", "Project not found");
    return result;
  };
  const snapshotRead = (id: string) => {
    projectRead(id);
    if (!current) throw new DomainError("NOT_FOUND", "Snapshot not found");
    return { ...current, projectId: id };
  };
  const annotations = new Annotations(port, projectRead, snapshotRead);
  const plan: Plan = {
    id: "plan",
    projectId: "p",
    title: "Plan",
    description: "",
    baselineSnapshotId: "s1",
    baselineContentHash: "hash",
    revision: 4,
    operations: [],
    status: "approved",
    createdAt: current.createdAt,
    updatedAt: current.createdAt,
  };
  db.put("plans", plan.id, plan);
  db.put("plans", "other-plan", {
    ...plan,
    id: "other-plan",
    projectId: "other",
  });
  const create = () =>
    annotations.create("p", {
      text: "retained",
      author: "作者",
      source: "user",
      isConstraint: true,
      binding: { snapshotId: "s1", target: { kind: "node", id: "a" } },
    });
  return {
    db,
    path,
    annotations,
    create,
    snapshot: () => current,
    setSnapshot: (value: CodeSnapshot) => {
      current = value;
    },
    setFailure: (value: typeof fail) => {
      fail = value;
    },
    projectRead,
    snapshotRead,
  };
}
test("independent content persists and semantic edits invalidate only the owning project's plans", () => {
  const { db, annotations, create } = fixture();
  const first = create();
  expect(first.annotation.revision).toBe(1);
  expect(first.annotation.author).toBe("作者");
  expect(db.get<Plan>("plans", "plan")).toMatchObject({
    revision: 5,
    status: "draft",
  });
  const edit = annotations.update("p", first.annotation.id, {
    expectedRevision: 1,
    text: "updated",
    author: "作者",
    isConstraint: false,
  });
  expect(edit.annotation.revision).toBe(2);
  expect(db.get<Plan>("plans", "plan")?.revision).toBe(6);
  expect(db.get<Plan>("plans", "other-plan")?.revision).toBe(4);
  const noop = annotations.update("p", first.annotation.id, {
    expectedRevision: 2,
    text: "updated",
    author: "作者",
    isConstraint: false,
  });
  expect(noop).toEqual(edit);
  expect(db.get<Plan>("plans", "plan")?.revision).toBe(6);
  expect(
    annotations
      .history("p", first.annotation.id, {})
      .items.map((item) => item.action),
  ).toEqual(["edit", "create"]);
});
test("orphan text is retained, same ID returning stays orphan, explicit snapshot/domain binding changes revision", () => {
  const f = fixture(),
    first = f.create(),
    missing = { ...f.snapshot(), id: "s2", nodes: [] };
  f.setSnapshot(missing);
  f.annotations.reconcile("p", missing, "2026-10-10T01:00:00.000Z");
  expect(
    f.annotations.get("p", first.annotation.id).annotation.binding?.state,
  ).toBe("orphan");
  const edit = f.annotations.update("p", first.annotation.id, {
    expectedRevision: 2,
    text: "orphan edit",
    author: "作者",
    isConstraint: true,
  });
  f.setSnapshot({
    ...missing,
    id: "s3",
    nodes: [
      { id: "a", kind: "function", name: "same", filePath: "src/a.ts" },
      { id: "b", kind: "function", name: "same", filePath: "src/b.ts" },
    ],
  });
  expect(f.annotations.get("p", first.annotation.id).resolution.status).toBe(
    "orphan",
  );
  const bound = f.annotations.bind("p", first.annotation.id, {
    expectedRevision: 3,
    target: { kind: "node", id: "b" },
    snapshotId: "s3",
  });
  expect(bound.annotation.binding).toMatchObject({
    state: "bound",
    target: { id: "b" },
    selectedSnapshotId: "s3",
  });
  expect(bound.annotation.text).toBe(edit.annotation.text);
  expect(
    f.annotations.history("p", first.annotation.id, {}).items.at(-1)?.annotation
      .binding?.target.id,
  ).toBe("a");
});
test("CAS, project ownership and stale snapshots refuse writes without affecting any persisted data", () => {
  const f = fixture(),
    first = f.create(),
    before = f.db.list("annotations"),
    plans = f.db.list("plans");
  expect(() =>
    f.annotations.update("p", first.annotation.id, {
      expectedRevision: 2,
      text: "lost",
      author: "user",
      isConstraint: false,
    }),
  ).toThrow(/revision/i);
  expect(() => f.annotations.get("other", first.annotation.id)).toThrow(
    /not found/i,
  );
  expect(() =>
    f.annotations.bind("p", first.annotation.id, {
      expectedRevision: 1,
      target: { kind: "node", id: "b" },
      snapshotId: "stale",
    }),
  ).toThrow(/snapshot/i);
  expect(f.db.list("annotations")).toEqual(before);
  expect(f.db.list("plans")).toEqual(plans);
});
test("a history collision or plan write failure rolls back the annotation, history and invalidation together", () => {
  const f = fixture(),
    first = f.create(),
    id = first.annotation.id;
  const historyKey = `annotation-revision:${id}:2`;
  f.db.put("settings", historyKey, { protected: true });
  const before = {
    notes: f.db.list("annotations"),
    plans: f.db.list("plans"),
    settings: f.db.list("settings"),
  };
  expect(() =>
    f.annotations.update("p", id, {
      expectedRevision: 1,
      text: "bad",
      author: "user",
      isConstraint: false,
    }),
  ).toThrow();
  expect({
    notes: f.db.list("annotations"),
    plans: f.db.list("plans"),
    settings: f.db.list("settings"),
  }).toEqual(before);
  f.db.delete("settings", historyKey);
  const settings = f.db.list("settings");
  f.setFailure((kind) => kind === "plans");
  expect(() =>
    f.annotations.update("p", id, {
      expectedRevision: 1,
      text: "bad",
      author: "user",
      isConstraint: false,
    }),
  ).toThrow("injected storage failure");
  expect(f.db.list("annotations")).toEqual(before.notes);
  expect(f.db.list("plans")).toEqual(before.plans);
  expect(f.db.list("settings")).toEqual(settings);
});
test("batch orphan transition invalidates each plan once and incomplete captures do not write", () => {
  const f = fixture();
  f.create();
  f.create();
  const revision = f.db.get<Plan>("plans", "plan")!.revision;
  const missing = { ...f.snapshot(), id: "s2", nodes: [] };
  expect(
    f.annotations.reconcile(
      "p",
      {
        ...missing,
        coverage: {
          ...missing.coverage,
          availability: { complete: false, unavailablePaths: [] },
        },
      },
      "2026-10-10T01:00:00.000Z",
    ),
  ).toBe(false);
  expect(f.db.get<Plan>("plans", "plan")!.revision).toBe(revision);
  f.setSnapshot(missing);
  expect(
    f.annotations.reconcile("p", missing, "2026-10-10T01:00:00.000Z"),
  ).toBe(true);
  expect(f.db.get<Plan>("plans", "plan")!.revision).toBe(revision + 1);
});
test("delete is explicit tombstone, independent unbound notes work, and immutable approval context cannot be overwritten", () => {
  const f = fixture();
  const note = f.annotations.create("p", {
    text: "independent",
    author: "agent",
    source: "agent",
    isConstraint: false,
    binding: null,
  });
  const context = f.annotations.captureContext("p", "s1");
  f.annotations.saveApprovalContext("approval", context);
  f.annotations.delete("p", note.annotation.id, 1);
  expect(f.annotations.list("p", {}).items).toEqual([]);
  expect(
    f.annotations.history("p", note.annotation.id, {}).items[0]?.action,
  ).toBe("delete");
  expect(() => f.annotations.get("p", note.annotation.id)).toThrow(
    /not found/i,
  );
  expect(() =>
    f.annotations.saveApprovalContext(
      "approval",
      f.annotations.captureContext("p", "s1"),
    ),
  ).toThrow();
  expect(f.db.get("settings", "approved-annotations:approval")).toEqual(
    context,
  );
});
test("owned SQLite reopen retains independent records and revision history", () => {
  const f = fixture(),
    note = f.create();
  f.db.close();
  const db = new SqliteStorage(f.path);
  cleanup.push(() => db.close());
  const annotations = new Annotations(
    db,
    (id) => db.get<Project>("projects", id)!,
    (id) => ({ ...f.snapshot(), projectId: id }),
  );
  expect(annotations.list("p", {}).items[0]?.annotation.text).toBe(
    note.annotation.text,
  );
  expect(annotations.history("p", note.annotation.id, {}).items).toHaveLength(
    1,
  );
});

test("missing source remains unknown while content edit, detach and delete remain usable", () => {
  const f = fixture(),
    first = f.create();
  const unavailable = new Annotations(f.db, f.projectRead, () => {
    throw new DomainError("NOT_FOUND", "Snapshot unavailable");
  });
  expect(unavailable.get("p", first.annotation.id).resolution.status).toBe(
    "unknown",
  );
  const edited = unavailable.update("p", first.annotation.id, {
    expectedRevision: 1,
    text: "still here",
    author: "maintainer",
    isConstraint: false,
  });
  expect(edited.resolution.status).toBe("unknown");
  const detached = unavailable.bind("p", first.annotation.id, {
    expectedRevision: 2,
    target: null,
  });
  expect(detached.resolution.status).toBe("unbound");
  expect(
    unavailable.bind("p", first.annotation.id, {
      expectedRevision: 3,
      target: null,
    }),
  ).toEqual(detached);
  expect(() =>
    unavailable.bind("p", first.annotation.id, {
      expectedRevision: 2,
      target: null,
    }),
  ).toThrow(/revision/i);
  unavailable.delete("p", first.annotation.id, 3);
  expect(
    unavailable
      .history("p", first.annotation.id)
      .items.map((item) => item.action),
  ).toEqual(["delete", "detach", "edit", "create"]);
  expect(unavailable.list("p").items).toEqual([]);
});

test("list and revision history expose bounded pages with stable totals", () => {
  const f = fixture();
  for (let index = 0; index < 23; index++) f.create();
  const first = f.annotations.list("p"),
    second = f.annotations.list("p", { offset: 20, limit: 20 });
  expect(first).toMatchObject({
    total: 23,
    offset: 0,
    limit: 20,
    truncated: true,
  });
  expect(first.items).toHaveLength(20);
  expect(second.items).toHaveLength(3);
  expect(
    new Set([...first.items, ...second.items].map((item) => item.annotation.id))
      .size,
  ).toBe(23);
  const id = first.items[0]!.annotation.id;
  f.annotations.update("p", id, {
    expectedRevision: 1,
    text: "r2",
    author: "author",
    isConstraint: false,
  });
  f.annotations.update("p", id, {
    expectedRevision: 2,
    text: "r3",
    author: "author",
    isConstraint: true,
  });
  const history = f.annotations.history("p", id, { offset: 1, limit: 1 });
  expect(history).toMatchObject({
    total: 3,
    offset: 1,
    limit: 1,
    truncated: true,
  });
  expect(history.items.map((item) => item.annotation.revision)).toEqual([2]);
  expect(() => f.annotations.list("p", { limit: 101 })).toThrow();
  expect(() => f.annotations.history("p", id, { offset: -1 })).toThrow();
});

test("immutable capture participates in its caller's real SQLite transaction and survives later edits", () => {
  const f = fixture(),
    note = f.create(),
    captured = f.annotations.captureContext("p", "s1");
  const before = {
    settings: f.db.list("settings"),
    plans: f.db.list("plans"),
    approvals: f.db.list("approvals"),
  };
  f.setFailure((kind) => kind === "plans");
  expect(() =>
    f.db.transaction(() => {
      f.annotations.saveApprovalContext("new-approval", captured);
      f.db.put("approvals", "new-approval", { id: "new-approval" });
      // Invoke the component which uses the faulting port after nested capture insertion.
      f.annotations.update("p", note.annotation.id, {
        expectedRevision: 1,
        text: "rolled back",
        author: "author",
        isConstraint: false,
      });
    }),
  ).toThrow("injected storage failure");
  expect({
    settings: f.db.list("settings"),
    plans: f.db.list("plans"),
    approvals: f.db.list("approvals"),
  }).toEqual(before);
  expect(f.annotations.get("p", note.annotation.id).annotation.revision).toBe(
    1,
  );
  f.setFailure(undefined);
  f.annotations.saveApprovalContext("new-approval", captured);
  f.annotations.update("p", note.annotation.id, {
    expectedRevision: 1,
    text: "later edit",
    author: "author",
    isConstraint: false,
  });
  expect(f.db.get("settings", "approved-annotations:new-approval")).toEqual(
    captured,
  );
  expect(f.annotations.legacyApprovalIds()).toEqual(new Set());
});
