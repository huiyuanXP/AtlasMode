import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { Workspace } from "../../app/workspace.js";
import {
  StructureClient,
  type StructureTransport,
} from "../../api/structure-client.js";
import {
  createPolicyController,
  type AcceptedPolicyResponse,
  type AcceptedPolicyReadResponse,
} from "./policy-controller.js";
import { StructurePolicyPanel } from "./StructurePolicyPanel.js";
const defaultTransport = new StructureClient();
export type PoliciesPanelProps = {
  app: Workspace;
  transport?: StructureTransport;
  onAccepted?: (response: AcceptedPolicyResponse) => void | Promise<void>;
  onReadAccepted?: (
    response: AcceptedPolicyReadResponse,
  ) => void | Promise<void>;
};
/** Dedicated editor: old policy POST now carries the editor's explicit CAS capture. */
export function PoliciesPanel({
  app,
  transport = defaultTransport,
  onAccepted,
  onReadAccepted,
}: PoliciesPanelProps) {
  const state = useStore(app.store),
    id = state.project?.id;
  if (!id) return null;
  return (
    <ProjectPolicyEditor
      key={id}
      projectId={id}
      locale={state.view.locale ?? "zh"}
      transport={transport}
      onAccepted={onAccepted}
      onReadAccepted={onReadAccepted}
      workspaceBusy={
        !!state.busy.knowledge || !!state.busy.project || !!state.busy.plan
      }
    />
  );
}
function ProjectPolicyEditor({
  projectId,
  locale,
  transport,
  onAccepted,
  onReadAccepted,
  workspaceBusy,
}: {
  projectId: string;
  workspaceBusy: boolean;
  locale: "en" | "zh";
  transport: StructureTransport;
  onAccepted?: PoliciesPanelProps["onAccepted"];
  onReadAccepted?: PoliciesPanelProps["onReadAccepted"];
}) {
  const accepted = useRef(onAccepted);
  accepted.current = onAccepted;
  const readAccepted = useRef(onReadAccepted);
  readAccepted.current = onReadAccepted;
  const controller = useMemo(() => {
    const c = createPolicyController(
      transport,
      (response) => accepted.current?.(response),
      undefined,
      (response) => readAccepted.current?.(response),
    );
    c.selectProject(projectId);
    return c;
  }, [projectId, transport]);
  const state = useStore(controller.store);
  useEffect(() => {
    void controller.reload();
    return () => controller.dispose();
  }, [controller]);
  return (
    <StructurePolicyPanel
      state={{ ...state, busy: state.busy || workspaceBusy }}
      locale={locale}
      integrated={!!onAccepted && !!onReadAccepted}
      onReload={() => void controller.reload()}
      onConflictRead={() => void controller.reload(true)}
      onChoose={controller.choose}
      onEdit={controller.edit}
      onSave={() => void controller.save()}
      onRetry={() => void controller.retry()}
      onPreview={() => void controller.previewLegacy()}
      onImport={() => void controller.importLegacy()}
    />
  );
}
