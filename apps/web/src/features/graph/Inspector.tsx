import { useState } from "react";
import type { CodeNode, FunctionContextResult } from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
import { sourceWindow } from "./projection.js";
export function Inspector({
  node,
  source,
  context,
  busy,
  onPage,
  onExpand,
}: {
  node?: CodeNode;
  source?: { filePath: string; content: string };
  context?: FunctionContextResult;
  busy: boolean;
  onPage: (offset: number) => void;
  onExpand: (budget: number) => void;
}) {
  const zh = useStrings();
  const [copyStatus, setCopyStatus] = useState<"copied" | "copyFailed" | "">(
    "",
  );
  if (!node) return <p className="empty-panel">{zh.noNode}</p>;
  const window =
    source && sourceWindow(source.content, node.startLine, node.endLine);
  const location = `${node.filePath ?? node.name}:${node.startLine ?? 1}`;
  return (
    <section className="inspector-content">
      <h2>{node.name}</h2>
      <code className="path">{location}</code>
      <p>
        <span className="badge">{zh[node.kind]}</span> {node.language}
      </p>
      {node.signature && <pre className="signature">{node.signature}</pre>}
      {context && (
        <div className="button-row">
          <button disabled={busy} onClick={() => onExpand(80)}>
            {zh.expand}
          </button>
          <button disabled={busy} onClick={() => onExpand(300)}>
            {zh.expandMore}
          </button>
        </div>
      )}
      <button
        disabled={!node.filePath}
        onClick={() => {
          void navigator.clipboard.writeText(location).then(
            () => setCopyStatus("copied"),
            () => setCopyStatus("copyFailed"),
          );
        }}
      >
        {zh.copy}
      </button>
      {copyStatus && <p role="status">{zh[copyStatus]}</p>}
      <h3>{zh.source}</h3>
      {busy && <p>{zh.loading}</p>}
      {window ? (
        <>
          <small>
            {window.startLine}–{window.endLine}
          </small>
          {window.truncated && <p className="warning">{zh.sourceCap}</p>}
          <pre className="source-code" data-testid="source-snippet">
            {window.text}
          </pre>
        </>
      ) : (
        !busy && <p className="muted">{zh.noSource}</p>
      )}
      {context && (
        <>
          <h3>
            {zh.incoming} ({context.totalIncoming}) / {zh.outgoing} (
            {context.totalOutgoing})
          </h3>
          <p className="muted">{zh.callsHelp}</p>
          {[
            ...context.incoming.map((r) => ({ r, direction: zh.incoming })),
            ...context.outgoing.map((r) => ({ r, direction: zh.outgoing })),
          ].map(({ r, direction }, i) => (
            <article className="evidence" key={`${r.id}-${i}`}>
              <strong>
                {direction} · {zh[r.resolution]}
              </strong>
              <code>
                {r.evidence.filePath}:{r.evidence.line}
              </code>
              <p>{r.evidence.text}</p>
              {r.reason && <p className="warning">{r.reason}</p>}
            </article>
          ))}
          {context.incoming.length + context.outgoing.length === 0 && (
            <p>{zh.noCalls}</p>
          )}
          {context.truncated && <p className="warning">{zh.truncated}</p>}
          <div className="button-row">
            <button
              disabled={busy || context.offset === 0}
              onClick={() => onPage(Math.max(0, context.offset - 50))}
            >
              {zh.contextPrev}
            </button>
            <button
              disabled={
                busy ||
                context.offset + 50 >=
                  Math.max(context.totalIncoming, context.totalOutgoing)
              }
              onClick={() => onPage(context.offset + 50)}
            >
              {zh.contextNext}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
