import type { OwnershipTarget } from "./ownership.js";
import type { TargetTrayState } from "./ownership-controller.js";
export type TargetLabels = {
  title: string;
  loading: string;
  unavailable: string;
  missing: string;
  truncated: string;
  fact: string;
  planned: string;
  choose: string;
  browse: string;
  parent?: string;
};
export function OwnershipTargets({
  state,
  plannedTargets = [],
  labels,
  disabled = false,
  onChoose,
  onBrowse,
  onDrop,
}: {
  state: TargetTrayState;
  plannedTargets?: OwnershipTarget[];
  labels: TargetLabels;
  disabled?: boolean;
  onChoose: (target: OwnershipTarget) => void;
  onBrowse: (path: string) => void;
  onDrop: (target: OwnershipTarget, nonce: string) => void;
}) {
  const targets: OwnershipTarget[] =
    state.status === "ready" && state.scope
      ? state.scope.nodes
          .filter(
            (n) =>
              (n.kind === "folder" || n.kind === "file") &&
              n.filePath &&
              n.id !== state.scope?.root?.id,
          )
          .map((n) => ({
            kind: n.kind as "file" | "folder",
            path: n.filePath!,
            id: n.id,
          }))
      : [];
  const ready = state.status === "ready" && !!state.request && !disabled;
  const currentPath = state.request?.path ?? ".";
  const card = (target: OwnershipTarget) => (
    <li
      key={`${target.kind}:${target.path}:${target.planned ? "planned" : "fact"}`}
    >
      <button
        type="button"
        disabled={!ready}
        onClick={() => onChoose(target)}
        onDragOver={(e) => {
          if (
            ready &&
            e.dataTransfer.types.includes("application/x-atlas-ownership")
          )
            e.preventDefault();
        }}
        onDrop={(e) => {
          if (!ready) return;
          e.preventDefault();
          const nonce = e.dataTransfer.getData("application/x-atlas-ownership");
          if (nonce) onDrop(target, nonce);
        }}
      >
        {labels.choose} <code>{target.path}</code> ·{" "}
        {target.planned ? labels.planned : labels.fact}
      </button>
      {target.kind === "folder" && (
        <button
          type="button"
          disabled={!ready}
          onClick={() => onBrowse(target.path)}
        >
          {labels.browse} {target.path}
        </button>
      )}
    </li>
  );
  return (
    <section aria-label={labels.title}>
      <h3>{labels.title}</h3>
      <nav aria-label={labels.title}>
        {(currentPath === "."
          ? ["."]
          : [
              ".",
              ...currentPath.split("/").map((_, i) =>
                currentPath
                  .split("/")
                  .slice(0, i + 1)
                  .join("/"),
              ),
            ]
        ).map((path) => (
          <button
            type="button"
            key={path}
            disabled={!ready || path === currentPath}
            onClick={() => onBrowse(path)}
          >
            {path}
          </button>
        ))}
      </nav>
      {state.status === "loading" && <p role="status">{labels.loading}</p>}
      {state.status === "error" && <p role="alert">{labels.unavailable}</p>}
      {state.scope?.missing && <p>{labels.missing}</p>}
      {state.scope?.truncated && <p>{labels.truncated}</p>}
      <ul>
        {ready &&
          state.request &&
          card({
            kind: "folder",
            path: state.request.path,
            planned: state.scope?.missing,
          })}
        {targets.map(card)}
        {(ready ? plannedTargets : [])
          .filter(
            (p) => !targets.some((t) => t.kind === p.kind && t.path === p.path),
          )
          .map((p) => card({ ...p, planned: true }))}
      </ul>
    </section>
  );
}
