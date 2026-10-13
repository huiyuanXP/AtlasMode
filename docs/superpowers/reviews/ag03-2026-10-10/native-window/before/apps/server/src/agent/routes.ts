import type { FastifyInstance } from "fastify";
import type { WorkspaceService } from "@codemap/service";
import { z } from "zod";
import { AgentBridge, chatSchema } from "./bridge.js";
import { createNativeRunner } from "./native.js";
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
): void {
  const bridge = new AgentBridge(
    app,
    service,
    runnerFactory ? runnerFactory() : createNativeRunner(),
  );
  // Stop and await owned CLI/MCP/gateway work before Fastify closes the main transport/storage.
  app.addHook("preClose", () => bridge.close());
  app.get("/api/agent/status", async (request) => {
    empty.parse(request.query);
    return bridge.status();
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
