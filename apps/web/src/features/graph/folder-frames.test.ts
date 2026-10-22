import { expect, it } from "vitest";
import type { CodeNode, Relation, SubgraphResult } from "@codemap/core";
import { projectGraph } from "./projection.js";
import { withFolderFrames } from "./folder-frames.js";

const folder = (id: string, filePath: string): CodeNode => ({
  id,
  kind: "folder",
  name: filePath.split("/").at(-1)!,
  filePath,
});
const file = (id: string, filePath: string): CodeNode => ({
  id,
  kind: "file",
  name: filePath.split("/").at(-1)!,
  filePath,
});
const contains = (sourceId: string, targetId: string): Relation => ({
  id: `${sourceId}>${targetId}`,
  sourceId,
  targetId,
  type: "contains",
  resolution: "resolved",
  evidence: { filePath: "x", line: 1 },
});
const build = (nodes: CodeNode[], relations: Relation[]) => {
  const graph: SubgraphResult = {
    nodes,
    relations,
    snapshotId: "s",
    dataSource: "code",
    truncated: false,
  };
  const p = projectGraph(graph, [], "fact", {});
  const sized = p.nodes.map((n) => ({
    ...n,
    measured: { width: 200, height: 100 },
  }));
  return { ...p, nodes: sized };
};
const frames = (nodes: ReturnType<typeof build>["nodes"]) =>
  nodes.filter((n) => n.type === "groupframe");

it("projectGraph keeps contains relations as edges so frames can be derived", () => {
  const p = build(
    [folder("d", "a"), file("f", "a/f.ts")],
    [contains("d", "f")],
  );
  expect(
    p.edges.some((e) => e.data?.relationType === "contains"),
  ).toBe(true);
});

it("wraps an expanded folder and its direct children, titled with the folder path", () => {
  const p = build(
    [folder("d", "apps/mcp/src"), file("f1", "apps/mcp/src/a.ts"), file("f2", "apps/mcp/src/b.ts")],
    [contains("d", "f1"), contains("d", "f2")],
  );
  const out = withFolderFrames(p.nodes, p.edges);
  const [frame] = frames(out);
  expect(frames(out)).toHaveLength(1);
  expect(frame!.data.frameTitle).toBe("apps/mcp/src");
  for (const n of p.nodes) {
    expect(frame!.position.x).toBeLessThan(n.position.x);
    expect(frame!.position.y).toBeLessThan(n.position.y);
    expect(frame!.position.x + frame!.width!).toBeGreaterThan(
      n.position.x + 200,
    );
    expect(frame!.position.y + frame!.height!).toBeGreaterThan(
      n.position.y + 100,
    );
  }
  expect(frame!.selectable).toBe(false);
  expect(frame!.draggable).toBe(false);
  expect(frame!.style?.pointerEvents).toBe("none");
  // Pre-measured so React Flow's useNodesInitialized() is not blocked by
  // derived nodes that never receive dimension changes.
  expect(frame!.measured).toEqual({
    width: frame!.width,
    height: frame!.height,
  });
});

it("draws no frame for a collapsed folder with no loaded children", () => {
  const p = build([folder("d", "a"), file("f", "b/f.ts")], []);
  expect(frames(withFolderFrames(p.nodes, p.edges))).toHaveLength(0);
});

it("does not wrap indirect descendants unless their folder is also expanded", () => {
  const p = build(
    [folder("a", "a"), folder("b", "a/b"), file("f", "a/b/f.ts")],
    [contains("a", "b")],
  );
  const out = withFolderFrames(p.nodes, p.edges);
  expect(frames(out)).toHaveLength(1);
  const [frame] = frames(out);
  const f = p.nodes.find((n) => n.data.node.id === "f")!;
  expect(frame!.data.frameTitle).toBe("a");
  // f is only a grandchild (b is not expanded), so it must lie outside the frame.
  expect(f.position.x).toBeGreaterThanOrEqual(
    frame!.position.x + frame!.width!,
  );
});

it("nests frames for expanded sub-folders; the outer frame is larger and listed first", () => {
  const p = build(
    [folder("a", "a"), folder("b", "a/b"), file("f", "a/b/f.ts"), file("g", "a/g.ts")],
    [contains("a", "b"), contains("a", "g"), contains("b", "f")],
  );
  const out = withFolderFrames(p.nodes, p.edges);
  const fr = frames(out);
  expect(fr).toHaveLength(2);
  const [outer, inner] = fr;
  expect(outer!.data.frameTitle).toBe("a");
  expect(inner!.data.frameTitle).toBe("a/b");
  expect(outer!.position.x).toBeLessThan(inner!.position.x);
  expect(outer!.position.y).toBeLessThan(inner!.position.y);
  expect(outer!.position.x + outer!.width!).toBeGreaterThan(
    inner!.position.x + inner!.width!,
  );
  expect(outer!.position.y + outer!.height!).toBeGreaterThan(
    inner!.position.y + inner!.height!,
  );
});

it("frames follow the cards after a drag", () => {
  const p = build(
    [folder("d", "a"), file("f", "a/f.ts")],
    [contains("d", "f")],
  );
  const before = frames(withFolderFrames(p.nodes, p.edges))[0]!;
  const moved = p.nodes.map((n) =>
    n.data.node.id === "f"
      ? { ...n, position: { x: n.position.x + 500, y: n.position.y } }
      : n,
  );
  const after = frames(withFolderFrames(moved, p.edges))[0]!;
  expect(after.width! - before.width!).toBe(500);
});

it("titles a root folder (empty path) with its name instead of leaving the title blank", () => {
  const p = build(
    [
      { id: "r", kind: "folder", name: "./", filePath: "" },
      file("f", "a.ts"),
    ],
    [contains("r", "f")],
  );
  const [frame] = frames(withFolderFrames(p.nodes, p.edges));
  expect(frame!.data.frameTitle).toBe("./");
});

it("ignores relations whose parent is not a folder and never frames a self-reference", () => {
  const p = build(
    [file("f", "a.ts"), file("g", "b.ts"), folder("d", "d")],
    [contains("f", "g"), contains("d", "d")],
  );
  expect(frames(withFolderFrames(p.nodes, p.edges))).toHaveLength(0);
});
