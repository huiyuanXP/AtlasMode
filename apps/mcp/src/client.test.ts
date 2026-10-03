import { expect, test } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import { ApiClient } from "./client.js";

test("the 30 second deadline reports API_TIMEOUT while consuming a stalled JSON body", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"unfinished":');
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const client = new ApiClient(
    `http://127.0.0.1:${(server.address() as { port: number }).port}`,
  );
  try {
    await expect(client.request("/stalled")).rejects.toMatchObject({
      code: "API_TIMEOUT",
    });
  } finally {
    client.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 35000);
