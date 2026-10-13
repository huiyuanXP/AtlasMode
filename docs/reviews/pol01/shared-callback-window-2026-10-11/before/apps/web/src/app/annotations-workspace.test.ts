import { expect, test } from "vitest";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
import {
  snapshot,
  detail,
} from "../features/annotations/fixtures.test-support.js";
import {
  beginAnnotationRequest,
  changeAnnotationDraft,
  openAnnotationDraft,
} from "../features/annotations/draft.js";
import type { PlanDetail } from "@codemap/core";
const note = () => {
  const item = detail();
  item.annotation.text = "submitted";
  item.annotation.revision = 4;
  return item;
};
const plan = (revision = 2): PlanDetail => ({
  plan: {
    id: "plan",
    projectId: "p",
    title: "local title",
    description: "local description",
    revision,
    status: "draft",
    baselineSnapshotId: "s1",
    baselineContentHash: "h",
    operations: [],
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
  },
  valid: false,
  issues: [],
});
function fixture() {
  let finish!: (value: Response) => void,
    finishPlans!: (value: Response) => void;
  let blockPlans = false;
  const calls: string[] = [];
  const api = new HttpApi((async (path, init) => {
    const url = String(path);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (init?.method === "PUT" && url.includes("/annotations/"))
      return new Promise<Response>((r) => (finish = r));
    if (url.endsWith("/approved"))
      return new Response(
        JSON.stringify({ code: "NOT_APPROVED", message: "notes changed" }),
        { status: 409 },
      );
    let value: unknown = [];
    if (url.endsWith("/snapshot")) value = snapshot;
    else if (url.includes("/annotations?"))
      value = {
        items: [detail()],
        total: 1,
        offset: 0,
        limit: 20,
        truncated: false,
        snapshotId: "s1",
      };
    else if (url.endsWith("/plans")) {
      if (blockPlans) return new Promise<Response>((r) => (finishPlans = r));
      value = [plan(3)];
    }
    return new Response(JSON.stringify(value));
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project: { id: "p", path: "/p", name: "p" },
    summary: {
      project: { id: "p", path: "/p", name: "p" },
      snapshotId: "s1",
      contentHash: "h",
      entrypoints: snapshot.nodes,
      entrypointTotal: 5,
      entrypointsTruncated: false,
      counts: {
        files: 2,
        folders: 1,
        functions: 2,
        relations: 1,
        calls: { resolved: 1, unresolved: 0, external: 0 },
      },
      diagnostics: [],
      coverage: snapshot.coverage,
      dataSource: "code",
    },
    selectedNode: snapshot.nodes[1],
  });
  const begin = () => {
    const editor = openAnnotationDraft(
      app.annotations.store.getState().editor!,
      detail(),
    );
    const started = beginAnnotationRequest(
      changeAnnotationDraft(editor, { text: "submitted" }),
      "save",
    );
    app.annotations.setEditor(started.state);
    return app.annotations.submit(started.request);
  };
  return {
    app,
    calls,
    begin,
    finish: () => finish(new Response(JSON.stringify(note()))),
    block: () => {
      blockPlans = true;
    },
    finishPlans: () => finishPlans(new Response(JSON.stringify([plan(3)]))),
  };
}
test("notes ACK updates actual plan once and preserves group draft, view and source; existing knowledge lane blocks competing writes", async () => {
  const f = fixture();
  await f.app.annotations.activate();
  f.app.store.setState({
    plan: plan(),
    plans: [plan()],
    groupDraft: {
      title: "draft",
      description: "keep",
      source: "user",
      memberIds: ["domain:a"],
    },
    view: {
      positions: { "domain:a": { x: 17, y: 23 } },
      theme: "dark",
      locale: "en",
    },
    source: { filePath: "src/a.ts", content: "unchanged" },
  });
  const before = f.app.store.getState(),
    pending = f.begin();
  expect(f.app.store.getState().busy.knowledge).toBe(true);
  await f.app.approve();
  expect(f.calls.some((call) => call.includes("/approve"))).toBe(false);
  f.finish();
  await pending;
  const after = f.app.store.getState();
  expect(after.plan?.plan.revision).toBe(3);
  expect(after.groupDraft).toBe(before.groupDraft);
  expect(after.view).toBe(before.view);
  expect(after.source).toBe(before.source);
  expect(after.busy.knowledge).toBe(false);
  expect(f.calls.filter((call) => call.endsWith("/plans"))).toHaveLength(1);
  f.app.disposeAnnotations();
});
test("dirty planning editor retains exact title/body/CAS basis while old approval is made unusable", async () => {
  const f = fixture();
  await f.app.annotations.activate();
  const local = plan();
  local.valid = true;
  local.plan.title = "unsaved editor basis";
  f.app.store.setState({ plan: local, plans: [local] });
  f.app.setPlanEditorDirty(true);
  const pending = f.begin();
  f.finish();
  await pending;
  expect(f.app.store.getState().plan).toMatchObject({
    plan: local.plan,
    valid: false,
  });
  expect(f.app.store.getState().plan?.plan).toBe(local.plan);
  expect(f.app.store.getState().plans[0]?.plan.revision).toBe(3);
  expect(f.app.store.getState().dirtyPlanEditor).toBe(true);
  f.app.disposeAnnotations();
});
test("late plan reread cannot change the user's newly chosen planning context", async () => {
  const f = fixture();
  await f.app.annotations.activate();
  f.app.store.setState({ plan: plan(), plans: [plan()] });
  f.block();
  const pending = f.begin();
  f.finish();
  await expect
    .poll(() => f.calls.filter((call) => call.endsWith("/plans")).length)
    .toBe(1);
  const other = plan(8);
  other.plan.id = "other";
  f.app.store.setState({ plan: other, plans: [other] });
  f.finishPlans();
  await pending;
  expect(f.app.store.getState().plan).toBe(other);
  expect(f.app.store.getState().plans).toEqual([other]);
  expect(f.app.annotations.store.getState().executionBlocked).toBe(true);
  f.app.disposeAnnotations();
});
test("virtual planned node cannot become annotation source identity; graph relation remains exact domain relation", () => {
  const f = fixture();
  f.app.store.setState({
    selectedNode: {
      id: "temporary:x",
      kind: "function",
      name: "fake",
      filePath: "src/a.ts",
    },
  });
  expect(f.app.annotations.store.getState().selection).toBeUndefined();
  f.app.store.setState({
    graph: {
      nodes: snapshot.nodes,
      relations: snapshot.relations,
      snapshotId: "s1",
      dataSource: "code",
      truncated: false,
    },
    relationPreviewId: "call:a-b",
  });
  expect(
    f.app.annotations.store.getState().scope?.selectionVersion,
  ).toBeGreaterThan(1);
  f.app.disposeAnnotations();
});

test("unknown note write gates approve/verify/current export request counts until full current reread, while dirty note draft remains", async () => {
  let available = false,
    writes = 0;
  const calls: string[] = [];
  const api = new HttpApi((async (path, init) => {
    const url = String(path);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (init?.method === "POST" && url.endsWith("/annotations")) {
      writes++;
      throw Error("lost ACK");
    }
    if (url.endsWith("/approved"))
      return available
        ? new Response(
            JSON.stringify({ code: "NOT_APPROVED", message: "current draft" }),
            { status: 409 },
          )
        : new Response(
            JSON.stringify({ code: "READ_UNAVAILABLE", message: "blocked" }),
            { status: 503 },
          );
    let value: unknown = [];
    if (url.endsWith("/snapshot")) value = snapshot;
    else if (url.includes("/annotations?"))
      value = {
        items: [],
        total: 0,
        offset: 0,
        limit: 20,
        truncated: false,
        snapshotId: "s1",
      };
    else if (url.endsWith("/plans")) value = [plan(3)];
    return new Response(JSON.stringify(value));
  }) as typeof fetch);
  const app = createWorkspace(api);
  const f = fixture();
  app.store.setState({
    ...f.app.store.getState(),
    plan: plan(),
    plans: [plan()],
  });
  f.app.disposeAnnotations();
  await app.annotations.activate();
  const started = beginAnnotationRequest(
    changeAnnotationDraft(app.annotations.store.getState().editor!, {
      text: "retain unknown",
    }),
    "save",
  );
  app.annotations.setEditor(started.state);
  await app.annotations.submit(started.request);
  expect(app.annotations.store.getState().executionBlocked).toBe(true);
  const count = calls.length;
  await app.approve();
  await app.verify();
  await app.exportPlan("json", () => {});
  expect(calls.length).toBe(count);
  expect(app.store.getState().error).toBe("KNOWLEDGE_READ_REQUIRED");
  await app.annotations.reload();
  expect(app.annotations.store.getState().executionBlocked).toBe(true);
  available = true;
  await app.annotations.reload();
  expect(app.annotations.store.getState().executionBlocked).toBe(false);
  await app.approve();
  expect(
    calls.filter(
      (call) => call.includes("/approve") && !call.endsWith("/approved"),
    ),
  ).toHaveLength(1);
  expect(writes).toBe(1);
  expect(
    app.annotations.store.getState().editor?.drafts[
      app.annotations.store.getState().editor!.activeKey
    ],
  ).toMatchObject({ text: "retain unknown", dirty: true, uncertain: true });
  app.disposeAnnotations();
});
