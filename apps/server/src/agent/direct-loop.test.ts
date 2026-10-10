import { afterEach, expect, test, vi } from "vitest";
import { createServer as httpServer, type ServerResponse } from "node:http";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  access,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import { createServer } from "../server.js";
import { createResponsesRunner, type ResponsesOptions } from "./direct.js";
import type { ChatRun } from "./types.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const fixtureKey = "test-only-not-a-real-credential";
type Payload = {
  input: Record<string, unknown>[];
  tools: { type: string; name: string; parameters: unknown }[];
  [key: string]: unknown;
};
const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const call = (name: string, args: unknown, id = "call_1") => ({
  type: "function_call",
  id: "fc_" + id,
  call_id: id,
  name,
  arguments: JSON.stringify(args),
  status: "completed",
});
function complete(res: ServerResponse, output: unknown[]) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(
    event({
      type: "response.completed",
      response: { status: "completed", output },
    }),
  );
}
const text = (value = "fixture answer") => [
  {
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text: value }],
  },
];
function toolValue(payload: Payload) {
  const last = payload.input.findLast(
    (item) => item.type === "function_call_output",
  )!;
  const result = JSON.parse(String(last.output));
  return JSON.parse(result.content[0].text);
}
async function fixture(
  handler: (
    payload: Payload,
    res: ServerResponse,
    turn: number,
  ) => void | Promise<void>,
) {
  const requests: Payload[] = [],
    headers: (string | undefined)[] = [];
  let closed = 0;
  const server = httpServer(async (req, res) => {
    try {
      expect(req.url).toBe("/v1/responses");
      expect(req.method).toBe("POST");
      headers.push(req.headers.authorization);
      let body = "";
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body) as Payload;
      requests.push(payload);
      res.on("close", () => closed++);
      await handler(payload, res, requests.length);
    } catch {
      res.writeHead(500);
      res.end("fixture handler failed");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return {
    requests,
    headers,
    closed: () => closed,
    url: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
  };
}
async function setup(url: string, options?: ResponsesOptions) {
  const root = await mkdtemp(join(tmpdir(), "atlas-direct-api-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const sentinel = join(root, "executed");
  const storage = new SqliteStorage(join(root, "data.sqlite"));
  cleanups.push(async () => storage.close());
  const service = new WorkspaceService({
    storage,
    indexer: new SourceIndexer(),
  });
  const projects = [];
  for (const name of ["a", "b", "c"]) {
    const dir = join(root, name);
    await mkdir(dir);
    await writeFile(
      join(dir, "main.ts"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(sentinel)}, "executed"); export function entry(){return 1;}`,
    );
    projects.push(await service.openProject(dir));
  }
  const runner = createResponsesRunner(
    {
      CODEMAP_AGENT_MODEL: "fixture-model",
      CODEMAP_AGENT_API_BASE_URL: url,
      OPENAI_API_KEY: fixtureKey,
    },
    options,
  );
  const app = await createServer({ service, agentRunnerFactory: () => runner });
  cleanups.push(() => app.close());
  const start = async (projectId = projects[0]!.id, channel = "plan") =>
    app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/chat`,
      payload: { channel, message: "Create an unapproved draft" },
    });
  const get = async (runId: string, projectId = projects[0]!.id) =>
    (
      await app.inject({ url: `/api/projects/${projectId}/chat/${runId}` })
    ).json<ChatRun>();
  const wait = async (runId: string) => {
    for (let n = 0; n < 300; n++) {
      const run = await get(runId);
      if (run.status !== "running") return run;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("fixture run did not settle");
  };
  return { app, service, projects, start, get, wait, sentinel };
}
test("real HTTP Responses → SDK scoped MCP → SQLite draft loop, reasoning continuation and source sentinel", async () => {
  const provider = await fixture((payload, res, turn) => {
    const project = scope.projects[0]!;
    if (turn === 1)
      complete(res, [
        { type: "reasoning", encrypted_content: "hidden", summary: [] },
        call("get_project_summary", { projectId: project.id }),
      ]);
    else if (turn === 2) {
      const snapshotId = toolValue(payload).snapshotId;
      complete(res, [
        call(
          "propose_plan",
          {
            projectId: project.id,
            baselineSnapshotId: snapshotId,
            title: "fixture draft",
            operations: [],
          },
          "call_2",
        ),
      ]);
    } else {
      expect(toolValue(payload).plan.status).toBe("draft");
      complete(res, text("draft saved"));
    }
  });
  const scope = await setup(provider.url);
  const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
  expect(run.status).toBe("completed");
  expect(run.messages).toEqual([{ role: "assistant", text: "draft saved" }]);
  expect(run.activity.map((item) => [item.tool, item.status])).toEqual([
    ["get_project_summary", "running"],
    ["get_project_summary", "completed"],
    ["propose_plan", "running"],
    ["propose_plan", "completed"],
  ]);
  expect(run.changedPlanIds).toHaveLength(1);
  const draft = scope.service.getPlan(run.changedPlanIds[0]!).plan;
  expect(draft.status).toBe("draft");
  expect(scope.service.getPlan(draft.id).approval).toBeUndefined();
  expect(run.mayHaveSavedChanges).toBe(true);
  expect(provider.requests).toHaveLength(3);
  for (const payload of provider.requests) {
    expect(payload).toMatchObject({
      store: false,
      stream: true,
      parallel_tool_calls: false,
      max_output_tokens: 4096,
    });
    expect(payload.tools).toHaveLength(18);
    expect(payload.tools.every((tool) => tool.type === "function")).toBe(true);
    expect(JSON.stringify(payload)).not.toContain(fixtureKey);
  }
  expect(
    provider.requests[1]!.input.some((item) => item.type === "reasoning"),
  ).toBe(true);
  expect(provider.headers).toEqual(Array(3).fill("Bearer " + fixtureKey));
  expect(JSON.stringify(run)).not.toContain("hidden");
  await expect(access(scope.sentinel)).rejects.toThrow();
  expect(
    await readFile(join(scope.projects[0]!.path, "main.ts"), "utf8"),
  ).toContain("writeFileSync");
});
test("partial SSE becomes one public message while run is active; cancel aborts owned HTTP", async () => {
  const provider = await fixture((_payload, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(
      event({
        type: "response.output_text.delta",
        output_index: 0,
        content_index: 0,
        delta: "first",
      }),
    );
    res.write(
      event({
        type: "response.output_text.delta",
        output_index: 0,
        content_index: 0,
        delta: " second",
      }),
    );
  });
  const scope = await setup(provider.url);
  const id = (await scope.start()).json<ChatRun>().runId;
  for (let n = 0; n < 100 && !(await scope.get(id)).messages.length; n++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(await scope.get(id)).toMatchObject({
    status: "running",
    messages: [{ role: "assistant", text: "first second" }],
  });
  const cancelled = (
    await scope.app.inject({
      method: "POST",
      url: `/api/projects/${scope.projects[0]!.id}/chat/${id}/cancel`,
    })
  ).json<ChatRun>();
  expect(cancelled.status).toBe("cancelled");
  expect(cancelled.errors).toEqual([]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(provider.closed()).toBe(1);
});
test.each(["cancel", "http-error"])(
  "draft journal survives %s after a successful MCP mutation",
  async (mode) => {
    const provider = await fixture((_payload, res, turn) => {
      if (turn === 1)
        complete(res, [
          call("propose_plan", {
            projectId: scope.projects[0]!.id,
            baselineSnapshotId: scope.service.getSnapshot(scope.projects[0]!.id)
              .id,
            title: "saved first",
            operations: [],
          }),
        ]);
      else if (mode === "http-error") {
        res.writeHead(401);
        res.end("private provider secret " + fixtureKey);
      } else {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.flushHeaders();
      }
    });
    const scope = await setup(provider.url);
    const id = (await scope.start()).json<ChatRun>().runId;
    for (let n = 0; n < 100 && provider.requests.length < 2; n++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    const run =
      mode === "cancel"
        ? (
            await scope.app.inject({
              method: "POST",
              url: `/api/projects/${scope.projects[0]!.id}/chat/${id}/cancel`,
            })
          ).json<ChatRun>()
        : await scope.wait(id);
    expect(run.status).toBe(mode === "cancel" ? "cancelled" : "failed");
    expect(run.changedPlanIds).toHaveLength(1);
    expect(scope.service.getPlan(run.changedPlanIds[0]!).plan.status).toBe(
      "draft",
    );
    expect(run.mayHaveSavedChanges).toBe(true);
    expect(JSON.stringify(run)).not.toContain(fixtureKey);
    expect(provider.requests).toHaveLength(2);
  },
);
test("complete legal foreign project and plan tuple cannot read or mutate", async () => {
  const provider = await fixture((payload, res, turn) => {
    if (turn === 1)
      complete(res, [
        call("update_plan", {
          projectId: scope.projects[1]!.id,
          planId: foreign,
          expectedRevision: 1,
          operations: [],
          title: "attack",
        }),
      ]);
    else {
      expect(toolValue(payload).code).toBe("PROJECT_MISMATCH");
      complete(res, text("scope denied"));
    }
  });
  const scope = await setup(provider.url);
  const foreign = scope.service.createPlan({
    projectId: scope.projects[1]!.id,
    title: "foreign",
  }).plan.id;
  const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
  expect(run.status).toBe("completed");
  expect(run.activity.at(-1)?.status).toBe("failed");
  expect(scope.service.getPlan(foreign).plan).toMatchObject({
    title: "foreign",
    revision: 1,
  });
  expect(run.changedPlanIds).toEqual([]);
  expect(
    (
      await scope.app.inject({
        url: `/api/projects/${scope.projects[1]!.id}/chat/${run.runId}`,
      })
    ).statusCode,
  ).toBe(404);
});
test.each(["shell", "approve_plan", "open_project"])(
  "unlisted native tool %s fails before execution",
  async (name) => {
    const provider = await fixture((_payload, res) =>
      complete(res, [call(name, {})]),
    );
    const scope = await setup(provider.url);
    const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
    expect(run.status).toBe("failed");
    expect(run.errors[0]?.code).toBe("AGENT_UNSAFE_TOOL");
    expect(run.activity).toEqual([]);
    expect(provider.requests).toHaveLength(1);
    await expect(access(scope.sentinel)).rejects.toThrow();
  },
);
test("MCP rejects invalid schema and returns bounded safe tool result to next provider turn", async () => {
  const provider = await fixture((payload, res, turn) => {
    if (turn === 1) complete(res, [call("propose_plan", { arbitrary: "bad" })]);
    else {
      expect(JSON.parse(String(payload.input.at(-1)?.output)).isError).toBe(
        true,
      );
      complete(res, text("invalid request"));
    }
  });
  const scope = await setup(provider.url);
  const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
  expect(run.status).toBe("completed");
  expect(run.activity.at(-1)?.status).toBe("failed");
  expect(run.changedPlanIds).toEqual([]);
});
test.each([
  [{ maxRequests: 1 }, "AGENT_LIMIT"],
  [{ maxTools: 0 }, "AGENT_LIMIT"],
  [{ maxRequestBytes: 20 }, "AGENT_OUTPUT_LIMIT"],
])(
  "provider/tool/request budgets stop without retry",
  async (options, code) => {
    const provider = await fixture((_payload, res) =>
      complete(res, [call("list_projects", {})]),
    );
    const scope = await setup(provider.url, options);
    const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
    expect(run.status).toBe("failed");
    expect(run.errors[0]?.code).toBe(code);
    expect(provider.requests.length).toBeLessThanOrEqual(1);
  },
);
test("timeout aborts stalled provider and returns safe terminal code", async () => {
  const provider = await fixture((_payload, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.flushHeaders();
  });
  const scope = await setup(provider.url, { timeoutMs: 100 });
  const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
  expect(run.status).toBe("failed");
  expect(run.errors[0]?.code).toBe("AGENT_TIMEOUT");
});
test("concurrent direct runs keep existing per-channel and four-run global limits", async () => {
  const provider = await fixture((_payload, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.flushHeaders();
  });
  const scope = await setup(provider.url);
  const project = scope.projects[0]!;
  expect((await scope.start(project.id)).statusCode).toBe(200);
  expect((await scope.start(project.id)).statusCode).toBe(409);
  expect((await scope.start(project.id, "explore")).statusCode).toBe(200);
  expect((await scope.start(scope.projects[1]!.id)).statusCode).toBe(200);
  expect((await scope.start(scope.projects[1]!.id, "explore")).statusCode).toBe(
    200,
  );
  expect((await scope.start(scope.projects[2]!.id)).statusCode).toBe(429);
});
test.each(["duplicate", "malformed", "hosted"])(
  "invalid %s complete batch rejects before any draft dispatch",
  async (mode) => {
    const provider = await fixture((_payload, res) => {
      const draft = call("propose_plan", {
        projectId: scope.projects[0]!.id,
        baselineSnapshotId: scope.service.getSnapshot(scope.projects[0]!.id).id,
        title: "must not save",
        operations: [],
      });
      const invalid =
        mode === "duplicate"
          ? draft
          : mode === "malformed"
            ? { ...call("list_projects", {}, "other"), arguments: "{bad" }
            : { type: "web_search_call", id: "hosted" };
      complete(res, [draft, invalid]);
    });
    const scope = await setup(provider.url);
    const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
    expect(run.status).toBe("failed");
    expect(run.errors[0]?.code).toBe(
      mode === "hosted" ? "AGENT_UNSAFE_TOOL" : "AGENT_PROTOCOL",
    );
    expect(run.changedPlanIds).toEqual([]);
    expect(run.activity).toEqual([]);
  },
);
test("redirect is rejected without forwarding server bearer credentials", async () => {
  let received = 0;
  const target = await fixture((_payload, res) => {
    received++;
    complete(res, text());
  });
  const provider = await fixture((_payload, res) => {
    res.writeHead(307, { location: target.url + "/responses" });
    res.end();
  });
  const scope = await setup(provider.url);
  const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
  expect(run.status).toBe("failed");
  expect(run.errors[0]?.code).toBe("AGENT_FAILED");
  expect(received).toBe(0);
});
test.each(["stream", "tool"])(
  "%s byte limits stop oversized provider or MCP results",
  async (mode) => {
    const provider = await fixture((_payload, res) =>
      complete(res, [call("list_projects", {})]),
    );
    const scope = await setup(
      provider.url,
      mode === "stream" ? { maxOutputBytes: 20 } : { maxToolResultBytes: 20 },
    );
    const run = await scope.wait((await scope.start()).json<ChatRun>().runId);
    expect(run.status).toBe("failed");
    expect(run.errors[0]?.code).toBe("AGENT_OUTPUT_LIMIT");
    expect(provider.requests).toHaveLength(1);
  },
);

// The fixture holds a real forwarded gateway mutation; no MCP/HTTP/SQLite is mocked.
test.each(["cancel", "timeout"])(
  "in-flight MCP %s drains committed journal and never dispatches another tool",
  async (mode) => {
    const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation((ms) =>
        originalTimeout(mode === "timeout" && ms === 30000 ? 100 : ms),
      );
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const dispatched = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const provider = await fixture((_payload, res, turn) => {
      const args = {
        projectId: scope.projects[0]!.id,
        baselineSnapshotId: scope.service.getSnapshot(scope.projects[0]!.id).id,
        title: "held mutation",
        operations: [],
      };
      if (turn === 1)
        complete(res, [
          call("propose_plan", args),
          ...(mode === "cancel"
            ? [
                call(
                  "propose_plan",
                  { ...args, title: "must not dispatch" },
                  "call_2",
                ),
              ]
            : []),
        ]);
      else if (turn === 2)
        complete(res, [
          call("propose_plan", { ...args, title: "must not retry" }, "call_2"),
        ]);
      else complete(res, text());
    });
    const scope = await setup(provider.url);
    const originalInject = scope.app.inject.bind(scope.app);
    let planRequests = 0;
    const injectSpy = vi
      .spyOn(scope.app, "inject")
      .mockImplementation(async (options) => {
        const request = options as { method?: string; url?: string };
        if (
          request.method === "POST" &&
          request.url === "/api/plans" &&
          ++planRequests === 1
        ) {
          entered();
          await held;
        }
        return originalInject(options);
      });
    try {
      const id = (await scope.start()).json<ChatRun>().runId;
      await dispatched;
      const cancel =
        mode === "cancel"
          ? scope.app.inject({
              method: "POST",
              url: `/api/projects/${scope.projects[0]!.id}/chat/${id}/cancel`,
            })
          : undefined;
      await new Promise((resolve) =>
        setTimeout(resolve, mode === "timeout" ? 200 : 20),
      );
      expect((await scope.get(id)).status).toBe("running");
      expect(provider.requests).toHaveLength(1);
      expect(planRequests).toBe(1);
      release();
      const run = cancel
        ? (await cancel).json<ChatRun>()
        : await scope.wait(id);
      expect(run.status).toBe(mode === "cancel" ? "cancelled" : "failed");
      if (mode === "timeout") expect(run.errors[0]?.code).toBe("AGENT_FAILED");
      expect(run.changedPlanIds).toHaveLength(1);
      expect(run.mayHaveSavedChanges).toBe(true);
      expect(provider.requests).toHaveLength(1);
      expect(planRequests).toBe(1);
    } finally {
      release();
      timeoutSpy.mockRestore();
      injectSpy.mockRestore();
    }
  },
);
