import { createHash, randomUUID } from "node:crypto";
import {
  DomainError,
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
  constructor(
    private readonly storage: StoragePort,
    private readonly snapshot: (projectId: string) => CodeSnapshot,
    private readonly policies: (projectId: string) => DirectoryPolicy[],
  ) {}
  raw(id: string): Plan {
    const plan = this.storage.get<Plan>("plans", id);
    if (!plan) throw new DomainError("NOT_FOUND", "Plan not found.");
    return plan;
  }
  latest(id: string): { approval: Approval; plan: Plan } | undefined {
    const approvals = this.storage
      .list<Approval>("approvals")
      .filter((a) => a.planId === id)
      .sort(
        (a, b) =>
          b.revision - a.revision || b.approvedAt.localeCompare(a.approvedAt),
      );
    for (const approval of approvals) {
      const plan = this.storage.get<Plan>("settings", historyId(approval));
      if (
        plan &&
        plan.id === id &&
        plan.revision === approval.revision &&
        semanticHash(plan) === approval.semanticHash &&
        plan.baselineSnapshotId === approval.baselineSnapshotId &&
        plan.baselineContentHash === approval.baselineContentHash
      )
        return { approval, plan };
    }
    return undefined;
  }
  get(id: string): PlanDetail {
    const plan = this.raw(id),
      snapshot = this.snapshot(plan.projectId);
    const issues = validatePlan(plan, snapshot, this.policies(plan.projectId));
    const historical = this.latest(id);
    const approval = historical?.approval;
    const stale =
      plan.baselineSnapshotId !== snapshot.id ||
      plan.baselineContentHash !== snapshot.contentHash;
    const matches =
      !!approval &&
      approval.revision === plan.revision &&
      approval.semanticHash === semanticHash(plan);
    const valid = matches && !issues.some((i) => i.severity === "error");
    return {
      plan: {
        ...plan,
        status: stale ? "stale" : matches ? "approved" : "draft",
      },
      ...(approval ? { approval } : {}),
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
      operations: Operation[];
      title?: string;
      description?: string;
    },
  ): PlanDetail {
    inputKeys(input, [
      "expectedRevision",
      "operations",
      "title",
      "description",
    ]);
    return this.storage.transaction(() => {
      const current = this.raw(id);
      this.checkRevision(current, input.expectedRevision);
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
      const approval: Approval = {
        id: randomUUID(),
        planId: id,
        revision: plan.revision,
        semanticHash: semanticHash(plan),
        baselineSnapshotId: plan.baselineSnapshotId,
        baselineContentHash: plan.baselineContentHash,
        approvedAt: new Date().toISOString(),
        actor: "user",
      };
      const approved: Plan = { ...plan, status: "approved" };
      this.storage.put("settings", historyId(approval), approved);
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
      ...(historical ? { approvedPlan: historical.plan } : {}),
    };
    if (format === "json") return JSON.stringify(exported, null, 2);
    if (format !== "markdown")
      throw new DomainError("INVALID_INPUT", "Unknown export format.");
    return `# ${detail.plan.title}\n\nCurrent revision: ${detail.plan.revision}\n\nCurrent valid: ${detail.valid}\n\nApproved revision: ${historical?.approval.revision ?? "none"}\n\nSemantic SHA-256: ${historical?.approval.semanticHash ?? "none"}\n\n${detail.plan.description}\n\n\`\`\`json\n${JSON.stringify(exported, null, 2)}\n\`\`\`\n`;
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
