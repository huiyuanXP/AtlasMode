import type { GraphEdge, GraphNode } from "./projection.js";

const PAD = 28;
const TITLE = 26;
type Box = { x0: number; y0: number; x1: number; y1: number };

/** Overview-only wrapper behind every folder whose direct children are loaded.
 * Children come from real `contains` relations between fact cards (never from
 * path guessing). Frames are derived from the cards' *current* positions, so
 * they follow drags, nest for sub-folders, and carry the folder name as a
 * title in the top-left corner. They are display-only nodes: not selectable,
 * not draggable and transparent to the pointer. A folder with no loaded child
 * (collapsed) gets no frame and keeps its single card. */
export function withFolderFrames(
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode[] {
  const cardByDomain = new Map<string, GraphNode>();
  for (const n of nodes)
    if (n.data.layer !== "plan" && !n.data.group)
      cardByDomain.set(n.data.node.id, n);
  const children = new Map<string, GraphNode[]>();
  for (const e of edges) {
    if (e.data?.relationType !== "contains") continue;
    const parent = e.data.sourceId && cardByDomain.get(e.data.sourceId);
    const child = e.data.targetId && cardByDomain.get(e.data.targetId);
    if (!parent || !child || parent === child) continue;
    if (parent.data.node.kind !== "folder") continue;
    const list = children.get(parent.id) ?? [];
    if (!list.includes(child)) list.push(child);
    children.set(parent.id, list);
  }
  const box = (n: GraphNode): Box => ({
    x0: n.position.x,
    y0: n.position.y,
    x1: n.position.x + (n.measured?.width ?? 270),
    y1: n.position.y + (n.measured?.height ?? 150),
  });
  const frames = new Map<string, Box>();
  const visiting = new Set<string>();
  // Children first so a parent frame also encloses its sub-folder frames.
  const frameOf = (folder: GraphNode): Box | undefined => {
    if (frames.has(folder.id)) return frames.get(folder.id);
    const kids = children.get(folder.id);
    if (!kids?.length || visiting.has(folder.id)) return undefined;
    visiting.add(folder.id);
    const boxes = [box(folder)];
    for (const kid of kids) boxes.push(frameOf(kid) ?? box(kid));
    visiting.delete(folder.id);
    const frame = {
      x0: Math.min(...boxes.map((b) => b.x0)) - PAD,
      y0: Math.min(...boxes.map((b) => b.y0)) - PAD - TITLE,
      x1: Math.max(...boxes.map((b) => b.x1)) + PAD,
      y1: Math.max(...boxes.map((b) => b.y1)) + PAD,
    };
    frames.set(folder.id, frame);
    return frame;
  };
  const result: GraphNode[] = [];
  for (const folder of nodes) {
    if (!children.has(folder.id)) continue;
    const frame = frameOf(folder);
    if (!frame) continue;
    const id = `folderframe:${folder.id}`;
    const width = frame.x1 - frame.x0,
      height = frame.y1 - frame.y0;
    result.push({
      id,
      type: "groupframe",
      position: { x: frame.x0, y: frame.y0 },
      width,
      height,
      // Frames are derived per render and never reach the node state that
      // receives React Flow's dimension changes. Without `measured`,
      // useNodesInitialized() stays false and focus/fit never runs.
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
          name: String(folder.data.node.name),
          filePath: folder.data.node.filePath,
        },
        layer: "fact",
        changes: [],
        frame: true,
        frameTitle: String(folder.data.node.filePath || folder.data.node.name),
      },
    });
  }
  // Larger (outer) frames first so inner frames paint above them.
  result.sort(
    (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
  );
  return [...result, ...nodes];
}
