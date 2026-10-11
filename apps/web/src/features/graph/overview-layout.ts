import { validateLayoutTarget } from "../../api/layout-target.js";
import type { LayoutTargetResult } from "../../api/layout-target.js";

export type XY = { x: number; y: number };
export type GlobalLayoutInput = {
  target: Extract<LayoutTargetResult, { status: "ready" }>;
  pins: Record<string, XY>;
  retained: Record<string, XY>;
};
export type GeometryWork = {
  candidateProbes: number;
  cellEntriesInserted: number;
  liveCellEntries: number;
  bucketEntryVisits: number;
  rectangleComparisons: number;
  manualPairObservations: number;
  passes: number;
};
export type ManualOverlapDiagnostics = {
  affectedPinIds: string[];
  samplePairs: [string, string][];
  pairsObserved: number;
  complete: boolean;
  truncated: boolean;
};
export type GlobalLayoutResult =
  | {
      status: "ready";
      positions: Record<string, XY>;
      ranks: Record<string, number>;
      order: string[];
      stats: {
        nodes: number;
        rawRelations: number;
        rankRelations: number;
        sccs: number;
        geometry: GeometryWork;
      };
      manualOverlaps: ManualOverlapDiagnostics;
    }
  | {
      status: "rejected";
      reason: "invalid_input" | "work_budget" | "geometry_budget";
      stage: string;
      geometry: GeometryWork;
      manualOverlaps: ManualOverlapDiagnostics;
    };
export const GLOBAL_GEOMETRY_LIMITS = Object.freeze({
  candidateProbes: 160000,
  cellEntriesInserted: 200000,
  liveCellEntries: 200000,
  bucketEntryVisits: 4000000,
  rectangleComparisons: 1000000,
  manualPairObservations: 4096,
});
type Caps = { -readonly [K in keyof typeof GLOBAL_GEOMETRY_LIMITS]: number };
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
class BudgetFailure {
  constructor(
    readonly reason: "work_budget" | "geometry_budget",
    readonly stage: string,
  ) {}
}
const zeroWork = (): GeometryWork => ({
  candidateProbes: 0,
  cellEntriesInserted: 0,
  liveCellEntries: 0,
  bucketEntryVisits: 0,
  rectangleComparisons: 0,
  manualPairObservations: 0,
  passes: 0,
});
const emptyDiagnostics = (): ManualOverlapDiagnostics => ({
  affectedPinIds: [],
  samplePairs: [],
  pairsObserved: 0,
  complete: false,
  truncated: false,
});
type Box = XY & { id: string; manual: boolean };

/** One job-wide occupancy index. No bucket flatten/copy or unmetered all-pairs
 * pass: even repeated/self entries consume visits before ID deduplication. */
class Geometry {
  readonly work = zeroWork();
  readonly diagnostics = emptyDiagnostics();
  readonly boxes = new Map<string, Box>();
  private readonly buckets = new Map<string, Box[]>();
  constructor(private readonly caps: Caps) {
    this.work.passes = 1;
  }
  tick(key: keyof Caps, stage: string) {
    if (this.work[key] >= this.caps[key])
      throw new BudgetFailure("work_budget", stage);
    this.work[key]++;
  }
  private bounds(box: XY, gap: number, stage: string) {
    const left = box.x - gap,
      top = box.y - gap,
      right = box.x + 300 + gap,
      bottom = box.y + 220 + gap;
    const x0 = Math.floor(left / 512),
      x1 = Math.floor(right / 512),
      y0 = Math.floor(top / 512),
      y1 = Math.floor(bottom / 512);
    if (
      ![box.x, box.y, left, top, right, bottom].every(Number.isFinite) ||
      ![x0, x1, y0, y1].every(Number.isSafeInteger) ||
      x1 < x0 ||
      y1 < y0 ||
      (x1 - x0 + 1) * (y1 - y0 + 1) > 64 ||
      right <= left ||
      bottom <= top
    )
      throw new BudgetFailure("geometry_budget", stage);
    // Coordinates themselves must retain sub-card precision: safe cell indices
    // alone do not prove x+width differs from x at huge magnitudes.
    if (
      Math.abs(left) > Number.MAX_SAFE_INTEGER ||
      Math.abs(right) > Number.MAX_SAFE_INTEGER ||
      Math.abs(top) > Number.MAX_SAFE_INTEGER ||
      Math.abs(bottom) > Number.MAX_SAFE_INTEGER
    )
      throw new BudgetFailure("geometry_budget", stage);
    return { x0, x1, y0, y1 };
  }
  validate(point: XY, stage: string) {
    this.bounds(point, 48, stage);
  }
  insert(box: Box, stage: string) {
    const b = this.bounds(box, 0, stage);
    for (let x = b.x0; x <= b.x1; x++)
      for (let y = b.y0; y <= b.y1; y++) {
        // Preflight BOTH counters before any append; no temporary entry arrays.
        if (
          this.work.liveCellEntries >= this.caps.liveCellEntries ||
          this.work.cellEntriesInserted >= this.caps.cellEntriesInserted
        )
          throw new BudgetFailure("work_budget", stage);
        this.tick("cellEntriesInserted", stage);
        this.tick("liveCellEntries", stage);
        const key = `${x}:${y}`;
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = [];
          this.buckets.set(key, bucket);
        }
        bucket.push(box);
      }
    this.boxes.set(box.id, box);
  }
  query(box: Box, stage: string, final = false): boolean {
    const b = this.bounds(box, 48, stage),
      visited = new Set<string>();
    for (let x = b.x0; x <= b.x1; x++)
      for (let y = b.y0; y <= b.y1; y++) {
        const bucket = this.buckets.get(`${x}:${y}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          this.tick("bucketEntryVisits", stage);
          const other = bucket[i]!;
          if (other.id === box.id || visited.has(other.id)) continue;
          visited.add(other.id);
          if (final && compare(other.id, box.id) <= 0) continue;
          this.tick("rectangleComparisons", stage);
          const manualPair = box.manual && other.manual,
            gap = manualPair ? 0 : 48;
          const hit =
            box.x - gap < other.x + 300 &&
            box.x + 300 + gap > other.x &&
            box.y - gap < other.y + 220 &&
            box.y + 220 + gap > other.y;
          if (!hit) continue;
          if (manualPair) {
            if (final) {
              this.tick("manualPairObservations", stage);
              this.diagnostics.pairsObserved++;
              if (this.diagnostics.samplePairs.length < 32)
                this.diagnostics.samplePairs.push([box.id, other.id]);
              else this.diagnostics.truncated = true;
              for (const id of [box.id, other.id]) {
                if (this.diagnostics.affectedPinIds.includes(id)) continue;
                if (this.diagnostics.affectedPinIds.length < 64)
                  this.diagnostics.affectedPinIds.push(id);
                else this.diagnostics.truncated = true;
              }
            }
          } else return true;
        }
      }
    return false;
  }
  finish(order: readonly string[]) {
    for (const id of order)
      if (this.query(this.boxes.get(id)!, "final_validation", true))
        throw new BudgetFailure("geometry_budget", "final_validation");
    this.diagnostics.affectedPinIds.sort(compare);
    this.diagnostics.complete = true;
  }
}

/** Stable minimum heap gives deterministic ID-priority Kahn order without a
 * shift/splice of the whole queue for each component. */
class MinHeap {
  private values: number[] = [];
  constructor(private readonly keys: readonly string[]) {}
  push(v: number) {
    let i = this.values.length;
    this.values.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (compare(this.keys[this.values[p]!]!, this.keys[v]!) <= 0) break;
      this.values[i] = this.values[p]!;
      i = p;
    }
    this.values[i] = v;
  }
  pop(): number | undefined {
    if (!this.values.length) return undefined;
    const result = this.values[0]!,
      last = this.values.pop()!;
    if (this.values.length) {
      let i = 0;
      while (2 * i + 1 < this.values.length) {
        let child = 2 * i + 1;
        if (
          child + 1 < this.values.length &&
          compare(
            this.keys[this.values[child + 1]!]!,
            this.keys[this.values[child]!]!,
          ) < 0
        )
          child++;
        if (compare(this.keys[last]!, this.keys[this.values[child]!]!) <= 0)
          break;
        this.values[i] = this.values[child]!;
        i = child;
      }
      this.values[i] = last;
    }
    return result;
  }
}

function topology(target: GlobalLayoutInput["target"]) {
  const nodes = [...target.nodes].sort((a, b) => compare(a.id, b.id));
  const indices = new Map(nodes.map((n, i) => [n.id, i]));
  const adj: number[][] = nodes.map(() => []),
    reverse: number[][] = nodes.map(() => []),
    seen = nodes.map(() => new Set<number>());
  let rankRelations = 0;
  for (const r of target.relations) {
    if (
      r.resolution !== "resolved" ||
      r.type === "contains" ||
      r.targetId === null
    )
      continue;
    const a = indices.get(r.sourceId)!,
      b = indices.get(r.targetId)!;
    if (
      nodes[a]!.kind === "external" ||
      nodes[b]!.kind === "external" ||
      seen[a]!.has(b)
    )
      continue;
    seen[a]!.add(b);
    adj[a]!.push(b);
    reverse[b]!.push(a);
    rankRelations++;
  }
  // Adjacency need not be sorted: SCC membership/ranks are invariant under
  // visit order; public output is sorted by IDs and heap keys. Avoid E log V
  // adjacency sorting while preserving shuffled-input deterministic results.
  // Iterative Kosaraju: depth is bounded by nodes, not the JS call stack.
  const visited = new Uint8Array(nodes.length),
    finish: number[] = [];
  for (let root = 0; root < nodes.length; root++) {
    if (visited[root]) continue;
    visited[root] = 1;
    const stack: { node: number; next: number }[] = [{ node: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      const next = adj[frame.node]![frame.next++];
      if (next === undefined) {
        finish.push(frame.node);
        stack.pop();
      } else if (!visited[next]) {
        visited[next] = 1;
        stack.push({ node: next, next: 0 });
      }
    }
  }
  const comp = new Int32Array(nodes.length).fill(-1),
    components: number[][] = [];
  for (let i = finish.length - 1; i >= 0; i--) {
    const root = finish[i]!;
    if (comp[root] !== -1) continue;
    const c = components.length,
      members: number[] = [],
      stack = [root];
    comp[root] = c;
    while (stack.length) {
      const v = stack.pop()!;
      members.push(v);
      for (const u of reverse[v]!)
        if (comp[u] === -1) {
          comp[u] = c;
          stack.push(u);
        }
    }
    members.sort((a, b) => a - b);
    components.push(members);
  }
  const keys = components.map((c) => nodes[c[0]!]!.id),
    dag = components.map(() => new Set<number>()),
    indegree = new Int32Array(components.length),
    rank = new Int32Array(components.length);
  for (let a = 0; a < nodes.length; a++)
    for (const b of adj[a]!)
      if (comp[a] !== comp[b] && !dag[comp[a]!]!.has(comp[b]!)) {
        dag[comp[a]!]!.add(comp[b]!);
        indegree[comp[b]!]!++;
      }
  const heap = new MinHeap(keys);
  for (let c = 0; c < components.length; c++) if (!indegree[c]) heap.push(c);
  for (let c = heap.pop(); c !== undefined; c = heap.pop())
    for (const d of dag[c]!) {
      rank[d] = Math.max(rank[d]!, rank[c]! + 1);
      indegree[d]!--;
      if (!indegree[d]) heap.push(d);
    }
  const ranks: Record<string, number> = Object.create(null);
  for (let i = 0; i < nodes.length; i++) ranks[nodes[i]!.id] = rank[comp[i]!]!;
  const levels = new Map<number, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const r = ranks[nodes[i]!.id]!;
    let level = levels.get(r);
    if (!level) {
      level = [];
      levels.set(r, level);
    }
    level.push(i);
  }
  const levelKeys = [...levels.keys()].sort((a, b) => a - b);
  // Exactly two neighborhood-average sweeps. Stable ID breaks every tie.
  for (const forward of [true, false]) {
    const ordinal = new Int32Array(nodes.length);
    let seq = 0;
    for (const r of levelKeys)
      for (const i of levels.get(r)!) ordinal[i] = seq++;
    for (const r of forward ? levelKeys : [...levelKeys].reverse()) {
      const level = levels.get(r)!;
      const scores = new Map<number, number>();
      for (const i of level) {
        const neighbors = forward ? reverse[i]! : adj[i]!;
        let sum = 0,
          count = 0;
        for (const u of neighbors)
          if (comp[u] !== comp[i]) {
            sum += ordinal[u]!;
            count++;
          }
        scores.set(i, count ? sum / count : ordinal[i]!);
      }
      level.sort(
        (a, b) =>
          scores.get(a)! - scores.get(b)! ||
          compare(nodes[a]!.id, nodes[b]!.id),
      );
    }
  }
  const order = levelKeys.flatMap((r) =>
    levels.get(r)!.map((i) => nodes[i]!.id),
  );
  // Separate structure band, using stable parent-child traversal. Cycles and
  // parents outside this band become deterministic remaining roots.
  const structural = nodes.filter(
      (n) => n.kind === "file" || n.kind === "folder",
    ),
    structureIds = new Set(structural.map((n) => n.id)),
    children = new Map<string, string[]>();
  for (const n of structural)
    if (n.parentId && structureIds.has(n.parentId)) {
      let c = children.get(n.parentId);
      if (!c) {
        c = [];
        children.set(n.parentId, c);
      }
      c.push(n.id);
    }
  const structureOrder: string[] = [],
    walked = new Set<string>();
  const walk = (root: string) => {
    const stack = [root];
    while (stack.length) {
      const id = stack.pop()!;
      if (walked.has(id)) continue;
      walked.add(id);
      structureOrder.push(id);
      const c = children.get(id);
      if (c) for (let i = c.length - 1; i >= 0; i--) stack.push(c[i]!);
    }
  };
  for (const n of structural)
    if (!n.parentId || !structureIds.has(n.parentId)) walk(n.id);
  for (const n of structural) walk(n.id);
  return {
    nodes,
    ranks,
    order,
    structureOrder,
    rankRelations,
    sccs: components.length,
  };
}

/** The optional limits may only REDUCE production caps (adversarial tests and
 * conservative callers). A caller can never increase the hard work budget. */
export function layoutProjectFacts(
  input: GlobalLayoutInput,
  reducedCaps: Partial<Caps> = {},
): GlobalLayoutResult {
  const caps: Caps = { ...GLOBAL_GEOMETRY_LIMITS };
  let geometry = new Geometry(caps);
  const reject = (
    reason: "invalid_input" | "work_budget" | "geometry_budget",
    stage: string,
  ): GlobalLayoutResult => ({
    status: "rejected",
    reason,
    stage,
    geometry: { ...geometry.work },
    manualOverlaps: { ...geometry.diagnostics, complete: false },
  });
  try {
    for (const k of Object.keys(reducedCaps)) {
      if (!Object.hasOwn(caps, k)) return reject("invalid_input", "limits");
      const key = k as keyof Caps,
        v = reducedCaps[key];
      if (
        typeof v !== "number" ||
        !Number.isSafeInteger(v) ||
        v < 0 ||
        v > caps[key]
      )
        return reject("invalid_input", "limits");
      caps[key] = v;
    }
    geometry = new Geometry(caps);
    if (
      !input ||
      !input.target ||
      !input.pins ||
      !input.retained ||
      typeof input.pins !== "object" ||
      Array.isArray(input.pins) ||
      typeof input.retained !== "object" ||
      Array.isArray(input.retained)
    )
      return reject("invalid_input", "input");
    validateLayoutTarget(input.target, {
      projectId: input.target.projectId,
      snapshotId: input.target.snapshotId,
      contentHash: input.target.contentHash,
    });
    if (input.target.status !== "ready")
      return reject("invalid_input", "input");
    const t = topology(input.target),
      stableIDs = t.nodes.map((n) => n.id),
      positions: Record<string, XY> = Object.create(null);
    // Read only known IDs: opaque/offscope saved keys remain untouched.
    const point = (map: Record<string, XY>, id: string): XY | undefined => {
      if (!Object.hasOwn(map, id)) return undefined;
      const p = map[id];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number")
        throw new BudgetFailure("geometry_budget", "position_input");
      geometry.validate(p, "position_input");
      return { x: p.x, y: p.y };
    };
    for (const id of stableIDs) {
      const p = point(input.pins, id);
      if (p) {
        const box = { ...p, id, manual: true };
        geometry.query(box, "pin_insertion");
        geometry.insert(box, "pin_insertion");
        positions[id] = p;
      }
    }
    for (const id of stableIDs) {
      if (Object.hasOwn(positions, id)) continue;
      const p = point(input.retained, id);
      if (p) {
        const box = { ...p, id, manual: false };
        if (!geometry.query(box, "retained_reconciliation")) {
          geometry.insert(box, "retained_insertion");
          positions[id] = p;
        }
      }
    }
    const nodeById = new Map(t.nodes.map((n) => [n.id, n])),
      rows = new Map<number, number>(),
      seeds = new Map<string, XY>();
    let maxRank = 0;
    for (const id of t.order) {
      const node = nodeById.get(id)!;
      if (node.kind !== "function") continue;
      const r = t.ranks[id]!,
        row = rows.get(r) ?? 0;
      rows.set(r, row + 1);
      seeds.set(id, { x: r * 400, y: row * 300 });
      maxRank = Math.max(maxRank, r);
    }
    t.structureOrder.forEach((id, i) =>
      seeds.set(id, { x: (maxRank + 2) * 400, y: i * 300 }),
    );
    t.nodes
      .filter((n) => n.kind === "external")
      .forEach((n, i) =>
        seeds.set(n.id, { x: (maxRank + 4) * 400, y: i * 300 }),
      );
    for (const id of t.order) {
      if (Object.hasOwn(positions, id)) continue;
      const seed = seeds.get(id)!;
      let placed = false;
      for (let attempt = 0; attempt < 32; attempt++) {
        geometry.tick("candidateProbes", "candidate_search");
        const p = { x: seed.x, y: seed.y + attempt * 300 },
          box = { ...p, id, manual: false };
        if (geometry.query(box, "candidate_search")) continue;
        geometry.insert(box, "auto_insertion");
        positions[id] = p;
        placed = true;
        break;
      }
      if (!placed) throw new BudgetFailure("work_budget", "candidate_limit");
    }
    geometry.finish(stableIDs);
    return {
      status: "ready",
      positions,
      ranks: t.ranks,
      order: t.order,
      stats: {
        nodes: t.nodes.length,
        rawRelations: input.target.relations.length,
        rankRelations: t.rankRelations,
        sccs: t.sccs,
        geometry: { ...geometry.work },
      },
      manualOverlaps: geometry.diagnostics,
    };
  } catch (error) {
    if (error instanceof BudgetFailure)
      return reject(error.reason, error.stage);
    return reject("invalid_input", "input");
  }
}
