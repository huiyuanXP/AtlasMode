import { createServer } from "node:http";
import type { FastifyInstance } from "fastify";
import type { WorkspaceService } from "@codemap/service";
import type { ChatChannel } from "./types.js";

export interface MutationJournal {
  planIds: Set<string>;
  mutated: boolean;
}
/** A run-owned loopback origin. No approvals, project opening, source writes or unrestricted proxy. */
export async function createScopedGateway(
  app: FastifyInstance,
  service: WorkspaceService,
  projectId: string,
  _channel: ChatChannel,
  journal: MutationJournal,
) {
  let stopping = false;
  const inFlight = new Set<Promise<void>>();
  const server = createServer((req, res) => {
    const task = (async () => {
      const deny = () => {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            code: "PROJECT_MISMATCH",
            message: "Request is outside this Agent run scope.",
          }),
        );
      };
      if (stopping || req.headers.origin !== undefined) return deny();
      const port = (server.address() as { port: number } | null)?.port;
      if (req.headers.host !== `127.0.0.1:${port}`) return deny();
      const raw = req.url ?? "";
      // Validate before URL normalization; reject encoded separators/dot traversal and duplicate slashes.
      const pathname = raw.split("?")[0]!;
      let parts: string[];
      try {
        parts = pathname
          .split("/")
          .slice(1)
          .map((p) => decodeURIComponent(p));
      } catch {
        return deny();
      }
      if (
        !pathname.startsWith("/") ||
        parts.some(
          (p) =>
            !p ||
            p === "." ||
            p === ".." ||
            p.includes("/") ||
            p.includes("\\"),
        ) ||
        raw.includes("#")
      )
        return deny();
      const [api, kind, id, action] = parts;
      if (api !== "api" || parts.length > 5) return deny();
      const method = req.method ?? "GET";
      let body: unknown;
      if (method !== "GET") {
        let bytes = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 262144) {
            res.writeHead(413);
            res.end();
            return;
          }
          chunks.push(chunk);
        }
        try {
          body = chunks.length
            ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
            : {};
        } catch {
          res.writeHead(400);
          res.end();
          return;
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          return deny();
      }
      const value = body as Record<string, unknown> | undefined;
      let allowed = false,
        mutation = false;
      if (kind === "projects") {
        if (parts.length === 2 && method === "GET") allowed = true;
        else if (id === projectId) {
          if (method === "GET")
            allowed =
              (parts.length === 4 &&
                [
                  "summary",
                  "functions",
                  "groups",
                  "policies",
                  "plans",
                  "routes",
                ].includes(action ?? "")) ||
              (parts.length === 5 && action === "functions");
          if (method === "POST" && parts.length === 4) {
            if (action === "subgraph") allowed = true;
            if (action === "refresh") allowed = mutation = true;
            if (
              action === "routes" &&
              value?.source === "agent" &&
              !("id" in value)
            )
              allowed = mutation = true;
            if (
              action === "groups" &&
              value?.source === "agent" &&
              !("id" in value)
            )
              allowed = mutation = true;
          }
        }
      }
      if (kind === "plans") {
        if (
          parts.length === 2 &&
          method === "POST" &&
          value?.projectId === projectId
        )
          allowed = mutation = true;
        else if (id) {
          try {
            if (service.getPlan(id).plan.projectId !== projectId) return deny();
          } catch {
            return deny();
          }
          if (parts.length === 3 && method === "GET") allowed = true;
          if (parts.length === 3 && method === "PUT") allowed = mutation = true;
          if (
            parts.length === 4 &&
            method === "POST" &&
            ["validate", "verify"].includes(action ?? "")
          ) {
            allowed = true;
            if (action === "verify") mutation = true;
          }
        }
      }
      if (!allowed) return deny();
      const response = await app.inject({
        method: method as "GET" | "POST" | "PUT",
        url: raw,
        headers: { host: "127.0.0.1" },
        ...(body === undefined
          ? {}
          : {
              payload: JSON.stringify(body),
              headers: {
                host: "127.0.0.1",
                "content-type": "application/json",
              },
            }),
      });
      let payload: unknown;
      try {
        payload = JSON.parse(response.payload);
      } catch {
        payload = {
          code: "INTERNAL_ERROR",
          message: "Invalid service response.",
        };
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (kind === "projects" && parts.length === 2)
          payload = (payload as { id: string }[]).filter(
            (p) => p.id === projectId,
          );
        // Journal the actual committed response before any caller can disappear during delivery.
        if (mutation) {
          journal.mutated = true;
          const plan = (
            payload as { plan?: { id?: string; projectId?: string } }
          )?.plan;
          if (plan?.id && plan.projectId === projectId)
            journal.planIds.add(plan.id);
        }
      }
      res.writeHead(response.statusCode, {
        "content-type": "application/json",
      });
      res.end(JSON.stringify(payload));
    })().catch(() => {
      if (!res.headersSent)
        res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          code: "INTERNAL_ERROR",
          message: "Agent gateway request failed.",
        }),
      );
    });
    inFlight.add(task);
    void task.finally(() => inFlight.delete(task));
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      stopping = true;
      const closed = new Promise<void>((resolve) =>
        server.close(() => resolve()),
      );
      // Destroy unfinished input; dispatched service work must settle and journal before terminal state.
      server.closeAllConnections();
      await Promise.all([...inFlight]);
      await closed;
    },
  };
}
