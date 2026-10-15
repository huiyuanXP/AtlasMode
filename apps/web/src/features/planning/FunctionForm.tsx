import { useEffect, useRef, useState } from "react";
import type { CodeNode } from "@codemap/core";
import type { FunctionEdit } from "./operations.js";
import { useStrings } from "../../i18n/index.js";
import { normalizeFunctionTarget } from "./function-target.js";
export function FunctionForm({
  node,
  description = "",
  onSave,
  add = false,
  revisionKey = "",
  onDirtyChange,
  saveAcknowledged = false,
}: {
  node?: CodeNode;
  description?: string;
  onSave: (edit: FunctionEdit) => void;
  add?: boolean;
  revisionKey?: string;
  onDirtyChange?: (dirty: boolean) => void;
  saveAcknowledged?: boolean;
}) {
  const zh = useStrings();
  const accepted: FunctionEdit = {
    name: node?.name ?? "",
    filePath: node?.filePath ?? "",
    signature: node?.signature ?? "",
    description,
  };
  const acceptedKey = JSON.stringify([revisionKey, node?.id, accepted]);
  const editGeneration = useRef(0);
  const submittedGeneration = useRef<number | undefined>(undefined);
  const [draft, setDraft] = useState<{
    basisKey: string;
    edit: FunctionEdit;
  }>();
  const dirty =
    !!draft && JSON.stringify(draft.edit) !== JSON.stringify(accepted);
  const stale = dirty && draft.basisKey !== acceptedKey;
  const edit = dirty ? draft.edit : accepted;
  let targetPath: string | undefined;
  try {
    targetPath = normalizeFunctionTarget(edit.filePath);
  } catch {
    /* Invalid paths block semantic submit. */
  }
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!saveAcknowledged || submittedGeneration.current === undefined) return;
    const submitted = submittedGeneration.current;
    submittedGeneration.current = undefined;
    // Recovery can accept an older committed save after the user has resumed editing.
    if (submitted === editGeneration.current) setDraft(undefined);
  }, [saveAcknowledged]);
  const change = (field: keyof FunctionEdit, value: string) => {
    editGeneration.current++;
    setDraft({
      basisKey: dirty ? draft.basisKey : acceptedKey,
      edit: { ...edit, [field]: value },
    });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!stale && targetPath) {
          submittedGeneration.current = editGeneration.current;
          onSave({ ...edit, filePath: targetPath });
        }
      }}
    >
      <label>
        {zh.name}
        <input
          required
          value={edit.name}
          onChange={(e) => change("name", e.target.value)}
        />
      </label>
      <label>
        {zh.targetFile}
        <input
          required
          value={edit.filePath}
          onChange={(e) => change("filePath", e.target.value)}
          placeholder="src/feature.ts"
        />
      </label>
      <label>
        {zh.signature}
        <input
          value={edit.signature}
          onChange={(e) => change("signature", e.target.value)}
        />
      </label>
      <label>
        {zh.functionDescription}
        <textarea
          aria-label={zh.functionDescription}
          value={edit.description}
          onChange={(e) => change("description", e.target.value)}
        />
      </label>
      <p className="preview">
        {zh.movePreview}:{" "}
        <code>
          {node?.filePath ?? "∅"} → {targetPath ?? "…"}
        </code>
      </p>
      {stale && (
        <p role="alert" className="warning">
          {zh.conflictHelp}
        </p>
      )}
      {dirty && (
        <button
          type="button"
          onClick={() => {
            editGeneration.current++;
            submittedGeneration.current = undefined;
            setDraft(undefined);
          }}
        >
          {zh.refreshPlan}
        </button>
      )}
      <button className="primary" type="submit" disabled={stale || !targetPath}>
        {add ? zh.add : zh.saveFunction}
      </button>
    </form>
  );
}
