import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import type { ChatController, Settled } from "./controller.js";
import type { ChatContext } from "./types.js";
import { activityLabel, chatErrorLabel, chatStrings } from "./strings.js";
export interface ChatPanelProps {
  controller: ChatController;
  locale: "zh" | "en";
  context: () => ChatContext;
  onSend: () => Settled;
}
export function ChatPanel({
  controller,
  locale,
  context,
  onSend,
}: ChatPanelProps) {
  const state = useStore(controller.store),
    s = chatStrings(locale),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void controller.init();
    return () => controller.dispose();
  }, [controller]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [state.messages, state.run?.activity.length]);
  const connected = state.connection?.available;
  return (
    <section
      className={`chat-panel chat-${controller.channel}`}
      aria-label={controller.channel === "explore" ? s.explore : s.plan}
    >
      <div className="chat-heading">
        <h2>{controller.channel === "explore" ? s.explore : s.plan}</h2>
        <span
          className={`connection-dot ${connected ? "connected" : ""}`}
          aria-hidden="true"
        />
      </div>
      <div
        className={`chat-connection ${connected ? "" : "disconnected"}`}
        role="status"
      >
        <span>
          {state.connecting
            ? s.checking
            : connected
              ? s.connected
              : s.disconnected}
          {connected && state.connection?.provider
            ? ` · ${{ codex: "Codex", claude: "Claude", responses: "Responses API" }[state.connection.provider]}`
            : ""}
          {connected && (state.connection?.profile || state.connection?.model)
            ? ` · ${[state.connection.profile, state.connection.model].filter(Boolean).join(" / ")}`
            : ""}
        </span>
        {!connected && !state.connecting && (
          <>
            <p>{s.setup}</p>
            <button type="button" onClick={() => void controller.init()}>
              {s.retry}
            </button>
          </>
        )}
      </div>
      <div
        className="chat-messages"
        role="log"
        aria-label={s.activity}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {!state.messages.length && (
          <p className="chat-empty">
            {controller.channel === "explore" ? s.exploreEmpty : s.planEmpty}
          </p>
        )}
        {state.messages.map((message, index) => (
          <article className={`chat-message ${message.role}`} key={index}>
            <small>{message.role === "user" ? s.you : s.assistant}</small>
            <p>{message.text}</p>
          </article>
        ))}
        {!!state.run?.activity.length && (
          <ul className="chat-activity">
            {state.run.activity.slice(-4).map((a, index) => (
              <li key={index}>
                <span aria-hidden="true">
                  {a.status === "completed"
                    ? "✓"
                    : a.status === "failed"
                      ? "!"
                      : "◌"}
                </span>{" "}
                {activityLabel(a.tool, locale)}
              </li>
            ))}
          </ul>
        )}
        {state.busy && (
          <p className="muted">
            {state.cancelling ? s.cancelling : s.thinking}
          </p>
        )}
        {!state.busy && state.run && (
          <p className="muted">
            {state.run.status === "completed"
              ? s.completed
              : state.run.status === "cancelled"
                ? s.cancelled
                : s.failed}
          </p>
        )}
        {state.run?.mayHaveSavedChanges && (
          <p className="warning" role="status">
            {s.partial}
          </p>
        )}
        {!state.run?.mayHaveSavedChanges &&
          !!state.run?.changedPlanIds.length &&
          !state.busy && <p className="muted">{s.saved}</p>}
        <div ref={end} />
      </div>
      {state.error && (
        <p className="error chat-error" role="alert">
          {chatErrorLabel(state.error, locale)}
        </p>
      )}
      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          const captured = context(),
            settled = onSend();
          void controller.send(captured, settled);
        }}
      >
        <textarea
          aria-label={s.input}
          placeholder={
            controller.channel === "explore" ? s.exploreHint : s.planHint
          }
          value={state.draft}
          onChange={(event) => controller.setDraft(event.target.value)}
          rows={3}
          maxLength={4096}
        />
        <div className="chat-compose-actions">
          <small>{state.draft.length}/4096</small>
          {state.busy ? (
            <button
              type="button"
              disabled={state.cancelling}
              onClick={() => void controller.cancel()}
            >
              {state.cancelling ? s.cancelling : s.cancel}
            </button>
          ) : (
            <button
              type="submit"
              className="primary"
              disabled={!state.draft.trim() || state.connecting}
            >
              {s.send}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
