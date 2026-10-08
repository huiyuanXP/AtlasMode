import type { CodeNode, SubgraphResult } from "@codemap/core";
import type { GraphNode, GraphEdge, LayerFilter } from "./projection.js";

/** Transient navigation contract. Task3 may use root for breadcrumb scope;
 * previousGraph/filter describe the overview restored by exitFunnel. */
export type FunnelState = {
  root: CodeNode;
  sequence: number;
  previousGraph?: SubgraphResult;
  previousFilter: LayerFilter;
  unknownCount: number;
};
export type DependencyGraph = SubgraphResult & { unknownCount: number };
export type FunnelLane = "dependent" | "selected" | "dependency" | "side";
export type FunnelWindow = {
  dependentsPage: number;
  dependenciesPage: number;
  pageSize: number;
};

/** Direct directional lanes, never treating membership as a dependency.
 * Reciprocal neighbors occur once above, with both arrows and an explicit badge.
 * Coordinates are transient; measured card sizes define non-overlapping spacing. */
export function layoutFunnel(
  projection: { nodes: GraphNode[]; edges: GraphEdge[] },
  rootId: string,
  window?: FunnelWindow,
) {
  const root = projection.nodes.find((n) => n.data.node.id === rootId);
  const incoming = new Set<string>(),
    outgoing = new Set<string>();
  for (const edge of projection.edges) {
    if (edge.data?.relationType === "contains") continue;
    if (edge.source === root?.id && edge.target !== root.id)
      outgoing.add(edge.target);
    if (edge.target === root?.id && edge.source !== root.id)
      incoming.add(edge.source);
  }
  const laneOf = (n: GraphNode): FunnelLane =>
    n.id === root?.id
      ? "selected"
      : incoming.has(n.id)
        ? "dependent"
        : outgoing.has(n.id)
          ? "dependency"
          : "side";
  const lanes = {
    dependent: [] as GraphNode[],
    selected: [] as GraphNode[],
    dependency: [] as GraphNode[],
    side: [] as GraphNode[],
  };
  for (const n of projection.nodes) lanes[laneOf(n)].push(n);
  for (const lane of Object.values(lanes))
    lane.sort((a, b) => a.id.localeCompare(b.id));
  const page = (list: GraphNode[], requested: number) => {
    const size = Math.max(1, window?.pageSize ?? list.length),
      pages = Math.max(1, Math.ceil(list.length / size)),
      current = Math.min(Math.max(0, requested), pages - 1),
      start = current * size;
    return {
      nodes: list.slice(start, start + size),
      range: {
        start: list.length ? start + 1 : 0,
        end: Math.min(start + size, list.length),
        total: list.length,
        page: current,
        pages,
      },
    };
  };
  const dependents = page(lanes.dependent, window?.dependentsPage ?? 0),
    dependencies = page(lanes.dependency, window?.dependenciesPage ?? 0);
  const visibleLanes = {
    ...lanes,
    dependent: dependents.nodes,
    dependency: dependencies.nodes,
  };
  const visible = new Set(
    Object.values(visibleLanes)
      .flat()
      .map((n) => n.id),
  );
  const columns = Math.min(4, window?.pageSize ?? 4);
  const width =
    Math.max(270, ...projection.nodes.map((n) => n.measured?.width ?? 0)) + 60;
  const height =
    Math.max(150, ...projection.nodes.map((n) => n.measured?.height ?? 0)) + 80;
  const relatedWidth = Math.max(
    1,
    Math.min(
      columns,
      Math.max(dependents.nodes.length, dependencies.nodes.length),
    ),
  );
  const nodes = projection.nodes
    .filter((n) => visible.has(n.id))
    .map((n) => {
      const lane = laneOf(n),
        list = visibleLanes[lane],
        i = list.indexOf(n);
      const rowCount = Math.min(columns, list.length),
        row = Math.floor(i / columns);
      const x =
        lane === "selected"
          ? 0
          : lane === "side"
            ? width * (relatedWidth / 2 + 1.5 + i)
            : ((i % columns) - (rowCount - 1) / 2) * width;
      const y =
        lane === "selected"
          ? 0
          : lane === "dependent"
            ? -(row + 1) * height
            : lane === "dependency"
              ? (row + 1) * height
              : height * 0.6;
      return {
        ...n,
        position: { x, y },
        data: {
          ...n.data,
          funnelLane: lane,
          reciprocal: incoming.has(n.id) && outgoing.has(n.id),
        },
      };
    });
  const relatedIds = nodes
    .filter((n) => n.data.funnelLane !== "side")
    .map((n) => n.id);
  const related = new Set(relatedIds);
  const edges = projection.edges
    .filter(
      (e) =>
        e.data?.relationType !== "contains" &&
        visible.has(e.source) &&
        visible.has(e.target),
    )
    .map((e) => ({
      ...e,
      sourceHandle: null,
      targetHandle: null,
      style: {
        ...e.style,
        opacity: related.has(e.source) && related.has(e.target) ? 1 : 0.2,
      },
    }));
  return {
    nodes,
    edges,
    relatedIds,
    reciprocalCount: [...incoming].filter((id) => outgoing.has(id)).length,
    windows: { dependents: dependents.range, dependencies: dependencies.range },
    counts: {
      dependents: incoming.size,
      dependencies: outgoing.size,
      side: lanes.side.length,
    },
  };
}
