import { openSourceDrawer } from "../support/chat-shell.mjs";
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
      .getByRole("button", { name: "Advanced editing", exact: true })
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
      .getByRole("button", { name: "Advanced editing", exact: true })
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

test("double-click builds an animated directional funnel, restores overview and honors reduced motion for file dependencies", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-funnel-ui-"));
  const out = resolve("artifacts/e2e/focus-navigation");
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
    const target = join(root, "funnel-project");
    await mkdir(target);
    await writeFile(
      join(target, "root.ts"),
      'import { helper } from "./dependency";\nexport function selected() { unknownCall(); return helper(); }\n',
    );
    await writeFile(
      join(target, "caller.ts"),
      'import { selected } from "./root";\nexport function caller() { return selected(); }\n',
    );
    await writeFile(
      join(target, "dependency.ts"),
      "export function helper() { return 3; }\n",
    );
    await writeFile(
      join(target, "unrelated.ts"),
      "export function unrelated() { return 4; }\n",
    );
    server = await startProduction(join(root, "data"));
    const api = (path: string, method?: string, body?: unknown) =>
      http(server!.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: target });
    const summary = await api(`/api/projects/${project.id}/summary`);
    const by = Object.fromEntries(
      summary.entrypoints.map((n: { name: string; id: string }) => [
        n.name,
        n.id,
      ]),
    );
    const overview = await api(`/api/projects/${project.id}/subgraph`, "POST", {
      nodeIds: Object.values(by),
      depth: 0,
      budget: 80,
    });
    const positions = Object.fromEntries(
      overview.nodes.map((n: { id: string }, i: number) => [
        `fact:${n.id}`,
        { x: 200 + (i % 3) * 340, y: 100 + Math.floor(i / 3) * 210 },
      ]),
    );
    await api(`/api/projects/${project.id}/view`, "PUT", {
      positions,
      locale: "en",
      theme: "light",
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await expect(page.locator(".project-heading h1")).toHaveText(
      "funnel-project",
    );
    const card = (id: string) =>
      page.locator(`.react-flow__node[data-id="fact:${id}"]`);
    await assertCardsInside(
      page,
      Object.values(by).map((id) => `fact:${id}`),
    );
    const previousCamera = await page
      .locator(".react-flow__viewport")
      .getAttribute("style");
    const previousCoordinates = await page
      .locator(".react-flow__node")
      .evaluateAll((nodes) =>
        Object.fromEntries(
          nodes.map((n) => [
            n.getAttribute("data-id"),
            (n as HTMLElement).style.transform,
          ]),
        ),
      );
    // Record real DOM transforms each animation frame; screen-space boxes alone
    // could be changed by a camera tween without any node position interpolation.
    await page.evaluate(() => {
      const w = window as unknown as {
        funnelFrames: {
          time: number;
          transforms: Record<string, string>;
          active: boolean;
        }[];
        stopFrames: boolean;
      };
      w.funnelFrames = [];
      w.stopFrames = false;
      const tick = () => {
        w.funnelFrames.push({
          time: performance.now(),
          active: !!document.querySelector(".funnel-summary"),
          transforms: Object.fromEntries(
            [...document.querySelectorAll(".react-flow__node")].map((n) => [
              n.getAttribute("data-id")!,
              (n as HTMLElement).style.transform,
            ]),
          ),
        });
        if (!w.stopFrames) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await card(by.selected).dblclick();
    await expect(
      page.getByRole("button", { name: "Exit funnel (Esc)", exact: true }),
    ).toBeVisible();
    await openSourceDrawer(page);
    await expect(page.locator(".inspector-content h2")).toHaveText("selected");
    await openSourceDrawer(page);
    await expect(page.getByTestId("source-snippet")).toContainText(
      "unknownCall()",
    );
    await expect(page.locator(".funnel-summary")).toContainText("Dependents 1");
    await expect(page.locator(".funnel-summary")).toContainText(
      "Dependencies 1",
    );
    await expect(page.locator(".funnel-summary")).toContainText(
      "Unknown/external 1",
    );
    await expect
      .poll(async () => {
        const a = await card(by.caller).boundingBox(),
          b = await card(by.selected).boundingBox(),
          c = await card(by.helper).boundingBox();
        return (
          !!a && !!b && !!c && a.y + a.height < b.y && b.y + b.height < c.y
        );
      })
      .toBe(true);
    await assertCardsInside(
      page,
      [by.caller, by.selected, by.helper].map((id) => `fact:${id}`),
    );
    await expect(page.locator('[data-funnel-lane="selected"]')).toHaveCount(1);
    await expect(card(by.unrelated).locator(".code-card")).toHaveAttribute(
      "data-funnel-lane",
      "side",
    );
    // Settled root at (0,0), with at least two distinct intermediate coordinates.
    await expect(card(by.selected)).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 0, 0)",
    );
    const frames = (await page.evaluate(() => {
      const w = window as unknown as {
        funnelFrames: unknown[];
        stopFrames: boolean;
      };
      w.stopFrames = true;
      return w.funnelFrames;
    })) as {
      time: number;
      active: boolean;
      transforms: Record<string, string>;
    }[];
    const rootTransforms = [
      ...new Set(
        frames
          .filter((f) => f.active)
          .map((f) => f.transforms[`fact:${by.selected}`]),
      ),
    ];
    expect(
      rootTransforms.filter(
        (t) =>
          t &&
          t !== "translate(0px, 0px)" &&
          t !== previousCoordinates[`fact:${by.selected}`],
      ).length,
    ).toBeGreaterThan(1);
    await page.screenshot({
      path: join(out, "funnel-function-light.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Toggle light/dark", exact: true })
      .click();
    await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("button", { name: "Exit funnel (Esc)", exact: true }),
    ).toHaveCSS("background-color", "rgb(32, 41, 57)");
    await page.screenshot({
      path: join(out, "funnel-function-dark.png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".funnel-summary")).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator(".react-flow__node")
          .evaluateAll((nodes) =>
            Object.fromEntries(
              nodes.map((n) => [
                n.getAttribute("data-id"),
                (n as HTMLElement).style.transform,
              ]),
            ),
          ),
      )
      .toEqual(previousCoordinates);
    await expect
      .poll(() => page.locator(".react-flow__viewport").getAttribute("style"))
      .toBe(previousCamera);
    expect((await api(`/api/projects/${project.id}/view`)).positions).toEqual(
      positions,
    );
    // Files must use the real import/cross-file-call query, never contains children.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const file = overview.nodes.find(
      (n: { kind: string; filePath: string }) =>
        n.kind === "file" && n.filePath === "root.ts",
    );
    const fileQuery = await api(
      `/api/projects/${project.id}/dependencies`,
      "POST",
      { nodeId: file.id, budget: 80 },
    );
    expect(
      fileQuery.nodes.map((n: { filePath: string }) => n.filePath).sort(),
    ).toEqual(["caller.ts", "dependency.ts", "root.ts"]);
    expect(
      fileQuery.relations.filter(
        (r: { targetId: string | null }) => r.targetId,
      ),
    ).toHaveLength(2);
    await page.evaluate(() => {
      const w = window as unknown as {
        reducedTransforms: string[];
        reducedStop: boolean;
      };
      w.reducedTransforms = [];
      w.reducedStop = false;
      const tick = () => {
        const node = document
          .querySelector('[data-funnel-lane="selected"]')
          ?.closest(".react-flow__node") as HTMLElement | undefined;
        if (node) w.reducedTransforms.push(node.style.transform);
        if (!w.reducedStop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await card(file.id).dblclick();
    await expect(page.locator(".funnel-summary")).toContainText("Dependents 1");
    await expect(page.locator(".funnel-summary")).toContainText(
      "Dependencies 1",
    );
    await expect(card(file.id)).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 0, 0)",
    );
    const rootLane = page.locator('[data-funnel-lane="selected"]');
    await expect(rootLane).toHaveCount(1);
    await expect(rootLane).toContainText("root.ts");
    await openSourceDrawer(page);
    await expect(page.locator(".inspector-content h2")).toHaveText("root.ts");
    await openSourceDrawer(page);
    await expect(page.locator(".inspector-content .path")).toContainText(
      "root.ts",
    );
    await openSourceDrawer(page);
    await expect(page.getByTestId("source-snippet")).toContainText(
      "export function selected",
    );
    await assertCardsInside(
      page,
      fileQuery.nodes.map((n: { id: string }) => `fact:${n.id}`),
    );
    await expect
      .poll(async () => (await card(file.id).boundingBox())?.width ?? 0)
      .toBeGreaterThan(180);
    const reducedTransforms = await page.evaluate(() => {
      const w = window as unknown as {
        reducedTransforms: string[];
        reducedStop: boolean;
      };
      w.reducedStop = true;
      return [...new Set(w.reducedTransforms)];
    });
    expect(
      reducedTransforms.filter(
        (t) =>
          t !== "translate(0px, 0px)" &&
          t !== previousCoordinates[`fact:${file.id}`],
      ),
    ).toEqual([]);
    const rootRelations = await page.locator(".react-flow__edge").count();
    expect(rootRelations).toBeGreaterThanOrEqual(2);
    await page.screenshot({
      path: join(out, "funnel-file-reduced-motion.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Exit funnel (Esc)", exact: true })
      .click();
    await expect(page.locator(".funnel-summary")).toHaveCount(0);
    expect((await api(`/api/projects/${project.id}/view`)).positions).toEqual(
      positions,
    );
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await testInfo.attach("funnel-evidence", {
      body: JSON.stringify({
        frames,
        rootTransforms,
        previousCamera,
        fileQuery,
        reducedTransforms,
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
