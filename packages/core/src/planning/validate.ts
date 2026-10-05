import type { CodeSnapshot } from '../graph/code-snapshot.js';
import type { FolderPolicy } from '../knowledge/models.js';
import type { PlanInput, PlanValidation } from './models.js';
export function dependencyMatches(pattern: string, target: string): boolean {
  return pattern.endsWith('*') && !pattern.slice(0, -1).includes('*')
    ? target.startsWith(pattern.slice(0, -1))
    : target === pattern || target.startsWith(pattern + '/');
}
export function validatePlan(
  plan: PlanInput,
  snapshot: CodeSnapshot,
  policies: FolderPolicy[],
): PlanValidation {
  const errors: string[] = [],
    warnings: string[] = [],
    unknown: string[] = [];
  const files = new Map(
    snapshot.nodes
      .filter((node) => node.kind === 'file')
      .map((node) => [node.id, node.path]),
  );
  const functions = new Map(
    snapshot.nodes
      .filter((node) => node.kind === 'function')
      .map((node) => [
        node.id,
        {
          name: node.name,
          signature: node.signature,
          filePath: files.get(node.fileId) ?? '',
        },
      ]),
  );
  const packages = new Map(
    snapshot.nodes
      .filter((node) => node.kind === 'external')
      .map((node) => [node.id, node.packageName]),
  );
  for (const change of plan.changes.filter(
    (change) => change.op === 'add_function',
  )) {
    if (functions.has(change.id))
      errors.push(`Duplicate function ID: ${change.id}`);
    else if (
      [...functions.values()].some(
        (node) =>
          node.name === change.name && node.filePath === change.filePath,
      )
    )
      errors.push(
        `Function already exists in this file; use update_function: ${change.name}`,
      );
    else functions.set(change.id, change);
  }
  const deleted = new Set<string>(),
    removedRelations = new Set(
      plan.changes
        .filter((change) => change.op === 'delete_relation')
        .map((change) => change.relationId),
    );
  for (const change of plan.changes) {
    if (change.op === 'update_function' || change.op === 'delete_function') {
      const node = functions.get(change.functionId);
      if (!node || change.functionId.startsWith('plan:'))
        errors.push(`Unknown existing function: ${change.functionId}`);
      else if (change.op === 'delete_function') deleted.add(change.functionId);
      else
        functions.set(change.functionId, {
          name: change.name ?? node.name,
          signature: change.signature ?? node.signature,
          filePath: change.filePath ?? node.filePath,
        });
    }
    if (
      change.op === 'delete_relation' &&
      !snapshot.relations.some((relation) => relation.id === change.relationId)
    )
      errors.push(`Unknown relation: ${change.relationId}`);
  }
  for (const id of deleted) functions.delete(id);
  for (const relation of snapshot.relations)
    if (
      (deleted.has(relation.source) ||
        (relation.target !== null && deleted.has(relation.target))) &&
      !removedRelations.has(relation.id) &&
      relation.type !== 'contains'
    )
      errors.push(
        `Deleting a function requires deleting its incident relation: ${relation.id}`,
      );
  const callIds = new Set<string>(),
    calls = snapshot.relations
      .filter(
        (relation) =>
          relation.type === 'calls' &&
          relation.target !== null &&
          !removedRelations.has(relation.id) &&
          !deleted.has(relation.source) &&
          !deleted.has(relation.target),
      )
      .map((relation) => ({
        source: relation.source,
        target: relation.target!,
      }));
  for (const change of plan.changes) {
    if (change.op === 'add_call') {
      if (callIds.has(change.id))
        errors.push(`Duplicate relation ID: ${change.id}`);
      callIds.add(change.id);
      if (
        !functions.has(change.source) ||
        (!functions.has(change.target) && !packages.has(change.target))
      )
        errors.push(
          `Call endpoints must be a retained function and a known function/package: ${change.id}`,
        );
      calls.push(change);
      unknown.push(
        `Interface/data compatibility requires source or tests: ${change.id}`,
      );
    }
  }
  const targetPath = (id: string) =>
    functions.get(id)?.filePath ?? packages.get(id) ?? files.get(id);
  for (const call of calls) {
    const source = functions.get(call.source),
      target = targetPath(call.target);
    if (!source || !target) continue;
    for (const policy of policies) {
      if (
        policy.path !== '.' &&
        !dependencyMatches(policy.path, source.filePath)
      )
        continue;
      const exempt = policy.exceptions.some((exception) =>
        dependencyMatches(exception.dependency, target),
      );
      if (
        !exempt &&
        policy.forbiddenDependencies.some((pattern) =>
          dependencyMatches(pattern, target),
        )
      )
        errors.push(`Forbidden dependency under ${policy.path}: ${target}`);
      if (
        !exempt &&
        policy.allowedDependencies.length &&
        !policy.allowedDependencies.some((pattern) =>
          dependencyMatches(pattern, target),
        )
      )
        errors.push(
          `Dependency outside the allowlist under ${policy.path}: ${target}`,
        );
    }
  }
  for (const requirement of plan.requirements) {
    const node = functions.get(requirement.nodeId);
    if (!node) {
      errors.push(`Requirement endpoint missing: ${requirement.nodeId}`);
      continue;
    }
    if (requirement.type === 'must_call' || requirement.type === 'must_reuse') {
      if (
        !functions.has(requirement.target) &&
        !packages.has(requirement.target)
      )
        errors.push(`Required function/package missing: ${requirement.target}`);
      if (
        !calls.some(
          (call) =>
            call.source === requirement.nodeId &&
            call.target === requirement.target,
        )
      )
        errors.push(
          `Required call is absent from plan: ${requirement.nodeId} -> ${requirement.target}`,
        );
    }
    if (
      requirement.type === 'must_reside_in' &&
      node.filePath !== requirement.target
    )
      errors.push(`Required file differs: ${requirement.nodeId}`);
    if (
      requirement.type === 'must_not_depend_on' &&
      calls.some(
        (call) =>
          call.source === requirement.nodeId &&
          targetPath(call.target) !== undefined &&
          dependencyMatches(requirement.target, targetPath(call.target)!),
      )
    )
      errors.push(
        `Plan contains a forbidden dependency: ${requirement.reason}`,
      );
  }
  if (plan.baselineSnapshotId !== snapshot.id)
    errors.push('Baseline snapshot mismatch');
  if (
    plan.changes.some(
      (change) => change.op === 'update_function' && change.signature,
    )
  )
    unknown.push(
      'Changed interfaces need behavior/type tests after implementation',
    );
  return {
    errors: [...new Set(errors)],
    warnings,
    unknown: [...new Set(unknown)],
  };
}
