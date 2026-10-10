import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
async function transform(card: Locator) {
  return card.evaluate((e) => (e as HTMLElement).style.transform);
}
async function dragCard(page: Page, card: Locator, dx: number, dy: number) {
  // Resolve a stable hit target; a stale box during layout can drag the pane
  // while the layout animation falsely looks like a successful card drag.
  await card.hover();
  const box = await card.boundingBox();
  if (!box) throw new Error("Card has no screen bounds");
  await page.mouse.move(box.x + box.width * 0.4, box.y + 30);
  await page.mouse.down();
  // Cross React Flow's drag threshold, then measure displacement from drag start.
  const startX = box.x + box.width * 0.4 + 4,
    startY = box.y + 34;
  await page.mouse.move(startX, startY);
  await expect(card).toHaveClass(/dragging/);
  const dragStart = await card.boundingBox();
  if (!dragStart) throw new Error("Dragging card has no screen bounds");
  await page.mouse.move(startX + dx, startY + dy, { steps: 12 });
  await expect(card).toHaveClass(/dragging/);
  await page.mouse.up();
  await expect
    .poll(async () => {
      const moved = await card.boundingBox();
      return moved
        ? Math.max(
            Math.abs(moved.x - dragStart.x - dx),
            Math.abs(moved.y - dragStart.y - dy),
          )
        : Infinity;
    })
    .toBeLessThan(2);
}
test("inspection preserves the camera, uniquely previews repeated calls, and funnel dragging survives pages while maps navigate", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-inspection-"));
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "inspection-project");
    await mkdir(target);
    const imports: string[] = [],
      calls: string[] = [];
    for (let i = 0; i < 6; i++) {
      await writeFile(
        join(target, `helper${i}.ts`),
        `export function helper${i}(){return ${i};}`,
      );
      imports.push(`import {helper${i}} from './helper${i}';`);
      calls.push(`helper${i}()`);
    }
    await writeFile(
      join(target, "root.ts"),
      `${imports.join("\n")}\nexport function selected(){ unknownCall(); helper0(); return ${calls.join("+")}; }`,
    );
    await writeFile(
      join(target, "caller.ts"),
      "import {selected} from './root'; export function caller(){return selected();}",
    );
    await writeFile(
      join(target, "other.ts"),
      "export function other(){return 9;}",
    );
    server = await startProduction(join(root, "data"));
    const project = await http(server.url, "/api/projects", "POST", {
      path: target,
    });
    await http(server.url, `/api/projects/${project.id}/view`, "PUT", {
      positions: {},
      theme: "light",
      locale: "en",
    });
    const summary = await http(
      server.url,
      `/api/projects/${project.id}/summary`,
    );
    const selected = summary.entrypoints.find(
      (n: { name: string }) => n.name === "selected",
    );
    const card = (id: string) =>
      page.locator(`.react-flow__node[data-id="fact:${id}"]`);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("selected");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: /ƒ selected/ }).click();
    await expect(card(selected.id)).toBeVisible();
    await expect
      .poll(async () => (await card(selected.id).boundingBox())?.width ?? 0)
      .toBeGreaterThan(200);
    // Close the search selection to isolate hover's camera behavior.
    const detail = page.getByRole("region", { name: "Reference details" });
    await expect(detail).toBeVisible();
    await detail
      .getByRole("button", { name: "Close details", exact: true })
      .click();
    await page.waitForTimeout(350);
    const camera = await page
      .locator(".react-flow__viewport")
      .getAttribute("style");
    await card(selected.id).hover();
    await expect(card(selected.id).locator(".code-card")).toHaveAttribute(
      "data-highlight",
      "selected",
    );
    expect(
      await page.locator(".react-flow__viewport").getAttribute("style"),
    ).toBe(camera);
    await card(selected.id).click();
    await expect(detail).toBeVisible();
    expect(
      await page.locator(".react-flow__viewport").getAttribute("style"),
    ).toBe(camera);
    await expect(detail).toContainText("Calls from this function");
    await expect(detail).toContainText(
      "Unresolved / external calls on this page",
    );
    const realContext = await http(
      server.url,
      `/api/projects/${project.id}/functions/${selected.id}`,
    );
    const repeated = realContext.outgoing.filter(
      (r: { targetId: string; resolution: string }) =>
        r.targetId && r.resolution === "resolved",
    );
    const target0 = repeated.find((r: { evidence: { text: string } }) =>
      r.evidence.text.includes("helper0"),
    );
    const duplicates = repeated.filter(
      (r: { targetId: string }) => r.targetId === target0.targetId,
    );
    expect(duplicates).toHaveLength(2);
    const row = detail.locator(`[data-relation-id="${duplicates[0].id}"]`);
    await row.hover();
    await expect(page.locator(".react-flow__edge.relation")).toHaveCount(1);
    await expect(
      page.locator(`.react-flow__edge[data-id="fact:${duplicates[0].id}"]`),
    ).toHaveClass(/relation/);
    await expect(
      page.locator(`.react-flow__edge[data-id="fact:${duplicates[1].id}"]`),
    ).toHaveClass(/muted/);
    await detail
      .getByRole("button", { name: "View source", exact: true })
      .click();
    await expect(page.getByTestId("inspection-source")).toContainText(
      "unknownCall()",
    );
    await detail
      .getByRole("button", { name: "Close details", exact: true })
      .click();
    await card(selected.id).dblclick();
    await expect(page.locator(".funnel-summary")).toContainText(
      "Dependencies 6",
    );
    await expect(card(selected.id)).toHaveClass(/draggable/);
    // Verify an actual card drag rather than accepting layout animation as motion.
    const before = await transform(card(selected.id));
    await dragCard(page, card(selected.id), 55, 30);
    const moved = await transform(card(selected.id));
    expect(moved).not.toBe(before);
    await page.waitForTimeout(500);
    expect(await transform(card(selected.id))).toBe(moved);
    await expect(detail).toBeVisible();
    const view = await http(server.url, `/api/projects/${project.id}/view`);
    expect(view.positions).toEqual({});
    await page
      .getByRole("button", {
        name: "Dependencies · Next neighbors",
        exact: true,
      })
      .click();
    await page.waitForTimeout(400);
    expect(await transform(card(selected.id))).toBe(moved);
    await page.getByRole("button", { name: "Expand map", exact: true }).click();
    const map = page.getByRole("complementary", {
      name: "Map of the loaded graph",
    });
    await expect(map).toHaveClass(/expanded/);
    const mapBox = await map.boundingBox();
    expect(mapBox!.width).toBeGreaterThan(300);
    await expect(map.locator(".react-flow__minimap-mask")).toBeVisible();
    const initialMapCamera = await page
      .locator(".react-flow__viewport")
      .getAttribute("style");
    await map
      .getByRole("button", { name: "Map zoom out", exact: true })
      .click();
    await expect
      .poll(() => page.locator(".react-flow__viewport").getAttribute("style"))
      .not.toBe(initialMapCamera);
    const svg = map.locator("svg");
    const svgBox = await svg.boundingBox();
    expect(svgBox!.width).toBeGreaterThan(300);
    expect(svgBox!.width).toBeLessThanOrEqual(mapBox!.width);
    const beforeDrag = await page
      .locator(".react-flow__viewport")
      .getAttribute("style");
    await page.mouse.move(
      svgBox!.x + svgBox!.width * 0.5,
      svgBox!.y + svgBox!.height * 0.5,
    );
    await page.mouse.down();
    await page.mouse.move(
      svgBox!.x + svgBox!.width * 0.5 + 28,
      svgBox!.y + svgBox!.height * 0.5 + 14,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect
      .poll(() => page.locator(".react-flow__viewport").getAttribute("style"))
      .not.toBe(beforeDrag);
    const draggedMapBox = await map.boundingBox();
    expect(draggedMapBox!.x).toBeCloseTo(mapBox!.x, 0);
    expect(draggedMapBox!.y).toBeCloseTo(mapBox!.y, 0);
    await svg.hover();
    const beforeWheel = await page
      .locator(".react-flow__viewport")
      .getAttribute("style");
    await page.mouse.wheel(0, -240);
    await expect
      .poll(() => page.locator(".react-flow__viewport").getAttribute("style"))
      .not.toBe(beforeWheel);
    await svg.click({
      position: { x: svgBox!.width * 0.75, y: svgBox!.height * 0.5 },
    });
    await expect(map).toContainText("Currently loaded");
    await page.keyboard.press("Escape");
    await expect(map).toHaveClass(/collapsed/);
    await expect(detail).toBeVisible();
    // Escape closes detail first and then exits the funnel.
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await expect(page.locator(".funnel-summary")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".funnel-summary")).toHaveCount(0);
    expect(
      (await http(server.url, `/api/projects/${project.id}/view`)).positions,
    ).toEqual({});
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
