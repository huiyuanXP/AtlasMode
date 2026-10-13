import { createHash } from "node:crypto";
import {
  DomainError,
  approvalSchema,
  approvalReviewContextSchema,
  approvedAnnotationContextSchema,
  canonicalAnnotationContext,
  semanticPlanContent,
  planSchema,
  type AnnotationReviewApproval,
  type ApprovedAnnotationContext,
  type Plan,
} from "@codemap/core";

const invalid = (): never => {
  throw new DomainError(
    "APPROVAL_CONTEXT_INVALID",
    "Approval review context is invalid or unavailable.",
  );
};

export function annotationKnowledgeHash(
  context: ApprovedAnnotationContext,
): string {
  return createHash("sha256")
    .update("atlasmode-annotation-review-v1")
    .update(Buffer.from([0]))
    .update(canonicalAnnotationContext(context))
    .digest("hex");
}

/** Shared historical guard. Callers must not skip a corrupt newest approval for an older one. */
export function validateApprovalContext(
  approval: AnnotationReviewApproval,
  approvedPlan: Plan,
  context: ApprovedAnnotationContext | undefined,
  legacyIds: ReadonlySet<string>,
): "legacy" | "v1" {
  try {
    const reviewed = approvalSchema.parse(approval),
      plan = planSchema.parse(approvedPlan);
    if (
      plan.status !== "approved" ||
      plan.id !== reviewed.planId ||
      plan.revision !== reviewed.revision ||
      plan.baselineSnapshotId !== reviewed.baselineSnapshotId ||
      plan.baselineContentHash !== reviewed.baselineContentHash ||
      createHash("sha256").update(semanticPlanContent(plan)).digest("hex") !==
        reviewed.semanticHash
    )
      invalid();
    if (!Object.hasOwn(approval, "reviewContext")) {
      if (!legacyIds.has(reviewed.id) || context !== undefined) invalid();
      return "legacy";
    }
    const reviewContext = reviewed.reviewContext;
    if (!reviewContext || context === undefined) return invalid();
    const captured = approvedAnnotationContextSchema.parse(context);
    if (
      captured.projectId !== plan.projectId ||
      captured.snapshotId !== reviewed.baselineSnapshotId ||
      annotationKnowledgeHash(captured) !== reviewContext.knowledgeHash
    )
      invalid();
    return "v1";
  } catch {
    return invalid();
  }
}

/** Compare actual current knowledge as well as plan/revision/baseline checks at the caller. */
export function matchesCurrentKnowledge(
  approval: AnnotationReviewApproval,
  currentContext: ApprovedAnnotationContext,
): boolean {
  const reviewed = approvalReviewContextSchema.safeParse(
    approval.reviewContext,
  );
  if (!reviewed.success) return false;
  try {
    return (
      reviewed.data.knowledgeHash === annotationKnowledgeHash(currentContext)
    );
  } catch {
    return false;
  }
}
