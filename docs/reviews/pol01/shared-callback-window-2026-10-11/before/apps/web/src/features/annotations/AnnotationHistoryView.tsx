import {
  annotationSchema,
  approvedAnnotationContextSchema,
} from "@codemap/core";
import type { AnnotationScope } from "./draft.js";
import {
  annotationReadMatches,
  type AnnotationHistoryRead,
  type ApprovedAnnotationRead,
} from "./reads.js";
import { annotationLabels } from "./labels.js";
import { AnnotationRecord } from "./AnnotationRecord.js";
export type AnnotationHistoryViewProps = {
  scope: AnnotationScope;
  locale: "zh" | "en";
  history?: AnnotationHistoryRead;
  approved?: ApprovedAnnotationRead;
  onPage?: (offset: number) => void;
};
export function AnnotationHistoryView({
  scope,
  locale,
  history,
  approved,
  onPage,
}: AnnotationHistoryViewProps) {
  const t = annotationLabels(locale),
    read =
      history && annotationReadMatches(scope, history.scope)
        ? history
        : undefined;
  const page = read?.status === "ready" ? read.value : undefined;
  const valid =
    page &&
    Number.isSafeInteger(page.total) &&
    page.total >= 0 &&
    Number.isSafeInteger(page.offset) &&
    page.offset >= 0 &&
    Number.isSafeInteger(page.limit) &&
    page.limit > 0 &&
    page.limit <= 100 &&
    Array.isArray(page.items) &&
    page.items.length <= page.limit &&
    page.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const parsed = annotationSchema.safeParse(item.annotation);
      return (
        parsed.success &&
        parsed.data.projectId === scope.projectId &&
        parsed.data.id === read?.annotationId &&
        ["create", "edit", "bind", "detach", "orphan", "delete"].includes(
          item.action,
        )
      );
    });
  const receipt =
    approved && annotationReadMatches(scope, approved.scope)
      ? approved
      : undefined;
  const capture =
    receipt?.contextStatus === "v1"
      ? approvedAnnotationContextSchema.safeParse(receipt.context)
      : undefined;
  const context =
    capture?.success && capture.data.projectId === scope.projectId
      ? capture.data
      : undefined;
  const actionLabels = {
    create: t.actionCreate,
    edit: t.actionEdit,
    bind: t.actionBind,
    detach: t.actionDetach,
    orphan: t.actionOrphan,
    delete: t.actionDelete,
  };
  return (
    <aside className="annotation-history" aria-label={t.history}>
      {read && (
        <section>
          <h3>{t.history}</h3>
          <p>{t.historyReadOnly}</p>
          {read.status === "loading" ? (
            <p role="status">{t.loading}</p>
          ) : read.status === "error" || !valid ? (
            <p role="alert">{t.historyError}</p>
          ) : (
            <>
              {!page!.items.length && <p>{t.historyEmpty}</p>}
              {page!.items.map((item) => (
                <article key={item.annotation.revision}>
                  <h4>
                    {t.recorded} · r{item.annotation.revision} ·{" "}
                    {actionLabels[item.action]}
                  </h4>
                  <p>
                    {t.recordedAt}:{" "}
                    <time dateTime={item.recordedAt}>{item.recordedAt}</time>
                  </p>
                  <AnnotationRecord
                    annotation={item.annotation}
                    locale={locale}
                    mode="history"
                  />
                </article>
              ))}
              {onPage && (
                <nav aria-label={t.history}>
                  <button
                    type="button"
                    disabled={page!.offset === 0}
                    onClick={() =>
                      onPage(Math.max(0, page!.offset - page!.limit))
                    }
                  >
                    {t.previous}
                  </button>
                  <span>
                    {page!.total === 0 ? 0 : page!.offset + 1}–
                    {Math.min(page!.offset + page!.items.length, page!.total)} /{" "}
                    {page!.total}
                  </span>
                  <button
                    type="button"
                    disabled={page!.offset + page!.limit >= page!.total}
                    onClick={() => onPage(page!.offset + page!.limit)}
                  >
                    {t.next}
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      )}
      {receipt && (
        <section data-source="approval">
          <h3>{t.approval}</h3>
          <p>
            <code>{receipt.approvalId}</code> · {t.historyReadOnly}
          </p>
          {receipt.contextStatus === "legacy" &&
          receipt.context === undefined ? (
            <p>{t.unrecorded}</p>
          ) : !context ? (
            <p role="alert">{t.historyError}</p>
          ) : (
            <>
              <p>
                {t.contextVersion}: {context.version}
              </p>
              <p>
                {t.snapshot}: <code>{context.snapshotId}</code>
              </p>
              {context.annotations.length === 0 && <p>{t.approvedEmpty}</p>}
              {context.annotations.map((note) => (
                <article key={note.id}>
                  <AnnotationRecord
                    annotation={note}
                    locale={locale}
                    mode="approval"
                  />
                </article>
              ))}
            </>
          )}
        </section>
      )}
    </aside>
  );
}
