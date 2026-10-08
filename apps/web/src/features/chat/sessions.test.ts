import { expect, it } from "vitest";
import { createChatSessions } from "./sessions.js";
import type { ChatTransport } from "./types.js";
it("project and channel drafts remain separate and survive project switches", () => {
  const sessions = createChatSessions({} as ChatTransport),
    explore = sessions.get("a", "explore"),
    plan = sessions.get("a", "plan"),
    other = sessions.get("b", "explore");
  explore.setDraft("inspect retries");
  plan.setDraft("add notes");
  other.setDraft("inspect routes");
  explore.dispose();
  expect(sessions.get("a", "explore").store.getState().draft).toBe(
    "inspect retries",
  );
  expect(plan.store.getState().draft).toBe("add notes");
  expect(other.store.getState().draft).toBe("inspect routes");
  sessions.dispose();
});
