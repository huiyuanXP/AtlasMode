import { basename, resolve } from "node:path";
import {
  DomainError,
  makeId,
  normalizeRepoPath,
  snapshotSchema,
  StructureError,
  parseStructure,
  canonicalLegacyPolicy,
  normalizeStructurePath,
  projectStructurePolicies,
  structureLegacyPolicies,
  type AnnotationDetail,
  type AnnotationPage,
  type AnnotationHistoryPage,
  type AnnotationListInput,
  type AnnotationHistoryInput,
  type CreateAnnotationInput,
  type UpdateAnnotationInput,
  type BindAnnotationInput,
  type DeleteAnnotationResult,
  type StructureFilePort,
  type StructureState,
  type StructureWriteInput,
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
import { StructureSync } from "./structure-sync.js";
import type { StructureIntent } from "./structure-state.js";
import { inputKeys, Planning } from "./planning.js";
import { Knowledge } from "./knowledge.js";
import { verify } from "./verification.js";
import { Annotations } from "./annotations.js";
import { AnnotationReviewService } from "./annotation-review-service.js";

export class WorkspaceService {
  private readonly storage: StoragePort;
  private readonly indexer: IndexerPort;
  private readonly planning: Planning;
  private readonly knowledge: Knowledge;
  private readonly structures: StructureSync;
  private readonly annotations: Annotations;
  private readonly opening = new Map<string, Project>();
  private identityWrites: Promise<unknown> = Promise.resolve();
  constructor({
    storage,
    indexer,
    structureFiles,
  }: {
    storage: StoragePort;
    indexer: IndexerPort;
    structureFiles: StructureFilePort;
  }) {
    this.storage = storage;
    this.indexer = indexer;
    this.knowledge = new Knowledge(storage, (id) => this.getSnapshot(id));
    this.annotations = new Annotations(
      storage,
      (id) => this.getProject(id),
      (id) => this.getSnapshot(id),
    );
    this.structures = new StructureSync({
      storage,
      files: structureFiles,
      project: (id) =>
        this.storage.get<Project>("projects", id) ??
        this.opening.get(id) ??
        this.getProject(id),
      legacyPolicies: (id) => this.knowledge.policies(id),
      identityMutation: (id, input, work) =>
        this.withPolicyIdentityMutation(id, input, work),
      validateOwnership: (id, document) => {
        for (const policy of structureLegacyPolicies(document))
          this.checkPolicyOwner(id, policy.id);
      },
    });
    this.planning = new Planning(
      storage,
      (id) => this.getSnapshot(id),
      (id) => this.listPolicies(id),
      new AnnotationReviewService(
        storage,
        (id) => this.getSnapshot(id),
        this.annotations,
      ),
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
    this.opening.set(id, project);
    try {
      await this.structures.withProject(id, async (session) => {
        const current = this.storage.get<Project>("projects", id) ?? project;
        const snapshot = await this.indexer.index(current.path, id);
        this.storeSnapshot(current, snapshot);
        try {
          await session.readStructure();
        } catch (error) {
          if (!(error instanceof StructureError)) throw error;
        }
      });
    } finally {
      this.opening.delete(id);
    }
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
    return this.withStructure(
      projectId,
      () => this.getSnapshot(projectId),
      true,
    );
  }
  private async refreshIndexLocked(projectId: string): Promise<CodeSnapshot> {
    const project = this.getProject(projectId);
    return this.storeSnapshot(
      project,
      await this.indexer.index(project.path, projectId),
    );
  }
  private withStructure<T>(
    projectId: string,
    work: () => T,
    refresh = false,
  ): Promise<T> {
    return this.structures.withProject(projectId, async (session) => {
      if (refresh) await this.refreshIndexLocked(projectId);
      const state = await session.readStructure();
      this.checkDocumentOwners(state);
      return work();
    });
  }
  getStructure(
    projectId: string,
    options: { acceptExternalConflict?: boolean } = {},
  ): Promise<StructureState> {
    return this.structures.getStructure(projectId, options);
  }
  updateStructure(
    projectId: string,
    input: StructureWriteInput,
  ): Promise<StructureState> {
    if (input?.operation?.kind === "upsertLegacyPolicy" && input.operation.id)
      this.checkPolicyOwner(projectId, input.operation.id);
    return this.structures.updateStructure(projectId, input);
  }
  recoverStructureWrites() {
    return this.structures.recoverStructureWrites();
  }
  listStructureAudit(
    projectId: string,
    page: { offset: number; limit: number },
  ) {
    return this.structures.listStructureAudit(projectId, page);
  }
  legacyPreview(projectId: string) {
    return this.structures.withProject(projectId, async (session) => {
      const state = await session.readStructure();
      this.checkDocumentOwners(state);
      return {
        policies: this.knowledge.policies(projectId),
        structureRevision: state.structureRevision,
        fileDigest: state.fileDigest,
        verifiedAt: state.verifiedAt,
      };
    });
  }
  readPolicies(projectId: string) {
    return this.structures.withProject(projectId, async (session) => {
      const state = await session.readStructure();
      this.checkDocumentOwners(state);
      return {
        policies: this.listPolicies(projectId),
        structureRevision: state.structureRevision,
        fileDigest: state.fileDigest,
        verifiedAt: state.verifiedAt,
        status: state.status,
      };
    });
  }
  readPlan(id: string) {
    return this.withStructure(this.planning.raw(id).projectId, () =>
      this.getPlan(id),
    );
  }
  readPlans(projectId: string) {
    return this.withStructure(projectId, () => this.listPlans(projectId));
  }
  createPlanFresh(input: Parameters<WorkspaceService["createPlan"]>[0]) {
    return this.withStructure(input.projectId, () => this.createPlan(input));
  }
  updatePlanFresh(
    id: string,
    input: Parameters<WorkspaceService["updatePlan"]>[1],
  ) {
    return this.withStructure(this.planning.raw(id).projectId, () =>
      this.updatePlan(id, input),
    );
  }
  getCurrentApproval(id: string): Promise<PlanDetail> {
    return this.withStructure(
      this.planning.raw(id).projectId,
      () => this.planning.getCurrentApproval(id),
      true,
    );
  }
  private withPolicyIdentityMutation(
    projectId: string,
    input: StructureWriteInput,
    work: () => Promise<StructureState>,
  ): Promise<StructureState> {
    if (input.operation.kind === "upsertFolder") return work();
    // Acquire at execution, never while waiting for a project queue. Reads
    // and folder edits keep independent progress. Durable candidates continue
    // reserving identities if publication or recovery remains unknown.
    const next = this.identityWrites
      .catch(() => {})
      .then(() => {
        if (input.operation.kind === "upsertLegacyPolicy" && input.operation.id)
          this.checkPolicyOwner(projectId, input.operation.id);
        if (input.operation.kind === "importLegacy")
          for (const policy of this.knowledge.policies(projectId))
            this.checkPolicyOwner(projectId, policy.id);
        return work();
      });
    this.identityWrites = next.then(
      () => {},
      () => {},
    );
    return next;
  }
  private checkDocumentOwners(state: StructureState): void {
    if (state.document)
      for (const policy of structureLegacyPolicies(state.document))
        this.checkPolicyOwner(state.projectId, policy.id);
  }
  private checkPolicyOwner(projectId: string, id: string): void {
    const db = this.storage.get<DirectoryPolicy>("policies", id);
    if (db && db.projectId !== projectId)
      throw new DomainError(
        "PROJECT_MISMATCH",
        "Policy belongs to another project.",
      );
    for (const pending of this.storage.list<Partial<StructureIntent>>(
      "settings",
    )) {
      if (
        pending.recordType !== "structure_intent" ||
        !pending.pending ||
        pending.projectId === projectId
      )
        continue;
      let candidate;
      try {
        if (typeof pending.candidateBytes !== "string")
          throw new Error("missing-candidate");
        candidate = parseStructure(
          Buffer.from(pending.candidateBytes, "base64").toString("utf8"),
        );
      } catch {
        throw new StructureError(
          "STRUCTURE_RECOVERY_PENDING",
          "Pending structure identity ownership cannot be verified.",
        );
      }
      if (structureLegacyPolicies(candidate).some((policy) => policy.id === id))
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "Policy identity is reserved by another project pending structure publication.",
        );
    }
    for (const state of this.storage.list<Partial<StructureState>>(
      "settings",
    )) {
      if (
        !state.projectId ||
        state.projectId === projectId ||
        !Number.isSafeInteger(state.structureRevision)
      )
        continue;
      const document = state.document ?? state.lastGood?.document;
      if (
        document &&
        projectStructurePolicies(document, state.projectId).some(
          (policy) => policy.id === id,
        )
      )
        throw new DomainError(
          "PROJECT_MISMATCH",
          "Policy belongs to another project.",
        );
    }
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
      expectedSnapshotId?: string;
      operations: Operation[];
      title?: string;
      description?: string;
    },
  ): PlanDetail {
    return this.planning.update(id, input);
  }
  approvePlan(id: string, expectedRevision: number): Promise<PlanDetail> {
    return this.withStructure(
      this.planning.raw(id).projectId,
      () => this.planning.approve(id, expectedRevision),
      true,
    );
  }
  verifyPlan(id: string): Promise<VerificationReport> {
    const projectId = this.planning.raw(id).projectId;
    return this.withStructure(
      projectId,
      () => this.verifyLocked(id, projectId),
      true,
    );
  }
  private verifyLocked(id: string, projectId: string): VerificationReport {
    const approved = this.planning.approvedForVerification(id);
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
  exportPlanFresh(id: string, format: "json" | "markdown"): Promise<string> {
    return this.withStructure(this.planning.raw(id).projectId, () =>
      this.exportPlan(id, format),
    );
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
    this.getSnapshot(projectId);
    return this.structures.policies(projectId);
  }
  async savePolicy(
    input: Omit<DirectoryPolicy, "id"> & {
      id?: string;
      mutationId?: string;
      expectedStructureRevision?: number;
      expectedFileDigest?: string | null;
    },
  ): Promise<DirectoryPolicy> {
    inputKeys(input, [
      "id",
      "projectId",
      "pathPrefix",
      "purpose",
      "forbiddenDependencies",
      "mutationId",
      "expectedStructureRevision",
      "expectedFileDigest",
    ]);
    if (
      !input.mutationId ||
      input.expectedStructureRevision === undefined ||
      input.expectedFileDigest === undefined
    )
      throw new DomainError(
        "STRUCTURE_PRECONDITION_REQUIRED",
        "Supply the structure revision and file digest from an explicit read before saving.",
      );
    this.getSnapshot(input.projectId);
    if (
      typeof input.pathPrefix !== "string" ||
      typeof input.purpose !== "string" ||
      !Array.isArray(input.forbiddenDependencies) ||
      input.forbiddenDependencies.some((value) => typeof value !== "string")
    )
      throw new DomainError("INVALID_INPUT", "Invalid directory policy.");
    try {
      normalizeStructurePath(input.pathPrefix);
      for (const value of input.forbiddenDependencies)
        if (!normalizeStructurePath(value))
          throw new DomainError(
            "INVALID_INPUT",
            "Forbidden target prefix cannot be empty.",
          );
    } catch (error) {
      if (error instanceof StructureError)
        throw new DomainError("INVALID_INPUT", error.message);
      throw error;
    }
    const id =
      input.id ?? makeId("legacy-policy", input.projectId, input.mutationId);
    this.checkPolicyOwner(input.projectId, id);
    const previous = this.storage.get<DirectoryPolicy>("policies", id);
    const operation = {
      kind: "upsertLegacyPolicy" as const,
      id,
      pathPrefix: input.pathPrefix,
      purpose: input.purpose,
      forbiddenDependencies: input.forbiddenDependencies,
    };
    return this.updateStructure(input.projectId, {
      mutationId: input.mutationId,
      expectedStructureRevision: input.expectedStructureRevision,
      expectedFileDigest: input.expectedFileDigest,
      operation,
    }).then((state) => {
      const projected =
        state.document &&
        projectStructurePolicies(state.document, input.projectId).find(
          (policy) => policy.id === id,
        );
      if (projected) return projected;
      const policy = {
        id,
        projectId: input.projectId,
        pathPrefix: normalizeStructurePath(input.pathPrefix),
        purpose: input.purpose,
        forbiddenDependencies: input.forbiddenDependencies.map((path) =>
          normalizeStructurePath(path),
        ),
      };
      return previous &&
        canonicalLegacyPolicy(previous) === canonicalLegacyPolicy(policy)
        ? previous
        : policy;
    });
  }
  // Independent knowledge shares the publication queue without requiring usable structure files.
  listAnnotations(
    projectId: string,
    input: AnnotationListInput = {},
  ): Promise<AnnotationPage> {
    return this.structures.withProject(projectId, () =>
      this.annotations.list(projectId, input),
    );
  }
  getAnnotation(projectId: string, id: string): Promise<AnnotationDetail> {
    return this.structures.withProject(projectId, () =>
      this.annotations.get(projectId, id),
    );
  }
  createAnnotation(
    projectId: string,
    input: CreateAnnotationInput,
  ): Promise<AnnotationDetail> {
    return this.structures.withProject(projectId, () =>
      this.annotations.create(projectId, input),
    );
  }
  updateAnnotation(
    projectId: string,
    id: string,
    input: UpdateAnnotationInput,
  ): Promise<AnnotationDetail> {
    return this.structures.withProject(projectId, () =>
      this.annotations.update(projectId, id, input),
    );
  }
  bindAnnotation(
    projectId: string,
    id: string,
    input: BindAnnotationInput,
  ): Promise<AnnotationDetail> {
    return this.structures.withProject(projectId, () =>
      this.annotations.bind(projectId, id, input),
    );
  }
  deleteAnnotation(
    projectId: string,
    id: string,
    expectedRevision: number,
  ): Promise<DeleteAnnotationResult> {
    return this.structures.withProject(projectId, () =>
      this.annotations.delete(projectId, id, expectedRevision),
    );
  }
  annotationHistory(
    projectId: string,
    id: string,
    input: AnnotationHistoryInput = {},
  ): Promise<AnnotationHistoryPage> {
    return this.structures.withProject(projectId, () =>
      this.annotations.history(projectId, id, input),
    );
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
      const published = existing ?? parsed.data;
      // Snapshot, project pointer, orphan history and one plan invalidation batch commit together.
      this.annotations.reconcile(
        project.id,
        published,
        new Date().toISOString(),
      );
      return published;
    });
  }
}
