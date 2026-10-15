import { MemoryStructureFiles } from "../support/structure-file-port.js";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteStorage } from "@codemap/storage";
import type { CodeSnapshot, IndexerPort, Plan } from "@codemap/core";
import { createServer } from "../../apps/server/src/server.js";
import { WorkspaceService } from "../../packages/service/src/workspace.js";

const stores: SqliteStorage[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});
const snapshot = (projectId: string, version: string): CodeSnapshot => ({
  id: `${projectId}:${version}`,
  projectId,
  contentHash: version,
  createdAt: "2026-10-10T00:00:00Z",
  gitRevision: null,
  nodes: [],
  relations: [],
  diagnostics: [],
  coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
});
async function setup() {
  const storage = new SqliteStorage(":memory:");
  stores.push(storage);
  let version = "S0";
  let hold: Promise<void> | undefined;
  let entered: (() => void) | undefined;
  const indexer: IndexerPort = {
    async index(_path, id) {
      entered?.();
      if (hold) await hold;
      return snapshot(id, version);
    },
  };
  const service = new WorkspaceService({
    storage,
    indexer,
    structureFiles: new MemoryStructureFiles(),
  });
  const project = await service.openProject("/fs01-fixture-A");
  const plan = service.createPlan({
    projectId: project.id,
    title: "path intent",
  }).plan;
  return {
    storage,
    service,
    project,
    plan,
    change: (value: string) => {
      version = value;
    },
    pause: () => {
      let release!: () => void;
      let start!: () => void;
      hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        start = resolve;
      });
      entered = start;
      return { started, release };
    },
  };
}
describe("ownership SQLite publication precondition", () => {
  it("rejects S0/r1 after S1 publication without a plan/approval write", async () => {
    const { storage, service, project, plan, change } = await setup();
    const before = storage.get<Plan>("plans", plan.id);
    change("S1");
    await service.refreshIndex(project.id);
    expect(() =>
      service.updatePlan(plan.id, {
        expectedRevision: 1,
        expectedSnapshotId: project.snapshotId!,
        operations: [],
      }),
    ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_CHANGED" }));
    expect(storage.get("plans", plan.id)).toEqual(before);
    expect(storage.list("approvals")).toEqual([]);
  });
  it("linearizes update before a waiting refresh publication, then reports stale", async () => {
    const { service, project, plan, change, pause } = await setup();
    const barrier = pause();
    change("S1");
    const refresh = service.refreshIndex(project.id);
    await barrier.started;
    expect(
      service.updatePlan(plan.id, {
        expectedRevision: 1,
        expectedSnapshotId: project.snapshotId!,
        operations: [],
      }).plan.revision,
    ).toBe(2);
    barrier.release();
    await refresh;
    expect(service.getPlan(plan.id).plan.status).toBe("stale");
  });
  it("rejects a fresh snapshot supplied against an old baseline and foreign snapshot", async () => {
    const { service, project, plan, change } = await setup();
    change("S1");
    const fresh = await service.refreshIndex(project.id);
    expect(() =>
      service.updatePlan(plan.id, {
        expectedRevision: 1,
        expectedSnapshotId: fresh.id,
        operations: [],
      }),
    ).toThrowError(expect.objectContaining({ code: "BASELINE_CONFLICT" }));
    expect(() =>
      service.updatePlan(plan.id, {
        expectedRevision: 1,
        expectedSnapshotId: "foreign:S1",
        operations: [],
      }),
    ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_CHANGED" }));
  });
  it("keeps old clients compatible while validating malformed new fields", async () => {
    const { service, project, plan, change } = await setup();
    for (const value of ["", " ", null, 7])
      expect(() =>
        service.updatePlan(plan.id, {
          expectedRevision: 1,
          expectedSnapshotId: value as string,
          operations: [],
        }),
      ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
    change("S1");
    await service.refreshIndex(project.id);
    expect(
      service.updatePlan(plan.id, { expectedRevision: 1, operations: [] }).plan,
    ).toMatchObject({ revision: 2, status: "stale" });
  });
  it("another project's publication does not reject this project's captured tuple", async () => {
    const { service, project, plan, change } = await setup();
    const second = await service.openProject("/fs01-fixture-B");
    change("S1");
    await service.refreshIndex(second.id);
    expect(
      service.updatePlan(plan.id, {
        expectedRevision: 1,
        expectedSnapshotId: project.snapshotId!,
        operations: [],
      }).plan,
    ).toMatchObject({ revision: 2, status: "draft" });
  });
});

it("HTTP parser forwards the snapshot tuple and leaves the plan unchanged on 409", async () => {
  const { storage, service, project, plan, change } = await setup();
  const app = await createServer({ service });
  try {
    const before = storage.get("plans", plan.id);
    change("S1");
    await service.refreshIndex(project.id);
    const response = await app.inject({
      method: "PUT",
      url: `/api/plans/${plan.id}`,
      payload: {
        expectedRevision: 1,
        expectedSnapshotId: project.snapshotId,
        operations: [],
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("SNAPSHOT_CHANGED");
    expect(storage.get("plans", plan.id)).toEqual(before);
    const invalid = await app.inject({
      method: "PUT",
      url: `/api/plans/${plan.id}`,
      payload: { expectedRevision: 1, expectedSnapshotId: 7, operations: [] },
    });
    expect(invalid.statusCode).toBe(400);
    const legacy = await app.inject({
      method: "PUT",
      url: `/api/plans/${plan.id}`,
      payload: { expectedRevision: 1, operations: [] },
    });
    expect(legacy.statusCode).toBe(200);
    expect(legacy.json().plan.revision).toBe(2);
  } finally {
    await app.close();
  }
});
it("revision and baseline hash conflicts do not change stored records", async () => {
  const { storage, service, project, plan } = await setup();
  const before = storage.get("plans", plan.id);
  expect(() =>
    service.updatePlan(plan.id, {
      expectedRevision: 2,
      expectedSnapshotId: project.snapshotId!,
      operations: [],
    }),
  ).toThrowError(expect.objectContaining({ code: "REVISION_CONFLICT" }));
  const current = service.getSnapshot(project.id);
  storage.put("snapshots", current.id, {
    ...current,
    contentHash: "changed-hash",
  });
  expect(() =>
    service.updatePlan(plan.id, {
      expectedRevision: 1,
      expectedSnapshotId: current.id,
      operations: [],
    }),
  ).toThrowError(expect.objectContaining({ code: "BASELINE_CONFLICT" }));
  expect(storage.get("plans", plan.id)).toEqual(before);
});
