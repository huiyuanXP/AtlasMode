import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import type { StructureState } from "@codemap/core";
import { legacyId, pol01Fixture, v1 } from "../support/pol01-acceptance.js";
// Main enables only after mounted callbacks and the compiled candidate are frozen.
// Discovery/skips are UNRUN evidence; no HTTP interception or DOM injection is used.
test.skip(
  process.env.POL01_PRODUCTION_GATE !== "1",
  "UNRUN: shared mounted callbacks + compiled candidate gate not authorized",
);
async function openPanel(
  page: Page,
  f: Awaited<ReturnType<typeof pol01Fixture>>,
) {
  await f.json(`/api/projects/${f.project.id}/view`, "PUT", {
    positions: {},
    theme: "light",
    locale: "en",
  });
  await page.goto(f.url());
  await page
    .getByRole("combobox", { name: /^(Switch project|切换项目)$/ })
    .selectOption(f.project.id);
  const navigation = page.locator(".compact-navigation");
  if ((await navigation.getAttribute("open")) === null)
    await navigation.locator(":scope > summary").click();
  const advanced = page.getByRole("button", {
    name: "Advanced controls",
    exact: true,
  });
  if ((await advanced.getAttribute("aria-expanded")) !== "true")
    await advanced.click();
  const panel = page.locator("section.knowledge-panel").filter({
    has: page.getByRole("heading", { name: "Folder policies", exact: true }),
  });
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-action="save"]')).toBeEnabled();
  return panel;
}

test("production native policy edit/import retains unsent input and actual 409 requires explicit reload", async ({
  page,
}, testInfo) => {
  const f = await pol01Fixture("compiled");
  try {
    const panel = await openPanel(page, f),
      original = await readFile(f.path);
    for (const action of [
      "reload",
      "new-policy",
      "new-folder",
      "save",
      "preview",
    ])
      await expect(panel.locator(`[data-action="${action}"]`)).toBeVisible();
    await panel
      .getByRole("combobox", { name: "Edit policy" })
      .selectOption(`legacy:${legacyId}`);
    await panel
      .getByRole("textbox", { name: "Purpose", exact: true })
      .fill("DB edit A");
    const dbSave = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/projects/${f.project.id}/policies`) &&
        r.request().method() === "POST",
    );
    await panel.locator('[data-action="save"]').click();
    expect((await dbSave).status()).toBe(200);
    await expect(panel.locator('[data-action="reload"]')).toBeEnabled();
    expect(await readFile(f.path)).toEqual(original);
    await panel.locator('[data-action="reload"]').click();
    await expect(panel.locator('[data-action="save"]')).toBeEnabled();
    await panel
      .getByRole("combobox", { name: "Edit policy" })
      .selectOption(`legacy:${legacyId}`);
    await panel
      .getByRole("textbox", { name: "Purpose", exact: true })
      .fill("unsent local B");
    await panel.locator('[data-action="preview"]').click();
    await expect(panel.locator('[data-action="import"]')).toBeVisible();
    const imported = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/projects/${f.project.id}/structure`) &&
        r.request().method() === "PUT",
    );
    await panel.locator('[data-action="import"]').click();
    expect((await imported).status()).toBe(200);
    await expect(
      panel.getByRole("textbox", { name: "Purpose", exact: true }),
    ).toHaveValue("unsent local B");
    await expect(
      panel
        .getByRole("status")
        .filter({ hasText: "form edits remain unsaved" }),
    ).toBeVisible();
    expect(
      JSON.parse(await readFile(f.path, "utf8"))["x-atlasmode"]
        .legacyPathPolicies[0].purpose,
    ).toBe("DB edit A");
    await panel.locator('[data-action="reload"]').click();
    await expect(panel.locator('[data-action="save"]')).toBeEnabled();
    await panel
      .getByRole("combobox", { name: "Edit policy" })
      .selectOption("folder:src");
    await panel
      .getByRole("textbox", { name: "Purpose", exact: true })
      .fill("draft after conflict");
    const external = JSON.parse(await readFile(f.path, "utf8"));
    external.folders[0].purpose = "external changed";
    await writeFile(f.path, JSON.stringify(external));
    const conflict = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/projects/${f.project.id}/structure`) &&
        r.request().method() === "PUT",
    );
    await panel.locator('[data-action="save"]').click();
    expect((await conflict).status()).toBe(409);
    await expect(
      panel.getByRole("textbox", { name: "Purpose", exact: true }),
    ).toHaveValue("draft after conflict");
    await expect(panel.locator('[data-action="save"]')).toBeDisabled();
    expect(JSON.parse(await readFile(f.path, "utf8")).folders[0].purpose).toBe(
      "external changed",
    );
    await panel.locator('[data-action="reload"]').click();
    await expect(panel.locator('[data-action="save"]')).toBeEnabled();
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/projects/${f.project.id}/structure`) &&
        r.request().method() === "PUT",
    );
    await panel.locator('[data-action="save"]').click();
    expect((await saved).status()).toBe(200);
    const document = JSON.parse(await readFile(f.path, "utf8"));
    expect(document.folders[0]).toEqual(v1("draft after conflict").folders[0]);
    expect(document.ownerMetadata).toEqual(v1().ownerMetadata);
    expect(document.dependencyRules).toEqual(v1().dependencyRules);
    await f.invariants();
    await testInfo.attach("native-policy-panel", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await f.close();
    await testInfo.attach("owned-runtime-receipt", {
      path: `${f.root}/runtime-receipt.json`,
      contentType: "application/json",
    });
  }
});

test("production native quarantine disables writing and owned restart preserves invalid file bytes", async ({
  page,
}, testInfo) => {
  const f = await pol01Fixture("compiled");
  try {
    const panel = await openPanel(page, f);
    const malformed =
      '{"schemaVersion":999,"folders":[],"dependencyRules":[],"unknown":"never silently overwrite"}';
    await writeFile(f.path, malformed);
    await panel.locator('[data-action="reload"]').click();
    await expect(panel).toContainText("Structure status: invalid");
    await expect(panel.locator('[data-action="save"]')).toBeDisabled();
    await expect(panel.getByRole("alert").first()).toBeVisible();
    expect(await readFile(f.path, "utf8")).toBe(malformed);
    await testInfo.attach("native-quarantine-panel", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await f.restart();
    expect(
      (await f.json<StructureState>(`/api/projects/${f.project.id}/structure`))
        .status,
    ).toBe("invalid");
    expect(await readFile(f.path, "utf8")).toBe(malformed);
    await f.invariants();
  } finally {
    await f.close();
    await testInfo.attach("owned-runtime-receipt", {
      path: `${f.root}/runtime-receipt.json`,
      contentType: "application/json",
    });
  }
});
