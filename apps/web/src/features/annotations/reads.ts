import {
  annotationSchema,
  type AnnotationDetail,
  type AnnotationPage,
  type AnnotationHistoryPage,
  type ApprovedAnnotationContext,
} from "@codemap/core";
import type { AnnotationScope } from "./draft.js";
export type AnnotationRead<T> = {
  scope: AnnotationScope;
  status: "loading" | "ready" | "error";
  value?: T;
  error?: string;
};
export type AnnotationHistoryRead = AnnotationRead<AnnotationHistoryPage> & {
  annotationId: string;
};
export type ApprovedAnnotationRead = {
  scope: AnnotationScope;
  approvalId: string;
  contextStatus: "legacy" | "v1";
  context?: ApprovedAnnotationContext;
};
/** Selecting another fact does not invalidate already fetched knowledge. Project epochs and snapshots do. */
export function annotationReadMatches(
  scope: AnnotationScope,
  other: AnnotationScope,
): boolean {
  return (
    scope.projectId === other.projectId &&
    scope.snapshotId === other.snapshotId &&
    scope.epoch === other.epoch
  );
}
export function validAnnotationPage(
  scope: AnnotationScope,
  page: AnnotationPage,
): boolean {
  if (!page || typeof page !== "object") return false;
  return (
    Number.isSafeInteger(page.offset) &&
    page.offset >= 0 &&
    Number.isSafeInteger(page.limit) &&
    page.limit > 0 &&
    page.limit <= 100 &&
    Number.isSafeInteger(page.total) &&
    page.total >= 0 &&
    Array.isArray(page.items) &&
    page.items.length <= page.limit &&
    (page.snapshotId === undefined || page.snapshotId === scope.snapshotId) &&
    page.items.every((detail: AnnotationDetail) => {
      if (!detail || typeof detail !== "object") return false;
      const parsed = annotationSchema.safeParse(detail.annotation);
      return (
        parsed.success &&
        parsed.data.projectId === scope.projectId &&
        !parsed.data.deletedAt &&
        !!detail.resolution &&
        ["bound", "orphan", "unbound", "unknown"].includes(
          detail.resolution.status,
        ) &&
        (detail.resolution.snapshotId === undefined ||
          detail.resolution.snapshotId === scope.snapshotId)
      );
    })
  );
}
