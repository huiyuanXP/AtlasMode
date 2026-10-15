import {
  openCodeNavigation,
  openSourceDrawer,
  openAdvancedNavigation,
} from "../support/chat-shell.mjs";
import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  connectMcp,
  createFixtures,
  http,
  callerSource,
} from "../support/production.mjs";

test("production UI and SDK share the complete planning, approval, persistence and verification flow offline", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-e2e-"));
  let server, mcp;
  const errors = [],
    external = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  // Keep the local service reachable; deny every external browser request.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
      external.push(url.href);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const evidence = { errors, external };
  const screenshots = resolve("artifacts/e2e");
  await mkdir(screenshots, { recursive: true });
  try {
    const f = await createFixtures(root);
    server = await startProduction(join(root, "data"));
    const api = (path, method, body) => http(server.url, path, method, body);
    const clickEdge = async (id) => {
      await page.getByRole("button", { name: "Fit view", exact: true }).click();
      // FocusViewport animates navigation for 250ms; wait for that documented transition.
      await page.waitForTimeout(300);
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // A grouped relation retains its true ID across one or more visual routes.
      const edges = page
        .getByTestId(
          new RegExp(
            `^rf__edge-(?:${escapedId}|group-edge:${escapedId}:\\d+)$`,
          ),
        )
        .locator(".react-flow__edge-interaction");
      let point;
      await expect
        .poll(async () => {
          point = await edges.evaluateAll((paths) => {
            for (const path of paths) {
              // Crossing curves can cover the midpoint. Click a visible segment
              // belonging to this relation, using actual browser hit testing.
              for (let segment = 1; segment < 100; segment++) {
                const fraction = segment / 100;
                const p = path.getPointAtLength(
                  path.getTotalLength() * fraction,
                );
                const transformed = new DOMPoint(p.x, p.y).matrixTransform(
                  path.getScreenCTM(),
                );
                for (const [dx, dy] of [
                  [0, 0],
                  [0, 4],
                  [0, -4],
                  [4, 0],
                  [-4, 0],
                ]) {
                  const x = transformed.x + dx,
                    y = transformed.y + dy;
                  const hit = document.elementFromPoint(x, y);
                  if (
                    hit?.closest(".react-flow__edge") ===
                    path.closest(".react-flow__edge")
                  )
                    return {
                      x,
                      y,
                      visualRoute: path
                        .closest(".react-flow__edge")
                        .getAttribute("data-testid"),
                    };
                }
              }
            }
            return null;
          });
          return point !== null;
        })
        .toBe(true);
      console.log(
        JSON.stringify({ requestedRelation: id, clickedRoute: point }),
      );
      await page.mouse.click(point.x, point.y);
      if (
        id.startsWith("fact:") &&
        point.visualRoute.startsWith("rf__edge-group-edge:")
      ) {
        const callEvidence = page.getByRole("region", {
          name: "Call evidence",
          exact: true,
        });
        await expect(callEvidence).toContainText(id.slice(5));
        if (id === `fact:${callA.id}`) {
          await expect(callEvidence).toContainText(node("caller").name);
          await expect(callEvidence).toContainText(node("A").name);
          await expect(callEvidence).toContainText(
            `${callA.evidence.filePath}:${callA.evidence.line}`,
          );
        }
        await callEvidence
          .getByRole("button", {
            name: "Plan a change to this relation",
            exact: true,
          })
          .click();
      }
      await expect(
        page.getByRole("combobox", { name: "Source function", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          `Selected relation: ${id.replace(/^(fact|plan):/, "")}`,
          { exact: true },
        ),
      ).toBeVisible();
      if (id === `fact:${callA.id}`) {
        await expect(
          page.getByRole("combobox", { name: "Source function", exact: true }),
        ).toHaveValue(callA.sourceId);
        // Fact reconnection deliberately requires an explicit target choice.
        const target = page.getByRole("combobox", {
          name: "Target function",
          exact: true,
        });
        await target.selectOption(callA.targetId);
        await expect(target).toHaveValue(callA.targetId);
      }
    };
    mcp = await connectMcp(server.url);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: server.url,
    });
    await page.goto(server.url);
    await page.getByRole("button", { name: "打开项目", exact: true }).click();
    await page.getByRole("textbox", { name: "本地项目路径" }).fill(f.ts);
    await page.getByRole("button", { name: "打开并索引" }).click();
    await expect(page.locator(".project-heading h1")).toHaveText("typescript");
    await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
    await openAdvancedNavigation(page);
    const [project] = await api("/api/projects");
    const args = { projectId: project.id };
    const snapshot = await api(`/api/projects/${project.id}/snapshot`);
    const node = (name) =>
      snapshot.nodes.find((n) => n.kind === "function" && n.name === name);
    const callA = snapshot.relations.find(
      (r) =>
        r.type === "calls" &&
        r.sourceId === node("caller").id &&
        r.targetId === node("A").id,
    );
    await openCodeNavigation(page);
    await page.getByRole("button", { name: /ƒ caller/ }).click();
    await openSourceDrawer(page);
    await expect(page.getByTestId("source-snippet")).toContainText(
      "return A()",
    );
    await expect(page.locator(".inspector")).toContainText("Call targets (1)");
    await page
      .getByRole("button", { name: "Copy file and line", exact: true })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `main.ts:${node("caller").startLine}`,
    );
    evidence.clipboard = "actual navigator.clipboard.readText in Chromium";
    await page.screenshot({
      path: join(screenshots, "source.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Expand one level", exact: true })
      .click();
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "caller" }).first(),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Search functions" })
      .fill("requestWithRetry");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.locator(".navigation .node-list").last()).toContainText(
      "requestWithRetry",
    );
    await mcp.call("propose_group", {
      ...args,
      title: "Reusable requests",
      description: "Agent-authored group",
      memberIds: [node("requestWithRetry").id, node("A").id],
    });
    const chain = await mcp.call("propose_route", {
      ...args,
      snapshotId: snapshot.id,
      title: "Actual call chain",
      description: "Source evidence",
      kind: "call_chain",
      steps: [
        { nodeId: node("caller").id, note: "Caller" },
        { nodeId: node("A").id, note: "Direct target", relationId: callA.id },
      ],
    });
    const walk = await mcp.call("propose_route", {
      ...args,
      snapshotId: snapshot.id,
      title: "Reuse walkthrough",
      description: "Explanation, not a call",
      kind: "walkthrough",
      steps: [{ nodeId: node("requestWithRetry").id, note: "Reusable target" }],
    });
    const proposed = await mcp.call("propose_plan", {
      ...args,
      baselineSnapshotId: snapshot.id,
      title: "Fetch notes through reuse",
      operations: [
        {
          kind: "add_function",
          tempId: "notes",
          name: "fetchNotes",
          filePath: "draft.ts",
        },
        {
          kind: "add_function",
          tempId: "spare",
          name: "spareHelper",
          filePath: "draft.ts",
        },
        {
          kind: "add_relation",
          id: "new-call",
          sourceId: "notes",
          targetId: "spare",
          type: "calls",
        },
      ],
    });
    const planId = proposed.plan.id,
      detail = () => api(`/api/plans/${planId}`);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "typescript", exact: true }),
    ).toBeVisible();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Browse routes", exact: true })
      .selectOption(chain.id);
    await page.getByRole("button", { name: "Next step", exact: true }).click();
    await openSourceDrawer(page);
    await expect(page.locator(".inspector-content h2")).toHaveText("A");
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Browse routes", exact: true })
      .selectOption(walk.id);
    await openSourceDrawer(page);
    await expect(page.locator(".inspector-content h2")).toHaveText(
      "requestWithRetry",
    );
    // A second group shares a member without changing file ownership.
    await openAdvancedNavigation(page);
    await page
      .getByRole("button", { name: "Manage groups", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await page
      .getByLabel("Group title", { exact: true })
      .fill("Shared membership");
    await page.getByText("Choose loaded functions", { exact: true }).click();
    await page.getByRole("checkbox", { name: /requestWithRetry/ }).check();
    await page
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Shared membership", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Directory scope", { exact: true }).fill("services");
    await page
      .getByLabel("Responsibility", { exact: true })
      .fill("Reuse existing request behavior");
    await page
      .getByLabel("Forbidden dependencies (one directory per line)", {
        exact: true,
      })
      .fill("internal");
    await page
      .getByRole("button", { name: "Save directory policy", exact: true })
      .click();
    await expect
      .poll(async () => (await detail()).plan.revision)
      .toBe(proposed.plan.revision + 2);
    expect((await mcp.call("get_groups", args)).items).toHaveLength(2);
    expect((await mcp.call("get_folder_policies", args)).items[0].purpose).toBe(
      "Reuse existing request behavior",
    );
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .selectOption(planId);
    const save = async (action) => {
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/plans/${planId}`) &&
          r.request().method() === "PUT",
      );
      await action();
      const result = await (await response).json();
      await expect(page.locator(".plan-status strong")).toContainText(
        `r${result.plan.revision}`,
      );
      return result;
    };
    // Reconnect the proposed call from spare helper to the user's existing B.
    await clickEdge("plan:new-call");
    await page
      .getByRole("combobox", { name: "Target function", exact: true })
      .selectOption(node("requestWithRetry").id);
    await save(() =>
      page
        .getByRole("button", { name: "Save reconnected relation", exact: true })
        .click(),
    );
    // Remove unnecessary temporary helper through its real node controls.
    await page.getByRole("button", { name: "Fit view", exact: true }).click();
    await page.locator('.react-flow__node[data-id="plan:spare"]').click();
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await save(() =>
      page
        .getByRole("button", {
          name: "Delete temporary function and its planned edges",
          exact: true,
        })
        .click(),
    );
    expect(
      (await detail()).plan.operations.some((o) => o.tempId === "spare"),
    ).toBe(false);
    // Add then undo/redo a meaningful new-function intent, and remove it again.
    const addForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Add function", exact: true }),
    });
    await addForm
      .getByLabel("Function name", { exact: true })
      .fill("historyProbe");
    await addForm
      .getByLabel("Target file (repository relative)", { exact: true })
      .fill("probe.ts");
    await save(() =>
      page.getByRole("button", { name: "Add function", exact: true }).click(),
    );
    const count = (await detail()).plan.operations.length;
    await save(() =>
      page.getByRole("button", { name: "Undo", exact: true }).click(),
    );
    expect((await detail()).plan.operations).toHaveLength(count - 1);
    await save(() =>
      page.getByRole("button", { name: "Redo", exact: true }).click(),
    );
    expect((await detail()).plan.operations).toHaveLength(count);
    await save(() =>
      page.getByRole("button", { name: "Undo", exact: true }).click(),
    );
    await page.getByRole("button", { name: "Fit view", exact: true }).click();
    await page.locator('.react-flow__node[data-id="plan:notes"]').click();
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    const editForm = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Save function intent",
        exact: true,
      }),
    });
    await editForm
      .getByLabel("Target file (repository relative)", { exact: true })
      .fill("services/notes.ts");
    await save(() =>
      page
        .getByRole("button", { name: "Save function intent", exact: true })
        .click(),
    );
    await page
      .getByText("Node description / constraints", { exact: true })
      .click();
    await page
      .getByLabel("Annotation text", { exact: true })
      .fill("Preserve retry behavior; human review required");
    await save(() =>
      page.getByRole("button", { name: "Add annotation", exact: true }).click(),
    );
    // Reconnect an actual existing A call: removal intent and B target must coexist.
    await openCodeNavigation(page);
    await page
      .getByRole("button", { name: /ƒ caller/ })
      .first()
      .click();
    await openSourceDrawer(page);
    await page
      .getByRole("button", { name: "Expand one level", exact: true })
      .click();
    await clickEdge(`fact:${callA.id}`);
    await page
      .getByRole("combobox", { name: "Source function", exact: true })
      .selectOption(node("caller").id);
    await page
      .getByRole("combobox", { name: "Target function", exact: true })
      .selectOption(node("requestWithRetry").id);
    await save(() =>
      page
        .getByRole("button", { name: "Save reconnected relation", exact: true })
        .click(),
    );
    expect((await detail()).plan.operations).toEqual(
      expect.arrayContaining([
        { kind: "remove_relation", relationId: callA.id },
      ]),
    );
    const reconnectTarget = page
      .locator(`.code-card[data-domain-id="${node("requestWithRetry").id}"]`)
      .first();
    await expect(reconnectTarget).toBeVisible();
    await expect(reconnectTarget).toContainText("requestWithRetry");
    await expect(reconnectTarget).toContainText(
      node("requestWithRetry").filePath,
    );
    await page
      .getByRole("button", { name: "Validate plan", exact: true })
      .click();
    await expect(page.locator('.banner[role="status"]')).toContainText(
      "Validation complete",
    );
    await expect(
      page
        .locator(".plan-editor .warning")
        .filter({ hasText: "COMPATIBILITY_UNKNOWN" })
        .first(),
    ).toBeVisible();
    await page
      .locator(".plan-editor .warning")
      .filter({ hasText: "COMPATIBILITY_UNKNOWN" })
      .first()
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(screenshots, "compatibility-warning.png"),
      fullPage: true,
    });
    const validationIssues = await mcp.call("validate_plan", {
      projectId: project.id,
      planId: (await detail()).plan.id,
    });
    expect(
      validationIssues.some(
        (issue) =>
          issue.code === "COMPATIBILITY_UNKNOWN" &&
          issue.severity === "warning",
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Confirm current revision", exact: true })
      .click();
    await expect(
      page.getByText("✓ Current approval valid", { exact: true }),
    ).toBeVisible();
    const beforeKnowledge = await detail();
    expect(beforeKnowledge.valid).toBe(true);
    const [policy] = await api(`/api/projects/${project.id}/policies`);
    await page
      .getByRole("combobox", {
        name: "Directory responsibilities",
        exact: true,
      })
      .selectOption(policy.id);
    await page
      .getByLabel("Forbidden dependencies (one directory per line)", {
        exact: true,
      })
      .fill("requests.ts");
    await page
      .getByRole("button", { name: "Save directory policy", exact: true })
      .click();
    await expect
      .poll(async () => (await detail()).plan.revision)
      .toBe(beforeKnowledge.plan.revision + 1);
    const prohibited = await detail();
    expect(prohibited.valid).toBe(false);
    expect(prohibited.approval).toEqual(beforeKnowledge.approval);
    expect(
      prohibited.issues.some((issue) => issue.code === "FORBIDDEN_DEPENDENCY"),
    ).toBe(true);
    await page
      .getByLabel("Forbidden dependencies (one directory per line)", {
        exact: true,
      })
      .fill("internal");
    await page
      .getByLabel("Responsibility", { exact: true })
      .fill("Reuse requests; reviewed policy version");
    await page
      .getByRole("button", { name: "Save directory policy", exact: true })
      .click();
    await expect
      .poll(async () => (await detail()).plan.revision)
      .toBe(beforeKnowledge.plan.revision + 2);
    expect(
      (await mcp.call("get_approved_plan", { ...args, planId })).valid,
    ).toBe(false);
    await page
      .getByRole("button", { name: "Confirm current revision", exact: true })
      .click();
    await expect(
      page.getByText("✓ Current approval valid", { exact: true }),
    ).toBeVisible();
    const approved = await detail();
    expect(approved.valid).toBe(true);
    const originalView = await api(`/api/projects/${project.id}/view`);
    const card = page.locator(
      `.react-flow__node[data-id="fact:${node("caller").id}"]`,
    );
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 35, box.y + 55, {
      steps: 10,
    });
    await page.mouse.up();
    await expect
      .poll(async () =>
        JSON.stringify(
          (await api(`/api/projects/${project.id}/view`)).positions,
        ),
      )
      .not.toBe(JSON.stringify(originalView.positions));
    expect(await detail()).toEqual(approved);
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await page
      .getByLabel("Plan title", { exact: true })
      .fill("Reviewed notes plan");
    const changed = await save(() =>
      page
        .getByRole("button", {
          name: "Save title and description",
          exact: true,
        })
        .click(),
    );
    expect(changed.valid).toBe(false);
    expect(changed.plan.revision).toBe(approved.plan.revision + 1);
    await page
      .getByRole("button", { name: "Confirm current revision", exact: true })
      .click();
    await expect(
      page.getByText("✓ Current approval valid", { exact: true }),
    ).toBeVisible();
    const final = await detail();
    evidence.approval = final.approval;
    for (const format of ["JSON", "Markdown"]) {
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: `Export ${format}`, exact: true })
        .click();
      const download = await downloadPromise,
        content = await readFile(await download.path(), "utf8");
      expect(content).toContain("Reviewed notes plan");
      expect(content).toContain("services/notes.ts");
      if (format === "JSON")
        expect(JSON.parse(content).approval.semanticHash).toBe(
          final.approval.semanticHash,
        );
      evidence[`export${format}`] = {
        bytes: Buffer.byteLength(content),
        name: download.suggestedFilename(),
      };
    }
    expect(await mcp.call("get_approved_plan", { ...args, planId })).toEqual(
      final,
    );
    await f.assertNotExecuted();
    await page.getByRole("button", { name: "Fit view", exact: true }).click();
    await expect(
      page
        .locator(`.code-card[data-domain-id="${node("requestWithRetry").id}"]`)
        .first(),
    ).toBeInViewport();
    await page.screenshot({
      path: join(screenshots, "desktop-light.png"),
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
      path: join(screenshots, "desktop-dark.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 760, height: 1000 });
    await page.getByRole("button", { name: "Fit view", exact: true }).click();
    await page.screenshot({
      path: join(screenshots, "narrow.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await expect
      .poll(async () => (await api(`/api/projects/${project.id}/view`)).theme)
      .toBe("dark");
    await mcp.client.close();
    mcp = undefined;
    const port = server.port;
    await server.stop();
    server = await startProduction(join(root, "data"), port);
    mcp = await connectMcp(server.url);
    await page.reload();
    await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .selectOption(planId);
    await expect(
      page.getByText(final.approval.semanticHash, { exact: true }),
    ).toBeVisible();
    expect(await mcp.call("get_approved_plan", { ...args, planId })).toEqual(
      final,
    );
    expect((await mcp.call("get_groups", args)).items).toHaveLength(2);
    // Source implementation begins only after real approval + restart checks.
    await mkdir(join(f.ts, "services"));
    await writeFile(
      join(f.ts, "services/notes.ts"),
      'import { requestWithRetry } from "../requests";\nexport function fetchNotes() { return requestWithRetry(); }\n',
    );
    await writeFile(
      join(f.ts, "main.ts"),
      callerSource.replace("return A();", "return requestWithRetry();"),
    );
    const satisfied = await mcp.call("verify_implementation", {
      ...args,
      planId,
    });
    expect(satisfied.items.filter((i) => i.status === "unmet")).toEqual([]);
    expect(
      satisfied.items.filter((i) => i.status === "satisfied").length,
    ).toBeGreaterThanOrEqual(4);
    expect(satisfied.items.find((i) => i.status === "unknown").message).toMatch(
      /annotation|human/i,
    );
    evidence.satisfied = satisfied;
    await page
      .getByRole("button", { name: "Refresh code", exact: true })
      .click();
    await openCodeNavigation(page);
    await page
      .getByRole("combobox", { name: "Browse routes", exact: true })
      .selectOption(chain.id);
    await expect(page.getByText(/Route uses an older snapshot/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next step", exact: true }),
    ).toBeDisabled();
    await writeFile(
      join(f.ts, "services/notes.ts"),
      'import { A } from "../requests";\nexport function fetchNotes() { return A(); }\n',
    );
    const bypass = await mcp.call("verify_implementation", { ...args, planId });
    expect(
      bypass.items.some((i) => i.status === "unmet" && i.evidence.length > 0),
    ).toBe(true);
    evidence.bypass = bypass;
    await page
      .getByRole("button", { name: "Implementation check", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Check approved implementation",
        exact: true,
      })
      .click();
    await expect(page.locator(".verification.unmet")).toHaveCount(1);
    await writeFile(
      join(f.ts, "services/notes.ts"),
      "export function fetchNotes(fn: () => string) { return fn(); }\n",
    );
    const unknown = await mcp.call("verify_implementation", {
      ...args,
      planId,
    });
    expect(
      unknown.items.some(
        (i) =>
          i.status === "unknown" &&
          i.evidence.some((e) => e.includes("services/notes.ts")),
      ),
    ).toBe(true);
    evidence.unknown = unknown;
    // A different language/project clears the previous plan and source selection.
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Local project path" })
      .fill(f.python);
    await page
      .getByRole("button", { name: "Open and index", exact: true })
      .click();
    await expect(page.locator(".project-heading h1")).toHaveText("python");
    await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
    await openCodeNavigation(page);
    await page.getByRole("button", { name: /ƒ entry/ }).click();
    await openSourceDrawer(page);
    await expect(page.getByTestId("source-snippet")).toContainText(
      "return helper()",
    );
    await page
      .getByRole("button", { name: "Expand one level", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Choose plan", exact: true }),
    ).toHaveValue("");
    const python = (await api("/api/projects")).find(
      (p) => p.path === f.python,
    );
    expect(
      (await mcp.call("search_functions", { projectId: python.id, q: "entry" }))
        .items,
    ).toHaveLength(1);
    await page
      .getByRole("combobox", { name: "Switch project", exact: true })
      .selectOption(project.id);
    await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
    await f.assertNotExecuted();
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    expect(mcp.stderr()).toBe("");
  } finally {
    await writeFile(
      join(screenshots, "joint-flow-evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    await testInfo.attach("joint-flow-evidence", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
    await mcp?.client.close();
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
