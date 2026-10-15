import {
  DomainError,
  approvalSchema,
  annotationSchema,
  type Approval,
  type ApprovalReviewContext,
  type ApprovedAnnotationContext,
  type CodeSnapshot,
  type Plan,
  type Project,
  type StoragePort,
} from "@codemap/core";
import { Annotations } from "./annotations.js";
import {
  annotationKnowledgeHash,
  matchesCurrentKnowledge,
  validateApprovalContext,
} from "./annotation-review.js";

export type ReviewedApprovedPlan = {
  approval: Approval;
  plan: Plan;
  contextStatus: "legacy" | "v1";
  annotationContext?: ApprovedAnnotationContext;
};
const contextKey = (id: string) => `approved-annotations:${id}`;
function invalid(): never {
  throw new DomainError(
    "APPROVAL_CONTEXT_INVALID",
    "Approval review context is invalid or unavailable.",
  );
}

/** Synchronous storage operations participate in Planning's outer transaction. */
export class AnnotationReviewService {
  private readonly notes: Annotations;
  constructor(
    private readonly storage: StoragePort,
    private readonly snapshot: (projectId: string) => CodeSnapshot,
    notes?: Annotations,
  ) {
    this.notes =
      notes ??
      new Annotations(
        storage,
        (id) => {
          const project = storage.get<Project>("projects", id);
          if (!project)
            throw new DomainError("NOT_FOUND", "Project not found.");
          return project;
        },
        snapshot,
      );
  }
  private checkStoredNotes(): void {
    // Validate before filtering by project: corrupt ownership cannot disappear from review.
    for (const value of this.storage.list<unknown>("annotations")) {
      if (!annotationSchema.safeParse(value).success) invalid();
    }
  }
  capture(plan: Plan): {
    context: ApprovedAnnotationContext;
    reviewContext: ApprovalReviewContext;
  } {
    const snapshot = this.snapshot(plan.projectId);
    if (
      snapshot.id !== plan.baselineSnapshotId ||
      snapshot.projectId !== plan.projectId ||
      snapshot.contentHash !== plan.baselineContentHash
    )
      throw new DomainError(
        "BASELINE_CONFLICT",
        "Plan baseline is no longer current.",
      );
    this.checkStoredNotes();
    const context = this.notes.captureContext(plan.projectId, snapshot.id);
    return {
      context,
      reviewContext: {
        version: 1,
        knowledgeHash: annotationKnowledgeHash(context),
      },
    };
  }
  save(
    approval: Approval,
    plan: Plan,
    context: ApprovedAnnotationContext,
  ): void {
    if (validateApprovalContext(approval, plan, context, new Set()) !== "v1")
      invalid();
    this.notes.saveApprovalContext(approval.id, context);
  }
  read(approval: Approval, plan: Plan): ReviewedApprovedPlan {
    if (!approvalSchema.safeParse(approval).success) invalid();
    const context = this.storage.get<ApprovedAnnotationContext>(
      "settings",
      contextKey(approval.id),
    );
    // This registry is a frozen migration receipt, never inferred or backfilled from today's records.
    const legacyIds = Object.hasOwn(approval, "reviewContext")
      ? new Set<string>()
      : this.notes.legacyApprovalIds();
    const contextStatus = validateApprovalContext(
      approval,
      plan,
      context,
      legacyIds,
    );
    return {
      approval: structuredClone(approval),
      plan: structuredClone(plan),
      contextStatus,
      ...(context === undefined
        ? {}
        : { annotationContext: structuredClone(context) }),
    };
  }
  matchesCurrent(approval: Approval, plan: Plan): boolean {
    try {
      this.checkStoredNotes();
      return matchesCurrentKnowledge(
        approval,
        this.notes.captureContext(plan.projectId, plan.baselineSnapshotId),
      );
    } catch {
      return invalid();
    }
  }
}
