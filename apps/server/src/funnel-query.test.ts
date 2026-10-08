import { expect, it } from "vitest";
import type { CodeSnapshot, Relation } from "@codemap/core";
import type { WorkspaceService } from "@codemap/service";
import { projectQueries } from "./queries.js";
const relation = (
  id: string,
  sourceId: string,
  targetId: string | null,
  type: Relation["type"] = "calls",
  resolution: Relation["resolution"] = "resolved",
): Relation => ({
  id,
  sourceId,
  targetId,
  type,
  resolution,
  evidence: { filePath: "a.ts", line: 1 },
});
const snapshot: CodeSnapshot = {
  id: "s",
  projectId: "p",
  createdAt: "",
  gitRevision: null,
  contentHash: "",
  diagnostics: [],
  coverage: {
    files: ["a.ts", "b.ts", "c.ts"],
    excludedPatterns: [],
    unresolvedCount: 1,
  },
  nodes: [
    ...["a", "b", "c"].map((id) => ({
      id,
      kind: "file" as const,
      name: `${id}.ts`,
      filePath: `${id}.ts`,
    })),
    ...["a1", "a2", "b1", "c1"].map((id) => ({
      id,
      kind: "function" as const,
      name: id,
      filePath: `${id[0]}.ts`,
      parentId: id[0],
    })),
  ],
  relations: [
    relation("ab1", "a1", "b1"),
    relation("ab2", "a2", "b1"),
    relation("import", "a", "b", "imports"),
    relation("ca", "c1", "a2"),
    relation("own", "a", "a1", "contains"),
    relation("unknown", "a1", null, "calls", "unresolved"),
  ],
};
it("aggregates actual file imports and cross-file calls once per directed pair, preserving unknowns and excluding containment", () => {
  const queries = projectQueries({
    getSnapshot: () => snapshot,
  } as unknown as WorkspaceService);
  const result = queries.dependencies("p", { nodeId: "a", budget: 80 });
  expect(result.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  expect(
    result.relations
      .filter((r) => r.targetId)
      .map((r) => [r.sourceId, r.targetId])
      .sort(),
  ).toEqual([
    ["a", "b"],
    ["c", "a"],
  ]);
  expect(result.unknownCount).toBe(1);
  expect(result.relations.some((r) => r.type === "contains")).toBe(false);
  const bounded = queries.dependencies("p", { nodeId: "a", budget: 2 });
  expect(bounded.nodes).toHaveLength(2);
  expect(bounded.truncated).toBe(true);
  expect(() =>
    queries.dependencies("p", { nodeId: "a", budget: 301 }),
  ).toThrow();
});

it("keeps function external and unresolved targets as unknown evidence without an invented dependency card", () => {
  const externalSnapshot: CodeSnapshot = {
    ...snapshot,
    nodes: [
      ...snapshot.nodes,
      { id: "pkg", kind: "external", name: "package" },
    ],
    relations: [
      ...snapshot.relations,
      relation("ext", "a1", "pkg", "calls", "external"),
    ],
  };
  const q = projectQueries({
    getSnapshot: () => externalSnapshot,
  } as unknown as WorkspaceService);
  const result = q.dependencies("p", { nodeId: "a1", budget: 80 });
  expect(result.nodes.some((n) => n.id === "pkg")).toBe(false);
  expect(result.relations.find((r) => r.id === "ext")?.targetId).toBeNull();
  expect(result.unknownCount).toBe(2);
});
