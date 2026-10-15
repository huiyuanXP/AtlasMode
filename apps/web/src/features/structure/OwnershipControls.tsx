import { useStore } from "zustand";
import type { Workspace } from "../../app/workspace.js";
import { useStrings } from "../../i18n/index.js";
import { OwnershipTargets } from "./OwnershipTargets.js";
import { OwnershipPreview } from "./OwnershipPreview.js";
import { plannedOwnershipTargets } from "./ownership-session.js";
export function OwnershipControls({ app }: { app: Workspace }) {
  const state = useStore(app.store),
    session = useStore(app.ownership.store),
    text = useStrings();
  if (session.mode !== "ownership") return null;
  const disabled =
    !!state.busy.plan ||
    !!state.busy.project ||
    !!state.busy.knowledge ||
    state.dirtyPlanEditor ||
    state.groupSelectionMode ||
    !!state.groupDraft ||
    session.status === "saving" ||
    !state.plan ||
    !state.summary ||
    state.plan.plan.status === "stale" ||
    state.plan.plan.baselineSnapshotId !== state.summary.snapshotId ||
    state.plan.plan.baselineContentHash !== state.summary.contentHash;
  return (
    <section className="ownership-controls" aria-label={text.ownershipMode}>
      <p>{text.ownershipHelp}</p>
      <button
        type="button"
        disabled={
          disabled ||
          !app.ownership.targetsReady() ||
          state.selectedNode?.kind !== "function"
        }
        onClick={() => {
          if (state.selectedNode) app.beginOwnership(state.selectedNode);
        }}
      >
        {text.ownershipStart}
      </button>
      <OwnershipTargets
        state={session.tray}
        plannedTargets={plannedOwnershipTargets(
          state.plan?.plan.operations ?? [],
        )}
        labels={{
          title: text.ownershipTargets,
          loading: text.loading,
          unavailable: text.ownershipUnavailable,
          missing: text.ownershipMissing,
          truncated: text.truncated,
          fact: text.fact,
          planned: text.planned,
          choose: text.ownershipChoose,
          browse: text.ownershipBrowse,
          parent: text.ownershipParent,
        }}
        disabled={
          disabled ||
          !app.ownership.targetsReady() ||
          session.status === "expired"
        }
        onChoose={(target) => app.ownership.choose(target)}
        onBrowse={(path) => void app.ownership.browse(path)}
        onDrop={(target, nonce) => app.ownership.choose(target, nonce)}
      />
      <OwnershipPreview session={app.ownership} />
    </section>
  );
}
