import { z } from "zod";
export { approvalReviewContextSchema } from "./approval-schema.js";
import {
  DomainError,
  type Approval,
  type CodeNode,
  type CodeSnapshot,
  type Relation,
} from "./model.js";
import { normalizeRepoPath } from "./validation.js";

const id = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const prose = z
  .string()
  .min(1)
  .max(20000)
  .refine((v) => v.trim().length > 0);
const author = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => v.trim() === v && v.length > 0);
const authorInput = z.string().trim().min(1).max(200);
const source = z.enum(["user", "agent"]);
const date = z.iso.datetime();
const relativePath = z
  .string()
  .min(1)
  .refine((v) => {
    try {
      return normalizeRepoPath(v) === v;
    } catch {
      return false;
    }
  });
const targetSchema = z.strictObject({ kind: z.enum(["node", "relation"]), id });
const selectionSchema = z.strictObject({
  snapshotId: id,
  target: targetSchema,
});
const bindingFields = {
  target: targetSchema,
  selectedSnapshotId: id,
  lastKnown: z.strictObject({
    label: z.string().min(1),
    filePath: relativePath,
    nodeKind: z.enum(["function", "file", "folder"]).optional(),
  }),
};
const bindingSchema = z.discriminatedUnion("state", [
  z.strictObject({ ...bindingFields, state: z.literal("bound") }),
  z.strictObject({
    ...bindingFields,
    state: z.literal("orphan"),
    orphanedAtSnapshotId: id,
  }),
]);
export const annotationSchema = z.strictObject({
  id,
  projectId: id,
  revision,
  text: prose,
  author,
  source,
  isConstraint: z.boolean(),
  binding: bindingSchema.nullable(),
  createdAt: date,
  updatedAt: date,
  deletedAt: date.optional(),
});
const contentFields = {
  text: prose,
  author: authorInput,
  isConstraint: z.boolean(),
};
export const createAnnotationSchema = z.strictObject({
  ...contentFields,
  source,
  binding: selectionSchema.nullable(),
});
export const updateAnnotationSchema = z.strictObject({
  ...contentFields,
  expectedRevision: revision,
});
export const bindAnnotationSchema = z.union([
  z.strictObject({ expectedRevision: revision, target: z.null() }),
  z.strictObject({
    expectedRevision: revision,
    target: targetSchema,
    snapshotId: id,
  }),
]);
export const annotationListSchema = z.strictObject({
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.literal("orphan").optional(),
});
export const annotationHistoryQuerySchema = annotationListSchema.omit({
  status: true,
});

export const approvedAnnotationContextSchema = z
  .strictObject({
    version: z.literal(1),
    projectId: id,
    snapshotId: id,
    annotations: z.array(annotationSchema),
  })
  .superRefine((context, ctx) => {
    const seen = new Set<string>();
    context.annotations.forEach((note, index) => {
      if (
        seen.has(note.id) ||
        note.projectId !== context.projectId ||
        note.deletedAt !== undefined
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid or duplicate annotation review record.",
          path: ["annotations", index],
        });
      seen.add(note.id);
    });
  });

export type Annotation = z.infer<typeof annotationSchema>;
export type AnnotationTarget = z.infer<typeof targetSchema>;
export type AnnotationSelection = z.infer<typeof selectionSchema>;
export type AnnotationBinding = z.infer<typeof bindingSchema>;
export type AnnotationContent = Pick<
  Annotation,
  "text" | "author" | "isConstraint"
>;
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
export type BindAnnotationInput = z.infer<typeof bindAnnotationSchema>;
export type AnnotationListInput = z.input<typeof annotationListSchema>;
export type AnnotationHistoryInput = z.input<
  typeof annotationHistoryQuerySchema
>;
export type ApprovedAnnotationContext = z.infer<
  typeof approvedAnnotationContextSchema
>;
export type AnnotationReviewApproval = Approval;
export type AnnotationRevision = {
  annotation: Annotation;
  action: "create" | "edit" | "bind" | "detach" | "orphan" | "delete";
  recordedAt: string;
};
export type AnnotationDetail = {
  annotation: Annotation;
  resolution: {
    status: "bound" | "orphan" | "unbound" | "unknown";
    snapshotId?: string;
    reason?: string;
    target?: CodeNode | Relation;
  };
};
export type AnnotationPage = {
  items: AnnotationDetail[];
  total: number;
  offset: number;
  limit: number;
  truncated: boolean;
  snapshotId?: string;
};
export type AnnotationHistoryPage = {
  items: AnnotationRevision[];
  total: number;
  offset: number;
  limit: number;
  truncated: boolean;
};
export type DeleteAnnotationResult = {
  id: string;
  revision: number;
  deletedAt: string;
};

const touches = (left: string, right: string) =>
  left === right ||
  left.startsWith(`${right}/`) ||
  right.startsWith(`${left}/`) ||
  right === ".";
function unavailable(snapshot: CodeSnapshot, path: string): boolean {
  const coverage = snapshot.coverage.availability;
  return (
    !coverage ||
    !coverage.complete ||
    [...coverage.unavailablePaths, ...(coverage.excludedPaths ?? [])].some(
      (other) => touches(path, other),
    ) ||
    snapshot.diagnostics.some((diagnostic) =>
      touches(path, diagnostic.filePath.replaceAll("\\", "/")),
    )
  );
}
function target(
  snapshot: CodeSnapshot,
  ref: AnnotationTarget,
): CodeNode | Relation | undefined {
  return ref.kind === "relation"
    ? snapshot.relations.find((r) => r.id === ref.id)
    : snapshot.nodes.find((n) => n.id === ref.id && n.kind !== "external");
}

/** A selection must name a real fact in the current explicitly supplied snapshot. */
export function selectAnnotationTarget(
  snapshot: CodeSnapshot,
  input: AnnotationSelection,
): AnnotationBinding {
  const selection = selectionSchema.parse(input);
  if (selection.snapshotId !== snapshot.id)
    throw new DomainError(
      "SNAPSHOT_CHANGED",
      "Annotation selection snapshot has changed.",
    );
  const fact = target(snapshot, selection.target);
  if (!fact)
    throw new DomainError(
      "INVALID_INPUT",
      "Annotation target is not an indexed fact.",
    );
  const node =
    selection.target.kind === "node" ? (fact as CodeNode) : undefined;
  const relation =
    selection.target.kind === "relation" ? (fact as Relation) : undefined;
  const filePath =
    node?.filePath ??
    (node?.kind === "file" || node?.kind === "folder"
      ? node.name
      : relation?.evidence.filePath);
  if (!filePath || unavailable(snapshot, filePath))
    throw new DomainError(
      "INVALID_INPUT",
      "Annotation target capture is unavailable.",
    );
  const result = {
    target: selection.target,
    selectedSnapshotId: snapshot.id,
    state: "bound" as const,
    lastKnown: {
      label:
        node?.qualifiedName ??
        node?.name ??
        `${relation!.type}: ${relation!.sourceId} → ${relation!.targetId ?? "unknown"}`,
      filePath,
      ...(node
        ? { nodeKind: node.kind as "function" | "file" | "folder" }
        : {}),
    },
  };
  return bindingSchema.parse(result);
}

export function resolveAnnotation(
  annotation: Annotation,
  snapshot?: CodeSnapshot,
): AnnotationDetail {
  const binding = annotation.binding;
  const detail = (
    resolution: AnnotationDetail["resolution"],
  ): AnnotationDetail => ({ annotation, resolution });
  if (!binding)
    return detail({
      status: "unbound",
      ...(snapshot?.projectId === annotation.projectId
        ? { snapshotId: snapshot.id }
        : {}),
    });
  if (binding.state === "orphan")
    return detail({
      status: "orphan",
      ...(snapshot?.projectId === annotation.projectId
        ? { snapshotId: snapshot.id }
        : {}),
    });
  if (!snapshot || snapshot.projectId !== annotation.projectId)
    return detail({
      status: "unknown",
      reason: "Indexed project snapshot is unavailable.",
    });
  if (unavailable(snapshot, binding.lastKnown.filePath))
    return detail({
      status: "unknown",
      snapshotId: snapshot.id,
      reason: "Capture cannot establish this target's presence or absence.",
    });
  const fact = target(snapshot, binding.target);
  return fact
    ? detail({ status: "bound", snapshotId: snapshot.id, target: fact })
    : detail({ status: "orphan", snapshotId: snapshot.id });
}

/** Return only transitions justified by complete facts; callers own revisions/transactions. */
export function reconcileAnnotationBindings(
  annotations: Annotation[],
  snapshot: CodeSnapshot,
): Annotation[] {
  return annotations.flatMap((annotation) =>
    annotation.projectId === snapshot.projectId &&
    !annotation.deletedAt &&
    annotation.binding?.state === "bound" &&
    resolveAnnotation(annotation, snapshot).resolution.status === "orphan"
      ? [
          {
            ...annotation,
            binding: {
              ...annotation.binding,
              state: "orphan" as const,
              orphanedAtSnapshotId: snapshot.id,
            },
          },
        ]
      : [],
  );
}

export function canonicalAnnotationContext(
  input: ApprovedAnnotationContext,
): string {
  const context = approvedAnnotationContextSchema.parse(input);
  return JSON.stringify([
    1,
    context.projectId,
    context.snapshotId,
    [...context.annotations]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((n) => [
        n.id,
        n.projectId,
        n.text,
        n.author,
        n.source,
        n.isConstraint,
        n.binding === null
          ? null
          : [
              n.binding.target.kind,
              n.binding.target.id,
              n.binding.selectedSnapshotId,
              n.binding.lastKnown.label,
              n.binding.lastKnown.filePath,
              n.binding.lastKnown.nodeKind ?? null,
              n.binding.state,
              n.binding.state === "orphan"
                ? n.binding.orphanedAtSnapshotId
                : null,
            ],
      ]),
  ]);
}
