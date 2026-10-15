import { expect, test, vi } from "vitest";
import type { StructureState } from "@codemap/core";
import { createPolicyController } from "./policy-controller.js";
import type { StructureTransport } from "../../api/structure-client.js";
import { StructureClientError } from "../../api/structure-client.js";
const uuid = "00000000-0000-4000-8000-000000000001";
const state = (p = "a", revision = 2): StructureState => ({
  projectId: p,
  schemaVersion: 1,
  document: {
    schemaVersion: 1,
    folders: [
      {
        path: "src",
        purpose: "code",
        allowed: ["a"],
        forbidden: ["b"],
        future: { nested: "retained" },
      },
    ],
    dependencyRules: [],
    custom: "retained",
  },
  structureRevision: revision,
  fileDigest: "a".repeat(64),
  semanticDigest: "b".repeat(64),
  verifiedAt: "t",
  status: "ready",
  diagnostics: [],
  legacyPendingCount: 1,
});
function fixture() {
  let current = state();
  const policy = {
    id: "db-only",
    projectId: "a",
    pathPrefix: "src",
    purpose: "old",
    forbiddenDependencies: ["internal"],
  };
  const api = {
    readState: vi.fn<StructureTransport["readState"]>(async () => current),
    readPolicies: vi.fn<StructureTransport["readPolicies"]>(async () => ({
      policies: [policy],
      structureRevision: current.structureRevision,
      fileDigest: current.fileDigest,
      verifiedAt: "t",
      status: current.status,
    })),
    preview: vi.fn<StructureTransport["preview"]>(async () => ({
      policies: [policy],
      structureRevision: current.structureRevision,
      fileDigest: current.fileDigest,
      verifiedAt: "t",
    })),
    savePolicy: vi.fn<StructureTransport["savePolicy"]>(async () => policy),
    writeStructure: vi.fn<StructureTransport["writeStructure"]>(
      async () => current,
    ),
  };
  const accepted = vi.fn();
  const c = createPolicyController(api, accepted, () => uuid);
  c.selectProject("a");
  return {
    api,
    c,
    accepted,
    set: (s: StructureState) => {
      current = s;
    },
  };
}
function hold<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
test("same-id DB legacy form captures actual rev/digest/uuid without migrating", async () => {
  const { c, api, accepted } = fixture();
  await c.reload();
  c.choose("legacy:db-only");
  c.edit({ purpose: "edited" });
  await c.save();
  expect(api.savePolicy).toHaveBeenCalledWith("a", {
    id: "db-only",
    pathPrefix: "src",
    purpose: "edited",
    forbiddenDependencies: ["internal"],
    mutationId: uuid,
    expectedStructureRevision: 2,
    expectedFileDigest: "a".repeat(64),
  });
  expect(api.writeStructure).not.toHaveBeenCalled();
  expect(accepted).toHaveBeenCalledTimes(1);
  expect(c.store.getState().needsReload).toBe(true);
});
test("409 keeps all input and old capture; save remains blocked until explicit reload", async () => {
  const { c, api, set } = fixture();
  await c.reload();
  c.choose("legacy:db-only");
  c.edit({ purpose: "mine", forbidden: "x\ny" });
  api.savePolicy.mockRejectedValueOnce(
    new StructureClientError("STRUCTURE_CONFLICT", "external", 409),
  );
  await c.save();
  expect(c.store.getState().draft).toMatchObject({
    purpose: "mine",
    forbidden: "x\ny",
  });
  expect(c.store.getState().capture?.structureRevision).toBe(2);
  await c.save();
  expect(api.savePolicy).toHaveBeenCalledTimes(1);
  expect(api.readState).toHaveBeenCalledTimes(1);
  set(state("a", 3));
  await c.reload();
  expect(c.store.getState().draft.purpose).toBe("mine");
  await c.save();
  expect(api.savePolicy.mock.calls[1]?.[1].expectedStructureRevision).toBe(3);
});
test("network failure only exact retry uses same immutable request and UUID", async () => {
  const { c, api } = fixture();
  await c.reload();
  c.edit({ purpose: "mine" });
  api.savePolicy
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      id: "db-only",
      projectId: "a",
      pathPrefix: "",
      purpose: "mine",
      forbiddenDependencies: [],
    });
  await c.save();
  c.edit({ purpose: "must not change uncertain request" });
  expect(c.store.getState().draft.purpose).toBe("mine");
  await c.retry();
  expect(api.savePolicy.mock.calls[1]).toEqual(api.savePolicy.mock.calls[0]);
  expect(c.store.getState().draft.purpose).toBe("mine");
});
test("migration requires preview and explicit command, with preview capture", async () => {
  const { c, api } = fixture();
  await c.reload();
  await c.importLegacy();
  expect(api.writeStructure).not.toHaveBeenCalled();
  await c.previewLegacy();
  expect(api.writeStructure).not.toHaveBeenCalled();
  await c.importLegacy();
  expect(api.writeStructure).toHaveBeenCalledWith("a", {
    mutationId: uuid,
    expectedStructureRevision: 2,
    expectedFileDigest: "a".repeat(64),
    operation: { kind: "importLegacy" },
  });
});
test("stale preview refuses migration without auto reread", async () => {
  const { c, api } = fixture();
  await c.reload();
  api.preview.mockResolvedValueOnce({
    policies: [],
    structureRevision: 9,
    fileDigest: null,
    verifiedAt: "t",
  });
  await c.previewLegacy();
  await c.importLegacy();
  expect(api.writeStructure).not.toHaveBeenCalled();
  expect(c.store.getState().error?.code).toBe("STRUCTURE_CONFLICT");
});
test("folder edit sends only path/purpose preserving raw unknown and allowed/forbidden server fields", async () => {
  const { c, api } = fixture();
  await c.reload();
  c.choose("folder:src");
  c.edit({ path: "lib", purpose: "new" });
  await c.save();
  expect(api.writeStructure.mock.calls[0]?.[1].operation).toEqual({
    kind: "upsertFolder",
    previousPath: "src",
    path: "lib",
    purpose: "new",
  });
  expect(api.savePolicy).not.toHaveBeenCalled();
  expect(c.store.getState().snapshot?.document?.custom).toBe("retained");
});
test("A→B→A read responses never contaminate the new epoch", async () => {
  const { c, api } = fixture();
  const h = hold<StructureState>();
  api.readState.mockReturnValueOnce(h.promise);
  const old = c.reload();
  c.selectProject("b");
  c.selectProject("a");
  await c.reload();
  h.resolve(state("a", 99));
  await old;
  expect(c.store.getState().capture?.structureRevision).toBe(2);
});
test("late write ACK has no accepted callback or state after project switch", async () => {
  const { c, api, accepted } = fixture();
  await c.reload();
  const h = hold<{
    id: string;
    projectId: string;
    pathPrefix: string;
    purpose: string;
    forbiddenDependencies: string[];
  }>();
  api.savePolicy.mockReturnValueOnce(h.promise);
  const save = c.save();
  c.selectProject("b");
  h.resolve({
    id: "x",
    projectId: "a",
    pathPrefix: "",
    purpose: "",
    forbiddenDependencies: [],
  });
  await save;
  expect(accepted).not.toHaveBeenCalled();
  expect(c.store.getState().projectId).toBe("b");
  expect(c.store.getState().snapshot).toBeUndefined();
});
test.each(["invalid", "recovery_pending", "unavailable"] as const)(
  "%s state remains visible and cannot write",
  async (status) => {
    const { c, api, set } = fixture();
    set({ ...state(), status });
    await c.reload();
    await c.save();
    expect(api.savePolicy).not.toHaveBeenCalled();
    expect(c.store.getState().snapshot?.status).toBe(status);
  },
);
test("two inconsistent read captures fail closed without hiding form or automatically fetching latest", async () => {
  const { c, api } = fixture();
  api.readPolicies.mockResolvedValueOnce({
    policies: [],
    structureRevision: 8,
    fileDigest: null,
    verifiedAt: "t",
    status: "ready",
  });
  await c.reload();
  await c.save();
  expect(api.savePolicy).not.toHaveBeenCalled();
  expect(api.readState).toHaveBeenCalledTimes(1);
  expect(c.store.getState().error?.code).toBe("STRUCTURE_CONFLICT");
});

test("foreign ACK never reaches accepted-response workspace callback", async () => {
  const { c, api, accepted } = fixture();
  await c.reload();
  api.savePolicy.mockResolvedValueOnce({
    id: "x",
    projectId: "b",
    pathPrefix: "",
    purpose: "",
    forbiddenDependencies: [],
  });
  await c.save();
  expect(accepted).not.toHaveBeenCalled();
  expect(c.store.getState().error?.code).toBe("PROJECT_MISMATCH");
});
test("missing digest/revision capture is never submitted as an undefined precondition", async () => {
  const { c, api, set } = fixture();
  set({ ...state(), fileDigest: undefined as unknown as null });
  await c.reload();
  await c.save();
  expect(api.savePolicy).not.toHaveBeenCalled();
  expect(c.store.getState().error?.code).toBe("STRUCTURE_CAPTURE_INVALID");
});

test("successful new policy ACK retains actual id for the next explicit edit", async () => {
  const { c, api } = fixture();
  await c.reload();
  c.edit({ purpose: "created" });
  await c.save();
  expect(c.store.getState().draft.id).toBe("db-only");
  await c.reload();
  c.edit({ purpose: "next" });
  await c.save();
  expect(api.savePolicy.mock.calls[1]?.[1].id).toBe("db-only");
});
test("successful folder rename ACK advances previousPath for the next explicit edit", async () => {
  const { c, api, set } = fixture();
  await c.reload();
  c.choose("folder:src");
  c.edit({ path: "lib" });
  const next = {
    ...state(),
    structureRevision: 3,
    document: {
      schemaVersion: 1 as const,
      folders: [{ path: "lib", purpose: "code" }],
      dependencyRules: [],
    },
  };
  api.writeStructure.mockResolvedValueOnce(next);
  await c.save();
  set(next);
  await c.reload();
  c.edit({ purpose: "next" });
  await c.save();
  expect(api.writeStructure.mock.calls[1]?.[1].operation).toMatchObject({
    previousPath: "lib",
    path: "lib",
    purpose: "next",
  });
});

test("accepted read response supplies exact full policies/snapshot for future Workspace synchronization", async () => {
  const { api } = fixture();
  const read = vi.fn();
  const c = createPolicyController(
    api,
    () => {},
    () => uuid,
    read,
  );
  c.selectProject("a");
  await c.reload();
  expect(read).toHaveBeenCalledWith({
    projectId: "a",
    epoch: 1,
    snapshot: state(),
    policies: [
      {
        id: "db-only",
        projectId: "a",
        pathPrefix: "src",
        purpose: "old",
        forbiddenDependencies: ["internal"],
      },
    ],
  });
});
test("an asynchronous accepted-read callback cannot unlock editing or publish failure into a new project", async () => {
  const { api } = fixture();
  const h = hold<void>();
  const c = createPolicyController(
    api,
    () => {},
    () => uuid,
    () => h.promise,
  );
  c.selectProject("a");
  const load = c.reload();
  await new Promise((r) => setTimeout(r, 0));
  expect(c.store.getState().busy).toBe(true);
  c.selectProject("b");
  h.resolve();
  await load;
  expect(c.store.getState().projectId).toBe("b");
  expect(c.store.getState().capture).toBeUndefined();
});
