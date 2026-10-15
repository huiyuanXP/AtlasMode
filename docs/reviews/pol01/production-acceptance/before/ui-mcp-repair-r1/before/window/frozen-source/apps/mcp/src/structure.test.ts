import { createConnection } from "node:net";
import { expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "node:http";
import { createMcpServer } from "./server.js";
async function fixture(
  run: (client: Client, paths: string[]) => Promise<void>,
  fault = false,
) {
  const paths: string[] = [];
  const api = createServer((req, res) => {
    paths.push(`${req.method} ${req.url}`);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/plans/plan")
      res.end(JSON.stringify({ plan: { id: "plan", projectId: "p" } }));
    else if (req.url === "/api/plans/plan/approved") {
      res.statusCode = fault ? 409 : 200;
      res.end(
        JSON.stringify(
          fault
            ? { code: "NOT_APPROVED", message: "external structure changed" }
            : {
                plan: { id: "plan", projectId: "p", revision: 2 },
                valid: true,
                approval: { planRevision: 2 },
              },
        ),
      );
    } else if (req.url === "/api/projects/p/policies?includeStructure=1")
      res.end(
        JSON.stringify({
          policies: [{ id: "legacy", purpose: "metadata" }],
          structureRevision: 3,
          fileDigest: "a".repeat(64),
          verifiedAt: "t",
          status: "ready",
        }),
      );
    else if (req.url === "/api/projects/p/summary")
      res.end(JSON.stringify({ snapshotId: "s" }));
    else {
      res.statusCode = 404;
      res.end(JSON.stringify({ code: "NOT_FOUND" }));
    }
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  const port = (api.address() as { port: number }).port;
  const mcp = createMcpServer(`http://127.0.0.1:${port}`, { projectId: "p" });
  const client = new Client({ name: "pol01", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await mcp.connect(a);
    await client.connect(b);
    await run(client, paths);
  } finally {
    await client.close();
    await mcp.close();
    await new Promise<void>((r) => api.close(() => r()));
    const probe = await new Promise<string>((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.on("connect", () => {
        socket.destroy();
        resolve("open");
      });
      socket.on("error", (error) =>
        resolve((error as NodeJS.ErrnoException).code ?? "unknown"),
      );
    });
    expect(probe).toBe("ECONNREFUSED");
    console.info(
      JSON.stringify({
        receipt: "POL01_MCP_OWNED_HTTP_CLOSED",
        workerPid: process.pid,
        port,
        portProbe: probe,
        mcp: "closed",
        sdkClient: "closed",
        http: "closed",
        tunnelsCreated: 0,
        fixture: "owned in-memory HTTP protocol responses; no user DB",
      }),
    );
  }
}
const value = (v: unknown) =>
  JSON.parse((v as { content: { text: string }[] }).content[0]!.text);
test("existing approved tool uses strong fresh GET after owner check without refresh writes or new tools", () =>
  fixture(async (client, paths) => {
    const tools = (await client.listTools()).tools;
    expect(tools).toHaveLength(18);
    expect(
      tools.find((t) => t.name === "get_approved_plan")?.annotations
        ?.readOnlyHint,
    ).toBe(false);
    const result = await client.callTool({
      name: "get_approved_plan",
      arguments: { projectId: "p", planId: "plan" },
    });
    expect(value(result).valid).toBe(true);
    expect(paths).toEqual([
      "GET /api/plans/plan",
      "GET /api/plans/plan/approved",
    ]);
  }));
test("existing folder tool reports same fresh structure capture and preserves pagination", () =>
  fixture(async (client, paths) => {
    const result = await client.callTool({
      name: "get_folder_policies",
      arguments: { projectId: "p", limit: 1 },
    });
    expect(value(result)).toMatchObject({
      items: [{ id: "legacy" }],
      total: 1,
      structureRevision: 3,
      fileDigest: "a".repeat(64),
      verifiedAt: "t",
      status: "ready",
      snapshotId: "s",
    });
    expect(paths[0]).toBe("GET /api/projects/p/policies?includeStructure=1");
  }));
test("strong current approval failure stays an error instead of falling back to cached history", () =>
  fixture(async (client, paths) => {
    const result = await client.callTool({
      name: "get_approved_plan",
      arguments: { projectId: "p", planId: "plan" },
    });
    expect(result.isError).toBe(true);
    expect(value(result).code).toBe("NOT_APPROVED");
    expect(paths).toEqual([
      "GET /api/plans/plan",
      "GET /api/plans/plan/approved",
    ]);
  }, true));
