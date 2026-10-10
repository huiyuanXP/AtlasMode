import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  denyExternalRequests,
} from "../support/production.mjs";

test("first use offers an offline path and preserves optional AI drafts through disclosure", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-first-use-"));
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "example");
    await mkdir(target);
    // Eight entries in different files reproduce the dense initial graph.
    for (let i = 0; i < 8; i++) {
      await mkdir(join(target, `module${i}`));
      await writeFile(
        join(target, `module${i}`, "entry.ts"),
        `export function entry${i}(){return ${i};}\n`,
      );
    }
    server = await startProduction(join(root, "data"));
    await page.goto(server.url);
    await expect(page.locator(".welcome")).not.toContainText("请先启动");
    await page
      .locator(".welcome")
      .getByRole("button", { name: "选择本地项目", exact: true })
      .click();
    await page.getByRole("textbox", { name: "本地项目路径" }).fill(target);
    await page.getByRole("button", { name: "打开并索引", exact: true }).click();
    await expect(page.locator(".project-heading h1")).toHaveText("example");
    await expect(page.locator(".chat-explore textarea")).not.toBeVisible();
    await expect(page.locator(".chat-plan textarea")).not.toBeVisible();
    await expect(page.locator(".navigation")).toContainText("先搜索函数");
    await expect
      .poll(async () => {
        const card = page.locator(".react-flow__node").first();
        return (await card.boundingBox())?.width ?? 0;
      })
      .toBeGreaterThan(170);
    await page
      .getByRole("textbox", { name: "搜索函数", exact: true })
      .fill("entry0");
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    await page.getByRole("button", { name: /ƒ entry0/ }).click();
    await page
      .locator(".inspector .tabs")
      .getByRole("button", { name: "查看源码", exact: true })
      .click();
    await expect(page.getByTestId("source-snippet")).toContainText("return 0");
    await page.getByRole("button", { name: "返回对话", exact: true }).click();
    await page.locator(".explore-disclosure > summary").click();
    const input = page.locator(".chat-explore textarea");
    await input.fill("先保留这个问题");
    await page.locator(".explore-disclosure > summary").click();
    await expect(input).not.toBeVisible();
    await page.locator(".explore-disclosure > summary").click();
    await expect(input).toHaveValue("先保留这个问题");
    await page.locator(".explore-disclosure > summary").click();
    await page
      .getByRole("button", { name: "手动创建规划", exact: true })
      .click();
    await page.getByRole("textbox", { name: "新规划标题" }).fill("离线规划");
    await page.getByRole("button", { name: "创建规划", exact: true }).click();
    await expect(page.locator(".plan-editor")).toBeVisible();
    await page.getByRole("button", { name: "返回对话", exact: true }).click();
    await expect(page.locator(".plan-overview h2")).toHaveText("离线规划");
    await page.locator(".planning-disclosure > summary").click();
    const planInput = page.locator(".chat-plan textarea");
    await planInput.fill("讨论下一步");
    await page.locator(".planning-disclosure > summary").click();
    await page.locator(".planning-disclosure > summary").click();
    await expect(planInput).toHaveValue("讨论下一步");
    await page
      .getByRole("button", { name: "查看源码", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "返回对话", exact: true }).click();
    await expect(planInput).toHaveValue("讨论下一步");
    await page.locator(".planning-disclosure > summary").click();
    const out = resolve("artifacts/e2e/first-use");
    await mkdir(out, { recursive: true });
    await page.screenshot({
      path: join(out, "light.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "切换浅色/深色" }).click();
    await page.screenshot({
      path: join(out, "dark.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.screenshot({
      path: join(out, "narrow.png"),
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
