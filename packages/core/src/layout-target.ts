import { DomainError } from "./model.js";
import type { CodeNode, CodeSnapshot, Relation } from "./model.js";

export const LAYOUT_LIMITS = Object.freeze({
  nodes: 5000,
  relations: 20000,
  bytes: 8388608,
});
export const LAYOUT_KINDS = ["function", "file", "folder", "external"] as const;
export type LayoutFact = Pick<CodeNode, "id" | "kind" | "parentId">;
export type LayoutRelation = Pick<
  Relation,
  "id" | "sourceId" | "targetId" | "type" | "resolution"
>;
export type LayoutCounts = {
  nodes: number;
  relations: number;
  byKind: Record<CodeNode["kind"], number>;
};
type Common = {
  projectId: string;
  snapshotId: string;
  contentHash: string;
  scope: "project_indexed_facts";
  counts: LayoutCounts;
  limits: typeof LAYOUT_LIMITS;
};
export type LayoutTargetResult = Common &
  (
    | {
        status: "ready";
        complete: true;
        nodes: LayoutFact[];
        relations: LayoutRelation[];
      }
    | {
        status: "rejected";
        reason: "node_budget" | "relation_budget" | "byte_budget";
        actualBytes?: number;
      }
  );

/** Count JSON UTF8 bytes without first allocating an unbounded JSON/byte buffer.
 * Undefined means over cap, not an exact total. Inputs here are the bounded,
 * strictly validated minimal DTO (no arbitrary objects/getters/source text). */
export function boundedLayoutJsonBytes(
  value: unknown,
  cap: number = LAYOUT_LIMITS.bytes,
): number | undefined {
  let bytes = 0;
  function add(n: number) {
    bytes += n;
    return bytes <= cap;
  }
  function string(s: string): boolean {
    if (!add(2)) return false;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (
        c === 34 ||
        c === 92 ||
        c === 8 ||
        c === 9 ||
        c === 10 ||
        c === 12 ||
        c === 13
      ) {
        if (!add(2)) return false;
      } else if (c < 32) {
        if (!add(6)) return false;
      } else if (c < 128) {
        if (!add(1)) return false;
      } else if (c < 2048) {
        if (!add(2)) return false;
      } else if (
        c >= 0xd800 &&
        c <= 0xdbff &&
        i + 1 < s.length &&
        s.charCodeAt(i + 1) >= 0xdc00 &&
        s.charCodeAt(i + 1) <= 0xdfff
      ) {
        i++;
        if (!add(4)) return false;
      } else if (c >= 0xd800 && c <= 0xdfff) {
        if (!add(6)) return false;
      } else if (!add(3)) return false;
    }
    return true;
  }
  function walk(v: unknown): boolean {
    if (typeof v === "string") return string(v);
    if (v === null) return add(4);
    if (typeof v === "number" || typeof v === "boolean")
      return add(JSON.stringify(v).length);
    if (Array.isArray(v)) {
      if (!add(2)) return false;
      for (let i = 0; i < v.length; i++)
        if ((i > 0 && !add(1)) || !walk(v[i])) return false;
      return true;
    }
    if (typeof v === "object" && v !== null) {
      if (!add(2)) return false;
      let first = true;
      for (const [k, entry] of Object.entries(v)) {
        if (entry === undefined) continue;
        if ((!first && !add(1)) || !string(k) || !add(1) || !walk(entry))
          return false;
        first = false;
      }
      return true;
    }
    return false;
  }
  return walk(value) ? bytes : undefined;
}

export function getLayoutTarget(
  snapshot: CodeSnapshot,
  expectedSnapshotId: string,
): LayoutTargetResult {
  if (snapshot.id !== expectedSnapshotId)
    throw new DomainError(
      "SNAPSHOT_CHANGED",
      "SNAPSHOT_CHANGED: layout target snapshot changed",
    );
  if (
    typeof snapshot.id !== "string" ||
    !snapshot.id ||
    typeof snapshot.projectId !== "string" ||
    !snapshot.projectId ||
    typeof snapshot.contentHash !== "string" ||
    !snapshot.contentHash
  )
    throw new DomainError("INVALID_INPUT", "Invalid snapshot identity");
  const counts: LayoutCounts = {
    nodes: snapshot.nodes.length,
    relations: snapshot.relations.length,
    byKind: { function: 0, file: 0, folder: 0, external: 0 },
  };
  // The snapshot is already captured. This allocation-free scan preserves real
  // byKind counts even for a length-rejected snapshot; no DTO/edge copies yet.
  for (const node of snapshot.nodes) {
    if (!LAYOUT_KINDS.includes(node.kind))
      throw new DomainError("INVALID_INPUT", "Invalid node kind");
    counts.byKind[node.kind]++;
  }
  const common: Common = {
    projectId: snapshot.projectId,
    snapshotId: snapshot.id,
    contentHash: snapshot.contentHash,
    scope: "project_indexed_facts",
    counts,
    limits: LAYOUT_LIMITS,
  };
  if (counts.nodes > LAYOUT_LIMITS.nodes)
    return { ...common, status: "rejected", reason: "node_budget" };
  if (counts.relations > LAYOUT_LIMITS.relations)
    return { ...common, status: "rejected", reason: "relation_budget" };
  const ids = new Set<string>();
  for (const node of snapshot.nodes) {
    if (typeof node.id !== "string" || !node.id || ids.has(node.id))
      throw new DomainError("INVALID_INPUT", "Duplicate or invalid node ID");
    ids.add(node.id);
  }
  for (const node of snapshot.nodes)
    if (
      node.parentId !== undefined &&
      (!ids.has(node.parentId) || !node.parentId)
    )
      throw new DomainError("INVALID_INPUT", "Unknown parent ID");
  const relationIds = new Set<string>();
  for (const r of snapshot.relations) {
    if (
      !r.id ||
      typeof r.id !== "string" ||
      relationIds.has(r.id) ||
      !ids.has(r.sourceId) ||
      (r.targetId !== null && !ids.has(r.targetId)) ||
      !["calls", "imports", "contains"].includes(r.type) ||
      !["resolved", "unresolved", "external"].includes(r.resolution)
    )
      throw new DomainError(
        "INVALID_INPUT",
        "Invalid relation identity or endpoint",
      );
    relationIds.add(r.id);
  }
  const result: Extract<LayoutTargetResult, { status: "ready" }> = {
    ...common,
    status: "ready",
    complete: true,
    nodes: snapshot.nodes.map((n) =>
      n.parentId === undefined
        ? { id: n.id, kind: n.kind }
        : { id: n.id, kind: n.kind, parentId: n.parentId },
    ),
    relations: snapshot.relations.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      targetId: r.targetId,
      type: r.type,
      resolution: r.resolution,
    })),
  };
  if (boundedLayoutJsonBytes(result) === undefined)
    return { ...common, status: "rejected", reason: "byte_budget" };
  return result;
}
