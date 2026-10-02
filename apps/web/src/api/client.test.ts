import { expect, it } from "vitest";
import { HttpApi } from "./client.js";
it("invokes fetch as a standalone function so browser receiver checks do not reject every request", async () => {
  const transport = function (this: unknown) {
    if (this !== undefined) throw new TypeError("Illegal invocation");
    return Promise.resolve(new Response("[]"));
  } as typeof fetch;
  await expect(new HttpApi(transport).projects()).resolves.toEqual([]);
});
