import { describe, expect, it, vi } from "vitest";
import type {
  CodeNode,
  Operation,
  SubgraphResult,
  FunctionGroup,
} from "@codemap/core";
import * as graphModule from "./projection.js";
import * as groupModule from "../groups/projection.js";
import {
  guardedOverviewProjection,
  OverviewSession,
  measurementsChanged,
  type OverviewSessionInput,
  saveCapturedVisualPosition,
  readOverviewMeasurements,
  resolveCurrentOverviewCapture,
  completeOverviewJob,
  completeOverviewFrame,
  CompactOverviewCache,
} from "./overview-session.js";
import { layoutProjectFacts } from "./overview-layout.js";
const node = (id: string): CodeNode => ({
  id,
  name: id,
  kind: "function",
  filePath: "a.ts",
});
const graph = (n = 2): SubgraphResult => ({
  snapshotId: "s",
  dataSource: "code",
  truncated: false,
  nodes: Array.from({ length: n }, (_, i) => node(String(i))),
  relations: [],
});
const capture = {
  projectId: "p",
  snapshotId: "s",
  projectionGeneration: 1,
  viewGeneration: 1,
};
function input(n = 2): OverviewSessionInput {
  const g = graph(n),
    projection = graphModule.projectGraph(g, [], "fact", {});
  const global = layoutProjectFacts({
    target: {
      projectId: "p",
      snapshotId: "s",
      contentHash: "hash",
      scope: "project_indexed_facts",
      status: "ready",
      complete: true,
      limits: { nodes: 5000, relations: 20000, bytes: 8388608 },
      counts: {
        nodes: n,
        relations: 0,
        byKind: { function: n, file: 0, folder: 0, external: 0 },
      },
      nodes: g.nodes.map((x) => ({ id: x.id, kind: x.kind })),
      relations: [],
    },
    pins: {},
    retained: {},
  });
  if (global.status !== "ready") throw Error("fixture");
  return {
    projection,
    global,
    pins: {},
    retained: {},
    ignorePinsFor: [],
    capture,
    measurementGeneration: 0,
  };
}
const dimensions = {
  "fact:0": { width: 200, height: 80 },
  "fact:1": { width: 250, height: 90 },
};
describe("guarded overview projection", () => {
  it("never projects a rejected planned layer and independently builds bounded fact-only fallback", () => {
    const ops: Operation[] = Array.from({ length: 2001 }, (_, i) => ({
      kind: "add_relation",
      id: String(i),
      sourceId: "0",
      targetId: "1",
      type: "calls",
    }));
    const p = vi.spyOn(graphModule, "projectGraph"),
      groups = vi.spyOn(groupModule, "projectGroups");
    const result = guardedOverviewProjection({
      graph: graph(),
      operations: ops,
      filter: "both",
      references: [node("extra")],
      groups: [],
      collapsed: [],
      positions: {},
      locale: "en",
    });
    expect(result.rejection).toMatchObject({
      reason: "edge_budget",
      countStatus: "partial_lower_bound",
      edgesLowerBound: 2001,
    });
    expect(result.fallback).toBe("facts");
    expect(result.projection.nodes.map((n) => n.id)).toEqual([
      "fact:0",
      "fact:1",
    ]);
    expect(p).toHaveBeenCalledTimes(1);
    expect(p.mock.calls[0]?.slice(1, 3)).toEqual([[], "fact"]);
    expect(p.mock.calls[0]?.[5]).toEqual([]);
    expect(groups).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("keeps an oversized raw graph empty without projecting or truncating it", () => {
    const p = vi.spyOn(graphModule, "projectGraph");
    const r = guardedOverviewProjection({
      graph: graph(301),
      operations: [],
      filter: "plan",
      references: [],
      groups: [],
      collapsed: [],
      positions: {},
      locale: "zh",
    });
    expect(r.fallback).toBe("empty");
    expect(r.projection.nodes).toEqual([]);
    expect(p).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("ignores huge fact-hidden operations while reporting exact stored length", () => {
    const operations = new Proxy(Array(4097), {
      get(t, k) {
        if (k !== "length") throw Error("unbounded op read");
        return Reflect.get(t, k);
      },
    }) as Operation[];
    const r = guardedOverviewProjection({
      graph: graph(),
      operations,
      filter: "fact",
      references: [],
      groups: [],
      collapsed: [],
      positions: {},
      locale: "zh",
    });
    expect(r.rejection).toBeUndefined();
    expect(r.estimate.counts).toMatchObject({
      storedOperations: 4097,
      visibleOperations: 0,
    });
    expect(r.projection.nodes).toHaveLength(2);
  });
  it("rejects amplified group work before projectGroups and excludes all groups from fallback", () => {
    const groups: FunctionGroup[] = Array.from({ length: 4097 }, (_, i) => ({
      id: String(i),
      projectId: "p",
      title: "group",
      description: "",
      source: "user",
      memberIds: ["0"],
    }));
    const p = vi.spyOn(groupModule, "projectGroups"),
      r = guardedOverviewProjection({
        graph: graph(),
        operations: [],
        filter: "both",
        references: [],
        groups,
        collapsed: [],
        positions: {},
        locale: "en",
      });
    expect(r.rejection).toMatchObject({ reason: "membership_work" });
    expect(r.fallback).toBe("facts");
    expect(r.projection.nodes).toHaveLength(2);
    expect(p).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
describe("overview measurement session", () => {
  it("stages fallback without positions and waits for every actual card before a single complete result", () => {
    const s = new OverviewSession(),
      begin = s.begin(input());
    expect(begin.status).toBe("pending");
    expect(begin).not.toHaveProperty("positions");
    if (begin.status !== "pending") return;
    expect(
      s.measure(begin.token, { "fact:0": dimensions["fact:0"] }, capture),
    ).toMatchObject({ status: "pending" });
    const r = s.measure(begin.token, dimensions, capture);
    expect(r).toMatchObject({ status: "ready", geometry: { passes: 2 } });
    if (r.status !== "ready") return;
    expect(r.positions["fact:1"]!.y).toBeGreaterThanOrEqual(128);
    expect(s.measure(begin.token, dimensions, capture).status).toBe(
      "cancelled",
    );
  });
  it("rejects a second-pass geometry failure without exposing the first candidate", () => {
    const s = new OverviewSession(),
      b = s.begin(input());
    expect(b.status).toBe("pending");
    if (b.status !== "pending") return;
    const r = s.measure(
      b.token,
      { ...dimensions, "fact:1": { width: 100000, height: 100000 } },
      capture,
    );
    expect(r).toMatchObject({ status: "rejected", geometry: { passes: 2 } });
    expect(r).not.toHaveProperty("positions");
  });
  it("charges both passes cumulatively", () => {
    const s = new OverviewSession(),
      b = s.begin(input());
    expect(b.status).toBe("pending");
    if (b.status !== "pending") return;
    const r = s.measure(b.token, dimensions, capture);
    expect(r).toMatchObject({
      status: "ready",
      geometry: { passes: 2, candidateProbes: 4, cellEntriesInserted: 4 },
    });
  });
  it.each([
    "projectId",
    "snapshotId",
    "projectionGeneration",
    "viewGeneration",
  ] as const)("cancels a late measurement when %s changes", (key) => {
    const s = new OverviewSession(),
      b = s.begin(input());
    expect(b.status).toBe("pending");
    if (b.status !== "pending") return;
    const current = {
      ...capture,
      [key]: typeof capture[key] === "number" ? 2 : "changed",
    };
    expect(s.measure(b.token, dimensions, current).status).toBe("cancelled");
  });
  it("blocks layout during ownership, dirty editing, funnel, selection and dragging", () => {
    for (const flag of [
      "ownership",
      "dirty",
      "funnel",
      "selection",
      "dragging",
    ]) {
      const s = new OverviewSession();
      expect(s.begin({ ...input(), blocked: { [flag]: true } }).status).toBe(
        "cancelled",
      );
    }
  });
  it("cancellation invalidates a token and newer sessions cannot be completed with old measurements", () => {
    const s = new OverviewSession(),
      a = s.begin(input());
    expect(a.status).toBe("pending");
    if (a.status !== "pending") return;
    s.cancel();
    const b = s.begin(input());
    expect(s.measure(a.token, dimensions, capture).status).toBe("cancelled");
    expect(b.status).toBe("pending");
    if (b.status !== "pending") return;
    expect(s.measure(b.token, dimensions, capture).status).toBe("ready");
  });
  it("rejects stale measurement generation instead of publishing positions", () => {
    const s = new OverviewSession(),
      b = s.begin(input());
    expect(b.status).toBe("pending");
    if (b.status !== "pending") return;
    expect(s.measure(b.token, dimensions, capture, 1)).toEqual({
      status: "cancelled",
    });
  });
  it("fails a real second-pass live-entry budget without publishing a first-pass candidate", () => {
    const s = new OverviewSession(),
      b = s.begin(input(500));
    expect(b.status).toBe("pending");
    if (b.status !== "pending") return;
    const boxes = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [
        `fact:${i}`,
        { width: 3000, height: 3000 },
      ]),
    );
    const r = s.measure(b.token, boxes, capture);
    expect(r).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      geometry: { passes: 2, liveCellEntries: 20000 },
    });
    expect(r).not.toHaveProperty("positions");
  });
  it("explicit rearrange ignores only current visual pins while preserving original projection and opaque keys", () => {
    const x = input();
    x.pins = {
      "fact:0": { position: { x: 999, y: 999 }, sourceKey: "fact:0" },
    };
    x.ignorePinsFor = ["fact:0", "fact:1"];
    const before = structuredClone(x),
      s = new OverviewSession(),
      b = s.begin(x);
    expect(b.status).toBe("pending");
    if (b.status !== "pending") return;
    const r = s.measure(b.token, dimensions, capture);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.positions["fact:0"]).toEqual({ x: 0, y: 0 });
    expect(Object.keys(r.positions).sort()).toEqual(["fact:0", "fact:1"]);
    expect(x).toEqual(before);
  });
  it("ignores measured jitter of at most one pixel", () => {
    expect(
      measurementsChanged(dimensions, {
        ...dimensions,
        "fact:0": { width: 201, height: 79 },
      }),
    ).toBe(false);
    expect(
      measurementsChanged(dimensions, {
        ...dimensions,
        "fact:0": { width: 202, height: 80 },
      }),
    ).toBe(true);
  });
});

describe("captured pointer layout patch", () => {
  it("refuses an old drag completion after switching project instead of saving it into the new scope", () => {
    let positions = { opaque: { x: 7, y: 8 } };
    const accepted = saveCapturedVisualPosition(
      "group-member:G:0",
      { x: 10, y: 20 },
      capture,
      { ...capture, projectId: "new" },
      (patch) => {
        positions = { ...positions, ...patch };
        return true;
      },
    );
    expect(accepted).toBe(false);
    expect(positions).toEqual({ opaque: { x: 7, y: 8 } });
  });
  it("saves only the dragged visual alias, preserving canonical and offscope positions", () => {
    let positions: Record<string, { x: number; y: number }> = {
      "fact:0": { x: 1, y: 2 },
      opaque: { x: 7, y: 8 },
    };
    expect(
      saveCapturedVisualPosition(
        "group-member:G:0",
        { x: 10, y: 20 },
        capture,
        capture,
        (patch) => {
          positions = { ...positions, ...patch };
          return true;
        },
      ),
    ).toBe(true);
    expect(positions).toEqual({
      "fact:0": { x: 1, y: 2 },
      opaque: { x: 7, y: 8 },
      "group-member:G:0": { x: 10, y: 20 },
    });
  });
});

describe("R1 Canvas caller completion guards", () => {
  it("cannot complete reused visual IDs with boxes from a previous projection", () => {
    const previous = input(),
      next = input();
    next.capture = { ...capture, projectionGeneration: 2 };
    const frame = {
      key: "same scope",
      projection: previous.projection,
      projectionGeneration: 1,
      generation: 1,
      boxes: dimensions,
    };
    expect(
      readOverviewMeasurements(frame, {
        key: "same scope",
        projection: next.projection,
        projectionGeneration: 2,
      }),
    ).toBeUndefined();
  });
  it("rejects cached boxes when raw projection changes even without a store generation change", () => {
    const previous = input(),
      next = input();
    const frame = {
      key: "same",
      projection: previous.projection,
      projectionGeneration: 1,
      generation: 1,
      boxes: dimensions,
    };
    expect(
      readOverviewMeasurements(frame, {
        key: "same",
        projection: next.projection,
        projectionGeneration: 1,
      }),
    ).toBeUndefined();
  });
  it("treats authoritative undefined capture as a loading veto for default adoption", () => {
    const s = new OverviewSession(),
      b = s.begin(input());
    if (b.status !== "pending") throw Error("fixture");
    let positions: unknown;
    completeOverviewJob(
      s,
      b.token,
      dimensions,
      0,
      () => ({
        capture: resolveCurrentOverviewCapture({
          onCaptureLayout: () => undefined,
          layoutCapture: capture,
        }),
        blocked: false,
      }),
      (r) => {
        positions = r.positions;
      },
    );
    expect(positions).toBeUndefined();
  });
  it.each([
    "ownership",
    "preview",
    "dirty",
    "group draft",
    "funnel",
    "selection",
    "dragging",
  ])("refuses live %s protection before derived adoption", () => {
    const s = new OverviewSession(),
      b = s.begin(input());
    if (b.status !== "pending") throw Error("fixture");
    let positions: unknown;
    const r = completeOverviewJob(
      s,
      b.token,
      dimensions,
      0,
      () => ({ capture, blocked: true }),
      (value) => {
        positions = value.positions;
      },
    );
    expect(r.status).toBe("cancelled");
    expect(positions).toBeUndefined();
  });
  it("rechecks protection immediately before apply and explicit save", () => {
    const s = new OverviewSession(),
      b = s.begin(input());
    if (b.status !== "pending") throw Error("fixture");
    let reads = 0,
      positions: unknown,
      saved: unknown;
    const r = completeOverviewJob(
      s,
      b.token,
      dimensions,
      0,
      () => ({ capture, blocked: ++reads > 1 }),
      (value) => {
        positions = value.positions;
      },
      (patch) => {
        saved = patch;
        return true;
      },
    );
    expect(r.status).toBe("cancelled");
    expect(positions).toBeUndefined();
    expect(saved).toBeUndefined();
  });
  it("authorizes eligible complete derived adoption without persisting it", () => {
    const s = new OverviewSession(),
      b = s.begin(input());
    if (b.status !== "pending") throw Error("fixture");
    let positions: unknown;
    const r = completeOverviewJob(
      s,
      b.token,
      dimensions,
      0,
      () => ({ capture, blocked: false }),
      (value) => {
        positions = value.positions;
      },
    );
    expect(r.status).toBe("ready");
    expect(positions).toEqual({
      "fact:0": { x: 0, y: 0 },
      "fact:1": { x: 0, y: 128 },
    });
  });
  it("retains only surviving compact visual positions across same-project refresh while previous snapshot is not current-ready", () => {
    const before = input(),
      next = input(3),
      cache = new CompactOverviewCache();
    cache.commit(
      "p",
      "scope",
      "s0",
      {
        "fact:0": { x: 0, y: 0 },
        "fact:1": { x: 0, y: 128 },
        removed: { x: 900, y: 900 },
      },
      before.global,
    );
    const retained = cache.retained(
      "p",
      "scope",
      "s1",
      ["fact:0", "fact:1", "fact:2"],
      next.global,
    );
    expect(retained).toEqual({
      "fact:0": { x: 0, y: 0 },
      "fact:1": { x: 0, y: 128 },
    });
    expect(cache.current("p", "scope", "s1")).toEqual({});
    const s = new OverviewSession(),
      b = s.begin({
        ...next,
        retained,
        capture: { ...capture, snapshotId: "s1" },
      });
    if (b.status !== "pending") throw Error("fixture");
    const result = s.measure(
      b.token,
      { ...dimensions, "fact:2": { width: 200, height: 80 } },
      { ...capture, snapshotId: "s1" },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.positions["fact:1"]).toEqual({ x: 0, y: 128 });
    expect(result.positions["fact:2"]).not.toEqual({ x: 0, y: 128 });
  });
  it("does not retain compact autos from another project or scope, or explicit same-snapshot global recompute", () => {
    const before = input(),
      recomputed = input(),
      cache = new CompactOverviewCache();
    cache.commit(
      "p",
      "scope",
      "s",
      { "fact:0": { x: 9, y: 9 } },
      before.global,
    );
    expect(
      cache.retained("p", "scope", "s", ["fact:0"], recomputed.global),
    ).toEqual({});
    expect(
      cache.retained("q", "scope", "s", ["fact:0"], before.global),
    ).toEqual({});
    expect(
      cache.retained("p", "other", "s", ["fact:0"], before.global),
    ).toEqual({});
  });
});

it("measurement cache also rejects a generation change with the identical projection object", () => {
  const x = input(),
    frame = {
      key: "same",
      projection: x.projection,
      projectionGeneration: 1,
      generation: 1,
      boxes: dimensions,
    };
  expect(
    readOverviewMeasurements(frame, {
      key: "same",
      projection: x.projection,
      projectionGeneration: 2,
    }),
  ).toBeUndefined();
});
it("compact cache preserves at most two project entries and filters removed visual keys", () => {
  const x = input(),
    cache = new CompactOverviewCache();
  for (const project of ["p", "q", "r"])
    cache.commit(
      project,
      "scope",
      "s",
      { "fact:0": { x: 1, y: 2 }, removed: { x: 9, y: 9 } },
      x.global,
    );
  expect(cache.current("p", "scope", "s")).toEqual({});
  expect(cache.retained("q", "scope", "next", ["fact:0"], x.global)).toEqual({
    "fact:0": { x: 1, y: 2 },
  });
  expect(cache.retained("r", "scope", "next", ["fact:0"], x.global)).toEqual({
    "fact:0": { x: 1, y: 2 },
  });
});

it("actual Canvas frame-completion path cannot publish or save reused IDs until current projection dimensions arrive", () => {
  const previous = input(),
    next = input();
  next.capture = { ...capture, projectionGeneration: 2 };
  next.measurementGeneration = 1;
  const frame = {
    key: "same",
    projection: previous.projection,
    projectionGeneration: 1,
    generation: 1,
    boxes: {
      "fact:0": { width: 300, height: 80 },
      "fact:1": { width: 300, height: 80 },
    },
  };
  const s = new OverviewSession(),
    b = s.begin(next);
  if (b.status !== "pending") throw Error("fixture");
  let positions: unknown, saved: unknown;
  const binding = {
    key: "same",
    projection: next.projection,
    projectionGeneration: 2,
  };
  const stale = completeOverviewFrame(
    s,
    b.token,
    frame,
    binding,
    () => ({ capture: next.capture, blocked: false }),
    (r) => {
      positions = r.positions;
    },
    (patch) => {
      saved = patch;
      return true;
    },
  );
  expect(stale.status).toBe("pending");
  expect(positions).toBeUndefined();
  expect(saved).toBeUndefined();
  const fresh = {
    ...frame,
    ...binding,
    boxes: {
      "fact:0": { width: 300, height: 600 },
      "fact:1": { width: 300, height: 80 },
    },
  };
  const ready = completeOverviewFrame(
    s,
    b.token,
    fresh,
    binding,
    () => ({ capture: next.capture, blocked: false }),
    (r) => {
      positions = r.positions;
    },
  );
  expect(ready.status).toBe("ready");
  expect(positions).toEqual({
    "fact:0": { x: 0, y: 0 },
    "fact:1": { x: 0, y: 648 },
  });
});

it("an obsolete effect token cannot complete or clear the newer measured job", () => {
  const x = input(),
    s = new OverviewSession(),
    old = s.begin(x);
  if (old.status !== "pending") throw Error("fixture");
  const current = s.begin({ ...x, measurementGeneration: 1 });
  if (current.status !== "pending") throw Error("fixture");
  expect(s.isCurrent(old.token)).toBe(false);
  expect(s.isCurrent(current.token)).toBe(true);
  const result = completeOverviewFrame(
    s,
    current.token,
    {
      key: "scope",
      projection: x.projection,
      projectionGeneration: 1,
      generation: 1,
      boxes: dimensions,
    },
    { key: "scope", projection: x.projection, projectionGeneration: 1 },
    () => ({ capture, blocked: false }),
    () => {},
  );
  expect(result.status).toBe("ready");
  expect(s.isCurrent(current.token)).toBe(false);
});
