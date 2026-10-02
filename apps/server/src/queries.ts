import {
  getFunctionContext,
  getProjectSummary,
  getSubgraph,
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
    subgraph: (id: string, input: SubgraphInput) =>
      getSubgraph(service.getSnapshot(id), input),
  };
}
