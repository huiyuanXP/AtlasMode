import type { CodeNode, Operation, Project } from "@codemap/core";
export type NavigationLocation = {
  path: string;
  kind: "folder" | "file";
  planned?: boolean;
};
export type Breadcrumb = {
  label: string;
  kind: "folder" | "file" | "function";
  path: string;
  node?: CodeNode;
};
/** Repository-relative paths are already canonical in captured snapshots. */
export function breadcrumbs(
  project: Project,
  node?: CodeNode,
  location?: NavigationLocation,
): Breadcrumb[] {
  const result: Breadcrumb[] = [
    { label: project.name, kind: "folder", path: "." },
  ];
  const path = location?.planned
    ? location.path
    : (node?.filePath ?? location?.path ?? ".");
  const kind = node?.kind ?? location?.kind;
  if (path !== "." && kind !== "external") {
    const parts = path.split("/");
    for (let i = 0; i < parts.length; i++)
      result.push({
        label: parts[i]!,
        kind: i === parts.length - 1 && kind !== "folder" ? "file" : "folder",
        path: parts.slice(0, i + 1).join("/"),
      });
  }
  if (node?.kind === "function")
    result.push({
      label: node.qualifiedName ?? node.name,
      kind: "function",
      path,
      node,
    });
  return result;
}
/** A planned path stays tied to operations, never to guessed indexed file IDs. */
export function plannedScopeIds(
  operations: Operation[],
  path: string,
  kind: "folder" | "file",
): string[] {
  const destinations = new Map<string, string>();
  for (const op of operations) {
    if (op.kind === "add_function") destinations.set(op.tempId, op.filePath);
    if (op.kind === "move_function") destinations.set(op.nodeId, op.filePath);
  }
  for (const op of operations)
    if (op.kind === "remove_function") destinations.delete(op.nodeId);
  return [...destinations]
    .filter(([, target]) =>
      kind === "file"
        ? target === path
        : path === "." || target.startsWith(`${path}/`),
    )
    .map(([id]) => id);
}
