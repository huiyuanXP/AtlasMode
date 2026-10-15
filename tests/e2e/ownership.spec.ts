import {
  test,
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  access,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
import { openCodeNavigation } from "../support/chat-shell.mjs";

function apiPath(url: string) {
  return decodeURIComponent(new URL(url).pathname);
}

async function ownedServer(root: string, info: TestInfo) {
  const nonce = randomUUID(),
    data = join(root, "data"),
    server = await startProduction(data);
  const receipt = {
    nonce,
    root,
    data,
    port: server.port,
    pid: server.child.pid,
    started: new Date().toISOString(),
    exitCode: null as number | null,
    signal: null as string | null,
    stopped: undefined as string | undefined,
  };
  await writeFile(
    info.outputPath(`server-${nonce}.json`),
    JSON.stringify(receipt, null, 2),
  );
  return {
    ...server,
    stop: async () => {
      try {
        await server.stop();
      } finally {
        receipt.exitCode = server.child.exitCode;
        receipt.signal = server.child.signalCode;
        receipt.stopped = new Date().toISOString();
        await writeFile(
          info.outputPath(`server-${nonce}.json`),
          JSON.stringify(receipt, null, 2),
        );
      }
    },
  };
}

async function sourceReceipt(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const walk = async (path: string) => {
    for (const entry of await readdir(join(root, path), {
      withFileTypes: true,
    })) {
      const name = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile())
        result[name] = createHash("sha256")
          .update(await readFile(join(root, name)))
          .digest("hex");
    }
  };
  await walk("");
  return result;
}
/** Native mouse only. Passive event observation never creates drag events or DataTransfer. */
async function pointerDrop(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const from = await source.boundingBox(),
    to = await target.boundingBox();
  if (!from || !to)
    throw new Error("Native ownership drag has no visible hit bounds");
  const x = from.x + from.width * 0.4,
    y = from.y + 35;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 14, y + 8, { steps: 4 });
  await page.mouse.move(to.x + to.width * 0.5, to.y + to.height * 0.5, {
    steps: 18,
  });
  await page.mouse.move(to.x + to.width * 0.5 + 2, to.y + to.height * 0.5 + 2, {
    steps: 2,
  });
  await page.mouse.up();
}
async function setup(
  page: Page,
  context: Parameters<typeof denyExternalRequests>[0],
  info: TestInfo,
) {
  const root = await mkdtemp(join(tmpdir(), "atlas-fs01-production-")),
    projectPath = join(root, "project");
  await mkdir(join(projectPath, "src"), { recursive: true });
  await mkdir(join(projectPath, "dest"));
  await mkdir(join(projectPath, "other"));
  await writeFile(
    join(projectPath, "src/original.ts"),
    'import {destinationMarker} from "../dest/index.js";export function selected(){return "ORIGINAL bytes"+destinationMarker();}\n',
  );
  await writeFile(
    join(projectPath, "dest/index.ts"),
    'export function destinationMarker(){return "DESTINATION bytes";}\n',
  );
  await writeFile(
    join(projectPath, "other/index.ts"),
    'export function otherMarker(){return "OTHER bytes";}\n',
  );
  const marker = join(root, "SOURCE_EXECUTED");
  await writeFile(
    join(projectPath, "never-execute.ts"),
    `import {writeFileSync} from "node:fs";writeFileSync(${JSON.stringify(marker)},"executed");throw new Error("Do not execute target source");`,
  );
  const external: string[] = [],
    errors: string[] = [];
  await denyExternalRequests(context, external);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as unknown as { ownershipEvents: unknown[] }).ownershipEvents = [];
    for (const kind of ["dragstart", "drop", "dragend"]) {
      document.addEventListener(
        kind,
        (event) => {
          const e = event as DragEvent;
          const element = e.target as HTMLElement;
          (
            window as unknown as { ownershipEvents: unknown[] }
          ).ownershipEvents.push({
            kind,
            domainId: element
              .closest("[data-domain-id]")
              ?.getAttribute("data-domain-id"),
            types: Array.from(e.dataTransfer?.types ?? []),
            target: element.closest("button")?.textContent,
          });
        },
        true,
      );
    }
  });
  const server = await ownedServer(root, info);
  try {
    const api = (path: string, method = "GET", body?: unknown) =>
      http(server.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: projectPath });
    await api(`/api/projects/${project.id}/view`, "PUT", {
      positions: {},
      theme: "light",
      locale: "en",
    });
    const summary = await api(`/api/projects/${project.id}/summary`);
    const selected = summary.entrypoints.find(
      (node: { name: string }) => node.name === "selected",
    );
    expect(selected).toBeTruthy();
    const detail = await api("/api/plans", "POST", {
      projectId: project.id,
      title: "Ownership fixture",
      baselineSnapshotId: summary.snapshotId,
    });
    await page.setViewportSize({ width: 1900, height: 1100 });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: /^(切换项目|Switch project)$/ })
      .selectOption(project.id);
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .first()
      .selectOption(detail.plan.id);
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("selected");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page
      .getByRole("region", { name: "Search functions", exact: true })
      .getByRole("button", { name: /ƒ selected/ })
      .click();
    const card = page.locator(
      `.react-flow__node[data-id="fact:${selected.id}"] .code-card`,
    );
    await expect(card).toBeVisible();
    const before = await sourceReceipt(projectPath);
    return {
      root,
      projectPath,
      marker,
      server,
      api,
      project,
      summary,
      selected,
      detail,
      card,
      before,
      external,
      errors,
      dispose: async () => {
        try {
          await server.stop();
        } finally {
          await rm(root, { recursive: true, force: true });
          await writeFile(
            info.outputPath("cleanup.json"),
            JSON.stringify({
              root,
              removed: true,
              at: new Date().toISOString(),
            }),
          );
        }
      },
      assertSource: async (expected = before) => {
        expect(await sourceReceipt(projectPath)).toEqual(expected);
        await expect(access(marker)).rejects.toThrow();
        expect(external).toEqual([]);
        expect(errors).toEqual([]);
      },
    };
  } catch (error) {
    await server.stop();
    await rm(root, { recursive: true, force: true });
    await writeFile(
      info.outputPath("cleanup.json"),
      JSON.stringify({ root, removed: true, setupFailed: true }),
    );
    throw error;
  }
}
/** An explicit external editor changes only this test's owned source fixture. */
async function externalFixtureChange(
  f: Awaited<ReturnType<typeof setup>>,
  info: TestInfo,
) {
  expect(f.root.startsWith(join(tmpdir(), "atlas-fs01-production-"))).toBe(
    true,
  );
  expect(f.projectPath).toBe(join(f.root, "project"));
  await f.assertSource();
  const path = "other/index.ts",
    file = join(f.projectPath, path);
  const beforeBytes = await readFile(file, "utf8");
  expect(beforeBytes).toBe(
    'export function otherMarker(){return "OTHER bytes";}\n',
  );
  const afterBytes =
    beforeBytes +
    "// Explicit external fixture editor update; target code is never executed.\n";
  const afterExpected = {
    ...f.before,
    [path]: createHash("sha256").update(afterBytes).digest("hex"),
  };
  await writeFile(file, afterBytes);
  // The full expected map changes exactly one known file, not whatever the application leaves behind.
  await f.assertSource(afterExpected);
  const receipt = {
    actor: "owned-external-fixture-editor",
    path,
    beforeBytes,
    afterBytes,
    beforeFiles: f.before,
    afterExpected,
    at: new Date().toISOString(),
  };
  await writeFile(
    info.outputPath("external-fixture-change.json"),
    JSON.stringify(receipt, null, 2),
  );
  return receipt;
}

function targets(page: Page) {
  return page.getByRole("region", { name: "Structure targets", exact: true });
}
function preview(page: Page) {
  return page.getByRole("region", {
    name: "Target change preview",
    exact: true,
  });
}
async function ownership(page: Page) {
  await page
    .getByRole("button", { name: "Plan ownership", exact: true })
    .click();
  await expect(targets(page)).toBeVisible();
}
async function chooseFolder(page: Page, card: Locator) {
  await ownership(page);
  await pointerDrop(
    page,
    card,
    targets(page).getByRole("button", {
      name: "Choose dest · Fact",
      exact: true,
    }),
  );
  await expect(preview(page)).toBeVisible();
}
async function save(
  page: Page,
  planId: string,
  revision: number,
  snapshotId: string,
) {
  const request = page.waitForRequest(
    (request) =>
      apiPath(request.url()) === `/api/plans/${planId}` &&
      request.method() === "PUT",
  );
  await preview(page)
    .getByRole("button", { name: "Add target change to plan", exact: true })
    .click();
  const sent = await request;
  expect(sent.postDataJSON()).toMatchObject({
    expectedRevision: revision,
    expectedSnapshotId: snapshotId,
  });
}
test("native function-to-file drop changes only the draft, uses actual source, requires new confirmation and survives restart", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  let restarted: Awaited<ReturnType<typeof startProduction>> | undefined;
  const sourceRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (apiPath(request.url()).endsWith("/source"))
      sourceRequests.push(url.searchParams.get("filePath") ?? "");
  });
  try {
    await page
      .getByRole("button", { name: "Confirm this plan", exact: true })
      .click();
    await expect
      .poll(
        async () => !!(await f.api(`/api/plans/${f.detail.plan.id}`)).approval,
      )
      .toBe(true);
    const approved = await f.api(`/api/plans/${f.detail.plan.id}`),
      view = await f.api(`/api/projects/${f.project.id}/view`);
    await ownership(page);
    await targets(page)
      .getByRole("button", { name: "Browse dest", exact: true })
      .click();
    const file = targets(page).getByRole("button", {
      name: "Choose dest/index.ts · Fact",
      exact: true,
    });
    await expect(file).toBeVisible();
    await expect(f.card).toHaveAttribute("draggable", "true");
    await pointerDrop(page, f.card, file);
    await expect(preview(page)).toContainText("src/original.ts");
    await expect(preview(page).getByTestId("ownership-full-path")).toHaveText(
      "dest/index.ts",
    );
    expect((await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision).toBe(
      approved.plan.revision,
    );
    await save(
      page,
      f.detail.plan.id,
      approved.plan.revision,
      f.summary.snapshotId,
    );
    await expect
      .poll(
        async () =>
          (await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision,
      )
      .toBe(approved.plan.revision + 1);
    const accepted = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(accepted.plan.operations).toEqual([
      {
        kind: "move_function",
        nodeId: f.selected.id,
        filePath: "dest/index.ts",
      },
    ]);
    expect(accepted.valid).toBe(false);
    expect(accepted.approval.revision).toBe(approved.plan.revision);
    expect(
      (await f.api(`/api/projects/${f.project.id}/view`)).positions,
    ).toEqual(view.positions);
    await expect(page.locator(".breadcrumbs")).toContainText("index.ts");
    await page
      .locator(".inspector")
      .getByRole("button", { name: "View source", exact: true })
      .click();
    await expect(page.locator(".inspector")).toContainText("ORIGINAL bytes");
    expect(sourceRequests).not.toContain("dest/index.ts");
    // Return to the overview using real controls; undo/redo remain semantic saves.
    await page
      .locator(".inspector")
      .getByRole("button", { name: "Back to chat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Undo", exact: true })
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision,
      )
      .toBe(approved.plan.revision + 2);
    await page
      .getByRole("button", { name: "Redo", exact: true })
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision,
      )
      .toBe(approved.plan.revision + 3);
    await page
      .getByRole("button", { name: "Confirm this plan", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await f.api(`/api/plans/${f.detail.plan.id}`)).approval.revision,
      )
      .toBe(approved.plan.revision + 3);
    const reportResponse = page.waitForResponse(
      (response) =>
        apiPath(response.url()) === `/api/plans/${f.detail.plan.id}/verify` &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", {
        name: "Check approved implementation",
        exact: true,
      })
      .first()
      .click();
    const report = await (await reportResponse).json();
    expect(report.revision).toBe(approved.plan.revision + 3);
    expect(
      report.items.some(
        (item: { status: string }) =>
          item.status === "unmet" || item.status === "unknown",
      ),
    ).toBe(true);
    await f.assertSource();
    const native = await page.evaluate(
      () =>
        (window as unknown as { ownershipEvents: unknown[] }).ownershipEvents,
    );
    expect(native).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "dragstart",
          domainId: f.selected.id,
        }),
        // Capture-phase dragstart precedes React's setData; drop/end must still carry the real MIME.
        expect.objectContaining({
          kind: "drop",
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
        expect.objectContaining({
          kind: "dragend",
          domainId: f.selected.id,
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
      ]),
    );
    await f.server.stop();
    restarted = await ownedServer(f.root, info);
    const persisted = await http(
      restarted.url,
      `/api/plans/${f.detail.plan.id}`,
    );
    expect(persisted.plan.operations).toEqual(accepted.plan.operations);
    expect(persisted.plan.revision).toBe(approved.plan.revision + 3);
    await page.goto(restarted.url);
    await f.assertSource();
    await writeFile(
      info.outputPath("native-file-receipt.json"),
      JSON.stringify(
        {
          native,
          approved,
          accepted,
          report,
          sourceRequests,
          before: f.before,
          after: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
    await page.screenshot({
      path: info.outputPath("ownership-file.png"),
      fullPage: true,
    });
  } finally {
    await restarted?.stop();
    await f.dispose();
  }
});
test("native folder drop requires full filename; cancel and stale snapshot save retain truthful boundaries", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  try {
    await chooseFolder(page, f.card);
    const panel = preview(page);
    await expect(
      panel.getByRole("button", {
        name: "Add target change to plan",
        exact: true,
      }),
    ).toBeDisabled();
    await panel
      .getByRole("textbox", { name: "Complete source filename", exact: true })
      .fill("mine.ts");
    await expect(panel.getByTestId("ownership-full-path")).toHaveText(
      "dest/mine.ts",
    );
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    expect((await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision).toBe(
      1,
    );
    await pointerDrop(
      page,
      f.card,
      targets(page).getByRole("button", {
        name: "Choose dest · Fact",
        exact: true,
      }),
    );
    await panel
      .getByRole("textbox", { name: "Complete source filename", exact: true })
      .fill("index.ts");
    await expect(panel.getByTestId("ownership-full-path")).toHaveText(
      "dest/index.ts",
    );
    const externalEdit = await externalFixtureChange(f, info);
    const snapshot = await f.api(
      `/api/projects/${f.project.id}/refresh`,
      "POST",
      {},
    );
    expect(snapshot.id).not.toBe(f.summary.snapshotId);
    expect(snapshot.contentHash).not.toBe(f.summary.contentHash);
    expect((await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision).toBe(
      1,
    );
    const conflict = page.waitForResponse(
      (response) =>
        apiPath(response.url()) === `/api/plans/${f.detail.plan.id}` &&
        response.request().method() === "PUT",
    );
    await save(page, f.detail.plan.id, 1, f.summary.snapshotId);
    const response = await conflict;
    expect(response.status()).toBe(409);
    expect((await response.json()).code).toBe("SNAPSHOT_CHANGED");
    await expect(
      panel.getByRole("textbox", {
        name: "Complete source filename",
        exact: true,
      }),
    ).toHaveValue("index.ts");
    await expect(panel).toContainText("The captured context changed");
    await expect(
      panel.getByRole("button", {
        name: "Add target change to plan",
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      (await f.api(`/api/plans/${f.detail.plan.id}`)).plan.operations,
    ).toEqual([]);
    await f.assertSource(externalEdit.afterExpected);
    await writeFile(
      info.outputPath("native-folder-snapshot-receipt.json"),
      JSON.stringify(
        {
          snapshot,
          externalEdit,
          before: f.before,
          after: await sourceReceipt(f.projectPath),
          events: await page.evaluate(
            () =>
              (window as unknown as { ownershipEvents: unknown[] })
                .ownershipEvents,
          ),
        },
        null,
        2,
      ),
    );
    await page.screenshot({
      path: info.outputPath("ownership-expired.png"),
      fullPage: true,
    });
  } finally {
    await f.dispose();
  }
});
test("a real late context cannot dispatch old source after another function selection", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  let release: (() => void) | undefined;
  let held = false;
  const sourcePaths: string[] = [];
  try {
    await context.route(
      `**/api/projects/${encodeURIComponent(f.project.id)}/functions/${encodeURIComponent(f.selected.id)}?*`,
      async (route) => {
        if (held) return route.continue();
        held = true;
        const response = await route.fetch();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await route.fulfill({ response });
      },
    );
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (apiPath(request.url()).endsWith("/source"))
        sourcePaths.push(url.searchParams.get("filePath") ?? "");
    });
    await page
      .locator(".inspector")
      .getByRole("button", { name: "View source", exact: true })
      .click();
    await expect.poll(() => !!release).toBe(true);
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("destinationMarker");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page
      .getByRole("region", { name: "Search functions", exact: true })
      .getByRole("button", { name: /ƒ destinationMarker/ })
      .click();
    await expect(page.locator(".inspector")).toContainText("DESTINATION bytes");
    release!();
    await expect(page.locator(".inspector")).not.toContainText(
      "ORIGINAL bytes",
    );
    expect(sourcePaths).toEqual(["dest/index.ts"]);
    await f.assertSource();
    await writeFile(
      info.outputPath("source-context-generation.json"),
      JSON.stringify(
        {
          sourcePaths,
          before: f.before,
          after: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
  } finally {
    release?.();
    await f.dispose();
  }
});

test("layout pointer drag changes positions only; native folder drop saves complete filename and reloads the same intent", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  try {
    await expect(
      page.getByRole("button", { name: "Layout", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const before = await f.api(`/api/plans/${f.detail.plan.id}`),
      box = await f.card.boundingBox();
    if (!box) throw new Error("Missing layout card");
    await page.mouse.move(box.x + 70, box.y + 35);
    await page.mouse.down();
    await page.mouse.move(box.x + 125, box.y + 65, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          Object.keys(
            (await f.api(`/api/projects/${f.project.id}/view`)).positions,
          ).length,
      )
      .toBeGreaterThan(0);
    expect((await f.api(`/api/plans/${f.detail.plan.id}`)).plan).toEqual(
      before.plan,
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { ownershipEvents: unknown[] }).ownershipEvents,
      ),
    ).toEqual([]);
    await chooseFolder(page, f.card);
    const panel = preview(page);
    await panel
      .getByRole("textbox", { name: "Complete source filename", exact: true })
      .fill("owned.ts");
    await expect(panel.getByTestId("ownership-full-path")).toHaveText(
      "dest/owned.ts",
    );
    await save(page, f.detail.plan.id, 1, f.summary.snapshotId);
    await expect
      .poll(
        async () =>
          (await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision,
      )
      .toBe(2);
    const saved = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(saved.plan.operations).toEqual([
      {
        kind: "move_function",
        nodeId: f.selected.id,
        filePath: "dest/owned.ts",
      },
    ]);
    await page.reload();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .first()
      .selectOption(f.detail.plan.id);
    await expect(page.locator(".plan-overview")).toContainText("dest/owned.ts");
    expect((await f.api(`/api/plans/${f.detail.plan.id}`)).plan).toEqual(
      saved.plan,
    );
    await f.assertSource();
    await writeFile(
      info.outputPath("layout-folder-receipt.json"),
      JSON.stringify(
        {
          before,
          saved,
          view: await f.api(`/api/projects/${f.project.id}/view`),
          beforeFiles: f.before,
          afterFiles: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
  } finally {
    await f.dispose();
  }
});

test("a folded group endpoint native drag saves the real function ID and retains membership across reload", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  try {
    const beforeGroupPlan = await f.api(`/api/plans/${f.detail.plan.id}`);
    const group = await f.api(`/api/projects/${f.project.id}/groups`, "POST", {
      title: "Owned members",
      description: "unchanged grouping",
      source: "user",
      memberIds: [f.selected.id],
    });
    const afterGroupPlan = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(afterGroupPlan.plan.revision).toBe(
      beforeGroupPlan.plan.revision + 1,
    );
    expect(afterGroupPlan.plan.baselineSnapshotId).toBe(f.summary.snapshotId);
    await page.reload();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .first()
      .selectOption(f.detail.plan.id);
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("selected");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page
      .getByRole("region", { name: "Search functions", exact: true })
      .getByRole("button", { name: /ƒ selected/ })
      .click();
    await page
      .getByRole("button", { name: "Collapse Owned members", exact: true })
      .click();
    const endpoint = page.locator(
      `.group-endpoint[data-domain-id="${f.selected.id}"]`,
    );
    await expect(endpoint).toBeVisible();
    const groups = await f.api(`/api/projects/${f.project.id}/groups`);
    await ownership(page);
    await expect(endpoint).toHaveAttribute("draggable", "true");
    await targets(page)
      .getByRole("button", { name: "Browse dest", exact: true })
      .click();
    await pointerDrop(
      page,
      endpoint,
      targets(page).getByRole("button", {
        name: "Choose dest/index.ts · Fact",
        exact: true,
      }),
    );
    await expect(preview(page).getByTestId("ownership-full-path")).toHaveText(
      "dest/index.ts",
    );
    const currentPlan = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(currentPlan.plan.revision).toBe(afterGroupPlan.plan.revision);
    await save(
      page,
      f.detail.plan.id,
      currentPlan.plan.revision,
      currentPlan.plan.baselineSnapshotId,
    );
    await expect
      .poll(
        async () =>
          (await f.api(`/api/plans/${f.detail.plan.id}`)).plan.revision,
      )
      .toBe(currentPlan.plan.revision + 1);
    const saved = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(saved.plan.operations).toEqual([
      {
        kind: "move_function",
        nodeId: f.selected.id,
        filePath: "dest/index.ts",
      },
    ]);
    expect(saved.plan.operations[0].nodeId).not.toBe(`group:${group.id}`);
    expect(await f.api(`/api/projects/${f.project.id}/groups`)).toEqual(groups);
    await page.reload();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .first()
      .selectOption(f.detail.plan.id);
    await expect(page.locator(".plan-overview")).toContainText("dest/index.ts");
    expect(await f.api(`/api/projects/${f.project.id}/groups`)).toEqual(groups);
    await f.assertSource();
    await writeFile(
      info.outputPath("folded-group-receipt.json"),
      JSON.stringify(
        {
          group,
          groups,
          beforeGroupPlan,
          afterGroupPlan,
          currentPlan,
          saved,
          beforeFiles: f.before,
          afterFiles: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
  } finally {
    await f.dispose();
  }
});

test("dirty advanced title blocks ownership and confirmation across an actual external revision", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  try {
    await page
      .locator(".inspector")
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    const metadata = page.locator(".plan-editor > form").first();
    await metadata.locator("input").fill("Unsent local title");
    await expect(
      page.getByRole("button", { name: "Plan ownership", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Confirm current revision",
        exact: true,
      }),
    ).toBeDisabled();
    const external = await f.api(`/api/plans/${f.detail.plan.id}`, "PUT", {
      expectedRevision: 1,
      expectedSnapshotId: f.summary.snapshotId,
      operations: [],
      title: "External revision",
      description: "remote",
    });
    expect(external.plan.revision).toBe(2);
    const reread = page.waitForResponse(
      (response) =>
        apiPath(response.url()) === `/api/plans/${f.detail.plan.id}` &&
        response.request().method() === "GET",
    );
    await page
      .getByRole("button", { name: "Validate plan", exact: true })
      .first()
      .click();
    await reread;
    await expect(metadata.locator("input")).toHaveValue("Unsent local title");
    await expect(
      metadata.getByRole("button", {
        name: "Save title and description",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Plan ownership", exact: true }),
    ).toBeDisabled();
    expect(
      (await f.api(`/api/plans/${f.detail.plan.id}`)).plan.operations,
    ).toEqual([]);
    await f.assertSource();
    await writeFile(
      info.outputPath("dirty-external-revision.json"),
      JSON.stringify(
        {
          external,
          beforeFiles: f.before,
          afterFiles: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
  } finally {
    await f.dispose();
  }
});

/** Click a disabled DOM button using real pointer input; never force an event. */
async function pointerClickDisabled(page: Page, button: Locator) {
  await expect(button).toBeDisabled();
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  if (!box) throw new Error("Disabled ownership control has no visible bounds");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function focusActualFunction(page: Page, name: string) {
  await page
    .getByRole("textbox", { name: "Search functions", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("region", { name: "Search functions", exact: true })
    .getByRole("button", { name: new RegExp(`ƒ ${name}`) })
    .click();
}

test("non-saving ownership A to B to A keeps the old target retired until an explicit fresh begin", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  const writes: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      apiPath(request.url()) === `/api/plans/${f.detail.plan.id}`
    )
      writes.push(request.postDataJSON());
  });
  try {
    await chooseFolder(page, f.card);
    const panel = preview(page);
    const filename = panel.getByRole("textbox", {
      name: "Complete source filename",
      exact: true,
    });
    await filename.fill("retained.ts");
    await expect(panel.getByTestId("ownership-full-path")).toHaveText(
      "dest/retained.ts",
    );
    await expect(
      panel.getByRole("button", {
        name: "Add target change to plan",
        exact: true,
      }),
    ).toBeEnabled();
    // Native drag created A's preview; no save request has been dispatched.
    expect(writes).toEqual([]);
    await focusActualFunction(page, "otherMarker");
    await expect(panel).toContainText("The captured context changed.");
    await focusActualFunction(page, "selected");
    await expect(panel).toContainText("The captured context changed.");
    await expect(filename).toHaveValue("retained.ts");
    await expect(panel.getByTestId("ownership-full-path")).toHaveText(
      "dest/retained.ts",
    );
    const oldTarget = targets(page).getByRole("button", {
      name: "Choose dest · Fact",
      exact: true,
    });
    const oldSave = panel.getByRole("button", {
      name: "Add target change to plan",
      exact: true,
    });
    // Ordinary pointer clicks on the retired target/save cannot create HTTP writes.
    await pointerClickDisabled(page, oldTarget);
    await pointerClickDisabled(page, oldSave);
    const retired = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(retired.plan.revision).toBe(1);
    expect(retired.plan.operations).toEqual([]);
    expect(writes).toEqual([]);
    await expect(filename).toHaveValue("retained.ts");
    await expect(panel).toContainText("The captured context changed.");
    await page
      .getByRole("button", {
        name: "Choose target for selected function",
        exact: true,
      })
      .click();
    await expect(oldTarget).toBeEnabled();
    await oldTarget.click();
    await filename.fill("fresh.ts");
    await expect(panel.getByTestId("ownership-full-path")).toHaveText(
      "dest/fresh.ts",
    );
    const ack = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        apiPath(response.url()) === `/api/plans/${f.detail.plan.id}`,
    );
    await save(page, f.detail.plan.id, 1, f.summary.snapshotId);
    expect((await ack).ok()).toBe(true);
    const accepted = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(accepted.plan.revision).toBe(2);
    expect(accepted.plan.operations).toEqual([
      {
        kind: "move_function",
        nodeId: f.selected.id,
        filePath: "dest/fresh.ts",
      },
    ]);
    expect(writes).toHaveLength(1);
    const native = await page.evaluate(
      () =>
        (window as unknown as { ownershipEvents: unknown[] }).ownershipEvents,
    );
    expect(native).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "dragstart",
          domainId: f.selected.id,
        }),
        // Capture-phase dragstart precedes React's setData; drop/end must still carry the real MIME.
        expect.objectContaining({
          kind: "drop",
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
        expect.objectContaining({
          kind: "dragend",
          domainId: f.selected.id,
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
      ]),
    );
    await page.reload();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .first()
      .selectOption(f.detail.plan.id);
    await expect(page.locator(".plan-overview")).toContainText("dest/fresh.ts");
    await f.assertSource();
    await writeFile(
      info.outputPath("retired-preview-receipt.json"),
      JSON.stringify(
        {
          snapshotId: f.summary.snapshotId,
          contentHash: f.summary.contentHash,
          retired,
          accepted,
          writes,
          native,
          retainedFilename: "retained.ts",
          savedFullFilename: "dest/fresh.ts",
          beforeFiles: f.before,
          afterFiles: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
    await page.screenshot({
      path: info.outputPath("fresh-preview-persisted.png"),
      fullPage: true,
    });
  } finally {
    await f.dispose();
  }
});

test("idle S0 ownership tray cannot survive actual refresh verification and S1 draft without a fresh scope", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  const writes: unknown[] = [],
    scopes: unknown[] = [];
  page.on("request", (request) => {
    const path = apiPath(request.url());
    if (request.method() === "PUT" && path.startsWith("/api/plans/"))
      writes.push(request.postDataJSON());
    if (
      request.method() === "POST" &&
      path === `/api/projects/${f.project.id}/scope`
    )
      scopes.push(request.postDataJSON());
  });
  try {
    await page
      .getByRole("button", { name: "Confirm this plan", exact: true })
      .click();
    await expect
      .poll(
        async () => !!(await f.api(`/api/plans/${f.detail.plan.id}`)).approval,
      )
      .toBe(true);
    const initialScopeResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        apiPath(response.url()) === `/api/projects/${f.project.id}/scope`,
    );
    await ownership(page);
    const initialScope = await (await initialScopeResponse).json();
    expect(initialScope.snapshotId).toBe(f.summary.snapshotId);
    await expect(
      targets(page).getByRole("button", {
        name: "Choose dest · Fact",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(preview(page)).toBeHidden();
    const externalEdit = await externalFixtureChange(f, info);
    const refreshed = await f.api(
      `/api/projects/${f.project.id}/refresh`,
      "POST",
      {},
    );
    expect(refreshed.id).not.toBe(f.summary.snapshotId);
    expect(refreshed.contentHash).not.toBe(f.summary.contentHash);
    const verified = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        apiPath(response.url()) === `/api/plans/${f.detail.plan.id}/verify`,
    );
    const summaryReply = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        apiPath(response.url()) === `/api/projects/${f.project.id}/summary`,
    );
    await page
      .getByRole("button", {
        name: "Check approved implementation",
        exact: true,
      })
      .first()
      .click();
    const verificationResponse = await verified;
    expect(verificationResponse.ok()).toBe(true);
    const verification = await verificationResponse.json();
    const currentSummary = await (await summaryReply).json();
    expect(currentSummary.snapshotId).not.toBe(f.summary.snapshotId);
    expect(currentSummary.contentHash).not.toBe(f.summary.contentHash);
    // Verification may publish another snapshot; bind the draft to the actual summary, never a guessed S1.
    await expect(
      targets(page).getByRole("button", {
        name: "Choose dest · Fact",
        exact: true,
      }),
    ).toBeHidden();
    await expect(preview(page)).toBeHidden();
    await page
      .locator(".inspector")
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "New plan title", exact: true })
      .fill("Fresh S1 ownership");
    const createdReply = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        apiPath(response.url()) === "/api/plans",
    );
    await page
      .getByRole("button", { name: "Create plan", exact: true })
      .click();
    const createdResponse = await createdReply;
    expect(createdResponse.ok()).toBe(true);
    expect(createdResponse.request().postDataJSON()).toMatchObject({
      projectId: f.project.id,
      baselineSnapshotId: currentSummary.snapshotId,
    });
    const fresh = await createdResponse.json();
    expect(fresh.plan.baselineSnapshotId).toBe(currentSummary.snapshotId);
    expect(fresh.plan.revision).toBe(1);
    expect(fresh.plan.id).not.toBe(f.detail.plan.id);
    await page
      .locator(".inspector")
      .getByRole("button", { name: "Back to chat", exact: true })
      .click();
    await focusActualFunction(page, "selected");
    await expect(targets(page)).toBeHidden();
    await expect(preview(page)).toBeHidden();
    expect(writes).toEqual([]);
    const untouched = await f.api(`/api/plans/${fresh.plan.id}`);
    expect(untouched.plan.revision).toBe(1);
    expect(untouched.plan.operations).toEqual([]);
    const scopeCountBeforeFresh = scopes.length;
    const freshScopeReply = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        apiPath(response.url()) === `/api/projects/${f.project.id}/scope` &&
        response.request().postDataJSON().snapshotId ===
          currentSummary.snapshotId,
    );
    await ownership(page);
    const scopeResponse = await freshScopeReply;
    expect(scopeResponse.ok()).toBe(true);
    const freshScope = await scopeResponse.json();
    expect(freshScope.snapshotId).toBe(currentSummary.snapshotId);
    expect(scopes.length).toBeGreaterThan(scopeCountBeforeFresh);
    await pointerDrop(
      page,
      f.card,
      targets(page).getByRole("button", {
        name: "Choose dest · Fact",
        exact: true,
      }),
    );
    await expect(preview(page)).toBeVisible();
    await preview(page)
      .getByRole("textbox", { name: "Complete source filename", exact: true })
      .fill("current-snapshot.ts");
    await expect(preview(page).getByTestId("ownership-full-path")).toHaveText(
      "dest/current-snapshot.ts",
    );
    const savedReply = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        apiPath(response.url()) === `/api/plans/${fresh.plan.id}`,
    );
    await save(page, fresh.plan.id, 1, currentSummary.snapshotId);
    expect((await savedReply).ok()).toBe(true);
    const accepted = await f.api(`/api/plans/${fresh.plan.id}`);
    expect(accepted.plan.revision).toBe(2);
    expect(accepted.plan.operations).toEqual([
      {
        kind: "move_function",
        nodeId: f.selected.id,
        filePath: "dest/current-snapshot.ts",
      },
    ]);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      expectedRevision: 1,
      expectedSnapshotId: currentSummary.snapshotId,
    });
    const native = await page.evaluate(
      () =>
        (window as unknown as { ownershipEvents: unknown[] }).ownershipEvents,
    );
    expect(native).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "dragstart",
          domainId: f.selected.id,
        }),
        // Capture-phase dragstart precedes React's setData; drop/end must still carry the real MIME.
        expect.objectContaining({
          kind: "drop",
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
        expect.objectContaining({
          kind: "dragend",
          domainId: f.selected.id,
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
      ]),
    );
    await page.reload();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .first()
      .selectOption(fresh.plan.id);
    await expect(page.locator(".plan-overview")).toContainText(
      "dest/current-snapshot.ts",
    );
    await f.assertSource(externalEdit.afterExpected);
    await writeFile(
      info.outputPath("idle-tray-snapshot-receipt.json"),
      JSON.stringify(
        {
          S0: {
            snapshotId: f.summary.snapshotId,
            contentHash: f.summary.contentHash,
            scope: initialScope,
          },
          refreshed,
          externalEdit,
          verification,
          S1: {
            snapshotId: currentSummary.snapshotId,
            contentHash: currentSummary.contentHash,
            scope: freshScope,
          },
          fresh,
          accepted,
          scopes,
          writes,
          native,
          savedFullFilename: "dest/current-snapshot.ts",
          beforeFiles: f.before,
          afterFiles: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
    await page.screenshot({
      path: info.outputPath("fresh-scope-persisted.png"),
      fullPage: true,
    });
  } finally {
    await f.dispose();
  }
});

test("visible ownership Browse and parent controls accept current scopes after real project selection", async ({
  page,
  context,
}, info) => {
  const f = await setup(page, context, info);
  const scopes: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      apiPath(request.url()) === `/api/projects/${f.project.id}/scope`
    )
      scopes.push(request.postDataJSON());
  });
  const responseFor = (path: string) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        apiPath(response.url()) === `/api/projects/${f.project.id}/scope` &&
        response.request().postDataJSON().path === path &&
        response.request().postDataJSON().budget === 100,
    );
  try {
    const rootReply = responseFor(".");
    await ownership(page);
    const rootResponse = await rootReply;
    expect(rootResponse.ok()).toBe(true);
    const rootScope = await rootResponse.json();
    expect(rootScope.snapshotId).toBe(f.summary.snapshotId);
    const childReply = responseFor("dest");
    await targets(page)
      .getByRole("button", { name: "Browse dest", exact: true })
      .click();
    const childResponse = await childReply;
    expect(childResponse.ok()).toBe(true);
    const childScope = await childResponse.json();
    expect(childScope).toMatchObject({
      snapshotId: f.summary.snapshotId,
      path: "dest",
      kind: "folder",
    });
    const file = targets(page).getByRole("button", {
      name: "Choose dest/index.ts · Fact",
      exact: true,
    });
    await expect(file).toBeEnabled();
    const actualTarget = childScope.nodes.find(
      (node: { kind: string; filePath?: string }) =>
        node.kind === "file" && node.filePath === "dest/index.ts",
    );
    expect(actualTarget).toBeTruthy();
    await page.screenshot({
      path: info.outputPath("current-child-tray.png"),
      fullPage: true,
    });
    const parentReply = responseFor(".");
    await targets(page)
      .getByRole("navigation", { name: "Structure targets", exact: true })
      .getByRole("button", { name: ".", exact: true })
      .click();
    const parentResponse = await parentReply;
    expect(parentResponse.ok()).toBe(true);
    const parentScope = await parentResponse.json();
    expect(parentScope).toMatchObject({
      snapshotId: f.summary.snapshotId,
      path: ".",
      kind: "folder",
    });
    await expect(
      targets(page).getByRole("button", { name: "Browse dest", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: info.outputPath("current-parent-tray.png"),
      fullPage: true,
    });
    const againReply = responseFor("dest");
    await targets(page)
      .getByRole("button", { name: "Browse dest", exact: true })
      .click();
    const againResponse = await againReply;
    expect(againResponse.ok()).toBe(true);
    const againScope = await againResponse.json();
    expect(againScope).toMatchObject({
      snapshotId: f.summary.snapshotId,
      path: "dest",
      kind: "folder",
    });
    await expect(file).toBeEnabled();
    await pointerDrop(page, f.card, file);
    await expect(preview(page).getByTestId("ownership-full-path")).toHaveText(
      "dest/index.ts",
    );
    const savedReply = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        apiPath(response.url()) === `/api/plans/${f.detail.plan.id}`,
    );
    await save(page, f.detail.plan.id, 1, f.summary.snapshotId);
    expect((await savedReply).ok()).toBe(true);
    const accepted = await f.api(`/api/plans/${f.detail.plan.id}`);
    expect(accepted.plan.revision).toBe(2);
    expect(accepted.plan.operations).toEqual([
      {
        kind: "move_function",
        nodeId: f.selected.id,
        filePath: "dest/index.ts",
      },
    ]);
    expect(scopes).toEqual(
      [".", "dest", ".", "dest"].map((path) => ({
        path,
        kind: "folder",
        budget: 100,
        snapshotId: f.summary.snapshotId,
        allowMissing: true,
      })),
    );
    const native = await page.evaluate(
      () =>
        (window as unknown as { ownershipEvents: unknown[] }).ownershipEvents,
    );
    expect(native).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "dragstart",
          domainId: f.selected.id,
        }),
        // Capture-phase dragstart precedes React's setData; drop/end must still carry the real MIME.
        expect.objectContaining({
          kind: "drop",
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
        expect.objectContaining({
          kind: "dragend",
          domainId: f.selected.id,
          types: expect.arrayContaining(["application/x-atlas-ownership"]),
        }),
      ]),
    );
    await page.reload();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .first()
      .selectOption(f.detail.plan.id);
    await expect(page.locator(".plan-overview")).toContainText("dest/index.ts");
    await f.assertSource();
    await writeFile(
      info.outputPath("nonzero-epoch-browse-receipt.json"),
      JSON.stringify(
        {
          snapshotId: f.summary.snapshotId,
          contentHash: f.summary.contentHash,
          rootScope,
          childScope,
          parentScope,
          againScope,
          actualTarget,
          scopes,
          accepted,
          native,
          savedFullFilename: "dest/index.ts",
          beforeFiles: f.before,
          afterFiles: await sourceReceipt(f.projectPath),
        },
        null,
        2,
      ),
    );
  } finally {
    await f.dispose();
  }
});
