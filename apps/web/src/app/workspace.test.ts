import { expect, it } from "vitest";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
const reply = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
function fixture(path: string) {
  const id = path.split("/")[3] ?? "a";
  if (path.endsWith("/summary"))
    return {
      project: { id, path: `/${id}`, name: id },
      snapshotId: `s-${id}`,
      contentHash: id,
      counts: {
        files: 1,
        folders: 0,
        functions: 1,
        relations: 0,
        calls: { resolved: 0, unresolved: 0, external: 0 },
      },
      entrypoints: [
        { id: "f", kind: "function", name: "fn", filePath: "a.ts" },
      ],
      entrypointTotal: 1,
      entrypointsTruncated: false,
      diagnostics: [],
      coverage: { files: ["a.ts"], excludedPatterns: [], unresolvedCount: 0 },
      dataSource: "code",
    };
  if (path.endsWith("/subgraph"))
    return {
      nodes: [{ id: "f", kind: "function", name: "fn", filePath: "a.ts" }],
      relations: [],
      snapshotId: `s-${id}`,
      dataSource: "code",
      truncated: false,
    };
  if (path.endsWith("/view"))
    return { positions: {}, theme: "light", locale: "zh" };
  if (path.endsWith("/source?filePath=a.ts"))
    return { filePath: "a.ts", content: "new source" };
  if (path.includes("/functions/"))
    return {
      node: { id: "f", kind: "function", name: "fn", filePath: "a.ts" },
      incoming: [],
      outgoing: [],
      totalIncoming: 0,
      totalOutgoing: 0,
      truncated: false,
      offset: 0,
      limit: 50,
      snapshotId: `s-${id}`,
      dataSource: "code",
    };
  return [];
}
it("switch immediately clears graph, plan, source, route and selection, and late inspector cannot restore them", async () => {
  let resolve!: (value: Response) => void;
  const api = new HttpApi((async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.includes("/projects/a/source"))
      return new Promise<Response>((r) => {
        resolve = r;
      });
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  const pending = app.selectNode({
    id: "f",
    kind: "function",
    name: "fn",
    filePath: "a.ts",
  });
  await app.selectProject({ id: "b", name: "b", path: "/b" });
  expect(app.store.getState()).toMatchObject({
    selectedNode: undefined,
    source: undefined,
    plan: undefined,
    routeId: "",
    context: undefined,
    report: undefined,
  });
  resolve(
    new Response(JSON.stringify({ filePath: "a.ts", content: "old source" })),
  );
  await pending;
  expect(app.store.getState().source).toBeUndefined();
  expect(app.store.getState().project?.id).toBe("b");
});
it("late open path cannot switch away from a newer explicitly selected project", async () => {
  let resolve!: (value: Response) => void;
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (String(input) === "/api/projects" && init?.method === "POST")
      return new Promise<Response>((r) => {
        resolve = r;
      });
    return reply(fixture(String(input)));
  }) as typeof fetch);
  const app = createWorkspace(api);
  const opening = app.openProject("/a");
  await app.selectProject({ id: "b", name: "b", path: "/b" });
  resolve(new Response(JSON.stringify({ id: "a", name: "a", path: "/a" })));
  await opening;
  expect(app.store.getState().project?.id).toBe("b");
});
it("HTTP conflict details remain actionable instead of looking like success", async () => {
  const api = new HttpApi(
    (async () =>
      new Response(
        JSON.stringify({
          code: "REVISION_CONFLICT",
          message: "Refresh the plan.",
        }),
        { status: 409 },
      )) as typeof fetch,
  );
  await expect(api.approve("p", 4)).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
    status: 409,
    message: "Refresh the plan.",
  });
});
it("rapid same-project focus keeps the newer graph, context and source when older responses finish last", async () => {
  let oldGraph!: (value: Response) => void,
    oldSource!: (value: Response) => void;
  let delay = false;
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    if (
      delay &&
      path.endsWith("/subgraph") &&
      JSON.parse(String(init?.body)).nodeIds[0] === "f"
    )
      return new Promise<Response>((r) => {
        oldGraph = r;
      });
    if (delay && path.includes("/source?filePath=a.ts"))
      return new Promise<Response>((r) => {
        oldSource = r;
      });
    if (path.includes("filePath=b.ts"))
      return reply({ filePath: "b.ts", content: "new B" });
    if (delay && path.endsWith("/subgraph"))
      return reply({
        nodes: [{ id: "g", kind: "function", name: "g", filePath: "b.ts" }],
        relations: [],
        snapshotId: "s-a",
        dataSource: "code",
        truncated: false,
      });
    if (path.includes("/functions/g"))
      return reply({
        ...(fixture(path) as object),
        node: { id: "g", kind: "function", name: "g", filePath: "b.ts" },
      });
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  app.store.setState({
    search: {
      items: [{ id: "g", kind: "function", name: "g", filePath: "b.ts" }],
      total: 1,
      offset: 0,
      limit: 50,
      snapshotId: "s-a",
      dataSource: "code",
    },
  });
  delay = true;
  const old = app.focus({
    id: "f",
    kind: "function",
    name: "fn",
    filePath: "a.ts",
  });
  await app.focus({ id: "g", kind: "function", name: "g", filePath: "b.ts" });
  oldGraph(new Response(JSON.stringify(fixture("/api/projects/a/subgraph"))));
  oldSource(
    new Response(JSON.stringify({ filePath: "a.ts", content: "old A" })),
  );
  await old;
  expect(app.store.getState().graph?.nodes[0]?.id).toBe("g");
  expect(app.store.getState().context?.node.id).toBe("g");
  expect(app.store.getState().source?.content).toBe("new B");
});
it("clicking a node while a prior expansion is pending prevents that expansion replacing the current canvas", async () => {
  let resolve!: (value: Response) => void,
    delay = false;
  const api = new HttpApi((async (input: RequestInfo | URL) => {
    const path = String(input);
    if (delay && path.endsWith("/subgraph"))
      return new Promise<Response>((r) => {
        resolve = r;
      });
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  delay = true;
  const pending = app.expand("f");
  await app.selectNode({
    id: "f",
    kind: "function",
    name: "fn",
    filePath: "a.ts",
  });
  resolve(
    new Response(
      JSON.stringify({
        nodes: [{ id: "old", kind: "function", name: "old" }],
        relations: [],
        snapshotId: "s-a",
        dataSource: "code",
        truncated: false,
      }),
    ),
  );
  await pending;
  expect(app.store.getState().graph?.nodes[0]?.id).toBe("f");
});
const planDetail = (operations: import("@codemap/core").Operation[] = []) => ({
  plan: {
    id: "p",
    projectId: "a",
    title: "plan",
    description: "",
    baselineSnapshotId: "s-a",
    baselineContentHash: "a",
    revision: 4,
    operations,
    status: "draft" as const,
    createdAt: "2026-10-02T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
  },
  valid: false,
  issues: [],
});
it("deleting the selected temporary node clears its inspector and preserves server revision authority", async () => {
  let saved: unknown;
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (String(input) === "/api/plans/p" && init?.method === "PUT") {
      saved = JSON.parse(String(init.body));
      return reply({
        ...planDetail(),
        plan: { ...planDetail().plan, revision: 5 },
      });
    }
    return reply(fixture(String(input)));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  app.store.setState({
    plan: planDetail([
      {
        kind: "add_function",
        tempId: "temp:gone",
        name: "gone",
        filePath: "new.ts",
      },
    ]),
    selectedNode: {
      id: "temp:gone",
      kind: "function",
      name: "gone",
      filePath: "new.ts",
    },
  });
  await app.savePlan([]);
  expect(saved).toMatchObject({ expectedRevision: 4, operations: [] });
  expect(app.store.getState().plan?.plan.revision).toBe(5);
  expect(app.store.getState().plan?.valid).toBe(false);
  expect(app.store.getState().selectedNode).toBeUndefined();
});
it("deselecting a plan prevents its earlier response from restoring the selection", async () => {
  let resolve!: (value: Response) => void;
  const api = new HttpApi((async (input: RequestInfo | URL) =>
    String(input) === "/api/plans/p"
      ? new Promise<Response>((r) => {
          resolve = r;
        })
      : reply(fixture(String(input)))) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  const pending = app.choosePlan("p");
  await app.choosePlan("");
  resolve(new Response(JSON.stringify(planDetail())));
  await pending;
  expect(app.store.getState().plan).toBeUndefined();
});
it("selecting a remote plan loads bounded existing-function anchors instead of silently omitting its planned call", async () => {
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    if (path === "/api/plans/p")
      return reply(
        planDetail([
          {
            kind: "add_function",
            tempId: "temp:new",
            name: "new",
            filePath: "new.ts",
          },
          {
            kind: "add_relation",
            id: "temp:e",
            sourceId: "temp:new",
            targetId: "g",
            type: "must_call",
          },
        ]),
      );
    if (
      path.endsWith("/subgraph") &&
      JSON.parse(String(init?.body)).nodeIds.includes("g")
    )
      return reply({
        nodes: [
          {
            id: "g",
            kind: "function",
            name: "existingAnchor",
            filePath: "b.ts",
          },
        ],
        relations: [],
        snapshotId: "s-a",
        dataSource: "code",
        truncated: false,
      });
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  expect(app.store.getState().graph?.nodes[0]?.name).toBe("existingAnchor");
});
it("deselecting a route cancels its delayed focus request", async () => {
  let resolve!: (value: Response) => void,
    delay = false;
  const api = new HttpApi((async (input: RequestInfo | URL) => {
    const path = String(input);
    if (delay && path.endsWith("/subgraph"))
      return new Promise<Response>((r) => {
        resolve = r;
      });
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  app.store.setState({
    routes: [
      {
        id: "route",
        projectId: "a",
        snapshotId: "s-a",
        revision: 1,
        title: "route",
        description: "",
        source: "agent",
        kind: "walkthrough",
        steps: [{ nodeId: "f", note: "start" }],
        createdAt: "2026-10-02T00:00:00Z",
      },
    ],
  });
  delay = true;
  const pending = app.routeStep("route", 0);
  await app.routeStep("", 0);
  resolve(
    new Response(
      JSON.stringify({
        nodes: [
          { id: "f", kind: "function", name: "oldRoute", filePath: "a.ts" },
        ],
        relations: [],
        snapshotId: "s-a",
        dataSource: "code",
        truncated: false,
      }),
    ),
  );
  await pending;
  expect(app.store.getState().selectedNode).toBeUndefined();
  expect(app.store.getState().graph?.nodes[0]?.name).toBe("fn");
});
