import type { PlanDetail } from "@codemap/core";
/** 服务端 valid 绑定当前 revision、语义摘要及快照。 */
export function pendingPlans(plans: PlanDetail[]): PlanDetail[] {
  return plans.filter((detail) => !detail.valid);
}
export function canApprovePlan(detail?: PlanDetail): boolean {
  return (
    !!detail &&
    !detail.valid &&
    detail.plan.status !== "stale" &&
    !detail.issues.some((issue) => issue.severity === "error")
  );
}
