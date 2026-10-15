import {
  normalizeRepoPath,
  type CodeNode,
  type Operation,
} from "@codemap/core";
import { effectiveFunctionPath } from "../planning/function-target.js";
export type OwnershipTuple = Readonly<{
  projectId: string;
  snapshotId: string;
  planId: string;
  revision: number;
}>;
export type OwnershipIntent = OwnershipTuple &
  Readonly<{
    sourceId: string;
    physicalPath?: string;
    effectivePath?: string;
    nonce: string;
  }>;
export type OwnershipTarget = Readonly<{
  kind: "file" | "folder";
  path: string;
  id?: string;
  planned?: boolean;
}>;
const sourceSuffix = /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;
function canonical(path: string, root: boolean): string {
  if (root && path === ".") return path;
  const result = normalizeRepoPath(path);
  if (result !== path || result === ".")
    throw new Error("Expected a canonical repository path.");
  return result;
}
export function completeTargetPath(
  target: OwnershipTarget,
  filename?: string,
): string {
  const path = canonical(target.path, target.kind === "folder");
  if (target.kind === "file") {
    if (!sourceSuffix.test(path))
      throw new Error("Choose a complete supported source filename.");
    return path;
  }
  if (
    !filename ||
    filename.trim() !== filename ||
    filename === "." ||
    filename === ".." ||
    /[\\/:\u0000-\u001f\u007f]/.test(filename) ||
    !sourceSuffix.test(filename)
  )
    throw new Error(
      "Enter one supported source filename, without directories.",
    );
  return canonical(path === "." ? filename : `${path}/${filename}`, false);
}
export function captureOwnershipIntent(
  tuple: OwnershipTuple,
  node: CodeNode,
  operations: Operation[],
  nonce: string,
  sourceSnapshotId: string,
): OwnershipIntent {
  if (
    !tuple.projectId ||
    !tuple.snapshotId ||
    !tuple.planId ||
    !Number.isSafeInteger(tuple.revision) ||
    tuple.revision < 1 ||
    !nonce ||
    sourceSnapshotId !== tuple.snapshotId ||
    node.kind !== "function" ||
    operations.some((o) => o.kind === "remove_function" && o.nodeId === node.id)
  )
    throw new Error("Current function identity is unavailable.");
  const addition = operations.find(
    (o) => o.kind === "add_function" && o.tempId === node.id,
  );
  if (!addition && !node.filePath)
    throw new Error("Physical function path is unavailable.");
  return Object.freeze({
    ...tuple,
    sourceId: node.id,
    ...(addition ? {} : { physicalPath: node.filePath }),
    effectivePath: effectiveFunctionPath(operations, node),
    nonce,
  });
}
export const matchesOwnershipIntent = (
  intent: OwnershipIntent,
  tuple: OwnershipTuple,
  selectedId: string | undefined,
  nonce: string,
) =>
  intent.projectId === tuple.projectId &&
  intent.snapshotId === tuple.snapshotId &&
  intent.planId === tuple.planId &&
  intent.revision === tuple.revision &&
  intent.sourceId === selectedId &&
  intent.nonce === nonce;
