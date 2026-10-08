import {
  getFunctionContext,
  getProjectSummary,
  getSubgraph,
  DomainError,
  searchFunctions,
  type FunctionSearchInput,
  type Pagination,
  type SubgraphInput,
} from "@codemap/core";
import type { WorkspaceService } from "@codemap/service";

/** Transport glue only: every query receives the project's current service snapshot. */
export function projectQueries(service: WorkspaceService) {
  return {
    summary: (id: string) =>
      getProjectSummary(service.getProject(id), service.getSnapshot(id)),
    functions: (id: string, input: FunctionSearchInput) =>
      searchFunctions(service.getSnapshot(id), input),
    context: (id: string, nodeId: string, input: Pagination) =>
      getFunctionContext(service.getSnapshot(id), nodeId, input),
    subgraph: (
      id: string,
      input: SubgraphInput & { relationIds?: string[] },
    ) => {
      const snapshot = service.getSnapshot(id);
      // Resolve all anchors before applying the budget, in this same project
      // snapshot. Missing/foreign IDs cannot disappear behind a small budget.
      const endpoints = (input.relationIds ?? []).flatMap((id) => {
        const edge = snapshot.relations.find((r) => r.id === id);
        if (!edge)
          throw new DomainError(
            "NOT_FOUND",
            `Relation ${id} does not exist in this project.`,
          );
        return [edge.sourceId, ...(edge.targetId ? [edge.targetId] : [])];
      });
      return getSubgraph(snapshot, {
        ...input,
        nodeIds: [...new Set([...input.nodeIds, ...endpoints])],
      });
    },
  };
}
