import {
  DomainError,
  createAnnotationSchema,
  updateAnnotationSchema,
  type AnnotationListInput,
  type AnnotationHistoryInput,
  type AnnotationPage,
  type AnnotationTarget,
  type CodeSnapshot,
} from "@codemap/core";
import {
  activeAnnotationDraft,
  annotationScopeKey,
  beginAnnotationRequest,
  cancelAnnotationCandidate,
  changeAnnotationDraft,
  confirmAnnotationDelete,
  openAnnotationDraft,
  prepareAnnotationCandidate,
  rejectAnnotationRequest,
  reloadAnnotationDraft,
  type AnnotationEditorState,
  type AnnotationRequest,
  type AnnotationScope,
} from "./draft.js";
import { annotationErrorLabel, annotationLabels } from "./labels.js";
import {
  annotationReadMatches,
  validAnnotationPage,
  type AnnotationRead,
  type AnnotationHistoryRead,
  type ApprovedAnnotationRead,
} from "./reads.js";
import { AnnotationRecord } from "./AnnotationRecord.js";
import { AnnotationHistoryView } from "./AnnotationHistoryView.js";
import "./annotations.css";
export type AnnotationListRequest = {
  projectId: string;
  scope: AnnotationScope;
  input: AnnotationListInput;
};
export type AnnotationHistoryRequest = {
  projectId: string;
  scope: AnnotationScope;
  annotationId: string;
  input: AnnotationHistoryInput;
};
export type AnnotationsPanelProps = {
  scope: AnnotationScope;
  locale: "zh" | "en";
  state: AnnotationEditorState;
  page: AnnotationRead<AnnotationPage>;
  history?: AnnotationHistoryRead;
  approved?: ApprovedAnnotationRead;
  busy?: boolean;
  selection?: { snapshot: CodeSnapshot; target: AnnotationTarget };
  onState: (state: AnnotationEditorState) => void;
  onRequest: (request: AnnotationRequest) => void;
  onList: (request: AnnotationListRequest) => void;
  onHistory: (request: AnnotationHistoryRequest) => void;
  onReload: (request: {
    projectId: string;
    scope: AnnotationScope;
    annotationId?: string;
  }) => void;
};
/** Controlled view only: props are real read results; callbacks initiate work, never imply success. */
export function AnnotationsPanel(props: AnnotationsPanelProps) {
  const { scope, locale } = props;
  let state = props.state;
  const t = annotationLabels(locale);
  if (annotationScopeKey(scope) !== annotationScopeKey(state.scope))
    return (
      <section className="annotations-panel">
        <h2>{t.title}</h2>
        <p role="status">
          {t.loading} · {t.scopeLoading}
        </p>
      </section>
    );
  if (state.candidate) {
    let matches = false;
    try {
      if (props.selection) {
        const observed = prepareAnnotationCandidate(
          state,
          props.selection.snapshot,
          props.selection.target,
        ).candidate;
        matches = JSON.stringify(observed) === JSON.stringify(state.candidate);
      }
    } catch {
      /* Reject an expired candidate rather than infer another target. */
    }
    if (!matches) state = cancelAnnotationCandidate(state);
  }
  const draft = activeAnnotationDraft(state),
    busy = !!state.pending || !!props.busy;
  const stale =
    !!draft.accepted && draft.basisRevision !== draft.accepted.revision;
  const blocked =
    busy || stale || draft.uncertain || !!draft.accepted?.deletedAt;
  const content = {
    text: draft.text,
    author: draft.author,
    isConstraint: draft.isConstraint,
  };
  const contentValid = draft.annotationId
    ? updateAnnotationSchema.safeParse({
        ...content,
        expectedRevision: draft.basisRevision,
      }).success
    : createAnnotationSchema.safeParse({
        ...content,
        source: "user",
        binding: null,
      }).success;
  const read = annotationReadMatches(scope, props.page.scope)
    ? props.page
    : undefined;
  const page =
    read?.status === "ready" &&
    read.value &&
    validAnnotationPage(scope, read.value)
      ? read.value
      : undefined;
  const candidate =
    state.candidate?.scope === annotationScopeKey(scope)
      ? state.candidate
      : undefined;
  let selectionValid = false;
  try {
    if (props.selection) {
      prepareAnnotationCandidate(
        state,
        props.selection.snapshot,
        props.selection.target,
      );
      selectionValid = true;
    }
  } catch {
    /* A displayed/foreign/unavailable fact is not a binding choice. */
  }
  const change = (next: () => AnnotationEditorState) => {
    try {
      props.onState(next());
    } catch (error) {
      props.onState({
        ...state,
        error: {
          code: error instanceof DomainError ? error.code : "INVALID_INPUT",
        },
      });
    }
  };
  const submit = (action: "save" | "bind" | "detach" | "delete") => {
    let started: ReturnType<typeof beginAnnotationRequest> | undefined;
    try {
      if (props.busy) throw new DomainError("ANNOTATION_PENDING", "Pending");
      started = beginAnnotationRequest(state, action);
      props.onState(started.state);
      props.onRequest(started.request);
    } catch (error) {
      const code =
        error instanceof DomainError ? error.code : "REQUEST_OUTCOME_UNKNOWN";
      props.onState(
        started
          ? rejectAnnotationRequest(started.state, started.request.token, {
              code,
            })
          : { ...state, error: { code } },
      );
    }
  };
  const list = (offset: number) =>
    props.onList({
      projectId: scope.projectId,
      scope: { ...scope },
      input: { offset, limit: page?.limit ?? 20 },
    });
  const history = (annotationId: string, offset = 0) =>
    props.onHistory({
      projectId: scope.projectId,
      scope: { ...scope },
      annotationId,
      input: { offset, limit: 20 },
    });
  return (
    <section className="annotations-panel" aria-label={t.title}>
      <header>
        <h2>{t.title}</h2>
        <button
          type="button"
          data-action="new"
          disabled={busy}
          onClick={() =>
            change(() => openAnnotationDraft(state, undefined, t.createAuthor))
          }
        >
          {t.newNote}
        </button>
      </header>
      <section aria-label={t.current}>
        <h3>{t.current}</h3>
        {!read || read.status === "loading" ? (
          <p role="status">{t.loading}</p>
        ) : read.status === "error" || !page ? (
          <>
            <p role="alert">{t.loadError}</p>
            <button
              type="button"
              data-action="retry-list"
              disabled={busy}
              onClick={() => list(0)}
            >
              {t.retry}
            </button>
          </>
        ) : (
          <>
            {page.items.length === 0 && <p>{t.empty}</p>}
            <ol className="annotation-list">
              {page.items.map((item) => (
                <li key={item.annotation.id}>
                  <AnnotationRecord
                    annotation={item.annotation}
                    resolution={item.resolution}
                    locale={locale}
                  />
                  <div className="annotation-actions">
                    <button
                      type="button"
                      data-action={`choose:${item.annotation.id}`}
                      disabled={busy}
                      onClick={() =>
                        change(() =>
                          openAnnotationDraft(state, item, t.createAuthor),
                        )
                      }
                    >
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => history(item.annotation.id)}
                    >
                      {t.history}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <nav className="annotation-pagination" aria-label={t.page}>
              <button
                type="button"
                data-action="previous-page"
                disabled={busy || page.offset === 0}
                onClick={() => list(Math.max(0, page.offset - page.limit))}
              >
                {t.previous}
              </button>
              <span>
                {page.total === 0 ? 0 : page.offset + 1}–
                {Math.min(page.offset + page.items.length, page.total)} /{" "}
                {page.total}
              </span>
              <button
                type="button"
                data-action="next-page"
                disabled={busy || page.offset + page.limit >= page.total}
                onClick={() => list(page.offset + page.limit)}
              >
                {t.next}
              </button>
            </nav>
          </>
        )}
      </section>
      <form
        className="annotation-editor"
        data-action="save-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit("save");
        }}
      >
        <h3>
          {draft.annotationId ? `${t.edit} · ${draft.annotationId}` : t.newNote}
        </h3>
        {draft.annotationId && (
          <button
            type="button"
            data-action="history-current"
            disabled={busy}
            onClick={() => history(draft.annotationId!)}
          >
            {t.history}
          </button>
        )}
        <div className="annotation-meta">
          <span>
            {t.source}: {draft.source === "agent" ? t.agent : t.user}
          </span>
          <span>
            {t.revision}:{" "}
            {draft.basisRevision ? `r${draft.basisRevision}` : "—"}
          </span>
          {draft.accepted && (
            <span>
              {t.loadedRevision}: r{draft.accepted.revision}
            </span>
          )}
          {draft.dirty && <span className="annotation-badge">{t.dirty}</span>}
        </div>
        <p className="annotation-help">{t.sourceHelp}</p>
        <label>
          {t.author}
          <input
            data-action="author"
            aria-label={t.author}
            maxLength={200}
            value={draft.author}
            required
            readOnly={!!draft.accepted?.deletedAt}
            onChange={(event) =>
              change(() =>
                changeAnnotationDraft(state, { author: event.target.value }),
              )
            }
          />
        </label>
        <label>
          {t.text}
          <textarea
            data-action="text"
            aria-label={t.text}
            maxLength={20000}
            value={draft.text}
            required
            readOnly={!!draft.accepted?.deletedAt}
            onChange={(event) =>
              change(() =>
                changeAnnotationDraft(state, { text: event.target.value }),
              )
            }
          />
        </label>
        <label className="annotation-check">
          <input
            data-action="constraint"
            type="checkbox"
            checked={draft.isConstraint}
            disabled={!!draft.accepted?.deletedAt}
            onChange={(event) =>
              change(() =>
                changeAnnotationDraft(state, {
                  isConstraint: event.target.checked,
                }),
              )
            }
          />
          {t.asConstraint}
        </label>
        <p className="annotation-help">{t.constraintHelp}</p>
        {draft.accepted?.deletedAt && <p>{t.deleted}</p>}
        {(state.error || stale || draft.uncertain) && (
          <p role="alert">
            {annotationErrorLabel(
              locale,
              state.error?.code ??
                (draft.uncertain
                  ? "REQUEST_OUTCOME_UNKNOWN"
                  : "REVISION_CONFLICT"),
            )}
          </p>
        )}
        <div className="annotation-actions">
          <button
            type="submit"
            className="primary"
            data-action="save"
            disabled={
              blocked ||
              !contentValid ||
              !!(!draft.annotationId && candidate) ||
              !!(draft.annotationId && !draft.dirty)
            }
          >
            {busy ? t.saving : t.save}
          </button>
          <button
            type="button"
            data-action="reload"
            disabled={busy}
            onClick={() =>
              props.onReload({
                projectId: scope.projectId,
                scope: { ...scope },
                annotationId: draft.annotationId,
              })
            }
          >
            {t.retry}
          </button>
          {(draft.dirty || stale || draft.uncertain) && (
            <button
              type="button"
              data-action="use-server"
              disabled={busy}
              onClick={() => change(() => reloadAnnotationDraft(state))}
            >
              {draft.accepted ? t.useServer : t.cancelDraft}
            </button>
          )}
        </div>
        <p className="annotation-help">{t.changesHelp}</p>
      </form>
      <section className="annotation-binding" aria-label={t.rebind}>
        <h3>{t.rebind}</h3>
        <p>{t.factOnly}</p>
        <p>{t.selectFact}</p>
        <div className="annotation-actions">
          <button
            type="button"
            data-action="use-selection"
            disabled={blocked || !selectionValid}
            onClick={() =>
              change(() =>
                prepareAnnotationCandidate(
                  state,
                  props.selection!.snapshot,
                  props.selection!.target,
                ),
              )
            }
          >
            {t.useSelection}
          </button>
          <button
            type="button"
            data-action="detach"
            disabled={blocked || !draft.accepted?.binding}
            onClick={() => submit("detach")}
          >
            {t.detach}
          </button>
        </div>
        {candidate && (
          <div className="annotation-candidate">
            <h4>{t.confirmBinding}</h4>
            <dl className="annotation-provenance">
              <dt>{t.lastKnown}</dt>
              <dd>
                {candidate.binding.lastKnown.label} ·{" "}
                <code>{candidate.binding.lastKnown.filePath}</code>
              </dd>
              <dt>{t.target}</dt>
              <dd>
                {candidate.binding.target.kind}
                {candidate.binding.lastKnown.nodeKind
                  ? ` (${candidate.binding.lastKnown.nodeKind})`
                  : ""}{" "}
                · <code>{candidate.binding.target.id}</code>
              </dd>
              <dt>{t.snapshot}</dt>
              <dd>
                <code>{candidate.binding.selectedSnapshotId}</code>
              </dd>
            </dl>
            <div className="annotation-actions">
              <button
                type="button"
                data-action="confirm-binding"
                disabled={blocked || (!draft.annotationId && !contentValid)}
                onClick={() => submit("bind")}
              >
                {t.confirmBinding}
              </button>
              <button
                type="button"
                data-action="cancel-binding"
                disabled={busy}
                onClick={() => props.onState(cancelAnnotationCandidate(state))}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </section>
      {draft.annotationId && (
        <section className="annotation-record-actions">
          <button
            type="button"
            data-action="history"
            disabled={busy}
            onClick={() => history(draft.annotationId!)}
          >
            {t.history}
          </button>
          <button
            type="button"
            data-action="delete-open"
            disabled={blocked}
            onClick={() => change(() => confirmAnnotationDelete(state, true))}
          >
            {t.delete}
          </button>
          {state.deleteConfirmed && (
            <div
              className="annotation-delete-confirm"
              role="group"
              aria-label={t.deleteQuestion}
            >
              <h4>{t.deleteQuestion}</h4>
              <p>{t.deleteHelp}</p>
              <p>
                {draft.accepted?.author} · r{draft.basisRevision}
              </p>
              <div className="annotation-actions">
                <button
                  type="button"
                  data-action="delete-confirm"
                  disabled={blocked}
                  onClick={() => submit("delete")}
                >
                  {t.deleteConfirm}
                </button>
                <button
                  type="button"
                  data-action="delete-cancel"
                  disabled={busy}
                  onClick={() =>
                    props.onState(confirmAnnotationDelete(state, false))
                  }
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      <AnnotationHistoryView
        scope={scope}
        locale={locale}
        history={props.history}
        approved={props.approved}
        onPage={(offset) => {
          if (props.history) history(props.history.annotationId, offset);
        }}
      />
    </section>
  );
}
