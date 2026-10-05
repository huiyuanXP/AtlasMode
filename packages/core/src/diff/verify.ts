import type { CodeSnapshot, FunctionNode } from '../graph/code-snapshot.js';
import type { PlanRevision } from '../planning/models.js';
import type { VerificationItem } from './models.js';
import { dependencyMatches } from '../planning/validate.js';
export function verifyStructure(
  plan: PlanRevision,
  baseline: CodeSnapshot,
  current: CodeSnapshot,
): { items: VerificationItem[]; bindings: Record<string, string | null> } {
  const items: VerificationItem[] = [];
  const baselineFunctions = baseline.nodes.filter(
    (node): node is FunctionNode => node.kind === 'function',
  );
  const currentFunctions = current.nodes.filter(
    (node): node is FunctionNode => node.kind === 'function',
  );
  const filePath = (snapshot: CodeSnapshot, node: FunctionNode) => {
    const file = snapshot.nodes.find((file) => file.id === node.fileId);
    return file?.kind === 'file' ? file.path : null;
  };
  const mapping = new Map<string, FunctionNode | null>();
  for (const fn of baselineFunctions)
    mapping.set(
      fn.id,
      currentFunctions.find((node) => node.id === fn.id) ?? null,
    );
  const emit = (
    description: string,
    status: VerificationItem['status'],
    reason: string,
    nodes: FunctionNode[] = [],
  ) =>
    items.push({
      description,
      status,
      reason,
      evidence: nodes.map((node) => ({
        fileId: node.fileId,
        range: node.range,
      })),
    });
  for (const change of plan.changes) {
    if (change.op === 'add_function' || change.op === 'update_function') {
      const previous =
        change.op === 'update_function'
          ? baselineFunctions.find((node) => node.id === change.functionId)
          : null;
      const expectedName = change.name ?? previous?.name,
        expectedPath =
          change.filePath ?? (previous ? filePath(baseline, previous) : null);
      const matches = currentFunctions.filter(
        (node) =>
          node.name === expectedName &&
          filePath(current, node) === expectedPath,
      );
      const key = change.op === 'add_function' ? change.id : change.functionId;
      mapping.set(key, matches.length === 1 ? matches[0]! : null);
      emit(
        `${change.op}: ${expectedName}`,
        matches.length === 1
          ? 'satisfied'
          : matches.length === 0
            ? 'unsatisfied'
            : 'unknown',
        matches.length === 1
          ? 'Function found in required file; interface behavior still needs type/tests'
          : matches.length === 0
            ? 'Expected function/file not present'
            : 'Multiple symbol candidates require explicit binding',
        matches,
      );
      if (change.signature) {
        const exact =
          matches.length === 1 &&
          matches[0]!.signature.replace(/\s+/g, ' ') ===
            change.signature.replace(/\s+/g, ' ') &&
          !/\b(any|unknown)\b/.test(change.signature);
        emit(
          `Interface: ${expectedName}`,
          exact ? 'satisfied' : 'unknown',
          exact
            ? 'Static signature matches; functional behavior still requires tests'
            : 'Signature compatibility requires actual type and behavior checks',
          matches,
        );
      }
    }
    if (change.op === 'delete_function') {
      const found = currentFunctions.find(
        (node) => node.id === change.functionId,
      );
      emit(
        `delete_function: ${change.functionId}`,
        found ? 'unsatisfied' : 'satisfied',
        found
          ? 'Function remains in source'
          : 'Original symbol absent; rename/move is not automatically a deletion proof',
        found ? [found] : [],
      );
    }
  }
  const callItem = (
    sourceId: string,
    targetId: string,
    description: string,
    expectPresent = true,
  ) => {
    const source = mapping.get(sourceId),
      target =
        mapping.get(targetId) ??
        current.nodes.find(
          (node) => node.kind === 'external' && node.id === targetId,
        );
    if (!source || !target) {
      emit(description, 'unknown', 'Could not unambiguously bind endpoints');
      return;
    }
    const resolved = current.relations.some(
      (relation) =>
        relation.type === 'calls' &&
        relation.source === source.id &&
        relation.target === target.id,
    );
    const unresolved = current.relations.some(
      (relation) =>
        relation.type === 'calls' &&
        relation.source === source.id &&
        relation.resolution === 'unresolved',
    );
    const satisfied = resolved === expectPresent;
    emit(
      description,
      satisfied ? 'satisfied' : unresolved ? 'unknown' : 'unsatisfied',
      satisfied
        ? 'Parsed call structure matches the requirement'
        : unresolved
          ? 'Unresolved outgoing calls prevent a definitive conclusion'
          : 'Parsed call structure differs from approved requirement',
      [source, ...(target.kind === 'function' ? [target] : [])],
    );
  };
  for (const change of plan.changes) {
    if (change.op === 'add_call')
      callItem(
        change.source,
        change.target,
        `Required call: ${change.source} -> ${change.target}`,
      );
    if (change.op === 'delete_relation') {
      const relation = baseline.relations.find(
        (relation) => relation.id === change.relationId,
      );
      if (relation?.type === 'calls' && relation.target !== null)
        callItem(
          relation.source,
          relation.target,
          `Removed call: ${change.relationId}`,
          false,
        );
      else
        emit(
          `Removed relation: ${change.relationId}`,
          current.relations.some(
            (relation) => relation.id === change.relationId,
          )
            ? 'unsatisfied'
            : 'satisfied',
          'Comparison of parsed relation IDs',
        );
    }
  }
  for (const requirement of plan.requirements) {
    if (requirement.type === 'must_call' || requirement.type === 'must_reuse')
      callItem(
        requirement.nodeId,
        requirement.target,
        `${requirement.type}: ${requirement.reason}`,
      );
    else if (requirement.type === 'must_reside_in') {
      const node = mapping.get(requirement.nodeId);
      emit(
        requirement.reason,
        node
          ? filePath(current, node) === requirement.target
            ? 'satisfied'
            : 'unsatisfied'
          : 'unknown',
        node ? 'Checked parsed file ownership' : 'Endpoint binding unavailable',
        node ? [node] : [],
      );
    } else {
      const node = mapping.get(requirement.nodeId);
      const dependency = node
        ? current.relations.find(
            (relation) =>
              relation.source === node.id &&
              relation.target !== null &&
              current.nodes.some(
                (target) =>
                  target.id === relation.target &&
                  (target.kind === 'external'
                    ? target.packageName === requirement.target
                    : target.kind === 'function'
                      ? dependencyMatches(
                          requirement.target,
                          filePath(current, target) ?? '',
                        )
                      : false),
              ),
          )
        : undefined;
      emit(
        requirement.reason,
        !node ? 'unknown' : dependency ? 'unsatisfied' : 'unknown',
        dependency
          ? 'Found forbidden direct dependency'
          : 'Absence cannot prove a negative requirement when static coverage may be incomplete',
        node ? [node] : [],
      );
    }
  }
  const referenced = new Set(
    plan.changes.flatMap((change) =>
      change.op === 'add_function'
        ? [change.id]
        : change.op === 'add_call'
          ? [change.source, change.target]
          : change.op === 'update_function' || change.op === 'delete_function'
            ? [change.functionId]
            : [],
    ),
  );
  for (const requirement of plan.requirements) {
    referenced.add(requirement.nodeId);
    referenced.add(requirement.target);
  }
  return {
    items,
    bindings: Object.fromEntries(
      [...mapping]
        .filter(([id]) => referenced.has(id))
        .map(([id, node]) => [id, node?.id ?? null]),
    ),
  };
}
