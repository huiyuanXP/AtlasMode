import ts from "typescript";
import { configurationReferences } from "./projectReferences.js";
import type {
  ConfigurationProjectGraph,
  SourceConfigurationScope,
} from "./projectReferenceTypes.js";

type Reference = {
  source: string;
  raw: string;
  target?: string;
  status: ConfigurationProjectGraph["references"][number]["status"];
  reason?: string;
};
type Project = { path: string; ownValid: boolean; references: Reference[] };
export function createCapturedReferenceGraph(
  inputs: ReadonlyMap<string, string>,
  roots: readonly string[],
  ownValid: (path: string, referenced: boolean) => boolean,
) {
  const nodes = new Map<string, Project>();
  const edges: Reference[] = [];
  const diagnostics: { filePath: string; message: string }[] = [];
  let hasReferences = false;
  function visit(
    path: string,
    depth: number,
    stack: Set<string>,
    referenced: boolean,
  ) {
    const existing = nodes.get(path);
    if (existing) {
      if (referenced && !ownValid(path, true)) existing.ownValid = false;
      return;
    }
    if (nodes.size >= 512) {
      diagnostics.push({
        filePath: path,
        message:
          "Configuration project references exceed the 512 project budget",
      });
      return;
    }
    const node: Project = {
      path,
      ownValid: ownValid(path, referenced),
      references: [],
    };
    nodes.set(path, node);
    const text = inputs.get(path);
    if (text === undefined) {
      node.ownValid = false;
      return;
    }
    const parsed = ts.parseConfigFileTextToJson(path, text);
    if (
      parsed.error ||
      !parsed.config ||
      typeof parsed.config !== "object" ||
      Array.isArray(parsed.config)
    ) {
      node.ownValid = false;
      return;
    }
    if (parsed.config.references !== undefined) hasReferences = true;
    const references = configurationReferences(
      path,
      parsed.config.references,
      Math.max(0, 2048 - edges.length),
    );
    if (references.reason || references.truncated) {
      node.ownValid = false;
      diagnostics.push({
        filePath: path,
        message: `Configuration project references rejected: ${references.reason ?? "2048 entry budget exceeded"}`,
      });
    }
    const next = new Set(stack).add(path);
    for (const entry of references.entries) {
      // Child recursion consumes the same global budget before this parent resumes.
      if (edges.length >= 2048) {
        node.ownValid = false;
        diagnostics.push({
          filePath: path,
          message:
            "Configuration project references exceed the 2048 entry budget",
        });
        break;
      }
      const edge: Reference = {
        source: path,
        raw: entry.raw,
        target: entry.target,
        status: "resolved",
      };
      node.references.push(edge);
      edges.push(edge);
      if (entry.reason) {
        edge.status = "invalid";
        edge.reason = entry.reason;
      } else if (next.has(entry.target!)) {
        edge.status = "cycle";
        edge.reason = "Configuration references cycle";
      } else if (!nodes.has(entry.target!) && nodes.size >= 512) {
        edge.status = "budget";
        edge.reason = "Configuration references depth/file budget exceeded";
      } else if (!inputs.has(entry.target!)) {
        edge.status = "unavailable";
        edge.reason =
          "Reference configuration unavailable in captured inputs (missing, excluded, ignored, symlinked or unreadable)";
      } else {
        visit(entry.target!, depth + 1, next, true);
        if (!nodes.get(entry.target!)?.ownValid) {
          edge.status = "invalid";
          edge.reason =
            "Referenced configuration own options/membership/composite are invalid";
        }
      }
    }
  }
  for (const root of [...roots].sort()) visit(root, 1, new Set(), false);

  // Closure validation starts independently at each configuration. A shallow
  // valid owner must not inherit another root's longer path or traversal order.
  const valid = new Map<string, boolean>();
  function closure(
    path: string,
    depth: number,
    stack: Set<string>,
    memo: Map<string, boolean>,
  ): boolean {
    if (depth > 16 || stack.has(path)) return false;
    const key = JSON.stringify([path, depth]);
    if (memo.has(key)) return memo.get(key)!;
    const node = nodes.get(path);
    const next = new Set(stack).add(path);
    const accepted =
      !!node?.ownValid &&
      node.references.every(
        (edge) =>
          edge.status === "resolved" &&
          !!edge.target &&
          closure(edge.target, depth + 1, next, memo),
      );
    memo.set(key, accepted);
    return accepted;
  }
  for (const path of nodes.keys()) {
    const accepted = closure(path, 1, new Set(), new Map());
    valid.set(path, accepted);
    if (!accepted && nodes.get(path)!.ownValid)
      diagnostics.push({
        filePath: path,
        message:
          "Configuration project references closure invalid (cycle, dependency or 16 level depth budget)",
      });
  }
  for (const edge of edges) {
    if (edge.status === "resolved" && !valid.get(edge.target!)) {
      edge.status = "invalid";
      edge.reason = "Referenced configuration closure is invalid";
    }
    if (edge.status !== "resolved")
      diagnostics.push({
        filePath: edge.source,
        message: `Configuration project references rejected: ${edge.reason}`,
      });
  }
  function reachable(root: string): string[] {
    const seen = new Map<string, number>();
    function walk(path: string, depth: number) {
      if (
        depth > 16 ||
        (seen.get(path) ?? Infinity) <= depth ||
        !nodes.has(path)
      )
        return;
      seen.set(path, depth);
      for (const edge of nodes.get(path)!.references)
        if (edge.target && edge.status !== "budget" && edge.status !== "cycle")
          walk(edge.target, depth + 1);
    }
    walk(root, 1);
    return [...seen.keys()].sort();
  }
  function view(
    scopes: readonly SourceConfigurationScope[],
  ): ConfigurationProjectGraph {
    const projects = [...nodes.keys()].sort().map((configPath) => ({
      configPath,
      status: valid.get(configPath)
        ? ("resolved" as const)
        : ("invalid" as const),
    }));
    const references = [...edges]
      .sort(
        (a, b) =>
          a.source.localeCompare(b.source) || a.raw.localeCompare(b.raw),
      )
      .map((edge) => ({
        sourceConfigPath: edge.source,
        referencePathPreview: edge.raw.slice(0, 256),
        ...(edge.target ? { targetConfigPath: edge.target } : {}),
        status: edge.status,
        ...(edge.reason ? { reason: edge.reason.slice(0, 512) } : {}),
        referencePathTruncated: edge.raw.length > 256,
        reasonTruncated: (edge.reason?.length ?? 0) > 512,
      }));
    const sortedScopes = [...scopes].sort((a, b) =>
      a.sourcePath.localeCompare(b.sourcePath),
    );
    const counts = {
      observedRoots: roots.length,
      observedProjects: nodes.size,
      observedReferences: edges.length,
      sourceScopes: scopes.length,
      resolved: 0,
      unconfigured: 0,
      ambiguous: 0,
      invalid: 0,
    };
    for (const scope of scopes) counts[scope.status]++;
    const publicRoots = [...roots]
      .sort()
      .filter((path) => path.length <= 2048)
      .slice(0, 50);
    const publicProjects = projects
      .filter((p) => p.configPath.length <= 2048)
      .slice(0, 50);
    const publicReferences = references
      .filter(
        (e) =>
          e.sourceConfigPath.length <= 2048 &&
          (!e.targetConfigPath || e.targetConfigPath.length <= 2048),
      )
      .slice(0, 100);
    const publicScopes = sortedScopes
      .filter(
        (s) =>
          s.sourcePath.length <= 2048 &&
          (!s.configPath || s.configPath.length <= 2048),
      )
      .slice(0, 50);
    return {
      version: 1,
      status:
        projects.some((p) => p.status === "invalid") || diagnostics.length
          ? "partial"
          : "complete",
      counts,
      roots: publicRoots,
      projects: publicProjects,
      references: publicReferences,
      scopes: publicScopes,
      truncated: {
        roots: roots.length > publicRoots.length,
        projects: nodes.size > publicProjects.length,
        references: edges.length > publicReferences.length,
        scopes: scopes.length > publicScopes.length,
      },
    };
  }
  return {
    hasReferences: () => hasReferences,
    valid: (path: string) => !!valid.get(path),
    reachable,
    diagnostics,
    view,
  };
}
