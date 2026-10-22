import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";

test("overview wraps each expanded folder in a titled frame that follows drags", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-folder-frame-"));
  const external: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  let server;
  try {
    const target = join(root, "frame-project");
    await mkdir(join(target, "src/nested"), { recursive: true });
    await mkdir(join(target, "other"));
    await writeFile(
      join(target, "src/a.ts"),
      "export function a() { return 1; }\n",
    );
    await writeFile(
      join(target, "src/nested/b.ts"),
      "export function b() { return 2; }\n",
    );
    await writeFile(
      join(target, "other/c.ts"),
      "export function c() { return 3; }\n",
    );
    server = await startProduction(join(root, "data"));
    const api = (path: string, method?: string, body?: unknown) =>
      http(server!.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: target });
    const snapshot = await api(`/api/projects/${project.id}/snapshot`);
    const node = (kind: string, path?: string) =>
      snapshot.nodes.find(
        (n: { kind: string; filePath?: string }) =>
          n.kind === kind && n.filePath === path,
      );
    const fn = (name: string) =>
      snapshot.nodes.find(
        (n: { kind: string; name: string }) =>
          n.kind === "function" && n.name === name,
      );
    await api(`/api/projects/${project.id}/view`, "PUT", {
      positions: {},
      locale: "en",
      theme: "light",
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await expect(page.locator(".project-heading h1")).toHaveText(
      "frame-project",
    );
    const crumbs = page.getByRole("navigation", {
      name: "Location",
      exact: true,
    });
    const card = (id: string) =>
      page.locator(`.react-flow__node[data-id="fact:${id}"]`);
    const frames = page.locator(".group-frame");
    const frameBox = async (title: string) =>
      page
        .locator(".react-flow__node", {
          has: page.locator(`.group-frame[data-group-frame="${title}"]`),
        })
        .boundingBox();
    // Read the frame and its cards in ONE page task: the camera animates for
    // ~250ms after navigation, so separate reads can straddle different zooms.
    // Poll until the camera has settled and report the worst overflow in px.
    const overflow = (title: string, cardIds: string[]) =>
      page.evaluate(
        ({ title, cardIds }) => {
          const rect = (el: Element | null) => el?.getBoundingClientRect();
          const frame = rect(
            document
              .querySelector(`.group-frame[data-group-frame="${title}"]`)
              ?.closest(".react-flow__node") ?? null,
          );
          if (!frame) return Number.POSITIVE_INFINITY;
          let worst = 0;
          for (const id of cardIds) {
            const c = rect(
              document.querySelector(`.react-flow__node[data-id="${id}"]`),
            );
            if (!c) return Number.POSITIVE_INFINITY;
            worst = Math.max(
              worst,
              frame.left - c.left,
              frame.top - c.top,
              c.right - frame.right,
              c.bottom - frame.bottom,
            );
          }
          return worst;
        },
        { title, cardIds },
      );
    const enclosed = async (title: string, ids: string[]) => {
      let previous = Number.NaN;
      await expect
        .poll(async () => {
          const now = await overflow(title, ids);
          const settled = now === previous;
          previous = now;
          return settled ? now : Number.NaN;
        })
        .toBeLessThanOrEqual(1);
    };

    // Open a function so the breadcrumb exposes src > nested, then scope to src.
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("b");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: /ƒ b/ }).click();
    await crumbs.getByRole("button", { name: "src", exact: true }).click();
    await expect(page.locator(".funnel-summary")).toHaveCount(0);
    await expect(card(node("folder", "src").id)).toBeVisible();
    await expect(card(node("folder", "src/nested").id)).toBeVisible();

    // The expanded folder `src` is wrapped, titled with its path, and encloses
    // its direct children.
    await expect(frames.first()).toBeVisible();
    await expect(
      page.locator(".group-frame-title", { hasText: /^src$/ }),
    ).toBeVisible();
    await enclosed("src", [
      `fact:${node("folder", "src").id}`,
      `fact:${node("folder", "src/nested").id}`,
    ]);
    // The folder card stays and the sibling folder outside src is not inside.
    await expect(frames.first()).toHaveCSS("pointer-events", "none");

    // Dragging a child card moves the frame with it (frame grows to keep it).
    const child = card(node("folder", "src/nested").id);
    const before = (await frameBox("src"))!;
    const cb = (await child.boundingBox())!;
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(cb.x + cb.width / 2 + 160, cb.y + cb.height / 2 + 90, {
      steps: 10,
    });
    await page.mouse.up();
    await expect
      .poll(async () => {
        const f = (await frameBox("src"))!;
        return f.width + f.height;
      })
      .not.toBe(before.width + before.height);
    const after = (await frameBox("src"))!;
    const moved = (await child.boundingBox())!;
    expect(moved.x).toBeGreaterThanOrEqual(after.x);
    expect(moved.x + moved.width).toBeLessThanOrEqual(after.x + after.width + 1);
    expect(moved.y + moved.height).toBeLessThanOrEqual(after.y + after.height + 1);

    // A function in another folder: its own folder is also wrapped and titled,
    // nested inside the root folder's frame, and it encloses the file card.
    await crumbs
      .getByRole("button", { name: "frame-project", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Search functions", exact: true }).fill("c");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: /ƒ c/ }).click();
    await expect(card(fn("c").id)).toBeVisible();
    await expect(
      page.locator(".group-frame-title", { hasText: /^other$/ }),
    ).toBeVisible();
    await enclosed("other", [`fact:${node("file", "other/c.ts").id}`]);
    // Every frame has a visible title; none is blank (root folder included).
    const titles = await page.locator(".group-frame-title").allTextContents();
    expect(titles.length).toBe(await page.locator(".group-frame").count());
    expect(titles.every((t) => t.trim().length > 0)).toBe(true);

    const out = resolve("artifacts/e2e/folder-frames");
    await mkdir(out, { recursive: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
