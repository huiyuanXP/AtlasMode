import {
  DomainError,
  type CodeNode,
  type CodeSnapshot,
  type SubgraphResult,
} from "@codemap/core";
export type ScopeInput = {
  path: string;
  kind: "folder" | "file";
  budget?: number;
  snapshotId?: string;
  allowMissing?: boolean;
};
export type ScopeResult = SubgraphResult & {
  root?: CodeNode;
  path: string;
  kind: "folder" | "file";
  missing?: boolean;
};
/** A single captured service snapshot supplies identities and containment. No filesystem reads. */
export function navigationScope(
  snapshot: CodeSnapshot,
  input: ScopeInput,
): ScopeResult {
  const budget = input.budget ?? 80;
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > 300)
    throw new DomainError("INVALID_INPUT", "Scope budget must be 1–300.");
  const parts = input.path.split("/");
  if (
    input.path !== "." &&
    parts.some((p) => !p || p === "." || p === ".." || /[\\\u0000:]/.test(p))
  )
    throw new DomainError(
      "INVALID_INPUT",
      "Scope path must be canonical and repository relative.",
    );
  if (input.snapshotId && input.snapshotId !== snapshot.id)
    throw new DomainError(
      "SNAPSHOT_CHANGED",
      "Scope snapshot changed; refresh the project.",
    );
  const root = snapshot.nodes.find(
    (n) =>
      n.kind === input.kind &&
      (input.path === "."
        ? !n.parentId && (!n.filePath || n.filePath === ".")
        : n.filePath === input.path),
  );
  if (
    !root &&
    !input.allowMissing &&
    !(
      input.path === "." &&
      input.kind === "folder" &&
      snapshot.nodes.length === 0
    )
  )
    throw new DomainError(
      "NOT_FOUND",
      "Scope does not exist in this snapshot.",
    );
  const children =
    input.kind === "folder" && root
      ? snapshot.nodes
          .filter(
            (n) =>
              n.parentId === root.id &&
              (n.kind === "file" || n.kind === "folder"),
          )
          .sort((a, b) => (a.filePath ?? "").localeCompare(b.filePath ?? ""))
      : [];
  const nodes = root ? [root, ...children].slice(0, budget) : [];
  const ids = new Set(nodes.map((n) => n.id));
  const relations = snapshot.relations.filter(
    (r) =>
      r.type === "contains" &&
      r.sourceId === root?.id &&
      r.targetId &&
      ids.has(r.targetId),
  );
  return {
    snapshotId: snapshot.id,
    nodes,
    relations: relations.slice(0, 900),
    root,
    path: input.path,
    kind: input.kind,
    ...(!root && input.path !== "." ? { missing: true } : {}),
    dataSource: "code",
    truncated:
      children.length + (root ? 1 : 0) > budget || relations.length > 900,
  };
}
