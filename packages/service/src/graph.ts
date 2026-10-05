import type { CodeSnapshot } from '@codemap/core';
export function searchFunctions(
  snapshot: CodeSnapshot,
  query: string,
  offset: number,
  limit: number,
) {
  const filePaths = new Map(
    snapshot.nodes
      .filter((node) => node.kind === 'file')
      .map((node) => [node.id, node.path]),
  );
  const matching = snapshot.nodes.filter(
    (node) =>
      node.kind === 'function' &&
      `${node.qualifiedName} ${filePaths.get(node.fileId)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return {
    snapshotId: snapshot.id,
    source: 'code' as const,
    items: matching.slice(offset, offset + limit),
    offset,
    limit,
    total: matching.length,
    unresolved: snapshot.relations.filter(
      (relation) => relation.resolution === 'unresolved',
    ).length,
  };
}
export function subgraph(
  snapshot: CodeSnapshot,
  seeds: string[],
  depth: number,
  budget: number,
  types: string[] = ['calls', 'imports', 'contains'],
) {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const included = new Set<string>();
  let truncated = false;
  const add = (id: string) => {
    if (included.has(id) || !nodes.has(id)) return;
    if (included.size >= budget) {
      truncated = true;
      return;
    }
    const node = nodes.get(id)!;
    if (node.kind === 'function') add(node.fileId);
    else if (
      (node.kind === 'file' || node.kind === 'folder') &&
      node.parentId !== null
    )
      add(node.parentId);
    if (included.size < budget) included.add(id);
    else truncated = true;
  };
  const initial = seeds.length
    ? seeds
    : snapshot.nodes
        .filter((node) => node.kind === 'function')
        .slice(0, 20)
        .map((node) => node.id);
  initial.forEach(add);
  let frontier = new Set(initial);
  for (let step = 0; step < depth; step++) {
    const next = new Set<string>();
    for (const relation of snapshot.relations) {
      if (!types.includes(relation.type)) continue;
      if (frontier.has(relation.source) && relation.target !== null) {
        add(relation.target);
        next.add(relation.target);
      }
      if (relation.target !== null && frontier.has(relation.target)) {
        add(relation.source);
        next.add(relation.source);
      }
    }
    frontier = next;
    if (included.size >= budget) {
      truncated = true;
      break;
    }
  }
  const relations = snapshot.relations.filter(
    (relation) =>
      included.has(relation.source) &&
      (relation.target === null || included.has(relation.target)) &&
      types.includes(relation.type),
  );
  return {
    snapshotId: snapshot.id,
    source: 'code' as const,
    nodes: snapshot.nodes.filter((node) => included.has(node.id)),
    relations: relations.slice(0, budget * 5),
    unresolved: relations
      .filter((relation) => relation.resolution === 'unresolved')
      .slice(0, budget),
    truncated: truncated || relations.length > budget * 5,
    budget,
    depth,
  };
}
