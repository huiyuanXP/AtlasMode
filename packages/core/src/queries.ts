import {
  DomainError,
  type CodeNode,
  type CodeSnapshot,
  type Project,
  type Relation,
} from "./model.js";

export type Pagination = { offset?: number; limit?: number };
export type FunctionSearchInput = Pagination & { q?: string };
export type FunctionSearchResult = {
  items: CodeNode[];
  total: number;
  offset: number;
  limit: number;
  snapshotId: string;
  dataSource: "code";
};
export type FunctionContextResult = {
  node: CodeNode;
  incoming: Relation[];
  outgoing: Relation[];
  totalIncoming: number;
  totalOutgoing: number;
  truncated: boolean;
  offset: number;
  limit: number;
  snapshotId: string;
  dataSource: "code";
};
export type SubgraphInput = {
  nodeIds: string[];
  depth?: number;
  budget?: number;
  relationTypes?: Relation["type"][];
};
export type SubgraphResult = {
  nodes: CodeNode[];
  relations: Relation[];
  truncated: boolean;
  snapshotId: string;
  dataSource: "code";
};
export type ProjectSummary = {
  project: Project;
  snapshotId: string;
  contentHash: string;
  counts: {
    files: number;
    folders: number;
    functions: number;
    relations: number;
    calls: { resolved: number; unresolved: number; external: number };
  };
  entrypoints: CodeNode[];
  entrypointTotal: number;
  entrypointsTruncated: boolean;
  diagnostics: CodeSnapshot["diagnostics"];
  coverage: CodeSnapshot["coverage"];
  dataSource: "code";
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const compareNodes = (a: CodeNode, b: CodeNode) =>
  compare(a.name, b.name) ||
  compare(a.filePath ?? "", b.filePath ?? "") ||
  compare(a.id, b.id);
const compareRelations = (a: Relation, b: Relation) => compare(a.id, b.id);
function bound(value: number, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new DomainError(
      "INVALID_INPUT",
      "Query bounds must be integers within the supported range.",
    );
  return value;
}
function pagination(input: Pagination) {
  return {
    offset: bound(input.offset ?? 0, 0, Number.MAX_SAFE_INTEGER),
    limit: bound(input.limit ?? 50, 1, 200),
  };
}
export function searchFunctions(
  snapshot: CodeSnapshot,
  input: FunctionSearchInput = {},
): FunctionSearchResult {
  const { offset, limit } = pagination(input);
  if (input.q !== undefined && typeof input.q !== "string")
    throw new DomainError("INVALID_INPUT", "Search query must be a string.");
  const q = (input.q ?? "").trim().toLowerCase();
  const items = snapshot.nodes
    .filter(
      (n) =>
        n.kind === "function" &&
        (!q ||
          [n.name, n.qualifiedName, n.filePath].some((value) =>
            value?.toLowerCase().includes(q),
          )),
    )
    .sort(compareNodes);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
    snapshotId: snapshot.id,
    dataSource: "code",
  };
}
export function getFunctionContext(
  snapshot: CodeSnapshot,
  nodeId: string,
  input: Pagination = {},
): FunctionContextResult {
  const { offset, limit } = pagination(input);
  const node = snapshot.nodes.find(
    (n) => n.id === nodeId && n.kind === "function",
  );
  if (!node)
    throw new DomainError(
      "NOT_FOUND",
      "Function not found in this project snapshot.",
    );
  const calls = snapshot.relations
    .filter((r) => r.type === "calls")
    .sort(compareRelations);
  const incoming = calls.filter((r) => r.targetId === nodeId),
    outgoing = calls.filter((r) => r.sourceId === nodeId);
  return {
    node,
    incoming: incoming.slice(offset, offset + limit),
    outgoing: outgoing.slice(offset, offset + limit),
    totalIncoming: incoming.length,
    totalOutgoing: outgoing.length,
    truncated:
      (offset > 0 && (incoming.length > 0 || outgoing.length > 0)) ||
      incoming.length > offset + limit ||
      outgoing.length > offset + limit,
    offset,
    limit,
    snapshotId: snapshot.id,
    dataSource: "code",
  };
}
/** Bidirectional breadth-first traversal; physical parents are included after graph expansion.
 * Both budgets are transport bounds. All seeds are validated before any clipping.
 */
export function getSubgraph(
  snapshot: CodeSnapshot,
  input: SubgraphInput,
): SubgraphResult {
  const depth = bound(input.depth ?? 1, 0, 5),
    budget = bound(input.budget ?? 80, 1, 300);
  const types = input.relationTypes ?? ["calls"];
  if (
    !Array.isArray(input.nodeIds) ||
    !input.nodeIds.length ||
    input.nodeIds.some((id) => typeof id !== "string" || !id) ||
    !Array.isArray(types) ||
    !types.length ||
    types.some((type) => !["calls", "imports", "contains"].includes(type))
  )
    throw new DomainError(
      "INVALID_INPUT",
      "Expected node IDs and supported relation types.",
    );
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const seeds = [...new Set(input.nodeIds)].sort(compare);
  for (const id of seeds)
    if (!byId.has(id))
      throw new DomainError(
        "NOT_FOUND",
        "Node not found in this project snapshot.",
      );
  const relations = snapshot.relations
    .filter((r) => types.includes(r.type))
    .sort(compareRelations);
  const adjacency = new Map<string, Relation[]>();
  for (const relation of relations) {
    for (const id of new Set([relation.sourceId, relation.targetId])) {
      if (id === null) continue;
      const edges = adjacency.get(id) ?? [];
      edges.push(relation);
      adjacency.set(id, edges);
    }
  }
  const selected = new Set<string>();
  let truncated = false;
  function add(id: string): boolean {
    if (selected.has(id)) return false;
    if (selected.size >= budget) {
      truncated = true;
      return false;
    }
    selected.add(id);
    return true;
  }
  let frontier = seeds.filter(add);
  for (let level = 0; level < depth && frontier.length; level++) {
    const next = new Set<string>();
    for (const id of frontier)
      for (const edge of adjacency.get(id) ?? []) {
        const neighbor = edge.sourceId === id ? edge.targetId : edge.sourceId;
        if (neighbor !== null && byId.has(neighbor) && !selected.has(neighbor))
          next.add(neighbor);
      }
    frontier = [...next].sort(compare).filter(add);
  }
  // Parent links are source facts, not generated contains relations.
  for (const id of [...selected]) {
    let parent = byId.get(id)?.parentId;
    const visited = new Set<string>();
    while (parent && byId.has(parent) && !visited.has(parent)) {
      visited.add(parent);
      add(parent);
      parent = byId.get(parent)?.parentId;
    }
  }
  const edges = relations.filter(
    (r) =>
      selected.has(r.sourceId) &&
      (r.targetId === null || selected.has(r.targetId)),
  );
  if (edges.length > budget * 3) truncated = true;
  return {
    nodes: [...selected].map((id) => byId.get(id)!).sort(compareNodes),
    relations: edges.slice(0, budget * 3),
    truncated,
    snapshotId: snapshot.id,
    dataSource: "code",
  };
}
export function getProjectSummary(
  project: Project,
  snapshot: CodeSnapshot,
): ProjectSummary {
  if (project.id !== snapshot.projectId)
    throw new DomainError(
      "PROJECT_MISMATCH",
      "Project and snapshot do not match.",
    );
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const entrypoints = snapshot.nodes
    .filter(
      (n) =>
        n.kind === "function" &&
        n.exported === true &&
        (n.language !== "python" ||
          (!!n.parentId && byId.get(n.parentId)?.kind === "file")),
    )
    .sort(compareNodes);
  const calls = { resolved: 0, unresolved: 0, external: 0 };
  for (const relation of snapshot.relations)
    if (relation.type === "calls") calls[relation.resolution]++;
  return {
    project,
    snapshotId: snapshot.id,
    contentHash: snapshot.contentHash,
    counts: {
      files: snapshot.nodes.filter((n) => n.kind === "file").length,
      folders: snapshot.nodes.filter((n) => n.kind === "folder").length,
      functions: snapshot.nodes.filter((n) => n.kind === "function").length,
      relations: snapshot.relations.length,
      calls,
    },
    entrypoints: entrypoints.slice(0, 50),
    entrypointTotal: entrypoints.length,
    entrypointsTruncated: entrypoints.length > 50,
    diagnostics: snapshot.diagnostics,
    coverage: snapshot.coverage,
    dataSource: "code",
  };
}
