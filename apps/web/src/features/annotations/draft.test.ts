import { expect, test } from "vitest";
import { DomainError } from "@codemap/core";
import { scope, snapshot, detail } from "./fixtures.test-support.js";
import {
  createAnnotationEditor,
  activeAnnotationDraft,
  changeAnnotationDraft,
  openAnnotationDraft,
  observeAnnotationDraft,
  reloadAnnotationDraft,
  synchronizeAnnotationScope,
  prepareAnnotationCandidate,
  cancelAnnotationCandidate,
  confirmAnnotationDelete,
  beginAnnotationRequest,
  acceptAnnotationReply,
  rejectAnnotationRequest,
} from "./draft.js";
function edited() {
  return changeAnnotationDraft(
    openAnnotationDraft(createAnnotationEditor(scope, "User"), detail()),
    { text: "local new text" },
  );
}
function code(fn: () => unknown, want: string) {
  try {
    fn();
    throw Error("expected failure");
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(want);
  }
}
test("content create works without a plan or target and immutable source is user", () => {
  let state = createAnnotationEditor(scope, "User");
  state = changeAnnotationDraft(state, {
    text: "independent",
    author: "  writer  ",
    isConstraint: true,
  });
  const started = beginAnnotationRequest(state, "save");
  expect(started.request).toMatchObject({
    kind: "create",
    projectId: "p",
    input: {
      text: "independent",
      author: "writer",
      source: "user",
      isConstraint: true,
      binding: null,
    },
  });
  expect(activeAnnotationDraft(started.state).text).toBe("independent");
  code(
    () => changeAnnotationDraft(state, { source: "agent" } as never),
    "INVALID_INPUT",
  );
});
test("edit emits exact record revision CAS and does not mutate creation source", () => {
  const state = edited(),
    started = beginAnnotationRequest(state, "save");
  expect(started.request).toMatchObject({
    kind: "update",
    projectId: "p",
    annotationId: "note:a",
    input: {
      expectedRevision: 3,
      text: "local new text",
      author: "作者",
      isConstraint: true,
    },
  });
  expect(started.request.input).not.toHaveProperty("source");
  expect(activeAnnotationDraft(state).source).toBe("agent");
  expect(detail().annotation.text).toBe("<script>retained</script>");
});
test.each([
  { kind: "node", id: "domain:a" },
  { kind: "node", id: "file:a" },
  { kind: "node", id: "folder:src" },
  { kind: "relation", id: "call:a-b" },
] as const)(
  "explicit %j binding preserves kind/domain/snapshot identity",
  (target) => {
    const state = prepareAnnotationCandidate(edited(), snapshot, target),
      request = beginAnnotationRequest(state, "bind").request;
    expect(request).toMatchObject({
      kind: "bind",
      annotationId: "note:a",
      input: { expectedRevision: 3, target, snapshotId: "s1" },
    });
    expect(request.input).not.toHaveProperty("text");
  },
);
test.each([
  { kind: "node", id: "flow:domain:a" },
  { kind: "node", id: "external:a" },
  { kind: "node", id: "same" },
  { kind: "relation", id: "domain:a" },
] as const)(
  "display, external, same name or wrong namespace %j cannot bind",
  (target) => {
    expect(() =>
      prepareAnnotationCandidate(edited(), snapshot, target),
    ).toThrow();
  },
);
test("candidate preparation and cancellation produce no write; unconfirmed save cannot smuggle a binding", () => {
  const original = edited(),
    candidate = prepareAnnotationCandidate(original, snapshot, {
      kind: "node",
      id: "domain:b",
    });
  expect(candidate.pending).toBeUndefined();
  expect(cancelAnnotationCandidate(candidate).candidate).toBeUndefined();
  expect(
    beginAnnotationRequest(candidate, "save").request.input,
  ).not.toHaveProperty("binding");
  const fresh = prepareAnnotationCandidate(
    changeAnnotationDraft(createAnnotationEditor(scope, "User"), {
      text: "new",
    }),
    snapshot,
    { kind: "node", id: "domain:a" },
  );
  code(() => beginAnnotationRequest(fresh, "save"), "CONFIRM_BINDING_REQUIRED");
  expect(beginAnnotationRequest(fresh, "bind").request).toMatchObject({
    kind: "create",
    input: {
      binding: { snapshotId: "s1", target: { kind: "node", id: "domain:a" } },
    },
  });
});
test("snapshot and selection changes clear candidates/pending/errors and retain per-project per-note body", () => {
  let state = prepareAnnotationCandidate(edited(), snapshot, {
    kind: "node",
    id: "domain:a",
  });
  state = beginAnnotationRequest(state, "bind").state;
  const next = synchronizeAnnotationScope(
    state,
    { ...scope, snapshotId: "s2", selectionVersion: 1 },
    "User",
  );
  expect(next.pending).toBeUndefined();
  expect(next.candidate).toBeUndefined();
  expect(activeAnnotationDraft(next).text).toBe("local new text");
  code(
    () =>
      prepareAnnotationCandidate(next, snapshot, {
        kind: "node",
        id: "domain:a",
      }),
    "SNAPSHOT_CHANGED",
  );
});
test("A to B to A cannot let an old ACK clear a new draft or pending request", () => {
  const initial = beginAnnotationRequest(edited(), "save");
  let next = synchronizeAnnotationScope(
    initial.state,
    { projectId: "b", snapshotId: "sb", epoch: 2, selectionVersion: 0 },
    "User",
  );
  next = changeAnnotationDraft(next, { text: "B body" });
  next = synchronizeAnnotationScope(next, { ...scope, epoch: 3 }, "User");
  expect(activeAnnotationDraft(next).text).toBe("local new text");
  // Leaving an already sent request makes its outcome unknown; explicit reload is a user decision.
  code(() => beginAnnotationRequest(next, "save"), "REQUEST_OUTCOME_UNKNOWN");
  next = reloadAnnotationDraft(next);
  next = changeAnnotationDraft(next, { text: "A newer body" });
  const current = beginAnnotationRequest(next, "save");
  expect(
    acceptAnnotationReply(current.state, initial.request.token, {
      ...detail(),
      annotation: {
        ...detail().annotation,
        revision: 4,
        text: "local new text",
      },
    }),
  ).toEqual(current.state);
  expect(activeAnnotationDraft(current.state).text).toBe("A newer body");
  const b = synchronizeAnnotationScope(
    current.state,
    { projectId: "b", snapshotId: "sb", epoch: 4, selectionVersion: 0 },
    "User",
  );
  expect(activeAnnotationDraft(b).text).toBe("B body");
});
test("successful exact ACK accepts server revision; older submitted generation preserves newer body", () => {
  const begun = beginAnnotationRequest(edited(), "save"),
    reply = {
      ...detail(),
      annotation: {
        ...detail().annotation,
        revision: 4,
        text: "local new text",
      },
    };
  const accepted = acceptAnnotationReply(
    begun.state,
    begun.request.token,
    reply,
  );
  expect(activeAnnotationDraft(accepted)).toMatchObject({
    basisRevision: 4,
    text: "local new text",
    dirty: false,
  });
  const changed = changeAnnotationDraft(begun.state, {
      text: "edited while pending",
    }),
    kept = acceptAnnotationReply(changed, begun.request.token, reply);
  expect(activeAnnotationDraft(kept)).toMatchObject({
    basisRevision: 4,
    text: "edited while pending",
    dirty: true,
  });
  expect(beginAnnotationRequest(kept, "save").request.input).toMatchObject({
    expectedRevision: 4,
    text: "edited while pending",
  });
});
test("wrong reply ownership/revision/content never signals success or clears draft", () => {
  const begun = beginAnnotationRequest(edited(), "save");
  for (const annotation of [
    {
      ...detail().annotation,
      projectId: "b",
      revision: 4,
      text: "local new text",
    },
    { ...detail().annotation, revision: 2, text: "local new text" },
    { ...detail().annotation, revision: 4, text: "different body" },
  ]) {
    const kept = acceptAnnotationReply(begun.state, begun.request.token, {
      ...detail(),
      annotation,
    });
    expect(activeAnnotationDraft(kept).text).toBe("local new text");
    expect(kept.error?.code).toBe("INVALID_ANNOTATION_REPLY");
  }
});
test("lost ACK and subsequent refetch never clear or silently rebase the local draft", () => {
  const begun = beginAnnotationRequest(edited(), "save"),
    failed = rejectAnnotationRequest(begun.state, begun.request.token, {
      code: "REQUEST_OUTCOME_UNKNOWN",
    }),
    server = {
      ...detail(),
      annotation: {
        ...detail().annotation,
        revision: 4,
        text: "local new text",
      },
    };
  const observed = observeAnnotationDraft(failed, server);
  expect(activeAnnotationDraft(observed)).toMatchObject({
    text: "local new text",
    basisRevision: 3,
    dirty: true,
    uncertain: true,
  });
  code(
    () => beginAnnotationRequest(observed, "save"),
    "REQUEST_OUTCOME_UNKNOWN",
  );
  const explicit = reloadAnnotationDraft(observed);
  expect(activeAnnotationDraft(explicit)).toMatchObject({
    basisRevision: 4,
    dirty: false,
    uncertain: false,
  });
});
test("CAS and snapshot conflicts preserve draft and only explicit reload adopts the current revision", () => {
  const begun = beginAnnotationRequest(edited(), "save"),
    failed = rejectAnnotationRequest(begun.state, begun.request.token, {
      code: "REVISION_CONFLICT",
    });
  expect(activeAnnotationDraft(failed).text).toBe("local new text");
  const observed = observeAnnotationDraft(failed, {
    ...detail(),
    annotation: { ...detail().annotation, revision: 5, text: "remote body" },
  });
  code(() => beginAnnotationRequest(observed, "save"), "REVISION_CONFLICT");
  expect(activeAnnotationDraft(reloadAnnotationDraft(observed))).toMatchObject({
    text: "remote body",
    basisRevision: 5,
    dirty: false,
  });
});
test("delete requires explicit per-note confirmation, detach remains a distinct content-preserving request", () => {
  const state = edited();
  code(
    () => beginAnnotationRequest(state, "delete"),
    "CONFIRM_DELETE_REQUIRED",
  );
  expect(
    beginAnnotationRequest(confirmAnnotationDelete(state, true), "delete")
      .request,
  ).toMatchObject({
    kind: "delete",
    annotationId: "note:a",
    input: { expectedRevision: 3 },
  });
  expect(beginAnnotationRequest(state, "detach").request).toMatchObject({
    kind: "bind",
    input: { expectedRevision: 3, target: null },
  });
  expect(activeAnnotationDraft(state).text).toBe("local new text");
});
test("a late list observation cannot regress revision or clear independently edited drafts", () => {
  const initial = edited(),
    observed = observeAnnotationDraft(initial, {
      ...detail(),
      annotation: { ...detail().annotation, revision: 6, text: "new server" },
    });
  expect(observeAnnotationDraft(observed, detail())).toEqual(observed);
  const other = {
    ...detail(),
    annotation: { ...detail().annotation, id: "note:b", text: "another" },
  };
  let next = openAnnotationDraft(observed, other);
  next = changeAnnotationDraft(next, { text: "note B local" });
  next = openAnnotationDraft(next, detail());
  expect(activeAnnotationDraft(next).text).toBe("local new text");
  next = openAnnotationDraft(next, other);
  expect(activeAnnotationDraft(next).text).toBe("note B local");
});

test("a changed server revision invalidates an already opened deletion confirmation", () => {
  const confirmed = confirmAnnotationDelete(
    openAnnotationDraft(createAnnotationEditor(scope, "User"), detail()),
    true,
  );
  const changed = observeAnnotationDraft(confirmed, {
    ...detail(),
    annotation: { ...detail().annotation, revision: 4, text: "another writer" },
  });
  expect(changed.deleteConfirmed).toBe(false);
  code(
    () => beginAnnotationRequest(changed, "delete"),
    "CONFIRM_DELETE_REQUIRED",
  );
});
test("bind ACK accepts only selected provenance and keeps independently unsaved content", () => {
  const state = prepareAnnotationCandidate(edited(), snapshot, {
      kind: "node",
      id: "domain:b",
    }),
    begun = beginAnnotationRequest(state, "bind");
  const reply = {
    ...detail(),
    annotation: {
      ...detail().annotation,
      revision: 4,
      binding: {
        state: "bound" as const,
        target: { kind: "node" as const, id: "domain:b" },
        selectedSnapshotId: "s1",
        lastKnown: {
          label: "same",
          filePath: "src/b.ts",
          nodeKind: "function" as const,
        },
      },
    },
    resolution: { status: "bound" as const, snapshotId: "s1" },
  };
  expect(
    activeAnnotationDraft(
      acceptAnnotationReply(begun.state, begun.request.token, reply),
    ),
  ).toMatchObject({ text: "local new text", basisRevision: 4, dirty: true });
  const wrong = {
    ...reply,
    annotation: {
      ...reply.annotation,
      binding: {
        ...reply.annotation.binding,
        lastKnown: {
          ...reply.annotation.binding.lastKnown,
          filePath: "src/a.ts",
        },
      },
    },
  };
  expect(
    acceptAnnotationReply(begun.state, begun.request.token, wrong).error?.code,
  ).toBe("INVALID_ANNOTATION_REPLY");
});
test("a valid old ACK cannot regress a newer observed server record", () => {
  const begun = beginAnnotationRequest(edited(), "save"),
    observed = observeAnnotationDraft(begun.state, {
      ...detail(),
      annotation: { ...detail().annotation, revision: 6, text: "new server" },
    });
  const kept = acceptAnnotationReply(observed, begun.request.token, {
    ...detail(),
    annotation: { ...detail().annotation, revision: 4, text: "local new text" },
  });
  expect(activeAnnotationDraft(kept)).toMatchObject({
    text: "local new text",
    basisRevision: 3,
    accepted: expect.objectContaining({ revision: 6 }),
  });
  expect(kept.error?.code).toBe("REVISION_CONFLICT");
});
test("unknown create outcome and matching list record do not infer its identity or discard the draft", () => {
  const initial = changeAnnotationDraft(createAnnotationEditor(scope, "User"), {
      text: "new independent",
    }),
    begun = beginAnnotationRequest(initial, "save");
  const unknown = rejectAnnotationRequest(begun.state, begun.request.token, {
    code: "NETWORK_ERROR",
  });
  const matched = observeAnnotationDraft(unknown, {
    annotation: {
      ...detail().annotation,
      id: "new-server-id",
      revision: 1,
      text: "new independent",
      author: "User",
      source: "user",
      isConstraint: false,
      binding: null,
    },
    resolution: { status: "unbound", snapshotId: "s1" },
  });
  expect(activeAnnotationDraft(matched)).toMatchObject({
    text: "new independent",
    dirty: true,
    uncertain: true,
  });
  expect(activeAnnotationDraft(matched).annotationId).toBeUndefined();
  code(
    () => beginAnnotationRequest(matched, "save"),
    "REQUEST_OUTCOME_UNKNOWN",
  );
});
test("malformed deletion receipt cannot complete deletion or clear local content", () => {
  const begun = beginAnnotationRequest(
    confirmAnnotationDelete(edited(), true),
    "delete",
  );
  const kept = acceptAnnotationReply(begun.state, begun.request.token, {
    id: "wrong",
    revision: 4,
    deletedAt: "2026-10-10T00:00:00.000Z",
  });
  expect(kept.error?.code).toBe("INVALID_ANNOTATION_REPLY");
  expect(activeAnnotationDraft(kept)).toMatchObject({
    text: "local new text",
    uncertain: true,
    accepted: expect.objectContaining({ id: "note:a", revision: 3 }),
  });
});
