import { useState } from "react";
import type {
  CodeNode,
  FunctionContextResult,
  FileContextResult,
  Operation,
  Relation,
} from "@codemap/core";
import type { Locale } from "../../i18n/index.js";
import { NodeIdentity } from "./nodeIdentity.js";
import { sourceWindow } from "./projection.js";
type InspectionRelation = Omit<Relation, "type"> & { type: string };
export function InspectionCard({
  node,
  locale,
  context,
  fileContext,
  relatedNodes = [],
  operations,
  planned,
  busy,
  previewId,
  source,
  error,
  onClose,
  onPage,
  onJump,
  onPreview,
  onSource,
}: {
  node: CodeNode;
  locale: Locale;
  context?: FunctionContextResult;
  fileContext?: FileContextResult;
  relatedNodes?: CodeNode[];
  operations: Operation[];
  planned: boolean;
  busy: boolean;
  previewId?: string;
  source?: { filePath: string; content: string };
  error?: string;
  onClose: () => void;
  onPage: (offset: number) => void;
  onJump: (id: string) => void;
  onPreview: (id?: string) => void;
  onSource: () => void;
}) {
  const en = locale === "en";
  const [copied, setCopied] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const text = (zh: string, english: string) => (en ? english : zh);
  const byId = new Map(
    [
      node,
      ...relatedNodes,
      ...(context?.relatedNodes ?? []),
      ...(fileContext?.relatedNodes ?? []),
    ].map((n) => [n.id, n]),
  );
  const plannedRelations: InspectionRelation[] = operations.flatMap((o) =>
    o.kind === "add_relation"
      ? [
          {
            id: o.id,
            sourceId: o.sourceId,
            targetId: o.targetId,
            type: o.type,
            resolution: "resolved" as const,
            evidence: { filePath: node.filePath ?? "", line: 0 },
          },
        ]
      : [],
  );
  const incoming = planned
    ? plannedRelations.filter((r) => r.targetId === node.id)
    : (fileContext?.incoming ?? context?.incoming ?? []);
  const outgoing = planned
    ? plannedRelations.filter((r) => r.sourceId === node.id)
    : (fileContext?.outgoing ?? context?.outgoing ?? []);
  const unknown =
    fileContext?.unknown ?? outgoing.filter((r) => r.resolution !== "resolved");
  const result = fileContext ?? context;
  const relationGroup = (
    title: string,
    relations: InspectionRelation[],
    direction: "incoming" | "outgoing" | "imports" | "unknown",
    total: number | string = relations.length,
  ) => (
    <section className={`inspection-group ${direction}`} key={direction}>
      <h3>
        {title} <span>{total}</span>
      </h3>
      {!relations.length && (
        <p className="muted">
          {text("本页没有记录", "No records on this page")}
        </p>
      )}
      {relations.map((r) => {
        const sourceNode = byId.get(r.sourceId),
          targetNode = r.targetId ? byId.get(r.targetId) : undefined;
        const incomingDirection =
          direction === "incoming" ||
          (direction === "imports" && r.targetId === node.id);
        const target = incomingDirection ? sourceNode : targetNode;
        const targetId = incomingDirection ? r.sourceId : r.targetId;
        return (
          <article
            key={r.id}
            className={`inspection-relation ${previewId === r.id ? "active" : ""}`}
            data-relation-id={r.id}
            onMouseEnter={() => onPreview(r.id)}
            onMouseLeave={() => onPreview()}
            onFocus={() => onPreview(r.id)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                onPreview();
            }}
          >
            <button
              className="inspection-jump"
              disabled={!targetId || r.resolution !== "resolved"}
              onClick={() => targetId && onJump(targetId)}
            >
              {target ? (
                <NodeIdentity node={target} locale={locale} />
              ) : (
                <span>
                  {r.evidence.text ??
                    text(
                      "当前查询范围外的目标",
                      "Target outside the loaded page",
                    )}
                </span>
              )}
              {target?.filePath && (
                <code>
                  {target.filePath}
                  {target.startLine ? `:${target.startLine}` : ""}
                </code>
              )}
            </button>
            <small>
              {sourceNode?.name ?? r.sourceId} →{" "}
              {targetNode?.name ??
                r.evidence.text ??
                text("待确认目标", "Unresolved target")}
            </small>
            {planned ? (
              <small>
                {text("规划关系", "Planned relation")} · {r.type}
              </small>
            ) : (
              <>
                <code>
                  {r.evidence.filePath}:{r.evidence.line}
                </code>
                {r.evidence.text && <pre>{r.evidence.text}</pre>}
              </>
            )}
            {r.resolution !== "resolved" && (
              <span className="badge">
                {r.resolution === "external"
                  ? text("外部调用", "External call")
                  : text("待确认", "Unresolved")}
              </span>
            )}
            {r.reason && <p className="muted">{r.reason}</p>}
          </article>
        );
      })}
    </section>
  );
  const location = `${node.filePath ?? node.name}${node.startLine ? `:${node.startLine}` : ""}`;
  const sourceSnippet =
    sourceOpen && source
      ? sourceWindow(source.content, node.startLine, node.endLine)
      : undefined;
  const maxTotal = fileContext
    ? Math.max(
        fileContext.totalMembers,
        fileContext.totalIncoming,
        fileContext.totalOutgoing,
        fileContext.totalImports,
        fileContext.totalUnknown,
      )
    : context
      ? Math.max(context.totalIncoming, context.totalOutgoing)
      : 0;
  return (
    <section
      className="inspection-card"
      aria-label={text("引用详情", "Reference details")}
    >
      <header>
        <h2>
          <NodeIdentity node={node} locale={locale} />
        </h2>
        <button
          aria-label={text("关闭详情", "Close details")}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="inspection-body">
        <p className="inspection-layer">
          {planned
            ? text("规划 · 目标文件", "Plan · target file")
            : text("源码事实", "Code fact")}
        </p>
        <code className="inspection-location">{location}</code>
        {node.signature && <pre className="signature">{node.signature}</pre>}
        <div className="button-row">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(location).then(
                () => setCopied(text("位置已复制", "Location copied")),
                () => setCopied(text("复制失败", "Copy failed")),
              );
            }}
          >
            {text("复制位置", "Copy location")}
          </button>
          {!planned &&
            node.filePath &&
            node.kind !== "folder" &&
            node.kind !== "external" && (
              <button
                data-action="source"
                onClick={() => {
                  setSourceOpen(!sourceOpen);
                  if (!sourceOpen && !source) onSource();
                }}
              >
                {sourceOpen
                  ? text("收起源码", "Hide source")
                  : text("查看源码", "View source")}
              </button>
            )}
        </div>
        {copied && <p role="status">{copied}</p>}
        {busy && (
          <p role="status">
            {text("正在读取当前快照…", "Reading the current snapshot…")}
          </p>
        )}
        {error && <p className="warning">{error}</p>}
        {sourceOpen &&
          (sourceSnippet ? (
            <pre className="source-code" data-testid="inspection-source">
              {sourceSnippet.text}
            </pre>
          ) : (
            <p className="muted">{text("正在读取源码…", "Loading source…")}</p>
          ))}
        {planned &&
          operations.flatMap((o, i) =>
            o.kind === "add_function" && o.tempId === node.id && o.description
              ? [
                  <p className="inspection-note" key={`description-${i}`}>
                    {o.description}
                  </p>,
                ]
              : [],
          )}
        {planned && (
          <p className="muted">
            {text("规划目标文件", "Planned target file")}: {node.filePath}
          </p>
        )}
        {fileContext && (
          <section className="inspection-group members">
            <h3>
              {text("文件内声明", "Declarations in this file")}{" "}
              <span>{fileContext.totalMembers}</span>
            </h3>
            {fileContext.members.map((member) => (
              <button
                className="inspection-member"
                key={member.id}
                onClick={() => onJump(member.id)}
              >
                <NodeIdentity node={member} locale={locale} />
                <code>
                  {member.filePath}:{member.startLine ?? 1}
                </code>
              </button>
            ))}
          </section>
        )}
        {(result || planned) && (
          <>
            {relationGroup(
              fileContext
                ? text("其他文件调用本文件", "Calls into this file")
                : text("调用它的函数", "Calls to this function"),
              incoming,
              "incoming",
              result?.totalIncoming,
            )}
            {relationGroup(
              fileContext
                ? text("本文件调用其他文件", "Calls from this file")
                : text("它调用的函数", "Calls from this function"),
              outgoing.filter((r) => r.resolution === "resolved"),
              "outgoing",
              context
                ? `${outgoing.filter((r) => r.resolution === "resolved").length} ${text("本页已解析 / 总调用", "resolved on page / all calls")} ${context.totalOutgoing}`
                : result?.totalOutgoing,
            )}
            {fileContext &&
              relationGroup(
                text("导入关系", "Imports"),
                fileContext.imports,
                "imports",
                fileContext.totalImports,
              )}
            {relationGroup(
              text(
                context ? "本页待确认 / 外部调用" : "待确认 / 外部调用",
                context
                  ? "Unresolved / external calls on this page"
                  : "Unresolved / external calls",
              ),
              unknown,
              "unknown",
              fileContext?.totalUnknown,
            )}
          </>
        )}
        {operations.flatMap((o, i) =>
          o.kind === "annotate" && o.targetId === node.id
            ? [
                <p className="inspection-note" key={i}>
                  {o.text}
                </p>,
              ]
            : [],
        )}
        {!result && !planned && !busy && (
          <p className="muted">
            {text(
              "当前对象的引用尚未载入；重新选择可读取当前快照。",
              "References are not loaded; select again to read the current snapshot.",
            )}
          </p>
        )}
        {result && (
          <>
            <p className="muted">
              {text(
                "已解析调用依据当前快照；零入边表示本次静态查询没有记录。",
                "Resolved calls reflect this snapshot; zero incoming calls means this static query has no records.",
              )}
            </p>
            {result.truncated && (
              <p className="warning">
                {text(
                  "引用按页显示，继续翻页查看其余记录。",
                  "References are paged; continue to see remaining records.",
                )}
              </p>
            )}
            <div className="button-row">
              <button
                disabled={busy || result.offset === 0}
                onClick={() =>
                  onPage(Math.max(0, result.offset - result.limit))
                }
              >
                {text("上一页引用", "Previous references")}
              </button>
              <button
                disabled={busy || result.offset + result.limit >= maxTotal}
                onClick={() => onPage(result.offset + result.limit)}
              >
                {text("下一页引用", "Next references")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
