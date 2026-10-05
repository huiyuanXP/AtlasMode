import { PlanSchema } from './models.js';
import type { PlanInput, PlanRevision, PlanValidation } from './models.js';
export class PlanningRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function assertExpectedRevision(
  plan: PlanRevision,
  expectedRevision: number,
): void {
  if (plan.revision !== expectedRevision)
    throw new PlanningRuleError(
      'REVISION_CONFLICT',
      'expectedRevision mismatch',
    );
}
export function revisePlan(
  previous: PlanRevision,
  input: PlanInput,
  baselineDigest: string,
  semanticHash: string,
  validation: PlanValidation,
  expectedRevision: number,
): PlanRevision {
  assertExpectedRevision(previous, expectedRevision);
  if (previous.status === 'cancelled')
    throw new PlanningRuleError(
      'PLAN_CANCELLED',
      'Create a new plan instead of editing a cancelled plan',
    );
  return PlanSchema.parse({
    ...input,
    id: previous.id,
    revision: previous.revision + 1,
    baselineDigest,
    semanticHash,
    status: 'draft',
    validation,
    approval: null,
  });
}
export function validationRevision(
  plan: PlanRevision,
  validation: PlanValidation,
  currentBaselineDigest: string,
  currentSemanticHash: string,
): PlanRevision {
  if (
    ['cancelled', 'completed', 'implementing', 'verifying'].includes(
      plan.status,
    )
  )
    throw new PlanningRuleError(
      'INVALID_PLAN_STATE',
      'Create a new revision before validating an archived or executing plan',
    );
  return {
    ...plan,
    validation,
    status:
      currentBaselineDigest !== plan.baselineDigest
        ? 'stale'
        : currentSemanticHash !== plan.semanticHash || validation.errors.length
          ? 'needs_revision'
          : plan.approval
            ? 'approved'
            : 'validated',
  };
}
export function approveRevision(
  plan: PlanRevision,
  validation: PlanValidation,
  currentBaselineDigest: string,
  currentSemanticHash: string,
  approvedAt: string,
): PlanRevision {
  if (
    ['cancelled', 'completed', 'implementing', 'verifying'].includes(
      plan.status,
    )
  )
    throw new PlanningRuleError(
      'INVALID_PLAN_STATE',
      'Only a current editable validated plan may be approved',
    );
  if (validation.errors.length)
    throw new PlanningRuleError('INVALID_PLAN', validation.errors.join('; '));
  if (currentSemanticHash !== plan.semanticHash)
    throw new PlanningRuleError(
      'CONSTRAINTS_CHANGED',
      'Directory constraints changed; create a new revision',
    );
  if (currentBaselineDigest !== plan.baselineDigest)
    throw new PlanningRuleError(
      'STALE_BASELINE',
      'Refresh the index and revise the plan before approval',
    );
  return {
    ...plan,
    validation,
    status: 'approved',
    approval: {
      planId: plan.id,
      revision: plan.revision,
      semanticHash: plan.semanticHash,
      baselineSnapshotId: plan.baselineSnapshotId,
      baselineDigest: plan.baselineDigest,
      actor: 'local-user',
      approvedAt,
    },
  };
}
export function approvalValidity(
  plan: PlanRevision,
  currentBaselineDigest: string,
  currentSemanticHash: string,
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (
    !plan.approval ||
    plan.approval.revision !== plan.revision ||
    plan.approval.semanticHash !== plan.semanticHash ||
    plan.approval.baselineSnapshotId !== plan.baselineSnapshotId ||
    plan.approval.baselineDigest !== plan.baselineDigest
  )
    reasons.push('No matching human approval for this revision/hash/baseline');
  if (!['approved', 'implementing'].includes(plan.status))
    reasons.push(`Plan state ${plan.status} is not executable`);
  if (currentSemanticHash !== plan.semanticHash)
    reasons.push('Directory constraints changed after this revision');
  if (currentBaselineDigest !== plan.baselineDigest)
    reasons.push('Working tree differs from approved baseline');
  return { valid: reasons.length === 0, reasons };
}
export function beginRevision(
  plan: PlanRevision,
  validity: { valid: boolean; reasons: string[] },
): PlanRevision {
  if (!validity.valid)
    throw new PlanningRuleError(
      'APPROVAL_INVALID',
      validity.reasons.join('; '),
    );
  return { ...plan, status: 'implementing' };
}
export function cancelRevision(plan: PlanRevision): PlanRevision {
  return {
    ...plan,
    revision: plan.revision + 1,
    status: 'cancelled',
    approval: null,
  };
}
