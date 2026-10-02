import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { zh } from "./strings.js";
import { createWorkspace, type Workspace } from "./workspace.js";
import { WorkspacePanels } from "./WorkspacePanels.js";
export function App({ workspace }: { workspace?: Workspace }) {
  const [app] = useState(
      () => workspace ?? createWorkspace(undefined, window.localStorage),
    ),
    state = useStore(app.store),
    [path, setPath] = useState("");
  useEffect(() => {
    void app.init();
  }, [app]);
  return (
    <div className="app" data-theme={state.view.theme}>
      <header className="topbar">
        <a className="brand" href="#">
          ◈ {zh.brand}
          <span>{zh.tagline}</span>
        </a>
        <form
          className="open-project"
          onSubmit={(e) => {
            e.preventDefault();
            void app.openProject(path);
          }}
        >
          <input
            aria-label={zh.projectPath}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={zh.pathHint}
            required
          />
          <button disabled={!!state.busy.project} className="primary">
            {zh.open}
          </button>
        </form>
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
      </header>
      {state.error && (
        <div role="alert" className="banner error">
          {zh.error}: {state.error}
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
          {state.notice}
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
      <WorkspacePanels key={state.project?.id ?? "none"} app={app} />
    </div>
  );
}
