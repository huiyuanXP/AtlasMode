import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";

test("anonymous callbacks read as the receiving call in both languages while their identity is unchanged", async ({
  page,
  context,
}) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-callback-names-"));
  const external: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  let server;
  try {
    const target = join(root, "callback-project");
    await mkdir(target);
    await writeFile(
      join(target, "suite.ts"),
      [
        "declare function describe(name: string, fn: () => void): void;",
        "declare function onReady(fn: () => void): void;",
        'describe("suite", () => {',
        "  onReady(() => 1);",
        "});",
        "",
      ].join("\n"),
    );
    server = await startProduction(join(root, "data"));
    const project = await http(server.url, "/api/projects", "POST", {
      path: target,
    });
    const snapshot = await http(
      server.url,
      `/api/projects/${project.id}/snapshot`,
    );
    const rawCallbacks = snapshot.nodes
      .filter(
        (n: { kind: string; name: string }) =>
          n.kind === "function" && n.name.startsWith("<callback:"),
      )
      .map((n: { name: string }) => n.name);
    // The stable identity the indexer produced is the machine-readable string.
    expect(rawCallbacks.some((n: string) => n.includes('"describe"'))).toBe(
      true,
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
      "callback-project",
    );
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("describe");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const result = page.locator(".node-list button", {
      hasText: "describe(…) callback",
    });
    await expect(result.first()).toBeVisible();
    // Neither the search results nor the entry-point list shows raw token JSON.
    for (const list of await page.locator(".node-list").all()) {
      await expect(list).not.toContainText("<callback:");
      await expect(list).not.toContainText('[[80,"');
    }
    await result.first().click();
    await expect(
      page.locator(".code-card .node-identity-label", {
        hasText: "describe(…) callback",
      }),
    ).toBeVisible();
    await expect(page.locator(".react-flow")).not.toContainText("<callback:");
    // The raw identity stays available as the tooltip/ID source, untouched.
    const withRaw = await page
      .locator(".react-flow__node", {
        has: page.locator(".code-card .node-identity-label", {
          hasText: "describe(…) callback",
        }),
      })
      .first()
      .getAttribute("data-id");
    expect(withRaw).toMatch(/^fact:function:/);

    // Switching language relabels the same node.
    await page
      .getByRole("combobox", { name: "Interface language", exact: true })
      .selectOption("zh");
    await expect(
      page.locator(".code-card .node-identity-label", {
        hasText: "describe(…) 回调",
      }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "界面语言", exact: true })
      .selectOption("en");
    await expect(
      page.locator(".code-card .node-identity-label", {
        hasText: "describe(…) callback",
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
