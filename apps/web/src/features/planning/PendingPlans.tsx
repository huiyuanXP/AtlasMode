import { useState } from "react";
import type { PlanDetail } from "@codemap/core";
import { pendingPlans } from "./pending.js";
import "./pending.css";
export function PendingPlans({
  plans,
  locale,
  busy,
  onChoose,
  onChat,
}: {
  plans: PlanDetail[];
  locale: "zh" | "en";
  busy: boolean;
  onChoose: (id: string) => void;
  onChat: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pending = pendingPlans(plans),
    zh = locale === "zh";
  const title = pending.length
    ? `${zh ? "待你审查" : "Awaiting your review"} · ${pending.length}`
    : zh
      ? "暂无待审规划"
      : "No plans awaiting review";
  return (
    <section
      className="pending-plans"
      aria-label={zh ? "规划审查" : "Plan review"}
    >
      <button
        className={
          pending.length ? "primary pending-trigger" : "pending-trigger"
        }
        aria-expanded={open}
        aria-controls="pending-plan-list"
        onClick={() => setOpen(!open)}
      >
        <span aria-live="polite">{title}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <div id="pending-plan-list" hidden={!open} className="pending-plan-list">
        {pending.map((detail) => (
          <article key={detail.plan.id}>
            <strong>{detail.plan.title}</strong>
            <p>
              {detail.plan.description ||
                (zh
                  ? "打开变更查看规划内容"
                  : "Open changes to inspect this plan")}
            </p>
            <small>
              r{detail.plan.revision} · {detail.plan.operations.length}{" "}
              {zh ? "项变更" : "changes"} ·{" "}
              {detail.plan.status === "stale"
                ? zh
                  ? "基线已过期"
                  : "Stale baseline"
                : detail.issues.some((i) => i.severity === "error")
                  ? zh
                    ? "需修正校验错误"
                    : "Validation errors"
                  : detail.approval
                    ? zh
                      ? "修改后需重新确认"
                      : "Changes require confirmation"
                    : zh
                      ? "待确认"
                      : "Awaiting confirmation"}
            </small>
            <button
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onChoose(detail.plan.id);
              }}
            >
              {zh ? "查看改动" : "View changes"}
            </button>
          </article>
        ))}
        {!pending.length && (
          <button
            onClick={() => {
              setOpen(false);
              onChat();
            }}
          >
            {zh ? "通过 Chat 提出规划" : "Propose a plan in Chat"}
          </button>
        )}
      </div>
    </section>
  );
}
