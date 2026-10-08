import { expect, it } from "vitest";
import type { Relation, SubgraphResult } from "@codemap/core";
import { projectGraph } from "./projection.js";
import * as funnel from "./funnel.js";
const node = (id: string) => ({ id, kind: "function" as const, name: id });
const edge = (
  sourceId: string,
  targetId: string,
  type: Relation["type"] = "calls",
): Relation => ({
  id: `${sourceId}-${targetId}-${type}`,
  sourceId,
  targetId,
  type,
  resolution: "resolved",
  evidence: { filePath: "a.ts", line: 1 },
});
const graph = (relations: Relation[]): SubgraphResult => ({
  nodes: ["selected", "caller", "callee", "other"].map(node),
  relations,
  snapshotId: "s",
  dataSource: "code",
  truncated: false,
});
function layout(relations: Relation[]) {
  const g = graph(relations);
  return funnel.layoutFunnel(projectGraph(g, [], "both", {}), "selected");
}
it("places incoming above the singleton waist, outgoing below and containment/unrelated cards in a horizontal side lane", () => {
  const result = layout([
    edge("caller", "selected"),
    edge("selected", "callee"),
    edge("selected", "other", "contains"),
  ]);
  const by = Object.fromEntries(result.nodes.map((n) => [n.data.node.id, n]));
  expect(by.caller!.position.y).toBeLessThan(by.selected!.position.y);
  expect(by.callee!.position.y).toBeGreaterThan(by.selected!.position.y);
  expect(
    result.nodes
      .filter((n) => n.data.funnelLane === "selected")
      .map((n) => n.data.node.id),
  ).toEqual(["selected"]);
  expect(by.other!.data.funnelLane).toBe("side");
  expect(by.other!.position.x).toBeGreaterThan(by.selected!.position.x + 300);
  expect(result.relatedIds.sort()).toEqual([
    "fact:callee",
    "fact:caller",
    "fact:selected",
  ]);
});
it("keeps reciprocal/cyclic/self dependencies unique and deterministic", () => {
  const relations = [
    edge("caller", "selected"),
    edge("selected", "caller"),
    edge("selected", "callee"),
    edge("callee", "caller"),
    edge("selected", "selected"),
  ];
  const a = layout(relations),
    b = layout([...relations].reverse());
  expect(a.nodes).toEqual(b.nodes);
  expect(a.counts).toMatchObject({ dependents: 1, dependencies: 2, side: 1 });
  expect(a.nodes.filter((n) => n.data.node.id === "caller")).toHaveLength(1);
  expect(
    a.nodes.find((n) => n.data.node.id === "caller")!.data.reciprocal,
  ).toBe(true);
});
it("handles an isolated root and planned-only relations without pretending containment is a dependency", () => {
  expect(layout([]).counts).toMatchObject({
    dependents: 0,
    dependencies: 0,
    side: 3,
  });
  const p = projectGraph(
    undefined,
    [
      { kind: "add_function", tempId: "new", name: "new", filePath: "new.ts" },
      {
        kind: "add_function",
        tempId: "helper",
        name: "helper",
        filePath: "new.ts",
      },
      {
        kind: "add_relation",
        id: "p",
        sourceId: "new",
        targetId: "helper",
        type: "must_reuse",
      },
    ],
    "both",
    {},
  );
  const result = funnel.layoutFunnel(p, "new");
  expect(
    result.nodes.find((n) => n.data.node.id === "helper")!.position.y,
  ).toBeGreaterThan(
    result.nodes.find((n) => n.data.node.id === "new")!.position.y,
  );
});
