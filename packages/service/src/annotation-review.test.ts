import { expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  semanticPlanContent,
  type Annotation,
  type AnnotationReviewApproval,
  type ApprovedAnnotationContext,
  type Plan,
} from "@codemap/core";
import {
  annotationKnowledgeHash,
  validateApprovalContext,
  matchesCurrentKnowledge,
} from "./annotation-review.js";
const note: Annotation = {
  id: "a",
  projectId: "p",
  revision: 1,
  text: "keep",
  author: "user",
  source: "user",
  isConstraint: true,
  binding: null,
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
};
const context: ApprovedAnnotationContext = {
  version: 1,
  projectId: "p",
  snapshotId: "s",
  annotations: [note],
};
const plan: Plan = {
  id: "plan",
  projectId: "p",
  title: "Plan",
  description: "",
  baselineSnapshotId: "s",
  baselineContentHash: "hash",
  revision: 1,
  operations: [],
  status: "approved",
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
};
function approval(): AnnotationReviewApproval {
  return {
    id: "new",
    planId: "plan",
    revision: 1,
    semanticHash: createHash("sha256")
      .update(semanticPlanContent(plan))
      .digest("hex"),
    baselineSnapshotId: "s",
    baselineContentHash: "hash",
    approvedAt: note.createdAt,
    actor: "user",
    reviewContext: {
      version: 1,
      knowledgeHash: annotationKnowledgeHash(context),
    },
  };
}
test("the versioned review hash covers the fixed semantic context with the required NUL domain prefix", () => {
  const golden = '[1,"p","s",[["a","p","keep","user","user",true,null]]]';
  const expected = createHash("sha256")
    .update("atlasmode-annotation-review-v1")
    .update(Buffer.from([0]))
    .update(golden)
    .digest("hex");
  expect(annotationKnowledgeHash(context)).toBe(expected);
  expect(validateApprovalContext(approval(), plan, context, new Set())).toBe(
    "v1",
  );
  expect(matchesCurrentKnowledge(approval(), context)).toBe(true);
  expect(
    matchesCurrentKnowledge(approval(), {
      ...context,
      annotations: [{ ...note, text: "changed" }],
    }),
  ).toBe(false);
});
test.each([
  "missing",
  "text",
  "author",
  "source",
  "constraint",
  "project",
  "snapshot",
  "version",
  "duplicate",
  "deleted",
] as const)(
  "a new approval refuses %s review context rather than trusting the plan hash",
  (change) => {
    const modified = structuredClone(context);
    if (change === "text") modified.annotations[0]!.text = "tampered";
    if (change === "author") modified.annotations[0]!.author = "tampered";
    if (change === "source") modified.annotations[0]!.source = "agent";
    if (change === "constraint") modified.annotations[0]!.isConstraint = false;
    if (change === "project") modified.projectId = "foreign";
    if (change === "snapshot") modified.snapshotId = "other";
    if (change === "version") Object.assign(modified, { version: 2 });
    if (change === "duplicate") modified.annotations.push(note);
    if (change === "deleted")
      modified.annotations[0]!.deletedAt = note.updatedAt;
    expect(() =>
      validateApprovalContext(
        approval(),
        plan,
        change === "missing" ? undefined : modified,
        new Set(),
      ),
    ).toThrow(/approval.*context/i);
  },
);
test("legacy compatibility needs the frozen original ID, no version tag and no replacement context", () => {
  const legacy = approval();
  legacy.id = "old";
  delete legacy.reviewContext;
  expect(
    validateApprovalContext(legacy, plan, undefined, new Set(["old"])),
  ).toBe("legacy");
  expect(() =>
    validateApprovalContext(legacy, plan, context, new Set(["old"])),
  ).toThrow();
  expect(() =>
    validateApprovalContext(legacy, plan, undefined, new Set()),
  ).toThrow();
  const downgraded = approval();
  delete downgraded.reviewContext;
  expect(() =>
    validateApprovalContext(downgraded, plan, undefined, new Set(["old"])),
  ).toThrow();
});
test("approval tag, immutable plan, baseline and ownership are checked with the context", () => {
  for (const changed of [
    { ...approval(), revision: 2 },
    { ...approval(), planId: "other" },
    { ...approval(), semanticHash: "0".repeat(64) },
    { ...approval(), baselineContentHash: "other" },
    {
      ...approval(),
      reviewContext: {
        version: 2,
        knowledgeHash: annotationKnowledgeHash(context),
      },
    },
    {
      ...approval(),
      reviewContext: { version: 1, knowledgeHash: "0".repeat(64) },
    },
  ])
    expect(() =>
      validateApprovalContext(
        changed as AnnotationReviewApproval,
        plan,
        context,
        new Set(),
      ),
    ).toThrow();
  expect(() =>
    validateApprovalContext(
      approval(),
      { ...plan, projectId: "foreign" },
      context,
      new Set(),
    ),
  ).toThrow();
});

test("an explicitly undefined context tag cannot downgrade even an existing legacy ID", () => {
  const malformed = { ...approval(), id: "old", reviewContext: undefined };
  expect(() =>
    validateApprovalContext(malformed, plan, undefined, new Set(["old"])),
  ).toThrow(/approval.*context/i);
  expect(matchesCurrentKnowledge(malformed, context)).toBe(false);
});
