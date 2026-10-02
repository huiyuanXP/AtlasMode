import { useState } from "react";
import type { CodeNode, Operation, PlanDetail } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
import type { EdgeReference } from "./operations.js";
import { PlanEditor } from "./PlanEditor.js";
export type PlanningPanelProps = {
  plans: PlanDetail[];
  detail?: PlanDetail;
  node?: CodeNode;
  nodes: CodeNode[];
  edge?: EdgeReference;
  busy: boolean;
  onChoose: (id: string) => void;
  onCreate: (title: string) => void;
  onSave: (
    operations: Operation[],
    title?: string,
    description?: string,
  ) => void;
  onValidate: () => void;
  onApprove: () => void;
  onExport: (format: "json" | "markdown") => void;
  onClearEdge: () => void;
};
export function PlanningPanel(props: PlanningPanelProps) {
  const zh = useStrings();
  const [title, setTitle] = useState("");
  return (
    <section>
      <h2>{zh.planTab}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onCreate(title);
        }}
      >
        <label>
          {zh.createTitle}
          <input
            value={title}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button disabled={props.busy} type="submit">
          {zh.create}
        </button>
      </form>
      <label>
        {zh.choosePlan}
        <select
          aria-label={zh.choosePlan}
          value={props.detail?.plan.id ?? ""}
          disabled={props.busy}
          onChange={(e) => props.onChoose(e.target.value)}
        >
          <option value="">{zh.noPlan}</option>
          {props.plans.map((p) => (
            <option key={p.plan.id} value={p.plan.id}>
              {p.plan.title} · r{p.plan.revision} · {zh[p.plan.status]}
            </option>
          ))}
        </select>
      </label>
      {props.detail && (
        <>
          <button
            disabled={props.busy}
            onClick={() => props.onChoose(props.detail!.plan.id)}
          >
            {zh.refreshPlan}
          </button>
          <PlanEditor
            key={`${props.detail.plan.id}:${props.detail.plan.revision}:${props.node?.id ?? ""}:${props.edge?.id ?? ""}`}
            {...props}
            detail={props.detail}
          />
        </>
      )}
    </section>
  );
}
