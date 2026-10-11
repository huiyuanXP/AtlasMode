import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  DomainError,
  parseStructure,
  type StructureFilePort,
  type StoragePort,
} from "@codemap/core";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
import { StructureSync } from "@codemap/service";

const closes: (() => void)[] = [];
afterEach(() => {
  for (const close of closes.splice(0)) close();
});
const hash = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
const doc = (purpose = "old") => ({
  schemaVersion: 1,
  folders: [{ path: "src", purpose, extra: { kept: [1, null] } }],
  dependencyRules: [],
});
const text = (purpose = "old") => JSON.stringify(doc(purpose));
const oldPolicy = {
  id: "old-policy",
  projectId: "p",
  pathPrefix: "src",
  purpose: "old legacy",
  forbiddenDependencies: ["private"],
};
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "atlas-pol01-sync-"));
  await mkdir(join(root, ".codemap"));
  const path = join(root, ".codemap", "structure.json"),
    database = join(root, "state.sqlite");
  await writeFile(path, text());
  const db = new SqliteStorage(database);
  closes.push(() => db.close());
  db.put("projects", "p", { id: "p", path: root, name: "fixture" });
  const files = new StructureFileStore();
  const make = (storage: StoragePort = db, port: StructureFilePort = files) =>
    new StructureSync({
      storage,
      files: port,
      project: (id: string) => {
        if (id !== "p")
          throw new DomainError("NOT_FOUND", "Project not found.");
        return { id, path: root, name: "fixture" };
      },
      legacyPolicies: (id: string) =>
        storage
          .list<typeof oldPolicy>("policies")
          .filter((p) => p.projectId === id),
    });
  const sync = make();
  await sync.getStructure("p");
  db.put("plans", "plan", {
    id: "plan",
    projectId: "p",
    revision: 1,
    status: "approved",
    updatedAt: "old",
  });
  db.put("plans", "other", {
    id: "other",
    projectId: "other",
    revision: 1,
    status: "approved",
    updatedAt: "old",
  });
  db.put("approvals", "history", {
    id: "history",
    planId: "plan",
    revision: 1,
    immutable: { saved: true },
  });
  return { root, path, database, db, files, sync, make };
}
async function input(sync: StructureSync, purpose = "new") {
  const state = await sync.getStructure("p");
  return {
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: state.fileDigest,
    operation: {
      kind: "upsertFolder" as const,
      previousPath: "src",
      path: "src",
      purpose,
    },
  };
}

test("UI write commits matching real file state plans history and audit", async () => {
  const f = await fixture(),
    request = await input(f.sync);
  const state = await f.sync.updateStructure("p", request),
    actual = await readFile(f.path);
  expect(state.fileDigest).toBe(hash(actual));
  expect(state.document?.folders[0]).toMatchObject({
    purpose: "new",
    extra: { kept: [1, null] },
  });
  expect(f.db.get("plans", "plan")).toMatchObject({
    revision: 2,
    status: "draft",
  });
  expect(f.db.get("plans", "other")).toMatchObject({
    revision: 1,
    status: "approved",
  });
  expect(f.db.get("approvals", "history")).toEqual({
    id: "history",
    planId: "plan",
    revision: 1,
    immutable: { saved: true },
  });
  expect(
    f.sync
      .listStructureAudit("p", { offset: 0, limit: 50 })
      .items.find((a) => a.id === request.mutationId),
  ).toMatchObject({
    source: "ui",
    outcome: "committed",
    beforeDigest: hash(text()),
    attemptedAfterDigest: hash(actual),
    observedAfterDigest: hash(actual),
    observedAfterKnown: true,
    validatedAt: expect.stringMatching(/Z$/),
    committedAt: expect.stringMatching(/Z$/),
  });
});
test("same-version concurrent writes have one success and one conflict", async () => {
  const f = await fixture(),
    first = await input(f.sync, "one");
  const results = await Promise.allSettled([
    f.sync.updateStructure("p", first),
    f.sync.updateStructure("p", {
      ...first,
      mutationId: randomUUID(),
      operation: { ...first.operation, purpose: "two" },
    }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toEqual([
    expect.objectContaining({
      reason: expect.objectContaining({ code: "STRUCTURE_CONFLICT" }),
    }),
  ]);
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 2 });
});
test("mutation retry finalizes once and different payload cannot reuse id", async () => {
  const f = await fixture(),
    request = await input(f.sync);
  await f.sync.updateStructure("p", request);
  await f.sync.updateStructure("p", request);
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 2 });
  await expect(
    f.sync.updateStructure("p", {
      ...request,
      operation: { ...request.operation, purpose: "different" },
    }),
  ).rejects.toMatchObject({ code: "STRUCTURE_CONFLICT" });
});
test("external formatting changes structure version but does not invalidate plan", async () => {
  const f = await fixture(),
    before = await f.sync.getStructure("p");
  await writeFile(f.path, JSON.stringify(doc(), null, 2) + "\n");
  const after = await f.sync.getStructure("p");
  expect(after.structureRevision).toBe(before.structureRevision + 1);
  expect(f.db.get("plans", "plan")).toMatchObject({
    revision: 1,
    status: "approved",
  });
});
test("invalid repeated read and deletion never reuse a valid current context", async () => {
  const f = await fixture();
  await writeFile(f.path, "invalid");
  expect((await f.sync.getStructure("p")).status).toBe("invalid");
  await f.sync.getStructure("p");
  expect(f.db.get("plans", "plan")).toMatchObject({
    revision: 2,
    status: "draft",
  });
  await expect(
    f.sync.updateStructure("p", {
      mutationId: randomUUID(),
      expectedStructureRevision: 2,
      expectedFileDigest: hash("invalid"),
      operation: { kind: "upsertFolder", path: "src", purpose: "x" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_STRUCTURE" });
  await unlink(f.path);
  expect((await f.sync.getStructure("p")).status).toBe("missing");
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 3 });
});
test("DB-only same-id editing keeps bytes and explicit migration switches source once", async () => {
  const f = await fixture();
  f.db.put("policies", oldPolicy.id, oldPolicy);
  const initial = await f.sync.getStructure("p"),
    original = await readFile(f.path);
  const edited = await f.sync.updateStructure("p", {
    mutationId: randomUUID(),
    expectedStructureRevision: initial.structureRevision,
    expectedFileDigest: initial.fileDigest,
    operation: {
      kind: "upsertLegacyPolicy",
      id: oldPolicy.id,
      pathPrefix: "src",
      purpose: "edited legacy",
      forbiddenDependencies: ["private"],
    },
  });
  expect(Buffer.compare(await readFile(f.path), original)).toBe(0);
  expect(f.db.get("policies", oldPolicy.id)).toMatchObject({
    purpose: "edited legacy",
  });
  expect(edited.fileDigest).toBe(initial.fileDigest);
  expect(edited.structureRevision).toBe(initial.structureRevision + 1);
  await expect(
    f.sync.updateStructure("p", {
      mutationId: randomUUID(),
      expectedStructureRevision: initial.structureRevision,
      expectedFileDigest: initial.fileDigest,
      operation: { kind: "importLegacy" },
    }),
  ).rejects.toMatchObject({ code: "STRUCTURE_CONFLICT" });
  const migrated = await f.sync.updateStructure("p", {
    mutationId: randomUUID(),
    expectedStructureRevision: edited.structureRevision,
    expectedFileDigest: edited.fileDigest,
    operation: { kind: "importLegacy" },
  });
  expect(f.db.get("policies", oldPolicy.id)).toBeUndefined();
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 3 });
  await f.sync.updateStructure("p", {
    mutationId: randomUUID(),
    expectedStructureRevision: migrated.structureRevision,
    expectedFileDigest: migrated.fileDigest,
    operation: {
      kind: "upsertLegacyPolicy",
      id: oldPolicy.id,
      pathPrefix: "src",
      purpose: "file edit",
      forbiddenDependencies: ["private"],
    },
  });
  f.db.close();
  const reopened = new SqliteStorage(f.database);
  closes.push(() => reopened.close());
  const restored = f.make(reopened);
  expect((await restored.getStructure("p")).status).toBe("ready");
  expect(
    restored.policies("p").find((p) => p.id === oldPolicy.id),
  ).toMatchObject({ purpose: "file edit" });
});
test("equal extension migration changes only source and approval, not file", async () => {
  const f = await fixture();
  const portable = {
    id: oldPolicy.id,
    pathPrefix: oldPolicy.pathPrefix,
    purpose: oldPolicy.purpose,
    forbiddenDependencies: oldPolicy.forbiddenDependencies,
  };
  await writeFile(
    f.path,
    JSON.stringify({
      ...doc(),
      "x-atlasmode": { schemaVersion: 1, legacyPathPolicies: [portable] },
    }),
  );
  f.db.put("policies", oldPolicy.id, oldPolicy);
  const state = await f.sync.getStructure("p"),
    original = await readFile(f.path);
  const before = f.db.get<{ revision: number }>("plans", "plan")!.revision;
  await f.sync.updateStructure("p", {
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: state.fileDigest,
    operation: { kind: "importLegacy" },
  });
  expect(Buffer.compare(await readFile(f.path), original)).toBe(0);
  expect(f.db.get("policies", oldPolicy.id)).toBeUndefined();
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: before + 1 });
});
test("rename then database failure recovers on a new SQLite instance only once", async () => {
  const f = await fixture();
  let fault = true;
  const storage = new Proxy(f.db, {
    get(target, key) {
      if (key === "put")
        return (kind: string, id: string, value: unknown) => {
          if (fault && kind === "settings" && id.startsWith("structure:state:"))
            throw new Error("injected-finalize");
          return target.put(kind as "settings", id, value);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const request = await input(f.sync),
    sync = f.make(storage);
  await expect(sync.updateStructure("p", request)).rejects.toMatchObject({
    code: "STRUCTURE_RECOVERY_PENDING",
  });
  expect(
    JSON.parse((await readFile(f.path)).toString()).folders[0].purpose,
  ).toBe("new");
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 1 });
  fault = false;
  f.db.close();
  const reopened = new SqliteStorage(f.database);
  closes.push(() => reopened.close());
  const restored = f.make(reopened);
  expect(await restored.recoverStructureWrites()).toMatchObject({
    recoveredProjectIds: ["p"],
    blockedProjectIds: [],
  });
  await restored.recoverStructureWrites();
  expect(reopened.get("plans", "plan")).toMatchObject({ revision: 2 });
});
test("prepublication failure preserves original file and migration DB records", async () => {
  const f = await fixture();
  f.db.put("policies", oldPolicy.id, oldPolicy);
  const before = await f.sync.getStructure("p");
  const files: StructureFilePort = {
    read: (root) => f.files.read(root),
    publish: async () => ({
      phase: "not_published",
      actualDigest: before.fileDigest,
      errorCode: "STRUCTURE_WRITE_FAILED",
    }),
  };
  const sync = f.make(f.db, files);
  await expect(
    sync.updateStructure("p", {
      mutationId: randomUUID(),
      expectedStructureRevision: before.structureRevision,
      expectedFileDigest: before.fileDigest,
      operation: { kind: "importLegacy" },
    }),
  ).rejects.toMatchObject({ code: "STRUCTURE_WRITE_FAILED" });
  expect(await readFile(f.path, "utf8")).toBe(text());
  expect(f.db.get("policies", oldPolicy.id)).toEqual(oldPolicy);
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 1 });
});
test("failed audit distinguishes attempted B from external observed C", async () => {
  const f = await fixture(),
    request = await input(f.sync, "candidate B");
  const files: StructureFilePort = {
    read: (root) => f.files.read(root),
    publish: async (_root, _candidate) => {
      await writeFile(f.path, text("external C"));
      return {
        phase: "not_published",
        actualDigest: hash(text("external C")),
        errorCode: "STRUCTURE_CONFLICT",
      };
    },
  };
  const sync = f.make(f.db, files);
  await expect(sync.updateStructure("p", request)).rejects.toMatchObject({
    code: "STRUCTURE_CONFLICT",
  });
  const audit = sync
    .listStructureAudit("p", { offset: 0, limit: 50 })
    .items.find((a) => a.id === request.mutationId)!;
  expect(audit.beforeDigest).toBe(hash(text()));
  expect(audit.attemptedAfterDigest).not.toBe(audit.beforeDigest);
  expect(audit.attemptedAfterDigest).not.toBe(hash(text("external C")));
  expect(audit.observedAfterDigest).toBe(hash(text("external C")));
  expect(audit.committedAt).toBeUndefined();
});
test("third-digest recovery retains external bytes until explicit refresh", async () => {
  const f = await fixture(),
    request = await input(f.sync, "B");
  const files: StructureFilePort = {
    read: (root) => f.files.read(root),
    publish: async () => {
      await writeFile(f.path, text("C"));
      return {
        phase: "uncertain",
        actualDigest: hash(text("C")),
        errorCode: "STRUCTURE_CONFLICT",
      };
    },
  };
  const sync = f.make(f.db, files);
  await expect(sync.updateStructure("p", request)).rejects.toMatchObject({
    code: "STRUCTURE_RECOVERY_PENDING",
  });
  expect(await sync.recoverStructureWrites()).toMatchObject({
    blockedProjectIds: ["p"],
  });
  expect((await sync.getStructure("p")).status).toBe("conflict");
  expect(await readFile(f.path, "utf8")).toBe(text("C"));
  expect(
    (await sync.getStructure("p", { acceptExternalConflict: true })).status,
  ).toBe("ready");
  expect(await readFile(f.path, "utf8")).toBe(text("C"));
});
test.each(["prepared", "published"])(
  "queue scope blocks an approved read during %s publication",
  async (phase) => {
    const f = await fixture(),
      entered = gate(),
      release = gate();
    const files: StructureFilePort = {
      read: (root) => f.files.read(root),
      publish: async (root, request) => {
        if (phase === "prepared") {
          entered.resolve();
          await release.promise;
        }
        const result = await f.files.publish(root, request);
        if (phase === "published") {
          entered.resolve();
          await release.promise;
        }
        return result;
      },
    };
    const sync = f.make(f.db, files),
      request = await input(f.sync);
    const publishing = sync.updateStructure("p", request);
    void publishing.catch(() => entered.resolve());
    await entered.promise;
    let settled = false;
    const approval = sync.withProject("p", async (session) => {
      await session.readStructure();
      const plan = f.db.get<{ revision: number }>("plans", "plan")!;
      if (plan.revision !== 1)
        throw new DomainError("REVISION_CONFLICT", "Revision changed.");
      f.db.put("approvals", "should-not-exist", { revision: 1 });
    });
    void approval.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(f.db.get("approvals", "should-not-exist")).toBeUndefined();
    release.resolve();
    await publishing;
    await expect(approval).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(f.db.get("approvals", "should-not-exist")).toBeUndefined();
  },
);

test("zero-record migration does not create a missing file or change revisions", async () => {
  const f = await fixture();
  await unlink(f.path);
  const state = await f.sync.getStructure("p"),
    revision = f.db.get<{ revision: number }>("plans", "plan")!.revision;
  const result = await f.sync.updateStructure("p", {
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: null,
    operation: { kind: "importLegacy" },
  });
  expect(result.structureRevision).toBe(state.structureRevision);
  expect((await f.files.read(f.root)).digest).toBeNull();
  expect(f.db.get("plans", "plan")).toMatchObject({ revision });
});
test("equivalent migrated legacy editing preserves unknown values and original bytes", async () => {
  const f = await fixture();
  await writeFile(
    f.path,
    JSON.stringify({
      ...doc(),
      "x-atlasmode": {
        schemaVersion: 1,
        legacyPathPolicies: [
          {
            id: oldPolicy.id,
            pathPrefix: "src/",
            purpose: oldPolicy.purpose,
            forbiddenDependencies: ["z/", "private", "z"],
            retained: [3, 1],
          },
        ],
      },
    }),
  );
  const state = await f.sync.getStructure("p"),
    before = await readFile(f.path),
    revision = f.db.get<{ revision: number }>("plans", "plan")!.revision;
  const result = await f.sync.updateStructure("p", {
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: state.fileDigest,
    operation: {
      kind: "upsertLegacyPolicy",
      id: oldPolicy.id,
      pathPrefix: "src",
      purpose: oldPolicy.purpose,
      forbiddenDependencies: ["private", "z"],
    },
  });
  expect(Buffer.compare(await readFile(f.path), before)).toBe(0);
  expect(result.structureRevision).toBe(state.structureRevision);
  expect(f.db.get("plans", "plan")).toMatchObject({ revision });
});
test("prepared interruption aborts before-digest recovery without replay or deleting legacy", async () => {
  const f = await fixture();
  f.db.put("policies", oldPolicy.id, oldPolicy);
  const state = await f.sync.getStructure("p");
  const files: StructureFilePort = {
    read: (root) => f.files.read(root),
    publish: async () => {
      throw new Error("interrupted-before-rename");
    },
  };
  const sync = f.make(f.db, files),
    id = randomUUID();
  await expect(
    sync.updateStructure("p", {
      mutationId: id,
      expectedStructureRevision: state.structureRevision,
      expectedFileDigest: state.fileDigest,
      operation: { kind: "importLegacy" },
    }),
  ).rejects.toMatchObject({ code: "STRUCTURE_RECOVERY_PENDING" });
  f.db.close();
  const reopened = new SqliteStorage(f.database);
  closes.push(() => reopened.close());
  const restored = f.make(reopened);
  expect(await restored.recoverStructureWrites()).toMatchObject({
    recoveredProjectIds: ["p"],
    blockedProjectIds: [],
  });
  expect(await readFile(f.path, "utf8")).toBe(text());
  expect(reopened.get("policies", oldPolicy.id)).toEqual(oldPolicy);
  expect(reopened.get("plans", "plan")).toMatchObject({ revision: 1 });
  expect(
    restored
      .listStructureAudit("p", { offset: 0, limit: 50 })
      .items.find((a) => a.id === id),
  ).toMatchObject({
    outcome: "aborted",
    observedAfterDigest: state.fileDigest,
    recoveredAt: expect.any(String),
  });
});
test("unrecoverable finalize blocks fresh approval context and migration deletion until atomic recovery", async () => {
  const f = await fixture();
  f.db.put("policies", oldPolicy.id, oldPolicy);
  f.db.put("policies", "unrelated", {
    ...oldPolicy,
    id: "unrelated",
    projectId: "other",
  });
  const state = await f.sync.getStructure("p");
  let fault = true;
  const storage = new Proxy(f.db, {
    get(target, key) {
      if (key === "put")
        return (kind: string, id: string, value: unknown) => {
          if (fault && kind === "settings" && id.startsWith("structure:state:"))
            throw new Error("injected-finalize");
          return target.put(kind as "settings", id, value);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const sync = f.make(storage);
  await expect(
    sync.updateStructure("p", {
      mutationId: randomUUID(),
      expectedStructureRevision: state.structureRevision,
      expectedFileDigest: state.fileDigest,
      operation: { kind: "importLegacy" },
    }),
  ).rejects.toMatchObject({ code: "STRUCTURE_RECOVERY_PENDING" });
  expect(f.db.get("policies", oldPolicy.id)).toEqual(oldPolicy);
  expect((await sync.getStructure("p")).status).toBe("recovery_pending");
  await expect(
    sync.withProject("p", async (session) => {
      await session.readStructure();
    }),
  ).rejects.toMatchObject({ code: "STRUCTURE_RECOVERY_PENDING" });
  fault = false;
  expect(await sync.recoverStructureWrites()).toMatchObject({
    recoveredProjectIds: ["p"],
    blockedProjectIds: [],
  });
  expect(f.db.get("policies", oldPolicy.id)).toBeUndefined();
  expect(f.db.get("policies", "unrelated")).toMatchObject({
    projectId: "other",
  });
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 2 });
  expect(f.db.get("approvals", "history")).toMatchObject({
    revision: 1,
    immutable: { saved: true },
  });
  await sync.recoverStructureWrites();
  expect(f.db.get("plans", "plan")).toMatchObject({ revision: 2 });
});

test("external same-id disagreement is an explicit blocked state with no current projection", async () => {
  const f = await fixture();
  f.db.put("policies", oldPolicy.id, oldPolicy);
  await writeFile(
    f.path,
    JSON.stringify({
      ...doc(),
      "x-atlasmode": {
        schemaVersion: 1,
        legacyPathPolicies: [
          {
            id: oldPolicy.id,
            pathPrefix: "src",
            purpose: "conflicting",
            forbiddenDependencies: ["private"],
          },
        ],
      },
    }),
  );
  const state = await f.sync.getStructure("p");
  expect(state.status).toBe("conflict");
  expect(state.document).toBeUndefined();
  expect(() => f.sync.policies("p")).toThrow(
    expect.objectContaining({ code: "STRUCTURE_CONFLICT" }),
  );
  expect(f.db.get("policies", oldPolicy.id)).toEqual(oldPolicy);
});
test("equal extension migration rechecks actual disk before switching DB source", async () => {
  const f = await fixture();
  const portable = {
    id: oldPolicy.id,
    pathPrefix: oldPolicy.pathPrefix,
    purpose: oldPolicy.purpose,
    forbiddenDependencies: oldPolicy.forbiddenDependencies,
  };
  await writeFile(
    f.path,
    JSON.stringify({
      ...doc(),
      "x-atlasmode": { schemaVersion: 1, legacyPathPolicies: [portable] },
    }),
  );
  f.db.put("policies", oldPolicy.id, oldPolicy);
  const state = await f.sync.getStructure("p");
  let reads = 0;
  const files: StructureFilePort = {
    read: async (root) => {
      if (++reads === 2) await writeFile(f.path, text("external C"));
      return f.files.read(root);
    },
    publish: (root, request) => f.files.publish(root, request),
  };
  const sync = f.make(f.db, files);
  await expect(
    sync.updateStructure("p", {
      mutationId: randomUUID(),
      expectedStructureRevision: state.structureRevision,
      expectedFileDigest: state.fileDigest,
      operation: { kind: "importLegacy" },
    }),
  ).rejects.toMatchObject({ code: "STRUCTURE_CONFLICT" });
  expect(f.db.get("policies", oldPolicy.id)).toEqual(oldPolicy);
  expect(await readFile(f.path, "utf8")).toBe(text("external C"));
});

test("roundtrips the repository actual v1 document", async () => {
  const text = await readFile(
    new URL("../../../.codemap/structure.json", import.meta.url),
    "utf8",
  );
  expect(parseStructure(JSON.stringify(parseStructure(text)))).toEqual(
    JSON.parse(text),
  );
});

test.each(["before", "after"])(
  "direct mutation retry respects recovered %s-digest terminal outcome",
  async (disk) => {
    const f = await fixture(),
      request = await input(f.sync);
    let publications = 0;
    const files: StructureFilePort = {
      read: (root) => f.files.read(root),
      publish: async (root, value) => {
        publications++;
        if (publications === 1) {
          if (disk === "after") await f.files.publish(root, value);
          throw new Error("interrupted-publication");
        }
        return f.files.publish(root, value);
      },
    };
    const sync = f.make(f.db, files);
    await expect(sync.updateStructure("p", request)).rejects.toMatchObject({
      code: "STRUCTURE_RECOVERY_PENDING",
    });
    if (disk === "after") {
      const result = await sync.updateStructure("p", request);
      expect(result.document?.folders[0]?.purpose).toBe("new");
      await sync.updateStructure("p", request);
      expect(f.db.get("plans", "plan")).toMatchObject({ revision: 2 });
    } else {
      await expect(sync.updateStructure("p", request)).rejects.toMatchObject({
        code: "STRUCTURE_CONFLICT",
      });
      await expect(sync.updateStructure("p", request)).rejects.toMatchObject({
        code: "STRUCTURE_CONFLICT",
      });
      expect(await readFile(f.path, "utf8")).toBe(text());
      expect(f.db.get("plans", "plan")).toMatchObject({ revision: 1 });
    }
    expect(publications).toBe(1);
    const audit = sync
      .listStructureAudit("p", { offset: 0, limit: 50 })
      .items.find((a) => a.id === request.mutationId)!;
    expect(audit).toMatchObject({
      outcome: disk === "after" ? "committed" : "aborted",
      recoveredAt: expect.any(String),
      observedAfterKnown: true,
    });
    await expect(
      sync.updateStructure("p", {
        ...request,
        operation: { ...request.operation, purpose: "different payload" },
      }),
    ).rejects.toMatchObject({ code: "STRUCTURE_CONFLICT" });
    expect(
      sync
        .listStructureAudit("p", { offset: 0, limit: 50 })
        .items.find((a) => a.id === request.mutationId),
    ).toEqual(audit);
    expect(publications).toBe(1);
    expect(f.db.get("approvals", "history")).toMatchObject({
      revision: 1,
      immutable: { saved: true },
    });
  },
);

test.each(["before", "after", "third"])(
  "transient unknown disk read stays pending then recovers actual %s digest",
  async (disk) => {
    const f = await fixture(),
      request = await input(f.sync);
    let unreadable = false;
    const files: StructureFilePort = {
      read: (root) => {
        if (unreadable) throw new Error("transient-read-io-failure");
        return f.files.read(root);
      },
      publish: async (root, value) => {
        if (disk === "after") await f.files.publish(root, value);
        if (disk === "third") await writeFile(f.path, text("external C"));
        unreadable = true;
        throw new Error("interrupted-publication");
      },
    };
    const sync = f.make(f.db, files);
    await expect(sync.updateStructure("p", request)).rejects.toMatchObject({
      code: "STRUCTURE_RECOVERY_PENDING",
    });
    expect(await sync.recoverStructureWrites()).toMatchObject({
      recoveredProjectIds: [],
      blockedProjectIds: ["p"],
    });
    expect((await sync.getStructure("p")).status).toBe("recovery_pending");
    await expect(
      sync.withProject("p", async (session) => {
        await session.readStructure();
        f.db.put("approvals", "unknown-disk", {});
      }),
    ).rejects.toMatchObject({ code: "STRUCTURE_RECOVERY_PENDING" });
    expect(f.db.get("approvals", "unknown-disk")).toBeUndefined();
    expect(
      sync
        .listStructureAudit("p", { offset: 0, limit: 50 })
        .items.find((a) => a.id === request.mutationId),
    ).toBeUndefined();
    unreadable = false;
    expect(await sync.recoverStructureWrites()).toMatchObject(
      disk === "third"
        ? { recoveredProjectIds: [], blockedProjectIds: ["p"] }
        : { recoveredProjectIds: ["p"], blockedProjectIds: [] },
    );
    const audit = sync
      .listStructureAudit("p", { offset: 0, limit: 50 })
      .items.find((a) => a.id === request.mutationId)!;
    expect(audit).toMatchObject({
      outcome:
        disk === "before"
          ? "aborted"
          : disk === "after"
            ? "committed"
            : "conflicted",
      observedAfterKnown: true,
    });
    expect(audit.observedAfterDigest).toBe(hash(await readFile(f.path)));
    expect(f.db.get("plans", "plan")).toMatchObject({
      revision: disk === "after" ? 2 : 1,
    });
    if (disk === "third")
      expect((await sync.getStructure("p")).status).toBe("conflict");
    await sync.recoverStructureWrites();
    expect(f.db.get("plans", "plan")).toMatchObject({
      revision: disk === "after" ? 2 : 1,
    });
  },
);

test.each(["folder", "db_legacy", "file_legacy", "empty_migration"])(
  "%s no-op persists idempotent receipt without publication audit",
  async (kind) => {
    const f = await fixture();
    if (kind === "db_legacy") f.db.put("policies", oldPolicy.id, oldPolicy);
    if (kind === "file_legacy") {
      await writeFile(
        f.path,
        JSON.stringify({
          ...doc(),
          "x-atlasmode": {
            schemaVersion: 1,
            legacyPathPolicies: [
              {
                id: oldPolicy.id,
                pathPrefix: oldPolicy.pathPrefix,
                purpose: oldPolicy.purpose,
                forbiddenDependencies: oldPolicy.forbiddenDependencies,
              },
            ],
          },
        }),
      );
    }
    const state = await f.sync.getStructure("p"),
      before = await readFile(f.path),
      revision = f.db.get<{ revision: number }>("plans", "plan")!.revision;
    let publications = 0;
    const files: StructureFilePort = {
      read: (root) => f.files.read(root),
      publish: async (root, request) => {
        publications++;
        return f.files.publish(root, request);
      },
    };
    const sync = f.make(f.db, files);
    const request = {
      mutationId: randomUUID(),
      expectedStructureRevision: state.structureRevision,
      expectedFileDigest: state.fileDigest,
      operation:
        kind === "empty_migration"
          ? { kind: "importLegacy" as const }
          : kind === "folder"
            ? {
                kind: "upsertFolder" as const,
                previousPath: "src",
                path: "src",
                purpose: "old",
              }
            : {
                kind: "upsertLegacyPolicy" as const,
                id: oldPolicy.id,
                pathPrefix: oldPolicy.pathPrefix,
                purpose: oldPolicy.purpose,
                forbiddenDependencies: oldPolicy.forbiddenDependencies,
              },
    };
    await sync.updateStructure("p", request);
    const restarted = f.make(f.db, files);
    const retried = await restarted.updateStructure("p", request);
    expect(retried.structureRevision).toBe(state.structureRevision);
    await expect(
      restarted.updateStructure("p", {
        ...request,
        operation: {
          kind: "upsertFolder",
          previousPath: "src",
          path: "src",
          purpose: "different payload",
        },
      }),
    ).rejects.toMatchObject({ code: "STRUCTURE_CONFLICT" });
    expect(publications).toBe(0);
    expect(Buffer.compare(await readFile(f.path), before)).toBe(0);
    expect(f.db.get("plans", "plan")).toMatchObject({ revision });
    expect(
      sync
        .listStructureAudit("p", { offset: 0, limit: 50 })
        .items.find((a) => a.id === request.mutationId),
    ).toBeUndefined();
  },
);
