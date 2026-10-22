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
  const columns = Math.min(6, window?.pageSize ?? 6);
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
        ...(related.has(e.source) && related.has(e.target)
          ? {}
          : { filter: "saturate(0.35)", opacity: 0.45 }),
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

/** Per-lane file groups: key `${lane}:${path}` -> explicit collapsed choice. */
export type FunnelGrouping = { collapsed: Record<string, boolean> };
const dirOf = (path?: string) => {
  const i = (path ?? "").lastIndexOf("/");
  return i < 0 ? "" : path!.slice(0, i);
};
const segments = (dir: string) => (dir ? dir.split("/") : []);
function dirDistance(a: string, b: string) {
  const x = segments(a),
    y = segments(b);
  let common = 0;
  while (common < x.length && common < y.length && x[common] === y[common])
    common++;
  return x.length - common + (y.length - common);
}
/** Beyond this many cards in one lane only the nearest groups start expanded. */
const AUTO_EXPAND_LIMIT = 24;
const AUTO_EXPAND_GROUPS = 2;

/** Every direct caller/callee, grouped by file (directory for file cards).
 * Rows move away from the selected card as path distance grows: same file,
 * then nearby folders, then distant ones. Collapsed groups keep one header
 * card and redirect their edges to it. */
export function layoutFunnelGrouped(
  projection: { nodes: GraphNode[]; edges: GraphEdge[] },
  rootId: string,
  grouping: FunnelGrouping = { collapsed: {} },
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
  const width =
    Math.max(270, ...projection.nodes.map((n) => n.measured?.width ?? 0)) + 60;
  const height =
    Math.max(150, ...projection.nodes.map((n) => n.measured?.height ?? 0)) + 80;
  const rootPath = root?.data.node.filePath;
  const rootDir = dirOf(rootPath);
  const nodes: GraphNode[] = [];
  const hidden = new Map<string, string>();
  const headers: Record<string, string> = {};
  const lanes = {
    dependent: [] as GraphNode[],
    dependency: [] as GraphNode[],
    side: [] as GraphNode[],
  };
  for (const n of projection.nodes) {
    const lane = laneOf(n);
    if (lane === "selected")
      nodes.push({
        ...n,
        position: { x: 0, y: 0 },
        data: { ...n.data, funnelLane: "selected", reciprocal: false },
      });
    else lanes[lane].push(n);
  }
  const groupPath = (n: GraphNode) =>
    n.data.node.kind === "file"
      ? dirOf(n.data.node.filePath)
      : (n.data.node.filePath ?? "");
  for (const lane of ["dependent", "dependency"] as const) {
    const byGroup = new Map<string, GraphNode[]>();
    for (const n of lanes[lane]) {
      const key = groupPath(n);
      byGroup.set(key, [...(byGroup.get(key) ?? []), n]);
    }
    const ordered = [...byGroup.entries()]
      .map(([path, members]) => ({
        path,
        members: members.sort((a, b) => a.id.localeCompare(b.id)),
        score:
          path === rootPath
            ? -1
            : dirDistance(
                members[0]!.data.node.kind === "file" ? path : dirOf(path),
                rootDir,
              ),
      }))
      .sort((a, b) => a.score - b.score || a.path.localeCompare(b.path));
    const sign = lane === "dependent" ? -1 : 1;
    // Nearest group in the middle, farther ones alternating outward.
    const centered: typeof ordered = [];
    ordered.forEach((g, i) =>
      i % 2 === 0 ? centered.push(g) : centered.unshift(g),
    );
    // Every group owns a fixed vertical column whose width depends only on how
    // many cards it has, never on whether it is expanded. Expanding therefore
    // grows the column downward (away from the root) and moves nothing else.
    const spans = centered.map((g) =>
      Math.min(3, Math.max(1, Math.ceil(g.members.length / 8))),
    );
    let col = -(spans.reduce((a, b) => a + b, 0) - 1) / 2;
    centered.forEach((group, k) => {
      const span = spans[k]!,
        left = col;
      col += span;
      const key = `${lane}:${group.path || "."}`;
      const collapsed =
        grouping.collapsed[key] ??
        (lanes[lane].length > AUTO_EXPAND_LIMIT &&
          ordered.indexOf(group) >= AUTO_EXPAND_GROUPS);
      const headerId = `filegroup:${key}`;
      headers[key] = headerId;
      nodes.push({
        id: headerId,
        type: "filegroup",
        position: { x: (left + (span - 1) / 2) * width, y: sign * height },
        deletable: false,
        data: {
          node: {
            id: headerId,
            kind: "folder",
            name: group.path || ".",
            filePath: group.path,
          },
          layer: "fact",
          changes: [],
          funnelLane: lane,
          fileGroup: {
            key,
            count: group.members.length,
            collapsed,
            distance: group.score,
            memberIds: group.members.map((n) => n.id),
          },
        },
      });
      group.members.forEach((n, i) => {
        if (collapsed) {
          hidden.set(n.id, headerId);
          return;
        }
        nodes.push({
          ...n,
          position: {
            x: (left + (i % span)) * width,
            y: sign * (2 + Math.floor(i / span)) * height,
          },
          data: {
            ...n.data,
            funnelLane: lane,
            reciprocal: incoming.has(n.id) && outgoing.has(n.id),
          },
        });
      });
    });
  }
  // Side context is not a reference; it is counted in the summary only.
  const present = new Set(nodes.map((n) => n.id));
  const related = new Set(
    nodes.filter((n) => n.data.funnelLane !== "side").map((n) => n.id),
  );
  const redirected = new Map<string, GraphEdge & { count: number }>();
  const edges: GraphEdge[] = [];
  for (const e of projection.edges) {
    if (e.data?.relationType === "contains") continue;
    const source = hidden.get(e.source) ?? e.source,
      target = hidden.get(e.target) ?? e.target;
    const moved = source !== e.source || target !== e.target;
    if (source === target || !present.has(source) || !present.has(target))
      continue;
    if (moved) {
      if (source !== root?.id && target !== root?.id) continue;
      const key = `${source}>${target}`;
      const previous = redirected.get(key);
      if (previous) previous.count++;
      else
        redirected.set(key, {
          id: `fg:${key}`,
          source,
          target,
          sourceHandle: null,
          targetHandle: null,
          data: { layer: "fact", domainId: `fg:${key}`, relationType: "calls" },
          style: { stroke: "var(--edge-fact)", opacity: 1 },
          deletable: false,
          count: 1,
        });
      continue;
    }
    edges.push({
      ...e,
      sourceHandle: null,
      targetHandle: null,
      style: {
        ...e.style,
        ...(related.has(e.source) && related.has(e.target)
          ? {}
          : { filter: "saturate(0.35)", opacity: 0.45 }),
      },
    });
  }
  for (const { count, ...edge } of redirected.values())
    edges.push({ ...edge, label: `×${count}` });
  const total = (n: number) => ({
    start: n ? 1 : 0,
    end: n,
    total: n,
    page: 0,
    pages: 1,
  });
  return {
    nodes,
    edges,
    relatedIds: [...related],
    reciprocalCount: [...incoming].filter((id) => outgoing.has(id)).length,
    windows: {
      dependents: total(lanes.dependent.length),
      dependencies: total(lanes.dependency.length),
    },
    counts: {
      dependents: incoming.size,
      dependencies: outgoing.size,
      side: lanes.side.length,
    },
  };
}

const FRAME_PAD = 24;
/** Light wrapper behind every expanded file group and its member cards. It is
 * derived from the cards' *current* positions, so it always hugs them. The
 * frame is a real node (`frame:<group key>`): the anchor for future
 * collection/abstraction links. Collapsed groups need no frame. */
export function withGroupFrames(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const frames: GraphNode[] = [];
  for (const header of nodes) {
    const group = header.data.fileGroup as
      { key: string; collapsed: boolean; memberIds: string[] } | undefined;
    if (!group || group.collapsed) continue;
    const boxes = [header, ...group.memberIds.map((id) => byId.get(id))]
      .filter((n): n is GraphNode => !!n)
      .map((n) => ({
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? 270,
        h: n.measured?.height ?? 150,
      }));
    const x0 = Math.min(...boxes.map((b) => b.x)) - FRAME_PAD,
      y0 = Math.min(...boxes.map((b) => b.y)) - FRAME_PAD,
      x1 = Math.max(...boxes.map((b) => b.x + b.w)) + FRAME_PAD,
      y1 = Math.max(...boxes.map((b) => b.y + b.h)) + FRAME_PAD;
    const id = `frame:${group.key}`;
    const width = x1 - x0,
      height = y1 - y0;
    frames.push({
      id,
      type: "groupframe",
      position: { x: x0, y: y0 },
      width,
      height,
      // Derived nodes never receive React Flow dimension changes; without
      // `measured`, useNodesInitialized() would block focus/fit.
      measured: { width, height },
      style: { width, height, pointerEvents: "none" },
      zIndex: -1,
      selectable: false,
      draggable: false,
      focusable: false,
      deletable: false,
      data: {
        node: {
          id,
          kind: "folder",
          name: String(header.data.node.name),
          filePath: header.data.node.filePath,
        },
        layer: "fact",
        changes: [],
        frame: true,
        // Direction + folder: the same folder can be both a caller group above
        // and a callee group below, and must not read as calling itself.
        frameLane: header.data.funnelLane,
        frameTitle: String(
          header.data.node.filePath || header.data.node.name,
        ),
      },
    });
  }
  return [...frames, ...nodes];
}
