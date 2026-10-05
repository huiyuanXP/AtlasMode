import { z } from 'zod';
import { IdSchema, SourceRangeSchema } from '../graph/code-snapshot.js';
export const VerificationItemSchema = z
  .object({
    description: z.string(),
    status: z.enum(['satisfied', 'unsatisfied', 'unknown']),
    reason: z.string(),
    evidence: z.array(
      z.object({ fileId: IdSchema, range: SourceRangeSchema }).strict(),
    ),
  })
  .strict();
export const VerificationReportSchema = z
  .object({
    id: IdSchema,
    revision: z.number().int().positive(),
    planId: IdSchema,
    planRevision: z.number().int().positive(),
    snapshotId: IdSchema,
    createdAt: z.string(),
    items: z.array(VerificationItemSchema),
    bindings: z.record(IdSchema, IdSchema.nullable()).default({}),
    behaviorVerified: z.literal(false),
  })
  .strict();
export type VerificationReport = z.infer<typeof VerificationReportSchema>;
export type VerificationItem = z.infer<typeof VerificationItemSchema>;
