import {
  getFunctionContext,
  getProjectSummary,
  getSubgraph,
  DomainError,
  searchFunctions,
  type FunctionSearchInput,
  type Pagination,
  type SubgraphInput,
  type Relation,
  type SubgraphResult,
} from "@codemap/core";
import type { WorkspaceService } from "@codemap/service";
import { navigationScope, type ScopeInput } from "./navigation-query.js";

/** Transport glue only: every query receives the project's current service snapshot. */
export function projectQueries(service: WorkspaceService) {
  return {
    scope: (id: string, input: ScopeInput) =>
      navigationScope(service.getSnapshot(id), input),
    dependencies: (
      id: string,
      input: { nodeId: string; budget?: number },
    ): SubgraphResult & { unknownCount: number } => {
      const snapshot = service.getSnapshot(id);
      const budget = input.budget ?? 80;
      if (!Number.isSafeInteger(budget) || budget < 1 || budget > 300)
        throw new DomainError(
          "INVALID_INPUT",
          "Dependency budget must be 1–300.",
        );
      const root = snapshot.nodes.find((n) => n.id === input.nodeId);
      if (!root)
        throw new DomainError(
          "NOT_FOUND",
          "Dependency root does not exist in this snapshot.",
        );
      if (root.kind !== "function" && root.kind !== "file")
        throw new DomainError(
          "INVALID_INPUT",
          "Dependency roots must be functions or files.",
        );
      if (root.kind === "function") {
        const result = getSubgraph(
          {
            ...snapshot,
            nodes: snapshot.nodes.filter((n) => n.kind !== "external"),
            relations: snapshot.relations.map((r) =>
              r.resolution === "resolved" ? r : { ...r, targetId: null },
            ),
          },
          {
            nodeIds: [root.id],
            depth: 1,
            budget,
            relationTypes: ["calls"],
          },
        );
        return {
          ...result,
          unknownCount: snapshot.relations.filter(
            (r) =>
              r.type === "calls" &&
              (r.sourceId === root.id || r.targetId === root.id) &&
              r.resolution !== "resolved",
          ).length,
        };
      }
      const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
      const files = new Map(
        snapshot.nodes
          .filter((n) => n.kind === "file")
          .map((n) => [n.filePath, n]),
      );
      const owningFile = (id: string) => {
        const n = byId.get(id);
        return n?.kind === "file" ? n : files.get(n?.filePath);
      };
      const aggregated = new Map<string, Relation>();
      let unknownCount = 0;
      for (const r of snapshot.relations) {
        if (r.type !== "calls" && r.type !== "imports") continue;
        const source = owningFile(r.sourceId),
          target = r.targetId ? owningFile(r.targetId) : undefined;
        if (!source || (source.id !== root.id && target?.id !== root.id))
          continue;
        if (r.resolution !== "resolved" || !target) {
          unknownCount++;
          // Keep each unknown's evidence; never invent a file for its target.
          aggregated.set(`unknown:${r.id}`, {
            ...r,
            id: `file:${r.id}`,
            sourceId: source.id,
            targetId: null,
          });
        } else if (source.id !== target.id) {
          const key = JSON.stringify([source.id, target.id]);
          const previous = aggregated.get(key);
          if (!previous || r.type === "imports")
            aggregated.set(key, {
              ...r,
              id: `file:${key}`,
              sourceId: source.id,
              targetId: target.id,
            });
        }
      }
      const result = getSubgraph(
        {
          ...snapshot,
          nodes: snapshot.nodes.filter((n) => n.kind === "file"),
          relations: [...aggregated.values()],
        },
        {
          nodeIds: [root.id],
          depth: 1,
          budget,
          relationTypes: ["calls", "imports"],
        },
      );
      return { ...result, unknownCount };
    },
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
