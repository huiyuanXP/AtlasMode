import { expect, it } from "vitest";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
import type { CodeNode, SubgraphResult } from "@codemap/core";
const node = (id: string): CodeNode => ({
  id,
  kind: "function",
  name: id,
  filePath: `${id}.ts`,
});
const graph = (id: string): SubgraphResult => ({
  nodes: [node(id)],
  relations: [],
  snapshotId: "s",
  truncated: false,
  dataSource: "code",
});
const response = (value: unknown) => new Response(JSON.stringify(value));
function harness(delayOld = false) {
  let old!: (r: Response) => void;
  let calls = 0;
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    if (path.endsWith("/dependencies")) {
      calls++;
      const id = JSON.parse(String(init?.body)).nodeId;
      if (delayOld && id === "old")
        return new Promise<Response>((r) => {
          old = r;
        });
      return response({ ...graph(id), unknownCount: 2 });
    }
    if (path.includes("/source?"))
      return response({ filePath: "new.ts", content: "source" });
    return response({
      node: node("new"),
      incoming: [],
      outgoing: [],
      totalIncoming: 0,
      totalOutgoing: 0,
      truncated: false,
      offset: 0,
      limit: 50,
      snapshotId: "s",
      dataSource: "code",
    });
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project: { id: "p", name: "p", path: "/p" },
    summary: {
      project: { id: "p", name: "p", path: "/p" },
      snapshotId: "s",
      contentHash: "hash",
      counts: {
        files: 2,
        folders: 0,
        functions: 2,
        relations: 0,
        calls: { resolved: 0, unresolved: 0, external: 0 },
      },
      entrypoints: [node("old"), node("new")],
      entrypointTotal: 2,
      entrypointsTruncated: false,
      diagnostics: [],
      coverage: {
        files: ["old.ts", "new.ts"],
        excludedPatterns: [],
        unresolvedCount: 0,
      },
      dataSource: "code",
    },
    graph: graph("old"),
    view: {
      positions: { "fact:old": { x: 901, y: 502 } },
      theme: "light",
      locale: "en",
    },
  });
  return {
    app,
    finishOld: () => old(response({ ...graph("old"), unknownCount: 0 })),
    calls: () => calls,
  };
}
it("new funnel wins a late dependency response, selects its root, and exit restores the overview/manual positions", async () => {
  const h = harness(true),
    before = h.app.store.getState().graph;
  const old = h.app.enterFunnel(node("old"));
  await h.app.enterFunnel(node("new"));
  h.finishOld();
  await old;
  expect(h.app.store.getState().funnel?.root.id).toBe("new");
  expect(h.app.store.getState().selectedNode?.id).toBe("new");
  expect(h.app.store.getState().funnel?.unknownCount).toBe(2);
  h.app.exitFunnel();
  expect(h.app.store.getState().graph).toEqual(before);
  expect(h.app.store.getState().view.positions).toEqual({
    "fact:old": { x: 901, y: 502 },
  });
  expect(h.app.store.getState().funnel).toBeUndefined();
});
it("exit cancels an in-flight funnel; planned-only roots use plan relations without a fact query", async () => {
  const h = harness(true);
  const pending = h.app.enterFunnel(node("old"));
  h.app.exitFunnel();
  h.finishOld();
  await pending;
  expect(h.app.store.getState().funnel).toBeUndefined();
  h.app.store.setState({
    plan: {
      plan: {
        operations: [
          {
            kind: "add_function",
            tempId: "planned",
            name: "planned",
            filePath: "new.ts",
          },
        ],
      },
    } as never,
  });
  await h.app.enterFunnel(node("planned"));
  expect(h.calls()).toBe(1);
  expect(h.app.store.getState().funnel?.root.id).toBe("planned");
  expect(h.app.store.getState().source).toBeUndefined();
});

it("keeps stale overview facts out of a fresh funnel snapshot", async () => {
  const h = harness();
  h.app.store.setState({
    graph: { ...graph("deleted-old-snapshot"), snapshotId: "stale" },
  });
  await h.app.enterFunnel(node("new"));
  expect(h.app.store.getState().graph!.nodes.map((n) => n.id)).toEqual(["new"]);
  expect(h.app.store.getState().graph!.snapshotId).toBe("s");
});
it("a newer selection cancels pending funnel activity and cannot be replaced by its old query", async () => {
  const h = harness(true);
  const pending = h.app.enterFunnel(node("old"));
  await h.app.selectNode(node("new"));
  expect(h.app.store.getState().busy.funnel).toBe(false);
  h.finishOld();
  await pending;
  expect(h.app.store.getState().funnel).toBeUndefined();
  expect(h.app.store.getState().selectedNode?.id).toBe("new");
});
