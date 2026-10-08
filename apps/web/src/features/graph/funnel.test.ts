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
it("pages each directional lane without relabeling omitted dependencies as unrelated or retaining dangling edges", () => {
  const g: SubgraphResult = {
    ...graph([]),
    nodes: [
      node("selected"),
      node("other"),
      ...Array.from({ length: 8 }, (_, i) => node(`up${i}`)),
      ...Array.from({ length: 7 }, (_, i) => node(`down${i}`)),
    ],
    relations: [
      ...Array.from({ length: 8 }, (_, i) => edge(`up${i}`, "selected")),
      ...Array.from({ length: 7 }, (_, i) => edge("selected", `down${i}`)),
      edge("selected", "up0"),
    ],
  };
  const projection = projectGraph(g, [], "both", {});
  const first = funnel.layoutFunnel(projection, "selected", {
    dependentsPage: 0,
    dependenciesPage: 0,
    pageSize: 3,
  });
  expect(first.counts).toEqual({ dependents: 8, dependencies: 8, side: 1 });
  expect(first.reciprocalCount).toBe(1);
  expect(
    first.nodes
      .filter((n) => n.data.funnelLane === "dependent")
      .map((n) => n.data.node.id),
  ).toEqual(["up0", "up1", "up2"]);
  expect(
    first.nodes
      .filter((n) => n.data.funnelLane === "dependency")
      .map((n) => n.data.node.id),
  ).toEqual(["down0", "down1", "down2"]);
  expect(
    first.nodes
      .filter((n) => n.data.funnelLane === "side")
      .map((n) => n.data.node.id),
  ).toEqual(["other"]);
  expect(first.windows.dependents).toMatchObject({
    start: 1,
    end: 3,
    total: 8,
    page: 0,
    pages: 3,
  });
  expect(
    first.nodes.find((n) => n.data.node.id === "up0")?.data.reciprocal,
  ).toBe(true);
  const all = new Set<string>();
  for (let page = 0; page < 3; page++) {
    const result = funnel.layoutFunnel(projection, "selected", {
      dependentsPage: page,
      dependenciesPage: page,
      pageSize: 3,
    });
    const ids = new Set(result.nodes.map((n) => n.id));
    expect(
      result.edges.every((e) => ids.has(e.source) && ids.has(e.target)),
    ).toBe(true);
    for (const n of result.nodes.filter((n) => n.data.funnelLane !== "side"))
      all.add(n.data.node.id);
    expect(
      result.nodes.filter((n) => n.data.funnelLane === "selected"),
    ).toHaveLength(1);
  }
  expect([...all].sort()).toEqual(
    g.nodes
      .filter((n) => n.id !== "other")
      .map((n) => n.id)
      .sort(),
  );
});
