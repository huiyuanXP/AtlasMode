import { createChatController } from "./controller.js";
import { ChatApi } from "./transport.js";
import type { ChatChannel, ChatTransport } from "./types.js";
/** Keep project/channel drafts across UI switches; each controller cancels on panel unmount. */
export function createChatSessions(api: ChatTransport = new ChatApi()) {
  const sessions = new Map<string, ReturnType<typeof createChatController>>();
  return {
    get(projectId: string, channel: ChatChannel) {
      const key = JSON.stringify([projectId, channel]);
      let session = sessions.get(key);
      if (!session) {
        session = createChatController(api, projectId, channel);
        sessions.set(key, session);
      }
      return session;
    },
    dispose() {
      for (const controller of sessions.values()) controller.dispose();
    },
  };
}
export type ChatSessions = ReturnType<typeof createChatSessions>;
