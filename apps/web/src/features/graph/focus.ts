import type { Operation, Relation } from "@codemap/core";

export type FocusRequest = {
  nodeId?: string;
  nodeIds?: string[];
  sequence: number;
};
export function affectedOperations(
  operations: Operation[],
  previous?: Operation[],
) {
  return previous
    ? [
        ...previous.filter(
          (o) =>
            !operations.some((n) => JSON.stringify(n) === JSON.stringify(o)),
        ),
        ...operations.filter(
          (o) => !previous.some((n) => JSON.stringify(n) === JSON.stringify(o)),
        ),
      ]
    : operations;
}

/** Plan choice uses every operation; edits use only the operations changed by
 * this transaction, including old endpoints of a reconnected/deleted edge. */
export function affectedNodeIds(
  operations: Operation[],
  previous?: Operation[],
  relations: Relation[] = [],
  invalidAnnotations: string[] = [],
): string[] {
  const changed = affectedOperations(operations, previous);
  const removed = new Set(
    (previous ?? []).flatMap((o) =>
      o.kind === "add_function" &&
      !operations.some(
        (n) => n.kind === "add_function" && n.tempId === o.tempId,
      )
        ? [o.tempId]
        : [],
    ),
  );
  return [
    ...new Set(
      changed.flatMap((o) => {
        switch (o.kind) {
          case "add_function":
            return [o.tempId];
          case "move_function":
          case "remove_function":
            return [o.nodeId];
          case "annotate":
            return invalidAnnotations.includes(o.targetId) ? [] : [o.targetId];
          case "add_relation":
            return [o.sourceId, o.targetId];
          case "remove_relation": {
            const edge =
              relations.find((r) => r.id === o.relationId) ??
              [...operations, ...(previous ?? [])].find(
                (r) => r.kind === "add_relation" && r.id === o.relationId,
              );
            return edge && "sourceId" in edge
              ? [edge.sourceId, ...(edge.targetId ? [edge.targetId] : [])]
              : [];
          }
        }
      }),
    ),
  ].filter((id) => !removed.has(id));
}
