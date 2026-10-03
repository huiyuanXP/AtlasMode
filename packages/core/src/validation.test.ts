import { describe, expect, it } from "vitest";
import {
  DomainError,
  makeId,
  normalizeRepoPath,
  operationSchema,
  planSchema,
  routeSchema,
  semanticPlanContent,
  snapshotSchema,
  validatePlan,
  validateRoute,
} from "./index.js";
import type {
  BrowseRoute,
  CodeSnapshot,
  DirectoryPolicy,
  Operation,
  Plan,
} from "./index.js";

const time = "2026-10-02T20:00:00.000Z";
const snapshot: CodeSnapshot = {
  id: "s1",
  projectId: "p1",
  createdAt: time,
  gitRevision: null,
  contentHash: "hash1",
  nodes: [
    { id: "a", kind: "function", name: "a", filePath: "src/a.ts" },
    { id: "b", kind: "function", name: "b", filePath: "lib/b.ts" },
    { id: "file", kind: "file", name: "a.ts", filePath: "src/a.ts" },
  ],
  relations: [
    {
      id: "ab",
      type: "calls",
      sourceId: "a",
      targetId: "b",
      resolution: "resolved",
      evidence: { filePath: "src/a.ts", line: 4 },
    },
  ],
  diagnostics: [],
  coverage: {
    files: ["src/a.ts", "lib/b.ts"],
    excludedPatterns: [],
    unresolvedCount: 0,
  },
};
function plan(operations: Operation[] = []): Plan {
  return {
    id: "plan1",
    projectId: "p1",
    title: "Use b",
    description: "Reuse existing behavior",
    baselineSnapshotId: "s1",
    baselineContentHash: "hash1",
    revision: 1,
    operations,
    status: "draft",
    createdAt: time,
    updatedAt: time,
  };
}
function route(): BrowseRoute {
  return {
    id: "r1",
    projectId: "p1",
    snapshotId: "s1",
    revision: 1,
    title: "a calls b",
    description: "",
    source: "agent",
    kind: "call_chain",
    steps: [
      { nodeId: "a", note: "Entry" },
      { nodeId: "b", note: "Call", relationId: "ab" },
    ],
    createdAt: time,
  };
}
const errors = (issues: ReturnType<typeof validatePlan>) =>
  issues.filter((issue) => issue.severity === "error");

describe("optional captured configuration coverage", () => {
  it("reads legacy snapshots without configurationFiles", () => {
    expect(snapshotSchema.parse(snapshot)).toEqual(snapshot);
  });
  it("accepts repository-relative configuration metadata separately from source files", () => {
    const value = {
      ...snapshot,
      coverage: {
        ...snapshot.coverage,
        configurationFiles: ["tsconfig.json", "config/shared.json"],
      },
    };
    expect(snapshotSchema.parse(value)).toEqual(value);
  });
  it.each([
    "../secret.json",
    "/etc/config.json",
    "C:\\config.json",
    "",
    "sub/..",
    "a\u0000.json",
  ])("rejects configuration coverage path %s", (invalid) => {
    expect(
      snapshotSchema.safeParse({
        ...snapshot,
        coverage: { ...snapshot.coverage, configurationFiles: [invalid] },
      }).success,
    ).toBe(false);
  });
});

describe("optional captured package coverage", () => {
  it("distinguishes recorded zero packages from legacy unrecorded coverage", () => {
    expect(snapshotSchema.parse(snapshot).coverage).not.toHaveProperty(
      "packageFiles",
    );
    expect(
      snapshotSchema.parse({
        ...snapshot,
        coverage: { ...snapshot.coverage, packageFiles: [] },
      }).coverage,
    ).toHaveProperty("packageFiles", []);
  });
  it("reads legacy snapshots without packageFiles", () => {
    expect(snapshotSchema.parse(snapshot)).toEqual(snapshot);
  });
  it("accepts repository-relative package metadata separately from source files", () => {
    const value = {
      ...snapshot,
      coverage: {
        ...snapshot.coverage,
        packageFiles: ["package.json", "sub/package.json"],
      },
    };
    expect(snapshotSchema.parse(value)).toEqual(value);
  });
  it.each([
    "../secret.json",
    "/etc/config.json",
    "C:\\config.json",
    "",
    "sub/..",
    "a\u0000.json",
  ])("rejects package coverage path %s", (invalid) => {
    expect(
      snapshotSchema.safeParse({
        ...snapshot,
        coverage: { ...snapshot.coverage, packageFiles: [invalid] },
      }).success,
    ).toBe(false);
  });
});

describe("deterministic identity", () => {
  it("keeps symbol identity stable across metadata changes", () => {
    const original = makeId("function", "p1", "src/a.ts", "a");
    const reindexed = makeId("function", "p1", "src/a.ts", "a");
    expect(original).toBe(reindexed);
    expect(original).not.toBe(makeId("function", "p1", "src/a.ts", "b"));
    expect(original).not.toBe(makeId("file", "p1", "src/a.ts", "a"));
  });
  it("separates parts without delimiter collisions", () => {
    expect(makeId("f", "a:b", "c")).not.toBe(makeId("f", "a", "b:c"));
    expect(makeId("f", "日本語")).not.toBe(makeId("f", "英語"));
  });
});

describe("repository file paths", () => {
  it.each([
    ["src\\lib\\a.ts", "src/lib/a.ts"],
    ["./src//a.ts", "src/a.ts"],
    ["src/../a.ts", "a.ts"],
    ["源码/函数.py", "源码/函数.py"],
  ])("normalizes %s", (input, expected) =>
    expect(normalizeRepoPath(input!)).toBe(expected),
  );
  it.each([
    "",
    " ",
    ".",
    "src/.",
    "src/folder/..",
    "src/..",
    "../a.ts",
    "src/../../a.ts",
    "/a.ts",
    "\\a.ts",
    "C:\\a.ts",
    "C:a.ts",
    "\\\\host\\share\\a.ts",
    "src/",
    "src\\",
    "src/\u0000a.ts",
  ])("rejects unsafe or directory-only %j", (input) => {
    expect(() => normalizeRepoPath(input)).toThrow(DomainError);
  });
  it.each([
    "./C:/outside.ts",
    "src/../C:outside.ts",
    ".\\C:\\outside.ts",
    "src\\..\\C:outside.ts",
  ])("rejects a drive prefix revealed by collapsing %j", (input) => {
    expect(() => normalizeRepoPath(input)).toThrow(DomainError);
  });
});

describe("strict boundary schemas", () => {
  it.each([
    "./C:/outside.ts",
    "src/../C:outside.ts",
    ".\\C:\\outside.ts",
    "src\\..\\C:outside.ts",
  ])("rejects disguised Windows file paths in operations: %j", (filePath) => {
    expect(
      operationSchema.safeParse({
        kind: "add_function",
        tempId: "new",
        name: "new",
        filePath,
      }).success,
    ).toBe(false);
    expect(
      operationSchema.safeParse({
        kind: "move_function",
        nodeId: "a",
        filePath,
      }).success,
    ).toBe(false);
  });
  it("parses the complete public entities", () => {
    expect(planSchema.parse(plan())).toEqual(plan());
    expect(snapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(routeSchema.parse(route())).toEqual(route());
    expect(
      operationSchema.parse({
        kind: "add_function",
        tempId: "new",
        name: "new",
        filePath: "new.ts",
      }),
    ).toEqual({
      kind: "add_function",
      tempId: "new",
      name: "new",
      filePath: "new.ts",
    });
  });
  it("rejects client approval fields and unknown nested fields", () => {
    expect(
      planSchema.safeParse({ ...plan(), approval: { actor: "user" } }).success,
    ).toBe(false);
    expect(
      operationSchema.safeParse({
        kind: "annotate",
        targetId: "a",
        text: "note",
        approved: true,
      }).success,
    ).toBe(false);
    expect(
      snapshotSchema.safeParse({
        ...snapshot,
        nodes: [{ ...snapshot.nodes[0], x: 42 }],
      }).success,
    ).toBe(false);
    expect(
      routeSchema.safeParse({
        ...route(),
        steps: [{ nodeId: "a", note: "", approved: true }],
      }).success,
    ).toBe(false);
  });
  it("rejects malformed paths, revisions, timestamps and discriminants", () => {
    expect(
      operationSchema.safeParse({
        kind: "add_function",
        tempId: "x",
        name: "x",
        filePath: "../bad.ts",
      }).success,
    ).toBe(false);
    expect(planSchema.safeParse({ ...plan(), revision: -1 }).success).toBe(
      false,
    );
    expect(
      planSchema.safeParse({ ...plan(), createdAt: "yesterday" }).success,
    ).toBe(false);
    expect(
      operationSchema.safeParse({ kind: "approve", actor: "user" }).success,
    ).toBe(false);
    expect(
      snapshotSchema.safeParse({
        ...snapshot,
        relations: [
          {
            ...snapshot.relations[0],
            evidence: { filePath: "/etc/passwd", line: 0 },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("plan validation", () => {
  it("accepts recursion and references to new functions declared later", () => {
    expect(
      errors(
        validatePlan(
          plan([
            {
              kind: "add_relation",
              id: "self",
              sourceId: "new",
              targetId: "new",
              type: "calls",
            },
            {
              kind: "add_function",
              tempId: "new",
              name: "new",
              filePath: "src/new.ts",
            },
            {
              kind: "add_relation",
              id: "ba",
              sourceId: "b",
              targetId: "a",
              type: "must_reuse",
            },
          ]),
          snapshot,
        ),
      ),
    ).toEqual([]);
  });
  it("rejects unknown endpoints and removed function endpoints", () => {
    for (const targetId of ["missing", "b"]) {
      const operations: Operation[] = [
        {
          kind: "add_relation",
          id: "ax",
          sourceId: "a",
          targetId,
          type: "calls",
        },
      ];
      if (targetId === "b")
        operations.push({ kind: "remove_function", nodeId: "b" });
      expect(errors(validatePlan(plan(operations), snapshot))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ operationIndex: 0 }),
        ]),
      );
    }
  });
  it.each<Operation>([
    {
      kind: "add_function",
      tempId: "a",
      name: "duplicate",
      filePath: "new.ts",
    },
    { kind: "add_function", tempId: "x", name: "x", filePath: "../outside.ts" },
    { kind: "move_function", nodeId: "a", filePath: "C:\\outside.ts" },
    { kind: "move_function", nodeId: "file", filePath: "new.ts" },
    { kind: "remove_function", nodeId: "missing" },
    { kind: "remove_relation", relationId: "missing" },
    { kind: "annotate", targetId: "missing", text: "orphan" },
    {
      kind: "add_relation",
      id: "ab",
      sourceId: "a",
      targetId: "b",
      type: "calls",
    },
  ])("rejects invalid operation $kind", (operation) =>
    expect(
      errors(validatePlan(plan([operation]), snapshot)).length,
    ).toBeGreaterThan(0),
  );
  it("checks surviving existing dependencies when a function moves into a policy directory", () => {
    const withCall: CodeSnapshot = {
      ...snapshot,
      nodes: [
        ...snapshot.nodes,
        { id: "c", kind: "function", name: "c", filePath: "lib/c.ts" },
      ],
      relations: [
        ...snapshot.relations,
        {
          id: "bc",
          sourceId: "b",
          targetId: "c",
          type: "calls",
          resolution: "resolved",
          evidence: { filePath: "lib/b.ts", line: 2 },
        },
      ],
    };
    const policy: DirectoryPolicy = {
      id: "policy",
      projectId: "p1",
      pathPrefix: "src/",
      purpose: "Independent code",
      forbiddenDependencies: ["lib/"],
    };
    expect(
      errors(
        validatePlan(
          plan([{ kind: "move_function", nodeId: "b", filePath: "src/b.ts" }]),
          withCall,
          [policy],
        ),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      errors(
        validatePlan(
          plan([
            { kind: "move_function", nodeId: "b", filePath: "src/b.ts" },
            { kind: "remove_relation", relationId: "bc" },
            { kind: "remove_relation", relationId: "ab" },
          ]),
          withCall,
          [policy],
        ),
      ),
    ).toEqual([]);
  });
  it("rejects foreign projects and stale baseline identities", () => {
    expect(
      errors(validatePlan({ ...plan(), projectId: "p2" }, snapshot)).length,
    ).toBeGreaterThan(0);
    expect(
      errors(validatePlan({ ...plan(), baselineSnapshotId: "old" }, snapshot))
        .length,
    ).toBeGreaterThan(0);
    expect(
      errors(
        validatePlan({ ...plan(), baselineContentHash: "changed" }, snapshot),
      ).length,
    ).toBeGreaterThan(0);
  });
  it("applies directory policies at path boundaries and after a move", () => {
    const policy: DirectoryPolicy = {
      id: "policy",
      projectId: "p1",
      pathPrefix: "src",
      purpose: "Independent code",
      forbiddenDependencies: ["lib"],
    };
    const connect: Operation = {
      kind: "add_relation",
      id: "new-ab",
      sourceId: "a",
      targetId: "b",
      type: "must_call",
    };
    expect(
      errors(validatePlan(plan([connect]), snapshot, [policy])).length,
    ).toBeGreaterThan(0);
    expect(
      errors(
        validatePlan(
          plan([
            { kind: "move_function", nodeId: "a", filePath: "src-other/a.ts" },
            connect,
          ]),
          snapshot,
          [policy],
        ),
      ),
    ).toEqual([]);
  });
});

describe("semantic plan content", () => {
  it("ignores revision, status, times and view metadata", () => {
    const first = plan([{ kind: "annotate", targetId: "a", text: "Reuse b" }]);
    const moved = {
      ...first,
      revision: 2,
      status: "approved" as const,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
      positions: { a: { x: 10, y: 20 } },
    };
    expect(semanticPlanContent(first)).toBe(semanticPlanContent(moved));
  });
  it("canonicalizes field order but preserves operation order and semantic changes", () => {
    const first = plan([
      { kind: "annotate", targetId: "a", text: "A" },
      { kind: "annotate", targetId: "b", text: "B" },
    ]);
    const reordered = {
      ...first,
      operations: [
        { text: "A", targetId: "a", kind: "annotate" as const },
        { text: "B", kind: "annotate" as const, targetId: "b" },
      ],
    };
    expect(semanticPlanContent(first)).toBe(semanticPlanContent(reordered));
    expect(semanticPlanContent(first)).not.toBe(
      semanticPlanContent({ ...first, title: "Changed" }),
    );
    expect(semanticPlanContent(first)).not.toBe(
      semanticPlanContent({
        ...first,
        operations: [...first.operations].reverse(),
      }),
    );
    expect(semanticPlanContent(first)).not.toBe(
      semanticPlanContent({ ...first, baselineContentHash: "other" }),
    );
  });
});

describe("browse route validation", () => {
  it("accepts an evidenced call chain and an unrelated walkthrough", () => {
    expect(errors(validateRoute(route(), snapshot))).toEqual([]);
    expect(
      errors(
        validateRoute(
          {
            ...route(),
            kind: "walkthrough",
            steps: [
              { nodeId: "b", note: "" },
              { nodeId: "a", note: "" },
            ],
          },
          snapshot,
        ),
      ),
    ).toEqual([]);
  });
  it("rejects invalid node, project, snapshot and empty steps", () => {
    for (const invalid of [
      { ...route(), steps: [{ nodeId: "missing", note: "" }] },
      { ...route(), projectId: "p2" },
      { ...route(), snapshotId: "old" },
      { ...route(), steps: [] },
    ])
      expect(errors(validateRoute(invalid, snapshot)).length).toBeGreaterThan(
        0,
      );
  });
  it("rejects missing, reversed, unresolved and non-call evidence", () => {
    expect(
      errors(
        validateRoute(
          {
            ...route(),
            steps: [
              { nodeId: "a", note: "" },
              { nodeId: "b", note: "" },
            ],
          },
          snapshot,
        ),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      errors(
        validateRoute(
          {
            ...route(),
            steps: [
              { nodeId: "b", note: "" },
              { nodeId: "a", note: "", relationId: "ab" },
            ],
          },
          snapshot,
        ),
      ).length,
    ).toBeGreaterThan(0);
    for (const relation of [
      { ...snapshot.relations[0]!, resolution: "unresolved" as const },
      { ...snapshot.relations[0]!, type: "imports" as const },
    ])
      expect(
        errors(validateRoute(route(), { ...snapshot, relations: [relation] }))
          .length,
      ).toBeGreaterThan(0);
  });
});

it.each(["calls", "must_call", "must_reuse"] as const)(
  "warns that planned %s compatibility is unknown without blocking structural approval",
  (type) => {
    const issues = validatePlan(
      plan([
        {
          kind: "add_relation",
          id: "new-call",
          sourceId: "a",
          targetId: "b",
          type,
        },
      ]),
      snapshot,
    );
    expect(errors(issues)).toEqual([]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "COMPATIBILITY_UNKNOWN",
        operationIndex: 0,
        message: expect.stringMatching(/compatibility.*unknown.*adaptation/i),
      }),
    );
  },
);
