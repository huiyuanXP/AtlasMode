import { test, expect, type Page } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import {
  createServer,
  type AgentRunner,
  type AgentContext,
} from "@codemap/server";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
async function choose(page: Page, id: string) {
  await page
    .getByRole("combobox", { name: /切换项目|Switch project/, exact: true })
    .selectOption(id);
  await expect(page.locator(".chat-explore")).toBeVisible();
}
test("actual disconnected provider shows conversation shell and retains failed input; source and advanced controls are opt-in", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-chat-disconnected-"));
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "real-project");
    await mkdir(target);
    await writeFile(
      join(target, "entry.ts"),
      "export function entry(){return 1;}\n",
    );
    const previousProvider = process.env.CODEMAP_AGENT_PROVIDER;
    const previousCommand = process.env.CODEMAP_AGENT_COMMAND;
    try {
      process.env.CODEMAP_AGENT_PROVIDER = "codex";
      process.env.CODEMAP_AGENT_COMMAND = join(root, "absent-agent-command");
      server = await startProduction(join(root, "data"));
    } finally {
      if (previousProvider === undefined)
        delete process.env.CODEMAP_AGENT_PROVIDER;
      else process.env.CODEMAP_AGENT_PROVIDER = previousProvider;
      if (previousCommand === undefined)
        delete process.env.CODEMAP_AGENT_COMMAND;
      else process.env.CODEMAP_AGENT_COMMAND = previousCommand;
    }
    await page.goto(server.url);
    await expect(
      page.getByRole("textbox", { name: "本地项目路径" }),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "打开项目", exact: true }).click();
    await page.getByRole("textbox", { name: "本地项目路径" }).fill(target);
    await page.getByRole("button", { name: "打开并索引", exact: true }).click();
    await expect(page.locator(".project-heading h1")).toHaveText(
      "real-project",
    );
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
    const left = page.getByRole("region", {
        name: "Explore code",
        exact: true,
      }),
      right = page.getByRole("region", { name: "Discuss a plan", exact: true });
    await expect(left).toContainText("Local Agent disconnected");
    await expect(right).toContainText("Local Agent disconnected");
    await expect(
      page.getByLabel("New plan title", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Create group", exact: true }),
    ).toHaveCount(0);
    await left
      .getByRole("textbox", { name: "Message Agent" })
      .fill("Where does retry begin?");
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/chat") && r.request().method() === "POST",
    );
    await left.getByRole("button", { name: "Send", exact: true }).click();
    expect((await response).status()).toBe(503);
    await expect(left.getByRole("alert")).toContainText(
      "Local Agent unavailable",
    );
    await expect(
      left.getByRole("textbox", { name: "Message Agent" }),
    ).toHaveValue("Where does retry begin?");
    await expect(left.locator(".chat-message.assistant")).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Search functions", exact: true })
      .fill("entry");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: /ƒ entry/ }).click();
    await expect(page.getByTestId("source-snippet")).toHaveCount(0);
    await page
      .getByRole("button", { name: "View source", exact: true })
      .click();
    await expect(page.getByTestId("source-snippet")).toContainText("return 1");
    await page
      .getByRole("button", { name: "Back to chat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await expect(
      page.getByLabel("New plan title", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Back to chat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Advanced controls", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Create group", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Advanced controls", exact: true })
      .click();
    const out = resolve("artifacts/e2e/agent-chat");
    await mkdir(out, { recursive: true });
    await page.screenshot({ path: join(out, "light.png"), fullPage: true });
    await page
      .getByRole("button", { name: "Toggle light/dark", exact: true })
      .click();
    await page.screenshot({ path: join(out, "dark.png"), fullPage: true });
    await page.setViewportSize({ width: 430, height: 900 });
    await page.screenshot({ path: join(out, "narrow.png"), fullPage: true });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const narrowPlanInput = right.getByRole("textbox", {
      name: "Message Agent",
    });
    await narrowPlanInput.scrollIntoViewIfNeeded();
    await expect(narrowPlanInput).toBeInViewport();
    await narrowPlanInput.fill("Review this plan on a small screen");
    await expect(narrowPlanInput).toHaveValue(
      "Review this plan on a small screen",
    );
    await page.screenshot({
      path: join(out, "narrow-plan.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await testInfo.attach("provider-truth", {
      body: JSON.stringify(await http(server.url, "/api/agent/status")),
      contentType: "application/json",
    });
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});

test("labeled trusted test adapter streams through real bridge, journals drafts, focuses changes, cancels partial work and isolates projects", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-chat-adapter-"));
  let app;
  let storage: SqliteStorage | undefined;
  const seen: AgentContext[] = [],
    stopped: string[] = [],
    errors: string[] = [],
    external: string[] = [];
  let releaseProposal = () => {};
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  try {
    storage = new SqliteStorage(join(root, "data.sqlite"));
    const service = new WorkspaceService({
      storage,
      indexer: new SourceIndexer(),
    });
    const projects = [];
    for (const name of ["a", "b"]) {
      const target = join(root, name);
      await mkdir(target);
      await writeFile(
        join(target, "entry.ts"),
        "export function entry(){return 1;}\n",
      );
      projects.push(await service.openProject(target));
    }
    const runner: AgentRunner = {
      status: async () => ({
        provider: "codex",
        configured: true,
        available: true,
      }),
      start: async (c, emit) => {
        seen.push(c);
        let finishStop = () => {};
        let stoppedRun = false;
        const stopWait = new Promise<void>((r) => {
          finishStop = r;
        });
        const done = (async () => {
          emit({
            type: "activity",
            tool: "get_project_summary",
            status: "completed",
          });
          emit({
            type: "message",
            text: "Test adapter: reading the current project.",
          });
          if (c.input.message === "wait") {
            await stopWait;
            return { ok: false as const, code: "TEST_CANCELLED" };
          }
          if (c.input.message === "propose")
            await new Promise<void>((r) => {
              releaseProposal = r;
            });
          if (stoppedRun) return { ok: false as const, code: "TEST_CANCELLED" };
          const title =
            c.input.message === "partial" ? "Partial test draft" : "Test draft";
          const created = await http(c.apiUrl, "/api/plans", "POST", {
            projectId: c.projectId,
            title,
            baselineSnapshotId: c.input.snapshotId,
          });
          const operations = [
            {
              kind: "add_function",
              tempId: "new-a",
              name: "fetchNotes",
              filePath: "src/notes.ts",
            },
            {
              kind: "add_function",
              tempId: "new-b",
              name: "formatNotes",
              filePath: "src/notes.ts",
            },
            {
              kind: "add_relation",
              id: "new-edge",
              sourceId: "new-a",
              targetId: "new-b",
              type: "calls",
            },
          ];
          await http(c.apiUrl, `/api/plans/${created.plan.id}`, "PUT", {
            expectedRevision: created.plan.revision,
            operations,
          });
          emit({ type: "activity", tool: "propose_plan", status: "completed" });
          emit({
            type: "message",
            text: `Test adapter: ${title} saved for review.`,
          });
          if (c.input.message === "partial") {
            await stopWait;
            return { ok: false as const, code: "TEST_CANCELLED" };
          }
          return { ok: true as const };
        })();
        return {
          done,
          stop: async () => {
            stoppedRun = true;
            stopped.push(c.projectId);
            finishStop();
            releaseProposal();
            await done;
          },
        };
      },
    };
    app = await createServer({
      service,
      webRoot: resolve("apps/web/dist"),
      agentRunnerFactory: () => runner,
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const url = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
    await http(url, `/api/projects/${projects[0].id}/view`, "PUT", {
      positions: {},
      theme: "light",
      locale: "en",
    });
    await http(url, `/api/projects/${projects[1].id}/view`, "PUT", {
      positions: {},
      theme: "light",
      locale: "en",
    });
    await page.goto(url);
    await choose(page, projects[0].id);
    const right = page.getByRole("region", {
        name: "Discuss a plan",
        exact: true,
      }),
      left = page.getByRole("region", { name: "Explore code", exact: true });
    await expect(right).toContainText("Local Agent ready");
    await right.getByRole("textbox", { name: "Message Agent" }).fill("propose");
    await right.getByRole("button", { name: "Send", exact: true }).click();
    await expect(right).toContainText("Test adapter: reading");
    await right
      .getByRole("textbox", { name: "Message Agent" })
      .fill("next draft");
    await left
      .getByRole("textbox", { name: "Message Agent" })
      .fill("explore draft");
    releaseProposal();
    await expect(
      page.getByRole("combobox", { name: "Choose plan", exact: true }),
    ).not.toHaveValue("");
    await expect(page.locator(".plan-overview")).toContainText("fetchNotes");
    await expect(right).toContainText("Test draft saved");
    await expect(
      right.getByRole("textbox", { name: "Message Agent" }),
    ).toHaveValue("next draft");
    await expect(
      page.getByRole("navigation", { name: "Location", exact: true }),
    ).toContainText("Affected objects 2");
    await expect
      .poll(async () => {
        const canvas = await page.locator(".canvas-shell").boundingBox();
        if (!canvas) return false;
        for (const id of ["plan:new-a", "plan:new-b"]) {
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
    const plans = await http(url, `/api/projects/${projects[0].id}/plans`);
    expect(plans[0].plan.status).toBe("draft");
    expect(plans[0].approval).toBeUndefined();
    expect(seen[0].projectId).toBe(projects[0].id);
    expect(seen[0].input.channel).toBe("plan");
    expect(seen[0].input.snapshotId).toBeDefined();
    await right.getByRole("textbox", { name: "Message Agent" }).fill("partial");
    await right.getByRole("button", { name: "Send", exact: true }).click();
    await expect(right).toContainText("Partial test draft saved");
    await right.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(right).toContainText("Stopped");
    await expect(page.locator(".plan-overview h2")).toHaveText(
      "Partial test draft",
    );
    await expect(
      right.getByRole("textbox", { name: "Message Agent" }),
    ).toHaveValue("partial");
    await left.getByRole("textbox", { name: "Message Agent" }).fill("wait");
    await left.getByRole("button", { name: "Send", exact: true }).click();
    await expect(left).toContainText("Test adapter: reading");
    await choose(page, projects[1].id);
    await expect(left.locator(".chat-message")).toHaveCount(0);
    await expect(
      left.getByRole("textbox", { name: "Message Agent" }),
    ).toHaveValue("");
    await expect.poll(() => stopped.length).toBe(2);
    await choose(page, projects[0].id);
    await expect(
      right.getByRole("textbox", { name: "Message Agent" }),
    ).toHaveValue("partial");
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await testInfo.attach("test-adapter-scope", {
      body: JSON.stringify({
        label:
          "Trusted simulated model adapter; actual HTTP gateway/storage journal mutations",
        inputs: seen.map((c) => ({ projectId: c.projectId, input: c.input })),
        stopped,
      }),
      contentType: "application/json",
    });
  } finally {
    await app?.close();
    storage?.close();
    await rm(root, { recursive: true, force: true });
  }
});
