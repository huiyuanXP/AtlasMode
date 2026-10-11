import { describe, it, expect, vi } from "vitest";
import type {
  CodeNode,
  SubgraphResult,
  Operation,
  FunctionGroup,
} from "@codemap/core";
import { projectGraph } from "./projection.js";
import * as graphProjection from "./projection.js";
import * as groupProjection from "../groups/projection.js";
import { projectGroups } from "../groups/projection.js";
import {
  estimateBaseVisualWork,
  estimateVisualWork,
  resolveVisualPins,
  layoutVisibleOverview,
} from "./overview-visual.js";
import type { GeometryWork, GlobalLayoutResult } from "./overview-layout.js";
const node = (id: string): CodeNode => ({
  id,
  name: id,
  kind: "function",
  filePath: "src/a.ts",
  parentId: "file",
});
const graph = (n = 2): SubgraphResult => ({
  snapshotId: "s",
  dataSource: "code",
  truncated: false,
  nodes: Array.from({ length: n }, (_, i) => node(String(i))),
  relations: [],
});
const relation = (id = "r") => ({
  id,
  type: "calls" as const,
  sourceId: "0",
  targetId: "1",
  resolution: "resolved" as const,
  evidence: { filePath: "src/a.ts", line: 1 },
});
const group = (id: string, memberIds: string[]): FunctionGroup => ({
  id,
  projectId: "project",
  title: id,
  description: "",
  source: "user",
  memberIds,
});
const zero = (): GeometryWork => ({
  candidateProbes: 0,
  cellEntriesInserted: 0,
  liveCellEntries: 0,
  bucketEntryVisits: 0,
  rectangleComparisons: 0,
  manualPairObservations: 0,
  passes: 0,
});
const global = (
  ids: string[],
): Extract<GlobalLayoutResult, { status: "ready" }> => ({
  status: "ready",
  positions: Object.fromEntries(ids.map((id, i) => [id, { x: i * 400, y: 0 }])),
  ranks: Object.fromEntries(ids.map((id) => [id, 0])),
  order: ids,
  stats: {
    nodes: ids.length,
    rawRelations: 0,
    rankRelations: 0,
    sccs: ids.length,
    geometry: zero(),
  },
  manualOverlaps: {
    affectedPinIds: [],
    samplePairs: [],
    pairsObserved: 0,
    complete: true,
    truncated: false,
  },
});
const input = (n = 2): import("./overview-visual.js").VisibleLayoutInput => {
  const projection = projectGraph(graph(n), [], "fact", {});
  return {
    projection,
    global: global(projection.nodes.map((n) => n.data.node.id)),
    pins: {},
    retained: {},
    measurements: {},
    ignorePinsFor: [],
    priorGeometry: zero(),
  };
};
const noCollision = (
  positions: Record<string, { x: number; y: number }>,
  sizes: Record<string, { width: number; height: number }>,
) => {
  const ids = Object.keys(positions);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = positions[ids[i]!]!,
        b = positions[ids[j]!]!,
        as = sizes[ids[i]!] ?? { width: 300, height: 220 },
        bs = sizes[ids[j]!] ?? { width: 300, height: 220 };
      expect(
        a.x + as.width + 48 <= b.x ||
          b.x + bs.width + 48 <= a.x ||
          a.y + as.height + 48 <= b.y ||
          b.y + bs.height + 48 <= a.y,
      ).toBe(true);
    }
};
describe("Task3 projection preflight", () => {
  it("counts actual emissions, rejects conflicting visual IDs and 501 cards", () => {
    const ops: Operation[] = Array.from({ length: 501 }, (_, i) => ({
      kind: "add_function",
      tempId: "p" + i,
      name: "p",
      filePath: "p.ts",
    }));
    expect(estimateBaseVisualWork(undefined, ops, "both", [])).toMatchObject({
      status: "rejected",
      reason: "node_budget",
      countStatus: "partial_lower_bound",
      nodesLowerBound: 501,
    });
    expect(
      estimateBaseVisualWork(undefined, [ops[0]!, ops[0]!], "both", []),
    ).toMatchObject({ status: "rejected", reason: "invalid_input" });
  });
  it("rejects 2001 valid planned routes before projection or edge construction", () => {
    const ops: Operation[] = Array.from({ length: 2001 }, (_, i) => ({
      kind: "add_relation",
      id: "p" + i,
      sourceId: "0",
      targetId: "1",
      type: "calls",
    }));
    const out = estimateBaseVisualWork(graph(), ops, "both", []);
    expect(out).toMatchObject({
      status: "rejected",
      reason: "edge_budget",
      countStatus: "partial_lower_bound",
      edgesLowerBound: 2001,
    });
    expect(out).not.toHaveProperty("edgeUpperBound");
    expect(out.work.operationVisits).toBeLessThanOrEqual(4002);
  });
  it("uses only length for excessive visible ops but ignores them for fact", () => {
    const ops = new Proxy(Array(4097), {
      get(t, p, r) {
        if (p !== "length") throw Error("operation read");
        return Reflect.get(t, p, r);
      },
    }) as Operation[];
    expect(estimateBaseVisualWork(graph(), ops, "both", [])).toMatchObject({
      reason: "operation_budget",
      work: { operationVisits: 0 },
      counts: { storedOperations: 4097, visibleOperations: 4097 },
    });
    expect(estimateBaseVisualWork(graph(), ops, "fact", [])).toMatchObject({
      status: "ready",
      counts: { storedOperations: 4097, visibleOperations: 0 },
      work: { operationVisits: 0 },
    });
  });
  it.each([
    ["nodes", 301, "node_budget"],
    ["relations", 901, "edge_budget"],
    ["references", 501, "reference_budget"],
  ] as const)("rejects oversized %s before visits", (kind, length, reason) => {
    const g = graph();
    let refs: CodeNode[] = [];
    if (kind === "nodes") g.nodes = Array(length);
    if (kind === "relations") g.relations = Array(length);
    if (kind === "references") refs = Array(length);
    expect(estimateBaseVisualWork(g, [], "both", refs)).toMatchObject({
      status: "rejected",
      reason,
      work: { operationVisits: 0, relationVisits: 0, referenceVisits: 0 },
    });
  });
  it("accounts node-neutral nested work and change allocations", () => {
    const moves: Operation[] = Array.from({ length: 1500 }, () => ({
      kind: "move_function",
      nodeId: "0",
      filePath: "p.ts",
    }));
    expect(estimateBaseVisualWork(graph(), moves, "both", [])).toMatchObject({
      status: "rejected",
      reason: "projection_work",
      work: { projectionStepsUpperBound: 2000001 },
    });
    const annotations: Operation[] = Array.from({ length: 4000 }, () => ({
      kind: "annotate",
      targetId: "0",
      text: "a",
    }));
    const dup = graph(3);
    dup.nodes[1] = node("0");
    expect(estimateBaseVisualWork(dup, annotations, "both", [])).toMatchObject({
      reason: "invalid_input",
    });
  });
  it.each(["fact", "plan", "both"] as const)(
    "bounds real emissions and endpoint semantics for %s",
    (filter) => {
      const g = graph(3);
      g.relations = [
        relation(),
        { ...relation("unknown"), resolution: "unresolved", targetId: null },
      ];
      const ops: Operation[] = [
        { kind: "annotate", targetId: "2", text: "a" },
        { kind: "add_function", tempId: "p", name: "p", filePath: "p.ts" },
        {
          kind: "add_relation",
          id: "e",
          sourceId: "p",
          targetId: "ref",
          type: "calls",
        },
        { kind: "remove_relation", relationId: "r" },
      ];
      const refs = [node("ref"), node("ignored")];
      const out = estimateBaseVisualWork(g, ops, filter, refs);
      const actual = projectGraph(g, ops, filter, {}, "en", refs);
      expect(out.status).toBe("ready");
      if (out.status === "ready") {
        expect(out.nodes).toBe(actual.nodes.length);
        expect(out.edgeUpperBound).toBeGreaterThanOrEqual(actual.edges.length);
        expect(out.work.visualAllocationsUpperBound).toBeGreaterThanOrEqual(
          actual.nodes.length +
            actual.edges.length +
            actual.notices.length +
            actual.nodes.reduce((s, n) => s + n.data.changes.length, 0),
        );
      }
      expect(out.work.operationVisits).toBeLessThanOrEqual(8192);
      expect(out.work.relationVisits).toBeLessThanOrEqual(1800);
      expect(out.work.referenceVisits).toBeLessThanOrEqual(500);
    },
  );
});
describe("Task3 group preflight and pin identity", () => {
  it("inherits canonical only in first stable alias, with own alias/header priority and opaque preservation", () => {
    const base = projectGraph(graph(), [], "fact", {});
    const groups = [group("G2", ["0"]), group("G1", ["0", "1"])];
    const saved = {
      "fact:0": { x: 10, y: 20 },
      "group:G1": { x: 80, y: 90 },
      "opaque:keep": { x: 1, y: 2 },
    };
    const before = structuredClone(saved);
    const projection = projectGroups(base, groups, [], saved, "en");
    expect(resolveVisualPins(projection.nodes, groups, saved)).toEqual({
      "group:G1": { position: { x: 80, y: 90 }, sourceKey: "group:G1" },
      "group-member:G1:0": { position: { x: 10, y: 20 }, sourceKey: "fact:0" },
    });
    const own = { ...saved, "group-member:G1:0": { x: 30, y: 40 } };
    expect(
      resolveVisualPins(projection.nodes, groups, own)["group-member:G1:0"],
    ).toEqual({ position: { x: 30, y: 40 }, sourceKey: "group-member:G1:0" });
    expect(saved).toEqual(before);
  });
  it.each(["groups", "collapsed", "members"] as const)(
    "length gates excessive %s without membership reads",
    (kind) => {
      const base = projectGraph(graph(), [], "fact", {});
      const groups =
        kind === "groups"
          ? Array(4097)
          : [group("G", kind === "members" ? Array(20001) : ["0"])];
      const collapsed = kind === "collapsed" ? Array(4097) : [];
      expect(estimateVisualWork(base, groups, collapsed)).toMatchObject({
        status: "rejected",
        reason: "membership_work",
        work: { membershipVisits: 0 },
      });
    },
  );
  it("counts exact group cards and union route upper bounds rather than group squares", () => {
    const g = graph();
    g.relations = [relation()];
    const base = projectGraph(g, [], "fact", {});
    const groups = Array.from({ length: 15 }, (_, i) =>
      group("G" + i, ["0", "1"]),
    );
    const out = estimateVisualWork(base, groups, []);
    expect(out).toMatchObject({
      status: "ready",
      nodes: 45,
      edgeUpperBound: 31,
    });
    expect(
      projectGroups(base, groups, [], {}, "en").edges.length,
    ).toBeLessThanOrEqual(31);
  });
  it("rejects amplified cards and routes before group projection", () => {
    const base = projectGraph(graph(), [], "fact", {});
    expect(
      estimateVisualWork(
        base,
        Array.from({ length: 251 }, (_, i) => group("G" + i, ["0", "1"])),
        [],
      ),
    ).toMatchObject({
      reason: "node_budget",
      countStatus: "partial_lower_bound",
    });
    const g = graph();
    g.relations = Array.from({ length: 134 }, (_, i) => relation(String(i)));
    expect(
      estimateVisualWork(
        projectGraph(g, [], "fact", {}),
        Array.from({ length: 15 }, (_, i) => group("G" + i, ["0"])),
        [],
      ),
    ).toMatchObject({
      reason: "edge_budget",
      countStatus: "partial_lower_bound",
    });
  });
  it("rejects group nested work and allocation without changing collapse state", () => {
    const g = graph();
    g.relations = Array.from({ length: 500 }, (_, i) => relation(String(i)));
    expect(
      estimateVisualWork(
        projectGraph(g, [], "fact", {}),
        [group("G", ["0"])],
        [],
      ),
    ).toMatchObject({ reason: "projection_work" });
    expect(
      estimateVisualWork(
        projectGraph(graph(), [], "fact", {}),
        [
          group("G", [
            "0",
            ...Array.from({ length: 6000 }, (_, i) => "unknown" + i),
          ]),
        ],
        [],
      ),
    ).toMatchObject({
      reason: "projection_work",
      work: { visualAllocationsUpperBound: 10001 },
    });
  });
});
describe("Task3 measured local geometry", () => {
  it("compacts domain ranks into visual IDs using actual unequal sizes", () => {
    const a = input(3);
    a.global.ranks = { "0": 10, "1": 90, "2": 90 };
    a.measurements = {
      "fact:0": { width: 800, height: 500 },
      "fact:1": { width: 90, height: 50 },
      "fact:2": { width: 600, height: 400 },
    };
    const before = structuredClone(a);
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(Object.keys(out.positions).sort()).toEqual([
        "fact:0",
        "fact:1",
        "fact:2",
      ]);
      noCollision(out.positions, a.measurements);
      expect(out.positions["fact:0"]!.x).toBeLessThan(
        out.positions["fact:1"]!.x,
      );
      expect(out.manualOverlaps.pairsObserved).toBe(0);
    }
    expect(a).toEqual(before);
  });
  it("moves colliding autos and retained points while preserving exact saved pins", () => {
    const a = input(3);
    a.pins = { "fact:0": { position: { x: 0, y: 0 }, sourceKey: "fact:0" } };
    a.retained = { "fact:1": { x: 0, y: 0 }, "fact:2": { x: 2000, y: 2000 } };
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.positions["fact:0"]).toEqual({ x: 0, y: 0 });
      expect(out.positions["fact:2"]).toEqual({ x: 2000, y: 2000 });
      noCollision(out.positions, {});
      expect(out.manualOverlaps.pairsObserved).toBe(0);
    }
  });
  it("reports only true saved pin overlaps with bounded complete diagnostics", () => {
    const a = input(12);
    a.pins = Object.fromEntries(
      a.projection.nodes.map((n) => [
        n.id,
        { position: { x: 0, y: 0 }, sourceKey: n.id },
      ]),
    );
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.manualOverlaps).toMatchObject({
        pairsObserved: 66,
        complete: true,
        truncated: true,
      });
      expect(out.manualOverlaps.samplePairs).toHaveLength(32);
      expect(out.geometry.manualPairObservations).toBe(66);
    }
  });
  it("supports fixed group header, fixed shared member and many-port measured header without semantic mutation", () => {
    const a = input();
    const groups = [group("G1", ["0", "1"]), group("G2", ["0"])];
    a.projection = projectGroups(a.projection, groups, [], {}, "en");
    a.pins = {
      "group:G1": { position: { x: 100, y: 100 }, sourceKey: "group:G1" },
      "group-member:G2:0": {
        position: { x: -1000, y: 100 },
        sourceKey: "group-member:G2:0",
      },
    };
    a.measurements = { "group:G1": { width: 600, height: 1000 } };
    const before = structuredClone(a.projection);
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      noCollision(out.positions, a.measurements);
      expect(out.positions["group:G1"]).toEqual({ x: 100, y: 100 });
      expect(out.positions["group-member:G1:0"]!.y).toBeGreaterThanOrEqual(
        1148,
      );
    }
    expect(a.projection).toEqual(before);
  });
  it.each([Number.MAX_VALUE, NaN, Number.POSITIVE_INFINITY])(
    "rejects unsafe pin %s without partial positions",
    (x) => {
      const a = input(1);
      a.pins = { "fact:0": { position: { x, y: 0 }, sourceKey: "fact:0" } };
      const out = layoutVisibleOverview(a);
      expect(out).toMatchObject({
        status: "rejected",
        reason: "geometry_budget",
      });
      expect(out).not.toHaveProperty("positions");
    },
  );
  it("rejects a box spanning more than 64 cells", () => {
    const a = input(1);
    a.measurements = { "fact:0": { width: 50000, height: 50000 } };
    expect(layoutVisibleOverview(a)).toMatchObject({
      status: "rejected",
      reason: "geometry_budget",
    });
  });
  it("shares cumulative budgets across two passes and never mutates prior", () => {
    const a = input();
    const first = layoutVisibleOverview(a);
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    a.priorGeometry = first.geometry;
    const before = structuredClone(a.priorGeometry);
    const second = layoutVisibleOverview(a);
    expect(second.status).toBe("ready");
    if (second.status === "ready") {
      expect(second.geometry.passes).toBe(2);
      expect(second.geometry.cellEntriesInserted).toBe(
        2 * first.geometry.cellEntriesInserted,
      );
      expect(second.geometry.bucketEntryVisits).toBe(
        2 * first.geometry.bucketEntryVisits,
      );
    }
    expect(a.priorGeometry).toEqual(before);
  });
  it.each([
    "candidateProbes",
    "cellEntriesInserted",
    "bucketEntryVisits",
    "rectangleComparisons",
    "manualPairObservations",
  ] as const)("stops before cap+1 %s including final validation", (key) => {
    const a = input(2);
    const cap = {
      candidateProbes: 32000,
      cellEntriesInserted: 40000,
      bucketEntryVisits: 200000,
      rectangleComparisons: 50000,
      manualPairObservations: 256,
    }[key];
    a.priorGeometry = { ...zero(), passes: 1, [key]: cap };
    if (key === "manualPairObservations" || key === "rectangleComparisons") {
      a.pins = Object.fromEntries(
        a.projection.nodes.map((n) => [
          n.id,
          { position: { x: 0, y: 0 }, sourceKey: n.id },
        ]),
      );
    }
    const out = layoutVisibleOverview(a);
    expect(out).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      geometry: { [key]: cap },
    });
    expect(out).not.toHaveProperty("positions");
  });
  it("rejects pass three and dense collocated pins with truthful incomplete lower bound", () => {
    const a = input(24);
    a.pins = Object.fromEntries(
      a.projection.nodes.map((n) => [
        n.id,
        { position: { x: 0, y: 0 }, sourceKey: n.id },
      ]),
    );
    const out = layoutVisibleOverview(a);
    expect(out).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      geometry: { manualPairObservations: 256 },
      manualOverlaps: { pairsObserved: 256, complete: false, truncated: true },
    });
    expect(out.manualOverlaps.affectedPinIds.length).toBeLessThanOrEqual(64);
    a.priorGeometry = { ...zero(), passes: 2 };
    expect(layoutVisibleOverview(a)).toMatchObject({
      status: "rejected",
      reason: "work_budget",
    });
  });
  it("counts repeated multicell bucket entries while deduplicating rectangle comparisons", () => {
    const a = input(2);
    a.pins = {
      "fact:0": { position: { x: 0, y: 0 }, sourceKey: "fact:0" },
      "fact:1": { position: { x: 50, y: 50 }, sourceKey: "fact:1" },
    };
    a.measurements = {
      "fact:0": { width: 800, height: 800 },
      "fact:1": { width: 800, height: 800 },
    };
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.geometry.bucketEntryVisits).toBeGreaterThan(
        out.geometry.rectangleComparisons,
      );
      expect(out.manualOverlaps.pairsObserved).toBe(1);
    }
  });
  it("ignores only explicitly named visual pins", () => {
    const a = input(1);
    a.pins = {
      "fact:0": { position: { x: 5000, y: 5000 }, sourceKey: "fact:0" },
    };
    a.ignorePinsFor = ["fact:0"];
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready")
      expect(out.positions["fact:0"]).not.toEqual({ x: 5000, y: 5000 });
  });
});

describe("Task3 adversarial budget and identity boundaries", () => {
  it("preflight performs zero projectGraph calls and zero GraphEdge allocations", () => {
    const ops: Operation[] = Array.from({ length: 2001 }, (_, i) => ({
      kind: "add_relation",
      id: String(i),
      sourceId: "0",
      targetId: "1",
      type: "calls",
    }));
    const g = graph(),
      project = vi.spyOn(graphProjection, "projectGraph"),
      push = Array.prototype.push;
    let allocated = 0;
    const append = vi
      .spyOn(Array.prototype, "push")
      .mockImplementation(function (this: unknown[], ...items: unknown[]) {
        for (const item of items)
          if (
            item &&
            typeof item === "object" &&
            "source" in item &&
            "target" in item
          )
            allocated++;
        return Reflect.apply(push, this, items) as number;
      });
    let result;
    try {
      result = estimateBaseVisualWork(g, ops, "both", []);
    } finally {
      append.mockRestore();
    }
    expect(result).toMatchObject({
      reason: "edge_budget",
      edgesLowerBound: 2001,
    });
    expect(allocated).toBe(0);
    expect(project).not.toHaveBeenCalled();
    project.mockRestore();
  });
  it.each(["fact", "plan", "both"] as const)(
    "meters numeric reads and bounds the real projection nested scans for %s",
    (filter) => {
      const ops: Operation[] = [
        { kind: "add_function", tempId: "p", name: "p", filePath: "p.ts" },
        { kind: "move_function", nodeId: "p", filePath: "new.ts" },
        { kind: "move_function", nodeId: "p", filePath: "last.ts" },
        { kind: "remove_relation", relationId: "r" },
        { kind: "annotate", targetId: "2", text: "a" },
        {
          kind: "add_relation",
          id: "e",
          sourceId: "p",
          targetId: "ref",
          type: "calls",
        },
      ];
      const g = graph(3);
      g.relations = [relation()];
      let reads = 0;
      const metered = new Proxy(ops, {
        get(t, p, r) {
          if (typeof p === "string" && /^\d+$/.test(p)) reads++;
          return Reflect.get(t, p, r);
        },
      });
      const estimate = estimateBaseVisualWork(g, metered, filter, [
        node("ref"),
      ]);
      expect(estimate.status).toBe("ready");
      expect(reads).toBe(estimate.work.operationVisits);
      expect(reads).toBe(filter === "fact" ? 0 : 12);
      reads = 0;
      const actual = projectGraph(g, metered, filter, {}, "en", [node("ref")]);
      expect(estimate.work.projectionStepsUpperBound).toBeGreaterThanOrEqual(
        reads,
      );
      if (estimate.status === "ready")
        expect(estimate.nodes).toBe(actual.nodes.length);
    },
  );
  it("accepts 500 distinct emissions and rejects the next before projection", () => {
    const ops: Operation[] = Array.from({ length: 200 }, (_, i) => ({
      kind: "add_function",
      tempId: "p" + i,
      name: "p",
      filePath: "p.ts",
    }));
    expect(estimateBaseVisualWork(graph(300), ops, "both", [])).toMatchObject({
      status: "ready",
      nodes: 500,
      countStatus: "complete",
    });
    expect(
      estimateBaseVisualWork(
        graph(300),
        [
          ...ops,
          { kind: "add_function", tempId: "next", name: "n", filePath: "p.ts" },
        ],
        "both",
        [],
      ),
    ).toMatchObject({
      reason: "node_budget",
      nodesLowerBound: 501,
      countStatus: "partial_lower_bound",
    });
  });
  it("accepts 2000 planned edges and rejects 2001, without reporting a partial upper bound", () => {
    const ops: Operation[] = Array.from({ length: 2001 }, (_, i) => ({
      kind: "add_relation",
      id: String(i),
      sourceId: "0",
      targetId: "1",
      type: "calls",
    }));
    expect(
      estimateBaseVisualWork(graph(), ops.slice(0, 2000), "both", []),
    ).toMatchObject({ status: "ready", edgeUpperBound: 2000 });
    const rejected = estimateBaseVisualWork(graph(), ops, "both", []);
    expect(rejected).toMatchObject({
      edgesLowerBound: 2001,
      countStatus: "partial_lower_bound",
    });
    expect(rejected).not.toHaveProperty("edgeUpperBound");
    expect(rejected).not.toHaveProperty("nodes");
  });
  it("rejects allocation-heavy node-neutral annotations with saturated 10001 upper bound", () => {
    const ops: Operation[] = [
      { kind: "add_function", tempId: "0", name: "p", filePath: "p.ts" },
      ...Array.from({ length: 3333 }, (): Operation => ({
        kind: "annotate",
        targetId: "0",
        text: "a",
      })),
    ];
    expect(estimateBaseVisualWork(graph(1), ops, "both", [])).toMatchObject({
      reason: "projection_work",
      countStatus: "complete",
      work: { visualAllocationsUpperBound: 10001 },
    });
    expect(
      estimateBaseVisualWork(graph(1), ops.slice(0, -1), "both", []),
    ).toMatchObject({
      status: "ready",
      work: { visualAllocationsUpperBound: 9999 },
    });
  });
  it("preserves both fact and plan emissions of one domain ID and rejects duplicate emitted edge IDs", () => {
    expect(
      estimateBaseVisualWork(
        graph(1),
        [{ kind: "add_function", tempId: "0", name: "p", filePath: "p.ts" }],
        "both",
        [],
      ),
    ).toMatchObject({ status: "ready", nodes: 2 });
    const g = graph();
    g.relations = [relation(), relation()];
    expect(estimateBaseVisualWork(g, [], "fact", [])).toMatchObject({
      reason: "invalid_input",
    });
  });
  it("keeps preflight group visits bounded and calls no group projection", () => {
    const base = projectGraph(graph(), [], "fact", {}),
      project = vi.spyOn(groupProjection, "projectGroups");
    let reads = 0;
    const members = new Proxy(
      Array.from({ length: 20000 }, () => "0"),
      {
        get(t, p, r) {
          if (typeof p === "string" && /^\d+$/.test(p)) reads++;
          return Reflect.get(t, p, r);
        },
      },
    );
    const result = estimateVisualWork(base, [group("G", members)], []);
    expect(result.work.membershipVisits).toBe(20000);
    expect(reads).toBe(20000);
    expect(result).toMatchObject({ reason: "projection_work" });
    expect(project).not.toHaveBeenCalled();
    project.mockRestore();
    const excessive = new Proxy(Array(20001), {
      get(t, p, r) {
        if (p !== "length") throw Error("member read");
        return Reflect.get(t, p, r);
      },
    }) as string[];
    expect(estimateVisualWork(base, [group("G", excessive)], [])).toMatchObject(
      { reason: "membership_work", work: { membershipVisits: 0 } },
    );
  });
  it("keeps collapsed endpoint, handle, evidence and domain identity unchanged", () => {
    const g = graph(3);
    g.relations = [
      relation(),
      { ...relation("external"), sourceId: "1", targetId: "2" },
    ];
    const base = projectGraph(g, [], "fact", {}),
      groups = [group("G1", ["0", "1"]), group("G2", ["0"])],
      projection = projectGroups(base, groups, ["G1"], {}, "en");
    const original = structuredClone(projection),
      a = input(3);
    a.projection = projection;
    a.measurements = { "group:G1": { width: 400, height: 1200 } };
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    expect(projection).toEqual(original);
    expect(
      projection.edges.some(
        (e) =>
          e.source === "group:G1" &&
          e.sourceHandle === "source:1" &&
          e.data?.domainId === "external" &&
          e.data?.evidence?.line === 1,
      ),
    ).toBe(true);
    const resolved = resolveVisualPins(projection.nodes, groups, {
      "fact:0": { x: 1, y: 2 },
    });
    expect(resolved).toEqual({});
  });
  it("maps opaque colon-containing true domain IDs through data, never alias splitting", () => {
    const g = graph(2);
    g.nodes = [node("a:b:c"), node("x:y")];
    const base = projectGraph(g, [], "fact", {}),
      groups = [group("G:one", ["a:b:c"])];
    const a = input();
    a.projection = projectGroups(base, groups, [], {}, "en");
    a.global = global(["x:y", "a:b:c"]);
    a.global.ranks = { "a:b:c": 7, "x:y": 90 };
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.positions["group-member:G:one:a:b:c"]).toBeDefined();
      expect(Object.keys(out.positions)).toHaveLength(3);
    }
    expect(
      resolveVisualPins(a.projection.nodes, groups, {
        "fact:a:b:c": { x: 3, y: 4 },
      })["group-member:G:one:a:b:c"],
    ).toEqual({ position: { x: 3, y: 4 }, sourceKey: "fact:a:b:c" });
  });
  it("retains all safe auto coordinates when a new pin releases only a conflicting auto", () => {
    const a = input(4);
    a.retained = {
      "fact:0": { x: 0, y: 0 },
      "fact:1": { x: 500, y: 0 },
      "fact:2": { x: 1000, y: 0 },
    };
    a.pins = { "fact:3": { position: { x: 0, y: 0 }, sourceKey: "fact:3" } };
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.positions["fact:1"]).toEqual({ x: 500, y: 0 });
      expect(out.positions["fact:2"]).toEqual({ x: 1000, y: 0 });
      expect(out.positions["fact:0"]).not.toEqual({ x: 0, y: 0 });
      expect(out.manualOverlaps.pairsObserved).toBe(0);
      noCollision(out.positions, {});
    }
  });
  it("moves dense co-located retained autos and meters same-cell nonintersecting manual pins", () => {
    const a = input(80);
    a.retained = Object.fromEntries(
      a.projection.nodes.map((n) => [n.id, { x: 0, y: 0 }]),
    );
    const moved = layoutVisibleOverview(a);
    expect(moved.status).toBe("ready");
    if (moved.status === "ready") {
      noCollision(moved.positions, {});
      expect(moved.manualOverlaps.pairsObserved).toBe(0);
      expect(moved.geometry.rectangleComparisons).toBeGreaterThan(80);
    }
    const b = input(80);
    b.measurements = Object.fromEntries(
      b.projection.nodes.map((n) => [n.id, { width: 2, height: 2 }]),
    );
    b.pins = Object.fromEntries(
      b.projection.nodes.map((n, i) => [
        n.id,
        {
          position: { x: 10 + (i % 10) * 30, y: 10 + Math.floor(i / 10) * 30 },
          sourceKey: n.id,
        },
      ]),
    );
    const dense = layoutVisibleOverview(b);
    expect(dense.status).toBe("ready");
    if (dense.status === "ready") {
      expect(dense.manualOverlaps.pairsObserved).toBe(0);
      expect(dense.geometry.rectangleComparisons).toBe(6320);
      expect(dense.geometry.bucketEntryVisits).toBe(9560);
    }
  });
  it("meters a two-pin overlap exactly, including final validation and self entries", () => {
    const a = input();
    a.pins = {
      "fact:0": { position: { x: 0, y: 0 }, sourceKey: "fact:0" },
      "fact:1": { position: { x: 0, y: 0 }, sourceKey: "fact:1" },
    };
    expect(layoutVisibleOverview(a)).toMatchObject({
      status: "ready",
      geometry: {
        candidateProbes: 0,
        cellEntriesInserted: 2,
        liveCellEntries: 2,
        bucketEntryVisits: 5,
        rectangleComparisons: 2,
        manualPairObservations: 1,
        passes: 1,
      },
      manualOverlaps: { pairsObserved: 1, complete: true, truncated: false },
    });
  });
  it.each([
    "candidateProbes",
    "cellEntriesInserted",
    "bucketEntryVisits",
    "rectangleComparisons",
    "manualPairObservations",
  ] as const)(
    "accepts exactly the %s cap and stops before the next real work",
    (key) => {
      const a = input();
      const cap = {
        candidateProbes: 32000,
        cellEntriesInserted: 40000,
        bucketEntryVisits: 200000,
        rectangleComparisons: 50000,
        manualPairObservations: 256,
      }[key];
      if (key === "manualPairObservations")
        a.pins = {
          "fact:0": { position: { x: 0, y: 0 }, sourceKey: "fact:0" },
          "fact:1": { position: { x: 0, y: 0 }, sourceKey: "fact:1" },
        };
      const required = {
        candidateProbes: 2,
        cellEntriesInserted: 2,
        bucketEntryVisits: 5,
        rectangleComparisons: 2,
        manualPairObservations: 1,
      }[key];
      a.priorGeometry = { ...zero(), passes: 1, [key]: cap - required };
      const accepted = layoutVisibleOverview(a);
      expect(accepted).toMatchObject({
        status: "ready",
        geometry: { [key]: cap },
      });
      a.priorGeometry = { ...zero(), passes: 1, [key]: cap - required + 1 };
      const rejected = layoutVisibleOverview(a);
      expect(rejected).toMatchObject({
        status: "rejected",
        reason: "work_budget",
        geometry: { [key]: cap },
      });
      expect(rejected).not.toHaveProperty("positions");
      if (
        key === "bucketEntryVisits" ||
        key === "rectangleComparisons" ||
        key === "manualPairObservations"
      )
        expect(rejected).toMatchObject({
          stage: "final_validation",
          manualOverlaps: { complete: false },
        });
    },
  );
  it("rejects invalid cumulative prior counters and unsafe dimensions", () => {
    const a = input();
    a.priorGeometry = { ...zero(), passes: 1, liveCellEntries: 20001 };
    expect(layoutVisibleOverview(a)).toMatchObject({
      status: "rejected",
      reason: "work_budget",
    });
    for (const width of [0, -1, NaN, Infinity]) {
      const b = input(1);
      b.measurements = { "fact:0": { width, height: 220 } };
      expect(layoutVisibleOverview(b)).toMatchObject({
        reason: "geometry_budget",
      });
    }
  });
  it("does not rasterize high-degree or long visual routes", () => {
    const a = input(25);
    a.projection.edges = Array.from({ length: 2000 }, (_, i) => ({
      id: String(i),
      source: "fact:0",
      target: "fact:24",
      data: {
        layer: "fact",
        domainId: String(i),
        sourceId: "0",
        targetId: "24",
      },
    }));
    const before = structuredClone(a.projection);
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    expect(a.projection).toEqual(before);
    if (out.status === "ready")
      expect(out.geometry.cellEntriesInserted).toBeLessThan(200);
  });
});

describe("Task3 cumulative input validity", () => {
  it("requires zero counters on the first pass", () => {
    const a = input();
    a.priorGeometry = { ...zero(), bucketEntryVisits: 1 };
    expect(layoutVisibleOverview(a)).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      stage: "prior_geometry",
    });
  });
});

describe("Task3 nested projection cap boundaries", () => {
  it("accepts the exact 2000000 step bound and rejects saturated cap+1", () => {
    const ops: Operation[] = [
      ...Array.from({ length: 1403 }, (): Operation => ({
        kind: "move_function",
        nodeId: "0",
        filePath: "p.ts",
      })),
      { kind: "annotate", targetId: "0", text: "a" },
    ];
    const refs = Array.from({ length: 393 }, (_, i) => node("unused" + i));
    // 16*(1+393+1404+1) + 1*1404 + 1403*1404 = 2000000.
    expect(estimateBaseVisualWork(graph(1), ops, "both", refs)).toMatchObject({
      status: "ready",
      work: { projectionStepsUpperBound: 2000000 },
    });
    expect(
      estimateBaseVisualWork(graph(1), ops, "both", [...refs, node("next")]),
    ).toMatchObject({
      reason: "projection_work",
      countStatus: "complete",
      work: { projectionStepsUpperBound: 2000001 },
    });
  });
  it("accounts copied membership arrays even when many groups are collapsed", () => {
    const base = projectGraph(graph(), [], "fact", {}),
      groups = Array.from({ length: 120 }, (_, i) =>
        group("G" + i, ["0", "1"]),
      );
    expect(
      estimateVisualWork(
        base,
        groups,
        groups.map((g) => g.id),
      ),
    ).toMatchObject({
      reason: "projection_work",
      work: { visualAllocationsUpperBound: 10001 },
    });
  });
});

describe("Task3 allocation, occupancy and output limits", () => {
  it("accepts the exact 10000 base allocation upper bound", () => {
    const ops: Operation[] = [
      { kind: "add_function", tempId: "0", name: "p", filePath: "p.ts" },
      ...Array.from({ length: 3332 }, (): Operation => ({
        kind: "annotate",
        targetId: "0",
        text: "a",
      })),
      { kind: "annotate", targetId: "absent", text: "a" },
    ];
    // 2 emitted nodes + 3334 possible notices + 6664 change entries.
    expect(estimateBaseVisualWork(graph(1), ops, "both", [])).toMatchObject({
      status: "ready",
      work: { visualAllocationsUpperBound: 10000 },
    });
    ops[ops.length - 1] = { kind: "annotate", targetId: "0", text: "a" };
    expect(estimateBaseVisualWork(graph(1), ops, "both", [])).toMatchObject({
      reason: "projection_work",
      work: { visualAllocationsUpperBound: 10001 },
    });
  });
  it("accepts exactly 64 cells per measured box and rejects one extra cell row", () => {
    const a = input(1);
    a.pins = { "fact:0": { position: { x: 48, y: 48 }, sourceKey: "fact:0" } };
    a.measurements = { "fact:0": { width: 3999, height: 3999 } };
    expect(layoutVisibleOverview(a)).toMatchObject({
      status: "ready",
      geometry: {
        cellEntriesInserted: 64,
        liveCellEntries: 64,
        bucketEntryVisits: 64,
      },
    });
    a.measurements["fact:0"] = { width: 4000, height: 3999 };
    expect(layoutVisibleOverview(a)).toMatchObject({
      reason: "geometry_budget",
    });
  });
  it("enforces the 20000 simultaneous-entry cap independently of cumulative insertions", () => {
    const a = input(313);
    a.pins = Object.fromEntries(
      a.projection.nodes.map((n, i) => [
        n.id,
        { position: { x: 48, y: 48 + i * 5120 }, sourceKey: n.id },
      ]),
    );
    a.measurements = Object.fromEntries(
      a.projection.nodes.map((n, i) => [
        n.id,
        { width: 3999, height: i === 312 ? 1951 : 3999 },
      ]),
    );
    const accepted = layoutVisibleOverview(a);
    expect(accepted).toMatchObject({
      status: "ready",
      geometry: { liveCellEntries: 20000, cellEntriesInserted: 20000 },
    });
    a.measurements["fact:312"] = { width: 3999, height: 3999 };
    const rejected = layoutVisibleOverview(a);
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      stage: "pin_insert",
      geometry: { liveCellEntries: 20000, cellEntriesInserted: 20000 },
    });
    expect(rejected).not.toHaveProperty("positions");
  });
  it("caps affected IDs independently while retaining a complete exact pair count", () => {
    const a = input(140);
    a.pins = Object.fromEntries(
      a.projection.nodes.map((n, i) => [
        n.id,
        { position: { x: Math.floor(i / 2) * 512, y: 0 }, sourceKey: n.id },
      ]),
    );
    const out = layoutVisibleOverview(a);
    expect(out).toMatchObject({
      status: "ready",
      manualOverlaps: { pairsObserved: 70, complete: true, truncated: true },
      geometry: { manualPairObservations: 70 },
    });
    if (out.status === "ready") {
      expect(out.manualOverlaps.affectedPinIds).toHaveLength(64);
      expect(out.manualOverlaps.samplePairs).toHaveLength(32);
    }
  });
  it("stops at 32 real candidates for an auto obstructed by saved pins", () => {
    const a = input(33);
    a.pins = Object.fromEntries(
      a.projection.nodes
        .slice(1)
        .map((n, i) => [
          n.id,
          { position: { x: 0, y: i * 268 }, sourceKey: n.id },
        ]),
    );
    const out = layoutVisibleOverview(a);
    expect(out).toMatchObject({
      status: "rejected",
      reason: "geometry_budget",
      stage: "candidate_limit",
      geometry: { candidateProbes: 32 },
    });
    expect(out).not.toHaveProperty("positions");
  });
});

describe("Task3 independent-review regression", () => {
  it("uses the 360 by port-aware group fallback before any actual measurements", () => {
    const g = graph(4);
    g.relations = ["0", "1", "2"].map((id) => ({
      ...relation("r" + id),
      sourceId: id,
      targetId: "3",
    }));
    const projection = projectGroups(
      projectGraph(g, [], "fact", {}),
      [group("G", ["0", "1", "2"])],
      ["G"],
      {},
      "en",
    );
    expect(
      projection.nodes.find((n) => n.id === "group:G")!.data.group!.portIds,
    ).toHaveLength(3);
    const a = input(4);
    a.projection = projection;
    const out = layoutVisibleOverview(a);
    expect(out.status).toBe("ready");
    if (out.status === "ready")
      noCollision(out.positions, { "group:G": { width: 360, height: 400 } });
  });
  it("keeps raw-node count exact without inventing a visual lower bound", () => {
    const g = graph(301);
    expect(projectGraph(g, [], "plan", {}).nodes).toHaveLength(0);
    const estimate = estimateBaseVisualWork(g, [], "plan", []);
    expect(estimate).toMatchObject({
      status: "rejected",
      reason: "node_budget",
      counts: { graphNodes: 301 },
      nodesLowerBound: 0,
      countStatus: "partial_lower_bound",
    });
    expect(estimate).not.toHaveProperty("nodes");
  });
  it("keeps raw-relation count exact without inventing a visual lower bound", () => {
    const g = graph(1);
    g.relations = Array.from({ length: 901 }, (_, i) => ({
      ...relation(String(i)),
      targetId: null,
      resolution: "unresolved" as const,
    }));
    expect(projectGraph(g, [], "fact", {}).edges).toHaveLength(0);
    const estimate = estimateBaseVisualWork(g, [], "fact", []);
    expect(estimate).toMatchObject({
      status: "rejected",
      reason: "edge_budget",
      counts: { graphRelations: 901 },
      edgesLowerBound: 0,
      countStatus: "partial_lower_bound",
    });
    expect(estimate).not.toHaveProperty("edgeUpperBound");
  });
  it("rejects colliding opaque generated alias IDs during group preflight", () => {
    const g = graph();
    g.nodes = [node("c"), node("b:c")];
    const base = projectGraph(g, [], "fact", {}),
      groups = [group("a:b", ["c"]), group("a", ["b:c"])];
    const projection = projectGroups(base, groups, [], {}, "en");
    expect(
      projection.nodes.filter((n) => n.id === "group-member:a:b:c"),
    ).toHaveLength(2);
    const before = structuredClone({ base, groups });
    expect(estimateVisualWork(base, groups, [])).toMatchObject({
      status: "rejected",
      reason: "invalid_input",
    });
    expect({ base, groups }).toEqual(before);
  });
});
