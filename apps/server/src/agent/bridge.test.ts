import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import { createServer } from "../server.js";
import { createScopedGateway } from "./gateway.js";
import * as bridge from "./bridge.js";
import type { AgentRunner } from "./types.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanups.splice(0).reverse()) await f();
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "atlas-agent-http-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const storage = new SqliteStorage(join(root, "data.sqlite"));
  cleanups.push(async () => storage.close());
  const service = new WorkspaceService({
    storage,
    indexer: new SourceIndexer(),
  });
  for (const name of ["a", "b"]) {
    await mkdir(join(root, name));
    await writeFile(
      join(root, name, "main.ts"),
      "export function entry(){return 1;}",
    );
  }
  const a = await service.openProject(join(root, "a")),
    b = await service.openProject(join(root, "b"));
  const app = await createServer({ service });
  cleanups.push(() => app.close());
  return { service, app, a, b };
}
test("gateway rejects foreign valid plans, approvals, opening, traversal and channel planning drafts; journals real drafts", async () => {
  const { service, app, a, b } = await setup();
  const foreign = service.createPlan({
    projectId: b.id,
    title: "foreign",
  }).plan;
  const journal = { planIds: new Set<string>(), mutated: false };
  const gateway = await createScopedGateway(
    app,
    service,
    a.id,
    "plan",
    journal,
  );
  cleanups.push(() => gateway.close());
  const request = (path: string, method = "GET", body?: unknown) =>
    fetch(gateway.url + path, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  expect(
    (await (await request("/api/projects")).json()).map(
      (p: { id: string }) => p.id,
    ),
  ).toEqual([a.id]);
  for (const [path, method, body] of [
    [`/api/plans/${foreign.id}`, "GET", undefined],
    ["/api/projects", "POST", { path: b.path }],
    [`/api/plans/${foreign.id}/approve`, "POST", { expectedRevision: 1 }],
    [`/api/projects/${b.id}/groups`, "GET", undefined],
    ["/api/projects/%2e%2e%2fplans", "GET", undefined],
  ])
    expect((await request(path as string, method as string, body)).status).toBe(
      403,
    );
  const created = await (
    await request("/api/plans", "POST", {
      projectId: a.id,
      title: "actual",
      baselineSnapshotId: service.getSnapshot(a.id).id,
    })
  ).json();
  expect(journal.planIds).toEqual(new Set([created.plan.id]));
  expect(service.getPlan(created.plan.id).plan.status).toBe("draft");
  expect(
    (await request(`/api/plans/${created.plan.id}/validate`, "POST", {}))
      .status,
  ).toBe(200);
  expect(
    (await request(`/api/projects/${a.id}/refresh`, "POST", {})).status,
  ).toBe(200);
  expect(
    (await request(`/api/plans/${created.plan.id}/verify`, "POST", {})).status,
  ).toBe(409);
  const explore = await createScopedGateway(app, service, a.id, "explore", {
    planIds: new Set(),
    mutated: false,
  });
  cleanups.push(() => explore.close());
  expect(
    (
      await fetch(explore.url + "/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: a.id, title: "blocked" }),
      })
    ).status,
  ).toBe(200);
});
function runner(start: AgentRunner["start"]): AgentRunner {
  return {
    status: async () => ({
      provider: "codex",
      configured: true,
      available: true,
    }),
    start,
  };
}
test("mutation survives cancellation before tool-completed and retains project isolation", async () => {
  expect(bridge.AgentBridge).toBeTypeOf("function");
  const { service, app, a, b } = await setup();
  let saved!: () => void;
  const committed = new Promise<void>((r) => (saved = r));
  const backend = runner(async (context) => {
    const response = await fetch(context.apiUrl + "/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: a.id,
        title: "saved before cancellation",
      }),
    });
    expect(response.status).toBe(200);
    saved();
    let finish!: (r: { ok: false; code: string }) => void;
    const done = new Promise<{ ok: false; code: string }>((r) => (finish = r));
    return {
      done,
      stop: async () => {
        finish({ ok: false, code: "AGENT_CANCELLED" });
        await done;
      },
    };
  });
  const manager = new bridge.AgentBridge(app, service, backend);
  cleanups.push(() => manager.close());
  const run = await manager.start(a.id, { channel: "plan", message: "draft" });
  await committed;
  expect(() => manager.get(b.id, run.runId)).toThrow();
  await manager.cancel(a.id, run.runId);
  const current = manager.get(a.id, run.runId);
  expect(current.status).toBe("cancelled");
  expect(current.changedPlanIds).toHaveLength(1);
  expect(current.mayHaveSavedChanges).toBe(true);
  expect(service.getPlan(current.changedPlanIds[0]!).plan.title).toBe(
    "saved before cancellation",
  );
});
test("validates fresh snapshot, revisions, project-owned function and captured scope", async () => {
  expect(bridge.AgentBridge).toBeTypeOf("function");
  const { service, app, a, b } = await setup();
  const manager = new bridge.AgentBridge(
    app,
    service,
    runner(async () => {
      throw Error("must not run");
    }),
  );
  cleanups.push(() => manager.close());
  const foreign = service.createPlan({ projectId: b.id, title: "other" }).plan;
  const functionB = service
    .getSnapshot(b.id)
    .nodes.find((n) => n.kind === "function")!.id;
  for (const input of [
    { planId: foreign.id },
    { nodeId: functionB },
    { snapshotId: "old" },
    { scope: { kind: "file", path: "../b/main.ts" } },
    { scope: { kind: "folder", path: "missing" } },
    { scope: { kind: "function", path: "main.ts", nodeId: functionB } },
  ])
    await expect(
      manager.start(a.id, { channel: "plan", message: "x", ...input } as never),
    ).rejects.toThrow();
  const local = service.createPlan({ projectId: a.id, title: "local" }).plan;
  await expect(
    manager.start(a.id, {
      channel: "plan",
      message: "x",
      planId: local.id,
      expectedRevision: local.revision + 1,
    }),
  ).rejects.toThrow();
});
test("enforces one session, four global runs, expiration and bounded history", async () => {
  expect(bridge.AgentBridge).toBeTypeOf("function");
  const { service, app, a, b } = await setup();
  const prompts: string[] = [];
  const manager = new bridge.AgentBridge(
    app,
    service,
    runner(async (context) => {
      prompts.push(context.prompt);
      let finish!: (value: { ok: false; code: string }) => void;
      const done = new Promise<{ ok: false; code: string }>(
        (r) => (finish = r),
      );
      return {
        done,
        stop: async () => {
          finish({ ok: false, code: "AGENT_CANCELLED" });
          await done;
        },
      };
    }),
    { ttlMs: 30 },
  );
  cleanups.push(() => manager.close());
  const first = await manager.start(a.id, { channel: "explore", message: "a" });
  await expect(
    manager.start(a.id, { channel: "explore", message: "busy" }),
  ).rejects.toMatchObject({ statusCode: 409 });
  await manager.start(a.id, { channel: "plan", message: "b" });
  await manager.start(b.id, { channel: "explore", message: "c" });
  await manager.start(b.id, { channel: "plan", message: "d" });
  await expect(
    manager.start("missing", { channel: "plan", message: "global" }),
  ).rejects.toThrow();
  const third = await service.openProject(join(a.path, ".."));
  await expect(
    manager.start(third.id, { channel: "plan", message: "limit" }),
  ).rejects.toMatchObject({ statusCode: 429 });
  await manager.cancel(a.id, first.runId);
  await new Promise((r) => setTimeout(r, 35));
  expect(() => manager.get(a.id, first.runId)).toThrow();
  expect(prompts[0]).toContain(a.id);
});
test("history keeps at most twenty turns and drops oversized old public answers", async () => {
  const { service, app, a } = await setup();
  const histories: unknown[][] = [];
  const manager = new bridge.AgentBridge(
    app,
    service,
    runner(async (context, emit) => {
      histories.push(
        JSON.parse(
          context.prompt
            .split("Recent conversation: ")[1]!
            .split("\nUser message: ")[0]!,
        ),
      );
      emit({ type: "message", text: "answer " + histories.length });
      return { done: Promise.resolve({ ok: true }), stop: async () => {} };
    }),
  );
  cleanups.push(() => manager.close());
  for (let i = 0; i < 23; i++) {
    const run = await manager.start(a.id, {
      channel: "plan",
      message: "turn " + i,
    });
    for (
      let j = 0;
      j < 100 && manager.get(a.id, run.runId).status === "running";
      j++
    )
      await new Promise((r) => setTimeout(r, 1));
  }
  expect(histories[22]).toHaveLength(19);
  expect(histories[22]![0]).toMatchObject({ user: "turn 3" });
  const largeHistories: unknown[][] = [];
  const large = new bridge.AgentBridge(
    app,
    service,
    runner(async (context, emit) => {
      largeHistories.push(
        JSON.parse(
          context.prompt
            .split("Recent conversation: ")[1]!
            .split("\nUser message: ")[0]!,
        ),
      );
      emit({ type: "message", text: "x".repeat(66000) });
      return { done: Promise.resolve({ ok: true }), stop: async () => {} };
    }),
  );
  cleanups.push(() => large.close());
  for (let i = 0; i < 2; i++) {
    const run = await large.start(a.id, { channel: "plan", message: "large" });
    for (
      let j = 0;
      j < 100 && large.get(a.id, run.runId).status === "running";
      j++
    )
      await new Promise((r) => setTimeout(r, 1));
  }
  expect(largeHistories[1]).toEqual([]);
});

test("plan-selected temporary and moved context is accepted as planned, while undeclared or foreign context is rejected", async () => {
  const { service, app, a, b } = await setup();
  let captured = "";
  const manager = new bridge.AgentBridge(
    app,
    service,
    runner(async (context, emit) => {
      captured = context.prompt;
      emit({ type: "message", text: "planned context" });
      return { done: Promise.resolve({ ok: true }), stop: async () => {} };
    }),
  );
  cleanups.push(() => manager.close());
  const fact = service
    .getSnapshot(a.id)
    .nodes.find((n) => n.kind === "function")!;
  const created = service.createPlan({
    projectId: a.id,
    title: "planning",
  }).plan;
  const current = service.updatePlan(created.id, {
    expectedRevision: created.revision,
    operations: [
      {
        kind: "add_function",
        tempId: "temp:new",
        name: "newFn",
        filePath: "future/service.ts",
      },
      { kind: "move_function", nodeId: fact.id, filePath: "future/moved.ts" },
    ],
  }).plan;
  const start = async (extra: Record<string, unknown>) => {
    const run = await manager.start(a.id, {
      channel: "plan",
      message: "discuss planned context",
      planId: current.id,
      expectedRevision: current.revision,
      ...extra,
    } as never);
    for (
      let i = 0;
      i < 100 && manager.get(a.id, run.runId).status === "running";
      i++
    )
      await new Promise((r) => setTimeout(r, 1));
    return run;
  };
  await start({
    nodeId: "temp:new",
    scope: { kind: "function", nodeId: "temp:new", path: "future/service.ts" },
  });
  expect(captured).toContain('"planned":true');
  expect(captured).toContain('"indexed":false');
  await start({
    nodeId: fact.id,
    scope: { kind: "function", nodeId: fact.id, path: "future/moved.ts" },
  });
  expect(captured).toContain('"planned":true');
  await start({ scope: { kind: "folder", path: "future" } });
  expect(captured).toContain('"planned":true');
  await expect(
    manager.start(a.id, {
      channel: "plan",
      message: "x",
      planId: current.id,
      nodeId: "temp:undeclared",
    }),
  ).rejects.toThrow();
  const foreign = service.createPlan({
    projectId: b.id,
    title: "foreign",
  }).plan;
  await expect(
    manager.start(a.id, {
      channel: "plan",
      message: "x",
      planId: foreign.id,
      nodeId: "temp:new",
    }),
  ).rejects.toThrow();
  await expect(
    manager.start(a.id, {
      channel: "plan",
      message: "x",
      scope: { kind: "folder", path: "future" },
    }),
  ).rejects.toThrow();
});
