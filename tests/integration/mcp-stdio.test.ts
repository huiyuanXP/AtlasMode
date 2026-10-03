import { afterAll, beforeAll, expect, test } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer as netServer } from "node:net";
import { createServer as httpServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  CodeSnapshot,
  PlanDetail,
  Project,
  BrowseRoute,
  FunctionGroup,
} from "@codemap/core";

let root: string, url: string, port: number, api: ChildProcess;
let apiOutput = "";
const clients: {
  client: Client;
  transport: StdioClientTransport;
  stderr: () => string;
}[] = [];
const children: ChildProcess[] = [];
const source =
  "export function A() { return 1; }\nexport function B() { return 2; }\nexport function caller() { return A(); }\nexport function dynamic(fn: () => void) { fn(); }\n";
const entry = resolve("apps/mcp/dist/index.js");

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}
async function startApi() {
  apiOutput = "";
  api = spawn(process.execPath, [resolve("apps/server/dist/index.js")], {
    env: {
      ...process.env,
      CODEMAP_PORT: String(port),
      CODEMAP_DATA_DIR: join(root, "data"),
      CODEMAP_WORKSPACE_ROOT: undefined,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(api);
  api.stdout!.on("data", (data) => {
    apiOutput += data;
  });
  api.stderr!.on("data", (data) => {
    apiOutput += data;
  });
  const until = Date.now() + 10000;
  while (
    Date.now() < until &&
    api.exitCode === null &&
    api.signalCode === null
  ) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch {
      /* wait for listen */
    }
    await new Promise((done) => setTimeout(done, 25));
  }
  expect.fail(`Compiled API failed to start: ${apiOutput}`);
}
async function connect(apiUrl = url) {
  let stderr = "";
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env: { CODEMAP_API_URL: apiUrl },
    stderr: "pipe",
    cwd: tmpdir(),
  });
  transport.stderr!.on("data", (chunk) => {
    stderr += chunk;
  });
  const client = new Client({
    name: "atlas-real-stdio-test",
    version: "1.0.0",
  });
  const run = { client, transport, stderr: () => stderr };
  clients.push(run);
  let failure: unknown;
  try {
    await client.connect(transport, { timeout: 5000 });
  } catch (error) {
    failure = error;
  }
  expect(
    failure,
    `Compiled MCP handshake failed; stderr: ${stderr}`,
  ).toBeUndefined();
  return run;
}
async function http<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  expect(response.ok, JSON.stringify(result)).toBe(true);
  return result as T;
}
async function fixture() {
  const path = await mkdtemp(join(root, "project-"));
  await writeFile(join(path, "main.ts"), source);
  const project = await http<Project>("/api/projects", "POST", { path });
  const snapshot = await http<CodeSnapshot>(
    `/api/projects/${project.id}/snapshot`,
  );
  const node = (name: string) =>
    snapshot.nodes.find((n) => n.kind === "function" && n.name === name)!.id;
  return { path, project, snapshot, node };
}
async function call<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text?: string }[];
  expect(content[0]?.type).toBe("text");
  return {
    value: JSON.parse(content[0]!.text!) as T,
    error: result.isError === true,
  };
}
async function success<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await call<T>(client, name, args);
  expect(result.error, JSON.stringify(result.value)).toBe(false);
  return result.value;
}
beforeAll(async () => {
  // Compile dependencies and the actual executables: exercise shipped JavaScript, never a mock MCP facade.
  for (const workspace of ["core", "storage", "indexer", "service", "server"]) {
    const built = spawnSync(
      process.execPath,
      [
        resolve("node_modules/typescript/bin/tsc"),
        "-p",
        `${workspace === "server" ? "apps" : "packages"}/${workspace}/tsconfig.json`,
      ],
      { encoding: "utf8" },
    );
    expect(built.status, built.stdout + built.stderr).toBe(0);
  }
  const built = spawnSync(
    process.execPath,
    [
      resolve("node_modules/typescript/bin/tsc"),
      "-p",
      "apps/mcp/tsconfig.json",
    ],
    { encoding: "utf8" },
  );
  expect(built.status, built.stdout + built.stderr).toBe(0);
  root = await mkdtemp(join(tmpdir(), "atlas-mcp-"));
  await mkdir(join(root, "data"));
  const listener = netServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  port = (listener.address() as { port: number }).port;
  await new Promise<void>((done) => listener.close(() => done()));
  url = `http://127.0.0.1:${port}`;
  await startApi();
}, 30000);
afterAll(async () => {
  for (const { client } of clients) await client.close();
  for (const child of children) await stop(child);
  if (root) await rm(root, { recursive: true, force: true });
}, 15000);

// Missing registration, hidden approval tools, implicit active project, or unbounded discovery break these contracts.
test("actual SDK discovers exactly the supported tools and pages opened projects from an unrelated cwd", async () => {
  const f = await fixture();
  const { client, stderr } = await connect();
  const listed = await client.listTools();
  expect(listed.tools.map((t) => t.name).sort()).toEqual(
    [
      "list_projects",
      "get_project_summary",
      "search_functions",
      "get_function_context",
      "get_subgraph",
      "propose_route",
      "get_routes",
      "propose_plan",
      "update_plan",
      "validate_plan",
      "get_approved_plan",
      "refresh_index",
      "verify_implementation",
      "propose_group",
      "get_groups",
      "get_folder_policies",
    ].sort(),
  );
  expect(
    listed.tools.find((t) => t.name === "propose_plan")!.inputSchema.required,
  ).toContain("baselineSnapshotId");
  expect(
    listed.tools.find((t) => t.name === "search_functions")!.inputSchema
      .required,
  ).toContain("projectId");
  const page = await success<{
    items: Project[];
    total: number;
    offset: number;
    limit: number;
    truncated: boolean;
  }>(client, "list_projects", { limit: 1 });
  expect(page).toMatchObject({
    items: [{ id: f.project.id }],
    total: 1,
    offset: 0,
    limit: 1,
    truncated: false,
  });
  expect(
    await success(client, "list_projects", { offset: 1, limit: 1 }),
  ).toMatchObject({ items: [], total: 1 });
  const other = await fixture();
  expect(await success(client, "list_projects", { limit: 1 })).toMatchObject({
    items: [{ id: f.project.id }],
    total: 2,
    truncated: true,
  });
  expect(
    await success(client, "list_projects", { offset: 1, limit: 1 }),
  ).toMatchObject({
    items: [{ id: other.project.id }],
    total: 2,
    offset: 1,
    limit: 1,
  });
  expect(stderr()).toBe("");
});

test("SDK query tools retain pagination, budgets, snapshot identity and unresolved call evidence", async () => {
  const f = await fixture(),
    { client } = await connect();
  const args = { projectId: f.project.id };
  expect(await success(client, "get_project_summary", args)).toMatchObject({
    snapshotId: f.snapshot.id,
    dataSource: "code",
    counts: { functions: 4 },
  });
  expect(
    await success(client, "search_functions", { ...args, q: "A", limit: 1 }),
  ).toMatchObject({
    items: [{ name: "A" }],
    snapshotId: f.snapshot.id,
    limit: 1,
  });
  expect(
    await success(client, "get_function_context", {
      ...args,
      nodeId: f.node("dynamic"),
      limit: 1,
    }),
  ).toMatchObject({
    outgoing: [{ resolution: "unresolved" }],
    snapshotId: f.snapshot.id,
  });
  expect(
    await success(client, "get_subgraph", {
      ...args,
      nodeIds: [f.node("caller")],
      budget: 1,
      depth: 2,
    }),
  ).toMatchObject({
    nodes: [{ id: f.node("caller") }],
    truncated: true,
    snapshotId: f.snapshot.id,
  });
  expect(await success(client, "refresh_index", args)).toMatchObject({
    snapshotId: f.snapshot.id,
    contentHash: f.snapshot.contentHash,
  });
  const bad = await call(client, "get_subgraph", {
    ...args,
    nodeIds: ["missing"],
  });
  expect(bad).toMatchObject({
    error: true,
    value: { code: "NOT_FOUND", status: 404 },
  });
});

test("HTTP user approval and SDK share the same revision/hash; draft edits revoke current approval and verification uses history", async () => {
  const f = await fixture(),
    { client } = await connect();
  const operations = [
    {
      kind: "add_relation",
      id: "reuse",
      sourceId: f.node("caller"),
      targetId: f.node("B"),
      type: "must_reuse",
    },
  ];
  const created = await success<PlanDetail>(client, "propose_plan", {
    projectId: f.project.id,
    title: "Use B",
    baselineSnapshotId: f.snapshot.id,
    operations,
  });
  expect(created).toMatchObject({
    valid: false,
    plan: { revision: 2, operations },
  });
  const args = { projectId: f.project.id, planId: created.plan.id };
  const warnings = await success(client, "validate_plan", args);
  expect(warnings).toEqual([
    expect.objectContaining({
      severity: "warning",
      code: "COMPATIBILITY_UNKNOWN",
      operationIndex: 0,
    }),
  ]);
  expect(
    await http(`/api/plans/${created.plan.id}/validate`, "POST", {}),
  ).toEqual(warnings);
  expect(created.issues).toEqual(warnings);
  const approved = await http<PlanDetail>(
    `/api/plans/${created.plan.id}/approve`,
    "POST",
    { expectedRevision: 2 },
  );
  const read = await success<PlanDetail>(client, "get_approved_plan", args);
  expect(read).toEqual(approved);
  expect(read.valid).toBe(true);
  expect(read.issues).toEqual(warnings);
  expect(read.approval!.semanticHash).toMatch(/^[a-f0-9]{64}$/);
  await success(client, "update_plan", {
    ...args,
    expectedRevision: 2,
    operations: [
      { kind: "annotate", targetId: f.node("A"), text: "draft only" },
    ],
  });
  expect(await success(client, "get_approved_plan", args)).toMatchObject({
    valid: false,
    plan: { status: "draft", revision: 3 },
  });
  await writeFile(
    join(f.path, "main.ts"),
    source.replace("return A();", "return B();"),
  );
  expect(await success(client, "verify_implementation", args)).toMatchObject({
    revision: 2,
    items: [{ status: "satisfied" }],
  });
});

test("get_approved_plan refreshes disk before trusting approval and stale explicit baselines conflict", async () => {
  const f = await fixture(),
    { client } = await connect();
  const created = await success<PlanDetail>(client, "propose_plan", {
    projectId: f.project.id,
    title: "Reviewed",
    baselineSnapshotId: f.snapshot.id,
    operations: [],
  });
  await http(`/api/plans/${created.plan.id}/approve`, "POST", {
    expectedRevision: 1,
  });
  await writeFile(join(f.path, "main.ts"), source + "// changed on disk\n");
  expect(
    await success(client, "get_approved_plan", {
      projectId: f.project.id,
      planId: created.plan.id,
    }),
  ).toMatchObject({ valid: false, plan: { status: "stale" } });
  expect(
    await call(client, "propose_plan", {
      projectId: f.project.id,
      title: "Old baseline",
      baselineSnapshotId: f.snapshot.id,
      operations: [],
    }),
  ).toMatchObject({
    error: true,
    value: { code: "BASELINE_CONFLICT", status: 409 },
  });
});

test("agent routes and new groups are validated, visible over HTTP, paged and marked stale after refresh", async () => {
  const f = await fixture(),
    { client } = await connect();
  const args = { projectId: f.project.id };
  const route = await success<BrowseRoute>(client, "propose_route", {
    ...args,
    snapshotId: f.snapshot.id,
    title: "Explore",
    description: "",
    kind: "walkthrough",
    steps: [{ nodeId: f.node("A"), note: "Entry" }],
  });
  expect(route.source).toBe("agent");
  expect(await http(`/api/projects/${f.project.id}/routes`)).toEqual([route]);
  expect(
    await success(client, "get_routes", { ...args, limit: 1 }),
  ).toMatchObject({
    items: [{ id: route.id, stale: false }],
    snapshotId: f.snapshot.id,
    total: 1,
  });
  const group = await success<FunctionGroup>(client, "propose_group", {
    ...args,
    title: "Reusable",
    description: "",
    memberIds: [f.node("A"), f.node("B")],
  });
  expect(group.source).toBe("agent");
  expect(await http(`/api/projects/${f.project.id}/groups`)).toEqual([group]);
  expect(
    await success(client, "get_groups", { ...args, offset: 1, limit: 1 }),
  ).toMatchObject({ items: [], total: 1 });
  expect(await success(client, "get_folder_policies", args)).toMatchObject({
    items: [],
    total: 0,
  });
  expect(
    await call(client, "propose_group", {
      ...args,
      title: "Wrong",
      description: "",
      memberIds: ["missing"],
    }),
  ).toMatchObject({ error: true });
  const other = await fixture();
  expect(
    await call(client, "propose_route", {
      ...args,
      snapshotId: f.snapshot.id,
      title: "Foreign",
      description: "",
      kind: "walkthrough",
      steps: [{ nodeId: other.node("A"), note: "" }],
    }),
  ).toMatchObject({ error: true });
  await writeFile(join(f.path, "main.ts"), source + "// stale route\n");
  await success(client, "refresh_index", args);
  expect(await success(client, "get_routes", args)).toMatchObject({
    items: [{ id: route.id, stale: true }],
  });
});

test("schemas reject forged source/approval, absent baseline and invalid limits; HTTP domain conflicts remain actionable", async () => {
  const f = await fixture(),
    { client } = await connect();
  const args = { projectId: f.project.id };
  for (const [name, input] of [
    ["search_functions", { ...args, limit: 201 }],
    ["get_subgraph", { ...args, nodeIds: [f.node("A")], budget: 301 }],
    ["propose_plan", { ...args, title: "No baseline", operations: [] }],
    [
      "propose_plan",
      {
        ...args,
        title: "Forged",
        baselineSnapshotId: f.snapshot.id,
        operations: [],
        status: "approved",
      },
    ],
    [
      "propose_group",
      {
        ...args,
        title: "User?",
        description: "",
        memberIds: [],
        source: "user",
      },
    ],
    [
      "propose_group",
      {
        ...args,
        title: "Overwrite?",
        description: "",
        memberIds: [],
        id: "existing",
      },
    ],
    [
      "propose_route",
      {
        ...args,
        snapshotId: f.snapshot.id,
        title: "User?",
        description: "",
        kind: "walkthrough",
        steps: [],
        source: "user",
      },
    ],
  ] as const)
    expect((await client.callTool({ name, arguments: input })).isError).toBe(
      true,
    );
  expect(
    await call(client, "get_project_summary", { projectId: "missing" }),
  ).toMatchObject({ error: true, value: { code: "NOT_FOUND", status: 404 } });
  const plan = await success<PlanDetail>(client, "propose_plan", {
    ...args,
    title: "Concurrent",
    baselineSnapshotId: f.snapshot.id,
    operations: [],
  });
  expect(
    await call(client, "update_plan", {
      ...args,
      planId: plan.plan.id,
      expectedRevision: 2,
      operations: [],
    }),
  ).toMatchObject({
    error: true,
    value: { code: "REVISION_CONFLICT", status: 409 },
  });
  const other = await fixture();
  expect(
    await call(client, "get_approved_plan", {
      projectId: other.project.id,
      planId: plan.plan.id,
    }),
  ).toMatchObject({ error: true, value: { code: "NOT_FOUND" } });
});

test("a newly connected SDK client reads retained approval/routes/groups after actual HTTP process restart", async () => {
  const f = await fixture(),
    first = await connect();
  const args = { projectId: f.project.id };
  const plan = await success<PlanDetail>(first.client, "propose_plan", {
    ...args,
    title: "Persist",
    baselineSnapshotId: f.snapshot.id,
    operations: [],
  });
  const approval = await http<PlanDetail>(
    `/api/plans/${plan.plan.id}/approve`,
    "POST",
    { expectedRevision: 1 },
  );
  const group = await success<FunctionGroup>(first.client, "propose_group", {
    ...args,
    title: "Persisted group",
    description: "",
    memberIds: [f.node("A")],
  });
  const route = await success<BrowseRoute>(first.client, "propose_route", {
    ...args,
    snapshotId: f.snapshot.id,
    title: "Persisted route",
    description: "",
    kind: "walkthrough",
    steps: [{ nodeId: f.node("A"), note: "" }],
  });
  await first.client.close();
  expect(first.transport.pid).toBeNull();
  await stop(api);
  await startApi();
  const next = await connect();
  expect(
    await success(next.client, "get_approved_plan", {
      ...args,
      planId: plan.plan.id,
    }),
  ).toMatchObject({
    valid: false,
    plan: { revision: 2, status: "draft" },
    approval: approval.approval,
  });
  expect(await success(next.client, "get_groups", args)).toMatchObject({
    items: [group],
  });
  expect(await success(next.client, "get_routes", args)).toMatchObject({
    items: [{ ...route, stale: false }],
  });
}, 15000);

test("HTTP connection failure is an honest tool error and SDK close leaves no MCP process", async () => {
  const run = await connect("http://127.0.0.1:1");
  expect(await call(run.client, "list_projects", {})).toMatchObject({
    error: true,
    value: { code: "API_UNAVAILABLE" },
  });
  const pid = run.transport.pid!;
  await run.client.close();
  expect(run.transport.pid).toBeNull();
  expect(() => process.kill(pid, 0)).toThrow();
});

test("a real concurrent HTTP edit between create and update exposes the retained partial draft id/revision", async () => {
  const f = await fixture();
  // A transparent HTTP relay makes another user's edit at the actual shared service deterministic.
  const relay = httpServer(async (request, reply) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const response = await fetch(`${url}${request.url}`, {
      method: request.method,
      headers: { "content-type": "application/json" },
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const text = await response.text();
    if (request.url === "/api/plans" && response.ok) {
      const created = JSON.parse(text) as PlanDetail;
      await http(`/api/plans/${created.plan.id}`, "PUT", {
        expectedRevision: 1,
        operations: [],
        title: "User edit won",
      });
    }
    reply.writeHead(response.status, { "content-type": "application/json" });
    reply.end(text);
  });
  relay.listen(0, "127.0.0.1");
  await once(relay, "listening");
  try {
    const run = await connect(
      `http://127.0.0.1:${(relay.address() as { port: number }).port}`,
    );
    const result = await call<{
      code: string;
      status: number;
      createdPlanId: string;
      createdRevision: number;
    }>(run.client, "propose_plan", {
      projectId: f.project.id,
      baselineSnapshotId: f.snapshot.id,
      title: "Agent proposal",
      operations: [
        { kind: "annotate", targetId: f.node("A"), text: "proposed" },
      ],
    });
    expect(result).toMatchObject({
      error: true,
      value: { code: "REVISION_CONFLICT", status: 409, createdRevision: 1 },
    });
    expect(
      await http(`/api/plans/${result.value.createdPlanId}`),
    ).toMatchObject({
      plan: { revision: 2, title: "User edit won", operations: [] },
      valid: false,
    });
    expect(await http(`/api/projects/${f.project.id}/plans`)).toHaveLength(1);
  } finally {
    await new Promise<void>((done) => relay.close(() => done()));
  }
});

test("malformed stdio input and stdin EOF terminate cleanly with protocol-only stdout", async () => {
  for (const malformed of [true, false]) {
    const child = spawn(process.execPath, [entry], {
      env: { ...process.env, CODEMAP_API_URL: url },
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.push(child);
    let stdout = "",
      stderr = "";
    child.stdout!.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr!.on("data", (chunk) => {
      stderr += chunk;
    });
    const exited = once(child, "exit");
    if (malformed) child.stdin!.write("this is not JSON\n");
    else child.stdin!.end();
    expect((await exited)[0]).toBe(malformed ? 1 : 0);
    expect(stdout).toBe("");
    expect(stderr.length > 0).toBe(malformed);
  }
}, 10000);

test("transport failure cancels an in-flight HTTP request instead of retaining the child until its timeout", async () => {
  let received!: () => void;
  const requested = new Promise<void>((done) => {
    received = done;
  });
  const stalled = httpServer((_request, _reply) => {
    received();
  });
  stalled.listen(0, "127.0.0.1");
  await once(stalled, "listening");
  try {
    const run = await connect(
      `http://127.0.0.1:${(stalled.address() as { port: number }).port}`,
    );
    const pending = run.client
      .callTool({ name: "list_projects", arguments: {} })
      .catch((error: unknown) => error);
    await requested;
    const closed = new Promise<void>((done) => {
      run.client.onclose = done;
    });
    // Public SDK transport API with a malformed wire message triggers the real server's transport error path.
    await run.transport.send({ invalid: true } as never);
    await closed;
    expect(run.transport.pid).toBeNull();
    expect(await pending).toBeInstanceOf(Error);
    expect(run.stderr()).toContain("transport failed");
  } finally {
    stalled.closeAllConnections();
    await new Promise<void>((done) => stalled.close(() => done()));
  }
}, 5000);
