import { z } from "zod";
import { DomainError } from "./model.js";
import type {
  BrowseRoute,
  CodeNode,
  CodeSnapshot,
  DirectoryPolicy,
  Operation,
  Plan,
  ValidationIssue,
} from "./model.js";

/** Stable identity from semantic parts only; callers must never supply source line numbers. */
export function makeId(kind: string, ...parts: string[]): string {
  const input = JSON.stringify([kind, ...parts]);
  let hash = 0x6c62272e07bb014262b821756295c58dn;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = BigInt.asUintN(128, hash * 0x1000000000000000000013bn);
  }
  return `${kind}:${hash.toString(16).padStart(32, "0")}`;
}

export function normalizeRepoPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (
    !normalized.trim() ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.startsWith("/") ||
    normalized.endsWith("/") ||
    /(?:^|\/)(?:\.|\.\.)$/.test(normalized) ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new DomainError(
      "INVALID_PATH",
      "Expected a nonempty repository-relative file path.",
    );
  }
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length)
        throw new DomainError("INVALID_PATH", "Path escapes the repository.");
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length)
    throw new DomainError(
      "INVALID_PATH",
      "Expected a file path, not the repository root.",
    );
  const filePath = parts.join("/");
  if (/^[A-Za-z]:/.test(filePath))
    throw new DomainError(
      "INVALID_PATH",
      "Expected a repository-relative file path, not a Windows drive path.",
    );
  return filePath;
}

const id = z.string().min(1);
const path = z.string().refine((value) => {
  try {
    normalizeRepoPath(value);
    return true;
  } catch {
    return false;
  }
}, "Expected a repository-relative file path");
const language = z.enum(["typescript", "javascript", "python", "unknown"]);
const timestamp = z.iso.datetime({ offset: true });
const line = z.number().int().positive();
const revision = z.number().int().positive();
const codeNodeSchema = z.strictObject({
  id,
  kind: z.enum(["function", "file", "folder", "external"]),
  name: z.string().min(1),
  qualifiedName: z.string().optional(),
  filePath: path.optional(),
  parentId: id.optional(),
  language: language.optional(),
  signature: z.string().optional(),
  startLine: line.optional(),
  endLine: line.optional(),
  exported: z.boolean().optional(),
});
const relationSchema = z.strictObject({
  id,
  type: z.enum(["calls", "imports", "contains"]),
  sourceId: id,
  targetId: id.nullable(),
  resolution: z.enum(["resolved", "unresolved", "external"]),
  evidence: z.strictObject({
    filePath: path,
    line,
    text: z.string().optional(),
  }),
  reason: z.string().optional(),
});
export const operationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("add_function"),
    tempId: id,
    name: z.string().min(1),
    filePath: path,
    signature: z.string().optional(),
    description: z.string().optional(),
    language: language.optional(),
  }),
  z.strictObject({ kind: z.literal("remove_function"), nodeId: id }),
  z.strictObject({
    kind: z.literal("add_relation"),
    id,
    sourceId: id,
    targetId: id,
    type: z.enum(["calls", "must_call", "must_reuse"]),
  }),
  z.strictObject({ kind: z.literal("remove_relation"), relationId: id }),
  z.strictObject({
    kind: z.literal("move_function"),
    nodeId: id,
    filePath: path,
  }),
  z.strictObject({
    kind: z.literal("annotate"),
    targetId: id,
    text: z.string(),
  }),
]) satisfies z.ZodType<Operation>;
export const snapshotSchema = z.strictObject({
  id,
  projectId: id,
  createdAt: timestamp,
  gitRevision: z.string().nullable(),
  contentHash: id,
  nodes: z.array(codeNodeSchema),
  relations: z.array(relationSchema),
  diagnostics: z.array(
    z.strictObject({
      filePath: path,
      line: line.optional(),
      message: z.string(),
    }),
  ),
  coverage: z.strictObject({
    files: z.array(path),
    excludedPatterns: z.array(z.string()),
    unresolvedCount: z.number().int().nonnegative(),
  }),
}) satisfies z.ZodType<CodeSnapshot>;
export const planSchema = z.strictObject({
  id,
  projectId: id,
  title: z.string().min(1),
  description: z.string(),
  baselineSnapshotId: id,
  baselineContentHash: id,
  revision,
  operations: z.array(operationSchema),
  status: z.enum(["draft", "approved", "stale"]),
  createdAt: timestamp,
  updatedAt: timestamp,
}) satisfies z.ZodType<Plan>;
export const routeSchema = z.strictObject({
  id,
  projectId: id,
  snapshotId: id,
  revision,
  title: z.string().min(1),
  description: z.string(),
  source: z.enum(["agent", "user"]),
  kind: z.enum(["walkthrough", "call_chain"]),
  steps: z
    .array(
      z.strictObject({
        nodeId: id,
        note: z.string(),
        relationId: id.optional(),
      }),
    )
    .min(1),
  createdAt: timestamp,
}) satisfies z.ZodType<BrowseRoute>;

function schemaIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    severity: "error",
    code: "INVALID_INPUT",
    message: `${issue.path.join(".")}: ${issue.message}`,
    ...(issue.path[0] === "operations" && typeof issue.path[1] === "number"
      ? { operationIndex: issue.path[1] }
      : {}),
  }));
}
function within(value: string, prefix: string): boolean {
  return !prefix || value === prefix || value.startsWith(`${prefix}/`);
}

export function validatePlan(
  plan: Plan,
  snapshot: CodeSnapshot,
  policies: DirectoryPolicy[] = [],
): ValidationIssue[] {
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return schemaIssues(parsed.error);
  const issues: ValidationIssue[] = [];
  const error = (code: string, message: string, operationIndex?: number) =>
    issues.push({
      severity: "error",
      code,
      message,
      ...(operationIndex === undefined ? {} : { operationIndex }),
    });
  if (plan.projectId !== snapshot.projectId)
    error(
      "PROJECT_MISMATCH",
      "Plan and snapshot belong to different projects.",
    );
  if (
    plan.baselineSnapshotId !== snapshot.id ||
    plan.baselineContentHash !== snapshot.contentHash
  )
    error(
      "BASELINE_MISMATCH",
      "Plan baseline differs from the supplied snapshot.",
    );
  const nodes = new Map<string, CodeNode>(
    snapshot.nodes.map((node) => [node.id, { ...node }]),
  );
  const relationIds = new Set(
    snapshot.relations.map((relation) => relation.id),
  );
  const removed = new Set<string>();
  const removedRelations = new Set<string>();
  // Collect additions first, so relation endpoints do not depend on editor operation order.
  plan.operations.forEach((operation, index) => {
    if (operation.kind !== "add_function") return;
    if (nodes.has(operation.tempId))
      error(
        "DUPLICATE_NODE",
        `Node ${operation.tempId} already exists.`,
        index,
      );
    else
      nodes.set(operation.tempId, {
        id: operation.tempId,
        kind: "function",
        name: operation.name,
        filePath: normalizeRepoPath(operation.filePath),
        ...(operation.language ? { language: operation.language } : {}),
      });
  });
  plan.operations.forEach((operation, index) => {
    if (
      operation.kind === "remove_function" ||
      operation.kind === "move_function"
    ) {
      const node = nodes.get(operation.nodeId);
      if (node?.kind !== "function")
        error(
          "INVALID_FUNCTION",
          `Function ${operation.nodeId} does not exist.`,
          index,
        );
      else if (operation.kind === "remove_function") {
        if (removed.has(node.id))
          error(
            "DUPLICATE_REMOVAL",
            `Function ${node.id} is removed more than once.`,
            index,
          );
        removed.add(node.id);
      } else node.filePath = normalizeRepoPath(operation.filePath);
    }
    if (operation.kind === "remove_relation") {
      if (!relationIds.has(operation.relationId))
        error(
          "INVALID_RELATION",
          `Relation ${operation.relationId} does not exist.`,
          index,
        );
      if (removedRelations.has(operation.relationId))
        error(
          "DUPLICATE_REMOVAL",
          `Relation ${operation.relationId} is removed more than once.`,
          index,
        );
      removedRelations.add(operation.relationId);
    }
  });
  for (const nodeId of removed) nodes.delete(nodeId);
  const normalizedPolicies: {
    policy: DirectoryPolicy;
    prefix: string;
    forbidden: string[];
  }[] = [];
  for (const policy of policies) {
    if (policy.projectId !== plan.projectId) continue;
    try {
      const raw = policy.pathPrefix.replaceAll("\\", "/").replace(/\/+$/, "");
      normalizedPolicies.push({
        policy,
        prefix: raw === "" || raw === "." ? "" : normalizeRepoPath(raw),
        forbidden: policy.forbiddenDependencies.map((dependency) =>
          normalizeRepoPath(dependency.replace(/[/\\]+$/, "")),
        ),
      });
    } catch {
      error(
        "INVALID_POLICY_PATH",
        `Directory policy ${policy.id} contains an invalid path.`,
      );
    }
  }
  for (const relation of snapshot.relations) {
    if (
      removedRelations.has(relation.id) ||
      !["calls", "imports"].includes(relation.type)
    )
      continue;
    const source = nodes.get(relation.sourceId);
    const target = relation.targetId ? nodes.get(relation.targetId) : undefined;
    if (!source?.filePath || !target) continue;
    for (const { policy, prefix, forbidden } of normalizedPolicies) {
      if (
        within(normalizeRepoPath(source.filePath), prefix) &&
        forbidden.some((dependency) =>
          within(
            target.filePath ? normalizeRepoPath(target.filePath) : target.name,
            dependency,
          ),
        )
      )
        error(
          "FORBIDDEN_DEPENDENCY",
          `Existing relation ${relation.id} violates directory policy ${policy.id}.`,
        );
    }
  }
  plan.operations.forEach((operation, index) => {
    if (operation.kind === "move_function" && removed.has(operation.nodeId))
      error(
        "REMOVED_FUNCTION",
        `Cannot move removed function ${operation.nodeId}.`,
        index,
      );
    if (
      operation.kind === "annotate" &&
      !nodes.has(operation.targetId) &&
      !(
        relationIds.has(operation.targetId) &&
        !removedRelations.has(operation.targetId)
      )
    )
      error(
        "INVALID_TARGET",
        `Annotation target ${operation.targetId} does not exist.`,
        index,
      );
    if (operation.kind !== "add_relation") return;
    if (relationIds.has(operation.id))
      error(
        "DUPLICATE_RELATION",
        `Relation ${operation.id} already exists.`,
        index,
      );
    relationIds.add(operation.id);
    const source = nodes.get(operation.sourceId);
    const target = nodes.get(operation.targetId);
    if (
      source?.kind !== "function" ||
      !target ||
      !["function", "external"].includes(target.kind)
    ) {
      error(
        "INVALID_ENDPOINT",
        "Planned calls require an existing function source and function or external target.",
        index,
      );
      return;
    }
    for (const { policy, prefix, forbidden } of normalizedPolicies) {
      if (
        source.filePath &&
        within(normalizeRepoPath(source.filePath), prefix) &&
        forbidden.some((dependency) =>
          within(
            target.filePath ? normalizeRepoPath(target.filePath) : target.name,
            dependency,
          ),
        )
      )
        error(
          "FORBIDDEN_DEPENDENCY",
          `Relation violates directory policy ${policy.id}.`,
          index,
        );
    }
  });
  return issues;
}

export function validateRoute(
  route: BrowseRoute,
  snapshot: CodeSnapshot,
): ValidationIssue[] {
  const parsed = routeSchema.safeParse(route);
  if (!parsed.success) return schemaIssues(parsed.error);
  const issues: ValidationIssue[] = [];
  const error = (code: string, message: string) =>
    issues.push({ severity: "error", code, message });
  if (route.projectId !== snapshot.projectId)
    error("PROJECT_MISMATCH", "Route belongs to another project.");
  if (route.snapshotId !== snapshot.id)
    error("SNAPSHOT_MISMATCH", "Route references another snapshot.");
  const nodes = new Set(snapshot.nodes.map((node) => node.id));
  const relations = new Map(
    snapshot.relations.map((relation) => [relation.id, relation]),
  );
  route.steps.forEach((step, index) => {
    if (!nodes.has(step.nodeId))
      error(
        "INVALID_ENDPOINT",
        `Route step ${index} references missing node ${step.nodeId}.`,
      );
    const relation = step.relationId
      ? relations.get(step.relationId)
      : undefined;
    if (
      step.relationId &&
      (!relation ||
        (relation.sourceId !== step.nodeId &&
          relation.targetId !== step.nodeId))
    )
      error(
        "INVALID_RELATION",
        `Route step ${index} has unrelated or missing evidence.`,
      );
    if (route.kind === "call_chain" && index > 0) {
      const previous = route.steps[index - 1]!;
      if (
        !relation ||
        relation.type !== "calls" ||
        relation.resolution !== "resolved" ||
        relation.sourceId !== previous.nodeId ||
        relation.targetId !== step.nodeId ||
        !relationSchema.safeParse(relation).success
      )
        error(
          "INVALID_CALL_CHAIN",
          `Route step ${index} requires a resolved evidenced call from the preceding step.`,
        );
    }
  });
  return issues;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
/** Revision tracks edits; it is not semantic content. Approval stores it separately. */
export function semanticPlanContent(plan: Plan): string {
  return JSON.stringify(
    canonical({
      id: plan.id,
      projectId: plan.projectId,
      title: plan.title,
      description: plan.description,
      baselineSnapshotId: plan.baselineSnapshotId,
      baselineContentHash: plan.baselineContentHash,
      operations: plan.operations.map((operation) =>
        operationSchema.parse(operation),
      ),
    }),
  );
}
