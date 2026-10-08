import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { dictionaries, LocaleProvider } from "../i18n/index.js";
import { createWorkspace, type Workspace } from "./workspace.js";
import { createChatSessions } from "../features/chat/sessions.js";
import { WorkspacePanels } from "./WorkspacePanels.js";
export function App({ workspace }: { workspace?: Workspace }) {
  const [app] = useState(
      () => workspace ?? createWorkspace(undefined, window.localStorage),
    ),
    state = useStore(app.store),
    [path, setPath] = useState(""),
    [chatSessions] = useState(() => createChatSessions()),
    projectDialog = useRef<HTMLDialogElement>(null);
  const zh = dictionaries[state.view.locale];
  useEffect(() => {
    document.documentElement.lang = state.view.locale;
  }, [state.view.locale]);
  useEffect(() => {
    void app.init();
  }, [app]);
  useEffect(() => () => chatSessions.dispose(), [chatSessions]);
  return (
    <LocaleProvider locale={state.view.locale}>
      <div className="app" data-theme={state.view.theme}>
        <header className="topbar">
          <a className="brand" href="#">
            ◈ {zh.brand}
            <span>{zh.tagline}</span>
          </a>
          <button
            type="button"
            onClick={() => projectDialog.current?.showModal()}
          >
            {zh.openProjectDialog}
          </button>
          <dialog
            ref={projectDialog}
            className="project-dialog"
            aria-label={zh.openProjectDialog}
          >
            <div className="drawer-heading">
              <h2>{zh.openProjectDialog}</h2>
              <button
                type="button"
                aria-label={zh.close}
                onClick={() => projectDialog.current?.close()}
              >
                ×
              </button>
            </div>
            <p className="muted">{zh.emptyHint}</p>
            <form
              className="open-project"
              onSubmit={(e) => {
                e.preventDefault();
                void app.openProject(path).then(() => {
                  if (app.store.getState().project)
                    projectDialog.current?.close();
                });
              }}
            >
              <label>
                {zh.projectPath}
                <input
                  aria-label={zh.projectPath}
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={zh.pathHint}
                  required
                />
              </label>
              <button disabled={!!state.busy.project} className="primary">
                {zh.open}
              </button>
            </form>
          </dialog>
          <select
            aria-label={zh.project}
            value={state.project?.id ?? ""}
            onChange={(e) => {
              const p = state.projects.find((p) => p.id === e.target.value);
              if (p) void app.selectProject(p);
            }}
          >
            <option value="">{zh.chooseProject}</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.path}
              </option>
            ))}
          </select>
          <button
            disabled={!state.project || !!state.busy.project}
            onClick={() => void app.refresh()}
          >
            {zh.refresh}
          </button>
          <button
            aria-label={zh.toggleTheme}
            disabled={!state.project || !!state.busy.project}
            onClick={() =>
              app.saveView({
                ...state.view,
                theme: state.view.theme === "light" ? "dark" : "light",
              })
            }
          >
            {state.view.theme === "light" ? "☾ " + zh.dark : "☀ " + zh.light}
          </button>
          <select
            aria-label={zh.locale}
            value={state.view.locale}
            disabled={!state.project || !!state.busy.project}
            onChange={(e) =>
              app.saveView({
                ...state.view,
                locale: e.target.value as "zh" | "en",
              })
            }
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </header>
        {state.error && (
          <div role="alert" className="banner error">
            {zh.error}:{" "}
            {state.errorMessageKey ? zh[state.errorMessageKey] : state.error}{" "}
            {state.errorHelp && zh[state.errorHelp]}
            <button
              aria-label={zh.dismiss}
              onClick={() => app.store.setState({ error: "" })}
            >
              ×
            </button>
          </div>
        )}
        {state.notice && (
          <div role="status" className="banner">
            {zh[state.notice]}
            <button
              aria-label={zh.dismiss}
              onClick={() => app.store.setState({ notice: "" })}
            >
              ×
            </button>
          </div>
        )}
        {state.busy.project && (
          <div role="status" className="banner">
            {zh.loading}
          </div>
        )}
        <WorkspacePanels
          key={state.project?.id ?? "none"}
          app={app}
          chatSessions={chatSessions}
        />
      </div>
    </LocaleProvider>
  );
}
