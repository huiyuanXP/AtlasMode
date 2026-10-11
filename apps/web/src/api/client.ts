import { requestLayoutTarget } from "./layout-target-client.js";
import type {
  AnnotationDetail,
  AnnotationPage,
  AnnotationHistoryPage,
  AnnotationListInput,
  AnnotationHistoryInput,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  BindAnnotationInput,
  DeleteAnnotationResult,
  BrowseRoute,
  CodeNode,
  FunctionGroup,
  DirectoryPolicy,
  CodeSnapshot,
  FunctionContextResult,
  FileContextResult,
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
  layoutTarget = (
    id: string,
    expectedSnapshotId: string,
    signal?: AbortSignal,
  ) => requestLayoutTarget(this.transport, id, expectedSnapshotId, signal);
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
  groups = (id: string) =>
    this.request<FunctionGroup[]>(`/projects/${encodeURIComponent(id)}/groups`);
  policies = (id: string) =>
    this.request<DirectoryPolicy[]>(
      `/projects/${encodeURIComponent(id)}/policies`,
    );
  saveGroup = (
    id: string,
    input: Omit<FunctionGroup, "id" | "projectId"> & { id?: string },
  ) =>
    this.request<FunctionGroup>(
      `/projects/${encodeURIComponent(id)}/groups`,
      "POST",
      input,
    );
  savePolicy = (
    id: string,
    input:
      | Omit<DirectoryPolicy, "projectId">
      | Omit<DirectoryPolicy, "id" | "projectId">,
  ) =>
    this.request<DirectoryPolicy>(
      `/projects/${encodeURIComponent(id)}/policies`,
      "POST",
      input,
    );
  graph = (
    id: string,
    nodeIds: string[],
    depth = 1,
    budget = 80,
    relationIds?: string[],
  ) =>
    this.request<SubgraphResult>(
      `/projects/${encodeURIComponent(id)}/subgraph`,
      "POST",
      {
        nodeIds,
        depth,
        budget,
        relationTypes: relationIds?.length
          ? ["calls", "contains", "imports"]
          : ["calls", "contains"],
        ...(relationIds?.length ? { relationIds } : {}),
      },
    );
  dependencies = (id: string, nodeId: string, budget = 80) =>
    this.request<SubgraphResult & { unknownCount: number }>(
      `/projects/${encodeURIComponent(id)}/dependencies`,
      "POST",
      { nodeId, budget },
    );
  scope = (
    id: string,
    path: string,
    kind: "folder" | "file",
    budget = 80,
    snapshotId?: string,
    allowMissing = false,
  ) =>
    this.request<
      SubgraphResult & {
        root?: CodeNode;
        path: string;
        kind: "folder" | "file";
        missing?: boolean;
      }
    >(`/projects/${encodeURIComponent(id)}/scope`, "POST", {
      path,
      kind,
      budget,
      ...(snapshotId ? { snapshotId } : {}),
      ...(allowMissing ? { allowMissing: true } : {}),
    });
  search = (id: string, q: string, offset = 0) =>
    this.request<FunctionSearchResult>(
      `/projects/${encodeURIComponent(id)}/functions?${new URLSearchParams({ q, offset: String(offset), limit: "50" })}`,
    );
  context = (id: string, nodeId: string, offset = 0, limit = 50) =>
    this.request<FunctionContextResult>(
      `/projects/${encodeURIComponent(id)}/functions/${encodeURIComponent(nodeId)}?offset=${offset}&limit=${limit}`,
    );
  fileContext = (id: string, nodeId: string, offset = 0, limit = 50) =>
    this.request<FileContextResult>(
      `/projects/${encodeURIComponent(id)}/files/${encodeURIComponent(nodeId)}/context?offset=${offset}&limit=${limit}`,
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
    expectedSnapshotId?: string,
  ) =>
    this.request<PlanDetail>(`/plans/${encodeURIComponent(id)}`, "PUT", {
      expectedRevision,
      ...(expectedSnapshotId === undefined ? {} : { expectedSnapshotId }),
      operations,
      title,
      description,
    });
  updateOwnershipPlan = async (input: {
    planId: string;
    expectedRevision: number;
    expectedSnapshotId: string;
    operations: Operation[];
    title: string;
    description: string;
  }) => {
    if (
      typeof input.expectedSnapshotId !== "string" ||
      !input.expectedSnapshotId.trim()
    )
      throw new ApiError(
        "INVALID_INPUT",
        "A captured snapshot is required for an ownership edit.",
        400,
      );
    return this.updatePlan(
      input.planId,
      input.expectedRevision,
      input.operations,
      input.title,
      input.description,
      input.expectedSnapshotId,
    );
  };
  currentApproval = (id: string) =>
    this.request<PlanDetail>(`/plans/${encodeURIComponent(id)}/approved`);
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
  snapshot = (id: string) =>
    this.request<CodeSnapshot>(`/projects/${encodeURIComponent(id)}/snapshot`);
  annotations = (id: string, input: AnnotationListInput = {}) => {
    const query = new URLSearchParams(
      Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    return this.request<AnnotationPage>(
      `/projects/${encodeURIComponent(id)}/annotations?${query}`,
    );
  };
  annotation = (id: string, annotationId: string) =>
    this.request<AnnotationDetail>(
      `/projects/${encodeURIComponent(id)}/annotations/${encodeURIComponent(annotationId)}`,
    );
  annotationHistory = (
    id: string,
    annotationId: string,
    input: AnnotationHistoryInput = {},
  ) => {
    const query = new URLSearchParams(
      Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    return this.request<AnnotationHistoryPage>(
      `/projects/${encodeURIComponent(id)}/annotations/${encodeURIComponent(annotationId)}/history?${query}`,
    );
  };
  createAnnotation = (id: string, input: CreateAnnotationInput) =>
    this.request<AnnotationDetail>(
      `/projects/${encodeURIComponent(id)}/annotations`,
      "POST",
      input,
    );
  updateAnnotation = (
    id: string,
    annotationId: string,
    input: UpdateAnnotationInput,
  ) =>
    this.request<AnnotationDetail>(
      `/projects/${encodeURIComponent(id)}/annotations/${encodeURIComponent(annotationId)}`,
      "PUT",
      input,
    );
  bindAnnotation = (
    id: string,
    annotationId: string,
    input: BindAnnotationInput,
  ) =>
    this.request<AnnotationDetail>(
      `/projects/${encodeURIComponent(id)}/annotations/${encodeURIComponent(annotationId)}/binding`,
      "PUT",
      input,
    );
  deleteAnnotation = (
    id: string,
    annotationId: string,
    input: { expectedRevision: number },
  ) =>
    this.request<DeleteAnnotationResult>(
      `/projects/${encodeURIComponent(id)}/annotations/${encodeURIComponent(annotationId)}`,
      "DELETE",
      input,
    );
}
