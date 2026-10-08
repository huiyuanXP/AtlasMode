// Test-only simulated native JSONL protocol, never a production provider.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
let prompt = "";
for await (const chunk of process.stdin) prompt += chunk;
const mode = process.argv[2];
const out = (x) => process.stdout.write(JSON.stringify(x) + "\n");
if (mode === "echo") {
  const text = JSON.stringify({
    prompt,
    args: process.argv.slice(3),
    cwd: process.cwd(),
  });
  const line =
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text },
    }) + "\n";
  process.stdout.write(line.slice(0, 17));
  setTimeout(() => process.stdout.write(line.slice(17)), 10);
} else if (mode === "claude") {
  out({
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "真实协议模拟文本" },
        {
          type: "tool_use",
          id: "t",
          name: "mcp__atlasmode__search_functions",
          input: {},
        },
      ],
    },
  });
  out({
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "t",
          is_error: false,
          content: "private result",
        },
      ],
    },
  });
  out({ type: "result", is_error: false, result: "真实协议模拟文本" });
} else if (mode === "tool") {
  out({
    type: "item.completed",
    item: {
      type: "mcp_tool_call",
      server: "atlasmode",
      tool: "propose_plan",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              plan: { id: "p", projectId: "a", revision: 2 },
            }),
          },
        ],
      },
      status: "completed",
    },
  });
  out({
    type: "item.completed",
    item: { type: "agent_message", text: "Draft saved." },
  });
} else if (mode === "claudeinvalid") {
  out({ type: "assistant", message: { content: [null] } });
} else if (mode === "modelnotice" || mode === "itemerror") {
  out({
    type: "item.completed",
    item: {
      type: "error",
      message:
        mode === "modelnotice"
          ? "Model metadata for `custom-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."
          : "SECRET fatal provider error",
    },
  });
  out({
    type: "item.completed",
    item: { type: "agent_message", text: "Final answer." },
  });
} else if (mode === "invalid") process.stdout.write("not-json\n");
else if (mode === "oversize") process.stdout.write("x".repeat(1024 * 1024 + 1));
else if (mode === "auth") {
  process.stderr.write("SECRET credential unauthorized");
  process.exitCode = 1;
} else if (mode === "native")
  out({
    type: "item.completed",
    item: {
      type: "command_execution",
      command: "evil",
      aggregated_output: "secret",
    },
  });
else if (mode === "hang" || mode === "tree") {
  if (mode === "tree") {
    const child = spawn(
      process.execPath,
      ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
      { stdio: "ignore" },
    );
    writeFileSync(process.argv[3], String(child.pid));
  }
  process.on("SIGTERM", () => {});
  setInterval(() => {}, 1000);
} else if (mode === "mutatefail" || mode === "mutatehang") {
  const response = await fetch(process.argv[3] + "/api/plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId: process.argv[4],
      title: "native fixture saved draft",
    }),
  });
  if (!response.ok) process.exit(2);
  if (mode === "mutatefail") {
    process.stdout.write("not-json-after-committed-write\n");
    process.exitCode = 1;
  } else {
    process.on("SIGTERM", () => {});
    setInterval(() => {}, 1000);
  }
} else if (mode === "mcpdraft") {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } =
    await import("@modelcontextprotocol/sdk/client/stdio.js");
  const { fileURLToPath } = await import("node:url");
  const client = new Client({
    name: "explicit-test-only-native-protocol",
    version: "1",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(new URL("../../../../mcp/dist/index.js", import.meta.url)),
    ],
    env: {
      CODEMAP_API_URL: process.argv[3],
      CODEMAP_MCP_PROJECT_ID: process.argv[4],
      CODEMAP_MCP_CHANNEL: "plan",
    },
    stderr: "pipe",
  });
  transport.stderr?.resume();
  try {
    await client.connect(transport);
    const summary = await client.callTool({
      name: "get_project_summary",
      arguments: { projectId: process.argv[4] },
    });
    const current = JSON.parse(summary.content[0].text);
    out({
      type: "item.started",
      item: {
        type: "mcp_tool_call",
        server: "atlasmode",
        tool: "propose_plan",
      },
    });
    const saved = await client.callTool({
      name: "propose_plan",
      arguments: {
        projectId: process.argv[4],
        title: "actual scoped MCP draft",
        baselineSnapshotId: current.snapshotId,
        operations: [],
      },
    });
    if (saved.isError) process.exitCode = 1;
    else {
      out({
        type: "item.completed",
        item: {
          type: "mcp_tool_call",
          server: "atlasmode",
          tool: "propose_plan",
          status: "completed",
          result: saved,
        },
      });
      out({
        type: "item.completed",
        item: {
          type: "agent_message",
          text: "Test-only process saved a draft through actual scoped MCP.",
        },
      });
    }
  } finally {
    await client.close();
  }
}
