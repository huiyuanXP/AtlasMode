import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";

test("待审入口打开实际变更，选择改动与显式批准分别生效", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-pending-"));
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "review-project");
    await mkdir(target);
    await writeFile(
      join(target, "entry.ts"),
      "export function existing(){ return 1; }\n",
    );
    server = await startProduction(join(root, "data"));
    const api = (path: string, method?: string, body?: unknown) =>
      http(server!.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: target });
    const summary = await api(`/api/projects/${project.id}/summary`);
    const draft = await api("/api/plans", "POST", {
      projectId: project.id,
      title: "审查请求统计",
      baselineSnapshotId: summary.snapshotId,
    });
    const detail = await api(`/api/plans/${draft.plan.id}`, "PUT", {
      expectedRevision: 1,
      description: "复用已有函数汇总请求统计",
      operations: [
        {
          kind: "add_function",
          tempId: "planned-count",
          name: "countRequests",
          filePath: "stats.ts",
          description: "记录请求次数",
        },
        {
          kind: "add_relation",
          id: "planned-call",
          sourceId: "planned-count",
          targetId: summary.entrypoints[0].id,
          type: "calls",
        },
      ],
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await page.getByRole("button", { name: "待你审查 · 1" }).click();
    await expect(page.locator(".pending-plan-list")).toContainText(
      "复用已有函数汇总请求统计",
    );
    await page.getByRole("button", { name: "查看改动", exact: true }).click();
    await expect(page.locator(".plan-overview h2")).toHaveText("审查请求统计");
    await expect(
      page.locator('.react-flow__node[data-id="plan:planned-count"]'),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await page
              .locator('.react-flow__node[data-id="plan:planned-count"]')
              .boundingBox()
          )?.width ?? 0,
      )
      .toBeGreaterThan(200);
    await page.locator(".plan-change-button").last().click();
    await expect(page.locator(".plan-change-button").last()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await api(`/api/plans/${draft.plan.id}`)).approval).toBeUndefined();
    expect((await api(`/api/plans/${draft.plan.id}`)).plan.revision).toBe(
      detail.plan.revision,
    );
    await page.getByRole("button", { name: "确认此规划", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "暂无待审规划" }),
    ).toBeVisible();
    const approved = await api(`/api/plans/${draft.plan.id}`);
    expect(approved.valid).toBe(true);
    expect(approved.approval.revision).toBe(detail.plan.revision);
    expect(approved.approval.baselineSnapshotId).toBe(summary.snapshotId);
    await api(`/api/plans/${draft.plan.id}`, "PUT", {
      expectedRevision: approved.plan.revision,
      operations: [
        ...approved.plan.operations,
        { kind: "annotate", targetId: "planned-count", text: "记录耗时" },
      ],
    });
    await page.reload();
    await page.getByRole("button", { name: "待你审查 · 1" }).click();
    await expect(page.locator(".pending-plan-list")).toContainText(
      "修改后需重新确认",
    );
    await page.getByRole("button", { name: "查看改动", exact: true }).click();
    await expect(page.locator(".plan-overview")).toContainText("规划已修改");
    expect((await api(`/api/plans/${draft.plan.id}`)).valid).toBe(false);
    await writeFile(
      join(target, "entry.ts"),
      "export function existing(){ return 2; }\n",
    );
    await api(`/api/projects/${project.id}/refresh`, "POST", {});
    await page.reload();
    await page.getByRole("button", { name: "待你审查 · 1" }).click();
    await page.getByRole("button", { name: "查看改动", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "确认此规划", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".plan-overview")).toContainText("基线已过期");
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
