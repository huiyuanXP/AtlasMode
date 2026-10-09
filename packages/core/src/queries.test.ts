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
test("function context supplies just the paged relation endpoints by stable ID", () => {
  const snapshot = fixture();
  snapshot.nodes.push({ id: "same-name", kind: "function", name: "Beta" });
  expect(
    queries
      .getFunctionContext(snapshot, "a", { offset: 1, limit: 1 })
      .relatedNodes?.map((node) => node.id),
  ).toEqual(["a", "ext"]);
});

function fileFixture(): CodeSnapshot {
  const snapshot = fixture();
  snapshot.nodes.push(
    {
      id: "other-file",
      kind: "file",
      name: "other.ts",
      filePath: "src/other.ts",
    },
    {
      id: "other-a",
      kind: "function",
      name: "Alpha",
      filePath: "src/other.ts",
      parentId: "other-file",
    },
    {
      id: "other-b",
      kind: "function",
      name: "Beta",
      filePath: "src/other.ts",
      parentId: "other-file",
    },
    { id: "nested", kind: "function", name: "method", parentId: "b" },
    {
      id: "unrelated-file",
      kind: "file",
      name: "unrelated.ts",
      filePath: "unrelated.ts",
    },
    {
      id: "unrelated-a",
      kind: "function",
      name: "Alpha",
      filePath: "unrelated.ts",
      parentId: "unrelated-file",
    },
  );
  snapshot.relations.push(
    {
      ...call("in-1", "other-a", "a"),
      evidence: { filePath: "src/other.ts", line: 12, text: "Alpha()" },
    },
    {
      ...call("in-2", "other-a", "a"),
      evidence: { filePath: "src/other.ts", line: 13, text: "Alpha()" },
    },
    call("out-1", "nested", "other-b"),
    call("out-2", "b", "other-a"),
    { ...call("import-out", "file", "other-file"), type: "imports" },
    { ...call("import-in", "other-file", "file"), type: "imports" },
    { ...call("import-unknown", "file", null, "unresolved"), type: "imports" },
    call("unrelated", "unrelated-a", "other-a"),
  );
  return snapshot;
}

test("file context separates declarations, cross-file calls, imports and unknown evidence", () => {
  const result = queries.getFileContext(fileFixture(), "file");
  expect(result.members.map((node) => node.id)).toEqual(["a", "b", "nested"]);
  expect(result.incoming).toEqual([
    expect.objectContaining({
      id: "in-1",
      sourceId: "other-a",
      targetId: "a",
      evidence: { filePath: "src/other.ts", line: 12, text: "Alpha()" },
    }),
    expect.objectContaining({
      id: "in-2",
      sourceId: "other-a",
      targetId: "a",
      evidence: { filePath: "src/other.ts", line: 13, text: "Alpha()" },
    }),
  ]);
  expect(result.outgoing.map((relation) => relation.id)).toEqual([
    "out-1",
    "out-2",
  ]);
  expect(result.imports.map((relation) => relation.id)).toEqual([
    "import-in",
    "import-out",
    "import-unknown",
  ]);
  expect(result.unknown.map((relation) => relation.id)).toEqual(["r2", "r3"]);
  expect(result.unknown[1]).toMatchObject({
    targetId: null,
    reason: "dynamic dispatch",
  });
  expect(result).toMatchObject({
    node: { id: "file" },
    totalMembers: 3,
    totalIncoming: 2,
    totalOutgoing: 2,
    totalImports: 3,
    totalUnknown: 2,
    snapshotId: "snapshot",
    dataSource: "code",
    truncated: false,
  });
  expect(result.relatedNodes.some((node) => node.id === "unrelated-a")).toBe(
    false,
  );
});

test("file context pages every group independently and bounds endpoint names to current evidence", () => {
  const snapshot = fileFixture();
  const result = queries.getFileContext(snapshot, "file", {
    offset: 1,
    limit: 1,
  });
  expect(result.members.map((node) => node.id)).toEqual(["b"]);
  expect(result.incoming.map((relation) => relation.id)).toEqual(["in-2"]);
  expect(result.outgoing.map((relation) => relation.id)).toEqual(["out-2"]);
  expect(result.imports.map((relation) => relation.id)).toEqual(["import-out"]);
  expect(result.unknown.map((relation) => relation.id)).toEqual(["r3"]);
  expect(result.relatedNodes.map((node) => node.id).sort()).toEqual([
    "a",
    "b",
    "file",
    "other-a",
    "other-file",
  ]);
  expect(result).toMatchObject({ offset: 1, limit: 1, truncated: true });
  expect(
    queries.getFileContext(
      {
        ...snapshot,
        nodes: [...snapshot.nodes].reverse(),
        relations: [...snapshot.relations].reverse(),
      },
      "file",
      { offset: 1, limit: 1 },
    ),
  ).toEqual(result);
  const empty = queries.getFileContext(snapshot, "file", {
    offset: 999,
    limit: 1,
  });
  expect(empty.members).toEqual([]);
  expect(empty.relatedNodes).toEqual([]);
  expect(empty.totalIncoming).toBe(2);
  expect(empty.truncated).toBe(true);
});

test("file context validates IDs and pagination before returning project facts", () => {
  for (const id of ["other-project:file", "missing", "a", "folder"])
    expect(() => queries.getFileContext(fileFixture(), id)).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  for (const page of [
    { limit: 0 },
    { limit: 201 },
    { offset: -1 },
    { offset: 1.5 },
  ])
    expect(() =>
      queries.getFileContext(fileFixture(), "file", page),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
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
