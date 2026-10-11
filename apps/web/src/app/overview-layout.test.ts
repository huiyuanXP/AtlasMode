import { afterEach, expect, it, vi } from "vitest";
import type { PlanDetail } from "@codemap/core";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
import { layoutProjectFacts } from "../features/graph/overview-layout.js";
import type { WorkerPort } from "../features/graph/overview-layout-controller.js";

afterEach(() => vi.useRealTimers());
const target = {
  projectId: "a",
  snapshotId: "s-a",
  contentHash: "a",
  scope: "project_indexed_facts" as const,
  status: "ready" as const,
  complete: true as const,
  nodes: [{ id: "f", kind: "function" as const }],
  relations: [],
  counts: {
    nodes: 1,
    relations: 0,
    byKind: { function: 1, file: 0, folder: 0, external: 0 },
  },
  limits: {
    nodes: 5000 as const,
    relations: 20000 as const,
    bytes: 8388608 as const,
  },
};
function setup(
  options: {
    delayed?: boolean;
    failSave?: boolean;
    unsupported?: boolean;
    wrongHash?: boolean;
    rejectTarget?: boolean;
    holdSave?: boolean;
  } = {},
) {
  const writes: unknown[] = [],
    requests: string[] = [];
  const listeners = new Map<string, (event: { data?: unknown }) => void>();
  let message:
    | { token: unknown; input: Parameters<typeof layoutProjectFacts>[0] }
    | undefined;
  let resolveSave: ((response: Response) => void) | undefined;
  let terminated = 0,
    resolveTarget: ((response: Response) => void) | undefined;
  const worker: WorkerPort = {
    postMessage(value) {
      message = value as typeof message;
    },
    terminate() {
      terminated++;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener as (event: { data?: unknown }) => void);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    requests.push(path);
    const id = path.split("/")[3] ?? "a";
    let data: unknown = [];
    if (path.endsWith("/summary"))
      data = {
        project: { id, name: id, path: `/${id}` },
        snapshotId: `s-${id}`,
        contentHash: id,
        entrypoints: [{ id: "f", kind: "function", name: "f" }],
      };
    if (path.endsWith("/subgraph"))
      data = {
        snapshotId: `s-${id}`,
        nodes: [{ id: "f", kind: "function", name: "f" }],
        relations: [],
        dataSource: "code",
        truncated: false,
      };
    if (path.endsWith("/view")) {
      data = {
        positions: {
          "off:opaque": { x: 81, y: 91 },
          "fact:hidden": { x: 11, y: 12 },
        },
        theme: "light",
        locale: "zh",
      };
      if (init?.method === "PUT") {
        writes.push(JSON.parse(String(init.body)));
        if (options.holdSave)
          return new Promise<Response>((resolve) => {
            resolveSave = resolve;
          });
        if (options.failSave)
          return new Response(
            JSON.stringify({ code: "HTTP_ERROR", message: "save failed" }),
            { status: 500 },
          );
        data = JSON.parse(String(init.body));
      }
    }
    if (path.endsWith("/scope")) {
      const body = JSON.parse(String(init?.body));
      data = {
        snapshotId: body.snapshotId,
        path: body.path,
        kind: "folder",
        nodes: [],
        relations: [],
        dataSource: "code",
        truncated: false,
      };
    }
    if (path.endsWith("/layout-target")) {
      if (options.delayed)
        return new Promise<Response>((resolve) => {
          resolveTarget = resolve;
        });
      data = options.rejectTarget
        ? {
            projectId: id,
            snapshotId: `s-${id}`,
            contentHash: id,
            scope: "project_indexed_facts",
            status: "rejected",
            reason: "node_budget",
            counts: {
              nodes: 5001,
              relations: 0,
              byKind: { function: 5001, file: 0, folder: 0, external: 0 },
            },
            limits: target.limits,
          }
        : {
            ...target,
            projectId: id,
            snapshotId: `s-${id}`,
            contentHash: options.wrongHash ? "other" : id,
          };
    }
    return new Response(JSON.stringify(data), { status: 200 });
  }) as typeof fetch;
  const app = createWorkspace(new HttpApi(transport), undefined, {
    createWorker: () => (options.unsupported ? undefined : worker),
  });
  const deliver = () => {
    if (!message) throw new Error("worker not requested");
    const old = listeners.get("message");
    old?.({
      data: {
        token: message.token,
        result: layoutProjectFacts(message.input),
        computeMilliseconds: 1,
      },
    });
  };
  return {
    app,
    writes,
    requests,
    deliver,
    listeners,
    finishSave: () => {
      resolveSave!(
        new Response(
          JSON.stringify({ positions: {}, theme: "light", locale: "zh" }),
        ),
      );
    },
    allowSaves: () => {
      options.failSave = false;
    },
    getMessage: () => message,
    terminated: () => terminated,
    resolveTarget: () => resolveTarget,
  };
}
async function open(f: ReturnType<typeof setup>) {
  await f.app.selectProject({ id: "a", name: "a", path: "/a" });
  await Promise.resolve();
  await Promise.resolve();
}
it("default complete target uses worker but never persists derived positions or edits a plan", async () => {
  const f = setup();
  await open(f);
  await expect.poll(() => f.getMessage()).toBeDefined();
  f.deliver();
  expect(f.app.store.getState().overviewLayout.status).toBe("ready");
  expect(f.app.store.getState().view.positions).toEqual({
    "off:opaque": { x: 81, y: 91 },
    "fact:hidden": { x: 11, y: 12 },
  });
  expect(f.writes).toEqual([]);
  expect(
    f.requests.some((p) => p.includes("/plans/") || p.endsWith("/approve")),
  ).toBe(false);
  f.app.disposeOverview();
});
it("captured patch merges current view preserving hidden canonical and opaque positions; stale theme patch is refused", async () => {
  const f = setup();
  await open(f);
  const capture = f.app.captureLayout()!;
  f.app.saveView({ ...f.app.store.getState().view, theme: "dark" });
  expect(
    f.app.saveLayoutPositions({ "fact:f": { x: 30, y: 40 } }, capture),
  ).toBe(false);
  expect(f.app.store.getState().view.theme).toBe("dark");
  expect(
    f.app.saveLayoutPositions(
      { "group-member:g:f": { x: 50, y: 60 } },
      f.app.captureLayout()!,
    ),
  ).toBe(true);
  expect(f.app.store.getState().view).toMatchObject({
    theme: "dark",
    positions: {
      "group-member:g:f": { x: 50, y: 60 },
      "off:opaque": { x: 81, y: 91 },
      "fact:hidden": { x: 11, y: 12 },
    },
  });
  f.app.disposeOverview();
});
it.each(["filter", "groups", "plan", "graph", "navigationLocation"] as const)(
  "%s changes cancel a late global result and reject captured visible save",
  async (key) => {
    const f = setup();
    await open(f);
    await expect.poll(() => f.getMessage()).toBeDefined();
    const late = f.listeners.get("message")!;
    const message = f.getMessage()!;
    const capture = f.app.captureLayout()!;
    const changes = {
      filter: "fact",
      groups: [],
      plan: undefined,
      graph: { ...f.app.store.getState().graph },
      navigationLocation: { path: "new", kind: "folder" },
    };
    // New identity is a new scope even when semantic plan/group data happens to be empty.
    f.app.store.setState({
      [key]:
        key === "plan"
          ? { plan: { id: "p", revision: 1, operations: [] } }
          : changes[key],
    } as never);
    late({
      data: {
        token: message.token,
        result: layoutProjectFacts(message.input),
        computeMilliseconds: 1,
      },
    });
    expect(f.terminated()).toBeGreaterThan(0);
    expect(f.app.store.getState().overviewLayout.status).not.toBe("ready");
    expect(
      f.app.saveLayoutPositions({ "fact:f": { x: 5, y: 6 } }, capture),
    ).toBe(false);
    f.app.disposeOverview();
  },
);
it("A to B invalidates pending transport and a late A target cannot start a B worker", async () => {
  const f = setup({ delayed: true });
  await open(f);
  await expect.poll(() => f.resolveTarget()).toBeDefined();
  const oldResolve = f.resolveTarget()!;
  await f.app.selectProject({ id: "b", name: "b", path: "/b" });
  oldResolve(new Response(JSON.stringify(target)));
  await Promise.resolve();
  await Promise.resolve();
  expect(f.getMessage()).toBeUndefined();
  expect(f.app.store.getState().project?.id).toBe("b");
  f.app.disposeOverview();
});
it("failed view save keeps local positions and retry never adopts a stale server view", async () => {
  vi.useFakeTimers();
  const f = setup({ failSave: true });
  await open(f);
  expect(
    f.app.saveLayoutPositions(
      { "fact:f": { x: 9, y: 10 } },
      f.app.captureLayout()!,
    ),
  ).toBe(true);
  await vi.advanceTimersByTimeAsync(250);
  expect(f.app.store.getState().view.positions["fact:f"]).toEqual({
    x: 9,
    y: 10,
  });
  expect(f.app.store.getState().viewUnsaved).toBe(true);
  expect(f.app.store.getState().error).toContain("save failed");
  f.allowSaves();
  f.app.saveView(f.app.store.getState().view);
  await vi.advanceTimersByTimeAsync(250);
  expect(f.app.store.getState().viewUnsaved).toBe(false);
  expect(f.app.store.getState().view.positions["fact:f"]).toEqual({
    x: 9,
    y: 10,
  });
  f.app.disposeOverview();
});

it.each([
  [{ unsupported: true }, "failed", "unsupported"],
  [{ wrongHash: true }, "failed", "invalid_target"],
  [{ rejectTarget: true }, "rejected", "node_budget"],
] as const)(
  "target or Worker refusal leaves saved local view untouched: %j",
  async (options, status, reason) => {
    const f = setup(options);
    await open(f);
    await expect
      .poll(() => f.app.store.getState().overviewLayout.status)
      .toBe(status);
    expect(f.app.store.getState().overviewLayout.reason).toBe(reason);
    expect(f.app.store.getState().view.positions["off:opaque"]).toEqual({
      x: 81,
      y: 91,
    });
    expect(f.writes).toEqual([]);
    expect(f.getMessage()).toBeUndefined();
    f.app.disposeOverview();
  },
);
it("snapshot and content hash replacement terminates an in-flight worker and drops its old reply", async () => {
  const f = setup();
  await open(f);
  await expect.poll(() => f.getMessage()).toBeDefined();
  const late = f.listeners.get("message")!,
    message = f.getMessage()!,
    capture = f.app.captureLayout()!;
  f.app.store.setState({
    summary: {
      ...f.app.store.getState().summary!,
      snapshotId: "s-new",
      contentHash: "new",
    },
  });
  late({
    data: {
      token: message.token,
      result: layoutProjectFacts(message.input),
      computeMilliseconds: 1,
    },
  });
  expect(f.app.store.getState().overviewLayout.status).not.toBe("ready");
  expect(f.app.saveLayoutPositions({ "fact:f": { x: 7, y: 8 } }, capture)).toBe(
    false,
  );
  expect(f.terminated()).toBeGreaterThan(0);
  f.app.disposeOverview();
});

it("queued A view write cannot cross an A to B to A selection epoch", async () => {
  vi.useFakeTimers();
  const f = setup({ holdSave: true });
  await open(f);
  f.app.saveLayoutPositions(
    { "fact:f": { x: 1, y: 2 } },
    f.app.captureLayout()!,
  );
  await vi.advanceTimersByTimeAsync(250);
  f.app.saveLayoutPositions(
    { "fact:f": { x: 3, y: 4 } },
    f.app.captureLayout()!,
  );
  await vi.advanceTimersByTimeAsync(250);
  expect(f.writes).toHaveLength(1);
  await f.app.selectProject({ id: "b", name: "b", path: "/b" });
  await f.app.selectProject({ id: "a", name: "a", path: "/a" });
  f.finishSave();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.writes).toHaveLength(1);
  expect(f.app.store.getState().view.positions["fact:f"]).toBeUndefined();
  f.app.disposeOverview();
});

it("auto cache retains at most the two most recently completed projects and recompute ignores retained", async () => {
  const f = setup();
  await open(f);
  await expect.poll(() => f.getMessage()).toBeDefined();
  f.deliver();
  for (const id of ["b", "c"]) {
    await f.app.selectProject({ id, name: id, path: `/${id}` });
    await expect
      .poll(() => f.getMessage()?.token)
      .toMatchObject({ projectId: id });
    f.deliver();
  }
  await f.app.selectProject({ id: "b", name: "b", path: "/b" });
  await expect
    .poll(() => f.getMessage()?.token)
    .toMatchObject({ projectId: "b" });
  expect(f.getMessage()!.input.retained.f).toBeDefined();
  f.deliver();
  await f.app.recomputeProjectLayout();
  expect(f.getMessage()!.input.retained).toEqual({});
  f.deliver();
  await f.app.selectProject({ id: "a", name: "a", path: "/a" });
  await expect
    .poll(() => f.getMessage()?.token)
    .toMatchObject({ projectId: "a" });
  expect(f.getMessage()!.input.retained).toEqual({});
  f.app.disposeOverview();
});
it("disposing releases the active worker and late output cannot restore ready state", async () => {
  const f = setup();
  await open(f);
  await expect.poll(() => f.getMessage()).toBeDefined();
  const late = f.listeners.get("message")!,
    message = f.getMessage()!;
  f.app.disposeOverview();
  late({
    data: {
      token: message.token,
      result: layoutProjectFacts(message.input),
      computeMilliseconds: 1,
    },
  });
  expect(f.terminated()).toBe(1);
  expect(f.listeners.size).toBe(0);
  expect(f.app.store.getState().overviewLayout.status).not.toBe("ready");
});

for (const block of [
  "busy",
  "dirty",
  "draft",
  "ownership",
  "preview",
] as const) {
  it(`late ${block} veto refuses authoritative capture and explicit layout save`, async () => {
    const f = setup();
    await open(f);
    const capture = f.app.captureLayout()!;
    expect(capture).toBeDefined();
    if (block === "busy") f.app.store.setState({ busy: { project: true } });
    if (block === "dirty") f.app.setPlanEditorDirty(true);
    if (block === "draft") f.app.startGroup();
    if (block === "ownership" || block === "preview") {
      f.app.store.setState({
        plan: {
          valid: true,
          issues: [],
          plan: {
            id: "plan",
            projectId: "a",
            revision: 1,
            title: "Plan",
            description: "",
            status: "draft",
            baselineSnapshotId: "s-a",
            baselineContentHash: "a",
            createdAt: "now",
            updatedAt: "now",
            operations: [],
          },
        } as PlanDetail,
      });
      const summary = f.app.store.getState().summary!;
      f.app.store.setState({
        summary: {
          ...summary,
          entrypoints: summary.entrypoints.map((n) => ({
            ...n,
            filePath: "src/a.ts",
          })),
        },
        selectedNode: {
          id: "f",
          kind: "function",
          name: "f",
          filePath: "src/a.ts",
        },
      });
      await f.app.ownership.setMode("ownership");
      expect(f.app.ownership.store.getState().mode).toBe("ownership");
      if (block === "preview") {
        const graph = f.app.store.getState().graph!;
        f.app.store.setState({
          graph: {
            ...graph,
            nodes: graph.nodes.map((n) => ({ ...n, filePath: "src/a.ts" })),
          },
        });
        expect(f.app.ownership.begin("f")).toBeTruthy();
        expect(f.app.ownership.choose({ kind: "folder", path: "." })).toBe(
          true,
        );
        expect(f.app.ownership.store.getState().status).toBe("preview");
      }
    }
    expect(f.app.captureLayout()).toBeUndefined();
    expect(
      f.app.saveLayoutPositions({ "fact:f": { x: 10, y: 20 } }, capture),
    ).toBe(false);
    expect(f.writes).toHaveLength(0);
    f.app.disposeOverview();
  });
}

it("ending a dirty interval cannot revive an older captured layout job", async () => {
  const f = setup();
  await open(f);
  const capture = f.app.captureLayout()!;
  f.app.setPlanEditorDirty(true);
  f.app.setPlanEditorDirty(false);
  expect(f.app.captureLayout()).toBeDefined();
  expect(
    f.app.saveLayoutPositions({ "fact:f": { x: 10, y: 20 } }, capture),
  ).toBe(false);
  expect(f.writes).toHaveLength(0);
  f.app.disposeOverview();
});

it("explicit project recompute synchronously expires the previous visible capture", async () => {
  const f = setup();
  await open(f);
  const capture = f.app.captureLayout()!;
  const pending = f.app.recomputeProjectLayout();
  expect(
    f.app.saveLayoutPositions({ "fact:f": { x: 10, y: 20 } }, capture),
  ).toBe(false);
  await pending;
  expect(f.writes).toHaveLength(0);
  f.app.disposeOverview();
});

it("late funnel loading veto and its interval retire an older visible capture", async () => {
  const f = setup();
  await open(f);
  const capture = f.app.captureLayout()!;
  f.app.store.setState({
    busy: { ...f.app.store.getState().busy, funnel: true },
  });
  expect(f.app.captureLayout()).toBeUndefined();
  expect(
    f.app.saveLayoutPositions({ "fact:f": { x: 10, y: 20 } }, capture),
  ).toBe(false);
  f.app.store.setState({
    busy: { ...f.app.store.getState().busy, funnel: false },
  });
  expect(f.app.captureLayout()).toBeDefined();
  expect(
    f.app.saveLayoutPositions({ "fact:f": { x: 10, y: 20 } }, capture),
  ).toBe(false);
  expect(f.writes).toHaveLength(0);
  f.app.disposeOverview();
});
