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

test.each(["legacy:db-only", "folder:src"])(
  "I1 migration ACK preserves unsent dirty %s draft B",
  async (selection) => {
    const { c, api, accepted } = fixture();
    await c.reload();
    c.choose(selection);
    c.edit({
      path: "local/B",
      purpose: "local unsent B",
      forbidden: "one\ntwo",
    });
    const before = structuredClone(c.store.getState().draft);
    await c.previewLegacy();
    await c.importLegacy();
    expect(api.writeStructure.mock.calls[0]?.[1].operation).toEqual({
      kind: "importLegacy",
    });
    expect(c.store.getState().draft).toEqual(before);
    expect(c.store.getState().dirty).toBe(true);
    expect(c.store.getState().notice).toBe("imported");
    expect(accepted.mock.calls[0]?.[0].operation).toEqual({
      kind: "importLegacy",
    });
  },
);
test.each(["state", "policies", "accepted"])(
  "I2 unknown write retains immutable replay after failed %s reread",
  async (failure) => {
    const { api } = fixture();
    let failAccepted = false;
    const uuidFactory = vi
      .fn()
      .mockReturnValueOnce(uuid)
      .mockReturnValue("00000000-0000-4000-8000-000000000002");
    const c = createPolicyController(
      api,
      () => {},
      uuidFactory,
      () => {
        if (failAccepted) throw Error("sync unavailable");
      },
    );
    c.selectProject("a");
    await c.reload();
    c.edit({ path: "local/B", purpose: "unsent B", forbidden: "one\ntwo" });
    api.savePolicy
      .mockRejectedValueOnce(new Error("ACK lost"))
      .mockResolvedValueOnce({
        id: "actual-id",
        projectId: "a",
        pathPrefix: "local/B",
        purpose: "unsent B",
        forbiddenDependencies: ["one", "two"],
      });
    await c.save();
    const original = structuredClone(api.savePolicy.mock.calls[0]);
    const draft = structuredClone(c.store.getState().draft);
    if (failure === "state")
      api.readState.mockRejectedValueOnce(Error("read unavailable"));
    if (failure === "policies")
      api.readPolicies.mockRejectedValueOnce(Error("list unavailable"));
    if (failure === "accepted") failAccepted = true;
    await c.reload();
    expect(c.store.getState().retryAvailable).toBe(true);
    c.edit({ purpose: "must not replace uncertain input" });
    c.choose("new-policy");
    expect(c.store.getState().draft).toEqual(draft);
    await c.save();
    expect(api.savePolicy).toHaveBeenCalledTimes(1);
    await c.retry();
    expect(api.savePolicy.mock.calls[1]).toEqual(original);
    expect(uuidFactory).toHaveBeenCalledTimes(1);
    expect(c.store.getState().draft.id).toBe("actual-id");
    expect(c.store.getState().retryAvailable).toBe(false);
  },
);
test("M1 write callback keeps busy through known ACK and blocks concurrent public reload/edit", async () => {
  const { api } = fixture();
  const entered = hold<void>(),
    release = hold<void>();
  const c = createPolicyController(api, () => {
    entered.resolve();
    return release.promise;
  });
  c.selectProject("a");
  await c.reload();
  c.edit({ purpose: "submitted" });
  const save = c.save();
  await entered.promise;
  expect(c.store.getState().busy).toBe(true);
  expect(c.store.getState().notice).toBe("saved");
  expect(c.store.getState().retryAvailable).toBe(false);
  await c.reload();
  expect(api.readState).toHaveBeenCalledTimes(1);
  const acknowledged = structuredClone(c.store.getState().draft);
  c.edit({ purpose: "blocked" });
  expect(c.store.getState().draft).toEqual(acknowledged);
  release.resolve();
  await save;
  expect(c.store.getState().busy).toBe(false);
});
test("M1 known ACK then sync rejection stays saved, exposes reread and never retries publication", async () => {
  const { api } = fixture();
  const c = createPolicyController(api, () =>
    Promise.reject(Error("shared sync failed")),
  );
  c.selectProject("a");
  await c.reload();
  await c.save();
  expect(c.store.getState()).toMatchObject({
    busy: false,
    notice: "saved",
    needsReload: true,
    retryAvailable: false,
    error: { code: "WORKSPACE_SYNC_REQUIRED" },
  });
  await c.retry();
  expect(api.savePolicy).toHaveBeenCalledTimes(1);
  await c.reload();
  expect(c.store.getState().error).toBeUndefined();
  expect(c.store.getState().needsReload).toBe(false);
});
test("M1 superseded same-epoch callback rejection cannot overwrite a newer accepted read", async () => {
  const { api } = fixture();
  const entered = hold<void>();
  let reject!: (reason: Error) => void;
  const callback = new Promise<void>((_, r) => {
    reject = r;
  });
  const c = createPolicyController(api, () => {
    entered.resolve();
    return callback;
  });
  c.selectProject("a");
  await c.reload();
  const save = c.save();
  await entered.promise;
  // The store is publicly exposed; force an external supersession to exercise the token guard even though normal public reload is busy-blocked.
  c.store.setState({ busy: false });
  await c.reload();
  expect(c.store.getState().needsReload).toBe(false);
  reject(Error("old callback failure"));
  await save;
  expect(c.store.getState().error).toBeUndefined();
  expect(c.store.getState().needsReload).toBe(false);
});

test("I2 quarantined reread is not full resolution of unknown write", async () => {
  const { c, api, set } = fixture();
  await c.reload();
  c.edit({ purpose: "local B" });
  api.savePolicy.mockRejectedValueOnce(Error("ACK lost"));
  await c.save();
  const before = structuredClone(c.store.getState().draft);
  set({ ...state(), status: "recovery_pending" });
  await c.reload();
  expect(c.store.getState().retryAvailable).toBe(true);
  c.edit({ purpose: "blocked" });
  expect(c.store.getState().draft).toEqual(before);
  await c.retry();
  expect(api.savePolicy.mock.calls[1]).toEqual(api.savePolicy.mock.calls[0]);
});
test("I2 complete accepted reread resolves replay and permits explicit edit of the observed existing policy", async () => {
  const { api } = fixture();
  const uuids = vi
    .fn()
    .mockReturnValueOnce(uuid)
    .mockReturnValue("00000000-0000-4000-8000-000000000002");
  const c = createPolicyController(api, () => {}, uuids);
  c.selectProject("a");
  await c.reload();
  c.edit({ purpose: "local B" });
  api.savePolicy.mockRejectedValueOnce(Error("ACK lost"));
  await c.save();
  api.readPolicies.mockResolvedValueOnce({
    policies: [
      {
        id: "observed-created",
        projectId: "a",
        pathPrefix: "",
        purpose: "local B",
        forbiddenDependencies: [],
      },
    ],
    structureRevision: 2,
    fileDigest: "a".repeat(64),
    verifiedAt: "t",
    status: "ready",
  });
  await c.reload();
  expect(c.store.getState().retryAvailable).toBe(false);
  expect(c.store.getState().draft.purpose).toBe("local B");
  expect(c.store.getState().dirty).toBe(true);
  await c.retry();
  expect(api.savePolicy).toHaveBeenCalledTimes(1);
  c.choose("legacy:observed-created");
  c.edit({ purpose: "manual next edit" });
  await c.save();
  expect(api.savePolicy.mock.calls[1]?.[1].id).toBe("observed-created");
  expect(uuids).toHaveBeenCalledTimes(2);
});
test("M1 delayed sync rejection cannot publish into A→B→A current epoch", async () => {
  const { api } = fixture();
  const entered = hold<void>();
  let reject!: (reason: Error) => void;
  const pending = new Promise<void>((_, r) => {
    reject = r;
  });
  const c = createPolicyController(api, () => {
    entered.resolve();
    return pending;
  });
  c.selectProject("a");
  await c.reload();
  const saving = c.save();
  await entered.promise;
  c.selectProject("b");
  c.selectProject("a");
  await c.reload();
  c.edit({ purpose: "new local B" });
  const expected = structuredClone(c.store.getState());
  reject(Error("old sync failed"));
  await saving;
  expect(c.store.getState()).toEqual(expected);
});
test("M1 disposed write callback cannot mutate the disposed epoch", async () => {
  const { api } = fixture();
  const entered = hold<void>();
  let reject!: (reason: Error) => void;
  const pending = new Promise<void>((_, r) => {
    reject = r;
  });
  const c = createPolicyController(api, () => {
    entered.resolve();
    return pending;
  });
  c.selectProject("a");
  await c.reload();
  const saving = c.save();
  await entered.promise;
  c.dispose();
  const expected = structuredClone(c.store.getState());
  reject(Error("old disposed callback"));
  await saving;
  expect(c.store.getState()).toEqual(expected);
});
