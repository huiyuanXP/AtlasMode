import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import {
  DomainError,
  type CodeSnapshot,
  type IndexerPort,
} from "@codemap/core";
import type { FastifyInstance } from "fastify";
import * as server from "./server.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function setup(options: { web?: boolean; indexer?: IndexerPort } = {}) {
  expect(server.createServer).toBeTypeOf("function");
  const root = await mkdtemp(join(tmpdir(), "atlas-http-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const first = join(root, "first"),
    second = join(root, "second");
  await mkdir(first);
  await mkdir(second);
  await writeFile(
    join(first, "main.ts"),
    "export function entry() { helper(); dynamic(); }\nfunction helper() { return 1; }\n",
  );
  await writeFile(
    join(second, "main.ts"),
    "export function alternate() { return 2; }\n",
  );
  const storage = new SqliteStorage(join(root, "data.sqlite"));
  cleanups.push(async () => storage.close());
  const service = new WorkspaceService({
    storage,
    indexer: options.indexer ?? new SourceIndexer(),
  });
  let webRoot: string | undefined;
  if (options.web) {
    webRoot = join(root, "web");
    await mkdir(webRoot);
    await writeFile(join(webRoot, "index.html"), "<main>Built UI</main>");
    await writeFile(join(webRoot, "asset.js"), 'console.log("asset");');
  }
  const app: FastifyInstance = await server.createServer({ service, webRoot });
  cleanups.push(() => app.close());
  const request = async (
    method: "GET" | "POST" | "PUT",
    url: string,
    payload?: unknown,
  ) =>
    app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
  const open = async (path: string) => {
    const response = await request("POST", "/api/projects", { path });
    expect(response.statusCode).toBe(200);
    return response.json();
  };
  return { root, first, second, storage, service, app, request, open };
}
// Removing project-scoped route glue, validation, async freshness, or real source safety breaks these tests.
test("health and project opening expose real indexed projects without choosing cwd implicitly", async () => {
  const { request, open, first, second } = await setup();
  expect((await request("GET", "/api/health")).json()).toEqual({
    status: "ok",
  });
  expect((await request("GET", "/api/projects")).json()).toEqual([]);
  const a = await open(first),
    b = await open(second);
  expect(a.path).toBe(first);
  expect(a.id).not.toBe(b.id);
  expect((await request("GET", "/api/projects")).json()).toHaveLength(2);
  expect(
    (await request("GET", `/api/projects/${a.id}/snapshot`))
      .json()
      .nodes.some((n: { name: string }) => n.name === "entry"),
  ).toBe(true);
  expect(
    (await request("GET", `/api/projects/${b.id}/snapshot`))
      .json()
      .nodes.some((n: { name: string }) => n.name === "alternate"),
  ).toBe(true);
});
test("search, function context, summary, and bounded subgraph use real facts", async () => {
  const { request, open, first } = await setup();
  const p = await open(first);
  const base = `/api/projects/${p.id}`;
  const search = (
    await request("GET", `${base}/functions?q=MAIN&limit=1&offset=0`)
  ).json();
  expect(search).toMatchObject({
    total: 2,
    limit: 1,
    offset: 0,
    dataSource: "code",
    snapshotId: p.snapshotId,
  });
  expect(search.items[0].name).toBe("entry");
  const context = (
    await request(
      "GET",
      `${base}/functions/${search.items[0].id}?limit=1&offset=1`,
    )
  ).json();
  expect(context).toMatchObject({
    totalOutgoing: 2,
    totalIncoming: 0,
    truncated: true,
    limit: 1,
    offset: 1,
  });
  expect(context.outgoing).toHaveLength(1);
  const summary = (await request("GET", `${base}/summary`)).json();
  expect(summary.entrypoints.map((n: { name: string }) => n.name)).toEqual([
    "entry",
  ]);
  expect(summary.counts.calls).toEqual({
    resolved: 1,
    unresolved: 1,
    external: 0,
  });
  const graph = (
    await request("POST", `${base}/subgraph`, {
      nodeIds: [search.items[0].id],
      budget: 1,
    })
  ).json();
  expect(graph.nodes).toHaveLength(1);
  expect(graph.truncated).toBe(true);
});
test("unknown and foreign node IDs are rejected for context and subgraph, even under small budget", async () => {
  const { request, open, first, second } = await setup();
  const a = await open(first),
    b = await open(second);
  const foreign = (
    await request("GET", `/api/projects/${b.id}/functions`)
  ).json().items[0].id;
  const own = (await request("GET", `/api/projects/${a.id}/functions`)).json()
    .items[0].id;
  expect(
    (await request("GET", `/api/projects/${a.id}/functions/${foreign}`))
      .statusCode,
  ).toBe(404);
  expect(
    (
      await request("POST", `/api/projects/${a.id}/subgraph`, {
        nodeIds: [own, foreign],
        budget: 1,
      })
    ).statusCode,
  ).toBe(404);
  expect(
    (await request("GET", "/api/projects/missing/snapshot")).statusCode,
  ).toBe(404);
});
test("source reads are scoped per project and reject traversal, absolute paths, and symlink escapes", async () => {
  const { request, open, first, second } = await setup();
  const a = await open(first),
    b = await open(second);
  expect(
    (
      await request("GET", `/api/projects/${a.id}/source?filePath=main.ts`)
    ).json().content,
  ).toContain("helper");
  expect(
    (
      await request("GET", `/api/projects/${b.id}/source?filePath=main.ts`)
    ).json().content,
  ).toContain("alternate");
  for (const path of ["../second/main.ts", second, "C:\\secret.ts"])
    expect(
      (
        await request(
          "GET",
          `/api/projects/${a.id}/source?filePath=${encodeURIComponent(path)}`,
        )
      ).statusCode,
    ).toBe(400);
  await symlink(join(second, "main.ts"), join(first, "escape.ts"), "file");
  expect(
    (await request("GET", `/api/projects/${a.id}/source?filePath=escape.ts`))
      .statusCode,
  ).toBe(400);
  expect(
    (await request("GET", `/api/projects/${a.id}/source?filePath=missing.ts`))
      .statusCode,
  ).toBe(404);
});
test("invalid JSON, unknown fields, duplicate or invalid query numbers, and unsupported graph types fail 400", async () => {
  const { app, request, open, first } = await setup();
  const p = await open(first),
    base = `/api/projects/${p.id}`;
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/projects",
        headers: { "content-type": "application/json" },
        payload: "{",
      })
    ).statusCode,
  ).toBe(400);
  for (const query of [
    "limit=201",
    "limit=0",
    "offset=-1",
    "limit=1.5",
    "offset=wat",
    "limit=1&limit=2",
    "extra=1",
    "limit=",
  ])
    expect(
      (await request("GET", `${base}/functions?${query}`)).statusCode,
    ).toBe(400);
  expect(
    (await request("POST", "/api/projects", { path: first, extra: true }))
      .statusCode,
  ).toBe(400);
  expect(
    (await request("POST", "/api/projects", { path: "" })).statusCode,
  ).toBe(400);
  for (const body of [
    { nodeIds: [] },
    { nodeIds: ["none"], budget: 301 },
    { nodeIds: ["none"], depth: 6 },
    { nodeIds: ["none"], relationTypes: ["must_call"] },
    { nodeIds: ["none"], extra: true },
  ])
    expect((await request("POST", `${base}/subgraph`, body)).statusCode).toBe(
      400,
    );
});
test("plan lifecycle preserves revision checks and verifies actually refreshed implementation", async () => {
  const { request, open, first } = await setup();
  const p = await open(first);
  let detail = (
    await request("POST", "/api/plans", {
      projectId: p.id,
      title: "Add feature",
      baselineSnapshotId: p.snapshotId,
    })
  ).json();
  const id = detail.plan.id;
  expect(detail.valid).toBe(false);
  expect((await request("POST", `/api/plans/${id}/verify`)).statusCode).toBe(
    409,
  );
  detail = (
    await request("PUT", `/api/plans/${id}`, {
      expectedRevision: 1,
      operations: [
        {
          kind: "add_function",
          tempId: "planned:new",
          name: "newFeature",
          filePath: "feature.ts",
        },
      ],
    })
  ).json();
  expect(detail.plan.revision).toBe(2);
  expect(
    (
      await request("PUT", `/api/plans/${id}`, {
        expectedRevision: 1,
        operations: [],
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (await request("POST", `/api/plans/${id}/approve`, { expectedRevision: 1 }))
      .statusCode,
  ).toBe(409);
  expect((await request("POST", `/api/plans/${id}/validate`)).json()).toEqual(
    [],
  );
  const approved = (
    await request("POST", `/api/plans/${id}/approve`, { expectedRevision: 2 })
  ).json();
  expect(approved).toMatchObject({
    valid: true,
    approval: { revision: 2, actor: "user" },
    plan: { status: "approved" },
  });
  await writeFile(
    join(first, "feature.ts"),
    "export function newFeature() { return 3; }",
  );
  const verified = (await request("POST", `/api/plans/${id}/verify`)).json();
  expect(verified.items[0].status).toBe("satisfied");
  expect(verified.snapshotId).not.toBe(p.snapshotId);
  expect((await request("GET", `/api/plans/${id}`)).json()).toMatchObject({
    valid: false,
    plan: { status: "stale" },
  });
  expect(
    (await request("GET", `/api/projects/${p.id}/plans`)).json(),
  ).toHaveLength(1);
  const json = await request("GET", `/api/plans/${id}/export?format=json`);
  expect(json.headers["content-type"]).toContain("application/json");
  expect(json.json().approval.revision).toBe(2);
  const markdown = await request(
    "GET",
    `/api/plans/${id}/export?format=markdown`,
  );
  expect(markdown.headers["content-type"]).toContain("text/markdown");
  expect(markdown.body).toContain("Add feature");
  expect(
    (await request("GET", `/api/plans/${id}/export?format=xml`)).statusCode,
  ).toBe(400);
});
test("approval refresh detects source changes and createPlan rejects an old baseline", async () => {
  const { request, open, first } = await setup();
  const p = await open(first);
  const detail = (
    await request("POST", "/api/plans", { projectId: p.id, title: "Change" })
  ).json();
  await writeFile(
    join(first, "main.ts"),
    "export function changed() { return 5; }",
  );
  expect(
    (
      await request("POST", `/api/plans/${detail.plan.id}/approve`, {
        expectedRevision: 1,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await request("POST", "/api/plans", {
        projectId: p.id,
        title: "Old",
        baselineSnapshotId: p.snapshotId,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (await request("POST", `/api/projects/${p.id}/refresh`)).json().contentHash,
  ).not.toBe(detail.plan.baselineContentHash);
});
test("plan invalid references are explicit issues and cannot be approved", async () => {
  const { request, open, first, second } = await setup();
  const a = await open(first),
    b = await open(second);
  const foreign = (
    await request("GET", `/api/projects/${b.id}/functions`)
  ).json().items[0].id;
  const plan = (
    await request("POST", "/api/plans", { projectId: a.id, title: "Invalid" })
  ).json().plan;
  expect(
    (
      await request("PUT", `/api/plans/${plan.id}`, {
        expectedRevision: 1,
        operations: [{ kind: "remove_function", nodeId: foreign }],
      })
    ).json().issues[0].severity,
  ).toBe("error");
  expect(
    (
      await request("POST", `/api/plans/${plan.id}/approve`, {
        expectedRevision: 2,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await request("PUT", `/api/plans/${plan.id}`, {
        expectedRevision: 2,
        operations: [{ kind: "remove_function", nodeId: foreign, extra: "x" }],
      })
    ).statusCode,
  ).toBe(400);
});
test("routes carry evidence, groups policies and view persist with strict project isolation", async () => {
  const { request, open, first, second } = await setup();
  const a = await open(first),
    b = await open(second),
    base = `/api/projects/${a.id}`;
  const snapshot: CodeSnapshot = (
    await request("GET", `${base}/snapshot`)
  ).json();
  const entry = snapshot.nodes.find((n) => n.name === "entry")!,
    helper = snapshot.nodes.find((n) => n.name === "helper")!,
    relation = snapshot.relations.find(
      (r) => r.type === "calls" && r.targetId === helper.id,
    )!;
  const routeBody = {
    snapshotId: snapshot.id,
    title: "Flow",
    description: "Real calls",
    source: "agent",
    kind: "call_chain",
    steps: [
      { nodeId: entry.id, note: "entry" },
      { nodeId: helper.id, note: "helper", relationId: relation.id },
    ],
  };
  expect((await request("POST", `${base}/routes`, routeBody)).statusCode).toBe(
    200,
  );
  expect((await request("GET", `${base}/routes`)).json()).toHaveLength(1);
  expect(
    (await request("POST", `/api/projects/${b.id}/routes`, routeBody))
      .statusCode,
  ).toBe(400);
  expect(
    (await request("POST", `${base}/routes`, { ...routeBody, projectId: b.id }))
      .statusCode,
  ).toBe(400);
  const group = (
    await request("POST", `${base}/groups`, {
      title: "Capability",
      description: "group",
      source: "user",
      memberIds: [entry.id, helper.id],
    })
  ).json();
  expect((await request("GET", `${base}/groups`)).json()[0].memberIds).toEqual([
    entry.id,
    helper.id,
  ]);
  expect(
    (
      await request("POST", `/api/projects/${b.id}/groups`, {
        id: group.id,
        title: group.title,
        description: group.description,
        source: group.source,
        memberIds: [],
      })
    ).statusCode,
  ).toBe(400);
  const policy = (
    await request("POST", `${base}/policies`, {
      pathPrefix: "src",
      purpose: "rules",
      forbiddenDependencies: ["private"],
    })
  ).json();
  expect((await request("GET", `${base}/policies`)).json()[0].purpose).toBe(
    "rules",
  );
  expect(
    (
      await request("POST", `${base}/policies`, {
        pathPrefix: "../bad",
        purpose: "rules",
        forbiddenDependencies: [],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await request("POST", `/api/projects/${b.id}/policies`, {
        id: policy.id,
        pathPrefix: policy.pathPrefix,
        purpose: policy.purpose,
        forbiddenDependencies: policy.forbiddenDependencies,
      })
    ).statusCode,
  ).toBe(400);
  const view = {
    positions: { [entry.id]: { x: 10, y: 20 } },
    theme: "dark",
    locale: "en",
  };
  expect((await request("PUT", `${base}/view`, view)).json()).toEqual(view);
  expect((await request("GET", `${base}/view`)).json()).toEqual(view);
  expect(
    (await request("GET", `/api/projects/${b.id}/view`)).json().positions,
  ).toEqual({});
  expect(
    (await request("PUT", `${base}/view`, { ...view, extra: true })).statusCode,
  ).toBe(400);
});
test("built web assets and SPA navigation work while unknown API and missing assets stay 404", async () => {
  const { request, app, service } = await setup({ web: true });
  expect((await request("GET", "/")).body).toContain("Built UI");
  expect((await request("GET", "/project/one")).body).toContain("Built UI");
  expect((await request("GET", "/asset.js")).body).toContain("console.log");
  expect((await request("GET", "/missing.js")).statusCode).toBe(404);
  expect((await request("GET", "/api/unknown")).statusCode).toBe(404);
  expect((await request("GET", "/api")).statusCode).toBe(404);
  expect((await request("POST", "/project/one")).statusCode).toBe(404);
  await app.close();
  expect(service.listProjects()).toEqual([]); // Factory does not own injected storage.
});
test("domain failures map actionable unavailable errors and sanitize internal details", async () => {
  for (const [code, status] of [
    ["NOT_FOUND", 404],
    ["INVALID_INPUT", 400],
    ["INVALID_PATH", 400],
    ["PROJECT_MISMATCH", 400],
    ["VALIDATION_FAILED", 400],
    ["REVISION_CONFLICT", 409],
    ["BASELINE_CONFLICT", 409],
    ["NOT_APPROVED", 409],
    ["SOURCE_UNAVAILABLE", 503],
    ["INVALID_SNAPSHOT", 500],
    ["UNEXPECTED", 500],
  ] as const) {
    const { request, first } = await setup({
      indexer: {
        async index() {
          throw new DomainError(code, "private /secret/file detail");
        },
      },
    });
    const response = await request("POST", "/api/projects", { path: first });
    expect(response.statusCode).toBe(status);
    if (status === 500) expect(response.body).not.toContain("private");
  }
});
