import { expect, it } from "vitest";
import type { Operation, PlanDetail } from "@codemap/core";
import { HttpApi } from "../../api/client.js";
import { createWorkspace } from "../../app/workspace.js";
const fn = {
  id: "entry",
  kind: "function" as const,
  name: "entry",
  filePath: "src/main.ts",
};
const plan = (
  id: string,
  revision = 1,
  operations: Operation[] = [],
): PlanDetail => ({
  plan: {
    id,
    projectId: "a",
    title: id,
    description: "",
    revision,
    operations,
    status: "draft",
    baselineSnapshotId: "s-a",
    baselineContentHash: "h",
    createdAt: "now",
    updatedAt: "now",
  },
  issues: [],
  valid: false,
});
function setup() {
  let plans: PlanDetail[] = [],
    snapshotId = "s-a";
  let projectionFailure: { code: string; status: number } | undefined;
  const reads: string[] = [];
  let hold: Promise<Response> | undefined;
  const app = createWorkspace(
    new HttpApi(async (url) => {
      const path = String(url),
        id = path.split("/")[3];
      reads.push(path);
      if (
        projectionFailure &&
        (path.endsWith("/dependencies") ||
          path.endsWith("/subgraph") ||
          path.endsWith("/scope"))
      )
        return new Response(
          JSON.stringify({
            code: projectionFailure.code,
            message: "Projection unavailable",
          }),
          { status: projectionFailure.status },
        );
      if (path.endsWith("/plans"))
        return hold ?? new Response(JSON.stringify(plans));
      let value: unknown = [];
      if (path.endsWith("/summary"))
        value = {
          project: { id, path: `/${id}`, name: id },
          snapshotId: id === "a" ? snapshotId : `s-${id}`,
          contentHash: "h",
          counts: {
            files: 1,
            folders: 1,
            functions: 1,
            relations: 0,
            calls: { resolved: 0, unresolved: 0, external: 0 },
          },
          entrypoints: [fn],
          entrypointTotal: 1,
          entrypointsTruncated: false,
          diagnostics: [],
          coverage: {
            files: ["src/main.ts"],
            excludedPatterns: [],
            unresolvedCount: 0,
          },
          dataSource: "code",
        };
      else if (path.endsWith("/view"))
        value = { positions: {}, theme: "light", locale: "en" };
      else if (path.endsWith("/subgraph") || path.endsWith("/dependencies"))
        value = {
          nodes: [fn],
          relations: [],
          snapshotId: id === "a" ? snapshotId : `s-${id}`,
          truncated: false,
          dataSource: "code",
          unknownCount: 0,
        };
      else if (path.startsWith("/api/plans/"))
        value = plans.find((p) => p.plan.id === id);
      else if (path.includes("/functions/"))
        value = {
          node: fn,
          incoming: [],
          outgoing: [],
          totalIncoming: 0,
          totalOutgoing: 0,
          truncated: false,
          offset: 0,
          limit: 50,
          snapshotId: id === "a" ? snapshotId : `s-${id}`,
          dataSource: "code",
        };
      else if (path.includes("/source?"))
        value = {
          filePath: "src/main.ts",
          content: "export function entry(){}",
        };
      return new Response(JSON.stringify(value));
    }),
  );
  return {
    app,
    reads,
    setSnapshot: (id: string) => {
      snapshotId = id;
    },
    failProjection: (code: string, status: number) => {
      projectionFailure = { code, status };
    },
    setPlans: (p: PlanDetail[]) => {
      plans = p;
    },
    hold: (p: Promise<Response>) => {
      hold = p;
    },
  };
}
it("journaled agent plans synchronize and focus multiple actual affected changes", async () => {
  const f = setup();
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  const token = f.app.captureAgentSync();
  f.setPlans([
    plan("proposal", 1, [
      {
        kind: "add_function",
        tempId: "new",
        name: "fetchNotes",
        filePath: "src/notes.ts",
      },
      {
        kind: "add_relation",
        id: "r",
        sourceId: "new",
        targetId: "entry",
        type: "calls",
      },
    ]),
  ]);
  await f.app.syncAgentChanges(["proposal"], token);
  expect(f.app.store.getState().plan?.plan.id).toBe("proposal");
  expect(f.app.store.getState().focusRequest?.nodeIds).toEqual([
    "new",
    "entry",
  ]);
  expect(f.app.store.getState().selectedNode).toBeUndefined();
});
it("agent refresh keeps fresh metadata and clears a deleted selected funnel root", async () => {
  const f = setup();
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  await f.app.enterFunnel(fn);
  expect(f.app.store.getState().selectedNode?.id).toBe("entry");
  expect(f.app.store.getState().funnel?.root.id).toBe("entry");
  const token = f.app.captureAgentSync();
  f.setSnapshot("s-deleted");
  f.setPlans([plan("latest", 2)]);
  f.failProjection("NOT_FOUND", 404);
  await f.app.syncAgentChanges([], token);
  const state = f.app.store.getState();
  expect(state.summary?.snapshotId).toBe("s-deleted");
  expect(state.plans[0].plan.revision).toBe(2);
  expect(state.graph?.nodes ?? []).toEqual([]);
  expect(state.selectedNode).toBeUndefined();
  expect(state.funnel).toBeUndefined();
  expect(state.context).toBeUndefined();
  expect(state.source).toBeUndefined();
  expect(state.notice).toBe("scopeMissingNotice");
  expect(state.error).toBe("");
});
it("agent refresh reports unrelated projection failures instead of treating them as deleted scope", async () => {
  const f = setup();
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  await f.app.enterFunnel(fn);
  const token = f.app.captureAgentSync();
  f.setSnapshot("s-new");
  f.failProjection("HTTP_ERROR", 503);
  await f.app.syncAgentChanges([], token);
  expect(f.app.store.getState().error).toContain("HTTP_ERROR");
  expect(f.app.store.getState().notice).not.toBe("scopeMissingNotice");
  expect(f.app.store.getState().selectedNode?.id).toBe("entry");
});
it("newer manual navigation wins over terminal agent focus while metadata still refreshes", async () => {
  const f = setup();
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  const token = f.app.captureAgentSync();
  await f.app.selectNode(fn);
  f.setPlans([
    plan("proposal", 1, [
      { kind: "add_function", tempId: "new", name: "new", filePath: "new.ts" },
    ]),
  ]);
  await f.app.syncAgentChanges(["proposal"], token);
  expect(f.app.store.getState().selectedNode?.id).toBe("entry");
  expect(f.app.store.getState().plan).toBeUndefined();
  expect(f.app.store.getState().plans.map((p) => p.plan.id)).toEqual([
    "proposal",
  ]);
});
it("terminal reread without journal IDs does not attribute a concurrently created plan", async () => {
  const f = setup();
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  const token = f.app.captureAgentSync();
  f.setPlans([plan("concurrent")]);
  await f.app.syncAgentChanges([], token);
  expect(f.app.store.getState().plans.map((p) => p.plan.id)).toEqual([
    "concurrent",
  ]);
  expect(f.app.store.getState().plan).toBeUndefined();
  expect(f.reads.filter((p) => p.endsWith("/groups"))).toHaveLength(2);
  expect(f.reads.filter((p) => p.endsWith("/routes"))).toHaveLength(2);
});
it("project switches discard an earlier terminal reread response", async () => {
  const f = setup();
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  const token = f.app.captureAgentSync();
  let resolve!: (r: Response) => void;
  f.hold(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const sync = f.app.syncAgentChanges(["proposal"], token);
  f.hold(Promise.resolve(new Response("[]")));
  await f.app.selectProject({ id: "b", path: "/b", name: "b" });
  resolve(new Response(JSON.stringify([plan("proposal")])));
  await sync;
  expect(f.app.store.getState().project?.id).toBe("b");
  expect(f.app.store.getState().plans).toEqual([]);
  expect(f.app.store.getState().plan).toBeUndefined();
});

it("agent index refresh rereads the current projection only when the actual snapshot changes", async () => {
  const f = setup();
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  const token = f.app.captureAgentSync();
  await f.app.syncAgentChanges([], token);
  expect(f.reads.filter((p) => p.endsWith("/subgraph"))).toHaveLength(1);
  f.setSnapshot("s-new");
  await f.app.syncAgentChanges([], token);
  expect(f.app.store.getState().summary?.snapshotId).toBe("s-new");
  expect(f.app.store.getState().graph?.snapshotId).toBe("s-new");
  expect(f.reads.filter((p) => p.endsWith("/subgraph"))).toHaveLength(2);
});
it("an unsaved advanced metadata draft blocks agent plan replacement until the editor releases it", async () => {
  const f = setup();
  f.setPlans([plan("existing", 1)]);
  await f.app.selectProject({ id: "a", path: "/a", name: "a" });
  await f.app.choosePlan("existing");
  const token = f.app.captureAgentSync();
  f.app.setPlanEditorDirty(true);
  f.setPlans([
    plan("existing", 2, [
      { kind: "add_function", tempId: "new", name: "new", filePath: "new.ts" },
    ]),
  ]);
  await f.app.syncAgentChanges(["existing"], token);
  expect(f.app.store.getState().plan?.plan.revision).toBe(1);
  expect(f.app.store.getState().plans[0].plan.revision).toBe(2);
  expect(f.app.store.getState().focusRequest?.nodeIds ?? []).not.toContain(
    "new",
  );
  f.app.setPlanEditorDirty(false);
  expect(f.app.store.getState().plan?.plan.revision).toBe(2);
});
