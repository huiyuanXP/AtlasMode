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
  developmentProxy = false,
}: {
  service: WorkspaceService;
  webRoot?: string;
  developmentProxy?: boolean;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  // Validate raw authority before parsing bodies or invoking any service method.
  // Forwarded headers are intentionally irrelevant to this local-only boundary.
  app.addHook("onRequest", async (request, reply) => {
    const authority = request.headers.host;
    const match = authority?.match(
      /^(127\.0\.0\.1|localhost|\[::1\])(?::([0-9]{1,5}))?$/,
    );
    const port = match ? Number(match[2] ?? 80) : 0;
    const localPort = request.raw.socket.localPort;
    const trustedAuthority =
      !!match &&
      port > 0 &&
      port <= 65535 &&
      (localPort === undefined ||
        port === localPort ||
        (developmentProxy && port === 5173));
    const origin = request.headers.origin;
    const trustedOrigin =
      origin === undefined || origin === `http://${authority}`;
    if (!trustedAuthority || !trustedOrigin)
      return reply.code(403).send({
        code: "UNTRUSTED_REQUEST",
        message:
          "Requests must use the local service authority and trusted browser origin.",
      });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        code: "INVALID_INPUT",
        message: "Invalid request.",
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    if (error instanceof DomainError) {
      const status = domainStatuses[error.code] ?? 500;
      return reply.code(status).send({
        code: status === 500 ? "INTERNAL_ERROR" : error.code,
        message: status === 500 ? "Internal server error." : error.message,
      });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 500)
      return reply.code(statusCode).send({
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
