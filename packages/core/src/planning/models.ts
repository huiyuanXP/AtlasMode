import { z } from 'zod';
import { IdSchema, SourceFilePathSchema } from '../graph/code-snapshot.js';
import { OriginSchema } from '../knowledge/models.js';
const temporaryId = z.string().startsWith('plan:').min(6).max(256);
export const PlanChangeSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('add_function'),
      id: temporaryId,
      name: z.string().min(1),
      signature: z.string().min(1),
      filePath: SourceFilePathSchema,
    })
    .strict(),
  z
    .object({
      op: z.literal('update_function'),
      functionId: IdSchema,
      name: z.string().min(1).optional(),
      signature: z.string().min(1).optional(),
      filePath: SourceFilePathSchema.optional(),
    })
    .strict(),
  z.object({ op: z.literal('delete_function'), functionId: IdSchema }).strict(),
  z
    .object({
      op: z.literal('add_call'),
      id: temporaryId,
      source: IdSchema,
      target: IdSchema,
    })
    .strict(),
  z.object({ op: z.literal('delete_relation'), relationId: IdSchema }).strict(),
]);
export const RequirementSchema = z
  .object({
    type: z.enum([
      'must_call',
      'must_reuse',
      'must_reside_in',
      'must_not_depend_on',
    ]),
    nodeId: IdSchema,
    target: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();
export const PlanInputSchema = z
  .object({
    baselineSnapshotId: IdSchema,
    title: z.string().min(1).max(500),
    reason: z.string().min(1).max(20000),
    source: OriginSchema,
    changes: z.array(PlanChangeSchema).min(1).max(1000),
    requirements: z.array(RequirementSchema).max(1000),
  })
  .strict();
export const ValidationSchema = z
  .object({
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    unknown: z.array(z.string()),
  })
  .strict();
export const ApprovalSchema = z
  .object({
    planId: IdSchema,
    revision: z.number().int().positive(),
    semanticHash: z.string(),
    baselineSnapshotId: IdSchema,
    baselineDigest: z.string(),
    actor: z.literal('local-user'),
    approvedAt: z.string(),
  })
  .strict();
export const PlanSchema = PlanInputSchema.extend({
  id: IdSchema,
  revision: z.number().int().positive(),
  baselineDigest: z.string(),
  semanticHash: z.string(),
  status: z.enum([
    'draft',
    'validated',
    'approved',
    'implementing',
    'verifying',
    'completed',
    'stale',
    'needs_revision',
    'cancelled',
  ]),
  validation: ValidationSchema,
  approval: ApprovalSchema.nullable(),
});
export type PlanChange = z.infer<typeof PlanChangeSchema>;
export type PlanInput = z.infer<typeof PlanInputSchema>;
export type PlanRevision = z.infer<typeof PlanSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type PlanValidation = z.infer<typeof ValidationSchema>;
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonicalJson(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function planSemanticContent(
  plan: PlanInput,
  baselineDigest: string,
): string {
  return canonicalJson({
    baselineSnapshotId: plan.baselineSnapshotId,
    baselineDigest,
    title: plan.title,
    reason: plan.reason,
    source: plan.source,
    changes: plan.changes,
    requirements: plan.requirements,
  });
}
