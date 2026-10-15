import { describe, expect, it } from "vitest";
import {
  layoutProjectFacts,
  GLOBAL_GEOMETRY_LIMITS,
} from "./overview-layout.js";
import type { GlobalLayoutInput } from "./overview-layout.js";

function input(n = 3): GlobalLayoutInput {
  return {
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
      nodes: Array.from({ length: n }, (_, i) => ({
        id: `n${String(i).padStart(4, "0")}`,
        kind: "function",
      })),
      relations: [],
    },
    pins: {},
    retained: {},
  };
}
function edge(
  i: number,
  sourceId: string,
  targetId: string | null,
  type: "calls" | "imports" | "contains" = "calls",
  resolution: "resolved" | "unresolved" | "external" = "resolved",
) {
  return { id: `r${i}`, sourceId, targetId, type, resolution };
}
function addEdges(
  x: GlobalLayoutInput,
  edges: GlobalLayoutInput["target"]["relations"],
) {
  x.target.relations = edges;
  x.target.counts.relations = edges.length;
  return x;
}
describe("bounded deterministic global layout", () => {
  it("rejects the production rectangle-comparison cap in dense multi-cell pin insertion", () => {
    const x = input(1415);
    for (const n of x.target.nodes) x.pins[n.id] = { x: 400, y: 400 };
    const r = layoutProjectFacts(x);
    expect(r).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      stage: "pin_insertion",
      geometry: { rectangleComparisons: 1000000 },
      manualOverlaps: { pairsObserved: 0, complete: false },
    });
    expect(r).not.toHaveProperty("positions");
  });
  it("accepts empty facts and places structural parent cycles deterministically", () => {
    expect(layoutProjectFacts(input(0))).toMatchObject({
      status: "ready",
      order: [],
      positions: {},
    });
    const x = input(3);
    x.target.nodes[0]!.kind = "folder";
    x.target.nodes[1]!.kind = "file";
    x.target.nodes[0]!.parentId = "n0001";
    x.target.nodes[1]!.parentId = "n0000";
    x.target.counts.byKind = { function: 1, file: 1, folder: 1, external: 0 };
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.positions.n0000!.x).toBeGreaterThan(r.positions.n0002!.x);
    expect(r.positions.n0001!.y).toBeGreaterThan(r.positions.n0000!.y);
  });
  it("checks the 32-candidate per-node boundary without moving blockers", () => {
    for (const count of [31, 32]) {
      const x = input(count + 1);
      for (let i = 1; i <= count; i++)
        x.pins[`n${String(i).padStart(4, "0")}`] = { x: 0, y: (i - 1) * 300 };
      const before = structuredClone(x.pins),
        r = layoutProjectFacts(x);
      expect(x.pins).toEqual(before);
      if (count === 31) {
        expect(r).toMatchObject({
          status: "ready",
          stats: { geometry: { candidateProbes: 32 } },
        });
      } else {
        expect(r).toMatchObject({
          status: "rejected",
          reason: "work_budget",
          stage: "candidate_limit",
          geometry: { candidateProbes: 32 },
        });
        expect(r).not.toHaveProperty("positions");
      }
    }
  });
  it("bounds and counts repeated multi-cell bucket entries before pair dedup", () => {
    const x = input(2);
    x.pins = { n0000: { x: 400, y: 400 }, n0001: { x: 400, y: 400 } };
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.stats.geometry.cellEntriesInserted).toBe(8);
    expect(r.stats.geometry.bucketEntryVisits).toBe(20);
    expect(r.stats.geometry.rectangleComparisons).toBe(2);
    expect(r.manualOverlaps.pairsObserved).toBe(1);
    expect(layoutProjectFacts(x, { bucketEntryVisits: 20 }).status).toBe(
      "ready",
    );
    expect(layoutProjectFacts(x, { bucketEntryVisits: 19 })).toMatchObject({
      status: "rejected",
      geometry: { bucketEntryVisits: 19 },
      manualOverlaps: { complete: false },
    });
  });
  it("caps affected IDs independently of samples without hiding exact pair count", () => {
    const x = input(66);
    for (let i = 0; i < 66; i++)
      x.pins[`n${String(i).padStart(4, "0")}`] = {
        x: Math.floor(i / 2) * 600,
        y: 0,
      };
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.manualOverlaps).toMatchObject({
      pairsObserved: 33,
      complete: true,
      truncated: true,
    });
    expect(r.manualOverlaps.affectedPinIds).toHaveLength(64);
    expect(r.manualOverlaps.samplePairs).toHaveLength(32);
  });
  it("validates default rectangles and a required gap for every ready auto against all pins/autos", () => {
    const x = input(40);
    x.pins.n0000 = { x: 20, y: 35 };
    x.retained.n0001 = { x: 400, y: 0 };
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    const entries = Object.entries(r.positions);
    for (let i = 0; i < entries.length; i++)
      for (let j = i + 1; j < entries.length; j++) {
        const [a, p] = entries[i]!,
          [b, q] = entries[j]!;
        if (x.pins[a] && x.pins[b]) continue;
        expect(
          p.x + 300 + 48 <= q.x ||
            q.x + 300 + 48 <= p.x ||
            p.y + 220 + 48 <= q.y ||
            q.y + 220 + 48 <= p.y,
        ).toBe(true);
      }
  });
  it("handles the complete 5000 chain iteratively", () => {
    const x = input(5000);
    addEdges(
      x,
      x.target.nodes
        .slice(1)
        .map((n, i) => edge(i, x.target.nodes[i]!.id, n.id)),
    );
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.ranks.n4999).toBe(4999);
    expect(Object.keys(r.positions)).toHaveLength(5000);
    expect(r.stats.rawRelations).toBe(4999);
  });
  it("condenses cycles, deduplicates ranking only, excludes unknown/contains/external", () => {
    const x = input(4);
    x.target.nodes[3]!.kind = "external";
    x.target.counts.byKind.function = 3;
    x.target.counts.byKind.external = 1;
    addEdges(x, [
      edge(0, "n0000", "n0001"),
      edge(1, "n0001", "n0000"),
      edge(2, "n0001", "n0002"),
      edge(3, "n0001", "n0002"),
      edge(4, "n0002", "n0000", "contains"),
      edge(5, "n0002", null, "calls", "unresolved"),
      edge(6, "n0002", "n0003", "calls", "external"),
    ]);
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.ranks.n0000).toBe(r.ranks.n0001);
    expect(r.ranks.n0002).toBe(1);
    expect(r.stats.rankRelations).toBe(3);
    expect(r.stats.rawRelations).toBe(7);
  });
  it("is byte deterministic across shuffled arrays and leaves inputs intact", () => {
    const x = addEdges(input(9), [
      edge(0, "n0000", "n0005"),
      edge(1, "n0002", "n0005"),
      edge(2, "n0005", "n0008"),
    ]);
    x.pins.n0002 = { x: -800, y: 120 };
    const before = structuredClone(x);
    const first = layoutProjectFacts(x);
    const second = layoutProjectFacts({
      ...x,
      target: {
        ...x.target,
        nodes: [...x.target.nodes].reverse(),
        relations: [...x.target.relations].reverse(),
      },
    });
    expect(second).toEqual(first);
    expect(x).toEqual(before);
  });
  it("retains auto points; only conflicting autos move for a new pin", () => {
    const x = input();
    x.pins.n0000 = { x: 12, y: 20 };
    x.retained = {
      n0001: { x: 12, y: 20 },
      n0002: { x: 2000, y: 1000 },
      unknown: { x: 1, y: 2 },
    };
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.positions.n0000).toEqual(x.pins.n0000);
    expect(r.positions.n0001).not.toEqual(x.retained.n0001);
    expect(r.positions.n0002).toEqual(x.retained.n0002);
    expect(r.positions).not.toHaveProperty("unknown");
  });
  it.each([NaN, Infinity, Number.MAX_VALUE])(
    "rejects unsafe pin %s without partial positions",
    (x) => {
      const a = input();
      a.pins.n0000 = { x, y: 0 };
      const r = layoutProjectFacts(a);
      expect(r.status).toBe("rejected");
      expect(r).not.toHaveProperty("positions");
    },
  );
  it("ignores offscope positions without deleting them", () => {
    const x = input();
    x.pins.unknown = { x: NaN, y: 0 };
    expect(layoutProjectFacts(x).status).toBe("ready");
    expect(x.pins.unknown?.x).toBeNaN();
  });
  it("allows manual overlap with bounded exact diagnostics", () => {
    const x = input(12);
    for (const n of x.target.nodes) x.pins[n.id] = { x: 0, y: 0 };
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.manualOverlaps).toMatchObject({
      pairsObserved: 66,
      complete: true,
      truncated: true,
    });
    expect(r.manualOverlaps.samplePairs).toHaveLength(32);
    expect(r.stats.geometry.manualPairObservations).toBe(66);
    expect(r.stats.geometry.bucketEntryVisits).toBeGreaterThan(66);
    expect(r.stats.geometry.rectangleComparisons).toBe(132);
  });
  it("rejects production dense pins at the diagnostic cap with truthful lower bound", () => {
    const x = input(92);
    for (const n of x.target.nodes) x.pins[n.id] = { x: 0, y: 0 };
    const r = layoutProjectFacts(x);
    expect(r).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      geometry: { manualPairObservations: 4096 },
      manualOverlaps: { pairsObserved: 4096, complete: false },
    });
    expect(r).not.toHaveProperty("positions");
  });
  it("caps bucket visits even when same-cell manual pins do not overlap", () => {
    const x = input(2);
    x.pins = { n0000: { x: 0, y: 0 }, n0001: { x: 310, y: 0 } };
    const r = layoutProjectFacts(x, { bucketEntryVisits: 1 });
    expect(r).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      geometry: { bucketEntryVisits: 1, manualPairObservations: 0 },
    });
  });
  it.each([
    "candidateProbes",
    "cellEntriesInserted",
    "liveCellEntries",
    "bucketEntryVisits",
    "rectangleComparisons",
    "manualPairObservations",
  ] as const)(
    "honors lowered %s cap and never permits raising production limits",
    (key) => {
      const x = input(2);
      if (key === "manualPairObservations" || key === "rectangleComparisons") {
        x.pins = { n0000: { x: 0, y: 0 }, n0001: { x: 0, y: 0 } };
      }
      const zero = layoutProjectFacts(x, { [key]: 0 });
      expect(zero.status).toBe("rejected");
      expect(zero).not.toHaveProperty("positions");
      expect(
        layoutProjectFacts(x, { [key]: GLOBAL_GEOMETRY_LIMITS[key] + 1 }),
      ).toMatchObject({ status: "rejected", reason: "invalid_input" });
    },
  );
  it("counts exact insertion cap and cap+1, including final validation", () => {
    const x = input(1);
    x.pins.n0000 = { x: 0, y: 0 };
    const base = layoutProjectFacts(x);
    expect(base.status).toBe("ready");
    if (base.status !== "ready") return;
    const cap = base.stats.geometry.cellEntriesInserted;
    expect(layoutProjectFacts(x, { cellEntriesInserted: cap }).status).toBe(
      "ready",
    );
    expect(
      layoutProjectFacts(x, { cellEntriesInserted: cap - 1 }),
    ).toMatchObject({
      status: "rejected",
      reason: "work_budget",
      geometry: { cellEntriesInserted: cap - 1 },
    });
  });
  it("checks final comparisons at exact cap", () => {
    const x = input(2);
    x.pins = { n0000: { x: 0, y: 0 }, n0001: { x: 0, y: 0 } };
    expect(
      layoutProjectFacts(x, {
        rectangleComparisons: 2,
        manualPairObservations: 1,
      }).status,
    ).toBe("ready");
    expect(layoutProjectFacts(x, { rectangleComparisons: 0 })).toMatchObject({
      status: "rejected",
      geometry: { rectangleComparisons: 0 },
    });
  });
  it("handles 20000 high-degree/long raw edges without geometric edge sampling", () => {
    const x = input(5000);
    addEdges(
      x,
      Array.from({ length: 20000 }, (_, i) =>
        edge(i, "n0000", `n${String((i % 4999) + 1).padStart(4, "0")}`),
      ),
    );
    const r = layoutProjectFacts(x);
    expect(r.status).toBe("ready");
    if (r.status !== "ready") return;
    expect(r.stats.rawRelations).toBe(20000);
    expect(r.stats.rankRelations).toBe(4999);
  });
  it("rejects malformed complete target or unknown pin shape", () => {
    const x = input();
    x.target.counts.nodes = 4;
    expect(layoutProjectFacts(x)).toMatchObject({
      status: "rejected",
      reason: "invalid_input",
    });
  });
});
