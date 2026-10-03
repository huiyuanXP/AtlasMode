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
  createForwardingFixture,
  assertProcessStopped,
} from "../support/forwarding.mjs";

// Catches source cards pointing at barrels, translated authored bytes, missing unknown reasons and broken copying.
test("production browser follows a two-hop entry to the real leaf, preserves authored source in both languages and exposes unsafe forwarding reason", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-forwarding-ui-"));
  const out = resolve("artifacts/e2e/forwarding");
  await mkdir(out, { recursive: true });
  const errors: string[] = [],
    external: string[] = [],
    protocolErrors: unknown[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await denyExternalRequests(context, external);
  let server, mcp;
  try {
    const f = await createForwardingFixture(root);
    server = await startProduction(join(root, "data"));
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: server.url,
    });
    const project = await http(server.url, "/api/projects", "POST", {
      path: f.path,
    });
    const base = `/api/projects/${project.id}`;
    const snapshot = await http(server.url, `${base}/snapshot`);
    const entry = snapshot.nodes.find(
      (n: { name: string }) => n.name === "entry",
    );
    const leaf = snapshot.nodes.find(
      (n: { name: string }) => n.name === "helper",
    );
    const unknown = snapshot.nodes.find(
      (n: { name: string }) => n.name === "unsafeCaller",
    );
    mcp = await connectMcp(server.url);
    mcp.client.onerror = (e: unknown) => protocolErrors.push(e);
    const entryContext = await http(
      server.url,
      `${base}/functions/${entry.id}`,
    );
    expect(
      await mcp.call("get_function_context", {
        projectId: project.id,
        nodeId: entry.id,
      }),
    ).toEqual(entryContext);
    expect(entryContext.outgoing[0].targetId).toBe(leaf.id);
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await page.getByRole("button", { name: /ƒ entry/ }).click();
    await expect(page.getByTestId("source-snippet")).toContainText(
      "return mod.helper()",
    );
    await page.getByRole("button", { name: "展开一层", exact: true }).click();
    const card = page.locator(`.react-flow__node[data-id="fact:${leaf.id}"]`);
    await expect(card).toBeVisible();
    await card.click();
    for (const [language, sourceLabel, copyLabel] of [
      ["zh", "只读源码", "复制文件与行号"],
      ["en", "Read-only source", "Copy file and line"],
    ]) {
      if (language === "en")
        await page
          .getByRole("combobox", { name: "界面语言", exact: true })
          .selectOption("en");
      await expect(page.locator(".inspector h2")).toHaveText("helper");
      await expect(page.locator(".inspector code.path")).toHaveText(
        "leaf-a.cjs:2",
      );
      await expect(
        page.getByRole("heading", { name: sourceLabel, exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId("source-snippet")).toHaveText(
        '2  function helper() { return "中文 leaf A"; }',
      );
      await expect(page.getByTestId("source-snippet")).not.toHaveAttribute(
        "contenteditable",
        "true",
      );
      await page.getByRole("button", { name: copyLabel, exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe("leaf-a.cjs:2");
      await page.screenshot({
        path: join(out, `leaf-${language}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: /ƒ unsafeCaller/ }).click();
    const unknownContext = await http(
      server.url,
      `${base}/functions/${unknown.id}`,
    );
    expect(
      await mcp.call("get_function_context", {
        projectId: project.id,
        nodeId: unknown.id,
      }),
    ).toEqual(unknownContext);
    expect(unknownContext.outgoing).toEqual([
      expect.objectContaining({
        targetId: null,
        resolution: "unresolved",
        reason: expect.any(String),
      }),
    ]);
    await expect(page.locator(".inspector")).toContainText(
      unknownContext.outgoing[0].reason,
    );
    await expect(page.getByTestId("source-snippet")).toContainText(
      "return unsafe.helper()",
    );
    await page.screenshot({
      path: join(out, "unknown-en.png"),
      fullPage: true,
    });
    await f.assertNotExecuted();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    expect(protocolErrors).toEqual([]);
    expect(mcp.stderr()).toBe("");
    // An actual nonloopback browser navigation must be aborted before networking.
    const probe = await context.newPage();
    const probeUrl = "https://example.invalid/atlas-offline-probe";
    let blockedReason = "";
    probe.on("requestfailed", (request) => {
      blockedReason = request.failure()?.errorText ?? "";
    });
    await expect(probe.goto(probeUrl)).rejects.toThrow();
    expect(blockedReason).toContain("ERR_BLOCKED_BY_CLIENT");
    expect(external).toEqual([probeUrl]);
    await probe.close();
    const evidence = {
      snapshotId: snapshot.id,
      entryContext,
      leaf,
      unknownContext,
      languages: ["zh", "en"],
      copiedLocation: "leaf-a.cjs:2",
      errors,
      external,
      protocolErrors,
      targetNotExecuted: true,
      offlineProbe: {
        url: probeUrl,
        blockedReason,
        unexpectedExternalRequests: 0,
      },
      observedAt: new Date().toISOString(),
    };
    await writeFile(
      join(out, "evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    await testInfo.attach("forwarding-evidence", {
      body: JSON.stringify(evidence),
      contentType: "application/json",
    });
  } finally {
    const pid = mcp?.transport.pid;
    try {
      await mcp?.client.close();
    } finally {
      try {
        await server?.stop();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
    if (pid) assertProcessStopped(pid);
    if (server) assertProcessStopped(server.child.pid);
    await expect(access(root)).rejects.toThrow();
  }
});
