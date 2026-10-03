import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  connectMcp,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
import {
  createCommonjsFixture,
  seedLegacyPackageSnapshot,
} from "../support/commonjs.mjs";

for (const legacy of [false, true]) {
  test(`production browser displays ${legacy ? "unrecorded legacy" : "captured"} package coverage truthfully in Chinese and English`, async ({
    page,
    context,
  }, testInfo) => {
    const root = await mkdtemp(join(tmpdir(), "atlas-commonjs-ui-"));
    const data = join(root, "data");
    const out = resolve("artifacts/e2e/commonjs");
    await mkdir(out, { recursive: true });
    const errors: string[] = [],
      external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await denyExternalRequests(context, external);
    let server, mcp;
    try {
      const f = await createCommonjsFixture(root);
      server = await startProduction(data);
      const api = (path: string) => http(server.url, path);
      const project = await http(server.url, "/api/projects", "POST", {
        path: f.path,
      });
      const base = `/api/projects/${project.id}`;
      const snapshot = await api(`${base}/snapshot`);
      if (legacy) {
        await server.stop();
        seedLegacyPackageSnapshot(data, snapshot);
        server = await startProduction(data);
      }
      mcp = await connectMcp(server.url);
      const protocolErrors: unknown[] = [];
      mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
      await page.goto(server.url);
      await page
        .getByRole("combobox", { name: "切换项目", exact: true })
        .selectOption(project.id);
      await expect(page.locator(".project-heading h1")).toHaveText("commonjs");
      await page.getByRole("button", { name: /ƒ entry/ }).click();
      await expect(page.getByTestId("source-snippet")).toContainText(
        "return mod.helper()",
      );
      await page.getByRole("button", { name: "展开一层", exact: true }).click();
      const a = snapshot.nodes.find(
        (n: { kind: string; filePath: string }) =>
          n.kind === "function" && n.filePath === "helper.js",
      );
      const targetCard = page.locator(
        `.react-flow__node[data-id="fact:${a.id}"]`,
      );
      await expect(targetCard).toBeVisible();
      await targetCard.click();
      await expect(page.getByTestId("source-snippet")).toContainText(
        'return "中文 helper"',
      );
      await expect(page.locator(".inspector code.path")).toHaveText(
        "helper.js:2",
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
        name: "包配置",
        exact: true,
      });
      await expect(coverage).toBeVisible();
      if (legacy) {
        await expect(coverage).toContainText("此快照未记录包配置");
        await expect(coverage).not.toContainText("包配置: 0");
      } else {
        await expect(coverage).toContainText("包配置: 1");
        await expect(coverage.getByRole("listitem")).toHaveText([
          "package.json",
        ]);
      }
      await expect(diagnostics).toContainText("已索引文件: 5");
      await coverage.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(out, `${legacy ? "legacy" : "captured"}-zh.png`),
        fullPage: true,
      });
      await page
        .getByRole("combobox", { name: "界面语言", exact: true })
        .selectOption("en");
      const english = page.getByRole("region", {
        name: "Package manifests",
        exact: true,
      });
      if (legacy) {
        await expect(english).toContainText(
          "Package manifests were not recorded for this snapshot",
        );
        await expect(english).not.toContainText("Package manifests: 0");
      } else {
        await expect(english).toContainText("Package manifests: 1");
        await expect(english.getByRole("listitem")).toHaveText([
          "package.json",
        ]);
      }
      await expect(page.getByTestId("source-snippet")).toContainText(
        'return "中文 helper"',
      );
      await expect(page.locator(".navigation details").last()).toContainText(
        "Indexed files: 5",
      );
      await english.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(out, `${legacy ? "legacy" : "captured"}-en.png`),
        fullPage: true,
      });
      // Unknowns must expose their authored call evidence and conservative reason.
      await page.getByRole("button", { name: /ƒ overwritten/ }).click();
      await expect(page.getByTestId("source-snippet")).toContainText(
        "return mod.helper()",
      );
      const unknown = snapshot.nodes.find(
        (n: { name: string }) => n.name === "overwritten",
      );
      const unknownContext = await api(`${base}/functions/${unknown.id}`);
      const reason = unknownContext.outgoing.find(
        (r: { resolution: string }) => r.resolution === "unresolved",
      ).reason;
      await expect(page.locator(".inspector")).toContainText(reason);
      await page.screenshot({
        path: join(out, `${legacy ? "legacy" : "captured"}-unknown-en.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: /ƒ shadowed/ }).click();
      const shadowed = snapshot.nodes.find(
        (n: { name: string }) => n.name === "shadowed",
      );
      const shadowContext = await api(`${base}/functions/${shadowed.id}`);
      for (const relation of shadowContext.outgoing) {
        expect(relation.resolution).toBe("unresolved");
        await expect(page.locator(".inspector")).toContainText(relation.reason);
      }
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
        unknownContext,
        shadowContext,
        observedAt: new Date().toISOString(),
        targetNotExecuted: true,
      };
      await writeFile(
        join(out, `${legacy ? "legacy" : "captured"}-evidence.json`),
        JSON.stringify(evidence, null, 2),
      );
      await testInfo.attach("package-evidence", {
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

test("recorded zero manifests is distinct from unrecorded coverage", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-package-zero-"));
  const errors: string[] = [],
    external: string[] = [];
  let server;
  try {
    const target = join(root, "empty-package-scope");
    await mkdir(target);
    await writeFile(
      join(target, "entry.cjs"),
      "exports.entry = function entry() {};\n",
    );
    server = await startProduction(join(root, "data"));
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await denyExternalRequests(context, external);
    const project = await http(server.url, "/api/projects", "POST", {
      path: target,
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await page
      .locator(".navigation details")
      .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) })
      .locator("summary")
      .click();
    await expect(
      page.getByRole("region", { name: "包配置", exact: true }),
    ).toHaveText("包配置: 0");
    await page
      .getByRole("combobox", { name: "界面语言", exact: true })
      .selectOption("en");
    await expect(
      page.getByRole("region", { name: "Package manifests", exact: true }),
    ).toHaveText("Package manifests: 0");
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
    await expect(access(root)).rejects.toThrow();
  }
});
