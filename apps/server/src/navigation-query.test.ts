import { expect, it } from "vitest";
import type { CodeSnapshot } from "@codemap/core";
import { navigationScope } from "./navigation-query.js";
const snapshot: CodeSnapshot = {
  id: "captured",
  projectId: "p",
  createdAt: "now",
  gitRevision: null,
  contentHash: "hash",
  diagnostics: [],
  coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
  nodes: [
    { id: "root", kind: "folder", name: "." },
    {
      id: "src",
      kind: "folder",
      name: "src",
      filePath: "src",
      parentId: "root",
    },
    {
      id: "nested",
      kind: "folder",
      name: "nested",
      filePath: "src/nested",
      parentId: "src",
    },
    {
      id: "a",
      kind: "file",
      name: "same.ts",
      filePath: "src/same.ts",
      parentId: "src",
    },
    {
      id: "b",
      kind: "file",
      name: "same.ts",
      filePath: "src/nested/same.ts",
      parentId: "nested",
    },
    {
      id: "f",
      kind: "function",
      name: "run",
      filePath: "src/same.ts",
      parentId: "a",
    },
  ],
  relations: [
    {
      id: "r",
      type: "contains",
      sourceId: "root",
      targetId: "src",
      resolution: "resolved",
      evidence: { filePath: "src", line: 1 },
    },
    {
      id: "s",
      type: "contains",
      sourceId: "src",
      targetId: "a",
      resolution: "resolved",
      evidence: { filePath: "src/same.ts", line: 1 },
    },
    {
      id: "call",
      type: "calls",
      sourceId: "a",
      targetId: "b",
      resolution: "resolved",
      evidence: { filePath: "src/same.ts", line: 1 },
    },
  ],
};
it("returns captured root and only immediate children within the bounded scope", () => {
  const root = navigationScope(snapshot, { path: ".", kind: "folder" });
  expect(root.nodes.map((n) => n.id)).toEqual(["root", "src"]);
  expect(root.relations.map((r) => r.id)).toEqual(["r"]);
  expect(root.snapshotId).toBe("captured");
  const folder = navigationScope(snapshot, {
    path: "src",
    kind: "folder",
    budget: 2,
  });
  expect(folder.nodes.map((n) => n.id)).toEqual(["src", "nested"]);
  expect(folder.truncated).toBe(true);
});
it("resolves same-name files by full exact path and never invents a planned file", () => {
  expect(
    navigationScope(snapshot, { path: "src/nested/same.ts", kind: "file" }).root
      ?.id,
  ).toBe("b");
  expect(() =>
    navigationScope(snapshot, { path: "planned/new.ts", kind: "file" }),
  ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
});
it("rejects stale snapshot, unbounded queries and noncanonical paths", () => {
  expect(() =>
    navigationScope(snapshot, {
      path: "src",
      kind: "folder",
      snapshotId: "old",
    }),
  ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_CHANGED" }));
  for (const budget of [0, 301, 1.5])
    expect(() =>
      navigationScope(snapshot, { path: ".", kind: "folder", budget }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  for (const path of [
    "../src",
    "/src",
    "src/../src",
    "src\\nested",
    "",
    "src//nested",
  ])
    expect(() =>
      navigationScope(snapshot, { path, kind: "folder" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
});
it("returns explicit captured absence for planned-context lookup without inventing a file", () => {
  expect(
    navigationScope(snapshot, {
      path: "planned/new.ts",
      kind: "file",
      allowMissing: true,
    }),
  ).toMatchObject({
    snapshotId: "captured",
    missing: true,
    nodes: [],
    relations: [],
    dataSource: "code",
  });
});
