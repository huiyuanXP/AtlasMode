import { GroupsPanel } from "../features/groups/GroupsPanel.js";
import { PoliciesPanel } from "../features/structure/PoliciesPanel.js";
import { useStore } from "zustand";
import { useStrings } from "../i18n/index.js";
import type { Workspace } from "./workspace.js";
import { RoutePanel } from "../features/routes/RoutePanel.js";
export function Navigation({
  app,
  onFocus,
}: {
  app: Workspace;
  onFocus: () => void;
}) {
  const zh = useStrings();
  const state = useStore(app.store),
    { project, summary } = state;
  if (!project) return null;
  return (
    <aside className="navigation" aria-label={zh.projectFacts}>
      <div className="project-heading">
        <span className="eyebrow">{zh.projectFacts}</span>
        <h1>{project.name}</h1>
        <code className="path">{project.path}</code>
      </div>
      {summary && (
        <>
          <div className="stats">
            <span>
              <strong>{summary.counts.functions}</strong>
              {zh.functions}
            </span>
            <span>
              <strong>{summary.counts.files}</strong>
              {zh.files}
            </span>
          </div>
          <p className="muted">
            {zh.calls}: {summary.counts.calls.resolved} {zh.resolved} ·{" "}
            {summary.counts.calls.unresolved} {zh.unresolved} ·{" "}
            {summary.counts.calls.external} {zh.external}
          </p>
        </>
      )}
      <section>
        <h2>
          {zh.entrypoints}{" "}
          <span className="count">
            {summary?.entrypoints.length ?? 0}/{summary?.entrypointTotal ?? 0}
          </span>
        </h2>
        <p className="muted">{zh.entryHelp}</p>
        <div className="node-list">
          {summary?.entrypoints.map((n) => (
            <button
              className={state.selectedNode?.id === n.id ? "active" : ""}
              key={n.id}
              disabled={!!state.busy.project}
              onClick={() => {
                onFocus();
                void app.focus(n);
              }}
            >
              <strong>ƒ {n.name}</strong>
              <small>{n.filePath}</small>
            </button>
          ))}
        </div>
        {summary?.entrypointsTruncated && (
          <p className="warning">{zh.truncated} (50)</p>
        )}
        {summary && !summary.entrypoints.length && (
          <p className="muted">{zh.noEntries}</p>
        )}
      </section>
      <section>
        <h2>{zh.search}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void app.search(state.query);
          }}
        >
          <input
            aria-label={zh.search}
            placeholder={zh.searchHint}
            value={state.query}
            onChange={(e) => app.store.setState({ query: e.target.value })}
          />
          <button disabled={!!state.busy.search || !!state.busy.project}>
            {zh.searchGo}
          </button>
        </form>
        {state.search && (
          <>
            <p className="muted">
              {state.search.offset + 1}–
              {state.search.offset + state.search.items.length} /{" "}
              {state.search.total}
            </p>
            <div className="node-list">
              {state.search.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    onFocus();
                    void app.focus(n);
                  }}
                >
                  <strong>ƒ {n.name}</strong>
                  <small>{n.filePath}</small>
                </button>
              ))}
            </div>
            <div className="button-row">
              <button
                disabled={!!state.busy.search || state.search.offset === 0}
                onClick={() =>
                  void app.search(
                    state.query,
                    Math.max(0, state.search!.offset - 50),
                  )
                }
              >
                {zh.previous}
              </button>
              <button
                disabled={
                  !!state.busy.search ||
                  state.search.offset + 50 >= state.search.total
                }
                onClick={() =>
                  void app.search(state.query, state.search!.offset + 50)
                }
              >
                {zh.next}
              </button>
            </div>
          </>
        )}
      </section>
      <RoutePanel
        routes={state.routes}
        routeId={state.routeId}
        index={state.routeStep}
        snapshotId={summary?.snapshotId}
        onStep={(id, i) => void app.routeStep(id, i)}
        busy={!!state.busy.route || !!state.busy.project}
      />
      <GroupsPanel app={app} />
      <PoliciesPanel app={app} />
      {summary && (
        <details>
          <summary>
            {zh.diagnostics} ({summary.diagnostics.length})
          </summary>
          {summary.diagnostics.map((d, i) => (
            <p className="warning" key={i}>
              {d.filePath}:{d.line ?? "—"} · {d.message}
            </p>
          ))}
          <p>
            {zh.included}: {summary.coverage.files.length}
          </p>
          <section aria-label={zh.configurationInputs}>
            <h3>
              {zh.configurationInputs}
              {summary.coverage.configurationFiles !== undefined &&
                `: ${summary.coverage.configurationFiles.length}`}
            </h3>
            {summary.coverage.configurationFiles === undefined ? (
              <p className="muted">{zh.configurationUnrecorded}</p>
            ) : (
              <ul>
                {summary.coverage.configurationFiles.map((path) => (
                  <li key={path}>
                    <code className="path">{path}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p>
            {zh.excluded}: {summary.coverage.excludedPatterns.join(", ")}
          </p>
        </details>
      )}
    </aside>
  );
}
