import { useState } from "react";
import { ChatPanel } from "../features/chat/ChatPanel.js";
import type { ChatSessions } from "../features/chat/sessions.js";
import type { ChatContext } from "../features/chat/types.js";
import type { Settled } from "../features/chat/controller.js";
import { GroupsPanel } from "../features/groups/GroupsPanel.js";
import { PoliciesPanel } from "../features/structure/PoliciesPanel.js";
import { useStore } from "zustand";
import { useStrings } from "../i18n/index.js";
import type { Workspace } from "./workspace.js";
import { RoutePanel } from "../features/routes/RoutePanel.js";
export function Navigation({
  app,
  onFocus,
  chatSessions,
  context,
  onSend,
}: {
  app: Workspace;
  onFocus: () => void;
  chatSessions: ChatSessions;
  context: () => ChatContext;
  onSend: () => Settled;
}) {
  const zh = useStrings(),
    [advanced, setAdvanced] = useState(false);
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
      <p className="offline-guidance">{zh.offlineBrowseHint}</p>
      <section className="compact-search" aria-label={zh.search}>
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
      <details className="compact-navigation">
        <summary>{zh.browseCode}</summary>
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
        <RoutePanel
          routes={state.routes}
          routeId={state.routeId}
          index={state.routeStep}
          snapshotId={summary?.snapshotId}
          onStep={(id, i) => void app.routeStep(id, i)}
          busy={!!state.busy.route || !!state.busy.project}
        />
      </details>
      <details className="agent-disclosure explore-disclosure">
        <summary>{zh.exploreChatOptional}</summary>
        <ChatPanel
          controller={chatSessions.get(project.id, "explore")}
          locale={state.view.locale}
          context={context}
          onSend={onSend}
        />
      </details>
      <button
        className="advanced-navigation"
        aria-expanded={advanced}
        onClick={() => setAdvanced(!advanced)}
      >
        {zh.advancedControls}
      </button>
      {advanced && (
        <div className="advanced-navigation-content">
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
              <section aria-label={zh.packageManifests}>
                <h3>
                  {zh.packageManifests}
                  {summary.coverage.packageFiles !== undefined &&
                    `: ${summary.coverage.packageFiles.length}`}
                </h3>
                {summary.coverage.packageFiles === undefined ? (
                  <p className="muted">{zh.packageUnrecorded}</p>
                ) : (
                  <ul>
                    {summary.coverage.packageFiles.map((path) => (
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
        </div>
      )}
    </aside>
  );
}
