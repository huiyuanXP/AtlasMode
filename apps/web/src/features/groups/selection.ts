import type { CodeNode } from "@codemap/core";
import type { GraphNode } from "../graph/projection.js";
/** Domain identity survives fact/anchor projections. Planned functions are not knowledge facts. */
export function circleFunctions(nodes: GraphNode[]): CodeNode[] {
  return [
    ...new Map(
      nodes
        .filter(
          (n) => n.data.layer !== "plan" && n.data.node.kind === "function",
        )
        .map((n) => [n.data.node.id, n.data.node]),
    ).values(),
  ];
}
export function circleSelectedNodes(
  nodes: GraphNode[],
  ids: string[],
): GraphNode[] {
  const selected = new Set(ids);
  return nodes.map((n) => ({
    ...n,
    selected:
      n.data.layer !== "plan" &&
      n.data.node.kind === "function" &&
      selected.has(n.data.node.id),
  }));
}
