import type { GraphNode, GraphEdge } from "./projection.js";
/** Stable relation identities distinguish repeated calls between the same pair. */
export function inspectionHighlight(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selected?: string,
  relationId?: string,
  hovered?: string,
) {
  const root = selected ?? hovered;
  const active = relationId
    ? edges.filter((e) => e.data?.domainId === relationId)
    : root
      ? edges.filter(
          (e) =>
            nodes.find((n) => n.id === e.source)?.data.node.id === root ||
            nodes.find((n) => n.id === e.target)?.data.node.id === root,
        )
      : [];
  const endpoints = new Set(active.flatMap((e) => [e.source, e.target]));
  const rootId = nodes.find((n) => n.data.node.id === root)?.id;
  if (rootId) endpoints.add(rootId);
  const enabled = !!root || !!relationId;
  return {
    nodes: nodes.map((n) => ({
      ...n,
      selected: n.data.node.id === selected,
      data: {
        ...n.data,
        projectionData: n.data,
        highlight: !enabled
          ? "idle"
          : n.id === rootId
            ? "selected"
            : endpoints.has(n.id)
              ? "neighbor"
              : "muted",
      },
      style: { ...n.style, opacity: enabled && !endpoints.has(n.id) ? 0.2 : 1 },
    })),
    edges: edges.map((e) => {
      const highlight = !enabled
        ? "idle"
        : !active.includes(e)
          ? "muted"
          : relationId
            ? "relation"
            : e.target === rootId
              ? "incoming"
              : "outgoing";
      const stroke =
        highlight === "incoming"
          ? "#16818a"
          : highlight === "outgoing"
            ? "#bf681e"
            : highlight === "relation"
              ? "#6651d8"
              : e.style?.stroke;
      return {
        ...e,
        className: `inspection-edge ${highlight}`,
        data: { ...e.data!, highlight },
        style: {
          ...e.style,
          stroke,
          strokeWidth: active.includes(e) ? 3 : 1.5,
          opacity: highlight === "muted" ? 0.15 : 1,
        },
        labelStyle: { fill: stroke },
        zIndex: active.includes(e) ? 5 : 0,
      };
    }),
  };
}
/** This session's displacement belongs to a project and root, independent of windows. */
export class FunnelOffsets {
  private offsets = new Map<string, Map<string, { x: number; y: number }>>();
  private key(project: string, root: string) {
    return JSON.stringify([project, root]);
  }
  move(
    project: string,
    root: string,
    id: string,
    position: { x: number; y: number },
    base: { x: number; y: number },
  ) {
    const key = this.key(project, root),
      entries = this.offsets.get(key) ?? new Map();
    entries.set(id, { x: position.x - base.x, y: position.y - base.y });
    this.offsets.set(key, entries);
  }
  apply(project: string, root: string, nodes: GraphNode[]): GraphNode[] {
    const offsets = this.offsets.get(this.key(project, root));
    return nodes.map((n) => {
      const offset = offsets?.get(n.id);
      return offset
        ? {
            ...n,
            position: {
              x: n.position.x + offset.x,
              y: n.position.y + offset.y,
            },
          }
        : n;
    });
  }
  clear(project: string, root: string) {
    this.offsets.delete(this.key(project, root));
  }
}
export function inspectionPlacement(
  width: number,
  height: number,
  node?: { x: number; y: number; width: number; height: number },
) {
  const cardWidth = Math.min(360, width - 24),
    gap = 16;
  if (
    width < 700 ||
    (node &&
      node.x < cardWidth + gap &&
      width - node.x - node.width < cardWidth + gap)
  ) {
    const above = node ? node.y - 58 - gap : 0;
    const below = node
      ? height - node.y - node.height - gap - 12
      : height * 0.4 - 12;
    const upper = above > below;
    const top = upper
      ? 58
      : node
        ? Math.max(58, node.y + node.height + gap)
        : Math.max(60, height * 0.6);
    return {
      left: width < 700 ? 12 : width - cardWidth - 12,
      top,
      width: width < 700 ? Math.max(200, width - 24) : cardWidth,
      maxHeight: Math.max(80, Math.min(height * 0.4, upper ? above : below)),
      dock: upper ? "top" : "bottom",
    };
  }
  const left =
    node && width - node.x - node.width < cardWidth + gap
      ? 12
      : width - cardWidth - 12;
  return {
    left,
    top: 58,
    width: cardWidth,
    maxHeight: Math.max(150, height - 80),
    dock: "side",
  };
}
