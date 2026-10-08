import { afterEach, expect, test, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import { createServer } from "../server.js";
import { startProcess } from "./process.js";
import type { AgentRunnerFactory, ChatRun } from "./types.js";
const fixture = fileURLToPath(
  new URL("./test-fixtures/cli.mjs", import.meta.url),
);
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
  vi.unstubAllEnvs();
});
async function setup(mode?: string) {
  const root = await mkdtemp(join(tmpdir(), "atlas-agent-routes-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const storage = new SqliteStorage(join(root, "store.sqlite"));
  cleanup.push(async () => storage.close());
  const service = new WorkspaceService({
    storage,
    indexer: new SourceIndexer(),
  });
  await mkdir(join(root, "a"));
  await mkdir(join(root, "b"));
  await writeFile(
    join(root, "a", "main.ts"),
    "export function entry(){return 1;}",
  );
  await writeFile(
    join(root, "b", "other.ts"),
    "export function other(){return 2;}",
  );
  const a = await service.openProject(join(root, "a")),
    b = await service.openProject(join(root, "b"));
  const factory: AgentRunnerFactory = () => ({
    status: async () => ({
      provider: "codex",
      configured: true,
      available: true,
    }),
    start: async (context, emit) =>
      startProcess(
        {
          command: process.execPath,
          args: [fixture, mode!, context.apiUrl, context.projectId],
          cwd: root,
          prompt: context.prompt,
          provider: "codex",
          graceMs: 40,
        },
        emit,
      ),
  });
  const app = await createServer({
    service,
    ...(mode ? { agentRunnerFactory: factory } : {}),
  });
  cleanup.push(() => app.close());
  return { app, service, a, b, root };
}
async function terminal(
  app: Awaited<ReturnType<typeof createServer>>,
  id: string,
  runId: string,
) {
  for (let i = 0; i < 200; i++) {
    const run = (
      await app.inject(`/api/projects/${id}/chat/${runId}`)
    ).json<ChatRun>();
    if (run.status !== "running") return run;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("test run did not settle");
}
test("production defaults disconnected and POST gives explicit error with no invented answer", async () => {
  vi.stubEnv("CODEMAP_AGENT_PROVIDER", undefined);
  const { app, a } = await setup();
  expect((await app.inject("/api/agent/status")).json()).toMatchObject({
    provider: null,
    configured: false,
    available: false,
  });
  const rejected = await app.inject({
    method: "POST",
    url: `/api/projects/${a.id}/chat`,
    payload: { channel: "plan", message: "create" },
  });
  expect(rejected.statusCode).toBe(503);
  expect(rejected.json()).toMatchObject({ code: "AGENT_UNAVAILABLE" });
  expect(rejected.json().messages).toBeUndefined();
});
test("real process failure keeps committed draft without JSONL completion", async () => {
  const { app, service, a, b } = await setup("mutatefail");
  const first = await app.inject({
    method: "POST",
    url: `/api/projects/${a.id}/chat`,
    payload: { channel: "plan", message: "draft" },
  });
  expect(first.statusCode).toBe(200);
  const final = await terminal(app, a.id, first.json().runId);
  expect(final.status).toBe("failed");
  expect(final.messages).toEqual([]);
  expect(final.changedPlanIds).toHaveLength(1);
  expect(final.mayHaveSavedChanges).toBe(true);
  expect(service.getPlan(final.changedPlanIds[0]!).plan.title).toBe(
    "native fixture saved draft",
  );
  expect(
    (await app.inject(`/api/projects/${b.id}/chat/${final.runId}`)).statusCode,
  ).toBe(404);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/api/projects/${b.id}/chat/${final.runId}/cancel`,
      })
    ).statusCode,
  ).toBe(404);
});
test("cancel waits actual process cleanup and gateway journal even before tool events", async () => {
  const { app, service, a } = await setup("mutatehang");
  const start = await app.inject({
    method: "POST",
    url: `/api/projects/${a.id}/chat`,
    payload: { channel: "plan", message: "save" },
  });
  for (let i = 0; i < 150 && service.listPlans(a.id).length === 0; i++)
    await new Promise((r) => setTimeout(r, 10));
  expect(service.listPlans(a.id)).toHaveLength(1);
  const cancelled = await app.inject({
    method: "POST",
    url: `/api/projects/${a.id}/chat/${start.json().runId}/cancel`,
  });
  expect(cancelled.json()).toMatchObject({
    status: "cancelled",
    mayHaveSavedChanges: true,
  });
  expect(cancelled.json().changedPlanIds).toHaveLength(1);
});
test("server close awaits running owned subprocess and rejects unsafe HTTP input", async () => {
  const { app, a } = await setup("hang");
  for (const body of [
    { channel: "plan", message: "x", command: "/bad" },
    { channel: "plan", message: "x".repeat(4097) },
    { channel: "unknown", message: "x" },
  ])
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/projects/${a.id}/chat`,
          payload: body,
        })
      ).statusCode,
    ).toBe(400);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/api/projects/${a.id}/chat`,
        headers: { host: "evil.example" },
        payload: { channel: "plan", message: "x" },
      })
    ).statusCode,
  ).toBe(403);
  const start = await app.inject({
    method: "POST",
    url: `/api/projects/${a.id}/chat`,
    payload: { channel: "plan", message: "x" },
  });
  expect(start.statusCode).toBe(200);
  await app.close();
});
test("test-only native protocol runs actual production scoped stdio MCP against the owned HTTP gateway", async () => {
  const { app, service, a } = await setup("mcpdraft");
  const started = await app.inject({
    method: "POST",
    url: `/api/projects/${a.id}/chat`,
    payload: { channel: "plan", message: "create a draft via real MCP" },
  });
  const run = await terminal(app, a.id, started.json().runId);
  expect(run.status).toBe("completed");
  expect(run.changedPlanIds).toHaveLength(1);
  expect(run.activity).toContainEqual({
    tool: "propose_plan",
    status: "completed",
  });
  expect(service.getPlan(run.changedPlanIds[0]!).plan.title).toBe(
    "actual scoped MCP draft",
  );
  expect(service.getPlan(run.changedPlanIds[0]!).plan.status).toBe("draft");
});
