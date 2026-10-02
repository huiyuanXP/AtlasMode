import { expect, test } from "vitest";
import type {
  CodeSnapshot,
  IndexerPort,
  RecordKind,
  StoragePort,
} from "@codemap/core";
import { WorkspaceService } from "./index.js";

// A port double controls only scheduling; integration tests exercise actual SQLite/indexer.
class MemoryStorage implements StoragePort {
  records = new Map<string, unknown>();
  get<T>(kind: RecordKind, id: string): T | undefined {
    return structuredClone(this.records.get(`${kind}/${id}`)) as T | undefined;
  }
  list<T>(kind: RecordKind): T[] {
    return [...this.records]
      .filter(([key]) => key.startsWith(`${kind}/`))
      .map(([, v]) => structuredClone(v) as T);
  }
  put<T>(kind: RecordKind, id: string, value: T): void {
    this.records.set(`${kind}/${id}`, structuredClone(value));
  }
  delete(kind: RecordKind, id: string): void {
    this.records.delete(`${kind}/${id}`);
  }
  transaction<T>(fn: () => T): T {
    const original = structuredClone(this.records);
    try {
      return fn();
    } catch (error) {
      this.records = original;
      throw error;
    }
  }
  close(): void {}
}
function snapshot(projectId: string, version = "base"): CodeSnapshot {
  return {
    id: `${projectId}:${version}`,
    projectId,
    contentHash: version,
    createdAt: "2026-10-03T00:00:00Z",
    gitRevision: null,
    nodes: [],
    relations: [],
    diagnostics: [],
    coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("an edit during approval refresh conflicts with expectedRevision and creates no approval", async () => {
  const storage = new MemoryStorage();
  const gate = deferred<void>();
  const started = deferred<void>();
  let pause = false;
  const indexer: IndexerPort = {
    async index(_root, id) {
      if (pause) {
        started.resolve();
        await gate.promise;
      }
      return snapshot(id);
    },
  };
  const service = new WorkspaceService({ storage, indexer });
  const project = await service.openProject("/project");
  const plan = service.createPlan({
    projectId: project.id,
    title: "initial",
  }).plan;
  pause = true;
  const approving = service.approvePlan(plan.id, 1);
  await started.promise;
  service.updatePlan(plan.id, {
    expectedRevision: 1,
    title: "changed during indexing",
    operations: [],
  });
  gate.resolve();
  await expect(approving).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  expect(service.getPlan(plan.id)).toMatchObject({
    valid: false,
    plan: { revision: 2, title: "changed during indexing" },
  });
  expect(storage.list("approvals")).toEqual([]);
});
test("refreshes serialize per project while another project progresses independently", async () => {
  const storage = new MemoryStorage();
  const gate = deferred<void>();
  const started = deferred<void>();
  let slowId = "",
    reads = 0;
  const indexer: IndexerPort = {
    async index(_root, id) {
      if (id !== slowId) return snapshot(id);
      reads++;
      if (reads === 1) {
        started.resolve();
        await gate.promise;
        return snapshot(id, "older");
      }
      return snapshot(id, "newer");
    },
  };
  const service = new WorkspaceService({ storage, indexer });
  const first = await service.openProject("/first"),
    second = await service.openProject("/second");
  slowId = first.id;
  const older = service.refreshIndex(first.id);
  await started.promise;
  const newer = service.refreshIndex(first.id);
  await expect(service.refreshIndex(second.id)).resolves.toMatchObject({
    projectId: second.id,
    contentHash: "base",
  });
  gate.resolve();
  await Promise.all([older, newer]);
  expect(service.getSnapshot(first.id).contentHash).toBe("newer");
  expect(
    storage
      .list<CodeSnapshot>("snapshots")
      .filter((s) => s.projectId === first.id),
  ).toHaveLength(3);
});
test("a failed refresh preserves prior snapshot and does not poison subsequent refresh", async () => {
  let fail = false;
  const storage = new MemoryStorage(),
    service = new WorkspaceService({
      storage,
      indexer: {
        async index(_root, id) {
          if (fail) throw new Error("scan failed");
          return snapshot(id);
        },
      },
    });
  const project = await service.openProject("/project");
  fail = true;
  await expect(service.refreshIndex(project.id)).rejects.toThrow("scan failed");
  expect(service.getSnapshot(project.id).contentHash).toBe("base");
  fail = false;
  await expect(service.refreshIndex(project.id)).resolves.toMatchObject({
    contentHash: "base",
  });
});
test("unavailable source port gives an actionable domain error", async () => {
  const service = new WorkspaceService({
    storage: new MemoryStorage(),
    indexer: {
      async index(_root, id) {
        return snapshot(id);
      },
    },
  });
  const project = await service.openProject("/project");
  await expect(service.readSource(project.id, "main.ts")).rejects.toMatchObject(
    { code: "SOURCE_UNAVAILABLE" },
  );
});

test("policy responsibility and constraints require renewed approval, preserve historical verification and reject old revisions", async () => {
  const storage = new MemoryStorage();
  const service = new WorkspaceService({
    storage,
    indexer: {
      async index(_root, id) {
        return snapshot(id);
      },
    },
  });
  const a = await service.openProject("/a");
  const b = await service.openProject("/b");
  const policy = service.savePolicy({
    projectId: a.id,
    pathPrefix: "src/",
    purpose: "Old responsibility",
    forbiddenDependencies: ["vendor/", "lib"],
  });
  const plan = service.createPlan({ projectId: a.id, title: "A" }).plan;
  const other = service.createPlan({ projectId: b.id, title: "B" }).plan;
  const approval = (await service.approvePlan(plan.id, 1)).approval!;
  service.savePolicy({ ...policy, purpose: "New responsibility" });
  expect(service.getPlan(plan.id)).toMatchObject({
    valid: false,
    plan: { revision: 2, status: "draft" },
    approval,
  });
  expect(service.getPlan(other.id).plan.revision).toBe(1);
  expect(() =>
    service.updatePlan(plan.id, { expectedRevision: 1, operations: [] }),
  ).toThrow("revision");
  await expect(service.approvePlan(plan.id, 1)).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  expect((await service.verifyPlan(plan.id)).revision).toBe(1);
  expect(
    JSON.parse(service.exportPlan(plan.id, "json")).approvedPlan.revision,
  ).toBe(1);
  const approved = await service.approvePlan(plan.id, 2);
  service.savePolicy({
    ...policy,
    purpose: "New responsibility",
    pathPrefix: "src",
    forbiddenDependencies: ["lib", "vendor", "lib"],
  });
  expect(service.getPlan(plan.id)).toEqual(approved);
  service.savePolicy({
    ...policy,
    purpose: "New responsibility",
    forbiddenDependencies: ["other"],
  });
  expect(service.getPlan(plan.id)).toMatchObject({
    valid: false,
    plan: { revision: 3 },
  });
});

test("shared group members do not move facts; group design changes invalidate only its project's plans", async () => {
  const storage = new MemoryStorage();
  const service = new WorkspaceService({
    storage,
    indexer: {
      async index(_root, id) {
        return {
          ...snapshot(id),
          nodes: [
            { id: "f", kind: "function", name: "fn", filePath: "src/a.ts" },
            { id: "g", kind: "function", name: "gn", filePath: "src/b.ts" },
          ],
        };
      },
    },
  });
  const project = await service.openProject("/a");
  const before = service.getSnapshot(project.id);
  const group = service.saveGroup({
    projectId: project.id,
    title: "First",
    description: "Design",
    source: "user",
    memberIds: ["f", "g"],
  });
  service.saveGroup({
    ...group,
    id: undefined,
    title: "Second",
    memberIds: ["f"],
  });
  expect(service.listGroups(project.id).map((g) => g.memberIds)).toEqual([
    ["f", "g"],
    ["f"],
  ]);
  expect(service.getSnapshot(project.id)).toEqual(before);
  const plan = service.createPlan({
    projectId: project.id,
    title: "Plan",
  }).plan;
  await service.approvePlan(plan.id, 1);
  service.saveGroup({ ...group, memberIds: ["g", "f", "f"], source: "agent" });
  expect(service.getPlan(plan.id).valid).toBe(true);
  service.saveGroup({ ...group, description: "Changed design" });
  expect(service.getPlan(plan.id)).toMatchObject({
    valid: false,
    plan: { revision: 2 },
  });
  await service.approvePlan(plan.id, 2);
  service.saveGroup({
    ...group,
    description: "Changed design",
    memberIds: ["f"],
  });
  expect(service.getPlan(plan.id)).toMatchObject({
    valid: false,
    plan: { revision: 3 },
  });
});

test("knowledge write and every affected plan roll back together on storage failure", async () => {
  class FailingStorage extends MemoryStorage {
    failId = "";
    override put<T>(kind: RecordKind, id: string, value: T) {
      if (kind === "plans" && id === this.failId)
        throw new Error("disk failed");
      super.put(kind, id, value);
    }
  }
  const storage = new FailingStorage();
  const service = new WorkspaceService({
    storage,
    indexer: {
      async index(_root, id) {
        return snapshot(id);
      },
    },
  });
  const project = await service.openProject("/a");
  const a = service.createPlan({ projectId: project.id, title: "A" }).plan;
  const b = service.createPlan({ projectId: project.id, title: "B" }).plan;
  storage.failId = b.id;
  expect(() =>
    service.savePolicy({
      projectId: project.id,
      pathPrefix: "src",
      purpose: "Responsibility",
      forbiddenDependencies: [],
    }),
  ).toThrow("disk failed");
  expect(service.listPolicies(project.id)).toEqual([]);
  expect(service.getPlan(a.id).plan.revision).toBe(1);
  expect(service.getPlan(b.id).plan.revision).toBe(1);
});
