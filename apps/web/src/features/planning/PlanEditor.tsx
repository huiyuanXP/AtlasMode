import { useEffect, useState } from "react";
import type { PlanDetail, Operation } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
import { deleteTemporary, editFunction, temporaryId } from "./operations.js";
import type { PlanningPanelProps } from "./PlanningPanel.js";
import { FunctionForm } from "./FunctionForm.js";
import { RelationEditor } from "./RelationEditor.js";
export function PlanEditor(props: PlanningPanelProps & { detail: PlanDetail }) {
  const zh = useStrings();
  const { detail, node, edge } = props,
    plan = detail.plan,
    operations = plan.operations;
  const [title, setTitle] = useState(plan.title),
    [description, setDescription] = useState(plan.description),
    [annotation, setAnnotation] = useState("");
  const planned = operations.filter(
    (o): o is Extract<Operation, { kind: "add_function" }> =>
      o.kind === "add_function",
  );
  const temporary = node && planned.find((o) => o.tempId === node.id);
  const effectiveNode = temporary
    ? {
        id: temporary.tempId,
        kind: "function" as const,
        name: temporary.name,
        filePath: temporary.filePath,
        signature: temporary.signature,
      }
    : node;
  const metadataDirty =
    title !== plan.title || description !== plan.description;
  useEffect(() => {
    props.onDirtyChange?.(metadataDirty);
  }, [metadataDirty, props.onDirtyChange]);
  useEffect(() => () => props.onDirtyChange?.(false), [props.onDirtyChange]);
  return (
    <fieldset disabled={props.busy} className="plan-editor">
      <div className="plan-status">
        <strong>
          {zh.revision} r{plan.revision} · {zh[plan.status]}
        </strong>
        <p className={detail.valid ? "success" : "muted"}>
          {detail.valid ? zh.valid : zh.invalid}
        </p>
        <small>{zh.baseline}</small>
        <code className="path">{plan.baselineSnapshotId}</code>
        {detail.approval && (
          <>
            <small>
              {zh.approvalHash} · r{detail.approval.revision}
            </small>
            <code className="path">{detail.approval.semanticHash}</code>
          </>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave(operations, title, description);
        }}
      >
        <label>
          {zh.title}
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          {zh.description}
          <textarea
            aria-label={zh.description}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!metadataDirty}>
          {zh.saveTitle}
        </button>
      </form>
      <p className="muted">{zh.approveHelp}</p>
      <div className="button-row">
        <button onClick={props.onValidate}>{zh.validate}</button>
        <button
          className="primary"
          onClick={props.onApprove}
          disabled={metadataDirty}
        >
          {zh.approve}
        </button>
      </div>
      {metadataDirty && <p className="warning">{zh.dirty}</p>}
      <div className="button-row">
        <button onClick={() => props.onExport("markdown")}>
          {zh.exportMd}
        </button>
        <button onClick={() => props.onExport("json")}>{zh.exportJson}</button>
      </div>
      <details open={detail.issues.length > 0}>
        <summary>
          {zh.issues} ({detail.issues.length})
        </summary>
        {detail.issues.length ? (
          detail.issues.map((issue, i) => (
            <p
              className={issue.severity === "error" ? "error" : "warning"}
              key={i}
            >
              {zh[issue.severity]} · {issue.code}: {issue.message}
            </p>
          ))
        ) : (
          <p>{zh.noIssues}</p>
        )}
      </details>
      <details open>
        <summary>{zh.addFunction}</summary>
        <p className="muted">{zh.newFileHelp}</p>
        <FunctionForm
          add
          onSave={(edit) =>
            props.onSave([
              ...operations,
              { kind: "add_function", tempId: temporaryId(), ...edit },
            ])
          }
        />
      </details>
      {effectiveNode?.kind === "function" && (
        <details open>
          <summary>
            {zh.editFunction} · {effectiveNode.name}
          </summary>
          {!temporary && <p className="muted">{zh.editFactHelp}</p>}
          <FunctionForm
            key={effectiveNode.id}
            node={effectiveNode}
            description={temporary?.description}
            onSave={(edit) =>
              props.onSave(editFunction(operations, effectiveNode, edit))
            }
          />
          <button
            className="danger"
            onClick={() =>
              props.onSave(
                temporary
                  ? deleteTemporary(operations, temporary.tempId)
                  : [
                      ...operations,
                      { kind: "remove_function", nodeId: effectiveNode.id },
                    ],
              )
            }
          >
            {temporary ? zh.deleteTemporary : zh.removeFact}
          </button>
        </details>
      )}
      <RelationEditor
        operations={operations}
        node={node}
        nodes={props.nodes}
        edge={edge}
        onSave={props.onSave}
        onClearEdge={props.onClearEdge}
      />
      {node && (
        <details>
          <summary>{zh.annotate}</summary>
          <p className="muted">{zh.annotationHelp}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              props.onSave([
                ...operations,
                { kind: "annotate", targetId: node.id, text: annotation },
              ]);
            }}
          >
            <label>
              {zh.annotationText}
              <textarea
                aria-label={zh.annotationText}
                required
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
              />
            </label>
            <button>{zh.addAnnotation}</button>
          </form>
        </details>
      )}
      <details open>
        <summary>
          {zh.operations} ({operations.length})
        </summary>
        {!operations.length && <p>{zh.noOperations}</p>}
        {operations.map((op, index) => (
          <article className="operation" key={index}>
            <strong>
              #{index + 1} {zh[op.kind]}
            </strong>
            {op.kind === "annotate" &&
              detail.issues.some(
                (issue) =>
                  issue.operationIndex === index &&
                  issue.code === "INVALID_TARGET",
              ) && (
                <p className="warning">
                  {zh.unbound}: {zh.lostAnnotation}
                </p>
              )}
            <pre>{JSON.stringify(op, null, 2)}</pre>
            <button
              aria-label={`${zh.removeOperation} ${index + 1}`}
              onClick={() =>
                props.onSave(
                  op.kind === "add_function"
                    ? deleteTemporary(operations, op.tempId)
                    : operations.filter((_, i) => i !== index),
                )
              }
            >
              {zh.removeOperation}
            </button>
          </article>
        ))}
      </details>
    </fieldset>
  );
}
