import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { mcpChannelTools } from "./scope.js";
export { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const server = createMcpServer(
    process.env.CODEMAP_API_URL ?? "http://127.0.0.1:4310",
    {
      projectId: process.env.CODEMAP_MCP_PROJECT_ID,
      allowedTools: process.env.CODEMAP_MCP_CHANNEL
        ? mcpChannelTools(process.env.CODEMAP_MCP_CHANNEL)
        : undefined,
    },
  );
  const transport = new StdioServerTransport();
  let stopping = false;
  async function shutdown(failed = false) {
    if (failed) process.exitCode = 1;
    if (stopping) return;
    stopping = true;
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    process.stdin.removeListener("end", onEnd);
    process.stdout.removeListener("error", onError);
    await server.close();
    // The SDK pauses stdin, but an open parent pipe still keeps Node alive on a transport failure.
    process.stdin.destroy();
  }
  const onSignal = () => {
    void shutdown().catch(onError);
  };
  const onEnd = () => {
    void shutdown().catch(onError);
  };
  function onError(_error: unknown) {
    console.error(
      "AtlasMode MCP stdio transport failed; closing the connection.",
    );
    void shutdown(true).catch(() => {
      process.exitCode = 1;
      process.stdin.destroy();
    });
  }
  server.server.onerror = onError;
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  process.stdin.once("end", onEnd);
  process.stdout.once("error", onError);
  try {
    await server.connect(transport);
  } catch (error) {
    onError(error);
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    await main();
  } catch {
    console.error(
      "Unable to start AtlasMode MCP. Check CODEMAP_API_URL and the Node entry path.",
    );
    process.exitCode = 1;
  }
}
