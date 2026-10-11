import {
  boundedLayoutJsonBytes,
  LAYOUT_KINDS,
  LAYOUT_LIMITS,
} from "@codemap/core";
import type { LayoutTargetResult } from "@codemap/core";
export type { LayoutTargetResult } from "@codemap/core";

function invalid(): never {
  throw new Error("Invalid or stale complete layout target");
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  const all = Object.keys(value);
  if (
    all.length < required.length ||
    all.length > required.length + optional.length ||
    required.some((k) => !Object.hasOwn(value, k)) ||
    all.some((k) => !required.includes(k) && !optional.includes(k))
  )
    invalid();
}
function id(value: unknown): string {
  if (typeof value !== "string" || !value) return invalid();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    return invalid();
  return value;
}

/** Strict response boundary; caller must separately bound transport before JSON.parse. */
export function validateLayoutTarget(
  value: unknown,
  expected: { projectId: string; snapshotId: string; contentHash: string },
): LayoutTargetResult {
  const v = object(value);
  const common = [
    "projectId",
    "snapshotId",
    "contentHash",
    "scope",
    "counts",
    "limits",
    "status",
  ];
  if (v.status === "ready")
    keys(v, [...common, "complete", "nodes", "relations"]);
  else if (v.status === "rejected")
    keys(v, [...common, "reason"], ["actualBytes"]);
  else invalid();
  for (const field of ["projectId", "snapshotId", "contentHash"] as const)
    if (id(v[field]) !== expected[field]) invalid();
  if (v.scope !== "project_indexed_facts") invalid();
  const limits = object(v.limits);
  keys(limits, ["nodes", "relations", "bytes"]);
  for (const k of ["nodes", "relations", "bytes"] as const)
    if (limits[k] !== LAYOUT_LIMITS[k]) invalid();
  const counts = object(v.counts);
  keys(counts, ["nodes", "relations", "byKind"]);
  const nc = count(counts.nodes),
    rc = count(counts.relations);
  const kinds = object(counts.byKind);
  keys(kinds, [...LAYOUT_KINDS]);
  let sum = 0;
  for (const kind of LAYOUT_KINDS) sum += count(kinds[kind]);
  if (!Number.isSafeInteger(sum) || sum !== nc) invalid();
  if (v.status === "rejected") {
    if (v.reason === "node_budget") {
      if (nc <= LAYOUT_LIMITS.nodes) invalid();
    } else if (v.reason === "relation_budget") {
      if (nc > LAYOUT_LIMITS.nodes || rc <= LAYOUT_LIMITS.relations) invalid();
    } else if (v.reason === "byte_budget") {
      if (nc > LAYOUT_LIMITS.nodes || rc > LAYOUT_LIMITS.relations) invalid();
    } else invalid();
    if (
      v.actualBytes !== undefined &&
      (v.reason !== "byte_budget" ||
        count(v.actualBytes) <= LAYOUT_LIMITS.bytes)
    )
      invalid();
  } else {
    if (
      v.complete !== true ||
      nc > LAYOUT_LIMITS.nodes ||
      rc > LAYOUT_LIMITS.relations ||
      !Array.isArray(v.nodes) ||
      !Array.isArray(v.relations) ||
      v.nodes.length !== nc ||
      v.relations.length !== rc
    )
      invalid();
    const ids = new Set<string>(),
      seenKinds = { function: 0, file: 0, folder: 0, external: 0 };
    for (const entry of v.nodes as unknown[]) {
      const n = object(entry);
      keys(n, ["id", "kind"], ["parentId"]);
      const nodeId = id(n.id);
      if (ids.has(nodeId)) invalid();
      ids.add(nodeId);
      if (!LAYOUT_KINDS.some((k) => k === n.kind)) invalid();
      seenKinds[n.kind as keyof typeof seenKinds]++;
      if (Object.hasOwn(n, "parentId")) id(n.parentId);
    }
    for (const kind of LAYOUT_KINDS)
      if (seenKinds[kind] !== kinds[kind]) invalid();
    for (const entry of v.nodes as unknown[]) {
      const n = object(entry);
      if (n.parentId !== undefined && !ids.has(id(n.parentId))) invalid();
    }
    const relationIds = new Set<string>();
    for (const entry of v.relations as unknown[]) {
      const r = object(entry);
      keys(r, ["id", "sourceId", "targetId", "type", "resolution"]);
      const relationId = id(r.id);
      if (relationIds.has(relationId)) invalid();
      relationIds.add(relationId);
      if (
        !ids.has(id(r.sourceId)) ||
        (r.targetId !== null && !ids.has(id(r.targetId))) ||
        typeof r.type !== "string" ||
        !["calls", "imports", "contains"].includes(r.type) ||
        typeof r.resolution !== "string" ||
        !["resolved", "unresolved", "external"].includes(r.resolution)
      )
        invalid();
    }
  }
  if (boundedLayoutJsonBytes(value) === undefined) invalid();
  // All required and optional fields, enums, arrays, identities and counts have
  // been checked above. No unchecked array slice or partial response is returned.
  return value as LayoutTargetResult;
}
