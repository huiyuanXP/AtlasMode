import { expect, it } from "vitest";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
import type { Operation } from "@codemap/core";
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
it("newer manual expansion keeps its graph and selection when an older route finishes last", async () => {
  let releaseRoute!: (value: Response) => void;
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    if (path.endsWith("/subgraph")) {
      const id = JSON.parse(String(init?.body)).nodeIds[0];
      if (id === "route-target")
        return new Promise<Response>((r) => {
          releaseRoute = r;
        });
      if (id === "manual-target")
        return reply({
          nodes: [{ id, name: id, kind: "function", filePath: "a.ts" }],
          relations: [],
          snapshotId: "s-a",
          dataSource: "code",
          truncated: false,
        });
    }
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  app.store.setState({
    selectedNode: {
      id: "manual-target",
      name: "manual-target",
      kind: "function",
      filePath: "a.ts",
    },
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
        steps: [{ nodeId: "route-target", note: "old step" }],
        createdAt: "2026-10-02T00:00:00Z",
      },
    ],
  });
  const pending = app.routeStep("route", 0);
  await app.expand("manual-target");
  expect(app.store.getState().graph?.nodes[0]?.id).toBe("manual-target");
  releaseRoute(
    new Response(
      JSON.stringify({
        nodes: [
          {
            id: "route-target",
            name: "route-target",
            kind: "function",
            filePath: "a.ts",
          },
        ],
        relations: [],
        snapshotId: "s-a",
        dataSource: "code",
        truncated: false,
      }),
    ),
  );
  await pending;
  expect(app.store.getState().graph?.nodes[0]?.id).toBe("manual-target");
  expect(app.store.getState().selectedNode?.id).toBe("manual-target");
  expect(app.store.getState().busy.route).toBe(false);
});

it("accepted temporary edits and undo redo refresh inspector metadata using committed revisions", async () => {
  const original = {
    kind: "add_function" as const,
    tempId: "temp:f",
    name: "before",
    filePath: "before.ts",
    signature: "before()",
  };
  let current = planDetail([original]);
  const revisions: number[] = [];
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (String(input) === "/api/plans/p") {
      if (init?.method === "PUT") {
        const data = JSON.parse(String(init.body));
        revisions.push(data.expectedRevision);
        current = {
          ...current,
          plan: {
            ...current.plan,
            ...data,
            revision: current.plan.revision + 1,
          },
        };
      }
      return reply(current);
    }
    return reply(fixture(String(input)));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  await app.selectNode({
    id: "temp:f",
    kind: "function",
    name: "before",
    filePath: "before.ts",
    signature: "before()",
  });
  await app.savePlan(
    [
      {
        ...original,
        name: "after",
        filePath: "after.ts",
        signature: "after(x)",
      },
    ],
    "New title",
    "New design",
  );
  expect(app.store.getState().selectedNode).toMatchObject({
    name: "after",
    filePath: "after.ts",
    signature: "after(x)",
  });
  await app.undo();
  expect(app.store.getState().selectedNode).toMatchObject({
    name: "before",
    filePath: "before.ts",
    signature: "before()",
  });
  expect(app.store.getState().plan?.plan).toMatchObject({
    revision: 6,
    title: "plan",
    description: "",
  });
  await app.redo();
  expect(app.store.getState().selectedNode).toMatchObject({
    name: "after",
    filePath: "after.ts",
    signature: "after(x)",
  });
  expect(revisions).toEqual([4, 5, 6]);
});

it("failed undo keeps history and layout changes do not enter semantic history", async () => {
  let conflict = false,
    current = planDetail();
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (String(input) === "/api/plans/p") {
      if (init?.method === "PUT") {
        if (conflict)
          return new Response(
            JSON.stringify({
              code: "REVISION_CONFLICT",
              message: "Changed externally",
            }),
            { status: 409 },
          );
        current = {
          ...current,
          plan: {
            ...current.plan,
            ...JSON.parse(String(init.body)),
            revision: current.plan.revision + 1,
          },
        };
      }
      return reply(current);
    }
    return reply(fixture(String(input)));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  await app.savePlan([], "Changed");
  const history = app.store.getState().history;
  app.saveView({
    positions: { f: { x: 30, y: 40 } },
    theme: "dark",
    locale: "en",
  });
  expect(app.store.getState().history).toEqual(history);
  conflict = true;
  await app.undo();
  expect(app.store.getState().history).toEqual(history);
  expect(app.store.getState().plan?.plan.title).toBe("Changed");
  expect(app.store.getState().error).toContain("REVISION_CONFLICT");
  await app.selectProject({ id: "b", name: "b", path: "/b" });
  expect(app.store.getState().history).toBeUndefined();
});

it("knowledge saves refresh authoritative plan validity and late member reads cannot cross project scope", async () => {
  let changed = false,
    release!: (value: Response) => void;
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    if (path.includes("/groups")) {
      if (init?.method === "POST") changed = true;
      return reply([
        {
          id: "g",
          projectId: "a",
          title: "Shared",
          description: "",
          source: "user",
          memberIds: ["f"],
        },
      ]);
    }
    if (path.endsWith("/plans"))
      return reply([
        {
          ...planDetail(),
          plan: { ...planDetail().plan, revision: changed ? 5 : 4 },
          valid: !changed,
        },
      ]);
    if (path === "/api/plans/p") return reply({ ...planDetail(), valid: true });
    if (path.includes("/projects/a/functions/f"))
      return new Promise<Response>((r) => {
        release = r;
      });
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  await app.saveGroup({
    title: "Shared",
    description: "",
    source: "user",
    memberIds: ["f"],
  });
  expect(app.store.getState().plan).toMatchObject({
    valid: false,
    plan: { revision: 5 },
  });
  const pending = app.loadMembers("g");
  await app.selectProject({ id: "b", name: "b", path: "/b" });
  release(new Response(JSON.stringify(fixture("/api/projects/a/functions/f"))));
  await pending;
  expect(app.store.getState().memberPage).toBeUndefined();
});
it("missing annotation binding stays readable without requesting an invalid graph anchor", async () => {
  const detail = planDetail([
    { kind: "annotate", targetId: "gone", text: "Retained knowledge" },
  ]);
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (String(input) === "/api/plans/p")
      return reply({
        ...detail,
        issues: [
          {
            severity: "error",
            code: "INVALID_TARGET",
            operationIndex: 0,
            message: "Annotation target gone does not exist.",
          },
        ],
      });
    if (
      String(input).endsWith("/subgraph") &&
      String(init?.body).includes("gone")
    )
      return new Response(
        JSON.stringify({ code: "NOT_FOUND", message: "Missing graph anchor" }),
        { status: 404 },
      );
    return reply(fixture(String(input)));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  expect(app.store.getState().plan?.plan.operations).toEqual([
    { kind: "annotate", targetId: "gone", text: "Retained knowledge" },
  ]);
  expect(app.store.getState().error).toBe("");
});

it("refresh preserves same-revision session history but resets it after an external revision", async () => {
  let current = planDetail();
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    if (path === "/api/plans/p") {
      if (init?.method === "PUT")
        current = {
          ...current,
          plan: {
            ...current.plan,
            ...JSON.parse(String(init.body)),
            revision: current.plan.revision + 1,
          },
        };
      return reply(current);
    }
    if (path.endsWith("/plans")) return reply([current]);
    return reply(fixture(path));
  }) as typeof fetch);
  const app = createWorkspace(api);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  await app.savePlan([], "Edit");
  await app.refresh();
  expect(app.store.getState().history?.past).toHaveLength(1);
  current = {
    ...current,
    plan: { ...current.plan, revision: 6, title: "Remote edit" },
  };
  await app.refresh();
  expect(app.store.getState().history?.past).toEqual([]);
});

const added: Operation = {
  kind: "add_function",
  tempId: "temp:new",
  name: "new",
  filePath: "new.ts",
};
const linked: Operation = {
  kind: "add_relation",
  id: "edge",
  sourceId: "temp:new",
  targetId: "f",
  type: "calls",
};
function focusFixture(operations: Operation[] = []) {
  let current = planDetail(operations),
    conflict = false;
  const app = createWorkspace(
    new HttpApi((async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/plans/p") {
        if (init?.method === "PUT") {
          if (conflict)
            return new Response(
              JSON.stringify({ code: "REVISION_CONFLICT", message: "Changed" }),
              { status: 409 },
            );
          current = {
            ...current,
            plan: {
              ...current.plan,
              ...JSON.parse(String(init.body)),
              revision: current.plan.revision + 1,
            },
          };
        }
        return reply(current);
      }
      return reply(fixture(String(input)));
    }) as typeof fetch),
  );
  return {
    app,
    reject: () => {
      conflict = true;
    },
  };
}
it("choosing a plan focuses every added function and existing move annotation and relation endpoint", async () => {
  const { app } = focusFixture([
    added,
    linked,
    { kind: "move_function", nodeId: "f", filePath: "moved.ts" },
    { kind: "annotate", targetId: "f", text: "note" },
  ]);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  app.store.setState({ filter: "fact" });
  await app.choosePlan("p");
  expect(app.store.getState().focusRequest).toMatchObject({
    nodeId: "temp:new",
    nodeIds: ["temp:new", "f"],
  });
  expect(app.store.getState().filter).toBe("both");
});
it("successful add edit reconnect remove undo and redo focus only surviving affected context", async () => {
  const { app } = focusFixture();
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  await app.savePlan([added, linked]);
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["temp:new", "f"]);
  const first = app.store.getState().focusRequest!.sequence;
  const edit: Operation = { ...added, name: "edited" };
  await app.savePlan([edit, linked]);
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["temp:new"]);
  expect(app.store.getState().focusRequest!.sequence).toBeGreaterThan(first);
  const next: Operation = {
    kind: "add_function",
    tempId: "temp:target",
    name: "target",
    filePath: "new.ts",
  };
  await app.savePlan([edit, linked, next]);
  await app.savePlan([edit, { ...linked, targetId: "temp:target" }, next]);
  expect(app.store.getState().focusRequest?.nodeIds).toEqual([
    "temp:new",
    "f",
    "temp:target",
  ]);
  await app.savePlan([next]);
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["temp:target"]);
  await app.undo();
  expect(app.store.getState().focusRequest?.nodeIds).toEqual([
    "temp:new",
    "temp:target",
  ]);
  await app.redo();
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["temp:target"]);
});
it("failed semantic update and theme or drag preserve the last camera request", async () => {
  const { app, reject } = focusFixture([added]);
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  const focus = app.store.getState().focusRequest;
  app.saveView({
    positions: { "plan:temp:new": { x: 500, y: 600 } },
    theme: "dark",
    locale: "zh",
  });
  expect(app.store.getState().focusRequest).toEqual(focus);
  reject();
  await app.savePlan([]);
  expect(app.store.getState().focusRequest).toEqual(focus);
  await app.selectProject({ id: "b", name: "b", path: "/b" });
});
it.each(["node", "project", "plan"])(
  "later %s selection supersedes delayed plan anchors and their camera",
  async (later) => {
    let release!: (value: Response) => void;
    const detail = planDetail([added, { ...linked, targetId: "g" }]);
    const app = createWorkspace(
      new HttpApi((async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/plans/p") return reply(detail);
        if (
          String(input).endsWith("/subgraph") &&
          String(init?.body).includes('"g"')
        )
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        return reply(fixture(String(input)));
      }) as typeof fetch),
    );
    await app.selectProject({ id: "a", name: "a", path: "/a" });
    const pending = app.choosePlan("p");
    while (!release) await Promise.resolve();
    if (later === "node")
      await app.selectNode({
        id: "f",
        name: "fn",
        kind: "function",
        filePath: "a.ts",
      });
    else if (later === "project")
      await app.selectProject({ id: "b", name: "b", path: "/b" });
    else await app.choosePlan("");
    const focus = app.store.getState().focusRequest;
    release(
      new Response(
        JSON.stringify({
          ...(fixture("/api/projects/a/subgraph") as object),
          nodes: [{ id: "g", kind: "function", name: "late" }],
        }),
      ),
    );
    await pending;
    expect(app.store.getState().graph?.nodes[0]?.id).toBe("f");
    expect(app.store.getState().focusRequest).toEqual(focus);
    if (later === "node") expect(focus?.nodeIds).toEqual(["f"]);
  },
);
it("choosing an unloaded removed fact relation resolves and focuses its actual surviving endpoints", async () => {
  const app = createWorkspace(
    new HttpApi((async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/plans/p")
        return reply(
          planDetail([{ kind: "remove_relation", relationId: "actual-edge" }]),
        );
      if (
        String(input).endsWith("/subgraph") &&
        String(init?.body).includes("actual-edge")
      )
        return reply({
          ...(fixture("/api/projects/a/subgraph") as object),
          nodes: [
            { id: "f", kind: "function", name: "fn" },
            { id: "g", kind: "function", name: "g" },
          ],
          relations: [
            {
              id: "actual-edge",
              sourceId: "f",
              targetId: "g",
              type: "calls",
              resolution: "resolved",
              evidence: { filePath: "a.ts", line: 1 },
            },
          ],
        });
      return reply(fixture(String(input)));
    }) as typeof fetch),
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["f", "g"]);
});
it("a successful semantic response after a newer node selection preserves its camera", async () => {
  let release!: (value: Response) => void;
  const app = createWorkspace(
    new HttpApi((async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/plans/p") {
        if (init?.method === "PUT")
          return new Promise<Response>((r) => {
            release = r;
          });
        return reply(planDetail([added]));
      }
      return reply(fixture(String(input)));
    }) as typeof fetch),
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  const pending = app.savePlan([added, linked]);
  await app.selectNode({ id: "f", name: "fn", kind: "function" });
  const focus = app.store.getState().focusRequest;
  release(
    new Response(
      JSON.stringify({
        ...planDetail([added, linked]),
        plan: { ...planDetail([added, linked]).plan, revision: 5 },
      }),
    ),
  );
  await pending;
  expect(app.store.getState().plan?.plan.revision).toBe(5);
  expect(app.store.getState().focusRequest).toEqual(focus);
});
