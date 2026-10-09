import { dictionaries, type Locale } from "../../i18n/index.js";
import type {
  CodeNode,
  Operation,
  SubgraphResult,
  ViewState,
} from "@codemap/core";
import type { Edge, Node } from "@xyflow/react";
import type { FocusRequest } from "./focus.js";
export type LayerFilter = "fact" | "plan" | "both";
export type CardData = {
  node: CodeNode;
  layer: "fact" | "plan" | "anchor";
  changes: string[];
  [key: string]: unknown;
};
export type GraphNode = Node<CardData>;
export type GraphEdge = Edge<{
  layer: "fact" | "plan";
  domainId: string;
  relationType?: string;
}>;
export function focusTargets(nodes: GraphNode[], request?: FocusRequest) {
  const ids = new Set(
    request?.nodeIds ?? (request?.nodeId ? [request.nodeId] : []),
  );
  return nodes.filter((node) => ids.has(node.data.node.id));
}
export function projectGraph(
  graph: SubgraphResult | undefined,
  operations: Operation[],
  filter: LayerFilter,
  positions: ViewState["positions"],
  locale: Locale = "zh",
  referenceNodes: CodeNode[] = [],
) {
  const text = dictionaries[locale];
  const nodes: GraphNode[] = [],
    edges: GraphEdge[] = [],
    notices: string[] = [];
  const visibleOps = filter === "fact" ? [] : operations;
  const referenced = new Set<string>();
  for (const op of visibleOps) {
    if ("nodeId" in op) referenced.add(op.nodeId);
    if ("targetId" in op) referenced.add(op.targetId);
    if ("sourceId" in op) referenced.add(op.sourceId);
    if (op.kind === "remove_relation") {
      const edge = graph?.relations.find((r) => r.id === op.relationId);
      if (edge) {
        referenced.add(edge.sourceId);
        if (edge.targetId) referenced.add(edge.targetId);
      }
    }
  }
  const changes = (id: string) =>
    visibleOps.flatMap((op) => {
      if (op.kind === "move_function" && op.nodeId === id)
        return [`→ ${op.filePath}`];
      if (op.kind === "remove_function" && op.nodeId === id)
        return [`− ${text.plannedRemoval}`];
      if (op.kind === "annotate" && op.targetId === id)
        return [`${text.annotation} · ${op.text}`];
      return [];
    });
  const addNode = (node: CodeNode, layer: CardData["layer"]) => {
    const id = `${layer === "plan" ? "plan" : "fact"}:${node.id}`;
    const index = nodes.length;
    nodes.push({
      id,
      type: "code",
      position: positions[id] ?? {
        x: (index % 3) * 310,
        y: Math.floor(index / 3) * 170,
      },
      data: { node, layer, changes: changes(node.id) },
      deletable: false,
    });
  };
  for (const node of graph?.nodes ?? [])
    if (filter !== "plan" || referenced.has(node.id))
      addNode(node, filter === "plan" ? "anchor" : "fact");
  for (const op of visibleOps)
    if (op.kind === "add_function")
      addNode(
        {
          id: op.tempId,
          kind: "function",
          declarationKind: "function",
          name: op.name,
          filePath: op.filePath,
          signature: op.signature,
          language: op.language,
        },
        "plan",
      );
  const present = new Set(nodes.map((n) => n.data.node.id));
  for (const node of referenceNodes)
    if (referenced.has(node.id) && !present.has(node.id)) {
      addNode(node, "anchor");
      present.add(node.id);
    }
  const byDomain = new Map(nodes.map((n) => [n.data.node.id, n.id]));
  const factsByDomain = new Map(
    nodes
      .filter((n) => n.data.layer !== "plan")
      .map((n) => [n.data.node.id, n.id]),
  );
  if (filter !== "plan")
    for (const r of graph?.relations ?? []) {
      if (r.resolution !== "resolved")
        notices.push(
          `${text[r.resolution]} · ${r.evidence.filePath}:${r.evidence.line} · ${r.reason ?? r.evidence.text ?? r.id}`,
        );
      if (
        !r.targetId ||
        !factsByDomain.has(r.sourceId) ||
        !factsByDomain.has(r.targetId)
      )
        continue;
      const removed = visibleOps.some(
        (o) => o.kind === "remove_relation" && o.relationId === r.id,
      );
      edges.push({
        id: `fact:${r.id}`,
        source: factsByDomain.get(r.sourceId)!,
        target: factsByDomain.get(r.targetId)!,
        label: `${text.fact} · ${text[r.type]}${removed ? ` · ${text.plannedRemoval}` : ""}`,
        data: { layer: "fact", domainId: r.id, relationType: r.type },
        deletable: false,
        reconnectable: r.type === "calls",
        style: {
          stroke: removed ? "#c06045" : "#8493a5",
          strokeDasharray: removed ? "3 3" : undefined,
        },
      });
    }
  for (const op of visibleOps)
    if (op.kind === "add_relation") {
      if (!byDomain.has(op.sourceId) || !byDomain.has(op.targetId)) {
        notices.push(
          `${text.endpointOutside}: ${!byDomain.has(op.sourceId) ? op.sourceId : op.targetId}`,
        );
        continue;
      }
      edges.push({
        id: `plan:${op.id}`,
        source: byDomain.get(op.sourceId)!,
        target: byDomain.get(op.targetId)!,
        label: `${text.plan} · ${text[op.type]}`,
        data: { layer: "plan", domainId: op.id, relationType: op.type },
        deletable: false,
        reconnectable: true,
        style: { stroke: "#8962ce", strokeDasharray: "6 3" },
      });
    }
  return { nodes, edges, notices };
}
export function sourceWindow(content: string, start = 1, end?: number) {
  const lines = content.split(/\r?\n/),
    startLine = Math.max(1, start),
    requestedEnd = Math.min(end ?? lines.length, lines.length),
    endLine = Math.min(requestedEnd, startLine + 199);
  return {
    startLine,
    endLine,
    truncated: endLine < requestedEnd,
    text: lines
      .slice(startLine - 1, endLine)
      .map((line, i) => `${startLine + i}  ${line}`)
      .join("\n"),
  };
}
