import { expect, test } from "vitest";
import { HttpApi } from "../../api/client.js";
import { createAnnotationsController } from "./controller.js";
import { snapshot, detail } from "./fixtures.test-support.js";
import {
  beginAnnotationRequest,
  changeAnnotationDraft,
  activeAnnotationDraft,
  openAnnotationDraft,
} from "./draft.js";
const response = (value: unknown) => new Response(JSON.stringify(value));
function setup(transport: typeof fetch) {
  let scene = {
    projectId: "p",
    snapshotId: "s1",
    selection: { kind: "node" as const, id: "domain:b" },
    busy: false,
    planId: undefined as string | undefined,
  };
  const accepted: string[] = [];
  const controller = createAnnotationsController({
    api: new HttpApi(transport),
    current: () => scene,
    afterMutation: async (id) => {
      accepted.push(id);
      return { isCurrent: () => true };
    },
  });
  return {
    controller,
    accepted,
    scene: (patch: Partial<typeof scene>) => {
      scene = { ...scene, ...patch };
      controller.synchronize();
    },
  };
}
test("real HTTP facade uses encoded owners, exact captured SID/CAS/actor and distinct delete endpoint", async () => {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const api = new HttpApi((async (path, init) => {
    calls.push({
      path: String(path),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return response({});
  }) as typeof fetch);
  await api.bindAnnotation("p/a", "note/b", {
    expectedRevision: 3,
    snapshotId: "s1",
    target: { kind: "node", id: "domain:b" },
  });
  await api.deleteAnnotation("p/a", "note/b", { expectedRevision: 3 });
  await api.createAnnotation("p/a", {
    text: "retained",
    author: "actual actor",
    source: "user",
    isConstraint: true,
    binding: null,
  });
  expect(calls).toEqual([
    {
      path: "/api/projects/p%2Fa/annotations/note%2Fb/binding",
      method: "PUT",
      body: {
        expectedRevision: 3,
        snapshotId: "s1",
        target: { kind: "node", id: "domain:b" },
      },
    },
    {
      path: "/api/projects/p%2Fa/annotations/note%2Fb",
      method: "DELETE",
      body: { expectedRevision: 3 },
    },
    {
      path: "/api/projects/p%2Fa/annotations",
      method: "POST",
      body: {
        text: "retained",
        author: "actual actor",
        source: "user",
        isConstraint: true,
        binding: null,
      },
    },
  ]);
});
test("selection is actual complete HTTP snapshot and ignores virtual/group/foreign capture identities", async () => {
  const { controller, scene } = setup((async (path) =>
    response(
      String(path).endsWith("/snapshot")
        ? snapshot
        : {
            items: [detail()],
            total: 1,
            offset: 0,
            limit: 20,
            truncated: false,
            snapshotId: "s1",
          },
    )) as typeof fetch);
  await controller.activate();
  expect(controller.store.getState().selection?.target).toEqual({
    kind: "node",
    id: "domain:b",
  });
  scene({ selection: { kind: "node", id: "virtual:b" } });
  expect(controller.store.getState().selection).toBeUndefined();
  scene({ snapshotId: "s2" });
  expect(controller.store.getState().selection).toBeUndefined();
});
test("late ACK retains independently edited generation and actual returned source/revision; no duplicate dispatch", async () => {
  let finish!: (r: Response) => void;
  let writes = 0;
  const { controller } = setup((async (path, init) => {
    if (init?.method === "PUT") {
      writes++;
      return new Promise<Response>((r) => (finish = r));
    }
    return response(
      String(path).endsWith("/snapshot")
        ? snapshot
        : {
            items: [detail()],
            total: 1,
            offset: 0,
            limit: 20,
            truncated: false,
            snapshotId: "s1",
          },
    );
  }) as typeof fetch);
  await controller.activate();
  let editor = openAnnotationDraft(
    controller.store.getState().editor!,
    detail(),
  );
  editor = changeAnnotationDraft(editor, { text: "submitted" });
  const started = beginAnnotationRequest(editor, "save");
  controller.setEditor(started.state);
  const pending = controller.submit(started.request);
  await controller.submit(started.request);
  expect(writes).toBe(1);
  controller.setEditor(
    changeAnnotationDraft(controller.store.getState().editor!, {
      text: "later local",
    }),
  );
  const reply = detail();
  reply.annotation.text = "submitted";
  reply.annotation.revision = 4;
  finish(response(reply));
  await pending;
  expect(
    activeAnnotationDraft(controller.store.getState().editor!),
  ).toMatchObject({
    text: "later local",
    dirty: true,
    basisRevision: 4,
    source: "agent",
    uncertain: false,
  });
});
test("A→B→A epoch quarantines old ACK and current local draft survives", async () => {
  let finish!: (r: Response) => void;
  const { controller, scene } = setup((async (path, init) => {
    if (init?.method === "POST")
      return new Promise<Response>((r) => (finish = r));
    return response(
      String(path).endsWith("/snapshot")
        ? snapshot
        : {
            items: [],
            total: 0,
            offset: 0,
            limit: 20,
            truncated: false,
            snapshotId: "s1",
          },
    );
  }) as typeof fetch);
  await controller.activate();
  const first = beginAnnotationRequest(
    changeAnnotationDraft(controller.store.getState().editor!, {
      text: "old intent",
    }),
    "save",
  );
  controller.setEditor(first.state);
  const pending = controller.submit(first.request);
  scene({ projectId: "other" });
  scene({ projectId: "p" });
  controller.setEditor(
    changeAnnotationDraft(controller.store.getState().editor!, {
      text: "new intent",
    }),
  );
  const note = detail();
  note.annotation = {
    ...note.annotation,
    revision: 1,
    text: "old intent",
    author: "User",
    source: "user",
    binding: null,
  };
  finish(response(note));
  await pending;
  expect(
    activeAnnotationDraft(controller.store.getState().editor!),
  ).toMatchObject({ text: "new intent", dirty: true, uncertain: true });
  expect(
    activeAnnotationDraft(controller.store.getState().editor!).annotationId,
  ).toBeUndefined();
});
test("lost create ACK and failed/matching refetch never infer UUID or resend the mutation", async () => {
  let writes = 0;
  const { controller } = setup((async (path, init) => {
    if (init?.method === "POST") {
      writes++;
      throw Error("lost ACK");
    }
    return response(
      String(path).endsWith("/snapshot")
        ? snapshot
        : {
            items: [],
            total: 0,
            offset: 0,
            limit: 20,
            truncated: false,
            snapshotId: "s1",
          },
    );
  }) as typeof fetch);
  await controller.activate();
  const first = beginAnnotationRequest(
    changeAnnotationDraft(controller.store.getState().editor!, {
      text: "unknown",
    }),
    "save",
  );
  controller.setEditor(first.state);
  await controller.submit(first.request);
  await controller.reload();
  await controller.submit(first.request);
  expect(writes).toBe(1);
  expect(
    activeAnnotationDraft(controller.store.getState().editor!),
  ).toMatchObject({ text: "unknown", dirty: true, uncertain: true });
  expect(
    activeAnnotationDraft(controller.store.getState().editor!).annotationId,
  ).toBeUndefined();
});
test("409 remains local conflict and mutation invalidation runs only once; actual approval export owns history", async () => {
  const { controller, accepted } = setup((async (path, init) => {
    if (init?.method === "PUT")
      return new Response(
        JSON.stringify({ code: "REVISION_CONFLICT", message: "stale" }),
        { status: 409 },
      );
    return response(
      String(path).endsWith("/snapshot")
        ? snapshot
        : {
            items: [detail()],
            total: 1,
            offset: 0,
            limit: 20,
            truncated: false,
            snapshotId: "s1",
          },
    );
  }) as typeof fetch);
  await controller.activate();
  const first = beginAnnotationRequest(
    changeAnnotationDraft(
      openAnnotationDraft(controller.store.getState().editor!, detail()),
      { text: "keep" },
    ),
    "save",
  );
  controller.setEditor(first.state);
  await controller.submit(first.request);
  expect(accepted).toEqual([]);
  expect(
    activeAnnotationDraft(controller.store.getState().editor!),
  ).toMatchObject({ text: "keep", dirty: true, uncertain: false });
  expect(controller.store.getState().editor?.error?.code).toBe(
    "REVISION_CONFLICT",
  );
});

test("busy spans accepted workspace reread; callback failure is separate from a valid write receipt", async () => {
  let release!: () => void;
  const controller = createAnnotationsController({
    current: () => ({ projectId: "p", snapshotId: "s1", busy: false }),
    afterMutation: () =>
      new Promise<{ isCurrent: () => boolean }>(
        (r) => (release = () => r({ isCurrent: () => true })),
      ),
    api: new HttpApi((async (path, init) => {
      if (init?.method === "PUT") {
        const reply = detail();
        reply.annotation.text = "accepted";
        reply.annotation.revision = 4;
        return response(reply);
      }
      return response(
        String(path).endsWith("/snapshot")
          ? snapshot
          : {
              items: [detail()],
              total: 1,
              offset: 0,
              limit: 20,
              truncated: false,
              snapshotId: "s1",
            },
      );
    }) as typeof fetch),
  });
  await controller.activate();
  const started = beginAnnotationRequest(
    changeAnnotationDraft(
      openAnnotationDraft(controller.store.getState().editor!, detail()),
      { text: "accepted" },
    ),
    "save",
  );
  controller.setEditor(started.state);
  const pending = controller.submit(started.request);
  await expect.poll(() => typeof release).toBe("function");
  expect(controller.store.getState().mutating).toBe(true);
  expect(
    activeAnnotationDraft(controller.store.getState().editor!),
  ).toMatchObject({ text: "accepted", dirty: false, basisRevision: 4 });
  release();
  await pending;
  expect(controller.store.getState().mutating).toBe(false);
});

test("current notes and captured approval remain distinct, strict export owner/tamper never downgrade to legacy", async () => {
  let bad = false;
  const scene = {
    projectId: "p",
    snapshotId: "s1",
    planId: "plan",
    busy: false,
  };
  const approval = {
    id: "approval",
    planId: "plan",
    revision: 2,
    semanticHash: "a".repeat(64),
    baselineSnapshotId: "s0",
    baselineContentHash: "old",
    approvedAt: "2026-10-10T00:00:00.000Z",
    actor: "user",
    reviewContext: { version: 1, knowledgeHash: "b".repeat(64) },
  };
  const controller = createAnnotationsController({
    current: () => scene,
    afterMutation: async () => ({ isCurrent: () => true }),
    api: new HttpApi((async (path) => {
      if (String(path).includes("/export?"))
        return response({
          plan: { id: "plan", projectId: "p" },
          approvedPlan: {
            id: "plan",
            projectId: bad ? "foreign" : "p",
            revision: 2,
          },
          approval,
          contextStatus: "v1",
          annotationContext: {
            version: 1,
            projectId: "p",
            snapshotId: "s0",
            annotations: [],
          },
        });
      return response(
        String(path).endsWith("/snapshot")
          ? snapshot
          : {
              items: [detail()],
              total: 1,
              offset: 0,
              limit: 20,
              truncated: false,
              snapshotId: "s1",
            },
      );
    }) as typeof fetch),
  });
  await controller.activate();
  expect(controller.store.getState().approved).toMatchObject({
    approvalId: "approval",
    contextStatus: "v1",
    context: { snapshotId: "s0", annotations: [] },
  });
  expect(controller.store.getState().page?.value?.items[0]?.annotation.id).toBe(
    "note:a",
  );
  bad = true;
  await controller.reload();
  expect(controller.store.getState().approved).toBeUndefined();
  expect(controller.store.getState().approvalError).toBe(
    "APPROVAL_CONTEXT_INVALID",
  );
});

test("unknown execution lock persists across failed current rereads and recovers without clearing draft or replaying UUID", async () => {
  let available = false,
    writes = 0;
  const controller = createAnnotationsController({
    current: () => ({ projectId: "p", snapshotId: "s1", busy: false }),
    afterMutation: async () => {
      if (!available) throw Error("read failed");
      return { isCurrent: () => true };
    },
    api: new HttpApi((async (path, init) => {
      if (init?.method === "POST") {
        writes++;
        throw Error("lost ACK");
      }
      return response(
        String(path).endsWith("/snapshot")
          ? snapshot
          : {
              items: [],
              total: 0,
              offset: 0,
              limit: 20,
              truncated: false,
              snapshotId: "s1",
            },
      );
    }) as typeof fetch),
  });
  await controller.activate();
  const started = beginAnnotationRequest(
    changeAnnotationDraft(controller.store.getState().editor!, {
      text: "unknown actual outcome",
    }),
    "save",
  );
  controller.setEditor(started.state);
  await controller.submit(started.request);
  expect(controller.store.getState().executionBlocked).toBe(true);
  await controller.reload();
  expect(controller.store.getState().executionBlocked).toBe(true);
  available = true;
  await controller.reload();
  expect(controller.store.getState().executionBlocked).toBe(false);
  expect(writes).toBe(1);
  expect(
    activeAnnotationDraft(controller.store.getState().editor!),
  ).toMatchObject({
    dirty: true,
    uncertain: true,
    text: "unknown actual outcome",
  });
  expect(
    activeAnnotationDraft(controller.store.getState().editor!).annotationId,
  ).toBeUndefined();
});
test("history GET paging retains owner and selected note and never sends a mutation", async () => {
  const calls: string[] = [];
  const { controller } = setup((async (path, init) => {
    calls.push(`${init?.method ?? "GET"} ${path}`);
    return response(
      String(path).includes("/history")
        ? {
            items: [
              {
                annotation: detail().annotation,
                action: "orphan",
                recordedAt: "2026-10-10T00:00:00.000Z",
              },
            ],
            total: 1,
            offset: 0,
            limit: 20,
            truncated: false,
          }
        : String(path).endsWith("/snapshot")
          ? snapshot
          : {
              items: [detail()],
              total: 1,
              offset: 0,
              limit: 20,
              truncated: false,
              snapshotId: "s1",
            },
    );
  }) as typeof fetch);
  await controller.activate();
  await controller.history("note:a", { offset: 0, limit: 20 });
  expect(controller.store.getState().history).toMatchObject({
    annotationId: "note:a",
    status: "ready",
    value: {
      items: [
        { action: "orphan", annotation: { source: "agent", revision: 3 } },
      ],
    },
  });
  expect(calls).toContain(
    "GET /api/projects/p/annotations/note%3Aa/history?offset=0&limit=20",
  );
  expect(calls.every((call) => call.startsWith("GET "))).toBe(true);
});
