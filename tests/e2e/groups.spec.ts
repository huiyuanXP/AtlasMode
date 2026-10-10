import { test, expect } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
test("circle groups edit cross-directory shared functions and persist across owned-server restart without changing source", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-grp01-"));
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "example");
    await mkdir(join(target, "one"), { recursive: true });
    await mkdir(join(target, "two"));
    const paths = ["one/a.ts", "two/b.ts"],
      sources = [
        "export function alpha(){return 1;}\n",
        "export function beta(){return 2;}\n",
      ];
    for (let i = 0; i < paths.length; i++)
      await writeFile(join(target, paths[i]!), sources[i]!);
    const before = await Promise.all(
      paths.map((p) => readFile(join(target, p))),
    );
    const data = join(root, "data");
    server = await startProduction(data);
    const project = await http(server.url, "/api/projects", "POST", {
      path: target,
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await expect(
      page
        .locator(".react-flow__node")
        .filter({ has: page.locator(".kind-function") }),
    ).toHaveCount(2);
    const rectangle = async (names: string[]) => {
      const boxes = await Promise.all(
        names.map(async (name) => {
          const box = await page
            .locator(".react-flow__node")
            .filter({ hasText: name })
            .boundingBox();
          expect(box).not.toBeNull();
          return box!;
        }),
      );
      const x = Math.min(...boxes.map((b) => b.x)) - 8,
        y = Math.min(...boxes.map((b) => b.y)) - 8;
      const right = Math.max(...boxes.map((b) => b.x + b.width)) + 8,
        bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 8;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(right, bottom, { steps: 20 });
      await page.mouse.up();
      await expect(page.locator(".react-flow__node.selected")).toHaveCount(
        names.length,
      );
    };
    await page.getByRole("button", { name: "圈选函数", exact: true }).click();
    await rectangle(["alpha", "beta"]);
    await page.screenshot({
      path: resolve("artifacts/e2e/grp01-circle-selection.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "将圈选加入分组", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "分组标题", exact: true })
      .fill("G1");
    await page.getByRole("button", { name: "创建分组", exact: true }).click();
    await expect(
      page.locator("article.group").filter({ hasText: "G1" }),
    ).toContainText("成员: 2");
    await page.getByRole("button", { name: "圈选函数", exact: true }).click();
    await rectangle(["alpha"]);
    await page
      .getByRole("button", { name: "将圈选加入分组", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "分组标题", exact: true })
      .fill("G2");
    await page.getByRole("button", { name: "创建分组", exact: true }).click();
    await expect(page.locator("article.group")).toHaveCount(2);
    let groups = await http(server.url, `/api/projects/${project.id}/groups`);
    const g1 = groups.find((g) => g.title === "G1"),
      g2 = groups.find((g) => g.title === "G2");
    expect(g1.memberIds).toContain(g2.memberIds[0]);
    const summary = await http(
      server.url,
      `/api/projects/${project.id}/summary`,
    );
    const plan = await http(server.url, "/api/plans", "POST", {
      projectId: project.id,
      title: "group-aware plan",
      baselineSnapshotId: summary.snapshotId,
    });
    await page.reload();
    await page
      .getByRole("combobox", { name: "选择规划", exact: true })
      .selectOption(plan.plan.id);
    await page.getByRole("button", { name: "确认此规划", exact: true }).click();
    await expect(page.locator(".plan-overview")).toContainText("当前批准有效");
    await page.getByRole("button", { name: "管理分组", exact: true }).click();
    await page
      .locator("article.group")
      .filter({ hasText: "G1" })
      .getByRole("button", { name: "编辑分组", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "分组标题", exact: true })
      .fill("G1 edited");
    await page
      .getByRole("textbox", { name: "分组设计 / 说明", exact: true })
      .fill("changed semantics");
    await page
      .locator(".draft-member")
      .filter({ hasText: "beta" })
      .getByRole("button", { name: "移除成员", exact: true })
      .click();
    await page.getByRole("button", { name: "保存分组", exact: true }).click();
    await expect(page.locator(".plan-overview")).toContainText(
      "当前无有效批准",
    );
    await expect(
      page.locator("article.group").filter({ hasText: "G1 edited" }),
    ).toContainText("成员: 1");
    groups = await http(server.url, `/api/projects/${project.id}/groups`);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.id === g1.id)).toMatchObject({
      title: "G1 edited",
      description: "changed semantics",
      memberIds: g2.memberIds,
    });
    await page.reload();
    await page.getByRole("button", { name: "管理分组", exact: true }).click();
    await expect(
      page.locator("article.group").filter({ hasText: "G1 edited" }),
    ).toBeVisible();
    const port = server.port;
    await server.stop();
    server = await startProduction(data, port);
    await page.reload();
    await page.getByRole("button", { name: "管理分组", exact: true }).click();
    await expect(page.locator("article.group")).toHaveCount(2);
    await expect(
      page.locator("article.group").filter({ hasText: "G1 edited" }),
    ).toContainText("成员: 1");
    const persisted = await http(server.url, `/api/plans/${plan.plan.id}`);
    expect(persisted.valid).toBe(false);
    expect(persisted.plan.revision).toBeGreaterThan(plan.plan.revision);
    await page
      .getByRole("combobox", { name: "选择规划", exact: true })
      .selectOption(plan.plan.id);
    await expect(page.locator(".plan-overview")).toContainText(
      "当前无有效批准",
    );
    for (let i = 0; i < paths.length; i++)
      expect(await readFile(join(target, paths[i]!))).toEqual(before[i]);
    expect((await readdir(target)).sort()).toEqual(["one", "two"]);
    await page.screenshot({
      path: resolve("artifacts/e2e/grp01-circle-edit.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
