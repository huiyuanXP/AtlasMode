import { expect, it } from "vitest";
import { inspectionHighlight } from "../graph/inspection.js";
import type { GraphNode, GraphEdge } from "../graph/projection.js";
const node = (id: string, domain: string, members: string[] = []) =>
  ({
    id,
    position: { x: 0, y: 0 },
    data: {
      node: { id: domain, kind: "function", name: domain },
      layer: "fact",
      changes: [],
      ...(members.length
        ? {
            group: {
              loadedMembers: members.map((id) => ({
                id,
                kind: "function",
                name: id,
              })),
            },
          }
        : {}),
    },
  }) as GraphNode;
it("highlights collapsed aliases by real endpoints and keeps incoming/outgoing directions", () => {
  const nodes = [
    node("group:g1", "group:g1", ["a"]),
    node("group:g2", "group:g2", ["a"]),
    node("fact:b", "b"),
    node("fact:c", "c"),
  ];
  const edges = [
    {
      id: "out",
      source: "group:g1",
      target: "fact:b",
      data: { layer: "fact", domainId: "r1", sourceId: "a", targetId: "b" },
    },
    {
      id: "in",
      source: "fact:c",
      target: "group:g2",
      data: { layer: "fact", domainId: "r2", sourceId: "c", targetId: "a" },
    },
  ] as GraphEdge[];
  const result = inspectionHighlight(nodes, edges, "a");
  expect(result.edges.map((e) => e.data?.highlight)).toEqual([
    "outgoing",
    "incoming",
  ]);
  expect(result.nodes.slice(0, 2).map((n) => n.data.highlight)).toEqual([
    "selected",
    "selected",
  ]);
  expect(result.nodes.slice(0, 2).every((n) => n.selected)).toBe(true);
});
it("gives every shared function alias selected emphasis and identifies inbound mirrors by domain target", () => {
  const result = inspectionHighlight(
    [node("alias1", "a"), node("alias2", "a"), node("b", "b")],
    [
      {
        id: "e",
        source: "b",
        target: "alias2",
        data: { layer: "fact", domainId: "r", sourceId: "b", targetId: "a" },
      },
    ] as GraphEdge[],
    "a",
  );
  expect(result.nodes.slice(0, 2).map((n) => n.data.highlight)).toEqual([
    "selected",
    "selected",
  ]);
  expect(result.edges[0]?.data?.highlight).toBe("incoming");
});
