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
  const path = node?.filePath ?? location?.path ?? ".";
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
  return [
    ...new Set(
      operations.flatMap((op) => {
        if (op.kind !== "add_function" && op.kind !== "move_function")
          return [];
        const matches =
          kind === "file"
            ? op.filePath === path
            : path === "." || op.filePath.startsWith(`${path}/`);
        return matches
          ? [op.kind === "add_function" ? op.tempId : op.nodeId]
          : [];
      }),
    ),
  ];
}
