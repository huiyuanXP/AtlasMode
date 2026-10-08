import type { CodeNode, PlanDetail, Operation } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
export interface PlanOverviewProps {
  plans: PlanDetail[];
  detail?: PlanDetail;
  nodes: CodeNode[];
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onChoose: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onValidate: () => void;
  onApprove: () => void;
  onExport: (format: "markdown" | "json") => void;
  onVerify: () => void;
}
export function PlanOverview(props: PlanOverviewProps) {
  const s = useStrings(),
    plan = props.detail?.plan;
  const names = new Map(props.nodes.map((n) => [n.id, n.name]));
  for (const op of plan?.operations ?? [])
    if (op.kind === "add_function") names.set(op.tempId, op.name);
  const name = (id: string) => names.get(id) ?? s.unloaded;
  const describe = (op: Operation) => {
    switch (op.kind) {
      case "add_function":
        return `${s.add_function} · ${op.name} → ${op.filePath}`;
      case "remove_function":
        return `${s.remove_function} · ${name(op.nodeId)}`;
      case "move_function":
        return `${s.move_function} · ${name(op.nodeId)} → ${op.filePath}`;
      case "add_relation":
        return `${s[op.type]} · ${name(op.sourceId)} → ${name(op.targetId)}`;
      case "remove_relation":
        return s.remove_relation;
      case "annotate":
        return `${s.annotation} · ${name(op.targetId)} · ${op.text}`;
    }
  };
  return (
    <section className="plan-overview" aria-label={s.operations}>
      <div className="plan-overview-heading">
        <h2>{plan?.title ?? s.planOverview}</h2>
        {plan && (
          <span className="count">
            r{plan.revision} · {s[plan.status]}
          </span>
        )}
      </div>
      <label className="plan-select">
        {s.choosePlan}
        <select
          aria-label={s.choosePlan}
          value={plan?.id ?? ""}
          disabled={props.busy}
          onChange={(event) => props.onChoose(event.target.value)}
        >
          <option value="">{s.noPlan}</option>
          {props.plans.map((p) => (
            <option key={p.plan.id} value={p.plan.id}>
              {p.plan.title} · r{p.plan.revision}
            </option>
          ))}
        </select>
      </label>
      {plan ? (
        <>
          <p className={props.detail?.valid ? "success" : "muted"}>
            {props.detail?.valid ? s.valid : s.invalid}
          </p>
          {plan.description && (
            <p className="plan-description">{plan.description}</p>
          )}
          <details className="plan-changes" open>
            <summary>
              {s.operations} ({plan.operations.length})
            </summary>
            {!plan.operations.length ? (
              <p className="muted">{s.noOperations}</p>
            ) : (
              <ol>
                {plan.operations.map((op, index) => (
                  <li key={index}>{describe(op)}</li>
                ))}
              </ol>
            )}
          </details>
          {!!props.detail?.issues.length && (
            <details className="plan-issues" open>
              <summary>
                {s.issues} ({props.detail.issues.length})
              </summary>
              {props.detail.issues.map((issue, index) => (
                <p
                  key={index}
                  className={issue.severity === "error" ? "error" : "warning"}
                >
                  {s[issue.severity]} · {issue.message}
                </p>
              ))}
            </details>
          )}
          <div className="button-row">
            <button
              disabled={props.busy || !props.canUndo}
              onClick={props.onUndo}
            >
              {s.undo}
            </button>
            <button
              disabled={props.busy || !props.canRedo}
              onClick={props.onRedo}
            >
              {s.redo}
            </button>
            <button disabled={props.busy} onClick={props.onValidate}>
              {s.validate}
            </button>
            <button
              className="primary"
              disabled={props.busy}
              onClick={props.onApprove}
            >
              {s.approve}
            </button>
          </div>
          <div className="button-row">
            <button
              disabled={props.busy}
              onClick={() => props.onExport("markdown")}
            >
              {s.exportMd}
            </button>
            <button
              disabled={props.busy}
              onClick={() => props.onExport("json")}
            >
              {s.exportJson}
            </button>
            <button disabled={props.busy} onClick={props.onVerify}>
              {s.verify}
            </button>
          </div>
        </>
      ) : (
        <p className="muted">{s.noPlan}</p>
      )}
    </section>
  );
}
