import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startProduction, connectMcp, http } from "../support/production.mjs";
import {
  createTsconfigFixture,
  seedLegacySnapshot,
} from "../support/tsconfig.mjs";

for (const legacy of [false, true]) {
  test(`production browser displays ${legacy ? "unrecorded legacy" : "captured"} configuration coverage truthfully in Chinese and English`, async ({
    page,
    context,
  }, testInfo) => {
    const root = await mkdtemp(join(tmpdir(), "atlas-config-ui-"));
    const data = join(root, "data");
    const out = resolve("artifacts/e2e/tsconfig");
    await mkdir(out, { recursive: true });
    const errors: string[] = [],
      external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await context.route("**/*", (route) => {
      if (
        !["127.0.0.1", "localhost", "[::1]"].includes(
          new URL(route.request().url()).hostname,
        )
      ) {
        external.push(route.request().url());
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    let server, mcp;
    try {
      const f = await createTsconfigFixture(root);
      server = await startProduction(data);
      const api = (path: string) => http(server.url, path);
      const project = await http(server.url, "/api/projects", "POST", {
        path: f.ts,
      });
      const base = `/api/projects/${project.id}`;
      const snapshot = await api(`${base}/snapshot`);
      if (legacy) {
        await server.stop();
        seedLegacySnapshot(data, snapshot);
        server = await startProduction(data);
      }
      mcp = await connectMcp(server.url);
      const protocolErrors: unknown[] = [];
      mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
      await page.goto(server.url);
      await page
        .getByRole("combobox", { name: "切换项目", exact: true })
        .selectOption(project.id);
      await expect(page.locator(".project-heading h1")).toHaveText(
        "typescript",
      );
      await page.getByRole("button", { name: /ƒ entry/ }).click();
      await expect(page.getByTestId("source-snippet")).toContainText(
        "return target()",
      );
      await page.getByRole("button", { name: "展开一层", exact: true }).click();
      const a = snapshot.nodes.find(
        (n: { kind: string; filePath: string }) =>
          n.kind === "function" && n.filePath === "targetA.ts",
      );
      const targetCard = page.locator(
        `.react-flow__node[data-id="fact:${a.id}"]`,
      );
      await expect(targetCard).toBeVisible();
      await targetCard.click();
      await expect(page.getByTestId("source-snippet")).toContainText(
        'return "A 原文"',
      );
      await expect(page.locator(".inspector code.path")).toHaveText(
        "targetA.ts:2",
      );
      await expect(page.getByTestId("source-snippet")).not.toHaveAttribute(
        "contenteditable",
        "true",
      );
      const diagnostics = page
        .locator(".navigation details")
        .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) });
      await diagnostics.locator("summary").click();
      const coverage = diagnostics.getByRole("region", {
        name: "配置输入",
        exact: true,
      });
      await expect(coverage).toBeVisible();
      if (legacy) {
        await expect(coverage).toContainText("此快照未记录配置输入");
        await expect(coverage).not.toContainText("配置输入: 0");
      } else {
        await expect(coverage).toContainText("配置输入: 2");
        await expect(coverage.getByRole("listitem")).toHaveText([
          "config/shared.json",
          "tsconfig.json",
        ]);
      }
      await expect(diagnostics).toContainText("已索引文件: 6");
      await coverage.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(out, `${legacy ? "legacy" : "captured"}-zh.png`),
        fullPage: true,
      });
      await page
        .getByRole("combobox", { name: "界面语言", exact: true })
        .selectOption("en");
      const english = page.getByRole("region", {
        name: "Configuration inputs",
        exact: true,
      });
      if (legacy) {
        await expect(english).toContainText(
          "Configuration inputs were not recorded for this snapshot",
        );
        await expect(english).not.toContainText("Configuration inputs: 0");
      } else {
        await expect(english).toContainText("Configuration inputs: 2");
        await expect(english.getByRole("listitem")).toHaveText([
          "config/shared.json",
          "tsconfig.json",
        ]);
      }
      await expect(page.getByTestId("source-snippet")).toContainText(
        'return "A 原文"',
      );
      await expect(page.locator(".navigation details").last()).toContainText(
        "Indexed files: 6",
      );
      await english.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(out, `${legacy ? "legacy" : "captured"}-en.png`),
        fullPage: true,
      });
      // Real function search and transport agreement on the selected source location.
      await page
        .getByRole("textbox", { name: "Search functions", exact: true })
        .fill("entry");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByRole("button", { name: /ƒ entry/ })).toHaveCount(
        2,
      );
      const summary = await api(`${base}/summary`);
      expect(
        await mcp.call("get_project_summary", { projectId: project.id }),
      ).toEqual(summary);
      expect(
        await mcp.call("get_function_context", {
          projectId: project.id,
          nodeId: a.id,
        }),
      ).toEqual(await api(`${base}/functions/${a.id}`));
      await f.assertNotExecuted();
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
      expect(protocolErrors).toEqual([]);
      expect(mcp.stderr()).toBe("");
      const evidence = {
        legacy,
        snapshotId: summary.snapshotId,
        coverage: summary.coverage,
        errors,
        external,
        protocolErrors,
        targetNotExecuted: true,
      };
      await writeFile(
        join(out, `${legacy ? "legacy" : "captured"}-evidence.json`),
        JSON.stringify(evidence, null, 2),
      );
      await testInfo.attach("configuration-evidence", {
        body: JSON.stringify(evidence),
        contentType: "application/json",
      });
    } finally {
      await mcp?.client.close();
      if (mcp) expect(mcp.transport.pid).toBeNull();
      await server?.stop();
      await rm(root, { recursive: true, force: true });
      await expect(access(root)).rejects.toThrow();
    }
  });
}
