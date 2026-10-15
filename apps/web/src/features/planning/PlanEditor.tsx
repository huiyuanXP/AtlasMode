import { useEffect, useRef, useState } from "react";
import type { PlanDetail, Operation } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
import { deleteTemporary, editFunction, temporaryId } from "./operations.js";
import type { PlanningPanelProps } from "./PlanningPanel.js";
import { FunctionForm } from "./FunctionForm.js";
import { RelationEditor } from "./RelationEditor.js";
import { effectiveFunctionPath } from "./function-target.js";
export function PlanEditor(props: PlanningPanelProps & { detail: PlanDetail }) {
  const zh = useStrings();
  const { detail, node, edge } = props,
    plan = detail.plan,
    operations = plan.operations;
  const [title, setTitle] = useState(plan.title),
    [description, setDescription] = useState(plan.description),
    [annotation, setAnnotation] = useState("");
  const [functionDirty, setFunctionDirty] = useState(false);
  const [addDirty, setAddDirty] = useState(false);
  const metadataGeneration = useRef(0);
  const contextKey = JSON.stringify([
    plan.projectId,
    plan.id,
    plan.baselineSnapshotId,
    plan.baselineContentHash,
  ]);
  type PendingSave = {
    contextKey: string;
    revision: number;
    operations: string;
    title: string;
    description: string;
  };
  const matchesSave = (pending?: PendingSave) =>
    !!pending &&
    pending.contextKey === contextKey &&
    plan.revision === pending.revision + 1 &&
    JSON.stringify(operations) === pending.operations &&
    plan.title === pending.title &&
    plan.description === pending.description;
  const pendingSave = (
    next: Operation[],
    nextTitle = plan.title,
    nextDescription = plan.description,
  ): PendingSave => ({
    contextKey,
    revision: plan.revision,
    operations: JSON.stringify(next),
    title: nextTitle,
    description: nextDescription,
  });
  const [pendingAdd, setPendingAdd] = useState<PendingSave>();
  const [pendingMetadata, setPendingMetadata] = useState<
    PendingSave & { generation: number }
  >();
  const [metadataBasis, setMetadataBasis] = useState({
    title: plan.title,
    description: plan.description,
    revision: plan.revision,
  });
  const [pendingFunction, setPendingFunction] = useState<PendingSave>();
  const planned = operations.filter(
    (o): o is Extract<Operation, { kind: "add_function" }> =>
      o.kind === "add_function",
  );
  const temporary = node && planned.find((o) => o.tempId === node.id);
  const physicalNode =
    node &&
    (props.nodes.find((n) => n.id === node.id && n.kind === "function") ??
      node);
  const originalNode = temporary
    ? {
        id: temporary.tempId,
        kind: "function" as const,
        name: temporary.name,
        filePath: temporary.filePath,
        signature: temporary.signature,
      }
    : physicalNode;
  const effectiveNode =
    originalNode?.kind === "function"
      ? {
          ...originalNode,
          filePath: effectiveFunctionPath(operations, originalNode),
        }
      : originalNode;
  const metadataDirty =
    title !== metadataBasis.title || description !== metadataBasis.description;
  const metadataStale =
    metadataDirty && metadataBasis.revision !== plan.revision;
  const semanticDirty = metadataDirty || functionDirty || addDirty;
  const saveAcknowledged = matchesSave(pendingFunction);
  const addAcknowledged = matchesSave(pendingAdd);
  const metadataAcknowledged = matchesSave(pendingMetadata);
  useEffect(() => {
    // An accepted advance (matching or conflicting) retires the outstanding claim.
    // A failed response at the old revision retains it for a later recovery reread.
    if (
      pendingFunction &&
      (pendingFunction.contextKey !== contextKey ||
        plan.revision > pendingFunction.revision)
    )
      setPendingFunction(undefined);
    if (
      pendingAdd &&
      (pendingAdd.contextKey !== contextKey ||
        plan.revision > pendingAdd.revision)
    )
      setPendingAdd(undefined);
  }, [contextKey, plan.revision, pendingFunction, pendingAdd]);
  useEffect(() => {
    if (
      pendingMetadata &&
      (pendingMetadata.contextKey !== contextKey ||
        plan.revision > pendingMetadata.revision)
    ) {
      setPendingMetadata(undefined);
      if (
        metadataAcknowledged &&
        metadataGeneration.current === pendingMetadata.generation
      ) {
        setMetadataBasis({
          title: plan.title,
          description: plan.description,
          revision: plan.revision,
        });
        return;
      }
    }
    if (!metadataDirty) {
      setTitle(plan.title);
      setDescription(plan.description);
      setMetadataBasis({
        title: plan.title,
        description: plan.description,
        revision: plan.revision,
      });
    }
  }, [
    metadataDirty,
    plan.title,
    plan.description,
    plan.revision,
    contextKey,
    pendingMetadata,
    metadataAcknowledged,
  ]);
  useEffect(() => {
    props.onDirtyChange?.(semanticDirty);
  }, [semanticDirty, props.onDirtyChange]);
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
          if (!metadataStale) {
            setPendingMetadata({
              ...pendingSave(operations, title, description),
              generation: metadataGeneration.current,
            });
            props.onSave(operations, title, description);
          }
        }}
      >
        <label>
          {zh.title}
          <input
            required
            value={title}
            onChange={(e) => {
              metadataGeneration.current++;
              setTitle(e.target.value);
            }}
          />
        </label>
        <label>
          {zh.description}
          <textarea
            aria-label={zh.description}
            value={description}
            onChange={(e) => {
              metadataGeneration.current++;
              setDescription(e.target.value);
            }}
          />
        </label>
        {metadataStale && (
          <>
            <p role="alert">{zh.conflictHelp}</p>
            <button
              type="button"
              onClick={() => {
                metadataGeneration.current++;
                setPendingMetadata(undefined);
                setTitle(plan.title);
                setDescription(plan.description);
                setMetadataBasis({
                  title: plan.title,
                  description: plan.description,
                  revision: plan.revision,
                });
              }}
            >
              {zh.refreshPlan}
            </button>
          </>
        )}
        <button type="submit" disabled={!metadataDirty || metadataStale}>
          {zh.saveTitle}
        </button>
      </form>
      <p className="muted">{zh.approveHelp}</p>
      <div className="button-row">
        <button onClick={props.onValidate}>{zh.validate}</button>
        <button
          className="primary"
          onClick={props.onApprove}
          disabled={semanticDirty}
        >
          {zh.approve}
        </button>
      </div>
      {semanticDirty && <p className="warning">{zh.dirty}</p>}
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
          revisionKey={`${contextKey}:${plan.revision}`}
          onDirtyChange={setAddDirty}
          saveAcknowledged={addAcknowledged}
          onSave={(edit) => {
            const next: Operation[] = [
              ...operations,
              { kind: "add_function", tempId: temporaryId(), ...edit },
            ];
            setPendingAdd(pendingSave(next));
            props.onSave(next);
          }}
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
            revisionKey={`${contextKey}:${plan.revision}`}
            onDirtyChange={setFunctionDirty}
            saveAcknowledged={saveAcknowledged}
            onSave={(edit) => {
              const next = editFunction(operations, originalNode!, edit);
              if (JSON.stringify(next) === JSON.stringify(operations)) return;
              setPendingFunction(pendingSave(next));
              props.onSave(next);
            }}
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
