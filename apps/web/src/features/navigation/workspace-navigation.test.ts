import { expect, it } from "vitest";
import type { CodeNode, Operation, PlanDetail } from "@codemap/core";
import { HttpApi } from "../../api/client.js";
import { createWorkspace } from "../../app/workspace.js";
const root: CodeNode = { id: "root", kind: "folder", name: "." };
const folder: CodeNode = {
  id: "src",
  kind: "folder",
  name: "src",
  filePath: "src",
  parentId: "root",
};
const file: CodeNode = {
  id: "file",
  kind: "file",
  name: "a.ts",
  filePath: "src/a.ts",
  parentId: "src",
};
const fn: CodeNode = {
  id: "fn",
  kind: "function",
  name: "run",
  filePath: "src/a.ts",
  parentId: "file",
};
const graph = (nodes: CodeNode[], snapshotId = "s-a") => ({
  nodes,
  relations: [],
  snapshotId,
  truncated: false,
  dataSource: "code",
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function fixture(path: string, body?: string) {
  const id = path.split("/")[3];
  if (path.endsWith("/summary"))
    return {
      project: { id, name: id, path: `/${id}` },
      snapshotId: `s-${id}`,
      contentHash: id,
      counts: {
        files: 1,
        folders: 2,
        functions: 1,
        relations: 0,
        calls: { resolved: 0, unresolved: 0, external: 0 },
      },
      entrypoints: [fn],
      entrypointTotal: 1,
      entrypointsTruncated: false,
      diagnostics: [],
      coverage: {
        files: ["src/a.ts"],
        excludedPatterns: [],
        unresolvedCount: 0,
      },
      dataSource: "code",
    };
  if (path.endsWith("/view"))
    return { positions: {}, theme: "light", locale: "en" };
  if (path.endsWith("/subgraph")) return graph([fn], `s-${id}`);
  if (path.endsWith("/scope")) {
    const input = JSON.parse(body ?? "{}");
    const node =
      input.path === "." ? root : input.path === "src" ? folder : file;
    return {
      ...graph(
        input.kind === "file"
          ? [file]
          : [node, input.path === "." ? folder : file],
        `s-${id}`,
      ),
      root: node,
      path: input.path,
      kind: input.kind,
    };
  }
  if (path.endsWith("/dependencies"))
    return { ...graph([file], `s-${id}`), unknownCount: 0 };
  if (path.includes("/source?"))
    return { filePath: "src/a.ts", content: "source" };
  if (path.includes("/functions/"))
    return {
      node: fn,
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
function appWith(
  override?: (
    path: string,
    body?: string,
  ) => Response | Promise<Response> | undefined,
) {
  return createWorkspace(
    new HttpApi((async (url, init) => {
      const path = String(url),
        body = typeof init?.body === "string" ? init.body : undefined;
      return (await override?.(path, body)) ?? response(fixture(path, body));
    }) as typeof fetch),
  );
}
it("folder navigation replaces scene and file navigation uses indexed file identity for its funnel", async () => {
  const app = appWith();
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.navigateScope("src", "folder");
  expect(app.store.getState()).toMatchObject({
    graph: { nodes: [folder, file] },
    selectedNode: folder,
    funnel: undefined,
    focusRequest: { nodeIds: ["src", "file"] },
  });
  await app.navigateScope("src/a.ts", "file");
  expect(app.store.getState()).toMatchObject({
    selectedNode: file,
    funnel: { root: file },
  });
});
it("a later folder scope wins when an older response finishes after it", async () => {
  let release!: (response: Response) => void;
  const app = appWith((path, body) =>
    path.endsWith("/scope") && JSON.parse(body!).path === "src"
      ? new Promise((r) => {
          release = r;
        })
      : undefined,
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  const old = app.navigateScope("src", "folder");
  await app.navigateScope(".", "folder");
  release(
    response(
      fixture("/api/projects/a/scope", '{"path":"src","kind":"folder"}'),
    ),
  );
  await old;
  expect(app.store.getState().selectedNode?.id).toBe("root");
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["root", "src"]);
});
it("project switch and newer function selection cancel pending scope navigation", async () => {
  let release!: (response: Response) => void;
  const app = appWith((path) =>
    path.endsWith("/scope")
      ? new Promise((r) => {
          release = r;
        })
      : undefined,
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  const old = app.navigateScope("src", "folder");
  await app.selectProject({ id: "b", name: "b", path: "/b" });
  release(
    response(
      fixture("/api/projects/a/scope", '{"path":"src","kind":"folder"}'),
    ),
  );
  await old;
  expect(app.store.getState().selectedNode).toBeUndefined();
  const next = app.navigateScope("src", "folder");
  await app.selectNode(fn);
  release(
    response(
      fixture("/api/projects/b/scope", '{"path":"src","kind":"folder"}'),
    ),
  );
  await next;
  expect(app.store.getState().selectedNode?.id).toBe("fn");
});
it("planned missing paths focus real operation nodes and never read invented source", async () => {
  const requests: string[] = [];
  const app = appWith((path) => {
    requests.push(path);
    return path.endsWith("/scope")
      ? response({
          ...graph([]),
          missing: true,
          path: "planned/new.ts",
          kind: "file",
        })
      : undefined;
  });
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  const operations: Operation[] = [
    {
      kind: "add_function",
      tempId: "new",
      name: "newFn",
      filePath: "planned/new.ts",
    },
  ];
  const plan: PlanDetail = {
    plan: {
      id: "p",
      projectId: "a",
      title: "New file",
      description: "",
      baselineSnapshotId: "s-a",
      baselineContentHash: "a",
      revision: 1,
      operations,
      status: "draft",
      createdAt: "now",
      updatedAt: "now",
    },
    valid: false,
    issues: [],
  };
  app.store.setState({ plan });
  await app.navigateScope("planned/new.ts", "file");
  expect(app.store.getState()).toMatchObject({
    navigationLocation: { path: "planned/new.ts", kind: "file", planned: true },
    source: undefined,
    focusRequest: { nodeIds: ["new"] },
  });
  expect(app.store.getState().graph?.nodes).toEqual([]);
  expect(requests.some((path) => path.includes("/source?"))).toBe(false);
  expect(requests.some((path) => path.endsWith("/dependencies"))).toBe(false);
});
it("a rejected scope query keeps the prior funnel scene and does not move focus", async () => {
  const app = appWith((path) =>
    path.endsWith("/scope")
      ? response({ code: "SNAPSHOT_CHANGED", message: "Refresh" }, 409)
      : undefined,
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.enterFunnel(file);
  const before = app.store.getState();
  await app.navigateScope("src", "folder");
  expect(app.store.getState().funnel).toEqual(before.funnel);
  expect(app.store.getState().graph).toEqual(before.graph);
  expect(app.store.getState().errorMessageKey).toBe("snapshotChanged");
});
it("a mismatched snapshot cannot mix folder facts into the current scene", async () => {
  const app = appWith((path) =>
    path.endsWith("/scope")
      ? response({
          ...graph([folder], "stale"),
          root: folder,
          path: "src",
          kind: "folder",
        })
      : undefined,
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.navigateScope("src", "folder");
  expect(app.store.getState().graph?.snapshotId).toBe("s-a");
  expect(app.store.getState().selectedNode).toBeUndefined();
  expect(app.store.getState().errorMessageKey).toBe("snapshotChanged");
});
it("single planning focus updates its path and multi-object focus clears an unrelated old path", async () => {
  const operations: Operation[] = [
    {
      kind: "add_function",
      tempId: "new",
      name: "newFn",
      filePath: "planned/new.ts",
    },
  ];
  const detail = (ops: Operation[]): PlanDetail => ({
    plan: {
      id: "p",
      projectId: "a",
      title: "Plan focus",
      description: "",
      baselineSnapshotId: "s-a",
      baselineContentHash: "a",
      revision: 1,
      operations: ops,
      status: "draft",
      createdAt: "now",
      updatedAt: "now",
    },
    valid: false,
    issues: [],
  });
  let chosen = detail(operations);
  const app = appWith((path) =>
    path === "/api/plans/p" ? response(chosen) : undefined,
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.selectNode(fn);
  await app.choosePlan("p");
  expect(app.store.getState().selectedNode).toMatchObject({
    id: "new",
    filePath: "planned/new.ts",
  });
  chosen = detail([
    ...operations,
    {
      kind: "add_function",
      tempId: "second",
      name: "secondFn",
      filePath: "other.ts",
    },
  ]);
  await app.choosePlan("p");
  expect(app.store.getState().selectedNode).toBeUndefined();
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["new", "second"]);
});
it("project scope includes actual planned node IDs even when its captured code index is empty", async () => {
  const app = appWith((path) =>
    path.endsWith("/scope")
      ? response({ ...graph([]), path: ".", kind: "folder" })
      : undefined,
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  app.store.setState({
    plan: {
      plan: {
        id: "p",
        projectId: "a",
        title: "Empty project",
        description: "",
        baselineSnapshotId: "s-a",
        baselineContentHash: "a",
        revision: 1,
        operations: [
          {
            kind: "add_function",
            tempId: "new",
            name: "newFn",
            filePath: "new.ts",
          },
        ],
        status: "draft",
        createdAt: "now",
        updatedAt: "now",
      },
      valid: false,
      issues: [],
    },
  });
  await app.navigateScope(".", "folder");
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["new"]);
  expect(app.store.getState().graph?.nodes).toEqual([]);
});
it("choosing an empty plan clears the prior planned path together with its removed selection", async () => {
  const make = (operations: Operation[]): PlanDetail => ({
    plan: {
      id: "p",
      projectId: "a",
      title: "Plan",
      description: "",
      baselineSnapshotId: "s-a",
      baselineContentHash: "a",
      revision: 1,
      operations,
      status: "draft",
      createdAt: "now",
      updatedAt: "now",
    },
    valid: false,
    issues: [],
  });
  let current = make([
    {
      kind: "add_function",
      tempId: "new",
      name: "newFn",
      filePath: "future/new.ts",
    },
  ]);
  const app = appWith((path) =>
    path === "/api/plans/p" ? response(current) : undefined,
  );
  await app.selectProject({ id: "a", name: "a", path: "/a" });
  await app.choosePlan("p");
  expect(app.store.getState().navigationLocation?.path).toBe("future/new.ts");
  current = make([]);
  await app.choosePlan("p");
  expect(app.store.getState().selectedNode).toBeUndefined();
  expect(app.store.getState().navigationLocation).toBeUndefined();
});
