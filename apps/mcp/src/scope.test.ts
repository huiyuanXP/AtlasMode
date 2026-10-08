import { expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "node:http";
import { createMcpServer } from "./server.js";
import { mcpChannelTools } from "./scope.js";

test("scoped SDK metadata separates local reads from nondestructive draft/index mutations", async () => {
  const mcp = createMcpServer("http://127.0.0.1:1", {
    projectId: "bound",
    allowedTools: mcpChannelTools("plan"),
  });
  const client = new Client({ name: "annotation-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await mcp.connect(a);
    await client.connect(b);
    const tools = (await client.listTools()).tools;
    expect(tools).toHaveLength(18);
    for (const t of tools) {
      expect(t.annotations?.destructiveHint).toBe(false);
      expect(t.annotations?.openWorldHint).toBe(false);
    }
    expect(
      tools.find((t) => t.name === "search_functions")?.annotations
        ?.readOnlyHint,
    ).toBe(true);
    for (const name of [
      "propose_plan",
      "update_plan",
      "refresh_index",
      "get_approved_plan",
      "verify_implementation",
    ])
      expect(
        tools.find((t) => t.name === name)?.annotations?.readOnlyHint,
      ).toBe(false);
  } finally {
    await client.close();
    await mcp.close();
  }
});

test("immutable project binding rejects valid foreign tuple and filters projects/tools", async () => {
  const api = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        req.url === "/api/projects"
          ? [{ id: "a" }, { id: "b" }]
          : { plan: { id: "pb", projectId: "b" } },
      ),
    );
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  const port = (api.address() as { port: number }).port;
  const scope = {
    projectId: "a",
    allowedTools: ["list_projects", "get_project_summary", "update_plan"],
  };
  const mcp = createMcpServer(`http://127.0.0.1:${port}`, scope);
  scope.projectId = "b";
  scope.allowedTools.push("propose_plan");
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await mcp.connect(a);
    await client.connect(b);
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual([
      "list_projects",
      "get_project_summary",
      "update_plan",
    ]);
    const list = await client.callTool({
      name: "list_projects",
      arguments: {},
    });
    expect(
      JSON.parse((list.content as { text: string }[])[0]!.text).items,
    ).toEqual([{ id: "a" }]);
    const other = await client.callTool({
      name: "update_plan",
      arguments: {
        projectId: "b",
        planId: "pb",
        expectedRevision: 1,
        operations: [],
      },
    });
    expect(other.isError).toBe(true);
    expect(JSON.stringify(other)).toContain("PROJECT_MISMATCH");
  } finally {
    await client.close();
    await mcp.close();
    await new Promise<void>((r) => api.close(() => r()));
  }
});

test.each(["explore", "plan"])(
  "channel %s exposes all existing project-safe tools and refuses executable/approval tools",
  async (channel) => {
    const mcp = createMcpServer("http://127.0.0.1:1", {
      projectId: "bound",
      allowedTools: mcpChannelTools(channel),
    });
    const client = new Client({ name: "allowlist-test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    try {
      await mcp.connect(a);
      await client.connect(b);
      const tools = (await client.listTools()).tools.map((t) => t.name);
      expect(tools).toHaveLength(18);
      for (const safe of [
        "propose_plan",
        "update_plan",
        "propose_group",
        "propose_route",
        "refresh_index",
        "verify_implementation",
        "get_approved_plan",
      ])
        expect(tools).toContain(safe);
      for (const unsafe of [
        "approve_plan",
        "open_project",
        "execute_command",
        "write_source",
      ])
        expect(tools).not.toContain(unsafe);
    } finally {
      await client.close();
      await mcp.close();
    }
  },
);
