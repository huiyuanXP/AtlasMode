import { createMcpServer } from "@codemap/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AgentRunner, AgentStatus } from "./types.js";
import type { ProcessResult } from "./process.js";
import {
  ApiRunError,
  readResponse,
  type ResponseItem,
} from "./responses-stream.js";

const planningTools = new Set([
  "list_projects",
  "get_project_summary",
  "search_functions",
  "get_function_context",
  "get_subgraph",
  "get_routes",
  "get_groups",
  "get_folder_policies",
  "list_plans",
  "get_plan",
  "propose_route",
  "propose_plan",
  "update_plan",
  "validate_plan",
  "propose_group",
  "get_approved_plan",
  "refresh_index",
  "verify_implementation",
]);
/** Trusted constructor-only limits for deterministic fixture tests. No HTTP or env overrides. */
export interface ResponsesOptions {
  timeoutMs?: number;
  maxRequests?: number;
  maxTools?: number;
  maxOutputBytes?: number;
  maxRequestBytes?: number;
  maxToolResultBytes?: number;
}

interface Configuration {
  endpoint: string;
  model: string;
  key: string;
}
function configuration(env: NodeJS.ProcessEnv): Configuration | undefined {
  const model = env.CODEMAP_AGENT_MODEL?.trim();
  const keyName = env.CODEMAP_AGENT_API_KEY_ENV ?? "OPENAI_API_KEY";
  if (!model || model.length > 200 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyName))
    return;
  const key = env[keyName];
  if (!key || !key.trim() || /[\r\n]/.test(key)) return;
  try {
    const base = new URL(
      env.CODEMAP_AGENT_API_BASE_URL ?? "https://api.openai.com/v1",
    );
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      (base.protocol !== "https:" &&
        !(
          base.protocol === "http:" &&
          ["127.0.0.1", "[::1]", "localhost"].includes(base.hostname)
        ))
    )
      return;
    base.pathname = base.pathname.replace(/\/$/, "") + "/responses";
    return { endpoint: base.href, model, key };
  } catch {
    return;
  }
}
/** Trusted construction/environment configuration; never receives browser credentials. */
export function createResponsesRunner(
  env: NodeJS.ProcessEnv = process.env,
  options: ResponsesOptions = {},
): AgentRunner {
  const config = configuration({ ...env });
  const limits = {
    timeoutMs: options.timeoutMs ?? 120000,
    maxRequests: options.maxRequests ?? 8,
    maxTools: options.maxTools ?? 32,
    maxOutputBytes: options.maxOutputBytes ?? 1048576,
    maxRequestBytes: options.maxRequestBytes ?? 1048576,
    maxToolResultBytes: options.maxToolResultBytes ?? 262144,
  };
  if (
    Object.values(limits).some((n) => !Number.isSafeInteger(n) || n < 0) ||
    limits.timeoutMs === 0
  )
    throw new Error("Invalid trusted API run limits.");
  const status: AgentStatus = {
    provider: "responses",
    configured: true,
    available: !!config,
    ...(config
      ? {
          model: config.model,
          modelProvider: "responses",
          authentication: "api-environment" as const,
        }
      : {
          reason:
            "Direct API configuration is unavailable. Check server model, endpoint and API environment credentials.",
        }),
  };
  return {
    status: async () => ({ ...status }),
    start: async (context, emit) => {
      if (!config) throw new ApiRunError("AGENT_UNAVAILABLE");
      // Capture the allowlist before starting; caller/model cannot broaden it later.
      const allowed = new Set(context.tools);
      if ([...allowed].some((name) => !planningTools.has(name)))
        throw new ApiRunError("AGENT_UNSAFE_TOOL");
      const lifecycle = new AbortController();
      let reason = "AGENT_CANCELLED",
        settled = false;
      const timer = setTimeout(() => {
        reason = "AGENT_TIMEOUT";
        lifecycle.abort();
      }, limits.timeoutMs);
      const signal = lifecycle.signal;
      const client = new Client({
        name: "atlasmode-direct-api",
        version: "0.1.0",
      });
      const mcp = createMcpServer(context.apiUrl, {
        projectId: context.projectId,
        allowedTools: [...allowed],
      });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      const done = (async (): Promise<ProcessResult> => {
        try {
          await mcp.connect(serverTransport);
          await client.connect(clientTransport);
          signal.throwIfAborted();
          const catalog = (await client.listTools()).tools;
          if (
            catalog.length !== allowed.size ||
            catalog.some((tool) => !allowed.has(tool.name))
          )
            throw new ApiRunError("AGENT_UNSAFE_TOOL");
          const tools = catalog.map((tool) => ({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
            strict: false,
          }));
          const input: Record<string, unknown>[] = [
            { role: "user", content: context.prompt },
          ];
          const seenCalls = new Set<string>();
          let toolCount = 0,
            requestBytes = 0;
          const outputBudget = { remaining: limits.maxOutputBytes };
          for (let turn = 0; turn < limits.maxRequests; turn++) {
            signal.throwIfAborted();
            const body = JSON.stringify({
              model: config.model,
              store: false,
              stream: true,
              include: ["reasoning.encrypted_content"],
              parallel_tool_calls: false,
              max_output_tokens: 4096,
              tools,
              input,
            });
            requestBytes += Buffer.byteLength(body);
            if (requestBytes > limits.maxRequestBytes)
              throw new ApiRunError("AGENT_OUTPUT_LIMIT");
            const response = await fetch(config.endpoint, {
              method: "POST",
              redirect: "error",
              signal,
              headers: {
                "content-type": "application/json",
                accept: "text/event-stream",
                authorization: "Bearer " + config.key,
              },
              body,
            });
            if (!response.ok) {
              await response.body?.cancel().catch(() => {});
              throw new ApiRunError("AGENT_FAILED");
            }
            const output = await readResponse(
              response,
              signal,
              outputBudget,
              (text, key, first) => {
                if (!signal.aborted)
                  emit({
                    type: "message_delta",
                    text,
                    messageId: `${turn}:${key}`,
                    first,
                  });
              },
            );
            signal.throwIfAborted();
            // Validate the complete batch before dispatching any operation.
            const calls: {
              name: string;
              callId: string;
              args: Record<string, unknown>;
            }[] = [];
            for (const item of output) {
              if (
                !["message", "reasoning", "function_call"].includes(item.type)
              )
                throw new ApiRunError("AGENT_UNSAFE_TOOL");
              if (item.type !== "function_call") continue;
              const { name, call_id: callId, arguments: args } = item;
              if (typeof name !== "string" || !allowed.has(name))
                throw new ApiRunError("AGENT_UNSAFE_TOOL");
              if (
                typeof callId !== "string" ||
                !callId ||
                seenCalls.has(callId) ||
                typeof args !== "string" ||
                (item.status !== undefined && item.status !== "completed")
              )
                throw new ApiRunError("AGENT_PROTOCOL");
              let parsed: unknown;
              try {
                parsed = JSON.parse(args);
              } catch {
                throw new ApiRunError("AGENT_PROTOCOL");
              }
              if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
              )
                throw new ApiRunError("AGENT_PROTOCOL");
              seenCalls.add(callId);
              calls.push({
                name,
                callId,
                args: parsed as Record<string, unknown>,
              });
            }
            if (!calls.length) {
              if (!hasAnswer(output)) throw new ApiRunError("AGENT_PROTOCOL");
              return { ok: true };
            }
            if (
              toolCount + calls.length > limits.maxTools ||
              turn + 1 >= limits.maxRequests
            )
              throw new ApiRunError("AGENT_LIMIT");
            input.push(...output);
            for (const call of calls) {
              signal.throwIfAborted();
              toolCount++;
              emit({ type: "activity", tool: call.name, status: "running" });
              let result: Record<string, unknown>;
              try {
                // Do not abort a dispatched MCP mutation: await its actual commit/journal before terminal state.
                result = (await client.callTool(
                  { name: call.name, arguments: call.args },
                  undefined,
                  { timeout: 35000 },
                )) as Record<string, unknown>;
              } catch {
                // A transport failure can leave a forwarded write in flight.
                // Stop the loop; AgentBridge drains the gateway journal before terminal state.
                if (!signal.aborted)
                  emit({ type: "activity", tool: call.name, status: "failed" });
                throw new ApiRunError("AGENT_FAILED");
              }
              signal.throwIfAborted();
              const serialized = JSON.stringify(result);
              if (Buffer.byteLength(serialized) > limits.maxToolResultBytes)
                throw new ApiRunError("AGENT_OUTPUT_LIMIT");
              emit({
                type: "activity",
                tool: call.name,
                status: result.isError ? "failed" : "completed",
              });
              if (result.isError && !recoverableToolError(result))
                throw new ApiRunError("AGENT_FAILED");
              input.push({
                type: "function_call_output",
                call_id: call.callId,
                output: serialized,
              });
            }
          }
          throw new ApiRunError("AGENT_LIMIT");
        } catch (error) {
          return {
            ok: false,
            code: signal.aborted
              ? reason
              : error instanceof ApiRunError
                ? error.code
                : "AGENT_FAILED",
          };
        } finally {
          clearTimeout(timer);
          await Promise.allSettled([client.close(), mcp.close()]);
          settled = true;
        }
      })();
      return {
        done,
        stop: async () => {
          if (!settled && !signal.aborted) {
            reason = "AGENT_CANCELLED";
            lifecycle.abort();
          }
          await done;
        },
      };
    },
  };
}
function hasAnswer(output: ResponseItem[]) {
  return output.some(
    (item) =>
      item.type === "message" &&
      Array.isArray(item.content) &&
      item.content.some(
        (part: Record<string, unknown>) =>
          (typeof part.text === "string" && part.text.length > 0) ||
          (typeof part.refusal === "string" && part.refusal.length > 0),
      ),
  );
}

function recoverableToolError(result: Record<string, unknown>): boolean {
  const known = new Set([
    "PROJECT_MISMATCH",
    "NOT_FOUND",
    "INVALID_INPUT",
    "INVALID_PATH",
    "VALIDATION_FAILED",
    "REVISION_CONFLICT",
    "BASELINE_CONFLICT",
    "SNAPSHOT_CHANGED",
    "NOT_APPROVED",
    "SOURCE_UNAVAILABLE",
  ]);
  if (!Array.isArray(result.content) || result.content.length !== 1)
    return false;
  const item = result.content[0] as Record<string, unknown>;
  if (item.type !== "text" || typeof item.text !== "string") return false;
  // SDK input validation occurs before invoking the actual MCP handler.
  if (
    /^(?:MCP error -32602: )?Input validation error: Invalid arguments for tool /.test(
      item.text,
    )
  )
    return true;
  try {
    const error = JSON.parse(item.text) as { code?: string };
    return typeof error.code === "string" && known.has(error.code);
  } catch {
    return false;
  }
}
