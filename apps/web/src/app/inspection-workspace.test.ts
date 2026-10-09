import { expect, it } from "vitest";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
import type { CodeNode } from "@codemap/core";
const node: CodeNode = {
  id: "f",
  kind: "function",
  name: "same",
  filePath: "a.ts",
};
const context = (snapshotId = "s") => ({
  node,
  incoming: [],
  outgoing: [],
  totalIncoming: 0,
  totalOutgoing: 0,
  offset: 0,
  limit: 50,
  snapshotId,
  dataSource: "code",
  truncated: false,
});
function setup() {
  let release!: (r: Response) => void;
  let sourceRequests = 0;
  const app = createWorkspace(
    new HttpApi((async (input: RequestInfo | URL) => {
      if (String(input).includes("/source")) {
        sourceRequests++;
        return new Response(
          JSON.stringify({ filePath: "a.ts", content: "source" }),
        );
      }
      return new Promise<Response>((r) => {
        release = r;
      });
    }) as typeof fetch),
  );
  app.store.setState({
    project: { id: "p", name: "p", path: "/p" },
    summary: { snapshotId: "s", entrypoints: [node] } as never,
    graph: {
      nodes: [node],
      relations: [],
      snapshotId: "s",
      dataSource: "code",
      truncated: false,
    },
  });
  return {
    app,
    finish: (s = "s") => release(new Response(JSON.stringify(context(s)))),
    sourceRequests: () => sourceRequests,
  };
}
it("closing inspection discards its delayed response and preserves the camera request", async () => {
  const h = setup();
  const pending = h.app.inspectNode(node);
  h.app.closeInspection();
  h.finish();
  await pending;
  expect(h.app.store.getState().detailsOpen).toBe(false);
  expect(h.app.store.getState().selectedNode).toBeUndefined();
  expect(h.app.store.getState().context).toBeUndefined();
  expect(h.app.store.getState().focusRequest).toBeUndefined();
  expect(h.sourceRequests()).toBe(0);
});
it("canvas inspection keeps the camera and rejects a context from another snapshot", async () => {
  const h = setup();
  const focusRequest = { sequence: 4, nodeId: "f" };
  h.app.store.setState({ focusRequest });
  const pending = h.app.inspectNode(node);
  h.finish("old");
  await pending;
  expect(h.app.store.getState().focusRequest).toEqual(focusRequest);
  expect(h.app.store.getState().context).toBeUndefined();
  expect(h.app.store.getState().error).toContain("SNAPSHOT_CHANGED");
});
it("a snapshot change while inspection is pending discards the old evidence", async () => {
  const h = setup();
  const pending = h.app.inspectNode(node);
  h.app.store.setState({
    summary: { snapshotId: "new", entrypoints: [node] } as never,
  });
  h.finish();
  await pending;
  expect(h.app.store.getState().context).toBeUndefined();
});
it("file inspection reads member and cross-file evidence without fetching source", async () => {
  let path = "";
  const file: CodeNode = {
    id: "file",
    kind: "file",
    name: "a.ts",
    filePath: "a.ts",
  };
  const app = createWorkspace(
    new HttpApi((async (input: RequestInfo | URL) => {
      path = String(input);
      return new Response(
        JSON.stringify({
          node: file,
          members: [node],
          incoming: [],
          outgoing: [],
          imports: [],
          unknown: [],
          totalMembers: 1,
          totalIncoming: 0,
          totalOutgoing: 0,
          totalImports: 0,
          totalUnknown: 0,
          relatedNodes: [node],
          offset: 0,
          limit: 50,
          snapshotId: "s",
          dataSource: "code",
          truncated: false,
        }),
      );
    }) as typeof fetch),
  );
  app.store.setState({
    project: { id: "p", name: "p", path: "/p" },
    summary: { snapshotId: "s", entrypoints: [] } as never,
    graph: {
      nodes: [file],
      relations: [],
      snapshotId: "s",
      dataSource: "code",
      truncated: false,
    },
  });
  await app.inspectNode(file);
  expect(path).toContain("/files/file/context");
  expect(app.store.getState().fileContext?.members[0]?.id).toBe("f");
  expect(app.store.getState().detailsOpen).toBe(true);
});

it("closing a detail also supersedes a pending reference jump", async () => {
  const h = setup();
  const graph = h.app.store.getState().graph;
  const pending = h.app.jumpToNode("not-loaded");
  h.app.closeInspection();
  h.finish();
  await pending;
  expect(h.app.store.getState().graph).toBe(graph);
  expect(h.app.store.getState().detailsOpen).toBe(false);
  expect(h.app.store.getState().selectedNode).toBeUndefined();
});

it("operation focus highlights the stable relation and both endpoints without changing approval", async () => {
  const peer: CodeNode = {
    id: "peer",
    kind: "function",
    name: "same",
    filePath: "b.ts",
  };
  const graph = {
    snapshotId: "s",
    nodes: [node, peer],
    relations: [],
    dataSource: "code",
    truncated: false,
  };
  const app = createWorkspace(
    new HttpApi(
      (async () => new Response(JSON.stringify(graph))) as typeof fetch,
    ),
  );
  app.store.setState({
    project: { id: "p", name: "p", path: "/p" },
    summary: { snapshotId: "s", entrypoints: [node] } as never,
    graph: graph as never,
    plan: {
      plan: {
        id: "plan",
        revision: 3,
        approval: { revision: 3 },
        operations: [],
      },
    } as never,
  });
  const before = app.store.getState().plan;
  await app.focusOperation({
    kind: "add_relation",
    id: "exact",
    sourceId: "f",
    targetId: "peer",
    type: "calls",
  });
  expect(app.store.getState().focusRequest?.nodeIds).toEqual(["f", "peer"]);
  expect(app.store.getState().fixedOperationRelationId).toBe("exact");
  app.previewRelation("temporary");
  app.previewRelation();
  expect(app.store.getState().relationPreviewId).toBeUndefined();
  expect(app.store.getState().fixedOperationRelationId).toBe("exact");
  expect(app.store.getState().plan).toBe(before);
});

it("a delayed canvas inspection cannot cross a project switch", async () => {
  let release!: (response: Response) => void;
  const app = createWorkspace(
    new HttpApi((async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/projects/p/functions/"))
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      if (path.endsWith("/summary"))
        return new Response(
          JSON.stringify({ snapshotId: "q-s", entrypoints: [] }),
        );
      if (path.endsWith("/view"))
        return new Response(
          JSON.stringify({ positions: {}, theme: "light", locale: "en" }),
        );
      return new Response("[]");
    }) as typeof fetch),
  );
  app.store.setState({
    project: { id: "p", name: "p", path: "/p" },
    summary: { snapshotId: "s", entrypoints: [node] } as never,
  });
  const pending = app.inspectNode(node);
  await app.selectProject({ id: "q", name: "q", path: "/q" });
  release(new Response(JSON.stringify(context())));
  await pending;
  expect(app.store.getState().project?.id).toBe("q");
  expect(app.store.getState().context).toBeUndefined();
  expect(app.store.getState().detailsOpen).toBe(false);
});

it.each(["folder", "plan"])(
  "changing from file details to %s clears all previous inspection evidence",
  async (next) => {
    const file: CodeNode = {
      id: "file",
      kind: "file",
      name: "a.ts",
      filePath: "a.ts",
    };
    const folder: CodeNode = {
      id: "folder",
      kind: "folder",
      name: "src",
      filePath: "src",
    };
    const graph = {
      snapshotId: "s",
      nodes: [folder],
      root: folder,
      relations: [],
      dataSource: "code",
      truncated: false,
    };
    const detail = {
      plan: {
        id: "plan",
        projectId: "p",
        title: "Plan",
        description: "",
        revision: 1,
        status: "draft",
        baselineSnapshotId: "s",
        baselineContentHash: "hash",
        createdAt: "now",
        updatedAt: "now",
        operations: [
          {
            kind: "add_function",
            tempId: "new",
            name: "new",
            filePath: "new.ts",
          },
        ],
      },
      valid: true,
      issues: [],
    };
    const app = createWorkspace(
      new HttpApi(
        (async (input: RequestInfo | URL) =>
          new Response(
            JSON.stringify(String(input).includes("/plans/") ? detail : graph),
          )) as typeof fetch,
      ),
    );
    app.store.setState({
      project: { id: "p", name: "p", path: "/p" },
      summary: { snapshotId: "s", entrypoints: [] } as never,
      graph: graph as never,
      selectedNode: file,
      detailsOpen: true,
      relationPreviewId: "old-call",
      fileContext: {
        node: file,
        members: [node],
        relatedNodes: [node],
        incoming: [],
        outgoing: [],
        imports: [],
        unknown: [],
        totalMembers: 1,
        totalIncoming: 0,
        totalOutgoing: 0,
        totalImports: 0,
        totalUnknown: 0,
        offset: 0,
        limit: 50,
        snapshotId: "s",
        dataSource: "code",
        truncated: false,
      },
    });
    if (next === "folder") await app.navigateScope("src", "folder");
    else await app.choosePlan("plan");
    expect(app.store.getState().selectedNode?.id).toBe(
      next === "folder" ? "folder" : "new",
    );
    expect(app.store.getState().fileContext).toBeUndefined();
    expect(app.store.getState().relationPreviewId).toBeUndefined();
    expect(app.store.getState().detailsOpen).toBe(false);
  },
);
