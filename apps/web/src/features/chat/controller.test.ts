import { afterEach, expect, it, vi } from "vitest";
import { createChatController } from "./controller.js";
import type { ChatRun, ChatTransport } from "./types.js";
const running: ChatRun = {
  runId: "r",
  status: "running",
  messages: [],
  activity: [],
  errors: [],
  changedPlanIds: [],
  mayHaveSavedChanges: false,
};
const ready = { provider: "codex" as const, configured: true, available: true };
function deferred<T>() {
  let resolve!: (x: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
function fixture() {
  const starts: { projectId: string; input: unknown }[] = [],
    cancelled: string[] = [];
  let start: Promise<ChatRun> = Promise.resolve(running),
    poll: Promise<ChatRun> = Promise.resolve(running);
  const api: ChatTransport = {
    status: async () => ready,
    start: async (projectId, input) => {
      starts.push({ projectId, input });
      return start;
    },
    poll: async () => poll,
    cancel: async (projectId, runId) => {
      cancelled.push(`${projectId}/${runId}`);
      return { ...running, status: "cancelled", changedPlanIds: ["partial"] };
    },
  };
  const controller = createChatController(api, "project-a", "explore");
  return {
    controller,
    api,
    starts,
    cancelled,
    setStart: (p: Promise<ChatRun>) => {
      start = p;
    },
    setPoll: (p: Promise<ChatRun>) => {
      poll = p;
    },
  };
}
afterEach(() => vi.useRealTimers());
it("sends captured scope and retains a draft typed while a reply streams", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.controller.init();
  f.controller.setDraft("inspect retries");
  await f.controller.send(
    { snapshotId: "s", scope: { kind: "folder", path: "src" } },
    () => {},
  );
  expect(f.starts).toEqual([
    {
      projectId: "project-a",
      input: {
        message: "inspect retries",
        channel: "explore",
        snapshotId: "s",
        scope: { kind: "folder", path: "src" },
      },
    },
  ]);
  f.controller.setDraft("next question");
  f.setPoll(
    Promise.resolve({
      ...running,
      status: "completed",
      messages: [{ role: "assistant", text: "Found retries" }],
    }),
  );
  await vi.advanceTimersByTimeAsync(600);
  expect(f.controller.store.getState().messages.map((m) => m.text)).toEqual([
    "inspect retries",
    "Found retries",
  ]);
  expect(f.controller.store.getState().draft).toBe("next question");
  f.controller.dispose();
});
it("cancels a start acknowledgement arriving after disposal without leaking old output", async () => {
  const f = fixture(),
    d = deferred<ChatRun>();
  f.setStart(d.promise);
  f.controller.setDraft("hello");
  const settlements: unknown[] = [];
  const send = f.controller.send({}, (s) => {
    settlements.push(s);
  });
  f.controller.dispose();
  d.resolve(running);
  await send;
  expect(f.cancelled).toEqual(["project-a/r"]);
  expect(settlements).toHaveLength(1);
  expect(
    f.controller.store.getState().messages.some((m) => m.role === "assistant"),
  ).toBe(false);
});
it("rereads journaled partial changes when the user cancels", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.controller.setDraft("propose changes");
  const settled: unknown[] = [];
  await f.controller.send({}, (s) => {
    settled.push(s);
  });
  await f.controller.cancel();
  expect(settled).toEqual([
    {
      projectId: "project-a",
      channel: "explore",
      run: { ...running, status: "cancelled", changedPlanIds: ["partial"] },
    },
  ]);
  expect(f.controller.store.getState().busy).toBe(false);
  f.controller.dispose();
});
it("failed starts retain input and report unavailable without an invented response", async () => {
  const f = fixture();
  f.api.start = async () => {
    throw Object.assign(new Error("No login"), { code: "AGENT_UNAVAILABLE" });
  };
  f.controller.setDraft("help");
  await f.controller.send({}, () => {});
  const s = f.controller.store.getState();
  expect(s.draft).toBe("help");
  expect(s.error).toBe("AGENT_UNAVAILABLE");
  expect(s.messages).toEqual([]);
  expect(s.busy).toBe(false);
});
it("every failed terminal run synchronizes even when the journal is empty", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const settled: unknown[] = [];
  f.controller.setDraft("inspect");
  f.setPoll(
    Promise.resolve({
      ...running,
      status: "failed",
      errors: [{ code: "AGENT_AUTH", message: "private details" }],
      mayHaveSavedChanges: true,
    }),
  );
  await f.controller.send({}, (s) => {
    settled.push(s);
  });
  await vi.advanceTimersByTimeAsync(600);
  expect(settled).toHaveLength(1);
  expect(f.controller.store.getState().run?.mayHaveSavedChanges).toBe(true);
  expect(f.controller.store.getState().error).toBe("AGENT_AUTH");
  f.controller.dispose();
});
it("a stopped late poll cannot overwrite terminal cancellation", async () => {
  vi.useFakeTimers();
  const f = fixture(),
    d = deferred<ChatRun>();
  f.setPoll(d.promise);
  f.controller.setDraft("inspect");
  const settled: unknown[] = [];
  await f.controller.send({}, (s) => {
    settled.push(s);
  });
  await vi.advanceTimersByTimeAsync(600);
  await f.controller.cancel();
  d.resolve({
    ...running,
    status: "completed",
    messages: [{ role: "assistant", text: "late" }],
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(f.controller.store.getState().run?.status).toBe("cancelled");
  expect(settled).toHaveLength(1);
  f.controller.dispose();
});
it("cancelling before start acknowledgement stops its eventual handle", async () => {
  const f = fixture(),
    d = deferred<ChatRun>();
  f.setStart(d.promise);
  f.controller.setDraft("inspect");
  const settled: unknown[] = [];
  const send = f.controller.send({}, (s) => {
    settled.push(s);
  });
  await f.controller.cancel();
  expect(f.controller.store.getState().cancelling).toBe(true);
  d.resolve(running);
  await send;
  expect(f.cancelled).toEqual(["project-a/r"]);
  expect(settled).toHaveLength(1);
  expect(f.controller.store.getState().draft).toBe("inspect");
  f.controller.dispose();
});
it("polling failure cancels the still-owned run and rereads its actual partial mutation", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.api.poll = async () => {
    throw new Error("offline");
  };
  f.controller.setDraft("update");
  const settled: unknown[] = [];
  await f.controller.send({}, (s) => {
    settled.push(s);
  });
  await vi.advanceTimersByTimeAsync(600);
  expect(f.cancelled).toEqual(["project-a/r"]);
  expect(settled).toEqual([
    {
      projectId: "project-a",
      channel: "explore",
      run: { ...running, status: "cancelled", changedPlanIds: ["partial"] },
    },
  ]);
  f.controller.dispose();
});
it("failed synchronization of an older turn cannot overwrite the next running turn", async () => {
  vi.useFakeTimers();
  const f = fixture(),
    d = deferred<void>();
  f.setStart(Promise.resolve({ ...running, status: "completed" }));
  f.controller.setDraft("first");
  const send = f.controller.send({}, async () => {
    await d.promise;
    throw new Error("failed old sync");
  });
  await vi.advanceTimersByTimeAsync(1);
  f.setStart(Promise.resolve({ ...running, runId: "next" }));
  f.controller.setDraft("second");
  await f.controller.send({}, () => {});
  d.resolve();
  await send;
  expect(f.controller.store.getState().run?.runId).toBe("next");
  expect(f.controller.store.getState().error).toBeUndefined();
  f.controller.dispose();
});
it("retains the latest twenty conversation turns within one project channel", async () => {
  const f = fixture();
  f.setStart(
    Promise.resolve({
      ...running,
      status: "completed",
      messages: [{ role: "assistant", text: "reply" }],
    }),
  );
  for (let i = 0; i < 21; i++) {
    f.controller.setDraft(`turn ${i}`);
    await f.controller.send({}, () => {});
  }
  const messages = f.controller.store.getState().messages;
  expect(messages).toHaveLength(40);
  expect(messages[0].text).toBe("turn 1");
  expect(messages.at(-2)?.text).toBe("turn 20");
  f.controller.dispose();
});
