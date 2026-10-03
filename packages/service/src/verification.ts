import {
  normalizeRepoPath,
  type CodeNode,
  type CodeSnapshot,
  type Plan,
  type Relation,
  type VerificationReport,
} from "@codemap/core";

type Binding = { nodes: CodeNode[]; uncertain: boolean };
type Result = Omit<VerificationReport["items"][number], "operationIndex">;
const result = (
  status: Result["status"],
  message: string,
  evidence: string[] = [],
): Result => ({ status, message, evidence });
const location = (node: CodeNode) =>
  `${node.filePath ?? node.name}:${node.startLine ?? 1}`;
const evidence = (relation: Relation) =>
  `${relation.evidence.filePath}:${relation.evidence.line}${relation.evidence.text ? ` ${relation.evidence.text}` : ""}`;

/** Structural evidence only: no inference about annotation intent or runtime behavior. */
export function verify(
  plan: Plan,
  baseline: CodeSnapshot,
  current: CodeSnapshot,
): VerificationReport {
  const additions = new Map(
    plan.operations.flatMap((op) =>
      op.kind === "add_function" ? [[op.tempId, op] as const] : [],
    ),
  );
  const moves = new Map(
    plan.operations.flatMap((op) =>
      op.kind === "move_function"
        ? [[op.nodeId, normalizeRepoPath(op.filePath)] as const]
        : [],
    ),
  );
  const languageFamily = (path: string) =>
    /\.py$/i.test(path)
      ? "python"
      : /\.[cm]?[jt]sx?$/i.test(path)
        ? "javascript"
        : "unknown";
  const availability = current.coverage.availability;
  const touches = (paths: string[], affected: string) =>
    paths.some((path) => path === affected || path.startsWith(`${affected}/`));
  const missingCapture = (paths: string[]) =>
    paths.some((path) => !current.coverage.files.includes(path));
  const unavailable = (paths: string[], searchAllFiles: boolean) => {
    // Legacy snapshots remain readable, but an omitted file without captured
    // enumeration evidence cannot distinguish deletion from exclusion.
    if (!availability) return missingCapture(paths);
    if (!availability.complete && (searchAllFiles || missingCapture(paths)))
      return true;
    if ((availability.excludedPaths ?? []).some((path) => touches(paths, path)))
      return true;
    return availability.unavailablePaths.some(
      (affected) =>
        touches(paths, affected) ||
        (searchAllFiles &&
          paths.some(
            (path) =>
              languageFamily(affected) === "unknown" ||
              languageFamily(path) === languageFamily(affected),
          )),
    );
  };
  const incomplete = (paths: string[], searchAllFiles = false): boolean =>
    unavailable(paths, searchAllFiles) ||
    current.diagnostics.some((diagnostic) => {
      const affected = normalizeRepoPath(diagnostic.filePath);
      if (
        paths.some(
          (path) => path === affected || path.startsWith(`${affected}/`),
        )
      )
        return true;
      // Relocation/absence searches inspect a whole language's symbol space;
      // a broken file in that space can hide another candidate. Exact bindings
      // and planned target paths only depend on their own file/subtree.
      return (
        searchAllFiles &&
        paths.some(
          (path) =>
            languageFamily(affected) === "unknown" ||
            languageFamily(path) === "unknown" ||
            languageFamily(affected) === languageFamily(path),
        )
      );
    });
  const bind = (
    id: string,
    enforceMove = true,
    removalCandidate = false,
  ): Binding => {
    const added = additions.get(id);
    let nodes: CodeNode[];
    let paths: string[];
    let searchAllFiles = false;
    if (added) {
      const path = enforceMove
        ? (moves.get(id) ?? normalizeRepoPath(added.filePath))
        : normalizeRepoPath(added.filePath);
      paths = [path];
      nodes = current.nodes.filter(
        (n) =>
          n.kind === "function" &&
          n.filePath === path &&
          (n.name === added.name || n.qualifiedName === added.name) &&
          (!added.language || added.language === n.language) &&
          (!added.signature || added.signature === n.signature),
      );
    } else {
      const original = baseline.nodes.find((n) => n.id === id);
      if (!original) return { nodes: [], uncertain: true };
      const sameSymbol = (n: CodeNode) =>
        n.kind === original.kind &&
        (n.qualifiedName ?? n.name) ===
          (original.qualifiedName ?? original.name) &&
        n.language === original.language;
      const movedTo = enforceMove ? moves.get(id) : undefined;
      paths = [movedTo ?? original.filePath].filter(
        (path): path is string => !!path,
      );
      if (movedTo)
        nodes = current.nodes.filter(
          (n) => sameSymbol(n) && n.filePath === movedTo,
        );
      else {
        nodes = current.nodes.filter((n) => n.id === id);
        if (!nodes.length) {
          nodes = current.nodes.filter(sameSymbol);
          searchAllFiles = true;
        }
      }
    }
    return {
      nodes,
      // Same-name candidates can conservatively block removal, but cannot
      // establish a positive identity without an explicit approved move.
      uncertain:
        nodes.length > 1 ||
        (searchAllFiles && nodes.length > 0 && !removalCandidate) ||
        incomplete(paths, searchAllFiles),
    };
  };
  const relationCheck = (
    source: Binding,
    target: Binding,
    type: Relation["type"],
    removing: boolean,
  ): Result => {
    if (source.uncertain || target.uncertain)
      return result("unknown", "Symbol binding or analysis is ambiguous.");
    if (!source.nodes.length || !target.nodes.length)
      return result(
        removing ? "satisfied" : "unmet",
        "A required endpoint is absent from the current indexed source.",
      );
    const from = source.nodes[0]!,
      to = target.nodes[0]!;
    const outgoing = current.relations.filter(
      (r) => r.sourceId === from.id && r.type === type,
    );
    const found = outgoing.filter(
      (r) =>
        r.targetId === to.id &&
        (r.resolution === "resolved" ||
          (to.kind === "external" && r.resolution === "external")),
    );
    if (found.length)
      return result(
        removing ? "unmet" : "satisfied",
        removing
          ? "The original relation still exists."
          : "The required relation exists.",
        found.map(evidence),
      );
    if (outgoing.some((r) => r.resolution === "unresolved"))
      return result(
        "unknown",
        "Dynamic or unresolved relations prevent a definitive absence check.",
        outgoing.filter((r) => r.resolution === "unresolved").map(evidence),
      );
    return result(
      removing ? "satisfied" : "unmet",
      removing
        ? "The original relation is absent."
        : "No direct call to the required target was found.",
      [location(from), location(to)],
    );
  };
  const items = plan.operations.map((operation, operationIndex) => {
    let item: Result;
    switch (operation.kind) {
      case "annotate":
        item = result("unknown", "Annotation semantics require human review.");
        break;
      case "add_function": {
        const binding = bind(operation.tempId);
        item = binding.uncertain
          ? result("unknown", "Function binding or analysis is ambiguous.")
          : result(
              binding.nodes.length ? "satisfied" : "unmet",
              binding.nodes.length
                ? "Planned function exists at the target path."
                : "Planned function was not found.",
              binding.nodes.map(location),
            );
        break;
      }
      case "move_function": {
        const target = bind(operation.nodeId),
          original = baseline.nodes.find((n) => n.id === operation.nodeId),
          added = additions.get(operation.nodeId);
        const originalPath = added
          ? normalizeRepoPath(added.filePath)
          : original?.filePath;
        const changedPath =
          originalPath !== normalizeRepoPath(operation.filePath);
        // A temporary function's source identity comes from its add operation,
        // since it has no baseline node. Both kinds of move must remove the source.
        const oldStillExists =
          changedPath &&
          (added
            ? bind(operation.nodeId, false).nodes.length > 0
            : current.nodes.some((n) => n.id === original?.id));
        const sourceIncomplete =
          changedPath && !!originalPath && incomplete([originalPath]);
        item =
          target.uncertain || sourceIncomplete
            ? result(
                "unknown",
                "Moved function binding or analysis is ambiguous.",
              )
            : result(
                target.nodes.length && !oldStillExists ? "satisfied" : "unmet",
                target.nodes.length && !oldStillExists
                  ? "Function is located at the planned destination."
                  : "The required move was not established.",
                target.nodes.map(location),
              );
        break;
      }
      case "remove_function": {
        const binding = bind(operation.nodeId, false, true);
        item = binding.uncertain
          ? result(
              "unknown",
              "Symbol binding or analysis cannot establish removal.",
            )
          : result(
              binding.nodes.length ? "unmet" : "satisfied",
              binding.nodes.length
                ? "The function still exists."
                : "The function is absent from indexed source.",
              binding.nodes.map(location),
            );
        break;
      }
      case "add_relation":
        item = relationCheck(
          bind(operation.sourceId),
          bind(operation.targetId),
          "calls",
          false,
        );
        break;
      case "remove_relation": {
        const relation = baseline.relations.find(
          (r) => r.id === operation.relationId,
        );
        item =
          !relation?.targetId || relation.resolution === "unresolved"
            ? result(
                "unknown",
                "The baseline relation has unresolved endpoints.",
              )
            : relationCheck(
                bind(relation.sourceId, false),
                bind(relation.targetId, false),
                relation.type,
                true,
              );
        break;
      }
    }
    return { operationIndex, ...item };
  });
  return {
    planId: plan.id,
    revision: plan.revision,
    snapshotId: current.id,
    items,
  };
}
