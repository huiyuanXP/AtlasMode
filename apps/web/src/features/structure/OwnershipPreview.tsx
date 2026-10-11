import { useEffect } from "react";
import { useStore } from "zustand";
import { useStrings } from "../../i18n/index.js";
import type { createOwnershipSession } from "./ownership-session.js";
export function OwnershipPreview({
  session,
}: {
  session: ReturnType<typeof createOwnershipSession>;
}) {
  const state = useStore(session.store),
    text = useStrings();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !session.store.getState().intent ||
        session.store.getState().status === "saving"
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      session.cancel();
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [session]);
  if (!state.intent || !state.target) return null;
  const saving = state.status === "saving",
    outdated = state.status === "expired",
    failed = state.status === "error";
  return (
    <section className="ownership-preview" aria-label={text.ownershipPreview}>
      <h3>{text.ownershipPreview}</h3>
      <p>
        {text.ownershipActual}:{" "}
        <code>{state.intent.physicalPath ?? text.ownershipNoSource}</code>
      </p>
      <p>
        {text.ownershipCurrent}:{" "}
        <code>{state.intent.effectivePath ?? "∅"}</code>
      </p>
      <p>
        {text.ownershipTarget}:{" "}
        <code data-testid="ownership-full-path">
          {state.path ?? `${state.target.path}/…`}
        </code>
      </p>
      <small>
        r{state.intent.revision} · <code>{state.intent.snapshotId}</code>
      </small>
      {state.target.kind === "folder" && (
        <label>
          {text.ownershipFilename}
          <input
            required
            aria-label={text.ownershipFilename}
            value={state.filename}
            disabled={saving}
            placeholder="feature.ts"
            onChange={(event) => session.filename(event.target.value)}
          />
          <small>{text.ownershipFilenameHelp}</small>
        </label>
      )}
      {outdated && <p role="alert">{text.ownershipExpired}</p>}
      {failed && <p role="alert">{text.ownershipFailed}</p>}
      <p className="muted">{text.ownershipPlanOnly}</p>
      <div className="button-row">
        <button type="button" disabled={saving} onClick={session.cancel}>
          {text.ownershipCancel}
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving || outdated || failed || !state.path}
          onClick={() => void session.confirm()}
        >
          {text.ownershipSave}
        </button>
      </div>
    </section>
  );
}
