import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlanDetail } from "@codemap/core";
import { pendingPlans, canApprovePlan } from "./pending.js";
import { PlanOverview } from "./PlanOverview.js";
import { PendingPlans } from "./PendingPlans.js";
const draft = (id: string): PlanDetail => ({
  plan: {
    id,
    projectId: "project",
    title: id,
    description: "展示改动目的",
    revision: 2,
    operations: [
      { kind: "add_function", tempId: "new", name: "new", filePath: "new.ts" },
    ],
    status: "draft",
    baselineSnapshotId: "s",
    baselineContentHash: "h",
    createdAt: "now",
    updatedAt: "now",
  },
  valid: false,
  issues: [],
});
it("将当前有效批准排除并保留需重新确认和过期规划", () => {
  const approved = { ...draft("approved"), valid: true };
  approved.plan.status = "approved";
  const revised = draft("revised");
  revised.approval = {
    id: "a",
    planId: "revised",
    revision: 1,
    semanticHash: "old",
    baselineSnapshotId: "s",
    baselineContentHash: "h",
    approvedAt: "now",
    actor: "user",
  };
  const stale = draft("stale");
  stale.plan.status = "stale";
  expect(
    pendingPlans([approved, revised, stale]).map((d) => d.plan.id),
  ).toEqual(["revised", "stale"]);
  expect(canApprovePlan(revised)).toBe(true);
  expect(canApprovePlan(stale)).toBe(false);
  expect(
    canApprovePlan({
      ...revised,
      issues: [{ severity: "error", code: "INVALID", message: "错误" }],
    }),
  ).toBe(false);
});
it("待审入口给出每份草稿目的和查看动作，批准留在独立详情", () => {
  const html = renderToStaticMarkup(
    <PendingPlans
      plans={[draft("真实规划")]}
      locale="zh"
      busy={false}
      onChoose={() => {}}
      onChat={() => {}}
    />,
  );
  expect(html).toContain("待你审查 · 1");
  expect(html).toContain("真实规划");
  expect(html).toContain("展示改动目的");
  expect(html).toContain("查看改动");
  expect(html).not.toContain("确认此规划");
});
it("空列表提供直接进入规划 Chat 的入口", () => {
  const html = renderToStaticMarkup(
    <PendingPlans
      plans={[]}
      locale="zh"
      busy={false}
      onChoose={() => {}}
      onChat={() => {}}
    />,
  );
  expect(html).toContain("暂无待审规划");
  expect(html).toContain("通过 Chat 提出规划");
});

it("过期规划保留变更查看并禁止确认当前基线", () => {
  const detail = draft("过期规划");
  detail.plan.status = "stale";
  const html = renderToStaticMarkup(
    <PlanOverview
      plans={[detail]}
      detail={detail}
      nodes={[]}
      busy={false}
      canUndo={false}
      canRedo={false}
      onChoose={() => {}}
      onUndo={() => {}}
      onRedo={() => {}}
      onValidate={() => {}}
      onApprove={() => {}}
      onExport={() => {}}
      onVerify={() => {}}
      onOperation={() => {}}
    />,
  );
  expect(html).toMatch(/disabled=""[^>]*>确认此规划/);
  expect(html).toContain("plan-change-button");
  expect(html).toContain("基线已过期");
});
