import { expect, it } from "vitest";
import { projectGraph } from "./projection.js";
import {
  inspectionHighlight,
  FunnelOffsets,
  inspectionPlacement,
} from "./inspection.js";
const graph = projectGraph(
  {
    snapshotId: "s",
    dataSource: "code",
    truncated: false,
    nodes: ["a", "b", "c"].map((id) => ({ id, name: id, kind: "function" })),
    relations: ["first", "second"].map((id) => ({
      id,
      sourceId: "a",
      targetId: "b",
      type: "calls",
      resolution: "resolved",
      evidence: { filePath: "a.ts", line: 1 },
    })),
  },
  [],
  "both",
  {},
);
it("relationship preview singles out the actual call ID despite matching endpoints", () => {
  const result = inspectionHighlight(
    graph.nodes,
    graph.edges,
    "a",
    "second",
    "c",
  );
  expect(
    result.edges.map((e) => [e.data?.domainId, e.data?.highlight]),
  ).toEqual([
    ["first", "muted"],
    ["second", "relation"],
  ]);
  expect(result.nodes.map((n) => [n.data.node.id, n.data.highlight])).toEqual([
    ["a", "selected"],
    ["b", "neighbor"],
    ["c", "muted"],
  ]);
});
it("fixed selection wins ordinary hover and preserves incoming and outgoing direction", () => {
  const result = inspectionHighlight(
    graph.nodes,
    graph.edges,
    "b",
    undefined,
    "c",
  );
  expect(result.edges[0]?.data?.highlight).toBe("incoming");
  expect(result.nodes.find((n) => n.data.node.id === "c")?.data.highlight).toBe(
    "muted",
  );
});
it("funnel offsets survive paging and isolate project/root while overview coordinates remain untouched", () => {
  const offsets = new FunnelOffsets();
  offsets.move("p", "root", "fact:a", { x: 50, y: 70 }, { x: 0, y: 0 });
  const nodes = graph.nodes.map((n) => ({ ...n, position: { x: 0, y: 0 } }));
  expect(offsets.apply("p", "root", nodes)[0]?.position).toEqual({
    x: 50,
    y: 70,
  });
  expect(offsets.apply("p", "root", nodes.slice(1))).toHaveLength(2);
  expect(offsets.apply("p", "root", nodes)[0]?.position).toEqual({
    x: 50,
    y: 70,
  });
  expect(offsets.apply("p", "other", nodes)[0]?.position).toEqual({
    x: 0,
    y: 0,
  });
  expect(offsets.apply("other", "root", nodes)[0]?.position).toEqual({
    x: 0,
    y: 0,
  });
  offsets.clear("p", "root");
  expect(offsets.apply("p", "root", nodes)[0]?.position).toEqual({
    x: 0,
    y: 0,
  });
  expect(graph.nodes[0]?.position).toEqual({ x: 0, y: 0 });
});
it("desktop detail placement uses the free side and keeps the node visible", () => {
  const left = inspectionPlacement(1000, 650, {
    x: 610,
    y: 200,
    width: 250,
    height: 180,
  });
  expect(left.left + left.width).toBeLessThan(610);
  const right = inspectionPlacement(1000, 650, {
    x: 80,
    y: 200,
    width: 250,
    height: 180,
  });
  expect(right.left).toBeGreaterThan(330);
});
it("narrow inspection chooses vertical free space above a low selection", () => {
  const placement = inspectionPlacement(550, 650, {
    x: 130,
    y: 410,
    width: 260,
    height: 150,
  });
  expect(placement.top + placement.maxHeight).toBeLessThan(410);
});
it("highlight decoration preserves the projection identity consumed by explicit focus", () => {
  const decorated = inspectionHighlight(graph.nodes, graph.edges, "a").nodes;
  expect(decorated[0]?.data.projectionData).toBe(graph.nodes[0]?.data);
  expect(decorated[1]?.data.projectionData).toBe(graph.nodes[1]?.data);
});

it("desktop details retain a readable card width when the selection requires vertical docking", () => {
  const placement = inspectionPlacement(930, 700, {
    x: 320,
    y: 250,
    width: 280,
    height: 180,
  });
  expect(placement.width).toBeGreaterThanOrEqual(320);
  expect(placement.width).toBeLessThanOrEqual(400);
});
