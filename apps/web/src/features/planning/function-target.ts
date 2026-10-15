import {
  normalizeRepoPath,
  type CodeNode,
  type Operation,
} from "@codemap/core";

export function normalizeFunctionTarget(target: string): string {
  const path = normalizeRepoPath(target);
  if (
    path === "." ||
    /[\\/]$/.test(target) ||
    !/\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i.test(path)
  )
    throw new Error("Expected a complete supported source file path.");
  return path;
}

/** Planned paths never replace the physical identity/path supplied by the caller. */
export function effectiveFunctionPath(
  operations: readonly Operation[],
  node: CodeNode,
): string | undefined {
  const addition = operations.find(
    (o) => o.kind === "add_function" && o.tempId === node.id,
  );
  let path =
    addition?.kind === "add_function" ? addition.filePath : node.filePath;
  for (const op of operations)
    if (op.kind === "move_function" && op.nodeId === node.id)
      path = op.filePath;
  return path;
}

/** An explicit target edit coalesces only this function; unrelated authored ops survive. */
export function retargetFunction(
  operations: Operation[],
  node: CodeNode,
  target: string,
): Operation[] {
  if (
    node.kind !== "function" ||
    operations.some((o) => o.kind === "remove_function" && o.nodeId === node.id)
  )
    throw new Error("Function is unavailable for retargeting.");
  const path = normalizeFunctionTarget(target);
  if (path === effectiveFunctionPath(operations, node)) return operations;
  const addition = operations.find(
    (o) => o.kind === "add_function" && o.tempId === node.id,
  );
  if (addition?.kind === "add_function")
    return operations
      .filter((o) => !(o.kind === "move_function" && o.nodeId === node.id))
      .map((o) => (o === addition ? { ...addition, filePath: path } : o));
  if (!node.filePath) throw new Error("Physical baseline path is unavailable.");
  const baseline = normalizeRepoPath(node.filePath);
  let emitted = false;
  const result: Operation[] = [];
  for (const op of operations) {
    if (op.kind === "move_function" && op.nodeId === node.id) {
      if (!emitted && path !== baseline)
        result.push({ kind: "move_function", nodeId: node.id, filePath: path });
      emitted = true;
    } else result.push(op);
  }
  if (!emitted && path !== baseline)
    result.push({ kind: "move_function", nodeId: node.id, filePath: path });
  return result;
}
