import { createStore } from "zustand/vanilla";
import {
  annotationSchema,
  snapshotSchema,
  approvalSchema,
  approvedAnnotationContextSchema,
  selectAnnotationTarget,
  type CodeSnapshot,
  type AnnotationTarget,
  type AnnotationPage,
  type AnnotationHistoryInput,
  type AnnotationListInput,
} from "@codemap/core";
import { ApiError, type HttpApi } from "../../api/client.js";
import {
  createAnnotationEditor,
  synchronizeAnnotationScope,
  annotationScopeKey,
  acceptAnnotationReply,
  rejectAnnotationRequest,
  observeAnnotationDraft,
  type AnnotationScope,
  type AnnotationEditorState,
  type AnnotationRequest,
} from "./draft.js";
import {
  annotationReadMatches,
  validAnnotationPage,
  type AnnotationRead,
  type AnnotationHistoryRead,
  type ApprovedAnnotationRead,
} from "./reads.js";
export type AnnotationScene = {
  projectId?: string;
  snapshotId?: string;
  planId?: string;
  selection?: AnnotationTarget;
  busy: boolean;
};
export type AnnotationControllerState = {
  scope?: AnnotationScope;
  editor?: AnnotationEditorState;
  page?: AnnotationRead<AnnotationPage>;
  history?: AnnotationHistoryRead;
  approved?: ApprovedAnnotationRead;
  selection?: { snapshot: CodeSnapshot; target: AnnotationTarget };
  snapshot?: CodeSnapshot;
  mutating: boolean;
  executionBlocked: boolean;
  historicalExport?: string;
  snapshotError?: string;
  approvalError?: string;
  synchronizationError?: string;
};
export type AnnotationSynchronizationReceipt = { isCurrent: () => boolean };
export function createAnnotationsController(ports: {
  api: Pick<
    HttpApi,
    | "snapshot"
    | "annotations"
    | "annotation"
    | "annotationHistory"
    | "createAnnotation"
    | "updateAnnotation"
    | "bindAnnotation"
    | "deleteAnnotation"
    | "export"
  >;
  current: () => AnnotationScene;
  afterMutation: (
    projectId: string,
  ) => Promise<AnnotationSynchronizationReceipt>;
}) {
  const store = createStore<AnnotationControllerState>(() => ({
    mutating: false,
    executionBlocked: false,
  }));
  let projectId: string | undefined,
    snapshotId: string | undefined,
    selectionKey = "",
    planId: string | undefined,
    epoch = 0,
    selectionVersion = 0;
  let active = false,
    listSequence = 0,
    historySequence = 0,
    snapshotSequence = 0,
    approvalSequence = 0;
  const dispatched = new Set<string>();
  const blockedProjects = new Set<string>();
  const writeGenerations = new Map<string, number>();
  const generation = (owner: string) => writeGenerations.get(owner) ?? 0;
  const errorCode = (error: unknown) =>
    error instanceof ApiError
      ? error.code
      : error instanceof Error
        ? error.message
        : "READ_FAILED";
  const matches = (scope: AnnotationScope) => {
    const now = store.getState().scope;
    return !!now && annotationReadMatches(now, scope);
  };
  const selected = () => {
    const state = store.getState(),
      scene = ports.current(),
      snapshot = state.snapshot;
    if (
      !snapshot ||
      !state.scope ||
      snapshot.id !== scene.snapshotId ||
      snapshot.projectId !== scene.projectId ||
      !scene.selection
    )
      return;
    try {
      selectAnnotationTarget(snapshot, {
        snapshotId: snapshot.id,
        target: scene.selection,
      });
      return { snapshot, target: scene.selection };
    } catch {
      return;
    }
  };
  const setEditor = (editor: AnnotationEditorState) => {
    const scope = store.getState().scope;
    if (scope && annotationScopeKey(editor.scope) === annotationScopeKey(scope))
      store.setState({ editor });
  };
  const list = async (input: AnnotationListInput = {}) => {
    const scope = store.getState().scope;
    if (!scope || ports.current().busy) return;
    const sequence = ++listSequence;
    store.setState({ page: { scope, status: "loading" } });
    try {
      const page = await ports.api.annotations(scope.projectId, input);
      if (sequence !== listSequence || !matches(scope)) return;
      if (!validAnnotationPage(scope, page))
        throw Error("INVALID_ANNOTATION_REPLY");
      let editor = store.getState().editor!;
      for (const item of page.items)
        editor = observeAnnotationDraft(editor, item);
      store.setState({ page: { scope, status: "ready", value: page }, editor });
      return true;
    } catch (error) {
      if (sequence === listSequence && matches(scope))
        store.setState({
          page: { scope, status: "error", error: errorCode(error) },
        });
    }
  };
  const loadSnapshot = async () => {
    const scope = store.getState().scope;
    if (!scope || !scope.snapshotId || ports.current().busy) return;
    const sequence = ++snapshotSequence;
    try {
      const snapshot = snapshotSchema.parse(
        await ports.api.snapshot(scope.projectId),
      );
      if (sequence !== snapshotSequence || !matches(scope)) return;
      if (
        snapshot.id !== scope.snapshotId ||
        snapshot.projectId !== scope.projectId
      )
        throw Error("SNAPSHOT_CHANGED");
      store.setState({ snapshot, snapshotError: undefined });
      store.setState({ selection: selected() });
      return true;
    } catch (error) {
      if (sequence === snapshotSequence && matches(scope))
        store.setState({
          snapshot: undefined,
          selection: undefined,
          snapshotError: errorCode(error),
        });
    }
  };
  const history = async (
    annotationId: string,
    input: AnnotationHistoryInput = {},
  ) => {
    const scope = store.getState().scope;
    if (!scope || ports.current().busy) return;
    const sequence = ++historySequence;
    store.setState({ history: { scope, annotationId, status: "loading" } });
    try {
      const page = await ports.api.annotationHistory(
        scope.projectId,
        annotationId,
        input,
      );
      if (sequence !== historySequence || !matches(scope)) return;
      if (
        !page ||
        !Number.isSafeInteger(page.total) ||
        page.total < 0 ||
        !Number.isSafeInteger(page.offset) ||
        page.offset < 0 ||
        !Number.isSafeInteger(page.limit) ||
        page.limit < 1 ||
        page.limit > 100 ||
        !Array.isArray(page.items) ||
        page.items.length > page.limit ||
        page.items.some((item) => {
          const note = annotationSchema.safeParse(item.annotation);
          return (
            !note.success ||
            note.data.projectId !== scope.projectId ||
            note.data.id !== annotationId ||
            !["create", "edit", "bind", "detach", "orphan", "delete"].includes(
              item.action,
            )
          );
        })
      )
        throw Error("INVALID_ANNOTATION_REPLY");
      store.setState({
        history: { scope, annotationId, status: "ready", value: page },
      });
    } catch (error) {
      if (sequence === historySequence && matches(scope))
        store.setState({
          history: {
            scope,
            annotationId,
            status: "error",
            error: errorCode(error),
          },
        });
    }
  };
  const loadApproval = async () => {
    const scope = store.getState().scope,
      id = ports.current().planId;
    const sequence = ++approvalSequence;
    store.setState({
      approved: undefined,
      historicalExport: undefined,
      approvalError: undefined,
    });
    if (!scope || !id || ports.current().busy) return;
    try {
      const exported = JSON.parse(await ports.api.export(id, "json"));
      if (
        sequence !== approvalSequence ||
        !matches(scope) ||
        ports.current().planId !== id
      )
        return;
      if (!exported.approval) return;
      const approval = approvalSchema.parse(exported.approval);
      if (
        approval.planId !== id ||
        exported.plan?.id !== id ||
        exported.plan?.projectId !== scope.projectId ||
        exported.approvedPlan?.id !== id ||
        exported.approvedPlan?.projectId !== scope.projectId ||
        exported.approvedPlan?.revision !== approval.revision
      )
        throw Error("APPROVAL_CONTEXT_INVALID");
      const historicalExport = JSON.stringify(
        {
          approval: exported.approval,
          approvedPlan: exported.approvedPlan,
          contextStatus: exported.contextStatus,
          ...(exported.annotationContext
            ? { annotationContext: exported.annotationContext }
            : {}),
        },
        null,
        2,
      );
      if (
        exported.contextStatus === "legacy" &&
        !approval.reviewContext &&
        exported.annotationContext === undefined
      )
        store.setState({
          approved: { scope, approvalId: approval.id, contextStatus: "legacy" },
          historicalExport,
        });
      else {
        const context = approvedAnnotationContextSchema.parse(
          exported.annotationContext,
        );
        if (
          exported.contextStatus !== "v1" ||
          !approval.reviewContext ||
          context.projectId !== scope.projectId ||
          context.snapshotId !== approval.baselineSnapshotId
        )
          throw Error("APPROVAL_CONTEXT_INVALID");
        store.setState({
          approved: {
            scope,
            approvalId: approval.id,
            contextStatus: "v1",
            context,
          },
          historicalExport,
        });
      }
    } catch (error) {
      if (
        sequence === approvalSequence &&
        matches(scope) &&
        ports.current().planId === id
      )
        store.setState({
          approved: undefined,
          historicalExport: undefined,
          approvalError: errorCode(error),
        });
    }
  };
  const reload = async (annotationId?: string, recover = true) => {
    const scope = store.getState().scope;
    if (!scope || ports.current().busy) return;
    const observedGeneration = generation(scope.projectId);
    let receipt: AnnotationSynchronizationReceipt | undefined;
    if (recover && store.getState().executionBlocked)
      try {
        receipt = await ports.afterMutation(scope.projectId);
      } catch (error) {
        if (matches(scope))
          store.setState({ synchronizationError: errorCode(error) });
      }
    const sequence = listSequence;
    if (annotationId)
      try {
        const item = await ports.api.annotation(scope.projectId, annotationId);
        if (matches(scope) && sequence === listSequence) {
          const parsed = annotationSchema.parse(item.annotation);
          if (
            parsed.projectId !== scope.projectId ||
            parsed.id !== annotationId
          )
            throw Error("INVALID_ANNOTATION_REPLY");
          store.setState({
            editor: observeAnnotationDraft(store.getState().editor!, item),
          });
        }
      } catch (error) {
        if (matches(scope))
          store.setState({ synchronizationError: errorCode(error) });
      }
    const openedHistory = store.getState().history;
    const [notesRead, snapshotRead] = await Promise.all([
      list(),
      loadSnapshot(),
      loadApproval(),
      ...(openedHistory && matches(openedHistory.scope)
        ? [
            history(openedHistory.annotationId, {
              offset: openedHistory.value?.offset ?? 0,
              limit: openedHistory.value?.limit ?? 20,
            }),
          ]
        : []),
    ]);
    const fresh = !!(
      matches(scope) &&
      observedGeneration === generation(scope.projectId) &&
      !store.getState().mutating &&
      !ports.current().busy &&
      notesRead &&
      store.getState().page?.value?.snapshotId === scope.snapshotId &&
      (!scope.snapshotId || snapshotRead)
    );
    if (fresh && receipt?.isCurrent()) {
      blockedProjects.delete(scope.projectId);
      store.setState({
        executionBlocked: false,
        synchronizationError: undefined,
      });
    }
    return fresh;
  };
  const synchronize = () => {
    const scene = ports.current();
    const changedProject = scene.projectId !== projectId;
    const changedCapture = changedProject || scene.snapshotId !== snapshotId;
    const key = JSON.stringify(scene.selection ?? null),
      changedSelection = changedCapture || key !== selectionKey;
    const changedPlan = changedProject || scene.planId !== planId;
    if (changedProject) epoch++;
    if (changedSelection) selectionVersion++;
    projectId = scene.projectId;
    snapshotId = scene.snapshotId;
    selectionKey = key;
    planId = scene.planId;
    if (!projectId) {
      store.setState({
        scope: undefined,
        page: undefined,
        history: undefined,
        approved: undefined,
        historicalExport: undefined,
        selection: undefined,
        snapshot: undefined,
      });
      return;
    }
    const scope = { projectId, snapshotId, epoch, selectionVersion };
    let editor = store.getState().editor;
    editor = editor
      ? synchronizeAnnotationScope(editor, scope, "User")
      : createAnnotationEditor(scope, "User");
    store.setState({
      scope,
      editor,
      executionBlocked: blockedProjects.has(projectId),
      ...(changedCapture
        ? {
            snapshot: undefined,
            page: undefined,
            history: undefined,
            approved: undefined,
            historicalExport: undefined,
            selection: undefined,
            approvalError: undefined,
            synchronizationError: undefined,
          }
        : {}),
    });
    store.setState({ selection: selected() });
    if (active && !scene.busy) {
      if (changedCapture || !store.getState().page) void reload();
      else if (changedPlan) void loadApproval();
    }
  };
  const activate = async () => {
    synchronize();
    active = true;
    await reload();
  };
  const submit = async (request: AnnotationRequest) => {
    const state = store.getState(),
      own = state.editor?.pending?.request;
    const key = JSON.stringify(request.token);
    if (
      !own ||
      JSON.stringify(own) !== JSON.stringify(request) ||
      dispatched.has(key) ||
      state.mutating ||
      ports.current().busy ||
      request.projectId !== ports.current().projectId
    )
      return;
    const previouslyBlocked = state.executionBlocked;
    const writeGeneration = generation(request.projectId) + 1;
    writeGenerations.set(request.projectId, writeGeneration);
    blockedProjects.add(request.projectId);
    dispatched.add(key);
    store.setState({
      mutating: true,
      executionBlocked: true,
      synchronizationError: undefined,
    });
    let changed = false;
    try {
      const reply = await (request.kind === "create"
        ? ports.api.createAnnotation(request.projectId, request.input)
        : request.kind === "update"
          ? ports.api.updateAnnotation(
              request.projectId,
              request.annotationId,
              request.input,
            )
          : request.kind === "bind"
            ? ports.api.bindAnnotation(
                request.projectId,
                request.annotationId,
                request.input,
              )
            : ports.api.deleteAnnotation(
                request.projectId,
                request.annotationId,
                request.input,
              ));
      changed = true;
      const editor = store.getState().editor;
      if (editor)
        store.setState({
          editor: acceptAnnotationReply(editor, request.token, reply),
        });
    } catch (error) {
      const code = errorCode(error),
        editor = store.getState().editor;
      if (editor)
        store.setState({
          editor: rejectAnnotationRequest(editor, request.token, { code }),
        });
      changed = !(
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      );
    }
    let receipt: AnnotationSynchronizationReceipt | undefined;
    try {
      if (changed) receipt = await ports.afterMutation(request.projectId);
    } catch (error) {
      if (store.getState().scope?.projectId === request.projectId)
        store.setState({ synchronizationError: errorCode(error) });
    } finally {
      if (
        !changed &&
        !previouslyBlocked &&
        generation(request.projectId) === writeGeneration
      )
        blockedProjects.delete(request.projectId);
      store.setState({
        mutating: false,
        executionBlocked: blockedProjects.has(
          store.getState().scope?.projectId ?? "",
        ),
      });
    }
    const originalScope = JSON.parse(request.token.scope) as [
      string,
      string | null,
      number,
      number,
    ];
    const current = store.getState().scope;
    if (
      changed &&
      current?.projectId === request.projectId &&
      current.epoch === originalScope[2]
    ) {
      const fresh = await reload(undefined, false);
      if (
        fresh &&
        receipt?.isCurrent() &&
        generation(request.projectId) === writeGeneration &&
        matches(current)
      ) {
        blockedProjects.delete(current.projectId);
        store.setState({
          executionBlocked: false,
          synchronizationError: undefined,
        });
      }
    }
  };
  return {
    store,
    synchronize,
    activate,
    deactivate: () => {
      active = false;
    },
    setEditor,
    list,
    history,
    reload,
    submit,
  };
}
export type AnnotationsController = ReturnType<
  typeof createAnnotationsController
>;
