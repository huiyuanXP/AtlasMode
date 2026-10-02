import { expect, test } from "vitest";
import type { CodeSnapshot, Relation } from "./model.js";
import * as queries from "./index.js";

const call = (
  id: string,
  sourceId: string,
  targetId: string | null,
  resolution: Relation["resolution"] = "resolved",
): Relation => ({
  id,
  type: "calls",
  sourceId,
  targetId,
  resolution,
  evidence: { filePath: "src/main.ts", line: 1 },
  ...(resolution === "unresolved" ? { reason: "dynamic dispatch" } : {}),
});
function fixture(): CodeSnapshot {
  return {
    id: "snapshot",
    projectId: "project",
    createdAt: "2026-10-03T00:00:00Z",
    gitRevision: null,
    contentHash: "hash",
    diagnostics: [],
    coverage: {
      files: ["src/main.ts"],
      excludedPatterns: [],
      unresolvedCount: 1,
    },
    nodes: [
      { id: "folder", kind: "folder", name: "src" },
      {
        id: "file",
        kind: "file",
        name: "main.ts",
        filePath: "src/main.ts",
        parentId: "folder",
      },
      {
        id: "b",
        kind: "function",
        name: "Beta",
        filePath: "src/main.ts",
        parentId: "file",
      },
      {
        id: "a",
        kind: "function",
        name: "Alpha",
        qualifiedName: "api.Alpha",
        exported: true,
        filePath: "src/main.ts",
        parentId: "file",
      },
      { id: "ext", kind: "external", name: "package" },
    ],
    relations: [
      call("r3", "a", null, "unresolved"),
      call("r1", "a", "b"),
      call("r2", "a", "ext", "external"),
      call("r4", "b", "a"),
      { ...call("c1", "file", "a"), type: "contains" },
    ],
  };
}
// A missing query implementation or returning all nodes/edges breaks these public contracts.
test("search filters real functions and paginates in deterministic name order", () => {
  expect(queries.searchFunctions).toBeTypeOf("function");
  const snapshot = fixture();
  expect(
    queries.searchFunctions(snapshot, { q: "SRC/MAIN", offset: 1, limit: 1 }),
  ).toMatchObject({
    items: [{ id: "b" }],
    total: 2,
    offset: 1,
    limit: 1,
    snapshotId: "snapshot",
    dataSource: "code",
  });
  expect(
    queries
      .searchFunctions(snapshot, { q: "API.ALPHA" })
      .items.map((n) => n.id),
  ).toEqual(["a"]);
});
test("context paginates calls independently while retaining unresolved reasons", () => {
  expect(queries.getFunctionContext).toBeTypeOf("function");
  expect(
    queries.getFunctionContext(fixture(), "a", { offset: 1, limit: 2 }),
  ).toMatchObject({
    node: { id: "a" },
    incoming: [],
    outgoing: [{ id: "r2" }, { id: "r3", reason: "dynamic dispatch" }],
    totalIncoming: 1,
    totalOutgoing: 3,
    truncated: true,
    offset: 1,
    limit: 2,
    dataSource: "code",
    snapshotId: "snapshot",
  });
});
test("subgraph traverses calls and includes actual physical context without inventing relations", () => {
  expect(queries.getSubgraph).toBeTypeOf("function");
  const result = queries.getSubgraph(fixture(), {
    nodeIds: ["a"],
    depth: 1,
    budget: 8,
  });
  expect(result.nodes.map((n) => n.id).sort()).toEqual([
    "a",
    "b",
    "ext",
    "file",
    "folder",
  ]);
  expect(result.relations.map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4"]);
  expect(result.truncated).toBe(false);
  expect(
    queries.getSubgraph(fixture(), { nodeIds: ["a"], budget: 2 }).truncated,
  ).toBe(true);
  expect(
    queries
      .getSubgraph(fixture(), {
        nodeIds: ["a"],
        depth: 0,
        budget: 8,
        relationTypes: ["contains"],
      })
      .relations.map((r) => r.id),
  ).toEqual(["c1"]);
});
test("both graph budgets clip explicitly and traversal is independent of snapshot order", () => {
  expect(queries.getSubgraph).toBeTypeOf("function");
  const snapshot = fixture();
  snapshot.relations.push(
    ...Array.from({ length: 20 }, (_, i) => call(`dense${i}`, "a", "b")),
  );
  const result = queries.getSubgraph(snapshot, { nodeIds: ["a"], budget: 4 });
  expect(result.nodes).toHaveLength(4);
  expect(result.relations).toHaveLength(12);
  expect(result.truncated).toBe(true);
  expect(
    queries.getSubgraph(
      {
        ...snapshot,
        nodes: [...snapshot.nodes].reverse(),
        relations: [...snapshot.relations].reverse(),
      },
      { nodeIds: ["a"], budget: 4 },
    ),
  ).toEqual(result);
});
test("unknown or mixed-project seeds are rejected before clipping; invalid query bounds rejected", () => {
  expect(queries.getSubgraph).toBeTypeOf("function");
  expect(() =>
    queries.getSubgraph(fixture(), {
      nodeIds: ["a", "other-project"],
      budget: 1,
    }),
  ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
  expect(() => queries.getFunctionContext(fixture(), "file")).toThrowError(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  expect(() => queries.searchFunctions(fixture(), { limit: 201 })).toThrowError(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
  expect(() =>
    queries.getSubgraph(fixture(), { nodeIds: ["a"], depth: 6 }),
  ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
});
test("summary exposes only evidenced exported candidates with bounded entrypoints and honest call counts", () => {
  expect(queries.getProjectSummary).toBeTypeOf("function");
  const snapshot = fixture();
  snapshot.nodes.push(
    ...Array.from({ length: 55 }, (_, i) => ({
      id: `public${i}`,
      kind: "function" as const,
      name: `public${i}`,
      exported: true,
    })),
  );
  const result = queries.getProjectSummary(
    { id: "project", name: "demo", path: "/demo" },
    snapshot,
  );
  expect(result.entrypoints).toHaveLength(50);
  expect(result.entrypointTotal).toBe(56);
  expect(result.entrypointsTruncated).toBe(true);
  expect(result.entrypoints.some((n) => n.id === "b")).toBe(false);
  expect(result.counts).toEqual({
    files: 1,
    folders: 1,
    functions: 57,
    relations: 5,
    calls: { resolved: 2, unresolved: 1, external: 1 },
  });
  expect(() =>
    queries.getProjectSummary(
      { id: "other", name: "other", path: "/other" },
      snapshot,
    ),
  ).toThrowError(expect.objectContaining({ code: "PROJECT_MISMATCH" }));
});
test("Python public-name candidates exclude nested functions and methods", () => {
  const snapshot = fixture();
  snapshot.nodes.push(
    { id: "pyfile", kind: "file", name: "public.py", filePath: "public.py" },
    {
      id: "pyentry",
      kind: "function",
      name: "public_api",
      exported: true,
      language: "python",
      parentId: "pyfile",
    },
    {
      id: "pynested",
      kind: "function",
      name: "local_helper",
      exported: true,
      language: "python",
      parentId: "pyentry",
    },
    {
      id: "pymethod",
      kind: "function",
      name: "method",
      exported: true,
      language: "python",
      parentId: "pyentry",
    },
  );
  expect(
    queries
      .getProjectSummary(
        { id: "project", name: "demo", path: "/demo" },
        snapshot,
      )
      .entrypoints.map((n) => n.id)
      .sort(),
  ).toEqual(["a", "pyentry"]);
});
