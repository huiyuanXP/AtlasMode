import { expect, test } from "vitest";
import {
  annotationSchema,
  createAnnotationSchema,
  bindAnnotationSchema,
  annotationListSchema,
  canonicalAnnotationContext,
  resolveAnnotation,
  selectAnnotationTarget,
  reconcileAnnotationBindings,
  type Annotation,
  type ApprovedAnnotationContext,
} from "./annotations.js";
import type { CodeSnapshot } from "./model.js";

const snapshot: CodeSnapshot = {
  id: "s1",
  projectId: "p",
  createdAt: "2026-10-10T00:00:00.000Z",
  gitRevision: null,
  contentHash: "hash",
  diagnostics: [],
  nodes: [
    { id: "a", kind: "function", name: "same", filePath: "src/a.ts" },
    { id: "b", kind: "function", name: "same", filePath: "src/b.ts" },
    { id: "file", kind: "file", name: "src/a.ts", filePath: "src/a.ts" },
    { id: "folder", kind: "folder", name: "src", filePath: "src" },
    { id: "external", kind: "external", name: "dep" },
  ],
  relations: [
    {
      id: "r",
      type: "calls",
      sourceId: "a",
      targetId: "b",
      resolution: "resolved",
      evidence: { filePath: "src/a.ts", line: 1 },
    },
  ],
  coverage: {
    files: ["src/a.ts", "src/b.ts"],
    excludedPatterns: [],
    unresolvedCount: 0,
    availability: { complete: true, unavailablePaths: [], excludedPaths: [] },
  },
};
const note: Annotation = {
  id: "note",
  projectId: "p",
  revision: 1,
  text: "keep <script>literal</script>",
  author: "作者",
  source: "user",
  isConstraint: true,
  binding: {
    target: { kind: "node", id: "a" },
    selectedSnapshotId: "s1",
    lastKnown: { label: "same", filePath: "src/a.ts", nodeKind: "function" },
    state: "bound",
  },
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
};
const absent = (): CodeSnapshot => ({
  ...structuredClone(snapshot),
  id: "s2",
  nodes: [],
  relations: [],
});

test("independent content preserves prose and normalizes author without needing a plan", () => {
  expect(
    createAnnotationSchema.parse({
      text: "  retained\n",
      author: " 作者 ",
      source: "user",
      isConstraint: true,
      binding: null,
    }),
  ).toEqual({
    text: "  retained\n",
    author: "作者",
    source: "user",
    isConstraint: true,
    binding: null,
  });
  expect(annotationSchema.parse(note)).toEqual(note);
});
test.each([
  { text: " " },
  { text: "x".repeat(20001) },
  { author: " " },
  { author: "x".repeat(201) },
  { revision: 0 },
  { revision: Number.MAX_SAFE_INTEGER + 1 },
  { unexpected: true },
])("invalid content or server-owned record shape is rejected: %j", (change) => {
  expect(annotationSchema.safeParse({ ...note, ...change }).success).toBe(
    false,
  );
});
test("binding input separates detach from snapshot-backed selection and rejects metadata injection", () => {
  expect(
    bindAnnotationSchema.safeParse({ expectedRevision: 1, target: null })
      .success,
  ).toBe(true);
  expect(
    bindAnnotationSchema.safeParse({
      expectedRevision: 1,
      target: null,
      snapshotId: "s1",
    }).success,
  ).toBe(false);
  expect(
    bindAnnotationSchema.safeParse({
      expectedRevision: 1,
      target: { kind: "node", id: "a" },
      snapshotId: "s1",
      text: "overwrite",
    }).success,
  ).toBe(false);
  expect(annotationListSchema.parse({})).toEqual({ offset: 0, limit: 20 });
  expect(annotationListSchema.safeParse({ limit: 101 }).success).toBe(false);
});
test("target selection uses exact kind/id and the explicitly selected snapshot", () => {
  expect(
    selectAnnotationTarget(snapshot, {
      snapshotId: "s1",
      target: { kind: "node", id: "b" },
    }).target.id,
  ).toBe("b");
  expect(
    selectAnnotationTarget(snapshot, {
      snapshotId: "s1",
      target: { kind: "relation", id: "r" },
    }).lastKnown.filePath,
  ).toBe("src/a.ts");
  for (const id of ["same", "fact:a", "group-member:g:a", "temp:a", "external"])
    expect(() =>
      selectAnnotationTarget(snapshot, {
        snapshotId: "s1",
        target: { kind: "node", id },
      }),
    ).toThrow();
  expect(() =>
    selectAnnotationTarget(snapshot, {
      snapshotId: "old",
      target: { kind: "node", id: "a" },
    }),
  ).toThrow(/snapshot/i);
  expect(() =>
    selectAnnotationTarget(snapshot, {
      snapshotId: "s1",
      target: { kind: "relation", id: "a" },
    }),
  ).toThrow();
});
test("a continuously present identity retains its original provenance without mutating the note", () => {
  expect(
    resolveAnnotation(note, { ...snapshot, id: "s2" }).resolution.status,
  ).toBe("bound");
  expect(
    reconcileAnnotationBindings([note], { ...snapshot, id: "s2" }),
  ).toEqual([]);
  expect(note.binding?.selectedSnapshotId).toBe("s1");
});
test("proven missing source becomes orphan and the same ID returning cannot restore it", () => {
  const updated = reconcileAnnotationBindings([note], absent());
  expect(updated).toHaveLength(1);
  expect(updated[0]?.binding).toMatchObject({
    state: "orphan",
    orphanedAtSnapshotId: "s2",
    target: { kind: "node", id: "a" },
  });
  expect(updated[0]?.text).toBe(note.text);
  expect(resolveAnnotation(updated[0]!, snapshot).resolution.status).toBe(
    "orphan",
  );
  expect(reconcileAnnotationBindings(updated, snapshot)).toEqual([]);
  expect(note.binding?.state).toBe("bound");
});
test.each([
  "legacy",
  "incomplete",
  "excluded",
  "unavailable",
  "diagnostic",
] as const)(
  "missing target with %s capture remains unknown, not a durable orphan",
  (kind) => {
    const current = absent();
    if (kind === "legacy") delete current.coverage.availability;
    if (kind === "incomplete") current.coverage.availability!.complete = false;
    if (kind === "excluded")
      current.coverage.availability!.excludedPaths = ["src"];
    if (kind === "unavailable")
      current.coverage.availability!.unavailablePaths = ["src/a.ts"];
    if (kind === "diagnostic")
      current.diagnostics.push({
        filePath: "src/a.ts",
        message: "parse failed",
      });
    expect(resolveAnnotation(note, current).resolution.status).toBe("unknown");
    expect(reconcileAnnotationBindings([note], current)).toEqual([]);
    expect(() =>
      selectAnnotationTarget(
        { ...current, nodes: snapshot.nodes },
        { snapshotId: "s2", target: { kind: "node", id: "a" } },
      ),
    ).toThrow();
  },
);
test("unbound and unavailable snapshots preserve independent content, foreign snapshots are unknown", () => {
  expect(
    resolveAnnotation({ ...note, binding: null }, undefined).resolution.status,
  ).toBe("unbound");
  expect(resolveAnnotation(note, undefined).resolution.status).toBe("unknown");
  expect(
    resolveAnnotation(note, { ...snapshot, projectId: "foreign" }).resolution
      .status,
  ).toBe("unknown");
});
test("relation absence and folder subtree diagnostics use their recorded source path", () => {
  const relation = {
    ...note,
    binding: selectAnnotationTarget(snapshot, {
      snapshotId: "s1",
      target: { kind: "relation", id: "r" },
    }),
  };
  const folder = {
    ...note,
    binding: selectAnnotationTarget(snapshot, {
      snapshotId: "s1",
      target: { kind: "node", id: "folder" },
    }),
  };
  const current = absent();
  current.diagnostics.push({ filePath: "src/child.ts", message: "failed" });
  expect(resolveAnnotation(folder, current).resolution.status).toBe("unknown");
  expect(reconcileAnnotationBindings([relation], absent())).toHaveLength(1);
});
test("canonical review content has fixed semantic fields and is independent of object/order/time metadata", () => {
  const context: ApprovedAnnotationContext = {
    version: 1,
    projectId: "p",
    snapshotId: "s1",
    annotations: [note],
  };
  const golden =
    '[1,"p","s1",[["note","p","keep <script>literal</script>","作者","user",true,["node","a","s1","same","src/a.ts","function","bound",null]]]]';
  expect(canonicalAnnotationContext(context)).toBe(golden);
  const metadata = {
    ...note,
    revision: 42,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2026-10-10T01:00:00.000Z",
  };
  expect(
    canonicalAnnotationContext({ ...context, annotations: [metadata] }),
  ).toBe(golden);
  const another = { ...note, id: "aaa", text: "different" };
  const input = [note, another];
  expect(canonicalAnnotationContext({ ...context, annotations: input })).toBe(
    canonicalAnnotationContext({ ...context, annotations: [another, note] }),
  );
  expect(input[0]?.id).toBe("note");
  for (const changed of [
    { ...note, text: "other" },
    { ...note, author: "other" },
    { ...note, source: "agent" as const },
    { ...note, isConstraint: false },
    { ...note, binding: null },
  ])
    expect(
      canonicalAnnotationContext({ ...context, annotations: [changed] }),
    ).not.toBe(golden);
  for (const changed of [
    { ...context, annotations: [note, note] },
    { ...context, annotations: [{ ...note, projectId: "foreign" }] },
    { ...context, annotations: [{ ...note, deletedAt: note.updatedAt }] },
    { ...context, version: 2 },
  ])
    expect(() =>
      canonicalAnnotationContext(changed as ApprovedAnnotationContext),
    ).toThrow();
});

test.each([
  "kind",
  "id",
  "selectedSnapshot",
  "label",
  "path",
  "nodeKind",
  "orphan",
  "orphanEvidence",
] as const)(
  "canonical review content covers binding semantics: %s",
  (field) => {
    const original = structuredClone(note),
      changed = structuredClone(note);
    const binding = changed.binding!;
    if (field === "kind") {
      binding.target.kind = "relation";
      delete binding.lastKnown.nodeKind;
    }
    if (field === "id") binding.target.id = "b";
    if (field === "selectedSnapshot") binding.selectedSnapshotId = "s2";
    if (field === "label") binding.lastKnown.label = "other";
    if (field === "path") binding.lastKnown.filePath = "src/b.ts";
    if (field === "nodeKind") binding.lastKnown.nodeKind = "file";
    if (field === "orphan" || field === "orphanEvidence") {
      changed.binding = {
        ...binding,
        state: "orphan",
        orphanedAtSnapshotId: "s2",
      };
      if (field === "orphanEvidence")
        original.binding = {
          ...original.binding!,
          state: "orphan",
          orphanedAtSnapshotId: "s3",
        };
    }
    const context = (annotation: Annotation): ApprovedAnnotationContext => ({
      version: 1,
      projectId: "p",
      snapshotId: "s1",
      annotations: [annotation],
    });
    expect(canonicalAnnotationContext(context(changed))).not.toBe(
      canonicalAnnotationContext(context(original)),
    );
  },
);
