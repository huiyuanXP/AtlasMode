import type { FastifyInstance } from "fastify";
import type { WorkspaceService } from "@codemap/service";
import { z } from "zod";
import { AgentBridge, chatSchema } from "./bridge.js";
import { createConfiguredRunner } from "./configured.js";
import {
  AgentSettingsStore,
  buildRunner,
  createSwitchableRunner,
  environmentFor,
  probeClis,
  settingsSchema,
} from "./settings.js";
import type { AgentRunnerFactory } from "./types.js";

const empty = z.strictObject({});
const project = z.strictObject({ id: z.string().min(1) });
const runParams = z.strictObject({
  id: z.string().min(1),
  runId: z.string().min(1),
});
export function registerAgentRoutes(
  app: FastifyInstance,
  service: WorkspaceService,
  runnerFactory?: AgentRunnerFactory,
  settingsFile?: string,
): void {
  const launchEnv = process.env;
  // Saved user settings only apply to the production runner, never to an injected test runner.
  const store = settingsFile ? new AgentSettingsStore(settingsFile) : undefined;
  const initial = runnerFactory ? runnerFactory() : createConfiguredRunner();
  const switchable = createSwitchableRunner(initial);
  const adopt = !runnerFactory && !!store;
  const bridge = new AgentBridge(app, service, switchable.runner);
  app.addHook("onReady", async () => {
    if (adopt && (await store!.load()))
      switchable.replace(buildRunner(environmentFor(launchEnv, store!.get())));
  });
  // Stop and await owned CLI/MCP/gateway work before Fastify closes the main transport/storage.
  app.addHook("preClose", () => bridge.close());
  app.get("/api/agent/status", async (request) => {
    empty.parse(request.query);
    return bridge.status();
  });
  const settingsQuery = z.strictObject({ profile: z.string().max(64).optional() });
  app.get("/api/agent/settings", async (request) => {
    empty.parse(request.query);
    return {
      settings: store?.publicView(launchEnv) ?? {
        provider: "off",
        apiKeyConfigured: false,
        apiKeyEnvironment: false,
      },
      editable: adopt,
    };
  });
  app.get("/api/agent/probe", async (request) => {
    const { profile } = settingsQuery.parse(request.query);
    return probeClis(launchEnv, profile);
  });
  app.put("/api/agent/settings", async (request, reply) => {
    empty.parse(request.query);
    if (!adopt)
      return reply.code(409).send({
        code: "SETTINGS_LOCKED",
        message: "Agent settings are fixed by the server launch.",
      });
    const input = settingsSchema.parse(request.body);
    if (input.apiBaseUrl) {
      try {
        const url = new URL(input.apiBaseUrl);
        const local = ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname);
        if (
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          (url.protocol !== "https:" && !(url.protocol === "http:" && local))
        )
          throw new Error();
      } catch {
        return reply.code(400).send({
          code: "INVALID_INPUT",
          message: "API base URL must be https (or http on loopback) without credentials.",
        });
      }
    }
    await store!.save(input);
    switchable.replace(buildRunner(environmentFor(launchEnv, store!.get())));
    return { settings: store!.publicView(launchEnv), status: await bridge.status() };
  });
  app.post("/api/projects/:id/chat", async (request, reply) => {
    const { id } = project.parse(request.params);
    empty.parse(request.query);
    try {
      return await bridge.start(id, chatSchema.parse(request.body));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 503 || status === 409 || status === 429)
        return reply
          .code(status)
          .send({
            code:
              status === 503
                ? "AGENT_UNAVAILABLE"
                : status === 409
                  ? "AGENT_BUSY"
                  : "AGENT_LIMIT",
            message: (error as Error).message,
          });
      throw error;
    }
  });
  app.get("/api/projects/:id/chat/:runId", async (request) => {
    const { id, runId } = runParams.parse(request.params);
    empty.parse(request.query);
    return bridge.get(id, runId);
  });
  app.post("/api/projects/:id/chat/:runId/cancel", async (request) => {
    const { id, runId } = runParams.parse(request.params);
    empty.parse(request.query);
    empty.optional().parse(request.body);
    return bridge.cancel(id, runId);
  });
}
