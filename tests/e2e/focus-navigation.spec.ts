import { test, expect, type Page } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";

async function assertCardsInside(page: Page, ids: string[]) {
  await expect
    .poll(async () => {
      const canvas = await page.locator(".canvas-shell").boundingBox();
      if (!canvas) return false;
      for (const id of ids) {
        const card = await page
          .locator(`.react-flow__node[data-id="${id}"]`)
          .boundingBox();
        if (
          !card ||
          card.x < canvas.x ||
          card.y < canvas.y ||
          card.x + card.width > canvas.x + canvas.width ||
          card.y + card.height > canvas.y + canvas.height
        )
          return false;
      }
      return true;
    })
    .toBe(true);
}

test("semantic creation after overview and multi-change plan choice fit their affected cards", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-focus-ui-"));
  const out = resolve("artifacts/e2e/focus-navigation");
  await mkdir(out, { recursive: true });
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "focus-project");
    await mkdir(target);
    await writeFile(
      join(target, "entry.ts"),
      Array.from(
        { length: 8 },
        (_, i) => `export function entry${i}() { return ${i}; }`,
      ).join("\n"),
    );
    server = await startProduction(join(root, "data"));
    const api = (path: string, method?: string, body?: unknown) =>
      http(server!.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: target });
    const summary = await api(`/api/projects/${project.id}/summary`);
    const positions = Object.fromEntries(
      summary.entrypoints.map((n: { id: string }, i: number) => [
        `fact:${n.id}`,
        { x: 4000 + i * 310, y: 0 },
      ]),
    );
    positions["plan:multi-left"] = { x: 4200, y: -1000 };
    positions["plan:multi-right"] = { x: 6000, y: 1000 };
    await api(`/api/projects/${project.id}/view`, "PUT", {
      positions,
      locale: "en",
      theme: "light",
    });
    const empty = await api("/api/plans", "POST", {
      projectId: project.id,
      baselineSnapshotId: summary.snapshotId,
      title: "Create action",
    });
    const multi = await api("/api/plans", "POST", {
      projectId: project.id,
      baselineSnapshotId: summary.snapshotId,
      title: "Multiple changes",
    });
    const anchorId = summary.entrypoints[0].id;
    await api(`/api/plans/${multi.plan.id}`, "PUT", {
      expectedRevision: multi.plan.revision,
      title: "Multiple changes",
      description: "",
      operations: [
        {
          kind: "add_function",
          tempId: "multi-left",
          name: "multiLeft",
          filePath: "planned.ts",
        },
        {
          kind: "add_function",
          tempId: "multi-right",
          name: "multiRight",
          filePath: "planned.ts",
        },
        { kind: "move_function", nodeId: anchorId, filePath: "moved.ts" },
        { kind: "annotate", targetId: anchorId, text: "Affected anchor" },
        {
          kind: "add_relation",
          id: "multi-edge",
          sourceId: "multi-left",
          targetId: anchorId,
          type: "calls",
        },
      ],
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await expect(page.locator(".project-heading h1")).toHaveText(
      "focus-project",
    );
    await page
      .getByRole("button", { name: "Plan editor", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .selectOption(empty.plan.id);
    await page.getByRole("button", { name: "Fit view", exact: true }).click();
    const addForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Add function", exact: true }),
    });
    await addForm
      .getByLabel("Function name", { exact: true })
      .fill("createdFocus");
    await addForm
      .getByLabel("Target file (repository relative)", { exact: true })
      .fill("created.ts");
    await page
      .getByRole("button", { name: "Add function", exact: true })
      .click();
    const created = page
      .locator(".react-flow__node")
      .filter({ hasText: "createdFocus" });
    await expect(created).toHaveCount(1);
    const createdId = await created.getAttribute("data-id");
    await assertCardsInside(page, [createdId!]);
    // Being a tiny dot in the overview is insufficient: creation must focus a
    // readable card, rather than fitting the unrelated existing graph again.
    await expect
      .poll(async () => (await created.boundingBox())?.width ?? 0)
      .toBeGreaterThan(200);
    await page.screenshot({
      path: join(out, "created-light.png"),
      fullPage: true,
    });
    // Plan choice must use all its affected nodes, despite the prior creation camera.
    await page.locator(".graph-toolbar select").first().selectOption("fact");
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .selectOption(multi.plan.id);
    await expect(page.locator(".graph-toolbar select").first()).toHaveValue(
      "both",
    );
    await assertCardsInside(page, [
      "plan:multi-left",
      "plan:multi-right",
      `fact:${anchorId}`,
    ]);
    await page.screenshot({
      path: join(out, "multi-light.png"),
      fullPage: true,
    });
    const before = await api(`/api/plans/${multi.plan.id}`);
    await page
      .getByRole("button", { name: "Toggle light/dark", exact: true })
      .click();
    await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
    await assertCardsInside(page, [
      "plan:multi-left",
      "plan:multi-right",
      `fact:${anchorId}`,
    ]);
    expect(await api(`/api/plans/${multi.plan.id}`)).toEqual(before);
    await page.screenshot({
      path: join(out, "multi-dark.png"),
      fullPage: true,
    });
    // Manual layout can spread targets beyond the normal zoom-control range.
    // Automatic focus still fits that affected set; it never drags saved nodes.
    await expect
      .poll(async () => (await api(`/api/projects/${project.id}/view`)).theme)
      .toBe("dark");
    positions["plan:multi-left"] = { x: -20000, y: -1000 };
    positions["plan:multi-right"] = { x: 20000, y: 1000 };
    await api(`/api/projects/${project.id}/view`, "PUT", {
      positions,
      locale: "en",
      theme: "dark",
    });
    await page.reload();
    await expect(page.locator(".project-heading h1")).toHaveText(
      "focus-project",
    );
    await page
      .getByRole("button", { name: "Plan editor", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .selectOption(multi.plan.id);
    await assertCardsInside(page, [
      "plan:multi-left",
      "plan:multi-right",
      `fact:${anchorId}`,
    ]);
    expect((await api(`/api/projects/${project.id}/view`)).positions).toEqual(
      positions,
    );
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await testInfo.attach("focus-evidence", {
      body: JSON.stringify({
        createdId,
        targets: ["multi-left", "multi-right", anchorId],
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
