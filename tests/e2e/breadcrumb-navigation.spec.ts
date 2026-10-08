import { test, expect, type Page } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
async function inside(page: Page, ids: string[]) {
  await expect
    .poll(async () => {
      const canvas = await page.locator(".canvas-shell").boundingBox();
      if (!canvas) return false;
      for (const id of ids) {
        const box = await page
          .locator(`.react-flow__node[data-id="${id}"]`)
          .boundingBox();
        if (
          !box ||
          box.x < canvas.x ||
          box.y < canvas.y ||
          box.x + box.width > canvas.x + canvas.width ||
          box.y + box.height > canvas.y + canvas.height
        )
          return false;
      }
      return true;
    })
    .toBe(true);
}
test("breadcrumbs navigate function, indexed file, folders, root and truthful planned paths, superseding stale scope responses", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-breadcrumb-ui-"));
  const out = resolve("artifacts/e2e/breadcrumb-navigation");
  await mkdir(out, { recursive: true });
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "breadcrumbs-project");
    await mkdir(join(target, "src/nested"), { recursive: true });
    await mkdir(join(target, "other"));
    await writeFile(
      join(target, "src/nested/index.ts"),
      "export function run() { return 1; }\n",
    );
    await writeFile(
      join(target, "other/index.ts"),
      "export function other() { return 2; }\n",
    );
    server = await startProduction(join(root, "data"));
    const api = (path: string, method?: string, body?: unknown) =>
      http(server!.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: target });
    const summary = await api(`/api/projects/${project.id}/summary`);
    const snapshot = await api(`/api/projects/${project.id}/snapshot`);
    const node = (kind: string, path?: string) =>
      snapshot.nodes.find(
        (n: { kind: string; filePath?: string }) =>
          n.kind === kind && n.filePath === path,
      );
    const fn = summary.entrypoints.find(
      (n: { name: string }) => n.name === "run",
    );
    await api(`/api/projects/${project.id}/view`, "PUT", {
      positions: {},
      locale: "en",
      theme: "light",
    });
    const created = await api("/api/plans", "POST", {
      projectId: project.id,
      baselineSnapshotId: summary.snapshotId,
      title: "Planned navigation",
    });
    await api(`/api/plans/${created.plan.id}`, "PUT", {
      expectedRevision: created.plan.revision,
      operations: [
        {
          kind: "add_function",
          tempId: "planned-fn",
          name: "futureWork",
          filePath: "future/new.ts",
        },
      ],
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await expect(page.locator(".project-heading h1")).toHaveText(
      "breadcrumbs-project",
    );
    const crumbs = page.getByRole("navigation", {
      name: "Location",
      exact: true,
    });
    const card = (id: string) =>
      page.locator(`.react-flow__node[data-id="fact:${id}"]`);
    await card(fn.id).click();
    await expect(crumbs).toContainText("breadcrumbs-project");
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "src",
      "nested",
      "index.ts",
      "run",
    ]);
    await crumbs.getByRole("button", { name: "run", exact: true }).click();
    await inside(page, [`fact:${fn.id}`]);
    await crumbs.getByRole("button", { name: "index.ts", exact: true }).click();
    await expect(page.locator('[data-funnel-lane="selected"]')).toContainText(
      "index.ts",
    );
    await expect(page.locator(".inspector-content .path")).toContainText(
      "src/nested/index.ts",
    );
    await inside(page, [`fact:${node("file", "src/nested/index.ts").id}`]);
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "src",
      "nested",
      "index.ts",
    ]);
    await crumbs.getByRole("button", { name: "nested", exact: true }).click();
    await expect(page.locator(".funnel-summary")).toHaveCount(0);
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "src",
      "nested",
    ]);
    await inside(
      page,
      [
        node("folder", "src/nested").id,
        node("file", "src/nested/index.ts").id,
      ].map((id) => `fact:${id}`),
    );
    await crumbs.getByRole("button", { name: "src", exact: true }).click();
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "src",
    ]);
    await inside(
      page,
      [node("folder", "src").id, node("folder", "src/nested").id].map(
        (id) => `fact:${id}`,
      ),
    );
    await crumbs
      .getByRole("button", { name: "breadcrumbs-project", exact: true })
      .click();
    await expect(crumbs.locator("button")).toHaveText(["breadcrumbs-project"]);
    await inside(
      page,
      [
        node("folder").id,
        node("folder", "src").id,
        node("folder", "other").id,
      ].map((id) => `fact:${id}`),
    );
    // Drill into the distinct same-name file through actual directory cards.
    await card(node("folder", "other").id).click();
    await card(node("file", "other/index.ts").id).click();
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "other",
      "index.ts",
    ]);
    await expect(page.locator(".inspector-content .path")).toContainText(
      "other/index.ts",
    );
    await page
      .getByRole("button", { name: "Plan editor", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .selectOption(created.plan.id);
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "future",
      "new.ts",
      "futureWork",
    ]);
    await inside(page, ["plan:planned-fn"]);
    await crumbs.getByRole("button", { name: "new.ts", exact: true }).click();
    await expect(crumbs).toContainText("Planned context");
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "future",
      "new.ts",
    ]);
    await inside(page, ["plan:planned-fn"]);
    await crumbs.getByRole("button", { name: "future", exact: true }).click();
    await expect(crumbs.locator("button")).toHaveText([
      "breadcrumbs-project",
      "future",
    ]);
    await expect(crumbs).toContainText("Planned context");
    await page.screenshot({
      path: join(out, "planned-light.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Toggle light/dark", exact: true })
      .click();
    await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(async () => (await api(`/api/projects/${project.id}/view`)).theme)
      .toBe("dark");
    await page.screenshot({
      path: join(out, "planned-dark.png"),
      fullPage: true,
    });
    await crumbs
      .getByRole("button", { name: "breadcrumbs-project", exact: true })
      .click();
    await card(node("folder", "src").id).click();
    await card(node("folder", "src/nested").id).click();
    let release!: () => void;
    const delayed = new Promise<void>((r) => {
      release = r;
    });
    let seen!: () => void;
    const requested = new Promise<void>((r) => {
      seen = r;
    });
    await page.route("**/scope", async (route) => {
      if (route.request().postDataJSON().path === "src") {
        seen();
        await delayed;
      }
      await route.continue();
    });
    await crumbs.getByRole("button", { name: "src", exact: true }).click();
    await requested;
    await crumbs
      .getByRole("button", { name: "breadcrumbs-project", exact: true })
      .click();
    await expect(crumbs.locator("button")).toHaveText(["breadcrumbs-project"]);
    const oldResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/scope") &&
        response.request().postDataJSON().path === "src",
    );
    release();
    await (await oldResponse).finished();
    await expect
      .poll(async () => await card(node("folder").id).count())
      .toBe(1);
    await expect(crumbs.locator("button")).toHaveText(["breadcrumbs-project"]);
    await inside(
      page,
      [
        node("folder").id,
        node("folder", "src").id,
        node("folder", "other").id,
      ].map((id) => `fact:${id}`),
    );
    await page.screenshot({ path: join(out, "root-dark.png"), fullPage: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await testInfo.attach("breadcrumb-evidence", {
      body: JSON.stringify({
        fn,
        indexedFile: node("file", "src/nested/index.ts"),
        plannedPath: "future/new.ts",
        errors,
        external,
      }),
      contentType: "application/json",
    });
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
