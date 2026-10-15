import { expect, it } from "vitest";
import type { Operation, SubgraphResult } from "@codemap/core";
import { breadcrumbs, plannedScopeIds } from "../navigation/path.js";
import { projectGraph } from "../graph/projection.js";
import { plannedOwnershipTargets } from "./ownership-session.js";
const node = {
  id: "real-symbol",
  kind: "function" as const,
  name: "run",
  filePath: "src/index.ts",
};
const operations: Operation[] = [
  { kind: "annotate", targetId: node.id, text: "preserve" },
  { kind: "move_function", nodeId: node.id, filePath: "obsolete/index.ts" },
  { kind: "move_function", nodeId: node.id, filePath: "dest/index.ts" },
];
it("effective planned breadcrumbs retain physical source identity and distinguish identical basenames", () => {
  const before = structuredClone(node);
  const result = breadcrumbs({ id: "p", name: "P", path: "/p" }, node, {
    kind: "file",
    path: "dest/index.ts",
    planned: true,
  });
  expect(result.at(-1)).toMatchObject({ node, path: "dest/index.ts" });
  expect(
    result.filter((s) => s.kind !== "function").map((s) => s.path),
  ).toEqual([".", "dest", "dest/index.ts"]);
  expect(node).toEqual(before);
  expect(
    breadcrumbs({ id: "p", name: "P", path: "/p" }, node).at(-1)?.path,
  ).toBe("src/index.ts");
});
it("legacy repeated moves expose only final effective destination in navigation and planned target tray", () => {
  expect(plannedScopeIds(operations, "obsolete/index.ts", "file")).toEqual([]);
  expect(plannedScopeIds(operations, "dest/index.ts", "file")).toEqual([
    node.id,
  ]);
  expect(plannedOwnershipTargets(operations)).toEqual([
    { kind: "file", path: "dest/index.ts", planned: true },
    { kind: "folder", path: "dest", planned: true },
  ]);
});
it("projection preserves fact bytes and annotation while representing the final target of existing and temporary functions", () => {
  const graph: SubgraphResult = {
    snapshotId: "S0",
    dataSource: "code",
    nodes: [node],
    relations: [],
    truncated: false,
  };
  const ops: Operation[] = [
    ...operations,
    {
      kind: "add_function",
      tempId: "temp:new",
      name: "newFn",
      filePath: "planned/old.ts",
    },
    { kind: "move_function", nodeId: "temp:new", filePath: "planned/new.ts" },
  ];
  const before = structuredClone({ graph, ops });
  const result = projectGraph(graph, ops, "both", {});
  expect(
    result.nodes.find((n) => n.id === `fact:${node.id}`)?.data.node,
  ).toEqual(node);
  expect(
    result.nodes.find((n) => n.id === `fact:${node.id}`)?.data.changes,
  ).toContain("→ dest/index.ts");
  expect(
    result.nodes.find((n) => n.id === `fact:${node.id}`)?.data.changes,
  ).not.toContain("→ obsolete/index.ts");
  expect(
    result.nodes.find((n) => n.id === "plan:temp:new")?.data.node.filePath,
  ).toBe("planned/new.ts");
  expect({ graph, ops }).toEqual(before);
});
