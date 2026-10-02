import type {
  BrowseRoute,
  CodeSnapshot,
  FunctionContextResult,
  FunctionSearchResult,
  Operation,
  PlanDetail,
  Project,
  ProjectSummary,
  SubgraphResult,
  ValidationIssue,
  VerificationReport,
  ViewState,
} from "@codemap/core";
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class HttpApi {
  constructor(private readonly transport: typeof fetch = fetch) {}
  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    text = false,
  ): Promise<T> {
    const transport = this.transport;
    const response = await transport(`/api${path}`, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    if (!response.ok) {
      const error = (await response.json()) as {
        code?: string;
        message?: string;
      };
      throw new ApiError(
        error.code ?? "HTTP_ERROR",
        error.message ?? `HTTP ${response.status}`,
        response.status,
      );
    }
    return (text ? response.text() : response.json()) as Promise<T>;
  }
  projects = () => this.request<Project[]>("/projects");
  open = (path: string) => this.request<Project>("/projects", "POST", { path });
  summary = (id: string) =>
    this.request<ProjectSummary>(`/projects/${encodeURIComponent(id)}/summary`);
  view = (id: string) =>
    this.request<ViewState>(`/projects/${encodeURIComponent(id)}/view`);
  saveView = (id: string, view: ViewState) =>
    this.request<ViewState>(
      `/projects/${encodeURIComponent(id)}/view`,
      "PUT",
      view,
    );
  plans = (id: string) =>
    this.request<PlanDetail[]>(`/projects/${encodeURIComponent(id)}/plans`);
  routes = (id: string) =>
    this.request<BrowseRoute[]>(`/projects/${encodeURIComponent(id)}/routes`);
  graph = (id: string, nodeIds: string[], depth = 1, budget = 80) =>
    this.request<SubgraphResult>(
      `/projects/${encodeURIComponent(id)}/subgraph`,
      "POST",
      { nodeIds, depth, budget, relationTypes: ["calls", "contains"] },
    );
  search = (id: string, q: string, offset = 0) =>
    this.request<FunctionSearchResult>(
      `/projects/${encodeURIComponent(id)}/functions?${new URLSearchParams({ q, offset: String(offset), limit: "50" })}`,
    );
  context = (id: string, nodeId: string, offset = 0) =>
    this.request<FunctionContextResult>(
      `/projects/${encodeURIComponent(id)}/functions/${encodeURIComponent(nodeId)}?offset=${offset}&limit=50`,
    );
  source = (id: string, filePath: string) =>
    this.request<{ filePath: string; content: string }>(
      `/projects/${encodeURIComponent(id)}/source?${new URLSearchParams({ filePath })}`,
    );
  refresh = (id: string) =>
    this.request<CodeSnapshot>(
      `/projects/${encodeURIComponent(id)}/refresh`,
      "POST",
      {},
    );
  createPlan = (projectId: string, title: string, baselineSnapshotId: string) =>
    this.request<PlanDetail>("/plans", "POST", {
      projectId,
      title,
      baselineSnapshotId,
    });
  updatePlan = (
    id: string,
    expectedRevision: number,
    operations: Operation[],
    title: string,
    description: string,
  ) =>
    this.request<PlanDetail>(`/plans/${encodeURIComponent(id)}`, "PUT", {
      expectedRevision,
      operations,
      title,
      description,
    });
  plan = (id: string) =>
    this.request<PlanDetail>(`/plans/${encodeURIComponent(id)}`);
  validate = (id: string) =>
    this.request<ValidationIssue[]>(
      `/plans/${encodeURIComponent(id)}/validate`,
      "POST",
      {},
    );
  approve = (id: string, expectedRevision: number) =>
    this.request<PlanDetail>(
      `/plans/${encodeURIComponent(id)}/approve`,
      "POST",
      { expectedRevision },
    );
  verify = (id: string) =>
    this.request<VerificationReport>(
      `/plans/${encodeURIComponent(id)}/verify`,
      "POST",
      {},
    );
  export = (id: string, format: "json" | "markdown") =>
    this.request<string>(
      `/plans/${encodeURIComponent(id)}/export?format=${format}`,
      "GET",
      undefined,
      true,
    );
}
