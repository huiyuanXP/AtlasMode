import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { resolve, extname } from "node:path";
import { DomainError } from "@codemap/core";
import type { WorkspaceService } from "@codemap/service";
import { ZodError } from "zod";
import { registerRoutes } from "./routes.js";

const domainStatuses: Record<string, number> = {
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  INVALID_PATH: 400,
  PROJECT_MISMATCH: 400,
  VALIDATION_FAILED: 400,
  REVISION_CONFLICT: 409,
  BASELINE_CONFLICT: 409,
  NOT_APPROVED: 409,
  SOURCE_UNAVAILABLE: 503,
};
export async function createServer({
  service,
  webRoot,
}: {
  service: WorkspaceService;
  webRoot?: string;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          code: "INVALID_INPUT",
          message: "Invalid request.",
          issues: error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        });
    if (error instanceof DomainError) {
      const status = domainStatuses[error.code] ?? 500;
      return reply
        .code(status)
        .send({
          code: status === 500 ? "INTERNAL_ERROR" : error.code,
          message: status === 500 ? "Internal server error." : error.message,
        });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500)
      return reply
        .code(statusCode)
        .send({
          code: statusCode === 404 ? "NOT_FOUND" : "INVALID_INPUT",
          message: statusCode === 404 ? "Route not found." : "Invalid request.",
        });
    return reply
      .code(500)
      .send({ code: "INTERNAL_ERROR", message: "Internal server error." });
  });
  registerRoutes(app, service);
  if (webRoot) await app.register(fastifyStatic, { root: resolve(webRoot) });
  app.setNotFoundHandler((request, reply) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (
      webRoot &&
      (request.method === "GET" || request.method === "HEAD") &&
      pathname !== "/api" &&
      !pathname.startsWith("/api/") &&
      !extname(pathname)
    )
      return reply.type("text/html; charset=utf-8").sendFile("index.html");
    return reply
      .code(404)
      .send({ code: "NOT_FOUND", message: "Route not found." });
  });
  await app.ready();
  return app;
}
