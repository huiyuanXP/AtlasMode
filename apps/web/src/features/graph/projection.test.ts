import { describe, expect, it } from "vitest";
import type { Operation, SubgraphResult } from "@codemap/core";
import { projectGraph, sourceWindow } from "./projection.js";
const graph: SubgraphResult = {
  snapshotId: "s",
  dataSource: "code",
  truncated: false,
  nodes: [
    {
      id: "a",
      kind: "function",
      name: "real",
      filePath: "src/a.ts",
      parentId: "file",
    },
    {
      id: "b",
      kind: "function",
      name: "callee",
      filePath: "src/a.ts",
      parentId: "file",
    },
    { id: "file", kind: "file", name: "a.ts", filePath: "src/a.ts" },
  ],
  relations: [
    {
      id: "r",
      type: "calls",
      sourceId: "a",
      targetId: "b",
      resolution: "resolved",
      evidence: { filePath: "src/a.ts", line: 2 },
    },
  ],
};
const operations: Operation[] = [
  {
    kind: "add_function",
    tempId: "temp:new",
    name: "planned",
    filePath: "src/new.ts",
  },
  { kind: "move_function", nodeId: "a", filePath: "src/moved.ts" },
  { kind: "remove_relation", relationId: "r" },
  {
    kind: "add_relation",
    id: "temp:edge",
    sourceId: "temp:new",
    targetId: "a",
    type: "must_reuse",
  },
];
describe("fact-preserving graph projection", () => {
  it("keeps code facts immutable while giving changes separate IDs and labels", () => {
    const before = structuredClone(graph);
    const result = projectGraph(graph, operations, "both", {});
    expect(graph).toEqual(before);
    expect(result.nodes.find((n) => n.id === "fact:a")?.data.node).toEqual(
      graph.nodes[0],
    );
    expect(result.nodes.find((n) => n.id === "plan:temp:new")?.data.layer).toBe(
      "plan",
    );
    expect(result.edges.find((e) => e.id === "fact:r")?.data?.layer).toBe(
      "fact",
    );
    expect(result.edges.find((e) => e.id === "plan:temp:edge")).toMatchObject({
      source: "plan:temp:new",
      target: "fact:a",
      label: "规划 · 必须复用",
    });
    expect(result.nodes.find((n) => n.id === "fact:a")?.data.changes).toContain(
      "→ src/moved.ts",
    );
  });
  it("retains existing anchors in plan-only view without presenting planned edges as facts", () => {
    const result = projectGraph(graph, operations, "plan", {});
    expect(result.nodes.map((n) => n.id)).toContain("fact:a");
    expect(result.edges.map((e) => e.id)).toEqual(["plan:temp:edge"]);
    expect(result.nodes.find((n) => n.id === "fact:a")?.data.layer).toBe(
      "anchor",
    );
    expect(
      projectGraph(graph, operations, "fact", {}).nodes.map((n) => n.id),
    ).not.toContain("plan:temp:new");
  });
  it("does not invent endpoints for unresolved calls or missing plan anchors", () => {
    const result = projectGraph(
      {
        ...graph,
        relations: [
          {
            ...graph.relations[0]!,
            targetId: null,
            resolution: "unresolved",
            reason: "dynamic",
          },
        ],
      },
      [
        {
          kind: "add_relation",
          id: "x",
          sourceId: "a",
          targetId: "missing",
          type: "calls",
        },
      ],
      "both",
      {},
    );
    expect(result.edges).toHaveLength(0);
    expect(result.notices.join(" ")).toContain("dynamic");
    expect(result.notices.join(" ")).toContain("missing");
  });
  it("caps readonly source windows and preserves actual line numbers", () => {
    const result = sourceWindow(
      Array.from({ length: 400 }, (_, i) => `line ${i + 1}`).join("\n"),
      20,
      350,
    );
    expect(result.startLine).toBe(20);
    expect(result.endLine).toBe(219);
    expect(result.truncated).toBe(true);
    expect(result.text).toMatch(/^20  line 20/);
  });
});
it("invalid colliding temporary IDs cannot redirect fact edges to planned nodes", () => {
  const result = projectGraph(
    graph,
    [
      {
        kind: "add_function",
        tempId: "a",
        name: "impostor",
        filePath: "new.ts",
      },
    ],
    "both",
    {},
  );
  expect(result.edges.find((e) => e.id === "fact:r")).toMatchObject({
    source: "fact:a",
    target: "fact:b",
  });
});
it("keeps a reconnected searched target readable as a fact reference outside the local graph", () => {
  const result = projectGraph(
    graph,
    [
      {
        kind: "add_relation",
        id: "reuse",
        sourceId: "a",
        targetId: "searched",
        type: "must_reuse",
      },
    ],
    "both",
    {},
    "en",
    [
      {
        id: "searched",
        kind: "function",
        name: "requestWithRetry",
        filePath: "requests.ts",
      },
      { id: "unused", kind: "function", name: "unrelated" },
    ],
  );
  expect(
    result.nodes.find((n) => n.id === "fact:searched")?.data,
  ).toMatchObject({
    layer: "anchor",
    node: { name: "requestWithRetry", filePath: "requests.ts" },
  });
  expect(result.edges.find((e) => e.id === "plan:reuse")).toMatchObject({
    target: "fact:searched",
  });
  expect(result.nodes.some((n) => n.id === "fact:unused")).toBe(false);
  expect(graph.nodes.some((n) => n.id === "searched")).toBe(false);
});
