import type { Plan } from "@codemap/core";
export type PlanContent = Pick<Plan, "title" | "description" | "operations">;
export type PlanHistory = {
  key: string;
  revision: number;
  current: PlanContent;
  past: PlanContent[];
  future: PlanContent[];
};
export type HistoryAction = "edit" | "undo" | "redo";
export const historyKey = (plan: Plan) =>
  JSON.stringify([plan.projectId, plan.id]);
const content = (plan: Plan): PlanContent =>
  structuredClone({
    title: plan.title,
    description: plan.description,
    operations: plan.operations,
  });
const matches = (history: PlanHistory, plan: Plan) =>
  history.key === historyKey(plan) &&
  history.revision === plan.revision &&
  JSON.stringify(history.current) === JSON.stringify(content(plan));
export function observeHistory(
  history: PlanHistory | undefined,
  plan: Plan,
): PlanHistory {
  return history && matches(history, plan)
    ? history
    : {
        key: historyKey(plan),
        revision: plan.revision,
        current: content(plan),
        past: [],
        future: [],
      };
}
export function historyTarget(
  history: PlanHistory | undefined,
  plan: Plan,
  direction: "undo" | "redo",
): PlanContent | undefined {
  if (!history || !matches(history, plan)) return;
  return structuredClone(
    direction === "undo" ? history.past.at(-1) : history.future.at(-1),
  );
}
/** Call only after a successful server write; failed writes leave history intact. */
export function commitHistory(
  history: PlanHistory | undefined,
  before: Plan,
  after: Plan,
  action: HistoryAction,
): PlanHistory {
  const h = observeHistory(history, before);
  return {
    key: historyKey(after),
    revision: after.revision,
    current: content(after),
    past:
      action === "undo"
        ? h.past.slice(0, -1)
        : [...h.past, content(before)].slice(-50),
    future:
      action === "undo"
        ? [...h.future, content(before)].slice(-50)
        : action === "redo"
          ? h.future.slice(0, -1)
          : [],
  };
}
