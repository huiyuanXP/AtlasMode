import type {
  CodeNode,
  FunctionGroup,
  Operation,
  SubgraphResult,
  ViewState,
} from "@codemap/core";
import type { GraphNode, LayerFilter, projectGraph } from "./projection.js";
import type {
  GeometryWork,
  GlobalLayoutResult,
  ManualOverlapDiagnostics,
  XY,
} from "./overview-layout.js";

export type Projection = ReturnType<typeof projectGraph>;
export type LayoutBox = { width: number; height: number };
export type ProjectionWork = {
  operationVisits: number;
  relationVisits: number;
  referenceVisits: number;
  membershipVisits: number;
  projectionStepsUpperBound: number;
  visualAllocationsUpperBound: number;
};
export type ProjectionEstimate = {
  counts: {
    graphNodes: number;
    graphRelations: number;
    storedOperations: number;
    visibleOperations: number;
    referenceNodes: number;
  };
  work: ProjectionWork;
} & (
  | {
      status: "ready";
      countStatus: "complete";
      nodes: number;
      edgeUpperBound: number;
    }
  | {
      status: "rejected";
      reason:
        | "node_budget"
        | "edge_budget"
        | "operation_budget"
        | "reference_budget"
        | "projection_work"
        | "membership_work"
        | "invalid_input";
      countStatus: "complete" | "partial_lower_bound";
      nodes?: number;
      edgeUpperBound?: number;
      nodesLowerBound: number;
      edgesLowerBound: number;
    }
);
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const workZero = (): ProjectionWork => ({
  operationVisits: 0,
  relationVisits: 0,
  referenceVisits: 0,
  membershipVisits: 0,
  projectionStepsUpperBound: 0,
  visualAllocationsUpperBound: 0,
});
const saturated = (value: number, cap: number) => Math.min(cap + 1, value);

/** Bounded ID/count indexes only: never invokes projection or allocates cards,
 * routes, changes or notices. Source lengths remain exact on an early stop. */
export function estimateBaseVisualWork(
  graph: SubgraphResult | undefined,
  operations: readonly Operation[],
  filter: LayerFilter,
  referenceNodes: readonly CodeNode[],
): ProjectionEstimate {
  const counts = {
    graphNodes: graph?.nodes.length ?? 0,
    graphRelations: graph?.relations.length ?? 0,
    storedOperations: operations.length,
    visibleOperations: filter === "fact" ? 0 : operations.length,
    referenceNodes: referenceNodes.length,
  };
  const work = workZero();
  let nodes = 0,
    edges = 0;
  const reject = (
    reason: Extract<ProjectionEstimate, { status: "rejected" }>["reason"],
    complete = false,
  ): ProjectionEstimate => ({
    status: "rejected",
    reason,
    countStatus: complete ? "complete" : "partial_lower_bound",
    counts,
    work,
    nodesLowerBound: nodes,
    edgesLowerBound: edges,
    ...(complete ? { nodes, edgeUpperBound: edges } : {}),
  });
  if (counts.visibleOperations > 4096) return reject("operation_budget");
  // Raw source lengths are exact counts, not proven visual emissions. At a
  // length-only gate no cards/routes have been counted, so lower bounds stay 0.
  if (counts.graphNodes > 300) return reject("node_budget");
  if (counts.graphRelations > 900) return reject("edge_budget");
  if (counts.referenceNodes > 500) return reject("reference_budget");
  const ops = filter === "fact" ? [] : operations;
  const relations = new Map<string, SubgraphResult["relations"][number]>();
  for (const relation of graph?.relations ?? []) {
    work.relationVisits++;
    if (!relations.has(relation.id)) relations.set(relation.id, relation);
  }
  const referenced = new Set<string>(),
    additions = new Map<string, number>(),
    moves = new Map<string, number>(),
    changes = new Map<string, number>();
  let added = 0,
    removed = 0;
  for (const op of ops) {
    work.operationVisits++;
    if ("nodeId" in op) referenced.add(op.nodeId);
    if ("sourceId" in op) referenced.add(op.sourceId);
    if ("targetId" in op) referenced.add(op.targetId);
    if (op.kind === "remove_relation") {
      removed++;
      const relation = relations.get(op.relationId);
      if (relation) {
        referenced.add(relation.sourceId);
        if (relation.targetId) referenced.add(relation.targetId);
      }
    }
    if (op.kind === "add_function") {
      added++;
      additions.set(op.tempId, (additions.get(op.tempId) ?? 0) + 1);
    }
    if (op.kind === "move_function")
      moves.set(op.nodeId, (moves.get(op.nodeId) ?? 0) + 1);
    const changed =
      op.kind === "annotate"
        ? op.targetId
        : op.kind === "move_function" || op.kind === "remove_function"
          ? op.nodeId
          : undefined;
    if (changed !== undefined)
      changes.set(changed, (changes.get(changed) ?? 0) + 1);
  }
  const visualIds = new Set<string>(),
    present = new Set<string>(),
    facts = new Set<string>(),
    graphIds = new Set<string>();
  let matchingMoves = 0,
    changeEntries = 0;
  const emit = (id: string, planned: boolean) => {
    const visual = `${planned ? "plan" : "fact"}:${id}`;
    if (visualIds.has(visual)) return "invalid_input" as const;
    visualIds.add(visual);
    present.add(id);
    if (!planned) facts.add(id);
    nodes++;
    matchingMoves += moves.get(id) ?? 0;
    changeEntries += changes.get(id) ?? 0;
    return nodes > 500 ? ("node_budget" as const) : undefined;
  };
  for (const node of graph?.nodes ?? []) {
    if (graphIds.has(node.id)) return reject("invalid_input");
    graphIds.add(node.id);
    if (filter !== "plan" || referenced.has(node.id)) {
      const reason = emit(node.id, false);
      if (reason) return reject(reason);
    }
  }
  for (const [id, count] of additions) {
    if (count > 1) return reject("invalid_input");
    const reason = emit(id, true);
    if (reason) return reject(reason);
  }
  for (const node of referenceNodes) {
    work.referenceVisits++;
    if (referenced.has(node.id) && !present.has(node.id)) {
      const reason = emit(node.id, false);
      if (reason) return reject(reason);
    }
  }
  const edgeIds = new Set<string>();
  let factEdges = 0;
  const edge = (id: string) => {
    if (edgeIds.has(id)) return "invalid_input" as const;
    edgeIds.add(id);
    edges++;
    return edges > 2000 ? ("edge_budget" as const) : undefined;
  };
  if (filter !== "plan")
    for (const relation of graph?.relations ?? []) {
      work.relationVisits++;
      if (
        relation.targetId &&
        facts.has(relation.sourceId) &&
        facts.has(relation.targetId)
      ) {
        factEdges++;
        const reason = edge(`fact:${relation.id}`);
        if (reason) return reject(reason);
      }
    }
  for (const op of ops) {
    work.operationVisits++;
    if (
      op.kind === "add_relation" &&
      present.has(op.sourceId) &&
      present.has(op.targetId)
    ) {
      const reason = edge(`plan:${op.id}`);
      if (reason) return reject(reason);
    }
  }
  const p = counts.visibleOperations,
    r = counts.graphRelations;
  work.projectionStepsUpperBound = saturated(
    16 * (counts.graphNodes + r + counts.referenceNodes + p + nodes + edges) +
      nodes * p +
      matchingMoves * p +
      2 * added * p +
      removed * r +
      factEdges * p,
    2000000,
  );
  // R+P bounds notices even when missing endpoints or unresolved facts coexist.
  work.visualAllocationsUpperBound = saturated(
    nodes + edges + r + p + changeEntries,
    10000,
  );
  if (
    work.projectionStepsUpperBound > 2000000 ||
    work.visualAllocationsUpperBound > 10000
  )
    return reject("projection_work", true);
  return {
    status: "ready",
    countStatus: "complete",
    counts,
    work,
    nodes,
    edgeUpperBound: edges,
  };
}

/** Uses the same loaded function/intersection rules as GRP02, without its
 * nested group/route scans or any expanded projection allocation. */
export function estimateVisualWork(
  base: Projection,
  groups: readonly FunctionGroup[],
  collapsedIds: readonly string[],
): ProjectionEstimate {
  const counts = {
      graphNodes: base.nodes.length,
      graphRelations: base.edges.length,
      storedOperations: 0,
      visibleOperations: 0,
      referenceNodes: 0,
    },
    work = workZero();
  let nodes = 0,
    edges = 0;
  const reject = (
    reason: Extract<ProjectionEstimate, { status: "rejected" }>["reason"],
    complete = false,
  ): ProjectionEstimate => ({
    status: "rejected",
    reason,
    countStatus: complete ? "complete" : "partial_lower_bound",
    counts,
    work,
    nodesLowerBound: nodes,
    edgesLowerBound: edges,
    ...(complete ? { nodes, edgeUpperBound: edges } : {}),
  });
  if (groups.length > 4096 || collapsedIds.length > 4096)
    return reject("membership_work");
  let memberLengths = 0;
  for (const group of groups) {
    memberLengths += group.memberIds.length;
    if (memberLengths > 20000) return reject("membership_work");
  }
  if (base.nodes.length > 500) {
    nodes = base.nodes.length;
    return reject("node_budget");
  }
  if (base.edges.length > 2000) {
    edges = base.edges.length;
    return reject("edge_budget");
  }
  const byVisual = new Map<string, GraphNode>(),
    facts = new Set<string>();
  for (const node of base.nodes) {
    if (byVisual.has(node.id)) return reject("invalid_input");
    byVisual.set(node.id, node);
    if (node.data.layer !== "plan" && node.data.node.kind === "function")
      facts.add(node.data.node.id);
  }
  const collapsed = new Set(collapsedIds),
    memberships = new Map<string, Set<string>>(),
    groupIds = new Set<string>(),
    projectedIds = new Set<string>();
  let active = 0,
    loadedEntries = 0,
    activeMemberLengths = 0,
    membershipCopies = 0;
  for (const group of groups) {
    if (groupIds.has(group.id)) return reject("invalid_input");
    groupIds.add(group.id);
    const loaded = new Set<string>();
    for (const id of group.memberIds) {
      work.membershipVisits++;
      if (facts.has(id)) loaded.add(id);
    }
    if (!loaded.size) continue;
    active++;
    activeMemberLengths += group.memberIds.length;
    loadedEntries += loaded.size;
    nodes += 1 + (collapsed.has(group.id) ? 0 : loaded.size);
    if (nodes > 500) return reject("node_budget");
    const headerId = `group:${group.id}`;
    if (projectedIds.has(headerId)) return reject("invalid_input");
    projectedIds.add(headerId);
    // Treat opaque IDs exactly as GRP02 does: concatenation can collide even
    // when domain/group IDs are distinct. Validate without splitting/renaming,
    // using at most the accepted 500 visual IDs and no projected card arrays.
    if (!collapsed.has(group.id))
      for (const id of loaded) {
        const aliasId = `group-member:${group.id}:${id}`;
        if (projectedIds.has(aliasId)) return reject("invalid_input");
        projectedIds.add(aliasId);
      }
    for (const id of loaded) {
      let member = memberships.get(id);
      if (!member) {
        member = new Set();
        memberships.set(id, member);
      }
      membershipCopies += member.size + 1;
      member.add(group.id);
    }
  }
  for (const node of base.nodes) {
    if (node.data.layer === "plan" || !memberships.has(node.data.node.id)) {
      nodes++;
      if (nodes > 500) return reject("node_budget");
      if (projectedIds.has(node.id)) return reject("invalid_input");
      projectedIds.add(node.id);
    }
  }
  let affectedUpperBound = 0;
  for (const edge of base.edges) {
    work.relationVisits++;
    const from = byVisual.get(edge.source),
      to = byVisual.get(edge.target);
    if (!from || !to) continue;
    const sourceGroups =
      from.data.layer === "plan"
        ? 0
        : (memberships.get(from.data.node.id)?.size ?? 0);
    const targetGroups =
      to.data.layer === "plan"
        ? 0
        : (memberships.get(to.data.node.id)?.size ?? 0);
    // The union cannot exceed this sum; routes add one canonical route, never
    // a Cartesian product of source and target groups.
    const routeBound = 1 + sourceGroups + targetGroups;
    edges += routeBound;
    affectedUpperBound += sourceGroups + targetGroups;
    if (edges > 2000) return reject("edge_budget");
  }
  work.projectionStepsUpperBound = saturated(
    64 *
      (base.nodes.length +
        base.edges.length +
        groups.length +
        collapsedIds.length +
        work.membershipVisits +
        nodes +
        edges) +
      4 * edges * (base.nodes.length + base.edges.length + nodes),
    2000000,
  );
  // Source Set/ids arrays, loaded/membership entries, node/index collections,
  // affected/routes/internal-ID/port entries and existing notices. This is a
  // conservative entry bound, not an allocation measurement or byte count.
  work.visualAllocationsUpperBound = saturated(
    4 * base.nodes.length +
      2 * activeMemberLengths +
      4 * loadedEntries +
      membershipCopies +
      active +
      nodes +
      8 * edges +
      3 * affectedUpperBound +
      base.notices.length,
    10000,
  );
  if (
    work.projectionStepsUpperBound > 2000000 ||
    work.visualAllocationsUpperBound > 10000
  )
    return reject("projection_work", true);
  return {
    status: "ready",
    countStatus: "complete",
    counts,
    work,
    nodes,
    edgeUpperBound: edges,
  };
}

export function resolveVisualPins(
  nodes: readonly GraphNode[],
  groups: readonly FunctionGroup[],
  saved: ViewState["positions"],
): Record<string, { position: XY; sourceKey: string }> {
  const first = new Map<string, string>(),
    loaded = new Set(
      nodes
        .filter(
          (n) =>
            n.data.layer !== "plan" &&
            !n.data.group &&
            n.data.node.kind === "function",
        )
        .map((n) => n.data.node.id),
    );
  for (const group of [...groups]
    .filter((g) => g.memberIds.some((id) => loaded.has(id)))
    .sort((a, b) => a.id.localeCompare(b.id)))
    for (const id of group.memberIds)
      if (loaded.has(id) && !first.has(id)) first.set(id, group.id);
  const pins: ReturnType<typeof resolveVisualPins> = {};
  for (const node of nodes) {
    let sourceKey = node.id;
    if (
      !Object.hasOwn(saved, sourceKey) &&
      node.data.groupId &&
      first.get(node.data.node.id) === node.data.groupId
    )
      sourceKey = `fact:${node.data.node.id}`;
    if (Object.hasOwn(saved, sourceKey))
      pins[node.id] = { position: { ...saved[sourceKey]! }, sourceKey };
  }
  return pins;
}

const LOCAL_CAPS = {
  candidateProbes: 32000,
  cellEntriesInserted: 40000,
  liveCellEntries: 20000,
  bucketEntryVisits: 200000,
  rectangleComparisons: 50000,
  manualPairObservations: 256,
} as const;
type CapKey = keyof typeof LOCAL_CAPS;
type Box = XY & LayoutBox & { id: string; manual: boolean };
class GeometryFailure {
  constructor(
    readonly reason: "work_budget" | "geometry_budget",
    readonly stage: string,
  ) {}
}
/** Same accounting contract as Task2; measurements and job-wide accumulated
 * work are local. A new occupancy table resets only simultaneous live entries. */
class LocalGeometry {
  readonly work: GeometryWork;
  readonly diagnostics: ManualOverlapDiagnostics = {
    affectedPinIds: [],
    samplePairs: [],
    pairsObserved: 0,
    complete: false,
    truncated: false,
  };
  readonly boxes = new Map<string, Box>();
  private readonly buckets = new Map<string, Box[]>();
  constructor(prior: Readonly<GeometryWork>) {
    this.work = { ...prior };
  }
  start() {
    if (
      ![...Object.keys(LOCAL_CAPS), "passes"].every(
        (key) =>
          Number.isSafeInteger(this.work[key as keyof GeometryWork]) &&
          this.work[key as keyof GeometryWork] >= 0,
      ) ||
      this.work.passes >= 2 ||
      (this.work.passes === 0 &&
        Object.values(this.work).some((n) => n !== 0)) ||
      Object.entries(LOCAL_CAPS).some(
        ([key, cap]) => this.work[key as CapKey] > cap,
      )
    )
      throw new GeometryFailure("work_budget", "prior_geometry");
    this.work.liveCellEntries = 0;
    this.work.passes++;
  }
  tick(key: CapKey, stage: string) {
    if (this.work[key] >= LOCAL_CAPS[key])
      throw new GeometryFailure("work_budget", stage);
    this.work[key]++;
  }
  bounds(box: Box, gap: number, stage: string) {
    const left = box.x - gap,
      top = box.y - gap,
      right = box.x + box.width + gap,
      bottom = box.y + box.height + gap;
    const x0 = Math.floor(left / 512),
      x1 = Math.floor(right / 512),
      y0 = Math.floor(top / 512),
      y1 = Math.floor(bottom / 512);
    if (
      ![box.x, box.y, box.width, box.height, left, top, right, bottom].every(
        Number.isFinite,
      ) ||
      box.width <= 0 ||
      box.height <= 0 ||
      right <= left ||
      bottom <= top ||
      [left, top, right, bottom].some(
        (n) => Math.abs(n) > Number.MAX_SAFE_INTEGER,
      ) ||
      ![x0, x1, y0, y1].every(Number.isSafeInteger) ||
      x1 < x0 ||
      y1 < y0 ||
      (x1 - x0 + 1) * (y1 - y0 + 1) > 64
    )
      throw new GeometryFailure("geometry_budget", stage);
    return { x0, x1, y0, y1 };
  }
  insert(box: Box, stage: string) {
    const b = this.bounds(box, 0, stage);
    for (let x = b.x0; x <= b.x1; x++)
      for (let y = b.y0; y <= b.y1; y++) {
        if (
          this.work.liveCellEntries >= LOCAL_CAPS.liveCellEntries ||
          this.work.cellEntriesInserted >= LOCAL_CAPS.cellEntriesInserted
        )
          throw new GeometryFailure("work_budget", stage);
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
  query(box: Box, stage: string, final = false) {
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
          const manual = box.manual && other.manual,
            gap = manual ? 0 : 48;
          const hit =
            box.x - gap < other.x + other.width &&
            box.x + box.width + gap > other.x &&
            box.y - gap < other.y + other.height &&
            box.y + box.height + gap > other.y;
          if (!hit) continue;
          if (!manual) return true;
          if (final) {
            this.tick("manualPairObservations", stage);
            this.diagnostics.pairsObserved++;
            if (this.diagnostics.samplePairs.length < 32)
              this.diagnostics.samplePairs.push([box.id, other.id]);
            else this.diagnostics.truncated = true;
            for (const id of [box.id, other.id])
              if (!this.diagnostics.affectedPinIds.includes(id)) {
                if (this.diagnostics.affectedPinIds.length < 64)
                  this.diagnostics.affectedPinIds.push(id);
                else this.diagnostics.truncated = true;
              }
          }
        }
      }
    return false;
  }
  finish() {
    for (const id of [...this.boxes.keys()].sort(compare))
      if (this.query(this.boxes.get(id)!, "final_validation", true))
        throw new GeometryFailure("geometry_budget", "final_validation");
    this.diagnostics.affectedPinIds.sort(compare);
    this.diagnostics.complete = true;
  }
}
export type VisibleLayoutInput = {
  projection: Projection;
  global: Extract<GlobalLayoutResult, { status: "ready" }>;
  pins: ReturnType<typeof resolveVisualPins>;
  retained: Record<string, XY>;
  measurements: Record<string, LayoutBox>;
  ignorePinsFor: readonly string[];
  priorGeometry: Readonly<GeometryWork>;
};
export type VisibleLayoutResult =
  | {
      status: "ready";
      positions: Record<string, XY>;
      manualOverlaps: ManualOverlapDiagnostics;
      geometry: GeometryWork;
    }
  | {
      status: "rejected";
      reason: "visual_budget" | "work_budget" | "geometry_budget";
      stage: string;
      actual: { nodes: number; edges: number };
      geometry: GeometryWork;
      manualOverlaps: ManualOverlapDiagnostics;
    };

/** Scope rendering preserves domain ranks/order and every projection field.
 * Only a complete validated visual-ID position map is returned to the caller. */
export function layoutVisibleOverview(
  input: VisibleLayoutInput,
): VisibleLayoutResult {
  const geometry = new LocalGeometry(input.priorGeometry),
    actual = {
      nodes: input.projection.nodes.length,
      edges: input.projection.edges.length,
    };
  const rejected = (
    reason: Extract<VisibleLayoutResult, { status: "rejected" }>["reason"],
    stage: string,
  ): VisibleLayoutResult => ({
    status: "rejected",
    reason,
    stage,
    actual,
    geometry: geometry.work,
    manualOverlaps: geometry.diagnostics,
  });
  if (actual.nodes > 500 || actual.edges > 2000)
    return rejected("visual_budget", "projection_length");
  try {
    geometry.start();
    const nodes = [...input.projection.nodes].sort((a, b) =>
        compare(a.id, b.id),
      ),
      byId = new Map(nodes.map((n) => [n.id, n]));
    if (byId.size !== nodes.length)
      throw new GeometryFailure("geometry_budget", "visual_identity");
    const ignored = new Set(input.ignorePinsFor),
      sizes = new Map<string, LayoutBox>();
    const box = (id: string, position: XY, manual = false): Box => ({
      ...position,
      ...sizes.get(id)!,
      id,
      manual,
    });
    for (const node of nodes) {
      sizes.set(
        node.id,
        input.measurements[node.id] ??
          (node.data.group
            ? { width: 360, height: 220 + 60 * node.data.group.portIds.length }
            : { width: 300, height: 220 }),
      );
      const size = sizes.get(node.id)!;
      if (
        ![size.width, size.height].every(Number.isFinite) ||
        size.width <= 0 ||
        size.height <= 0
      )
        throw new GeometryFailure("geometry_budget", "measurement");
      // Cell occupancy depends on the actual position; validate it when the
      // pin, retained point or candidate is queried, never at a fake origin.
    }
    for (const node of nodes)
      if (!ignored.has(node.id) && Object.hasOwn(input.pins, node.id)) {
        const pin = box(node.id, input.pins[node.id]!.position, true);
        geometry.query(pin, "pin_validation");
        geometry.insert(pin, "pin_insert");
      }
    for (const node of nodes)
      if (
        !geometry.boxes.has(node.id) &&
        Object.hasOwn(input.retained, node.id) &&
        !ignored.has(node.id)
      ) {
        const retained = box(node.id, input.retained[node.id]!);
        if (!geometry.query(retained, "retained_validation"))
          geometry.insert(retained, "retained_insert");
      }
    const order = new Map(input.global.order.map((id, i) => [id, i]));
    const rank = (node: GraphNode) =>
      input.global.ranks[node.data.node.id] ?? Number.MAX_SAFE_INTEGER;
    const stable = (a: GraphNode, b: GraphNode) =>
      rank(a) - rank(b) ||
      (order.get(a.data.node.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.data.node.id) ?? Number.MAX_SAFE_INTEGER) ||
      compare(a.id, b.id);
    const visibleRanks = [
        ...new Set(nodes.filter((n) => !n.data.group).map(rank)),
      ].sort((a, b) => a - b),
      columns = new Map<number, number>(),
      widths = new Map<number, number>();
    for (const node of nodes.filter((n) => !n.data.group))
      widths.set(
        rank(node),
        Math.max(widths.get(rank(node)) ?? 0, sizes.get(node.id)!.width),
      );
    let nextX = 0;
    for (const r of visibleRanks) {
      columns.set(r, nextX);
      nextX += (widths.get(r) ?? 300) + 48;
    }
    const placed = new Set(geometry.boxes.keys());
    type Unit = { items: { id: string; point: XY }[]; height: number };
    const units: Unit[] = [],
      groupMembers = new Map<string, GraphNode[]>();
    for (const node of nodes)
      if (node.data.groupId) {
        let members = groupMembers.get(node.data.groupId);
        if (!members) {
          members = [];
          groupMembers.set(node.data.groupId, members);
        }
        members.push(node);
      }
    let groupY = 0;
    for (const header of nodes.filter((n) => n.data.group)) {
      const id = header.data.group!.id,
        members = (groupMembers.get(id) ?? [])
          .filter((n) => !placed.has(n.id))
          .sort(stable),
        fixed = geometry.boxes.get(header.id);
      const items: Unit["items"] = [],
        start = { x: fixed?.x ?? 0, y: fixed?.y ?? groupY },
        headerSize = sizes.get(header.id)!;
      if (!placed.has(header.id)) items.push({ id: header.id, point: start });
      const rows = new Map<number, number>();
      let bottom = start.y + headerSize.height;
      for (const member of members) {
        const r = rank(member),
          y = rows.get(r) ?? start.y + headerSize.height + 48;
        const point = { x: start.x + (columns.get(r) ?? 0), y };
        items.push({ id: member.id, point });
        rows.set(r, y + sizes.get(member.id)!.height + 48);
        bottom = Math.max(bottom, y + sizes.get(member.id)!.height);
      }
      if (items.length) {
        units.push({ items, height: bottom - start.y + 48 });
        for (const item of items) placed.add(item.id);
      }
      groupY = bottom + 96;
    }
    const rowY = new Map<number, number>();
    for (const node of nodes.filter((n) => !placed.has(n.id)).sort(stable)) {
      const r = rank(node),
        y = rowY.get(r) ?? groupY;
      units.push({
        items: [{ id: node.id, point: { x: columns.get(r) ?? 0, y } }],
        height: sizes.get(node.id)!.height + 48,
      });
      rowY.set(r, y + sizes.get(node.id)!.height + 48);
    }
    for (const unit of units) {
      let accepted = false;
      for (let candidate = 0; candidate < 32; candidate++) {
        let collision = false;
        for (const item of unit.items) {
          geometry.tick("candidateProbes", "auto_candidate");
          if (
            geometry.query(
              box(item.id, {
                x: item.point.x,
                y: item.point.y + candidate * unit.height,
              }),
              "auto_candidate",
            )
          ) {
            collision = true;
            break;
          }
        }
        if (collision) continue;
        for (const item of unit.items)
          geometry.insert(
            box(item.id, {
              x: item.point.x,
              y: item.point.y + candidate * unit.height,
            }),
            "auto_insert",
          );
        accepted = true;
        break;
      }
      if (!accepted)
        throw new GeometryFailure("geometry_budget", "candidate_limit");
    }
    geometry.finish();
    const positions: Record<string, XY> = {};
    for (const [id, b] of geometry.boxes) positions[id] = { x: b.x, y: b.y };
    return {
      status: "ready",
      positions,
      manualOverlaps: geometry.diagnostics,
      geometry: geometry.work,
    };
  } catch (error) {
    if (!(error instanceof GeometryFailure)) throw error;
    geometry.diagnostics.truncated = true;
    return rejected(error.reason, error.stage);
  }
}
