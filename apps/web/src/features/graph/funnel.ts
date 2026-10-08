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

/** Direct directional lanes, never treating membership as a dependency.
 * Reciprocal neighbors occur once above, with both arrows and an explicit badge.
 * Coordinates are transient; measured card sizes define non-overlapping spacing. */
export function layoutFunnel(
  projection: { nodes: GraphNode[]; edges: GraphEdge[] },
  rootId: string,
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
  const width =
    Math.max(270, ...projection.nodes.map((n) => n.measured?.width ?? 0)) + 60;
  const height =
    Math.max(150, ...projection.nodes.map((n) => n.measured?.height ?? 0)) + 80;
  const relatedWidth = Math.max(
    1,
    Math.min(4, Math.max(lanes.dependent.length, lanes.dependency.length)),
  );
  const nodes = projection.nodes.map((n) => {
    const lane = laneOf(n),
      list = lanes[lane],
      i = list.indexOf(n);
    const rowCount = Math.min(4, list.length),
      row = Math.floor(i / 4);
    const x =
      lane === "selected"
        ? 0
        : lane === "side"
          ? width * (relatedWidth / 2 + 1.5 + i)
          : ((i % 4) - (rowCount - 1) / 2) * width;
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
    .filter((e) => e.data?.relationType !== "contains")
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
    counts: {
      dependents: incoming.size,
      dependencies: outgoing.size,
      side: lanes.side.length,
    },
  };
}
