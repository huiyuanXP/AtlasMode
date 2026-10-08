import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { operationSchema, routeSchema } from "@codemap/core";
import type { WorkspaceService } from "@codemap/service";
import { projectQueries } from "./queries.js";

const id = z.string().min(1);
const nonblank = z
  .string()
  .refine((s) => s.trim().length > 0, "Expected nonempty text");
const empty = z.strictObject({});
const projectParams = z.strictObject({ id });
const functionParams = z.strictObject({ id, nodeId: id });
const queryInteger = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const page = {
  offset: queryInteger(0, Number.MAX_SAFE_INTEGER).optional(),
  limit: queryInteger(1, 200).optional(),
};
const searchQuery = z.strictObject({ q: z.string().optional(), ...page });
const contextQuery = z.strictObject(page);
const graphBody = z
  .strictObject({
    nodeIds: z.array(id),
    relationIds: z.array(id).max(300).optional(),
    depth: z.number().int().min(0).max(5).optional(),
    budget: z.number().int().min(1).max(300).optional(),
    relationTypes: z
      .array(z.enum(["calls", "imports", "contains"]))
      .min(1)
      .optional(),
  })
  .refine(
    (body) => body.nodeIds.length > 0 || !!body.relationIds?.length,
    "Expected at least one node or relation anchor",
  );
const dependencyBody = z.strictObject({
  nodeId: id,
  budget: z.number().int().min(1).max(300).optional(),
});
const scopeBody = z.strictObject({
  path: z.string().min(1),
  kind: z.enum(["folder", "file"]),
  budget: z.number().int().min(1).max(300).optional(),
  snapshotId: id.optional(),
  allowMissing: z.boolean().optional(),
});
const createPlan = z.strictObject({
  projectId: id,
  title: nonblank,
  description: z.string().optional(),
  baselineSnapshotId: id.optional(),
});
const updatePlan = z.strictObject({
  expectedRevision: z.number().int().positive(),
  operations: z.array(operationSchema),
  title: nonblank.optional(),
  description: z.string().optional(),
});
const group = z.strictObject({
  id: id.optional(),
  title: nonblank,
  description: z.string(),
  source: z.enum(["agent", "user"]),
  memberIds: z.array(id),
});
const policy = z.strictObject({
  id: id.optional(),
  pathPrefix: z.string(),
  purpose: z.string(),
  forbiddenDependencies: z.array(z.string()),
});
const view = z.strictObject({
  positions: z.record(id, z.strictObject({ x: z.number(), y: z.number() })),
  theme: z.enum(["light", "dark"]),
  locale: z.enum(["zh", "en"]),
});
const createRoute = routeSchema.omit({
  id: true,
  projectId: true,
  revision: true,
  createdAt: true,
});

export function registerRoutes(
  app: FastifyInstance,
  service: WorkspaceService,
): void {
  const queries = projectQueries(service);
  function get(
    path: string,
    handler: (request: FastifyRequest, reply: FastifyReply) => unknown,
    query: z.ZodType = empty,
    params: z.ZodType = projectParams,
  ) {
    app.get(path, async (request, reply) => {
      params.parse(request.params);
      query.parse(request.query);
      return handler(request, reply);
    });
  }
  function write(
    method: "POST" | "PUT",
    path: string,
    body: z.ZodType,
    handler: (request: FastifyRequest, reply: FastifyReply) => unknown,
    params: z.ZodType = projectParams,
  ) {
    app.route({
      method,
      url: path,
      handler: async (request, reply) => {
        params.parse(request.params);
        empty.parse(request.query);
        request.body = body.parse(request.body);
        return handler(request, reply);
      },
    });
  }
  const projectId = (request: FastifyRequest) =>
    projectParams.parse(request.params).id;
  get("/api/health", () => ({ status: "ok" }), empty, empty);
  get("/api/projects", () => service.listProjects(), empty, empty);
  write(
    "POST",
    "/api/projects",
    z.strictObject({ path: nonblank }),
    (request) =>
      service.openProject(
        z.strictObject({ path: nonblank }).parse(request.body).path,
      ),
    empty,
  );
  get("/api/projects/:id/snapshot", (request) =>
    service.getSnapshot(projectId(request)),
  );
  write("POST", "/api/projects/:id/refresh", empty.optional(), (request) =>
    service.refreshIndex(projectId(request)),
  );
  get("/api/projects/:id/summary", (request) =>
    queries.summary(projectId(request)),
  );
  get(
    "/api/projects/:id/functions",
    (request) =>
      queries.functions(projectId(request), searchQuery.parse(request.query)),
    searchQuery,
  );
  get(
    "/api/projects/:id/functions/:nodeId",
    (request) => {
      const { id, nodeId } = functionParams.parse(request.params);
      return queries.context(id, nodeId, contextQuery.parse(request.query));
    },
    contextQuery,
    functionParams,
  );
  write("POST", "/api/projects/:id/scope", scopeBody, (request) =>
    queries.scope(projectId(request), scopeBody.parse(request.body)),
  );
  write("POST", "/api/projects/:id/dependencies", dependencyBody, (request) =>
    queries.dependencies(
      projectId(request),
      dependencyBody.parse(request.body),
    ),
  );
  write("POST", "/api/projects/:id/subgraph", graphBody, (request) =>
    queries.subgraph(projectId(request), graphBody.parse(request.body)),
  );
  const sourceQuery = z.strictObject({ filePath: nonblank });
  get(
    "/api/projects/:id/source",
    (request) =>
      service.readSource(
        projectId(request),
        sourceQuery.parse(request.query).filePath,
      ),
    sourceQuery,
  );
  get("/api/projects/:id/plans", (request) =>
    service.listPlans(projectId(request)),
  );
  write(
    "POST",
    "/api/plans",
    createPlan,
    (request) => service.createPlan(createPlan.parse(request.body)),
    empty,
  );
  get("/api/plans/:id", (request) => service.getPlan(projectId(request)));
  write("PUT", "/api/plans/:id", updatePlan, (request) =>
    service.updatePlan(projectId(request), updatePlan.parse(request.body)),
  );
  write(
    "POST",
    "/api/plans/:id/validate",
    empty.optional(),
    (request) => service.getPlan(projectId(request)).issues,
  );
  const approval = z.strictObject({
    expectedRevision: z.number().int().positive(),
  });
  write("POST", "/api/plans/:id/approve", approval, (request) =>
    service.approvePlan(
      projectId(request),
      approval.parse(request.body).expectedRevision,
    ),
  );
  write("POST", "/api/plans/:id/verify", empty.optional(), (request) =>
    service.verifyPlan(projectId(request)),
  );
  const exportQuery = z.strictObject({ format: z.enum(["json", "markdown"]) });
  get(
    "/api/plans/:id/export",
    (request, reply) => {
      const { format } = exportQuery.parse(request.query);
      return reply
        .type(
          format === "json"
            ? "application/json; charset=utf-8"
            : "text/markdown; charset=utf-8",
        )
        .send(service.exportPlan(projectId(request), format));
    },
    exportQuery,
  );
  get("/api/projects/:id/routes", (request) =>
    service.listRoutes(projectId(request)),
  );
  write("POST", "/api/projects/:id/routes", createRoute, (request) =>
    service.createRoute({
      ...createRoute.parse(request.body),
      projectId: projectId(request),
    }),
  );
  get("/api/projects/:id/view", (request) =>
    service.getView(projectId(request)),
  );
  write("PUT", "/api/projects/:id/view", view, (request) =>
    service.saveView(projectId(request), view.parse(request.body)),
  );
  get("/api/projects/:id/groups", (request) =>
    service.listGroups(projectId(request)),
  );
  write("POST", "/api/projects/:id/groups", group, (request) =>
    service.saveGroup({
      ...group.parse(request.body),
      projectId: projectId(request),
    }),
  );
  get("/api/projects/:id/policies", (request) =>
    service.listPolicies(projectId(request)),
  );
  write("POST", "/api/projects/:id/policies", policy, (request) =>
    service.savePolicy({
      ...policy.parse(request.body),
      projectId: projectId(request),
    }),
  );
}
