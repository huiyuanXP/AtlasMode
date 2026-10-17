import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import type { ChatController, ChatState, Settled } from "./controller.js";
import type { ChatContext } from "./types.js";
import { activityLabel, chatErrorLabel, chatStrings } from "./strings.js";
export interface ChatPanelProps {
  controller: ChatController;
  locale: "zh" | "en";
  context: () => ChatContext;
  onSend: () => Settled;
}
type Row = ChatState["messages"][number];
/**
 * Map controller state to assistant-ui messages. Tool activity from the running
 * turn is shown as tool-call parts on the last assistant message.
 */
export function toThreadMessages(
  messages: readonly Row[],
  run: ChatState["run"],
  busy: boolean,
): ThreadMessageLike[] {
  const out: ThreadMessageLike[] = messages.map((m, i) => ({
    id: `m${i}`,
    role: m.role,
    content: [{ type: "text" as const, text: m.text }],
  }));
  const calls = (run?.activity ?? []).map((a, i) => ({
    type: "tool-call" as const,
    toolCallId: `t${i}`,
    toolName: a.tool,
    args: {},
    ...(a.status === "running"
      ? {}
      : { result: a.status, isError: a.status === "failed" }),
  }));
  if (calls.length) {
    const last = out[out.length - 1];
    if (last?.role === "assistant" && Array.isArray(last.content))
      out[out.length - 1] = {
        ...last,
        content: [...calls, ...last.content],
        status: busy ? { type: "running" } : { type: "complete", reason: "stop" },
      };
    else
      out.push({
        id: "tools",
        role: "assistant",
        content: calls,
        status: busy ? { type: "running" } : { type: "complete", reason: "stop" },
      });
  }
  return out;
}
function ToolCard({
  toolName,
  result,
  isError,
  locale,
}: ToolCallMessagePartProps & { locale: "zh" | "en" }) {
  const state = isError ? "failed" : result === undefined ? "running" : "completed";
  return (
    <div className={`chat-tool chat-tool-${state}`} data-tool-state={state}>
      <span aria-hidden="true">
        {state === "completed" ? "✓" : state === "failed" ? "!" : "◌"}
      </span>{" "}
      {activityLabel(toolName, locale)}
    </div>
  );
}
export function ChatPanel({
  controller,
  locale,
  context,
  onSend,
}: ChatPanelProps) {
  const state = useStore(controller.store),
    s = chatStrings(locale);
  useEffect(() => {
    void controller.init();
    return () => controller.dispose();
  }, [controller]);
  const connected = state.connection?.available;
  const sending = useRef(false);
  const thread = useMemo(
    () => toThreadMessages(state.messages, state.run, state.busy),
    [state.messages, state.run, state.busy],
  );
  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages: thread,
    isRunning: state.busy,
    isSendDisabled: state.connecting,
    convertMessage: (m) => m,
    onNew: async (message) => {
      const text = message.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("");
      sending.current = true;
      try {
        controller.setDraft(text);
        const captured = context(),
          settled = onSend();
        await controller.send(captured, settled);
        // An unacknowledged send keeps the input (the controller only clears on acknowledgement).
        if (controller.store.getState().draft === text)
          runtime.thread.composer.setText(text);
      } finally {
        sending.current = false;
      }
    },
    onCancel: () => controller.cancel(),
  });
  // Keep the controller draft and the composer text in step (typing, restore after failure).
  useEffect(() => {
    const composer = runtime.thread.composer;
    return composer.subscribe(() => {
      if (!sending.current) controller.setDraft(composer.getState().text);
    });
  }, [runtime, controller]);
  useEffect(() => {
    const composer = runtime.thread.composer;
    if (composer.getState().text !== state.draft) composer.setText(state.draft);
  }, [runtime, state.draft]);
  const components = useMemo(
    () => ({
      Text: ({ text }: { text: string }) => <p>{text}</p>,
      tools: {
        Fallback: (props: ToolCallMessagePartProps) => (
          <ToolCard {...props} locale={locale} />
        ),
      },
    }),
    [locale],
  );
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
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport
            className="chat-messages"
            role="log"
            aria-label={s.activity}
            aria-live="polite"
            aria-relevant="additions text"
          >
            <ThreadPrimitive.Empty>
              <p className="chat-empty">
                {controller.channel === "explore" ? s.exploreEmpty : s.planEmpty}
              </p>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages>
              {({ message }) => (
                <MessagePrimitive.Root
                  className={`chat-message ${message.role}`}
                >
                  <small>{message.role === "user" ? s.you : s.assistant}</small>
                  <MessagePrimitive.Parts components={components} />
                </MessagePrimitive.Root>
              )}
            </ThreadPrimitive.Messages>
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
          </ThreadPrimitive.Viewport>
          {state.error && (
            <p className="error chat-error" role="alert">
              {chatErrorLabel(state.error, locale)}
            </p>
          )}
          <ComposerPrimitive.Root className="chat-compose">
            <ComposerPrimitive.Input
              aria-label={s.input}
              placeholder={
                controller.channel === "explore" ? s.exploreHint : s.planHint
              }
              rows={3}
              maxLength={4096}
            />
            <div className="chat-compose-actions">
              {state.busy ? (
                <ComposerPrimitive.Cancel disabled={state.cancelling}>
                  {state.cancelling ? s.cancelling : s.cancel}
                </ComposerPrimitive.Cancel>
              ) : (
                <ComposerPrimitive.Send className="primary">
                  {s.send}
                </ComposerPrimitive.Send>
              )}
            </div>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
    </section>
  );
}
