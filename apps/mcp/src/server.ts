import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  operationSchema,
  routeSchema,
  type BrowseRoute,
  type PlanDetail,
  type ProjectSummary,
  type Project,
} from "@codemap/core";
import { ApiClient, ApiError, errorValue } from "./client.js";

const id = z.string().min(1);
const title = z
  .string()
  .refine((text) => text.trim().length > 0, "Expected nonempty text");
const project = { projectId: id };
const plan = { ...project, planId: id };
const pagination = {
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  limit: z.number().int().min(1).max(200).optional(),
};
type PageInput = { offset?: number; limit?: number };
function page<T>(items: T[], input: PageInput) {
  const offset = input.offset ?? 0,
    limit = input.limit ?? 50;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
    truncated: offset > 0 || offset + limit < items.length,
  };
}
const pathId = (value: string) => encodeURIComponent(value);
const projectPath = (projectId: string) => `/api/projects/${pathId(projectId)}`;
const planPath = (planId: string) => `/api/plans/${pathId(planId)}`;
function query(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input))
    if (value !== undefined) params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
function content(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value) }];
}

export function createMcpServer(apiUrl: string): McpServer {
  const api = new ApiClient(apiUrl);
  const server = new McpServer({ name: "atlasmode", version: "0.1.0" });
  server.server.onclose = () => api.close();
  function tool<T extends z.ZodRawShape>(
    name: string,
    description: string,
    fields: T,
    run: (args: z.output<z.ZodObject<T>>) => Promise<unknown>,
  ) {
    const schema = z.strictObject(fields);
    server.registerTool<z.ZodRawShape, typeof schema>(
      name,
      { description, inputSchema: schema },
      async (args) => {
        try {
          return { content: content(await run(schema.parse(args))) };
        } catch (error) {
          return { isError: true, content: content(errorValue(error)) };
        }
      },
    );
  }
  async function ownedPlan(
    projectId: string,
    planId: string,
  ): Promise<PlanDetail> {
    const detail = await api.request<PlanDetail>(planPath(planId));
    if (detail.plan.projectId !== projectId)
      throw new ApiError("NOT_FOUND", "Plan not found in this project.", 404);
    return detail;
  }
  const summary = (projectId: string) =>
    api.request<ProjectSummary>(`${projectPath(projectId)}/summary`);

  tool(
    "list_projects",
    "Discover projects already opened in the shared service. Select an explicit projectId for subsequent tools; pagination does not open folders.",
    pagination,
    async (input) => page(await api.request<Project[]>("/api/projects"), input),
  );
  tool(
    "get_project_summary",
    "Read current indexed facts, snapshotId and contentHash. Entrypoints are static exported candidates, not confirmed runtime entrypoints.",
    project,
    ({ projectId }) => summary(projectId),
  );
  tool(
    "search_functions",
    "Search indexed functions/classes with pagination and snapshot identity.",
    { ...project, q: z.string().optional(), ...pagination },
    ({ projectId, ...input }) =>
      api.request(`${projectPath(projectId)}/functions${query(input)}`),
  );
  tool(
    "get_function_context",
    "Read incoming/outgoing calls, source evidence and unresolved/external reasons. Each direction is separately paged with the same offset/limit.",
    { ...project, nodeId: id, ...pagination },
    ({ projectId, nodeId, ...input }) =>
      api.request(
        `${projectPath(projectId)}/functions/${pathId(nodeId)}${query(input)}`,
      ),
  );
  tool(
    "get_subgraph",
    "Read a bounded indexed subgraph. truncated means a node or relation budget clipped results; unresolved calls remain uncertain.",
    {
      ...project,
      nodeIds: z.array(id).min(1),
      depth: z.number().int().min(0).max(5).optional(),
      budget: z.number().int().min(1).max(300).optional(),
      relationTypes: z
        .array(z.enum(["calls", "imports", "contains"]))
        .min(1)
        .optional(),
    },
    ({ projectId, ...input }) =>
      api.request(`${projectPath(projectId)}/subgraph`, "POST", input),
  );

  const routeInput = routeSchema.omit({
    id: true,
    projectId: true,
    revision: true,
    createdAt: true,
    source: true,
  });
  tool(
    "propose_route",
    "Submit a validated new route to the shared UI. source is server-bound to agent; call_chain requires actual resolved call evidence.",
    { ...project, ...routeInput.shape },
    ({ projectId, ...input }) =>
      api.request(`${projectPath(projectId)}/routes`, "POST", {
        ...input,
        source: "agent",
      }),
  );
  tool(
    "get_routes",
    "List routes with pagination and a stale flag comparing each route baseline to the current indexed snapshot.",
    { ...project, ...pagination },
    async ({ projectId, ...input }) => {
      const current = await summary(projectId);
      const routes = await api.request<BrowseRoute[]>(
        `${projectPath(projectId)}/routes`,
      );
      return {
        ...page(
          routes.map((route) => ({
            ...route,
            stale: route.snapshotId !== current.snapshotId,
          })),
          input,
        ),
        snapshotId: current.snapshotId,
      };
    },
  );

  tool(
    "propose_plan",
    "Create a draft against an explicit snapshotId from a prior query. Nonempty operations use a second HTTP update (revision 2); this is not atomic. Failure after creation returns createdPlanId and createdRevision for recovery. Only the user can approve in the UI/API.",
    {
      ...project,
      title,
      description: z.string().optional(),
      baselineSnapshotId: id,
      operations: z.array(operationSchema),
    },
    async ({ operations, ...input }) => {
      const created = await api.request<PlanDetail>(
        "/api/plans",
        "POST",
        input,
      );
      if (operations.length === 0) return created;
      try {
        return await api.request<PlanDetail>(planPath(created.plan.id), "PUT", {
          expectedRevision: created.plan.revision,
          operations,
        });
      } catch (error) {
        // Preserve the real HTTP error and expose the committed first step; do not retry or overwrite a concurrent edit.
        const details = errorValue(error);
        throw new ApiError(
          String(details.code),
          String(details.message),
          details.status as number | undefined,
          details.issues,
          {
            createdPlanId: created.plan.id,
            createdRevision: created.plan.revision,
          },
        );
      }
    },
  );
  tool(
    "update_plan",
    "Edit the current draft using expectedRevision. Semantic edits invalidate prior approval; revision conflicts must be reread, not overwritten.",
    {
      ...plan,
      expectedRevision: z.number().int().positive(),
      operations: z.array(operationSchema),
      title: title.optional(),
      description: z.string().optional(),
    },
    async ({ projectId, planId, ...input }) => {
      await ownedPlan(projectId, planId);
      return api.request(planPath(planId), "PUT", input);
    },
  );
  tool(
    "validate_plan",
    "Validate the current plan against the latest indexed facts and directory policies; this does not approve it or refresh disk.",
    plan,
    async ({ projectId, planId }) => {
      await ownedPlan(projectId, planId);
      return api.request(`${planPath(planId)}/validate`, "POST", {});
    },
  );
  tool(
    "get_approved_plan",
    "Refresh actual source files, then read current plan/revision/approval/validity. Implement only when valid is true and approval revision/hash match the current plan. A historical approval on a newer draft is not authorization.",
    plan,
    async ({ projectId, planId }) => {
      await ownedPlan(projectId, planId);
      await api.request(`${projectPath(projectId)}/refresh`, "POST", {});
      return ownedPlan(projectId, planId);
    },
  );
  tool(
    "refresh_index",
    "Reindex actual source files and return bounded summary metadata. This can mark existing plans and routes stale; it never changes target source files.",
    project,
    async ({ projectId }) => {
      await api.request(`${projectPath(projectId)}/refresh`, "POST", {});
      return summary(projectId);
    },
  );
  tool(
    "verify_implementation",
    "Refresh source and verify the latest actually approved historical revision. Reports satisfied/unmet/unknown with evidence; never treats an unapproved draft as approved.",
    plan,
    async ({ projectId, planId }) => {
      await ownedPlan(projectId, planId);
      return api.request(`${planPath(planId)}/verify`, "POST", {});
    },
  );

  tool(
    "propose_group",
    "Create a new validated agent group in the shared UI. No id/source input: existing user groups cannot be overwritten through this tool.",
    { ...project, title, description: z.string(), memberIds: z.array(id) },
    ({ projectId, ...input }) =>
      api.request(`${projectPath(projectId)}/groups`, "POST", {
        ...input,
        source: "agent",
      }),
  );
  tool(
    "get_groups",
    "Read shared function groups with pagination and the current indexed snapshot identity.",
    { ...project, ...pagination },
    async ({ projectId, ...input }) => ({
      ...page(
        await api.request<unknown[]>(`${projectPath(projectId)}/groups`),
        input,
      ),
      snapshotId: (await summary(projectId)).snapshotId,
    }),
  );
  tool(
    "get_folder_policies",
    "Read shared directory placement/dependency policies with pagination and current indexed snapshot identity.",
    { ...project, ...pagination },
    async ({ projectId, ...input }) => ({
      ...page(
        await api.request<unknown[]>(`${projectPath(projectId)}/policies`),
        input,
      ),
      snapshotId: (await summary(projectId)).snapshotId,
    }),
  );
  return server;
}
