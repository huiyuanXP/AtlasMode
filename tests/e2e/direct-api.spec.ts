import { test, expect } from "@playwright/test";
import { createServer as createHttpServer } from "node:http";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";

// Local HTTP protocol fixture, real compiled production adapter + SDK + SQLite.
// No real model, account, CLI, remote API or paid request is involved.
test("Responses API fixture through real browser send, streamed draft and cancel", async ({
  page,
  context,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), "atlas-direct-browser-"));
  const fixtureKey = "test-only-not-a-real-credential";
  const sentinel = join(root, "executed");
  const requests: Record<string, unknown>[] = [],
    errors: string[] = [],
    external: string[] = [],
    browserProviderCalls: string[] = [];
  const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
  const provider = createHttpServer(async (req, res) => {
    try {
      expect(req.url).toBe("/v1/responses");
      expect(req.headers.authorization).toBe("Bearer " + fixtureKey);
      let body = "";
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);
      requests.push(payload);
      const prompt = payload.input[0].content;
      const captured = JSON.parse(prompt.match(/\nContext: ([^\n]+)/)[1]);
      const user = JSON.parse(prompt.match(/\nUser message: ([^\n]+)/)[1]);
      const count = payload.input.filter(
        (item: { type?: string }) => item.type === "function_call_output",
      ).length;
      res.writeHead(200, { "content-type": "text/event-stream" });
      if (user === "hold" && count === 1) {
        res.write(
          event({
            type: "response.output_text.delta",
            output_index: 0,
            content_index: 0,
            delta: "HTTP fixture: draft saved; waiting for cancellation.",
          }),
        );
        return;
      }
      if (count === 0) {
        const name = user === "hold" ? "propose_plan" : "get_project_summary";
        const args =
          user === "hold"
            ? {
                projectId: captured.projectId,
                baselineSnapshotId: captured.snapshotId,
                title: "Direct API partial fixture draft",
                operations: [],
              }
            : { projectId: captured.projectId };
        res.end(
          event({
            type: "response.completed",
            response: {
              status: "completed",
              output: [
                {
                  type: "function_call",
                  call_id: "call_1",
                  id: "fc_1",
                  name,
                  arguments: JSON.stringify(args),
                  status: "completed",
                },
              ],
            },
          }),
        );
      } else if (count === 1) {
        const last = payload.input.at(-1);
        const summary = JSON.parse(JSON.parse(last.output).content[0].text);
        res.end(
          event({
            type: "response.completed",
            response: {
              status: "completed",
              output: [
                {
                  type: "function_call",
                  call_id: "call_2",
                  id: "fc_2",
                  name: "propose_plan",
                  arguments: JSON.stringify({
                    projectId: captured.projectId,
                    baselineSnapshotId: summary.snapshotId,
                    title: "Direct API fixture draft",
                    operations: [
                      {
                        kind: "add_function",
                        tempId: "fixture-note",
                        name: "fixtureNote",
                        filePath: "src/notes.ts",
                      },
                    ],
                  }),
                  status: "completed",
                },
              ],
            },
          }),
        );
      } else {
        const answer = "HTTP fixture: unapproved draft saved through real MCP.";
        res.write(
          event({
            type: "response.output_text.delta",
            output_index: 0,
            content_index: 0,
            delta: answer.slice(0, 20),
          }),
        );
        res.write(
          event({
            type: "response.output_text.delta",
            output_index: 0,
            content_index: 0,
            delta: answer.slice(20),
          }),
        );
        res.end(
          event({
            type: "response.completed",
            response: {
              status: "completed",
              output: [
                {
                  type: "message",
                  role: "assistant",
                  content: [{ type: "output_text", text: answer }],
                },
              ],
            },
          }),
        );
      }
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end("fixture failed");
    }
  });
  let server: Awaited<ReturnType<typeof startProduction>> | undefined;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/v1/responses"))
      browserProviderCalls.push(request.url());
  });
  await denyExternalRequests(context, external);
  try {
    await new Promise<void>((resolve) =>
      provider.listen(0, "127.0.0.1", resolve),
    );
    const providerUrl = `http://127.0.0.1:${(provider.address() as { port: number }).port}/v1`;
    const fixtureEnv = {
      CODEMAP_AGENT_PROVIDER: "responses",
      CODEMAP_AGENT_MODEL: "fixture-model",
      CODEMAP_AGENT_API_BASE_URL: providerUrl,
      CODEMAP_AGENT_API_KEY_ENV: "ATLAS_DIRECT_FIXTURE_KEY",
      ATLAS_DIRECT_FIXTURE_KEY: fixtureKey,
    };
    const previous = Object.fromEntries(
      Object.keys(fixtureEnv).map((key) => [key, process.env[key]]),
    );
    try {
      Object.assign(process.env, fixtureEnv);
      server = await startProduction(join(root, "data"));
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    const target = join(root, "direct-fixture-project");
    await mkdir(target);
    await writeFile(
      join(target, "main.ts"),
      `import {writeFileSync} from "node:fs"; writeFileSync(${JSON.stringify(sentinel)}, "executed"); export function entry(){return 1;}`,
    );
    const project = await http(server.url, "/api/projects", "POST", {
      path: target,
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: /切换项目|Switch project/, exact: true })
      .selectOption(project.id);
    await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
    await page.locator(".planning-disclosure > summary").click();
    const panel = page.getByRole("region", {
      name: "Discuss a plan",
      exact: true,
    });
    await expect(panel).toContainText("Responses API");
    await expect(panel).toContainText("fixture-model");
    await panel.getByRole("textbox", { name: "Message Agent" }).fill("draft");
    const posted = page.waitForResponse(
      (response) =>
        response.url().endsWith("/chat") &&
        response.request().method() === "POST",
    );
    await panel.getByRole("button", { name: "Send", exact: true }).click();
    const start = await (await posted).json();
    await expect(panel).toContainText(
      "HTTP fixture: unapproved draft saved through real MCP.",
    );
    await expect(
      panel.getByRole("button", { name: "Stop", exact: true }),
    ).not.toBeVisible();
    const completed = await http(
      server.url,
      `/api/projects/${project.id}/chat/${start.runId}`,
    );
    expect(completed.status).toBe("completed");
    expect(completed.changedPlanIds).toHaveLength(1);
    const draft = await http(
      server.url,
      `/api/plans/${completed.changedPlanIds[0]}`,
    );
    expect(draft.plan.status).toBe("draft");
    expect(draft.plan.revision).toBe(2);
    expect(draft.approval).toBeUndefined();
    expect(draft.plan.operations[0].name).toBe("fixtureNote");
    await page.screenshot({
      path: testInfo.outputPath("direct-completed.png"),
      fullPage: true,
    });
    await panel.getByRole("textbox", { name: "Message Agent" }).fill("hold");
    const holdingPost = page.waitForResponse(
      (response) =>
        response.url().endsWith("/chat") &&
        response.request().method() === "POST",
    );
    await panel.getByRole("button", { name: "Send", exact: true }).click();
    const holding = await (await holdingPost).json();
    await expect(panel).toContainText(
      "HTTP fixture: draft saved; waiting for cancellation.",
    );
    const cancelledResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/${holding.runId}/cancel`),
    );
    await panel.getByRole("button", { name: "Stop", exact: true }).click();
    const cancelled = await (await cancelledResponse).json();
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.changedPlanIds).toHaveLength(1);
    expect(cancelled.mayHaveSavedChanges).toBe(true);
    await expect(panel).toContainText("Stopped");
    await page.screenshot({
      path: testInfo.outputPath("direct-cancelled.png"),
      fullPage: true,
    });
    expect(JSON.stringify(requests)).not.toContain(fixtureKey);
    expect(
      JSON.stringify(await http(server.url, "/api/agent/status")),
    ).not.toContain(fixtureKey);
    await expect(access(sentinel)).rejects.toThrow();
    expect(browserProviderCalls).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await testInfo.attach("fixture-truth", {
      body: JSON.stringify({
        provider: "local HTTP Responses fixture",
        realProviderVerified: false,
        model: "fixture-model",
        completed,
        cancelled,
        requestCount: requests.length,
      }),
      contentType: "application/json",
    });
  } finally {
    await server?.stop();
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
