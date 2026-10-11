import { createHash, randomUUID } from "node:crypto";
import {
  DomainError,
  approvalSchema,
  planSchema,
  semanticPlanContent,
  validatePlan,
  type Approval,
  type CodeSnapshot,
  type DirectoryPolicy,
  type Operation,
  type Plan,
  type PlanDetail,
  type StoragePort,
} from "@codemap/core";

import {
  AnnotationReviewService,
  type ReviewedApprovedPlan,
} from "./annotation-review-service.js";

export function inputKeys(input: object, keys: string[]): void {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new DomainError("INVALID_INPUT", "Unexpected input fields.");
}
export function semanticHash(plan: Plan): string {
  return createHash("sha256").update(semanticPlanContent(plan)).digest("hex");
}
const historyId = (approval: Approval) => `approved-plan:${approval.id}`;
export class Planning {
  private readonly annotationReview: AnnotationReviewService;
  constructor(
    private readonly storage: StoragePort,
    private readonly snapshot: (projectId: string) => CodeSnapshot,
    private readonly policies: (projectId: string) => DirectoryPolicy[],
    annotationReview?: AnnotationReviewService,
  ) {
    this.annotationReview =
      annotationReview ?? new AnnotationReviewService(storage, snapshot);
  }
  raw(id: string): Plan {
    const plan = this.storage.get<Plan>("plans", id);
    if (!plan) throw new DomainError("NOT_FOUND", "Plan not found.");
    return plan;
  }
  latest(id: string): ReviewedApprovedPlan | undefined {
    const current = this.raw(id);
    const candidates = this.storage
      .list<unknown>("approvals")
      .map((value, index) => {
        const result = approvalSchema.safeParse(value);
        if (!result.success)
          throw new DomainError(
            "APPROVAL_CONTEXT_INVALID",
            "Stored approval is malformed.",
          );
        return { approval: result.data, index };
      })
      .filter(({ approval }) => approval.planId === id)
      .sort(
        (a, b) =>
          b.approval.revision - a.approval.revision ||
          Date.parse(b.approval.approvedAt) -
            Date.parse(a.approval.approvedAt) ||
          b.index - a.index,
      );
    const approval = candidates[0]?.approval;
    if (!approval) return undefined;
    const plan = this.storage.get<Plan>("settings", historyId(approval));
    if (
      !plan ||
      plan.projectId !== current.projectId ||
      this.storage.get("approvals", approval.id) === undefined
    )
      throw new DomainError(
        "APPROVAL_CONTEXT_INVALID",
        "Approved plan history is invalid or unavailable.",
      );
    return this.annotationReview.read(approval, plan);
  }
  /** Historical verification can explicitly report legacy; execution must use getCurrentApproval. */
  approvedForVerification(id: string): ReviewedApprovedPlan {
    const historical = this.latest(id);
    if (!historical)
      throw new DomainError("NOT_APPROVED", "Plan has no recorded approval.");
    return historical;
  }
  getCurrentApproval(id: string): PlanDetail {
    return this.storage.transaction(() => {
      const detail = this.get(id);
      if (
        detail.issues.some((issue) => issue.code === "APPROVAL_CONTEXT_INVALID")
      )
        throw new DomainError(
          "APPROVAL_CONTEXT_INVALID",
          "Approval review context is invalid or unavailable.",
        );
      const historical = this.latest(id);
      if (historical?.contextStatus === "legacy")
        throw new DomainError(
          "APPROVAL_CONTEXT_INVALID",
          "Legacy approval has no recorded annotation review context.",
        );
      if (!detail.valid)
        throw new DomainError(
          "NOT_APPROVED",
          "Plan no longer has a valid current approval.",
        );
      return detail;
    });
  }
  get(id: string): PlanDetail {
    const plan = this.raw(id),
      snapshot = this.snapshot(plan.projectId);
    const issues = validatePlan(plan, snapshot, this.policies(plan.projectId));
    const stale =
      plan.baselineSnapshotId !== snapshot.id ||
      plan.baselineContentHash !== snapshot.contentHash;
    let historical: ReviewedApprovedPlan | undefined;
    let matches = false;
    try {
      historical = this.latest(id);
      const approval = historical?.approval;
      if (historical?.contextStatus === "legacy")
        issues.push({
          severity: "warning",
          code: "APPROVAL_CONTEXT_UNRECORDED",
          message: "Legacy approval has no recorded annotation review context.",
        });
      matches =
        !stale &&
        historical?.contextStatus === "v1" &&
        !!approval &&
        approval.revision === plan.revision &&
        approval.semanticHash === semanticHash(plan) &&
        this.annotationReview.matchesCurrent(approval, plan);
    } catch (error) {
      if (
        !(error instanceof DomainError) ||
        error.code !== "APPROVAL_CONTEXT_INVALID"
      )
        throw error;
      issues.push({
        severity: "error",
        code: error.code,
        message: error.message,
      });
    }
    const valid = matches && !issues.some((i) => i.severity === "error");
    return {
      plan: { ...plan, status: stale ? "stale" : valid ? "approved" : "draft" },
      ...(historical ? { approval: historical.approval } : {}),
      valid,
      issues,
    };
  }
  list(projectId: string): PlanDetail[] {
    this.snapshot(projectId);
    return this.storage
      .list<Plan>("plans")
      .filter((p) => p.projectId === projectId)
      .map((p) => this.get(p.id));
  }
  create(input: {
    projectId: string;
    title: string;
    description?: string;
    baselineSnapshotId?: string;
  }): PlanDetail {
    inputKeys(input, [
      "projectId",
      "title",
      "description",
      "baselineSnapshotId",
    ]);
    const snapshot = this.snapshot(input.projectId);
    if (
      input.baselineSnapshotId !== undefined &&
      input.baselineSnapshotId !== snapshot.id
    )
      throw new DomainError(
        "BASELINE_CONFLICT",
        "Plan baseline is no longer current.",
      );
    const now = new Date().toISOString();
    const plan = this.parse({
      id: randomUUID(),
      projectId: input.projectId,
      title: input.title,
      description: input.description === undefined ? "" : input.description,
      baselineSnapshotId: snapshot.id,
      baselineContentHash: snapshot.contentHash,
      revision: 1,
      operations: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    this.storage.put("plans", plan.id, plan);
    return this.get(plan.id);
  }
  update(
    id: string,
    input: {
      expectedRevision: number;
      expectedSnapshotId?: string;
      operations: Operation[];
      title?: string;
      description?: string;
    },
  ): PlanDetail {
    inputKeys(input, [
      "expectedRevision",
      "expectedSnapshotId",
      "operations",
      "title",
      "description",
    ]);
    return this.storage.transaction(() => {
      const current = this.raw(id);
      this.checkRevision(current, input.expectedRevision);
      if (input.expectedSnapshotId !== undefined) {
        if (
          typeof input.expectedSnapshotId !== "string" ||
          !input.expectedSnapshotId.trim()
        )
          throw new DomainError(
            "INVALID_INPUT",
            "Expected a nonempty snapshot id.",
          );
        // Reads current projects/snapshots in the same storage transaction used
        // by WorkspaceService.storeSnapshot publication; no await/preflight gap.
        const snapshot = this.snapshot(current.projectId);
        if (snapshot.id !== input.expectedSnapshotId)
          throw new DomainError(
            "SNAPSHOT_CHANGED",
            "Project snapshot has changed.",
          );
        if (
          current.baselineSnapshotId !== snapshot.id ||
          current.baselineContentHash !== snapshot.contentHash
        )
          throw new DomainError(
            "BASELINE_CONFLICT",
            "Plan baseline is no longer current.",
          );
      }
      const plan = this.parse({
        ...current,
        title: input.title === undefined ? current.title : input.title,
        description:
          input.description === undefined
            ? current.description
            : input.description,
        operations: input.operations,
        revision: current.revision + 1,
        status: "draft",
        updatedAt: new Date().toISOString(),
      });
      this.storage.put("plans", id, plan);
      return this.get(id);
    });
  }
  // The caller refreshes before entering this synchronous transaction and reads
  // the plan again here, so edits made during that await cannot be approved.
  approve(id: string, expectedRevision: number): PlanDetail {
    return this.storage.transaction(() => {
      const plan = this.raw(id);
      this.checkRevision(plan, expectedRevision);
      const detail = this.get(id);
      if (detail.plan.status === "stale")
        throw new DomainError(
          "BASELINE_CONFLICT",
          "Plan baseline is no longer current.",
        );
      if (detail.issues.some((i) => i.severity === "error"))
        throw new DomainError(
          "VALIDATION_FAILED",
          "Plan validation failed; inspect the plan issues.",
        );
      const captured = this.annotationReview.capture(plan);
      const approval: Approval = {
        id: randomUUID(),
        planId: id,
        revision: plan.revision,
        semanticHash: semanticHash(plan),
        baselineSnapshotId: plan.baselineSnapshotId,
        baselineContentHash: plan.baselineContentHash,
        approvedAt: new Date().toISOString(),
        actor: "user",
        reviewContext: captured.reviewContext,
      };
      const approved: Plan = { ...plan, status: "approved" };
      if (
        this.storage.get("approvals", approval.id) !== undefined ||
        this.storage.get("settings", historyId(approval)) !== undefined ||
        this.storage.get("settings", `approved-annotations:${approval.id}`) !==
          undefined
      )
        throw new DomainError(
          "APPROVAL_CONTEXT_INVALID",
          "Approval history already exists.",
        );
      this.storage.put("settings", historyId(approval), approved);
      this.annotationReview.save(approval, approved, captured.context);
      this.storage.put("approvals", approval.id, approval);
      this.storage.put("plans", id, approved);
      return this.get(id);
    });
  }
  export(id: string, format: "json" | "markdown"): string {
    const detail = this.get(id),
      historical = this.latest(id);
    const exported = {
      ...detail,
      ...(historical
        ? {
            approvedPlan: historical.plan,
            contextStatus: historical.contextStatus,
            ...(historical.annotationContext
              ? { annotationContext: historical.annotationContext }
              : {}),
          }
        : {}),
    };
    if (format === "json") return JSON.stringify(exported, null, 2);
    if (format !== "markdown")
      throw new DomainError("INVALID_INPUT", "Unknown export format.");
    return `# ${detail.plan.title}\n\nCurrent revision: ${detail.plan.revision}\n\nCurrent valid: ${detail.valid}\n\nApproved revision: ${historical?.approval.revision ?? "none"}\n\nSemantic SHA-256: ${historical?.approval.semanticHash ?? "none"}\n\nAnnotation review: ${historical?.contextStatus ?? "none"}${historical?.contextStatus === "legacy" ? " (unrecorded)" : ""}\n\nKnowledge SHA-256: ${historical?.approval.reviewContext?.knowledgeHash ?? "unrecorded"}\n\n${detail.plan.description}\n\n\`\`\`json\n${JSON.stringify(exported, null, 2)}\n\`\`\`\n`;
  }
  private checkRevision(plan: Plan, revision: number): void {
    if (!Number.isInteger(revision) || revision !== plan.revision)
      throw new DomainError("REVISION_CONFLICT", "Plan revision has changed.");
  }
  private parse(value: unknown): Plan {
    const result = planSchema.safeParse(value);
    if (!result.success)
      throw new DomainError("INVALID_INPUT", result.error.message);
    return result.data;
  }
}
