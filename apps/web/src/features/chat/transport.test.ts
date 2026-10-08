import { expect, it } from "vitest";
import { ChatApi } from "./transport.js";
it("project and run paths are encoded and HTTP failures preserve only structured error codes", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const api = new ChatApi(async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({ code: "AGENT_UNAVAILABLE", message: "No login" }),
      { status: 503 },
    );
  });
  await expect(
    api.start("project/a", { channel: "plan", message: "inspect" }),
  ).rejects.toMatchObject({ code: "AGENT_UNAVAILABLE" });
  await expect(api.cancel("project/a", "run/b")).rejects.toMatchObject({
    code: "AGENT_UNAVAILABLE",
  });
  expect(calls[0].url).toBe("/api/projects/project%2Fa/chat");
  expect(calls[1].url).toBe("/api/projects/project%2Fa/chat/run%2Fb/cancel");
  expect(calls[0].init?.method).toBe("POST");
  expect(JSON.parse(calls[0].init?.body as string)).toEqual({
    channel: "plan",
    message: "inspect",
  });
  expect(calls[1].init?.body).toBe("{}");
});
