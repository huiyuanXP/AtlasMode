import { z } from "zod";
import type { Approval, ApprovalReviewContext } from "./model.js";

const id = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
export const approvalReviewContextSchema: z.ZodType<ApprovalReviewContext> =
  z.strictObject({
    version: z.literal(1),
    knowledgeHash: z.string().regex(/^[a-f0-9]{64}$/),
  });
const fields = {
  id,
  planId: id,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  semanticHash: z.string().regex(/^[a-f0-9]{64}$/),
  baselineSnapshotId: id,
  baselineContentHash: z.string().min(1),
  approvedAt: z.iso.datetime(),
  actor: z.literal("user"),
};
/** Legacy accepts an absent tag only; explicitly undefined is not a downgrade. */
export const legacyApprovalSchema = z.strictObject(fields);
export const v1ApprovalSchema = z.strictObject({
  ...fields,
  reviewContext: approvalReviewContextSchema,
});
export const approvalSchema: z.ZodType<Approval> = z.union([
  legacyApprovalSchema,
  v1ApprovalSchema,
]);
