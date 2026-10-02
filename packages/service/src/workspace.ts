import { basename, resolve } from "node:path";
import {
  DomainError,
  makeId,
  normalizeRepoPath,
  snapshotSchema,
  type BrowseRoute,
  type CodeSnapshot,
  type DirectoryPolicy,
  type FunctionGroup,
  type IndexerPort,
  type Operation,
  type PlanDetail,
  type Project,
  type StoragePort,
  type VerificationReport,
  type ViewState,
} from "@codemap/core";
import { Planning } from "./planning.js";
import { Knowledge } from "./knowledge.js";
import { verify } from "./verification.js";

export class WorkspaceService {
  private readonly storage: StoragePort;
  private readonly indexer: IndexerPort;
  private readonly planning: Planning;
  private readonly knowledge: Knowledge;
  private readonly refreshes = new Map<string, Promise<unknown>>();
  constructor({
    storage,
    indexer,
  }: {
    storage: StoragePort;
    indexer: IndexerPort;
  }) {
    this.storage = storage;
    this.indexer = indexer;
    this.knowledge = new Knowledge(storage, (id) => this.getSnapshot(id));
    this.planning = new Planning(
      storage,
      (id) => this.getSnapshot(id),
      (id) => this.listPolicies(id),
    );
  }
  listProjects(): Project[] {
    return this.storage.list<Project>("projects");
  }
  getProject(id: string): Project {
    const project = this.storage.get<Project>("projects", id);
    if (!project) throw new DomainError("NOT_FOUND", "Project not found.");
    return project;
  }
  async openProject(path: string): Promise<Project> {
    if (typeof path !== "string" || !path.trim() || path.includes("\0"))
      throw new DomainError(
        "INVALID_INPUT",
        "Expected a project directory path.",
      );
    const absolutePath = resolve(path),
      id = makeId("project", absolutePath);
    const project = this.storage.get<Project>("projects", id) ?? {
      id,
      path: absolutePath,
      name: basename(absolutePath) || absolutePath,
    };
    await this.enqueue(id, async () => {
      const snapshot = await this.indexer.index(project.path, id);
      this.storeSnapshot(project, snapshot);
    });
    return this.getProject(id);
  }
  getSnapshot(projectId: string): CodeSnapshot {
    const project = this.getProject(projectId);
    const snapshot = project.snapshotId
      ? this.storage.get<CodeSnapshot>("snapshots", project.snapshotId)
      : undefined;
    if (!snapshot || snapshot.projectId !== projectId)
      throw new DomainError("NOT_FOUND", "Project snapshot not found.");
    return snapshot;
  }
  refreshIndex(projectId: string): Promise<CodeSnapshot> {
    return this.enqueue(projectId, async () => {
      const project = this.getProject(projectId);
      const snapshot = await this.indexer.index(project.path, projectId);
      return this.storeSnapshot(project, snapshot);
    });
  }
  createPlan(input: {
    projectId: string;
    title: string;
    description?: string;
    baselineSnapshotId?: string;
  }): PlanDetail {
    return this.planning.create(input);
  }
  listPlans(projectId: string): PlanDetail[] {
    return this.planning.list(projectId);
  }
  getPlan(id: string): PlanDetail {
    return this.planning.get(id);
  }
  updatePlan(
    id: string,
    input: {
      expectedRevision: number;
      operations: Operation[];
      title?: string;
      description?: string;
    },
  ): PlanDetail {
    return this.planning.update(id, input);
  }
  async approvePlan(id: string, expectedRevision: number): Promise<PlanDetail> {
    await this.refreshIndex(this.planning.raw(id).projectId);
    return this.planning.approve(id, expectedRevision);
  }
  async verifyPlan(id: string): Promise<VerificationReport> {
    const projectId = this.planning.raw(id).projectId;
    await this.refreshIndex(projectId);
    const approved = this.planning.latest(id);
    if (!approved)
      throw new DomainError(
        "NOT_APPROVED",
        "Plan has no approved revision to verify.",
      );
    const baseline = this.storage.get<CodeSnapshot>(
      "snapshots",
      approved.plan.baselineSnapshotId,
    );
    if (!baseline || baseline.projectId !== projectId)
      throw new DomainError(
        "NOT_FOUND",
        "Approved baseline snapshot not found.",
      );
    return verify(approved.plan, baseline, this.getSnapshot(projectId));
  }
  exportPlan(id: string, format: "json" | "markdown"): string {
    return this.planning.export(id, format);
  }
  listRoutes(projectId: string): BrowseRoute[] {
    return this.knowledge.routes(projectId);
  }
  createRoute(
    input: Omit<BrowseRoute, "id" | "revision" | "createdAt">,
  ): BrowseRoute {
    return this.knowledge.createRoute(input);
  }
  getView(projectId: string): ViewState {
    return this.knowledge.view(projectId);
  }
  saveView(projectId: string, view: ViewState): ViewState {
    return this.knowledge.saveView(projectId, view);
  }
  listGroups(projectId: string): FunctionGroup[] {
    return this.knowledge.groups(projectId);
  }
  saveGroup(input: Omit<FunctionGroup, "id"> & { id?: string }): FunctionGroup {
    return this.knowledge.saveGroup(input);
  }
  listPolicies(projectId: string): DirectoryPolicy[] {
    return this.knowledge.policies(projectId);
  }
  savePolicy(
    input: Omit<DirectoryPolicy, "id"> & { id?: string },
  ): DirectoryPolicy {
    return this.knowledge.savePolicy(input);
  }
  async readSource(
    projectId: string,
    filePath: string,
  ): Promise<{ filePath: string; content: string }> {
    const project = this.getProject(projectId);
    if (!this.indexer.readSource)
      throw new DomainError(
        "SOURCE_UNAVAILABLE",
        "The configured indexer does not support safe source reading.",
      );
    return this.indexer.readSource(project.path, normalizeRepoPath(filePath));
  }
  private storeSnapshot(project: Project, value: CodeSnapshot): CodeSnapshot {
    const parsed = snapshotSchema.safeParse(value);
    if (!parsed.success || value.projectId !== project.id)
      throw new DomainError(
        "INVALID_SNAPSHOT",
        "Indexer returned an invalid project snapshot.",
      );
    return this.storage.transaction(() => {
      const existing = this.storage.get<CodeSnapshot>("snapshots", value.id);
      if (
        existing &&
        (existing.projectId !== project.id ||
          existing.contentHash !== value.contentHash)
      )
        throw new DomainError(
          "INVALID_SNAPSHOT",
          "Snapshot identity collision.",
        );
      if (!existing) this.storage.put("snapshots", value.id, parsed.data);
      this.storage.put("projects", project.id, {
        ...project,
        snapshotId: value.id,
      });
      return existing ?? parsed.data;
    });
  }
  private enqueue<T>(projectId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.refreshes.get(projectId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    this.refreshes.set(projectId, next);
    void next
      .finally(() => {
        if (this.refreshes.get(projectId) === next)
          this.refreshes.delete(projectId);
      })
      .catch(() => {});
    return next;
  }
}
