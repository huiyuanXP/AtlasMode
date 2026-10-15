import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DomainError,
  annotationSchema,
  annotationListSchema,
  annotationHistoryQuerySchema,
  createAnnotationSchema,
  updateAnnotationSchema,
  bindAnnotationSchema,
  approvedAnnotationContextSchema,
  resolveAnnotation,
  selectAnnotationTarget,
  reconcileAnnotationBindings,
  type Annotation,
  type AnnotationDetail,
  type AnnotationRevision,
  type AnnotationPage,
  type AnnotationHistoryPage,
  type AnnotationListInput,
  type AnnotationHistoryInput,
  type CreateAnnotationInput,
  type UpdateAnnotationInput,
  type BindAnnotationInput,
  type DeleteAnnotationResult,
  type ApprovedAnnotationContext,
  type CodeSnapshot,
  type Project,
  type StoragePort,
} from "@codemap/core";
import { invalidateProjectPlans } from "./knowledge-revisions.js";

const idSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const revisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const legacyRegistrySchema = z
  .strictObject({ version: z.literal(1), approvalIds: z.array(idSchema) })
  .refine((v) => new Set(v.approvalIds).size === v.approvalIds.length);
const revisionHistorySchema = z.strictObject({
  annotation: annotationSchema,
  action: z.enum(["create", "edit", "bind", "detach", "orphan", "delete"]),
  recordedAt: z.iso.datetime(),
});
const historyKey = (id: string, revision: number) =>
  `annotation-revision:${id}:${revision}`;
function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new DomainError(
      "INVALID_INPUT",
      "Invalid annotation input or stored record.",
    );
  return result.data;
}

export class Annotations {
  constructor(
    private readonly storage: StoragePort,
    private readonly project: (id: string) => Project,
    private readonly snapshot: (id: string) => CodeSnapshot,
  ) {}

  private checkProject(projectId: string): void {
    parse(idSchema, projectId);
    if (this.project(projectId).id !== projectId)
      throw new DomainError("NOT_FOUND", "Project not found.");
  }
  private current(projectId: string): CodeSnapshot | undefined {
    try {
      const snapshot = this.snapshot(projectId);
      if (snapshot.projectId !== projectId)
        throw new DomainError(
          "INVALID_SNAPSHOT",
          "Project snapshot ownership mismatch.",
        );
      return snapshot;
    } catch (error) {
      if (error instanceof DomainError && error.code === "NOT_FOUND")
        return undefined;
      throw error;
    }
  }
  private raw(projectId: string, id: string, deleted = false): Annotation {
    parse(idSchema, id);
    const record = this.storage.get<Annotation>("annotations", id);
    if (
      !record ||
      record.projectId !== projectId ||
      (!deleted && record.deletedAt)
    )
      throw new DomainError(
        "NOT_FOUND",
        "Annotation not found in this project.",
      );
    return parse(annotationSchema, record);
  }
  private all(projectId: string): Annotation[] {
    return this.storage
      .list<Annotation>("annotations")
      .filter((record) => record.projectId === projectId)
      .map((record) => parse(annotationSchema, record));
  }
  private checkRevision(current: Annotation, expectedRevision: number): void {
    parse(revisionSchema, expectedRevision);
    if (current.revision !== expectedRevision)
      throw new DomainError(
        "REVISION_CONFLICT",
        "Annotation revision has changed.",
      );
  }
  private next(current: Annotation, now: string): Annotation {
    if (current.revision === Number.MAX_SAFE_INTEGER)
      throw new DomainError(
        "REVISION_CONFLICT",
        "Annotation revision cannot be advanced safely.",
      );
    return { ...current, revision: current.revision + 1, updatedAt: now };
  }
  private write(
    annotation: Annotation,
    action: AnnotationRevision["action"],
    now: string,
  ): void {
    const record = parse(annotationSchema, annotation),
      key = historyKey(record.id, record.revision);
    if (this.storage.get("settings", key) !== undefined)
      throw new DomainError(
        "REVISION_CONFLICT",
        "Annotation history revision already exists.",
      );
    this.storage.put("annotations", record.id, record);
    this.storage.put("settings", key, {
      annotation: record,
      action,
      recordedAt: now,
    } satisfies AnnotationRevision);
  }

  list(projectId: string, input: AnnotationListInput = {}): AnnotationPage {
    this.checkProject(projectId);
    const page = parse(annotationListSchema, input),
      snapshot = this.current(projectId);
    const details = this.all(projectId)
      .filter((record) => !record.deletedAt)
      .sort((a, b) =>
        a.createdAt < b.createdAt
          ? -1
          : a.createdAt > b.createdAt
            ? 1
            : a.id < b.id
              ? -1
              : a.id > b.id
                ? 1
                : 0,
      )
      .map((record) => resolveAnnotation(record, snapshot))
      .filter(
        (detail) => !page.status || detail.resolution.status === page.status,
      );
    return {
      items: details.slice(page.offset, page.offset + page.limit),
      total: details.length,
      offset: page.offset,
      limit: page.limit,
      truncated: page.offset > 0 || page.offset + page.limit < details.length,
      ...(snapshot ? { snapshotId: snapshot.id } : {}),
    };
  }
  get(projectId: string, id: string): AnnotationDetail {
    this.checkProject(projectId);
    return resolveAnnotation(this.raw(projectId, id), this.current(projectId));
  }
  create(projectId: string, input: CreateAnnotationInput): AnnotationDetail {
    return this.storage.transaction(() => {
      this.checkProject(projectId);
      const content = parse(createAnnotationSchema, input),
        now = new Date().toISOString(),
        id = randomUUID();
      if (this.storage.get("annotations", id) !== undefined)
        throw new DomainError("REVISION_CONFLICT", "Annotation ID collision.");
      const snapshot = this.current(projectId);
      if (content.binding && !snapshot)
        throw new DomainError(
          "SNAPSHOT_CHANGED",
          "Annotation selection snapshot is unavailable.",
        );
      const record: Annotation = {
        id,
        projectId,
        revision: 1,
        text: content.text,
        author: content.author,
        source: content.source,
        isConstraint: content.isConstraint,
        binding: content.binding
          ? selectAnnotationTarget(snapshot!, content.binding)
          : null,
        createdAt: now,
        updatedAt: now,
      };
      this.write(record, "create", now);
      invalidateProjectPlans(this.storage, projectId, now);
      return this.get(projectId, id);
    });
  }
  update(
    projectId: string,
    id: string,
    input: UpdateAnnotationInput,
  ): AnnotationDetail {
    return this.storage.transaction(() => {
      this.checkProject(projectId);
      const content = parse(updateAnnotationSchema, input),
        current = this.raw(projectId, id);
      this.checkRevision(current, content.expectedRevision);
      if (
        current.text === content.text &&
        current.author === content.author &&
        current.isConstraint === content.isConstraint
      )
        return this.get(projectId, id);
      const now = new Date().toISOString();
      this.write(
        {
          ...this.next(current, now),
          text: content.text,
          author: content.author,
          isConstraint: content.isConstraint,
        },
        "edit",
        now,
      );
      invalidateProjectPlans(this.storage, projectId, now);
      return this.get(projectId, id);
    });
  }
  bind(
    projectId: string,
    id: string,
    input: BindAnnotationInput,
  ): AnnotationDetail {
    return this.storage.transaction(() => {
      this.checkProject(projectId);
      const selection = parse(bindAnnotationSchema, input),
        current = this.raw(projectId, id);
      this.checkRevision(current, selection.expectedRevision);
      const snapshot = selection.target ? this.current(projectId) : undefined;
      if (selection.target && !snapshot)
        throw new DomainError(
          "SNAPSHOT_CHANGED",
          "Annotation selection snapshot is unavailable.",
        );
      const binding = selection.target
        ? selectAnnotationTarget(snapshot!, {
            target: selection.target,
            snapshotId: selection.snapshotId,
          })
        : null;
      if (JSON.stringify(current.binding) === JSON.stringify(binding))
        return this.get(projectId, id);
      const now = new Date().toISOString();
      this.write(
        { ...this.next(current, now), binding },
        binding ? "bind" : "detach",
        now,
      );
      invalidateProjectPlans(this.storage, projectId, now);
      return this.get(projectId, id);
    });
  }
  delete(
    projectId: string,
    id: string,
    expectedRevision: number,
  ): DeleteAnnotationResult {
    return this.storage.transaction(() => {
      this.checkProject(projectId);
      const current = this.raw(projectId, id);
      this.checkRevision(current, expectedRevision);
      const now = new Date().toISOString(),
        record = { ...this.next(current, now), deletedAt: now };
      this.write(record, "delete", now);
      invalidateProjectPlans(this.storage, projectId, now);
      return { id, revision: record.revision, deletedAt: now };
    });
  }
  history(
    projectId: string,
    id: string,
    input: AnnotationHistoryInput = {},
  ): AnnotationHistoryPage {
    this.checkProject(projectId);
    this.raw(projectId, id, true);
    const page = parse(annotationHistoryQuerySchema, input);
    const history = this.storage
      .list<unknown>("settings")
      .filter(
        (value): value is AnnotationRevision =>
          !!value &&
          typeof value === "object" &&
          "annotation" in value &&
          !!value.annotation &&
          typeof value.annotation === "object" &&
          "id" in value.annotation &&
          value.annotation.id === id,
      )
      .map((value) => parse(revisionHistorySchema, value))
      .filter((value) => value.annotation.projectId === projectId)
      .sort((a, b) => b.annotation.revision - a.annotation.revision);
    return {
      items: history.slice(page.offset, page.offset + page.limit),
      total: history.length,
      offset: page.offset,
      limit: page.limit,
      truncated: page.offset > 0 || page.offset + page.limit < history.length,
    };
  }
  /** Caller may wrap this in its snapshot transaction; this component invalidates plans once. */
  reconcile(projectId: string, snapshot: CodeSnapshot, now: string): boolean {
    return this.storage.transaction(() => {
      this.checkProject(projectId);
      if (snapshot.projectId !== projectId)
        throw new DomainError(
          "PROJECT_MISMATCH",
          "Annotation refresh belongs to another project.",
        );
      const changed = reconcileAnnotationBindings(
        this.all(projectId),
        snapshot,
      );
      for (const record of changed)
        this.write(this.next(record, now), "orphan", now);
      if (changed.length) invalidateProjectPlans(this.storage, projectId, now);
      return changed.length > 0;
    });
  }
  captureContext(
    projectId: string,
    snapshotId: string,
  ): ApprovedAnnotationContext {
    this.checkProject(projectId);
    const snapshot = this.current(projectId);
    if (!snapshot || snapshot.id !== snapshotId)
      throw new DomainError(
        "SNAPSHOT_CHANGED",
        "Annotation approval snapshot has changed.",
      );
    return parse(approvedAnnotationContextSchema, {
      version: 1,
      projectId,
      snapshotId,
      annotations: this.all(projectId).filter((record) => !record.deletedAt),
    });
  }
  saveApprovalContext(
    approvalId: string,
    context: ApprovedAnnotationContext,
  ): void {
    this.storage.transaction(() => {
      parse(idSchema, approvalId);
      const captured = parse(approvedAnnotationContextSchema, context);
      this.checkProject(captured.projectId);
      const key = `approved-annotations:${approvalId}`;
      if (this.storage.get("settings", key) !== undefined)
        throw new DomainError(
          "APPROVAL_CONTEXT_INVALID",
          "Approval annotation context already exists.",
        );
      this.storage.put("settings", key, captured);
    });
  }
  legacyApprovalIds(): ReadonlySet<string> {
    const registry = legacyRegistrySchema.safeParse(
      this.storage.get("settings", "annotation-review-legacy-v1"),
    );
    if (!registry.success)
      throw new DomainError(
        "APPROVAL_CONTEXT_INVALID",
        "Frozen legacy approval registry is invalid.",
      );
    return new Set(registry.data.approvalIds);
  }
}
