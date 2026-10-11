import { expect, it } from "vitest";
import {
  createOwnershipSession,
  type OwnershipContext,
} from "./ownership-session.js";
import type { Operation, PlanDetail } from "@codemap/core";
const node = {
  id: "f",
  kind: "function" as const,
  name: "f",
  filePath: "src/a.ts",
};
function fixture(saveGate?: Promise<void>) {
  let context: OwnershipContext = {
    projectId: "p",
    snapshotId: "S0",
    snapshotHash: "h",
    planId: "plan",
    revision: 1,
    selectedId: "f",
    operations: [],
    title: "Plan",
    description: "",
    busy: false,
    dirty: false,
    groupSelection: false,
  };
  const requests: unknown[] = [];
  let saved: Operation[] | undefined;
  let saveResult = true;
  let nonceCount = 0;
  const app = createOwnershipSession({
    current: () => context,
    resolveSource: (id) =>
      id === "f" ? { node, snapshotId: context.snapshotId } : undefined,
    nonce: () =>
      ++nonceCount === 1 ? "local-nonce" : `local-nonce-${nonceCount}`,
    fetchScope: async (request) => {
      requests.push(request);
      return {
        snapshotId: request.snapshotId,
        path: request.path,
        kind: "folder",
        dataSource: "code",
        truncated: false,
        nodes: [
          {
            id: "file:dest/b.ts",
            kind: "file",
            name: "b.ts",
            filePath: "dest/b.ts",
          },
          { id: "folder:dest", kind: "folder", name: "dest", filePath: "dest" },
        ],
        relations: [],
      };
    },
    save: async (capture, operations) => {
      await saveGate;
      requests.push(capture);
      saved = operations;
      if (!saveResult) return undefined;
      return {
        plan: { id: "plan", projectId: "p", revision: 2, operations },
        valid: false,
        issues: [],
      } as PlanDetail;
    },
  });
  return {
    app,
    requests,
    get saved() {
      return saved;
    },
    setContext: (next: Partial<OwnershipContext>) => {
      context = { ...context, ...next };
      app.reconcile();
    },
    fail: () => {
      saveResult = false;
    },
  };
}
const target = {
  kind: "file" as const,
  path: "dest/b.ts",
  id: "file:dest/b.ts",
};
it("defaults to layout; only a captured current function can start and only tray targets can preview", async () => {
  const { app } = fixture();
  expect(app.begin("f")).toBeUndefined();
  await app.setMode("ownership");
  expect(app.begin("file:dest/b.ts")).toBeUndefined();
  expect(app.begin("f")).toBe("local-nonce");
  expect(app.choose(target, "external-nonce")).toBe(false);
  expect(app.choose({ ...target, path: "foreign/b.ts" }, "local-nonce")).toBe(
    false,
  );
  expect(app.choose(target, "local-nonce")).toBe(true);
  expect(app.store.getState()).toMatchObject({
    status: "preview",
    target,
    path: "dest/b.ts",
  });
});
it("folder preview starts without filename; full path must be explicitly completed before saving", async () => {
  const f = fixture();
  await f.app.setMode("ownership");
  f.app.begin("f");
  f.app.choose(
    { kind: "folder", path: "dest", id: "folder:dest" },
    "local-nonce",
  );
  expect(f.app.store.getState().filename).toBe("");
  expect(await f.app.confirm()).toBe(false);
  expect(f.saved).toBeUndefined();
  f.app.filename("../bad.ts");
  expect(f.app.store.getState().path).toBeUndefined();
  f.app.filename("index.ts");
  expect(f.app.store.getState().path).toBe("dest/index.ts");
  expect(await f.app.confirm()).toBe(true);
  expect(f.saved).toEqual([
    { kind: "move_function", nodeId: "f", filePath: "dest/index.ts" },
  ]);
  expect(f.requests).toContainEqual(
    expect.objectContaining({
      snapshotId: "S0",
      snapshotHash: "h",
      revision: 1,
      planId: "plan",
      projectId: "p",
    }),
  );
});
it.each([
  { revision: 2 },
  { snapshotId: "S1" },
  { snapshotHash: "new" },
  { selectedId: "other" },
  { dirty: true },
  { groupSelection: true },
])(
  "changed capture expires preview, retains filename and refuses save: %j",
  async (delta) => {
    const f = fixture();
    await f.app.setMode("ownership");
    f.app.begin("f");
    f.app.choose(
      { kind: "folder", path: "dest", id: "folder:dest" },
      "local-nonce",
    );
    f.app.filename("mine.ts");
    f.setContext(delta);
    expect(f.app.store.getState()).toMatchObject({
      status: "expired",
      filename: "mine.ts",
      path: "dest/mine.ts",
    });
    expect(await f.app.confirm()).toBe(false);
    expect(f.saved).toBeUndefined();
  },
);
it.each([{ projectId: "other" }, { planId: "other" }])(
  "project/plan switch cancels rather than retaining foreign preview: %j",
  async (delta) => {
    const f = fixture();
    await f.app.setMode("ownership");
    f.app.begin("f");
    f.app.choose(target, "local-nonce");
    f.setContext(delta);
    expect(f.app.store.getState()).toMatchObject({
      mode: "layout",
      status: "idle",
    });
    expect(await f.app.confirm()).toBe(false);
  },
);
it("cancel/layout never saves; no-op preserves revision/history and own annotations", async () => {
  const f = fixture();
  f.setContext({
    operations: [
      { kind: "annotate", targetId: "f", text: "keep" },
      { kind: "move_function", nodeId: "f", filePath: "dest/b.ts" },
    ],
  });
  await f.app.setMode("ownership");
  f.app.begin("f");
  f.app.choose(target, "local-nonce");
  expect(await f.app.confirm()).toBe(true);
  expect(f.saved).toBeUndefined();
  const fresh = f.app.begin("f");
  f.app.choose({ kind: "folder", path: "dest", id: "folder:dest" }, fresh);
  f.app.filename("c.ts");
  await f.app.setMode("layout");
  expect(f.saved).toBeUndefined();
});
it("failed save retains preview and never treats failure as accepted", async () => {
  const f = fixture();
  await f.app.setMode("ownership");
  f.app.begin("f");
  f.app.choose(target, "local-nonce");
  f.fail();
  expect(await f.app.confirm()).toBe(false);
  expect(f.app.store.getState()).toMatchObject({
    status: "error",
    path: "dest/b.ts",
  });
});

it("a late save ACK cannot clear a preview after another selection, even when selection returns to the original function", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = fixture(gate);
  await f.app.setMode("ownership");
  f.app.begin("f");
  f.app.choose(target, "local-nonce");
  const pending = f.app.confirm();
  expect(f.app.store.getState().status).toBe("saving");
  f.setContext({ selectedId: "later" });
  f.setContext({ selectedId: "f" });
  release();
  expect(await pending).toBe(false);
  expect(f.app.store.getState()).toMatchObject({
    status: "expired",
    path: "dest/b.ts",
  });
  expect(f.app.store.getState().intent?.nonce).toBe("local-nonce");
});

it.each([
  [{ selectedId: "B" }, { selectedId: "f" }],
  [{ dirty: true }, { dirty: false }],
  [{ groupSelection: true }, { groupSelection: false }],
])(
  "expired non-saving capture cannot revive after context returns: %j",
  async (away, back) => {
    const f = fixture();
    await f.app.setMode("ownership");
    const old = f.app.begin("f");
    f.app.choose({ kind: "folder", path: "dest", id: "folder:dest" }, old);
    f.app.filename("kept.ts");
    f.setContext(away);
    f.setContext(back);
    expect(f.app.store.getState().status).toBe("expired");
    expect(f.app.choose(target, old)).toBe(false);
    expect(f.app.choose(target)).toBe(false);
    expect(await f.app.confirm()).toBe(false);
    expect(f.saved).toBeUndefined();
    expect(f.app.store.getState().filename).toBe("kept.ts");
    const fresh = f.app.begin("f");
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(old);
    expect(f.app.choose(target, old)).toBe(false);
    expect(f.app.choose(target, fresh)).toBe(true);
    expect(await f.app.confirm()).toBe(true);
  },
);
it("idle S0 tray is retired across S1 verification and fresh S1 plan before a new begin", async () => {
  const f = fixture();
  await f.app.setMode("ownership");
  expect(f.app.store.getState().tray.scope?.snapshotId).toBe("S0");
  expect(f.app.store.getState().intent).toBeUndefined();
  f.setContext({ snapshotId: "S1", snapshotHash: "h1", stale: true });
  f.setContext({ planId: "fresh-plan", revision: 1, stale: false });
  expect(f.app.store.getState().tray.status).toBe("idle");
  expect(f.app.begin("f")).toBeUndefined();
  expect(f.app.choose(target)).toBe(false);
  expect(await f.app.confirm()).toBe(false);
  expect(f.saved).toBeUndefined();
  await f.app.setMode("ownership");
  expect(f.app.store.getState().tray.scope?.snapshotId).toBe("S1");
  const fresh = f.app.begin("f");
  expect(fresh).toBeTruthy();
  expect(f.app.choose(target, fresh)).toBe(true);
});
it.each([
  "requestProject",
  "requestSnapshot",
  "requestEpoch",
  "scopeSnapshot",
  "scopePath",
  "scopeKind",
])(
  "choose and confirm fail closed when current target proof disagrees: %s",
  async (kind) => {
    const f = fixture();
    await f.app.setMode("ownership");
    const nonce = f.app.begin("f");
    expect(f.app.choose(target, nonce)).toBe(true);
    const tray = structuredClone(f.app.store.getState().tray);
    if (kind === "requestProject")
      tray.request = { ...tray.request!, projectId: "foreign" };
    if (kind === "requestSnapshot")
      tray.request = { ...tray.request!, snapshotId: "other" };
    if (kind === "requestEpoch")
      tray.request = { ...tray.request!, epoch: 999 };
    if (kind === "scopeSnapshot")
      tray.scope = { ...tray.scope!, snapshotId: "other" };
    if (kind === "scopePath")
      tray.scope = { ...tray.scope!, path: "elsewhere" };
    if (kind === "scopeKind") tray.scope = { ...tray.scope!, kind: "file" };
    f.app.store.setState({ tray });
    expect(f.app.choose(target, nonce)).toBe(false);
    expect(await f.app.confirm()).toBe(false);
    expect(f.saved).toBeUndefined();
  },
);

it.each([
  { snapshotId: "S1", snapshotHash: "h1" },
  { snapshotHash: "changed" },
  { epoch: 1 },
  { projectId: "other" },
])(
  "idle scope loading is canceled before a late S0 response across authority changes: %j",
  async (delta) => {
    let context: OwnershipContext = {
      projectId: "p",
      planId: "plan",
      snapshotId: "S0",
      snapshotHash: "h",
      epoch: 0,
      revision: 1,
      operations: [],
      title: "P",
      description: "",
      selectedId: "f",
      busy: false,
      dirty: false,
      groupSelection: false,
    };
    let resolve!: (
      scope: import("./ownership-controller.js").TargetScope,
    ) => void;
    const requests: unknown[] = [];
    const app = createOwnershipSession({
      current: () => context,
      resolveSource: () => ({ node, snapshotId: context.snapshotId }),
      fetchScope: (request) => {
        requests.push(request);
        return new Promise((done) => {
          resolve = done;
        });
      },
      save: async () => {
        throw new Error("A retired target must not save");
      },
    });
    const pending = app.setMode("ownership");
    expect(app.store.getState().tray.status).toBe("loading");
    expect(app.store.getState().intent).toBeUndefined();
    context = { ...context, ...delta };
    app.reconcile();
    expect(app.store.getState().tray.status).toBe("idle");
    resolve({
      snapshotId: "S0",
      path: ".",
      kind: "folder",
      nodes: [
        { id: target.id, kind: "file", name: "b.ts", filePath: target.path },
      ],
      relations: [],
      dataSource: "code",
      truncated: false,
    });
    await pending;
    expect(app.store.getState().tray.status).toBe("idle");
    expect(app.begin("f")).toBeUndefined();
    expect(app.choose(target)).toBe(false);
    expect(await app.confirm()).toBe(false);
    expect(requests).toEqual([
      { projectId: "p", snapshotId: "S0", epoch: 0, path: ".", budget: 100 },
    ]);
  },
);
