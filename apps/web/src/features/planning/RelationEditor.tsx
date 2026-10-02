import { useState } from "react";
import type { CodeNode, Operation } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
import {
  reconnectRelation,
  temporaryId,
  type EdgeReference,
  type PlannedRelation,
} from "./operations.js";
export function RelationEditor({
  operations,
  node,
  nodes,
  edge,
  onSave,
  onClearEdge,
}: {
  operations: Operation[];
  node?: CodeNode;
  nodes: CodeNode[];
  edge?: EdgeReference;
  onSave: (operations: Operation[]) => void;
  onClearEdge: () => void;
}) {
  const zh = useStrings();
  const planned = operations.filter(
    (o): o is Extract<Operation, { kind: "add_function" }> =>
      o.kind === "add_function",
  );
  const candidates = [
    ...new Map(
      [
        ...nodes.filter((n) => n.kind === "function"),
        ...planned.map((o) => ({
          id: o.tempId,
          kind: "function" as const,
          name: o.name,
          filePath: o.filePath,
        })),
      ].map((n) => [n.id, n]),
    ).values(),
  ];
  const selectedRelation =
    edge?.layer === "plan"
      ? operations.find(
          (o) => o.kind === "add_relation" && o.id === edge.domainId,
        )
      : undefined;
  const [from, setFrom] = useState(
    selectedRelation?.kind === "add_relation"
      ? selectedRelation.sourceId
      : (node?.id ?? ""),
  );
  const [to, setTo] = useState(
    selectedRelation?.kind === "add_relation" ? selectedRelation.targetId : "",
  );
  const [relationType, setRelationType] = useState<PlannedRelation["type"]>(
    selectedRelation?.kind === "add_relation" ? selectedRelation.type : "calls",
  );
  return (
    <details open>
      <summary>{zh.relation}</summary>
      <p className="muted">
        {edge ? `${zh.selectedEdge}: ${edge.domainId}` : zh.noEdge}
      </p>
      {edge?.layer === "fact" && <p className="muted">{zh.factEdgeHelp}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            edge
              ? reconnectRelation(
                  operations,
                  edge,
                  from,
                  to,
                  relationType,
                  temporaryId(),
                )
              : [
                  ...operations,
                  {
                    kind: "add_relation",
                    id: temporaryId(),
                    sourceId: from,
                    targetId: to,
                    type: relationType,
                  },
                ],
          );
          onClearEdge();
        }}
      >
        <label>
          {zh.from}
          <select
            aria-label={zh.from}
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <option value="">{zh.emptySelect}</option>
            {candidates.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} · {n.filePath}
              </option>
            ))}
          </select>
        </label>
        <label>
          {zh.to}
          <select
            aria-label={zh.to}
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            <option value="">{zh.emptySelect}</option>
            {candidates.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} · {n.filePath}
              </option>
            ))}
          </select>
        </label>
        <label>
          {zh.relationType}
          <select
            aria-label={zh.relationType}
            value={relationType}
            onChange={(e) =>
              setRelationType(e.target.value as PlannedRelation["type"])
            }
          >
            {(["calls", "must_call", "must_reuse"] as const).map((t) => (
              <option key={t} value={t}>
                {zh[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{edge ? zh.reconnect : zh.addRelation}</button>
      </form>
      {edge && (
        <div className="button-row">
          <button
            onClick={() => {
              onSave(
                edge.layer === "plan"
                  ? operations.filter(
                      (o) =>
                        !(o.kind === "add_relation" && o.id === edge.domainId),
                    )
                  : [
                      ...operations,
                      { kind: "remove_relation", relationId: edge.domainId },
                    ],
              );
              onClearEdge();
            }}
          >
            {zh.removeRelation}
          </button>
          <button onClick={onClearEdge}>{zh.cancelEdge}</button>
        </div>
      )}
    </details>
  );
}
