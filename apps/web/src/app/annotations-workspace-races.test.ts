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
  activeAnnotationDraft,
} from "../features/annotations/draft.js";
import type { PlanDetail } from "@codemap/core";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const notApproved = () =>
  json({ code: "NOT_APPROVED", message: "current draft" }, 409);
const unavailable = () =>
  json({ code: "READ_UNAVAILABLE", message: "read unavailable" }, 503);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function plan(id: string, revision = 2): PlanDetail {
  return {
    plan: {
      id,
      projectId: "p",
      title: id,
      description: "",
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
  };
}
function fixture() {
  const calls: string[] = [];
  let approvalAvailable = false,
    holdApproval: ReturnType<typeof deferred<Response>> | undefined,
    holdNotes: ReturnType<typeof deferred<Response>> | undefined,
    heldWrite: ReturnType<typeof deferred<Response>> | undefined;
  let approvalEntered = 0,
    notesEntered = 0,
    writes = 0;
  const notes = () =>
    json({
      items: [detail()],
      total: 1,
      offset: 0,
      limit: 20,
      truncated: false,
      snapshotId: "s1",
    });
  const api = new HttpApi((async (path, init) => {
    const url = String(path),
      method = init?.method ?? "GET";
    calls.push(method + " " + url);
    if (method === "POST" && url.endsWith("/annotations")) {
      writes++;
      throw Error("actual outcome unknown in controlled transport");
    }
    if (method === "PUT" && url.includes("/annotations/")) {
      writes++;
      heldWrite = deferred<Response>();
      return heldWrite.promise;
    }
    if (url.endsWith("/approved")) {
      approvalEntered++;
      if (holdApproval) {
        const own = holdApproval;
        holdApproval = undefined;
        return own.promise;
      }
      return approvalAvailable ? notApproved() : unavailable();
    }
    if (url.includes("/annotations?")) {
      notesEntered++;
      if (holdNotes) {
        const own = holdNotes;
        holdNotes = undefined;
        return own.promise;
      }
      return notes();
    }
    if (url.endsWith("/snapshot")) return json(snapshot);
    if (url.endsWith("/plans")) return json([plan("A", 3), plan("B", 4)]);
    if (url === "/api/plans/A") return json(plan("A"));
    if (url === "/api/plans/B") return json(plan("B"));
    return json({});
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project: { id: "p", name: "p", path: "/p" },
    summary: {
      project: { id: "p", name: "p", path: "/p" },
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
    plan: plan("A"),
    plans: [plan("A"), plan("B")],
  });
  const seedUnknown = async () => {
    await app.annotations.activate();
    const started = beginAnnotationRequest(
      changeAnnotationDraft(app.annotations.store.getState().editor!, {
        text: "unknown original UUID",
      }),
      "save",
    );
    app.annotations.setEditor(started.state);
    await app.annotations.submit(started.request);
    expect(app.annotations.store.getState().executionBlocked).toBe(true);
    expect(
      activeAnnotationDraft(app.annotations.store.getState().editor!)
        .annotationId,
    ).toBeUndefined();
  };
  const assertNoExecution = async () => {
    const count = calls.length;
    await app.approve();
    await app.verify();
    await app.exportPlan("json", () => {});
    expect(calls.length).toBe(count);
  };
  return {
    app,
    calls,
    seedUnknown,
    assertNoExecution,
    available: () => {
      approvalAvailable = true;
    },
    holdApproval: () => {
      const barrier = deferred<Response>();
      holdApproval = barrier;
      const before = approvalEntered;
      return {
        release: () => barrier.resolve(notApproved()),
        entered: () => approvalEntered > before,
      };
    },
    holdNotes: () => {
      const barrier = deferred<Response>();
      holdNotes = barrier;
      const before = notesEntered;
      return {
        release: () => barrier.resolve(notes()),
        entered: () => notesEntered > before,
      };
    },
    beginSecond: () => {
      const started = beginAnnotationRequest(
        changeAnnotationDraft(
          openAnnotationDraft(
            app.annotations.store.getState().editor!,
            detail(),
          ),
          { text: "second unknown body" },
        ),
        "save",
      );
      app.annotations.setEditor(started.state);
      return app.annotations.submit(started.request);
    },
    loseSecond: () => heldWrite!.reject(Error("second lost ACK")),
    writes: () => writes,
  };
}
for (const phase of ["strong approval", "notes proof"] as const)
  for (const aba of [false, true])
    test(`I1 ${phase} barrier ${aba ? "A→B→A" : "A→B"} retains current collection, unknown UUID and execution lock`, async () => {
      const f = fixture();
      await f.seedUnknown();
      f.available();
      const barrier =
        phase === "strong approval" ? f.holdApproval() : f.holdNotes();
      const recovering = f.app.annotations.reload();
      await expect.poll(barrier.entered).toBe(true);
      await f.app.choosePlan("B");
      if (aba) await f.app.choosePlan("A");
      const collection = [plan("B", 9), plan("A", 8)];
      f.app.store.setState({ plans: collection });
      const editor = f.app.annotations.store.getState().editor!,
        local = activeAnnotationDraft(editor);
      barrier.release();
      await recovering;
      expect(f.app.store.getState().plans).toBe(collection);
      expect(f.app.annotations.store.getState().executionBlocked).toBe(true);
      expect(
        activeAnnotationDraft(f.app.annotations.store.getState().editor!),
      ).toEqual(local);
      await f.assertNoExecution();
      await f.app.annotations.reload();
      expect(f.app.annotations.store.getState().executionBlocked).toBe(false);
      expect(
        activeAnnotationDraft(f.app.annotations.store.getState().editor!)
          .annotationId,
      ).toBeUndefined();
      expect(f.writes()).toBe(1);
      f.app.disposeAnnotations();
    });
test("I2 old recovery cannot clear newer lost-ACK write generation, even with cached ready reads and busy=false afterwards", async () => {
  const f = fixture();
  await f.seedUnknown();
  const barrier = f.holdApproval(),
    recovering = f.app.annotations.reload();
  await expect.poll(barrier.entered).toBe(true);
  const writing = f.beginSecond();
  expect(f.app.store.getState().busy.knowledge).toBe(true);
  barrier.release();
  await recovering;
  f.loseSecond();
  await writing;
  expect(f.app.store.getState().busy.knowledge).toBe(false);
  expect(f.app.annotations.store.getState().executionBlocked).toBe(true);
  expect(
    activeAnnotationDraft(f.app.annotations.store.getState().editor!),
  ).toMatchObject({
    text: "second unknown body",
    dirty: true,
    uncertain: true,
    annotationId: "note:a",
  });
  await f.assertNoExecution();
  expect(f.writes()).toBe(2);
  f.available();
  await f.app.annotations.reload();
  expect(f.app.annotations.store.getState().executionBlocked).toBe(false);
  expect(
    activeAnnotationDraft(f.app.annotations.store.getState().editor!),
  ).toMatchObject({
    text: "second unknown body",
    dirty: true,
    uncertain: true,
    annotationId: "note:a",
  });
  expect(f.writes()).toBe(2);
  f.app.disposeAnnotations();
});
test("I2 skipped current reads cannot use old ready cache as a recovery receipt", async () => {
  const f = fixture();
  await f.seedUnknown();
  const barrier = f.holdApproval(),
    recovering = f.app.annotations.reload();
  await expect.poll(barrier.entered).toBe(true);
  f.app.store.setState({ busy: { refresh: true } });
  barrier.release();
  await recovering;
  expect(f.app.annotations.store.getState().executionBlocked).toBe(true);
  await f.assertNoExecution();
  f.app.store.setState({ busy: {} });
  f.available();
  await f.app.annotations.reload();
  expect(f.app.annotations.store.getState().executionBlocked).toBe(false);
  expect(
    activeAnnotationDraft(f.app.annotations.store.getState().editor!)
      .annotationId,
  ).toBeUndefined();
  expect(f.writes()).toBe(1);
  f.app.disposeAnnotations();
});
