import type { Annotation, AnnotationDetail } from "@codemap/core";
import { annotationLabels } from "./labels.js";
export function AnnotationRecord({
  annotation,
  locale,
  resolution,
  mode = "current",
}: {
  annotation: Annotation;
  locale: "zh" | "en";
  resolution?: AnnotationDetail["resolution"];
  mode?: "current" | "history" | "approval";
}) {
  const t = annotationLabels(locale),
    binding = annotation.binding;
  const status = resolution?.status;
  return (
    <div
      className="annotation-record"
      data-annotation-id={annotation.id}
      data-source={mode}
    >
      <div className="annotation-meta">
        <span>
          {t.author}: {annotation.author}
        </span>
        <span>
          {t.source}: {annotation.source === "agent" ? t.agent : t.user}
        </span>
        <span
          className={
            annotation.isConstraint
              ? "annotation-badge annotation-constraint"
              : "annotation-badge"
          }
        >
          {annotation.isConstraint ? t.constraint : t.note}
        </span>
        <span>
          {t.revision}: r{annotation.revision}
        </span>
      </div>
      <p className="annotation-prose">{annotation.text}</p>
      {mode === "current" && status && (
        <p className={`annotation-status annotation-status-${status}`}>
          {t[status]}
          {resolution?.reason && <> · {resolution.reason}</>}
        </p>
      )}
      {binding && (
        <dl className="annotation-provenance">
          <dt>{t.lastKnown}</dt>
          <dd>
            {binding.lastKnown.label} ·{" "}
            <code>{binding.lastKnown.filePath}</code>
          </dd>
          <dt>{t.target}</dt>
          <dd>
            {binding.target.kind}
            {binding.lastKnown.nodeKind
              ? ` (${binding.lastKnown.nodeKind})`
              : ""}{" "}
            · <code>{binding.target.id}</code>
          </dd>
          <dt>{t.selectedSnapshot}</dt>
          <dd>
            <code>{binding.selectedSnapshotId}</code>
          </dd>
          {binding.state === "orphan" && (
            <>
              <dt>{t.orphanSnapshot}</dt>
              <dd>
                <code>{binding.orphanedAtSnapshotId}</code>
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
