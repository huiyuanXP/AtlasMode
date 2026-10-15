import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import {
  DomainError,
  type Approval,
  type Annotation,
  type Plan,
  type Project,
  type CodeSnapshot,
  type StoragePort,
  type RecordKind,
} from "@codemap/core";
import { SqliteStorage } from "@codemap/storage";
import { Planning } from "../../packages/service/src/planning.js";
import { Annotations } from "../../packages/service/src/annotations.js";
import { AnnotationReviewService } from "../../packages/service/src/annotation-review-service.js";
import * as review from "../../packages/service/src/annotation-review.js";
const uuid = vi.hoisted(() => ({ fixed: undefined as string | undefined }));
vi.mock("node:crypto", async (actual) => {
  const original = await actual<typeof import("node:crypto")>();
  return { ...original, randomUUID: () => uuid.fixed ?? original.randomUUID() };
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  uuid.fixed = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const action of cleanup.splice(0).reverse()) action();
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "kn01-approval-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "records.db"),
    db = new SqliteStorage(path);
  cleanup.push(() => db.close());
  const sql = new Database(path);
  cleanup.push(() => sql.close());
  const project: Project = {
    id: "p",
    name: "p",
    path: join(root, "source"),
    snapshotId: "s1",
  };
  db.put("projects", "p", project);
  let snapshot: CodeSnapshot = {
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
  let failure: ((kind: RecordKind, id: string) => boolean) | undefined;
  const port: StoragePort = {
    get: (kind, id) => db.get(kind, id),
    list: (kind) => db.list(kind),
    put: (kind, id, value) => {
      if (failure?.(kind, id)) throw new Error("injected approval write");
      db.put(kind, id, value);
    },
    delete: (kind, id) => db.delete(kind, id),
    transaction: (fn) => db.transaction(fn),
    close: () => db.close(),
  };
  const notes = new Annotations(
    port,
    (id) => db.get<Project>("projects", id)!,
    () => snapshot,
  );
  const planning = new Planning(
    port,
    () => snapshot,
    () => [],
  );
  const plan = planning.create({ projectId: "p", title: "Reviewed plan" }).plan;
  const create = (binding = true) =>
    notes.create("p", {
      text: "retain this",
      author: "作者",
      source: "user",
      isConstraint: true,
      binding: binding
        ? { snapshotId: snapshot.id, target: { kind: "node", id: "a" } }
        : null,
    }).annotation;
  const approve = () =>
    planning.approve(plan.id, db.get<Plan>("plans", plan.id)!.revision);
  const raw = () =>
    sql.prepare("SELECT rowid,kind,id,value FROM records ORDER BY rowid").all();
  const historical = (id: string) =>
    sql
      .prepare(
        "SELECT rowid,kind,id,value FROM records WHERE (kind='approvals' AND id=?) OR (kind='settings' AND id IN (?,?)) ORDER BY rowid",
      )
      .all(id, `approved-plan:${id}`, `approved-annotations:${id}`);
  return {
    db,
    port,
    sql,
    path,
    planning,
    notes,
    plan,
    create,
    approve,
    raw,
    historical,
    setFailure: (v: typeof failure) => {
      failure = v;
    },
    snapshot: () => snapshot,
    setSnapshot: (v: CodeSnapshot) => {
      snapshot = v;
    },
  };
}
function code(action: () => unknown, expected: string) {
  try {
    action();
    throw new Error("expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(expected);
  }
}
test("actual SQLite approval captures notes before all writes and exports the immutable reviewed context", () => {
  const f = fixture(),
    note = f.create(),
    detail = f.approve(),
    approval = detail.approval!;
  expect(detail.valid).toBe(true);
  expect(approval.reviewContext?.version).toBe(1);
  const read = f.planning.approvedForVerification(f.plan.id);
  expect(read.contextStatus).toBe("v1");
  expect(read.annotationContext?.annotations).toEqual([note]);
  expect(approval.reviewContext?.knowledgeHash).toBe(
    review.annotationKnowledgeHash(read.annotationContext!),
  );
  expect(f.planning.getCurrentApproval(f.plan.id).valid).toBe(true);
  const exported = JSON.parse(f.planning.export(f.plan.id, "json"));
  expect(exported.annotationContext).toEqual(read.annotationContext);
  expect(exported.contextStatus).toBe("v1");
  expect(f.planning.export(f.plan.id, "markdown")).toContain(
    approval.reviewContext!.knowledgeHash,
  );
  const before = f.historical(approval.id);
  f.notes.update("p", note.id, {
    expectedRevision: 1,
    text: "later",
    author: "agent",
    isConstraint: false,
  });
  expect(f.planning.get(f.plan.id).valid).toBe(false);
  code(() => f.planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  expect(f.historical(approval.id)).toEqual(before);
  expect(
    f.planning.latest(f.plan.id)?.annotationContext?.annotations[0]?.text,
  ).toBe("retain this");
});
test.each([
  "text",
  "author",
  "source",
  "isConstraint",
  "binding",
  "deletedAt",
] as const)(
  "direct SQL semantic note bypass %s invalidates current approval without revision assistance",
  (field) => {
    const f = fixture(),
      note = f.create(),
      approval = f.approve().approval!,
      before = f.historical(approval.id),
      plan = f.db.get<Plan>("plans", f.plan.id)!;
    const modified: Annotation = { ...note };
    if (field === "text") modified.text = "raw change";
    if (field === "author") modified.author = "raw author";
    if (field === "source") modified.source = "agent";
    if (field === "isConstraint") modified.isConstraint = false;
    if (field === "binding") modified.binding = null;
    if (field === "deletedAt") modified.deletedAt = "2026-10-10T01:00:00.000Z";
    f.sql
      .prepare("UPDATE records SET value=? WHERE kind='annotations' AND id=?")
      .run(JSON.stringify(modified), note.id);
    expect(f.db.get("plans", f.plan.id)).toEqual(plan);
    expect(f.planning.get(f.plan.id).valid).toBe(false);
    code(() => f.planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
    expect(f.historical(approval.id)).toEqual(before);
  },
);
test("note ordering and volatile revisions do not alter the semantic hash", () => {
  const f = fixture();
  f.create();
  f.create(false);
  f.approve();
  const notes = f.db.list<Annotation>("annotations");
  f.sql.prepare("DELETE FROM records WHERE kind='annotations'").run();
  for (const note of notes.reverse())
    f.db.put("annotations", note.id, {
      ...note,
      revision: note.revision + 5,
      updatedAt: "2026-10-10T02:00:00.000Z",
    });
  expect(f.planning.getCurrentApproval(f.plan.id).valid).toBe(true);
});
test("explicit delete, retained orphan and explicit new domain binding invalidate without rewriting prior approved bytes", () => {
  const f = fixture(),
    note = f.create(),
    first = f.approve().approval!,
    before = f.historical(first.id);
  const missing = { ...f.snapshot(), nodes: [] };
  f.setSnapshot(missing);
  f.notes.reconcile("p", missing, "2026-10-10T01:00:00.000Z");
  expect(f.notes.get("p", note.id).annotation.text).toBe(note.text);
  expect(f.notes.get("p", note.id).resolution.status).toBe("orphan");
  code(() => f.planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  const orphan = f.approve().approval!;
  expect(
    f.planning.latest(f.plan.id)?.annotationContext?.annotations[0]?.binding
      ?.state,
  ).toBe("orphan");
  f.setSnapshot({
    ...missing,
    nodes: [{ id: "b", kind: "function", name: "same", filePath: "src/b.ts" }],
  });
  f.notes.bind("p", note.id, {
    expectedRevision: 2,
    snapshotId: "s1",
    target: { kind: "node", id: "b" },
  });
  code(() => f.planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  expect(f.planning.approvedForVerification(f.plan.id).approval.id).toBe(
    orphan.id,
  );
  f.approve();
  f.notes.delete("p", note.id, 3);
  code(() => f.planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  expect(f.historical(first.id)).toEqual(before);
});
test.each([
  "missing",
  "tampered",
  "missing-tag",
  "null-tag",
  "future-tag",
  "bad-plan",
  "foreign-plan",
] as const)(
  "newest %s context fails all historical consumers closed without older fallback",
  (change) => {
    const f = fixture();
    f.create();
    f.approve();
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-10T03:00:00.000Z");
    const approval = f.approve().approval!;
    const key = `approved-annotations:${approval.id}`;
    if (change === "missing") f.db.delete("settings", key);
    if (change === "tampered") {
      const context = f.db.get<{ annotations: Annotation[] }>("settings", key)!;
      context.annotations[0]!.text = "tampered";
      f.db.put("settings", key, context);
    }
    if (change === "missing-tag") {
      const copy = { ...approval };
      delete copy.reviewContext;
      f.db.put("approvals", approval.id, copy);
    }
    if (change === "null-tag")
      f.db.put("approvals", approval.id, { ...approval, reviewContext: null });
    if (change === "future-tag")
      f.db.put("approvals", approval.id, {
        ...approval,
        reviewContext: {
          version: 2,
          knowledgeHash: approval.reviewContext!.knowledgeHash,
        },
      });
    if (change === "bad-plan")
      f.db.delete("settings", `approved-plan:${approval.id}`);
    if (change === "foreign-plan") {
      const saved = f.db.get<Plan>("settings", `approved-plan:${approval.id}`)!;
      f.db.put("settings", `approved-plan:${approval.id}`, {
        ...saved,
        projectId: "foreign",
      });
    }
    expect(f.planning.get(f.plan.id)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "APPROVAL_CONTEXT_INVALID" }),
      ]),
    });
    for (const action of [
      () => f.planning.latest(f.plan.id),
      () => f.planning.approvedForVerification(f.plan.id),
      () => f.planning.getCurrentApproval(f.plan.id),
      () => f.planning.export(f.plan.id, "json"),
      () => f.planning.export(f.plan.id, "markdown"),
    ])
      code(action, "APPROVAL_CONTEXT_INVALID");
  },
);
test("equal revision and clock timestamps select last inserted approval, never older valid capture", () => {
  const f = fixture();
  f.create();
  vi.useFakeTimers();
  vi.setSystemTime("2026-10-10T03:00:00.000Z");
  const first = f.approve().approval!,
    second = f.approve().approval!;
  expect(second.approvedAt).toBe(first.approvedAt);
  expect(f.planning.latest(f.plan.id)?.approval.id).toBe(second.id);
  f.db.delete("settings", `approved-annotations:${second.id}`);
  code(() => f.planning.latest(f.plan.id), "APPROVAL_CONTEXT_INVALID");
});
test("legacy registry permits unchanged historical reads and export, blocks execution, and is never backfilled", () => {
  const f = fixture(),
    plan = {
      ...f.db.get<Plan>("plans", f.plan.id)!,
      status: "approved" as const,
    },
    approval: Approval = {
      id: "legacy",
      planId: plan.id,
      revision: plan.revision,
      semanticHash: reviewHash(plan),
      baselineSnapshotId: plan.baselineSnapshotId,
      baselineContentHash: plan.baselineContentHash,
      approvedAt: "2026-10-09T00:00:00.000Z",
      actor: "user",
    };
  f.sql
    .prepare("INSERT INTO records(kind,id,value) VALUES('approvals',?,?)")
    .run(approval.id, JSON.stringify(approval, null, 3));
  f.db.put("settings", `approved-plan:${approval.id}`, plan);
  f.db.put("plans", plan.id, plan);
  f.db.put("settings", "annotation-review-legacy-v1", {
    version: 1,
    approvalIds: ["legacy"],
  });
  const before = f.raw(),
    legacyHistory = f.historical(approval.id);
  expect(f.planning.approvedForVerification(plan.id).contextStatus).toBe(
    "legacy",
  );
  expect(JSON.parse(f.planning.export(plan.id, "json")).contextStatus).toBe(
    "legacy",
  );
  expect(f.planning.export(plan.id, "markdown")).toContain("unrecorded");
  expect(f.planning.get(plan.id).valid).toBe(false);
  code(
    () => f.planning.getCurrentApproval(plan.id),
    "APPROVAL_CONTEXT_INVALID",
  );
  expect(f.raw()).toEqual(before);
  f.db.put("settings", "annotation-review-legacy-v1", {
    version: 1,
    approvalIds: [],
  });
  code(() => f.planning.latest(plan.id), "APPROVAL_CONTEXT_INVALID");
  f.db.put("settings", "annotation-review-legacy-v1", {
    version: 1,
    approvalIds: ["legacy"],
  });
  const frozenRegistry = f.sql
    .prepare(
      "SELECT value FROM records WHERE kind='settings' AND id='annotation-review-legacy-v1'",
    )
    .get();
  const renewed = f.approve();
  expect(renewed.valid).toBe(true);
  expect(renewed.approval?.reviewContext?.version).toBe(1);
  expect(renewed.approval?.id).not.toBe("legacy");
  expect(f.historical(approval.id)).toEqual(legacyHistory);
  expect(f.db.get("settings", "approved-annotations:legacy")).toBeUndefined();
  expect(
    f.sql
      .prepare(
        "SELECT value FROM records WHERE kind='settings' AND id='annotation-review-legacy-v1'",
      )
      .get(),
  ).toEqual(frozenRegistry);
});
function reviewHash(plan: Plan) {
  // public Planning semantic plan hash preserves existing approval values
  return semanticHash(plan);
}
import { semanticHash } from "../../packages/service/src/planning.js";
test.each([
  "approved-plan",
  "approved-annotations",
  "approvals",
  "plans",
] as const)(
  "failure writing %s rolls back the complete real SQLite approval transaction",
  (point) => {
    const f = fixture();
    f.create();
    const before = f.raw();
    f.setFailure((kind, id) =>
      point === "approved-plan"
        ? kind === "settings" && id.startsWith("approved-plan:")
        : point === "approved-annotations"
          ? kind === "settings" && id.startsWith("approved-annotations:")
          : kind === point,
    );
    expect(() => f.approve()).toThrow("injected approval write");
    expect(f.raw()).toEqual(before);
  },
);
test("capture and hash failures occur before writes and roll back all approval state", () => {
  const f = fixture();
  f.create();
  const before = f.raw();
  const hash = vi
    .spyOn(review, "annotationKnowledgeHash")
    .mockImplementationOnce(() => {
      throw new Error("injected hash failure");
    });
  expect(() => f.approve()).toThrow("injected hash failure");
  hash.mockRestore();
  expect(f.raw()).toEqual(before);
  f.sql.prepare("UPDATE records SET value='{}' WHERE kind='annotations'").run();
  const corrupted = f.raw();
  expect(() => f.approve()).toThrow();
  expect(f.raw()).toEqual(corrupted);
});
test.each(["approval", "plan-history", "context-history"] as const)(
  "approval ID collision %s never overwrites a stored historical value",
  (point) => {
    const f = fixture();
    f.create();
    uuid.fixed = "collision";
    if (point === "approval")
      f.db.put("approvals", "collision", {
        id: "collision",
        planId: "other-plan",
        revision: 1,
        semanticHash: "a".repeat(64),
        baselineSnapshotId: "s1",
        baselineContentHash: "hash",
        approvedAt: "2026-10-09T00:00:00.000Z",
        actor: "user",
      } satisfies Approval);
    if (point === "plan-history")
      f.db.put("settings", "approved-plan:collision", { protected: "plan" });
    if (point === "context-history")
      f.db.put("settings", "approved-annotations:collision", {
        protected: "context",
      });
    const before = f.raw();
    expect(() => f.approve()).toThrow();
    expect(f.raw()).toEqual(before);
  },
);
test("compatible default constructor with no legacy registry creates and reads required v1 approval", () => {
  const f = fixture();
  f.db.delete("settings", "annotation-review-legacy-v1");
  expect(f.approve().valid).toBe(true);
  expect(f.planning.getCurrentApproval(f.plan.id).valid).toBe(true);
});

test("same Notes instance is compatible with the optional constructor injection", () => {
  const f = fixture();
  const capture = vi.spyOn(f.notes, "captureContext");
  const planning = new Planning(
    f.port,
    f.snapshot,
    () => [],
    new AnnotationReviewService(f.port, f.snapshot, f.notes),
  );
  const note = f.create(false);
  const detail = planning.approve(
    f.plan.id,
    f.db.get<Plan>("plans", f.plan.id)!.revision,
  );
  expect(detail.valid).toBe(true);
  expect(capture).toHaveBeenCalledWith("p", "s1");
  expect(
    planning.latest(f.plan.id)?.annotationContext?.annotations[0]?.id,
  ).toBe(note.id);
});
test("current execution rejects no approval and stale baseline with NOT_APPROVED", () => {
  const f = fixture();
  code(() => f.planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  code(() => f.planning.approvedForVerification(f.plan.id), "NOT_APPROVED");
  f.approve();
  f.setSnapshot({ ...f.snapshot(), id: "s2" });
  code(() => f.planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  // The recorded historical approval remains reviewable against its original snapshot.
  expect(f.planning.approvedForVerification(f.plan.id).contextStatus).toBe(
    "v1",
  );
});
test("malformed stored note ownership fails current review closed instead of disappearing in project filtering", () => {
  const f = fixture();
  const note = f.create();
  f.approve();
  f.sql
    .prepare("UPDATE records SET value='{}' WHERE kind='annotations' AND id=?")
    .run(note.id);
  expect(f.planning.get(f.plan.id)).toMatchObject({
    valid: false,
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "APPROVAL_CONTEXT_INVALID" }),
    ]),
  });
  code(
    () => f.planning.getCurrentApproval(f.plan.id),
    "APPROVAL_CONTEXT_INVALID",
  );
});
test.each([
  "approved-plan",
  "approved-annotations",
  "approvals",
  "plans",
] as const)(
  "failure after actual SQL write %s still rolls back every record",
  (point) => {
    const f = fixture();
    f.create();
    const before = f.raw();
    const port: StoragePort = {
      ...f.port,
      put: (kind, id, value) => {
        f.db.put(kind, id, value);
        if (
          point === "approved-plan"
            ? kind === "settings" && id.startsWith("approved-plan:")
            : point === "approved-annotations"
              ? kind === "settings" && id.startsWith("approved-annotations:")
              : kind === point
        )
          throw new Error("injected after write");
      },
    };
    const planning = new Planning(port, f.snapshot, () => []);
    expect(() =>
      planning.approve(f.plan.id, f.db.get<Plan>("plans", f.plan.id)!.revision),
    ).toThrow("injected after write");
    expect(f.raw()).toEqual(before);
  },
);
test("owned SQLite restart retains v1 receipts and original history after later note deletion", () => {
  const f = fixture();
  const note = f.create();
  const approval = f.approve().approval!,
    before = f.historical(approval.id);
  f.notes.delete("p", note.id, 1);
  f.db.close();
  const reopened = new SqliteStorage(f.path);
  cleanup.push(() => reopened.close());
  const planning = new Planning(reopened, f.snapshot, () => []);
  expect(
    planning.approvedForVerification(f.plan.id).annotationContext
      ?.annotations[0]?.text,
  ).toBe(note.text);
  code(() => planning.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  expect(f.historical(approval.id)).toEqual(before);
});

test("revision CAS and current policy rejection leave actual approved history unchanged", () => {
  const f = fixture();
  f.create();
  const approved = f.approve().approval!,
    before = f.raw();
  code(() => f.planning.approve(f.plan.id, 1), "REVISION_CONFLICT");
  expect(f.raw()).toEqual(before);
  const policyGuard = new Planning(f.port, f.snapshot, () => [
    {
      id: "policy",
      projectId: "p",
      pathPrefix: "../outside",
      purpose: "invalid",
      forbiddenDependencies: [],
    },
  ]);
  expect(policyGuard.get(f.plan.id).issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_POLICY_PATH" }),
    ]),
  );
  code(() => policyGuard.getCurrentApproval(f.plan.id), "NOT_APPROVED");
  code(
    () =>
      policyGuard.approve(
        f.plan.id,
        f.db.get<Plan>("plans", f.plan.id)!.revision,
      ),
    "VALIDATION_FAILED",
  );
  expect(f.raw()).toEqual(before);
  expect(policyGuard.latest(f.plan.id)?.approval.id).toBe(approved.id);
});
