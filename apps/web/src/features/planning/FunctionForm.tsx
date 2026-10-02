import { useState } from "react";
import type { CodeNode } from "@codemap/core";
import type { FunctionEdit } from "./operations.js";
import { useStrings } from "../../i18n/index.js";
export function FunctionForm({
  node,
  description = "",
  onSave,
  add = false,
}: {
  node?: CodeNode;
  description?: string;
  onSave: (edit: FunctionEdit) => void;
  add?: boolean;
}) {
  const zh = useStrings();
  const [edit, setEdit] = useState<FunctionEdit>({
    name: node?.name ?? "",
    filePath: node?.filePath ?? "",
    signature: node?.signature ?? "",
    description,
  });
  const change = (field: keyof FunctionEdit, value: string) =>
    setEdit((current) => ({ ...current, [field]: value }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(edit);
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
          {node?.filePath ?? "∅"} → {edit.filePath || "…"}
        </code>
      </p>
      <button className="primary" type="submit">
        {add ? zh.add : zh.saveFunction}
      </button>
    </form>
  );
}
