import type { AnnotationDetail, CodeSnapshot } from "@codemap/core";
export const scope = {
  projectId: "p",
  snapshotId: "s1",
  epoch: 1,
  selectionVersion: 0,
};
export const snapshot: CodeSnapshot = {
  id: "s1",
  projectId: "p",
  createdAt: "2026-10-10T00:00:00.000Z",
  gitRevision: null,
  contentHash: "h",
  nodes: [
    { id: "domain:a", kind: "function", name: "same", filePath: "src/a.ts" },
    { id: "domain:b", kind: "function", name: "same", filePath: "src/b.ts" },
    { id: "file:a", kind: "file", name: "src/a.ts", filePath: "src/a.ts" },
    { id: "folder:src", kind: "folder", name: "src", filePath: "src" },
    { id: "external:a", kind: "external", name: "same" },
  ],
  relations: [
    {
      id: "call:a-b",
      sourceId: "domain:a",
      targetId: "domain:b",
      type: "calls",
      resolution: "resolved",
      evidence: { filePath: "src/a.ts", line: 2 },
    },
  ],
  diagnostics: [],
  coverage: {
    files: ["src/a.ts", "src/b.ts"],
    excludedPatterns: [],
    unresolvedCount: 0,
    availability: { complete: true, unavailablePaths: [], excludedPaths: [] },
  },
};
export function detail(): AnnotationDetail {
  return {
    annotation: {
      id: "note:a",
      projectId: "p",
      revision: 3,
      text: "<script>retained</script>",
      author: "作者",
      source: "agent",
      isConstraint: true,
      binding: {
        state: "orphan",
        target: { kind: "node", id: "domain:gone" },
        selectedSnapshotId: "s0",
        orphanedAtSnapshotId: "s1",
        lastKnown: {
          label: "same",
          filePath: "src/gone.ts",
          nodeKind: "function",
        },
      },
      createdAt: "2026-10-09T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
    },
    resolution: { status: "orphan", snapshotId: "s1" },
  };
}
