import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function childEnvironment() {
  const env = { ...process.env };
  // Playwright may force color while the host declares NO_COLOR; keep child stderr diagnostic-only.
  if (env.NO_COLOR !== undefined) delete env.FORCE_COLOR;
  return env;
}
export async function freePort() {
  const listener = createServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((done) => listener.close(done));
  return port;
}
export async function startProduction(data, port) {
  port ??= await freePort();
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("tests/support/graceful-preload.mjs")).href,
      resolve("apps/server/dist/index.js"),
    ],
    {
      env: {
        ...childEnvironment(),
        CODEMAP_PORT: String(port),
        CODEMAP_DATA_DIR: data,
        CODEMAP_WORKSPACE_ROOT: "",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let output = "";
  child.stdout.on("data", (value) => {
    output += value;
  });
  child.stderr.on("data", (value) => {
    output += value;
  });
  const exited = once(child, "exit");
  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.send({ testSignal: "SIGTERM" });
    const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
    try {
      assert.deepEqual(await exited, [0, null], output);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const deadline = Date.now() + 15000;
    while (
      Date.now() < deadline &&
      child.exitCode === null &&
      child.signalCode === null
    ) {
      try {
        if ((await fetch(`${url}/api/health`)).ok)
          return { url, port, stop, child, output: () => output };
      } catch {}
      await new Promise((done) => setTimeout(done, 40));
    }
    throw new Error(`Production server did not become ready: ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}
export async function http(url, path, method = "GET", body) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  assert.equal(response.ok, true, JSON.stringify(value));
  return value;
}
export async function connectMcp(url) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("apps/mcp/dist/index.js")],
    env: { ...childEnvironment(), CODEMAP_API_URL: url },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const client = new Client({ name: "atlasmode-acceptance", version: "1.0.0" });
  await client.connect(transport);
  return {
    client,
    transport,
    stderr: () => stderr,
    call: async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse(result.content[0].text);
    },
  };
}
export const requestSource =
  'export function A() { return "direct"; }\nexport function requestWithRetry() { return "retry"; }\n';
export const callerSource =
  'import { A, requestWithRetry } from "./requests";\nexport function caller() { return A(); }\nexport function dynamic(fn: () => void) { return fn(); }\n';
export async function createFixtures(root) {
  const ts = join(root, "typescript"),
    python = join(root, "python"),
    marker = join(root, "TARGET_EXECUTED");
  await mkdir(ts, { recursive: true });
  await mkdir(python, { recursive: true });
  await writeFile(join(ts, "requests.ts"), requestSource);
  await writeFile(join(ts, "main.ts"), callerSource);
  await writeFile(
    join(ts, "never-execute.ts"),
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "executed");\nthrow new Error("Target source must never execute");\n`,
  );
  await writeFile(
    join(python, "app.py"),
    `from pathlib import Path\nPath(${JSON.stringify(marker)}).write_text("executed")\nraise RuntimeError("Target source must never execute")\ndef helper():\n    return 7\ndef entry():\n    return helper()\ndef dynamic(fn):\n    return fn()\n`,
  );
  return {
    ts,
    python,
    marker,
    assertNotExecuted: async () => {
      await assert.rejects(access(marker));
    },
  };
}
