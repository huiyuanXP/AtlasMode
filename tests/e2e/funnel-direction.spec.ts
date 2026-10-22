import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";

test("funnel frames name their folder and direction when one folder is both caller and callee", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-funnel-direction-"));
  const external: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  let server;
  try {
    const target = join(root, "direction-project");
    await mkdir(join(target, "lib"), { recursive: true });
    await mkdir(join(target, "app"));
    // lib/up.ts calls selected(); selected() calls lib/down.ts: the SAME
    // folder `lib` is a caller above and a callee below.
    await writeFile(
      join(target, "app/selected.ts"),
      'import { down } from "../lib/down";\nexport function selected() { return down(); }\n',
    );
    await writeFile(
      join(target, "lib/up.ts"),
      'import { selected } from "../app/selected";\nexport function up() { return selected(); }\n',
    );
    await writeFile(
      join(target, "lib/down.ts"),
      "export function down() { return 1; }\n",
    );
    server = await startProduction(join(root, "data"));
    const project = await http(server.url, "/api/projects", "POST", {
      path: target,
    });
    const summary = await http(
      server.url,
      `/api/projects/${project.id}/summary`,
    );
    const selected = summary.entrypoints.find(
      (n: { name: string }) => n.name === "selected",
    );
    await http(server.url, `/api/projects/${project.id}/view`, "PUT", {
      positions: {},
      locale: "en",
      theme: "light",
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    await expect(page.locator(".project-heading h1")).toHaveText(
      "direction-project",
    );
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("selected");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: /ƒ selected/ }).click();
    await page
      .locator(`.react-flow__node[data-id="fact:${selected.id}"]`)
      .dblclick();
    await expect(page.locator(".funnel-summary")).toBeVisible();

    const frames = page.locator(".group-frame");
    await expect(frames).toHaveCount(2);
    const titles = await page.locator(".group-frame-title").allTextContents();
    expect(titles).toHaveLength(2);
    // Each title carries direction AND folder path, so the two never read alike.
    expect(
      titles.some((t) => t.includes("Dependents") && t.includes("lib/up.ts")),
    ).toBe(true);
    expect(
      titles.some(
        (t) => t.includes("Dependencies") && t.includes("lib/down.ts"),
      ),
    ).toBe(true);
    expect(new Set(titles).size).toBe(2);
    const above = await page
      .locator('.group-frame-direction[data-lane="dependent"]')
      .boundingBox();
    const below = await page
      .locator('.group-frame-direction[data-lane="dependency"]')
      .boundingBox();
    expect(above!.y).toBeLessThan(below!.y);
    // Neither title may sit under the funnel summary bar or outside the canvas.
    const bar = (await page.locator(".funnel-summary").boundingBox())!;
    const canvas = (await page.locator(".canvas-shell").boundingBox())!;
    await expect
      .poll(async () => {
        const report: string[] = [];
        for (const lane of ["dependent", "dependency"]) {
          const t = await page
            .locator(`.group-frame-direction[data-lane="${lane}"]`)
            .boundingBox();
          if (
            !t ||
            t.y < bar.y + bar.height ||
            t.y + t.height > canvas.y + canvas.height
          )
            report.push(
              `${lane} title y=${t ? Math.round(t.y) : "missing"} bar bottom=${Math.round(bar.y + bar.height)} canvas bottom=${Math.round(canvas.y + canvas.height)}`,
            );
        }
        return report.join(" | ") || "ok";
      })
      .toBe("ok");

    const out = resolve("artifacts/e2e/funnel-direction");
    await mkdir(out, { recursive: true });
    // The fit-to-funnel camera animates for ~250ms; capture only once it holds
    // still so the picture shows the settled layout.
    let last = "";
    await expect
      .poll(async () => {
        const now =
          (await page.locator(".react-flow__viewport").getAttribute("style")) ??
          "";
        const settled = now === last;
        last = now;
        return settled;
      })
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".inspection-card")).toHaveCount(0);
    await page.screenshot({ path: join(out, "funnel-direction.png") });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
