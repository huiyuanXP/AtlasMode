import { createStore } from "zustand/vanilla";
import type {
  AgentStatus,
  ChatChannel,
  ChatContext,
  ChatRun,
  ChatTransport,
} from "./types.js";
export interface ChatState {
  draft: string;
  connection?: AgentStatus;
  connecting: boolean;
  busy: boolean;
  cancelling: boolean;
  messages: { role: "user" | "assistant"; text: string }[];
  run?: ChatRun;
  error?: string;
}
export interface ChatSettlement {
  projectId: string;
  channel: ChatChannel;
  run?: ChatRun;
}
export type Settled = (result: ChatSettlement) => void | Promise<void>;
interface Pending {
  submitted: string;
  previous: ChatState["messages"];
  settled: Settled;
  run?: ChatRun;
  cancelRequested: boolean;
  finished: boolean;
}
const errorCode = (error: unknown) =>
  (error as { code?: string })?.code ?? "CHAT_CONNECTION_ERROR";
export function createChatController(
  api: ChatTransport,
  projectId: string,
  channel: ChatChannel,
) {
  const store = createStore<ChatState>(() => ({
    draft: "",
    connecting: false,
    busy: false,
    cancelling: false,
    messages: [],
  }));
  let active: Pending | undefined,
    mounted = true,
    statusGeneration = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const finish = async (op: Pending, run?: ChatRun, error?: string) => {
    if (op.finished) return;
    op.finished = true;
    if (active === op) {
      stopTimer();
      active = undefined;
      const failed =
        error || run?.status === "failed" || run?.status === "cancelled";
      store.setState((s) => ({
        busy: false,
        cancelling: false,
        run,
        error: error ?? run?.errors[0]?.code,
        // Keep only model messages actually received, and never consume a newer draft.
        messages:
          mounted && run
            ? [
                ...op.previous,
                { role: "user", text: op.submitted },
                ...run.messages,
              ]
            : s.messages,
        draft: failed && !s.draft ? op.submitted : s.draft,
      }));
    }
    try {
      await op.settled({ projectId, channel, run });
    } catch {
      if (mounted && !active && store.getState().run?.runId === run?.runId)
        store.setState({ error: "CHAT_SYNC_FAILED" });
    }
  };
  const cancelOwned = async (op: Pending) => {
    if (!op.run || op.finished) return;
    try {
      const run = await api.cancel(projectId, op.run.runId);
      if (run.status === "running") {
        op.cancelRequested = false;
        if (mounted) schedule(op);
      } else await finish(op, run);
    } catch (error) {
      // The run is still owned; cancellation failure is not terminal success.
      if (active === op)
        store.setState({ error: errorCode(error), cancelling: false });
      if (mounted) {
        op.cancelRequested = false;
        schedule(op);
      } else
        await finish(
          op,
          { ...op.run, mayHaveSavedChanges: true },
          "CHAT_CANCEL_FAILED",
        );
    }
  };
  const poll = async (op: Pending) => {
    if (
      active !== op ||
      !mounted ||
      op.cancelRequested ||
      op.finished ||
      !op.run
    )
      return;
    try {
      const run = await api.poll(projectId, op.run.runId);
      if (active !== op || !mounted || op.cancelRequested || op.finished)
        return;
      op.run = run;
      store.setState({
        run,
        messages: [
          ...op.previous,
          { role: "user", text: op.submitted },
          ...run.messages,
        ],
      });
      if (run.status === "running") schedule(op);
      else await finish(op, run);
    } catch (error) {
      if (active !== op || op.finished || op.cancelRequested) return;
      store.setState({ error: errorCode(error) });
      op.cancelRequested = true;
      await cancelOwned(op);
    }
  };
  const schedule = (op: Pending) => {
    stopTimer();
    timer = setTimeout(() => {
      void poll(op);
    }, 500);
  };
  const cancel = async () => {
    const op = active;
    if (!op || op.finished || op.cancelRequested) return;
    op.cancelRequested = true;
    stopTimer();
    store.setState({ cancelling: true });
    // The acknowledgement can arrive later; send() will cancel its handle immediately.
    await cancelOwned(op);
  };
  return {
    store,
    projectId,
    channel,
    setDraft: (draft: string) => store.setState({ draft }),
    init: async () => {
      mounted = true;
      const generation = ++statusGeneration;
      store.setState({ connecting: true });
      try {
        const connection = await api.status();
        if (mounted && generation === statusGeneration)
          store.setState({ connection, connecting: false });
      } catch {
        if (mounted && generation === statusGeneration)
          store.setState({
            connecting: false,
            connection: { provider: null, configured: false, available: false },
            error: "CHAT_CONNECTION_ERROR",
          });
      }
    },
    send: async (context: ChatContext, settled: Settled) => {
      const s = store.getState(),
        submitted = s.draft;
      if (active || !submitted.trim() || submitted.length > 4096) return;
      const op: Pending = {
        submitted,
        previous: s.messages.slice(-38),
        settled,
        cancelRequested: false,
        finished: false,
      };
      active = op;
      store.setState({
        busy: true,
        cancelling: false,
        error: undefined,
        run: undefined,
      });
      try {
        op.run = await api.start(projectId, {
          ...context,
          channel,
          message: submitted,
        });
        if (!mounted || op.cancelRequested || active !== op) {
          op.cancelRequested = true;
          await cancelOwned(op);
          return;
        }
        store.setState((current) => ({
          run: op.run,
          messages: [
            ...op.previous,
            { role: "user", text: submitted },
            ...op.run!.messages,
          ],
          draft: current.draft === submitted ? "" : current.draft,
        }));
        if (op.run.status === "running") schedule(op);
        else await finish(op, op.run);
      } catch (error) {
        if (active === op) {
          active = undefined;
          store.setState({
            busy: false,
            cancelling: false,
            error: errorCode(error),
          });
        }
        // No run acknowledged: no success messages or fabricated mutations.
      }
    },
    cancel,
    dispose: () => {
      mounted = false;
      ++statusGeneration;
      stopTimer();
      void cancel();
    },
  };
}
export type ChatController = ReturnType<typeof createChatController>;
