import { expect, it } from "vitest";
import type { FunctionGroup, SubgraphResult } from "@codemap/core";
import { projectGraph, focusTargets } from "../graph/projection.js";
import { projectGroups } from "./projection.js";
const fn = (id: string) => ({
  id,
  kind: "function" as const,
  name: id,
  filePath: `src/${id}.ts`,
  parentId: `file-${id}`,
});
const graph: SubgraphResult = {
  snapshotId: "s",
  dataSource: "code",
  truncated: false,
  nodes: [fn("a"), fn("b"), fn("outside")],
  relations: [
    {
      id: "external-call",
      type: "calls",
      sourceId: "a",
      targetId: "outside",
      resolution: "resolved",
      evidence: { filePath: "src/a.ts", line: 7, text: "outside()" },
    },
    {
      id: "internal-call",
      type: "calls",
      sourceId: "b",
      targetId: "a",
      resolution: "resolved",
      evidence: { filePath: "src/b.ts", line: 3 },
    },
  ],
};
const groups: FunctionGroup[] = [
  {
    id: "g1",
    projectId: "p",
    title: "G1",
    description: "",
    source: "user",
    memberIds: ["a", "b", "not-loaded"],
  },
  {
    id: "g2",
    projectId: "p",
    title: "G2",
    description: "",
    source: "agent",
    memberIds: ["a"],
  },
];
it("projects independent shared-member aliases without changing physical parents or source facts", () => {
  const base = projectGraph(graph, [], "both", {});
  const before = structuredClone(base),
    saved = structuredClone(groups);
  const result = projectGroups(base, groups, [], {}, "en");
  expect(base).toEqual(before);
  expect(groups).toEqual(saved);
  expect(
    result.nodes.filter((n) => n.data.node.id === "a").map((n) => n.id),
  ).toEqual(["group-member:g1:a", "group-member:g2:a"]);
  for (const n of result.nodes.filter((n) => n.data.node.id === "a")) {
    expect(n.data.node).toEqual(fn("a"));
    expect(n.parentId).toBeUndefined();
  }
  expect(
    result.nodes.find((n) => n.id === "group:g1")?.data.group,
  ).toMatchObject({
    total: 3,
    loadedMembers: [fn("a"), fn("b")],
    unknownMembers: 1,
    internalRelationIds: ["internal-call"],
  });
});
it("folds members to precise function handles and retains true relation identity and evidence", () => {
  const result = projectGroups(
    projectGraph(graph, [], "both", {}),
    groups,
    ["g1", "g2"],
    {},
    "en",
  );
  expect(result.nodes.some((n) => n.data.node.id === "a")).toBe(false);
  const external = result.edges.filter(
    (e) => e.data?.domainId === "external-call",
  );
  expect(external).toHaveLength(2);
  expect(external.map((e) => [e.source, e.sourceHandle, e.target])).toEqual([
    ["group:g1", "source:a", "fact:outside"],
    ["group:g2", "source:a", "fact:outside"],
  ]);
  for (const edge of external)
    expect(edge.data).toMatchObject({
      sourceId: "a",
      targetId: "outside",
      evidence: { filePath: "src/a.ts", line: 7, text: "outside()" },
      mirrored: true,
    });
  expect(result.edges.some((e) => e.source === e.target)).toBe(false);
  expect(
    result.nodes.find((n) => n.id === "group:g1")?.data.group
      ?.internalRelationIds,
  ).toEqual(["internal-call"]);
  expect(
    focusTargets(result.nodes, { sequence: 1, nodeIds: ["a"] }).map(
      (n) => n.id,
    ),
  ).toEqual(["group:g1", "group:g2"]);
});
it("bounds overlapping routes linearly and preserves plan distinction and unresolved notices", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({
    ...groups[0]!,
    id: `g${String(i).padStart(2, "0")}`,
    memberIds: ["a", "b"],
  }));
  const base = projectGraph(
    {
      ...graph,
      relations: [
        ...graph.relations,
        {
          id: "unknown",
          sourceId: "a",
          targetId: null,
          type: "calls",
          resolution: "unresolved",
          evidence: { filePath: "src/a.ts", line: 9 },
          reason: "dynamic",
        },
      ],
    },
    [
      {
        kind: "add_function",
        tempId: "temp",
        name: "temp",
        filePath: "new.ts",
      },
      {
        kind: "add_relation",
        id: "planned",
        sourceId: "temp",
        targetId: "a",
        type: "must_reuse",
      },
    ],
    "both",
    {},
  );
  const result = projectGroups(base, many, [], {}, "en");
  expect(
    result.edges.filter((e) => e.data?.domainId === "internal-call"),
  ).toHaveLength(15);
  expect(
    result.edges.filter((e) => e.data?.domainId === "external-call"),
  ).toHaveLength(15);
  expect(result.notices.join(" ")).toContain("dynamic");
  expect(result.nodes.find((n) => n.id === "plan:temp")?.data.layer).toBe(
    "plan",
  );
  expect(
    result.edges
      .filter((e) => e.data?.domainId === "planned")
      .every((e) => e.data?.layer === "plan"),
  ).toBe(true);
});
it("keeps saved visual alias and group coordinates distinct from domain identity", () => {
  const result = projectGroups(
    projectGraph(graph, [], "both", {}),
    groups,
    [],
    { "group:g1": { x: 30, y: 40 }, "group-member:g2:a": { x: 500, y: 600 } },
    "en",
  );
  expect(result.nodes.find((n) => n.id === "group:g1")?.position).toEqual({
    x: 30,
    y: 40,
  });
  expect(
    result.nodes.find((n) => n.id === "group-member:g2:a")?.position,
  ).toEqual({ x: 500, y: 600 });
});

it("keeps unrelated groups outside the loaded local canvas while retaining active partial groups", () => {
  const local = projectGraph(
    { ...graph, nodes: [fn("a")], relations: [] },
    [],
    "both",
    {},
  );
  const unrelated = Array.from({ length: 50 }, (_, i) => ({
    ...groups[0]!,
    id: `outside-${i}`,
    memberIds: ["b"],
  }));
  const saved = { "group:outside-0": { x: 999, y: 999 } };
  const result = projectGroups(
    local,
    [groups[0]!, ...unrelated],
    ["outside-0"],
    saved,
    "en",
  );
  expect(
    result.nodes.filter((n) => n.type === "group").map((n) => n.id),
  ).toEqual(["group:g1"]);
  expect(
    result.nodes.find((n) => n.id === "group:g1")?.data.group,
  ).toMatchObject({ loadedMembers: [fn("a")], unknownMembers: 2, total: 3 });
  expect(result.edges).toEqual([]);
  expect(saved).toEqual({ "group:outside-0": { x: 999, y: 999 } });
  expect(
    projectGroups(
      { ...local, nodes: [] },
      unrelated,
      ["outside-0"],
      saved,
      "en",
    ).nodes,
  ).toEqual([]);
});
