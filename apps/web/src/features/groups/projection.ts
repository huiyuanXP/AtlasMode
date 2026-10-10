import type { FunctionGroup, ViewState } from "@codemap/core";
import type { Locale } from "../../i18n/index.js";
import type {
  GraphNode,
  GraphEdge,
  GroupCardData,
} from "../graph/projection.js";
type Projection = { nodes: GraphNode[]; edges: GraphEdge[]; notices: string[] };
/** Membership is many-to-many; aliases are view identities, never physical parents or facts. */
export function projectGroups(
  base: Projection,
  groups: FunctionGroup[],
  collapsedIds: string[],
  positions: ViewState["positions"],
  locale: Locale,
): Projection {
  if (!groups.length) return base;
  const collapsed = new Set(collapsedIds);
  const facts = new Map(
    base.nodes
      .filter((n) => n.data.layer !== "plan" && n.data.node.kind === "function")
      .map((n) => [n.data.node.id, n]),
  );
  // Local views represent only groups intersecting their loaded true functions.
  // All saved groups and their view state remain available in the manager.
  const ordered = groups
    .filter((group) => group.memberIds.some((id) => facts.has(id)))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!ordered.length) return base;
  const memberships = new Map<string, string[]>();
  const infos = new Map<string, GroupCardData>();
  for (const group of ordered) {
    const ids = [...new Set(group.memberIds)];
    const loaded = ids.flatMap((id) =>
      facts.has(id) ? [facts.get(id)!.data.node] : [],
    );
    infos.set(group.id, {
      id: group.id,
      title: group.title,
      total: ids.length,
      loadedMembers: loaded,
      unknownMembers: ids.length - loaded.length,
      collapsed: collapsed.has(group.id),
      portIds: [],
      internalRelationIds: [],
      plannedInternalIds: [],
    });
    for (const member of loaded)
      memberships.set(member.id, [
        ...(memberships.get(member.id) ?? []),
        group.id,
      ]);
  }
  const nodes = base.nodes.filter(
    (n) => n.data.layer === "plan" || !memberships.has(n.data.node.id),
  );
  let y = Math.max(0, ...base.nodes.map((n) => n.position.y)) + 240;
  for (const group of ordered) {
    const info = infos.get(group.id)!;
    const position = positions[`group:${group.id}`] ?? { x: 0, y };
    nodes.push({
      id: `group:${group.id}`,
      type: "group",
      position,
      data: {
        node: { id: `group:${group.id}`, kind: "folder", name: group.title },
        layer: "fact",
        changes: [],
        group: info,
      },
      deletable: false,
      connectable: false,
    });
    if (!info.collapsed)
      for (let i = 0; i < info.loadedMembers.length; i++) {
        const member = info.loadedMembers[i]!,
          original = facts.get(member.id)!;
        const id = `group-member:${group.id}:${member.id}`;
        const oldCanonical =
          memberships.get(member.id)?.[0] === group.id
            ? positions[original.id]
            : undefined;
        nodes.push({
          ...original,
          id,
          position: positions[id] ??
            oldCanonical ?? {
              x: position.x + (i % 3) * 310,
              y: position.y + 280 + Math.floor(i / 3) * 210,
            },
          data: {
            ...original.data,
            groupId: group.id,
            groupTitle: group.title,
          },
        });
      }
    y += info.collapsed
      ? 380 + info.loadedMembers.length * 60
      : 320 + Math.ceil(info.loadedMembers.length / 3) * 210;
  }
  const byVisual = new Map(base.nodes.map((n) => [n.id, n]));
  type Endpoint = { id: string; handle?: string };
  const endpoint = (
    node: GraphNode,
    side: "source" | "target",
    groupId?: string,
  ): Endpoint => {
    const groups =
      node.data.layer === "plan"
        ? undefined
        : memberships.get(node.data.node.id);
    const id = groupId && groups?.includes(groupId) ? groupId : groups?.[0];
    return !id
      ? { id: node.id }
      : collapsed.has(id)
        ? { id: `group:${id}`, handle: `${side}:${node.data.node.id}` }
        : { id: `group-member:${id}:${node.data.node.id}` };
  };
  const edges: GraphEdge[] = [];
  for (const edge of base.edges) {
    const from = byVisual.get(edge.source),
      to = byVisual.get(edge.target);
    if (!from || !to) continue;
    const affected = new Set([
      ...(from.data.layer === "plan"
        ? []
        : (memberships.get(from.data.node.id) ?? [])),
      ...(to.data.layer === "plan"
        ? []
        : (memberships.get(to.data.node.id) ?? [])),
    ]);
    if (!affected.size) {
      edges.push(edge);
      continue;
    }
    for (const groupId of affected) {
      const info = infos.get(groupId)!;
      if (
        info.loadedMembers.some((n) => n.id === from.data.node.id) &&
        info.loadedMembers.some((n) => n.id === to.data.node.id)
      ) {
        const list =
          edge.data?.layer === "fact"
            ? info.internalRelationIds
            : info.plannedInternalIds;
        if (edge.data && !list.includes(edge.data.domainId))
          list.push(edge.data.domainId);
      }
    }
    const routes = new Map<string, { source: Endpoint; target: Endpoint }>();
    for (const groupId of [undefined, ...affected]) {
      const source = endpoint(from, "source", groupId),
        target = endpoint(to, "target", groupId);
      if (source.id === target.id && source.id.startsWith("group:")) continue;
      const key = JSON.stringify([
        source.id,
        source.handle,
        target.id,
        target.handle,
      ]);
      routes.set(key, { source, target });
    }
    let i = 0;
    for (const { source, target } of routes.values()) {
      const folded = !!source.handle || !!target.handle;
      edges.push({
        ...edge,
        id: `group-edge:${edge.id}:${i++}`,
        source: source.id,
        target: target.id,
        sourceHandle: source.handle,
        targetHandle: target.handle,
        reconnectable: !folded && edge.reconnectable,
        label: `${edge.label}${routes.size > 1 ? (locale === "en" ? " · same relation mirrored" : " · 同一关系镜像") : ""}`,
        data: {
          ...edge.data!,
          sourceId: from.data.node.id,
          targetId: to.data.node.id,
          groupProjection: true,
          mirrored: routes.size > 1,
          collapsedEndpoints: folded,
        },
      });
      for (const point of [source, target])
        if (point.handle) {
          const info = infos.get(point.id.slice(6))!;
          const domain = point.handle.slice(point.handle.indexOf(":") + 1);
          if (!info.portIds.includes(domain)) info.portIds.push(domain);
        }
    }
  }
  return { nodes, edges, notices: base.notices };
}
