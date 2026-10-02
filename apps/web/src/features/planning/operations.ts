import type { CodeNode, Operation } from "@codemap/core";
export type PlannedRelation = Extract<Operation, { kind: "add_relation" }>;
export type EdgeReference = {
  id: string;
  domainId: string;
  layer: "fact" | "plan";
};
export type FunctionEdit = {
  name: string;
  filePath: string;
  signature: string;
  description: string;
};
export function deleteTemporary(
  operations: Operation[],
  id: string,
): Operation[] {
  const edges = new Set(
    operations
      .filter(
        (o) =>
          o.kind === "add_relation" && (o.sourceId === id || o.targetId === id),
      )
      .map((o) => (o as PlannedRelation).id),
  );
  return operations.filter((o) => {
    switch (o.kind) {
      case "add_function":
        return o.tempId !== id;
      case "add_relation":
        return o.sourceId !== id && o.targetId !== id;
      case "annotate":
        return o.targetId !== id;
      case "move_function":
      case "remove_function":
        return o.nodeId !== id;
      case "remove_relation":
        return !edges.has(o.relationId);
    }
  });
}
export function reconnectRelation(
  operations: Operation[],
  edge: EdgeReference,
  sourceId: string,
  targetId: string,
  type: PlannedRelation["type"],
  newId: string,
): Operation[] {
  if (edge.layer === "plan")
    return operations.map((o) =>
      o.kind === "add_relation" && o.id === edge.domainId
        ? { ...o, sourceId, targetId, type }
        : o,
    );
  const removal: Operation[] = operations.some(
    (o) => o.kind === "remove_relation" && o.relationId === edge.domainId,
  )
    ? []
    : [{ kind: "remove_relation", relationId: edge.domainId }];
  return [
    ...operations,
    ...removal,
    { kind: "add_relation", id: newId, sourceId, targetId, type },
  ];
}
export function editFunction(
  operations: Operation[],
  node: CodeNode,
  edit: FunctionEdit,
): Operation[] {
  const planned = operations.find(
    (o) => o.kind === "add_function" && o.tempId === node.id,
  );
  if (planned)
    return operations.map((o) => (o === planned ? { ...planned, ...edit } : o));
  const result = [...operations];
  if (edit.filePath !== node.filePath)
    result.push({
      kind: "move_function",
      nodeId: node.id,
      filePath: edit.filePath,
    });
  const text = [
    edit.name !== node.name ? `name: ${edit.name}` : "",
    edit.signature !== (node.signature ?? "")
      ? `signature: ${edit.signature}`
      : "",
    edit.description,
  ]
    .filter(Boolean)
    .join("\n");
  if (text) result.push({ kind: "annotate", targetId: node.id, text });
  return result;
}

export const temporaryId = () => `temp:${crypto.randomUUID()}`;
