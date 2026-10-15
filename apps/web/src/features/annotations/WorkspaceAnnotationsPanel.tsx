import { useEffect } from "react";
import { useStore } from "zustand";
import type { Workspace } from "../../app/workspace.js";
import { useStrings } from "../../i18n/index.js";
import { AnnotationsPanel } from "./AnnotationsPanel.js";
import { annotationScopeKey } from "./draft.js";
export function WorkspaceAnnotationsPanel({
  app,
  locale,
}: {
  app: Workspace;
  locale: "zh" | "en";
}) {
  const state = useStore(app.annotations.store),
    workspace = useStore(app.store),
    t = useStrings();
  useEffect(() => {
    void app.annotations.activate();
    return () => app.annotations.deactivate();
  }, [app]);
  const scope = state.scope,
    editor = state.editor;
  if (!scope || !editor) return <p role="status">{t.annotationLoading}</p>;
  const same = (request: { projectId: string; scope: typeof scope }) =>
    request.projectId === scope.projectId &&
    annotationScopeKey(request.scope) === annotationScopeKey(scope);
  return (
    <>
      <p className="muted">{t.annotationNextStep}</p>
      {state.snapshotError === "SNAPSHOT_CHANGED" && (
        <div role="status">
          <p>{t.annotationSourceChanged}</p>
          <button
            type="button"
            disabled={
              state.mutating ||
              !!workspace.busy.project ||
              !!workspace.busy.refresh
            }
            onClick={() => void app.refresh()}
          >
            {t.annotationRefreshSource}
          </button>
        </div>
      )}
      {state.executionBlocked && (
        <div role="status">
          <p>{t.annotationExecutionBlocked}</p>
          <button
            type="button"
            disabled={state.mutating || !!workspace.busy.project}
            data-action="recover-knowledge"
            onClick={() => void app.annotations.reload()}
          >
            {t.annotationRecover}
          </button>
        </div>
      )}
      {state.synchronizationError && (
        <p role="alert">
          {t.annotationSyncFailed} · <code>{state.synchronizationError}</code>
        </p>
      )}
      {state.historicalExport && state.approved && (
        <button
          type="button"
          data-action="export-recorded-knowledge"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([state.historicalExport!], { type: "application/json" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = `approved-knowledge-${state.approved!.approvalId}.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t.annotationHistoricalExport}
        </button>
      )}
      {state.approvalError && (
        <p role="alert">
          {t.annotationApprovalFailed} · <code>{state.approvalError}</code>
        </p>
      )}
      <AnnotationsPanel
        scope={scope}
        locale={locale}
        state={editor}
        page={state.page ?? { scope, status: "loading" }}
        history={state.history}
        approved={state.approved}
        selection={state.selection}
        busy={
          state.mutating ||
          !!(
            workspace.busy.project ||
            workspace.busy.plan ||
            workspace.busy.knowledge ||
            workspace.busy.refresh ||
            workspace.busy.agentSync
          )
        }
        onState={app.annotations.setEditor}
        onRequest={(request) => void app.annotations.submit(request)}
        onList={(request) => {
          if (same(request)) void app.annotations.list(request.input);
        }}
        onHistory={(request) => {
          if (same(request))
            void app.annotations.history(request.annotationId, request.input);
        }}
        onReload={(request) => {
          if (same(request)) void app.annotations.reload(request.annotationId);
        }}
      />
    </>
  );
}
