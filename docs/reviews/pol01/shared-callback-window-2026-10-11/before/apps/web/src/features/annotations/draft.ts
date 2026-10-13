import {
  DomainError,
  annotationSchema,
  createAnnotationSchema,
  updateAnnotationSchema,
  bindAnnotationSchema,
  selectAnnotationTarget,
  type Annotation,
  type AnnotationBinding,
  type AnnotationContent,
  type AnnotationDetail,
  type AnnotationTarget,
  type CodeSnapshot,
  type CreateAnnotationInput,
  type UpdateAnnotationInput,
  type BindAnnotationInput,
  type DeleteAnnotationResult,
} from "@codemap/core";
export type AnnotationScope = {
  projectId: string;
  snapshotId?: string;
  epoch: number;
  selectionVersion: number;
};
export const annotationScopeKey = (scope: AnnotationScope): string =>
  JSON.stringify([
    scope.projectId,
    scope.snapshotId ?? null,
    scope.epoch,
    scope.selectionVersion,
  ]);
const draftKey = (projectId: string, id?: string) =>
  JSON.stringify([projectId, id ?? null]);
export type AnnotationDraft = AnnotationContent & {
  source: "user" | "agent";
  annotationId?: string;
  accepted?: Annotation;
  basisRevision?: number;
  basis: AnnotationContent;
  generation: number;
  dirty: boolean;
  uncertain: boolean;
};
export type AnnotationRequestToken = {
  scope: string;
  key: string;
  sequence: number;
  generation: number;
};
type RequestBase = { projectId: string; token: AnnotationRequestToken };
export type AnnotationRequest =
  | (RequestBase & { kind: "create"; input: CreateAnnotationInput })
  | (RequestBase & {
      kind: "update";
      annotationId: string;
      input: UpdateAnnotationInput;
    })
  | (RequestBase & {
      kind: "bind";
      annotationId: string;
      input: BindAnnotationInput;
    })
  | (RequestBase & {
      kind: "delete";
      annotationId: string;
      input: { expectedRevision: number };
    });
export type AnnotationEditorState = {
  scope: AnnotationScope;
  activeKey: string;
  activeByProject: Record<string, string>;
  drafts: Record<string, AnnotationDraft>;
  sequence: number;
  candidate?: { scope: string; binding: AnnotationBinding };
  deleteConfirmed: boolean;
  deleteRevision?: number;
  pending?: {
    request: AnnotationRequest;
    before?: Annotation;
    binding: AnnotationBinding | null;
  };
  error?: { code: string };
};
const content = (note: AnnotationContent): AnnotationContent => ({
  text: note.text,
  author: note.author,
  isConstraint: note.isConstraint,
});
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function fail(code: string): never {
  throw new DomainError(
    code,
    "Annotation draft cannot submit in its current state.",
  );
}
function validScope(scope: AnnotationScope): void {
  if (
    !scope.projectId ||
    !Number.isSafeInteger(scope.epoch) ||
    scope.epoch < 0 ||
    !Number.isSafeInteger(scope.selectionVersion) ||
    scope.selectionVersion < 0
  )
    fail("INVALID_INPUT");
}
function fresh(author: string): AnnotationDraft {
  const basis = { text: "", author, isConstraint: false };
  return {
    ...basis,
    basis,
    source: "user",
    generation: 0,
    dirty: false,
    uncertain: false,
  };
}
export function createAnnotationEditor(
  scope: AnnotationScope,
  author: string,
): AnnotationEditorState {
  validScope(scope);
  const activeKey = draftKey(scope.projectId);
  return {
    scope: { ...scope },
    activeKey,
    activeByProject: { [scope.projectId]: activeKey },
    drafts: { [activeKey]: fresh(author) },
    sequence: 0,
    deleteConfirmed: false,
  };
}
export function activeAnnotationDraft(
  state: AnnotationEditorState,
): AnnotationDraft {
  const draft = state.drafts[state.activeKey];
  if (!draft) return fail("INVALID_INPUT");
  return draft;
}
function replaceDraft(
  state: AnnotationEditorState,
  key: string,
  draft: AnnotationDraft,
): AnnotationEditorState {
  return { ...state, drafts: { ...state.drafts, [key]: draft } };
}
export function synchronizeAnnotationScope(
  state: AnnotationEditorState,
  scope: AnnotationScope,
  author: string,
): AnnotationEditorState {
  validScope(scope);
  if (annotationScopeKey(scope) === annotationScopeKey(state.scope))
    return state;
  let next = state;
  if (state.pending) {
    const key = state.pending.request.token.key,
      draft = state.drafts[key];
    if (draft) next = replaceDraft(state, key, { ...draft, uncertain: true });
  }
  const activeKey =
    scope.projectId === state.scope.projectId
      ? state.activeKey
      : (next.activeByProject[scope.projectId] ?? draftKey(scope.projectId));
  const drafts = next.drafts[activeKey]
    ? next.drafts
    : { ...next.drafts, [activeKey]: fresh(author) };
  return {
    ...next,
    scope: { ...scope },
    activeKey,
    activeByProject: { ...next.activeByProject, [scope.projectId]: activeKey },
    drafts,
    candidate: undefined,
    pending: undefined,
    error: undefined,
    deleteConfirmed: false,
  };
}
function noteDraft(note: Annotation): AnnotationDraft {
  const basis = content(note);
  return {
    ...basis,
    basis,
    source: note.source,
    annotationId: note.id,
    accepted: structuredClone(note),
    basisRevision: note.revision,
    generation: 0,
    dirty: false,
    uncertain: false,
  };
}
export function observeAnnotationDraft(
  state: AnnotationEditorState,
  detail: AnnotationDetail,
): AnnotationEditorState {
  const note = annotationSchema.parse(detail.annotation);
  if (note.projectId !== state.scope.projectId) return state;
  const key = draftKey(note.projectId, note.id),
    draft = state.drafts[key];
  if (draft?.accepted && note.revision < draft.accepted.revision) return state;
  if (!draft) return replaceDraft(state, key, noteDraft(note));
  const observedState =
    state.activeKey === key &&
    state.deleteConfirmed &&
    draft.accepted?.revision !== note.revision
      ? { ...state, deleteConfirmed: false, deleteRevision: undefined }
      : state;
  // Refresh is observation, never a receipt for an uncertain or independently edited write.
  if (
    draft.dirty ||
    draft.uncertain ||
    state.pending?.request.token.key === key
  )
    return replaceDraft(observedState, key, {
      ...draft,
      accepted: structuredClone(note),
    });
  return replaceDraft(observedState, key, {
    ...noteDraft(note),
    generation: draft.generation,
  });
}
export function openAnnotationDraft(
  state: AnnotationEditorState,
  detail?: AnnotationDetail,
  author = "User",
): AnnotationEditorState {
  if (detail && detail.annotation.projectId !== state.scope.projectId)
    return fail("PROJECT_MISMATCH");
  const next = detail ? observeAnnotationDraft(state, detail) : state;
  const key = draftKey(state.scope.projectId, detail?.annotation.id);
  return {
    ...next,
    activeKey: key,
    activeByProject: { ...next.activeByProject, [state.scope.projectId]: key },
    drafts: next.drafts[key]
      ? next.drafts
      : { ...next.drafts, [key]: fresh(author) },
    candidate: undefined,
    error: undefined,
    deleteConfirmed: false,
  };
}
export function changeAnnotationDraft(
  state: AnnotationEditorState,
  patch: Partial<AnnotationContent>,
): AnnotationEditorState {
  if (
    Object.keys(patch).some(
      (k) => !["text", "author", "isConstraint"].includes(k),
    ) ||
    (patch.text !== undefined && typeof patch.text !== "string") ||
    (patch.author !== undefined && typeof patch.author !== "string") ||
    (patch.isConstraint !== undefined &&
      typeof patch.isConstraint !== "boolean")
  )
    return fail("INVALID_INPUT");
  const draft = activeAnnotationDraft(state);
  if (draft.accepted?.deletedAt) return fail("NOT_FOUND");
  if (draft.generation === Number.MAX_SAFE_INTEGER)
    return fail("INVALID_INPUT");
  const changed = { ...draft, ...patch, generation: draft.generation + 1 };
  changed.dirty = !equal(content(changed), draft.basis);
  return {
    ...replaceDraft(state, state.activeKey, changed),
    error: undefined,
    deleteConfirmed: false,
  };
}
export function reloadAnnotationDraft(
  state: AnnotationEditorState,
): AnnotationEditorState {
  if (state.pending) return fail("ANNOTATION_PENDING");
  const draft = activeAnnotationDraft(state);
  const next = draft.accepted
    ? { ...noteDraft(draft.accepted), generation: draft.generation + 1 }
    : { ...fresh(draft.author), generation: draft.generation + 1 };
  return {
    ...replaceDraft(state, state.activeKey, next),
    candidate: undefined,
    error: undefined,
    deleteConfirmed: false,
  };
}
export function prepareAnnotationCandidate(
  state: AnnotationEditorState,
  snapshot: CodeSnapshot,
  target: AnnotationTarget,
): AnnotationEditorState {
  if (snapshot.projectId !== state.scope.projectId)
    return fail("PROJECT_MISMATCH");
  if (snapshot.id !== state.scope.snapshotId) return fail("SNAPSHOT_CHANGED");
  const binding = selectAnnotationTarget(snapshot, {
    snapshotId: snapshot.id,
    target,
  });
  return {
    ...state,
    candidate: { scope: annotationScopeKey(state.scope), binding },
    error: undefined,
    deleteConfirmed: false,
  };
}
export function cancelAnnotationCandidate(
  state: AnnotationEditorState,
): AnnotationEditorState {
  return { ...state, candidate: undefined };
}
export function confirmAnnotationDelete(
  state: AnnotationEditorState,
  confirmed: boolean,
): AnnotationEditorState {
  if (!activeAnnotationDraft(state).accepted) return fail("NOT_FOUND");
  return {
    ...state,
    deleteConfirmed: confirmed,
    deleteRevision: confirmed
      ? activeAnnotationDraft(state).basisRevision
      : undefined,
  };
}
export function beginAnnotationRequest(
  state: AnnotationEditorState,
  action: "save" | "bind" | "detach" | "delete",
): { state: AnnotationEditorState; request: AnnotationRequest } {
  if (state.pending) return fail("ANNOTATION_PENDING");
  const draft = activeAnnotationDraft(state);
  if (draft.uncertain) return fail("REQUEST_OUTCOME_UNKNOWN");
  if (draft.accepted?.deletedAt) return fail("NOT_FOUND");
  if (draft.accepted && draft.basisRevision !== draft.accepted.revision)
    return fail("REVISION_CONFLICT");
  if (state.sequence === Number.MAX_SAFE_INTEGER) return fail("INVALID_INPUT");
  const token = {
    scope: annotationScopeKey(state.scope),
    key: state.activeKey,
    sequence: state.sequence + 1,
    generation: draft.generation,
  };
  const base = { projectId: state.scope.projectId, token };
  let request: AnnotationRequest;
  let binding: AnnotationBinding | null = draft.accepted?.binding ?? null;
  if (action === "bind") {
    if (!state.candidate || state.candidate.scope !== token.scope)
      return fail("SNAPSHOT_CHANGED");
    binding = state.candidate.binding;
  }
  if (!draft.annotationId) {
    if (action === "delete" || action === "detach") return fail("NOT_FOUND");
    if (action === "save" && state.candidate)
      return fail("CONFIRM_BINDING_REQUIRED");
    request = {
      ...base,
      kind: "create",
      input: createAnnotationSchema.parse({
        ...content(draft),
        source: "user",
        binding:
          action === "bind"
            ? {
                snapshotId: binding!.selectedSnapshotId,
                target: binding!.target,
              }
            : null,
      }),
    };
    if (action === "save") binding = null;
  } else if (action === "save")
    request = {
      ...base,
      kind: "update",
      annotationId: draft.annotationId,
      input: updateAnnotationSchema.parse({
        ...content(draft),
        expectedRevision: draft.basisRevision,
      }),
    };
  else if (action === "delete") {
    if (!state.deleteConfirmed || state.deleteRevision !== draft.basisRevision)
      return fail("CONFIRM_DELETE_REQUIRED");
    request = {
      ...base,
      kind: "delete",
      annotationId: draft.annotationId,
      input: { expectedRevision: draft.basisRevision! },
    };
  } else {
    if (action === "detach") binding = null;
    request = {
      ...base,
      kind: "bind",
      annotationId: draft.annotationId,
      input: bindAnnotationSchema.parse({
        expectedRevision: draft.basisRevision,
        ...(action === "detach"
          ? { target: null }
          : {
              target: binding!.target,
              snapshotId: binding!.selectedSnapshotId,
            }),
      }),
    };
  }
  return {
    state: {
      ...state,
      sequence: token.sequence,
      pending: {
        request: structuredClone(request),
        before: draft.accepted ? structuredClone(draft.accepted) : undefined,
        binding: structuredClone(binding),
      },
      error: undefined,
      deleteConfirmed: false,
    },
    request,
  };
}
function currentRequest(
  state: AnnotationEditorState,
  token: AnnotationRequestToken,
): boolean {
  const own = state.pending?.request.token;
  return (
    !!own &&
    token.scope === annotationScopeKey(state.scope) &&
    own.scope === token.scope &&
    own.key === token.key &&
    own.sequence === token.sequence &&
    own.generation === token.generation
  );
}
export function rejectAnnotationRequest(
  state: AnnotationEditorState,
  token: AnnotationRequestToken,
  error: { code: string },
): AnnotationEditorState {
  if (!currentRequest(state, token)) return state;
  const draft = state.drafts[token.key]!;
  const known = [
    "REVISION_CONFLICT",
    "SNAPSHOT_CHANGED",
    "INVALID_INPUT",
    "NOT_FOUND",
    "PROJECT_MISMATCH",
  ].includes(error.code);
  return {
    ...replaceDraft(state, token.key, { ...draft, uncertain: !known }),
    pending: undefined,
    error: {
      code:
        known || error.code === "INVALID_ANNOTATION_REPLY"
          ? error.code
          : "REQUEST_OUTCOME_UNKNOWN",
    },
  };
}
/** Only this exact request receipt may clear the submitted generation; list equality is not an ACK. */
export function acceptAnnotationReply(
  state: AnnotationEditorState,
  token: AnnotationRequestToken,
  reply: AnnotationDetail | DeleteAnnotationResult,
): AnnotationEditorState {
  if (!currentRequest(state, token)) return state;
  const pending = state.pending!,
    request = pending.request,
    draft = state.drafts[token.key]!;
  let note: Annotation;
  try {
    if (request.kind === "delete") {
      if (
        !("deletedAt" in reply) ||
        reply.id !== request.annotationId ||
        reply.revision !== request.input.expectedRevision + 1 ||
        !pending.before
      )
        return rejectAnnotationRequest(state, token, {
          code: "INVALID_ANNOTATION_REPLY",
        });
      note = annotationSchema.parse({
        ...pending.before,
        revision: reply.revision,
        deletedAt: reply.deletedAt,
        updatedAt: reply.deletedAt,
      });
    } else {
      if (!("annotation" in reply))
        return rejectAnnotationRequest(state, token, {
          code: "INVALID_ANNOTATION_REPLY",
        });
      note = annotationSchema.parse(reply.annotation);
      if (
        note.projectId !== request.projectId ||
        note.deletedAt ||
        (request.kind !== "create" && note.id !== request.annotationId)
      )
        throw Error("ownership");
      if (
        reply.resolution.snapshotId !== undefined &&
        reply.resolution.snapshotId !== state.scope.snapshotId
      )
        throw Error("snapshot");
      const expected =
        request.kind === "create"
          ? request.input
          : request.kind === "update"
            ? request.input
            : pending.before!;
      if (
        !equal(content(note), content(expected)) ||
        note.source !==
          (request.kind === "create" ? "user" : pending.before!.source) ||
        !equal(note.binding, pending.binding)
      )
        throw Error("semantics");
      if (
        request.kind === "create"
          ? note.revision !== 1
          : note.revision !== request.input.expectedRevision &&
            note.revision !== request.input.expectedRevision + 1
      )
        throw Error("revision");
      if (
        request.kind !== "create" &&
        note.revision === request.input.expectedRevision &&
        !equal(note, pending.before)
      )
        throw Error("changed no-op");
    }
  } catch {
    return {
      ...rejectAnnotationRequest(state, token, {
        code: "INVALID_ANNOTATION_REPLY",
      }),
      error: { code: "INVALID_ANNOTATION_REPLY" },
    };
  }
  if (draft.accepted && draft.accepted.revision > note.revision)
    return {
      ...state,
      pending: undefined,
      error: { code: "REVISION_CONFLICT" },
    };
  const key = draftKey(note.projectId, note.id),
    exact = draft.generation === token.generation;
  // Bind/detach acknowledge the accepted body, never unrelated unsaved content.
  const clear = exact && equal(content(draft), content(note));
  const nextDraft: AnnotationDraft = clear
    ? { ...noteDraft(note), generation: draft.generation }
    : {
        ...draft,
        annotationId: note.id,
        source: note.source,
        accepted: structuredClone(note),
        basisRevision: note.revision,
        basis: content(note),
        dirty: !equal(content(draft), content(note)),
        uncertain: false,
      };
  const drafts = { ...state.drafts, [key]: nextDraft };
  if (request.kind === "create") delete drafts[token.key];
  return {
    ...state,
    drafts,
    activeKey: state.activeKey === token.key ? key : state.activeKey,
    activeByProject:
      state.activeKey === token.key
        ? { ...state.activeByProject, [note.projectId]: key }
        : state.activeByProject,
    pending: undefined,
    candidate: undefined,
    error: undefined,
    deleteConfirmed: false,
  };
}
