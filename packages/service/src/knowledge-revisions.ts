import { DomainError, type Plan, type StoragePort } from "@codemap/core";

/** Caller owns the synchronous transaction shared with its knowledge writes. */
export function invalidateProjectPlans(
  storage: StoragePort,
  projectId: string,
  now: string,
): void {
  for (const plan of storage.list<Plan>("plans")) {
    if (plan.projectId !== projectId) continue;
    if (
      !Number.isSafeInteger(plan.revision) ||
      plan.revision < 1 ||
      plan.revision === Number.MAX_SAFE_INTEGER
    )
      throw new DomainError(
        "REVISION_CONFLICT",
        "Plan revision cannot be advanced safely.",
      );
    storage.put("plans", plan.id, {
      ...plan,
      revision: plan.revision + 1,
      status: "draft",
      updatedAt: now,
    });
  }
}
