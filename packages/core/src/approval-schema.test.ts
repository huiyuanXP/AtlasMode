import { expect, test } from "vitest";
import {
  approvalSchema,
  legacyApprovalSchema,
  v1ApprovalSchema,
  approvalReviewContextSchema,
} from "./approval-schema.js";
const legacy = {
  id: "approval",
  planId: "plan",
  revision: 1,
  semanticHash: "a".repeat(64),
  baselineSnapshotId: "snapshot",
  baselineContentHash: "hash",
  approvedAt: "2026-10-10T00:00:00.000Z",
  actor: "user" as const,
};
const v1 = {
  ...legacy,
  reviewContext: { version: 1, knowledgeHash: "b".repeat(64) },
};
test("approval payload is either exact historical shape or required v1 review context", () => {
  expect(legacyApprovalSchema.parse(legacy)).toEqual(legacy);
  expect(v1ApprovalSchema.parse(v1)).toEqual(v1);
  expect(approvalSchema.parse(legacy)).toEqual(legacy);
  expect(approvalSchema.parse(v1)).toEqual(v1);
  expect(legacyApprovalSchema.safeParse(v1).success).toBe(false);
  expect(v1ApprovalSchema.safeParse(legacy).success).toBe(false);
});
test.each([
  { reviewContext: undefined },
  { reviewContext: null },
  { reviewContext: {} },
  { reviewContext: { version: 2, knowledgeHash: "b".repeat(64) } },
  { reviewContext: { version: 1, knowledgeHash: "B".repeat(64) } },
  { reviewContext: { version: 1, knowledgeHash: "b".repeat(64), extra: true } },
  { revision: Number.MAX_SAFE_INTEGER + 1 },
  { extra: true },
  { id: "" },
])(
  "malformed approval payload refuses downgrade or injected fields: %j",
  (change) => {
    expect(approvalSchema.safeParse({ ...legacy, ...change }).success).toBe(
      false,
    );
  },
);
test("all public and standalone schema entrances share the canonical symbol without module cycles", async () => {
  const [entry, validation, annotations, standalone] = await Promise.all([
    import("./index.js"),
    import("./validation.js"),
    import("./annotations.js"),
    import("./approval-schema.js"),
  ]);
  expect(entry.approvalSchema).toBe(approvalSchema);
  expect(validation.approvalSchema).toBe(approvalSchema);
  expect(annotations.approvalReviewContextSchema).toBe(
    approvalReviewContextSchema,
  );
  expect(standalone.approvalReviewContextSchema).toBe(
    approvalReviewContextSchema,
  );
  expect(
    entry.createAnnotationSchema.safeParse({
      text: "note",
      author: "author",
      source: "user",
      isConstraint: false,
      binding: null,
    }).success,
  ).toBe(true);
});
