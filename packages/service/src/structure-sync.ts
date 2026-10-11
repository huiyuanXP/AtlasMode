import { randomUUID } from "node:crypto";
import {
  DomainError,
  StructureError,
  applyStructureOperation,
  canonicalLegacyPolicy,
  canonicalStructure,
  parseStructure,
  projectStructurePolicies,
  structureLegacyPolicies,
  type DirectoryPolicy,
  type Project,
  type StoragePort,
  type StructureAudit,
  type StructureAuditPage,
  type StructureDocumentV1,
  type StructureFilePort,
  type StructureFileRead,
  type StructureRecoverySummary,
  type StructureState,
  type StructureWriteInput,
} from "@codemap/core";
import {
  StructureRecords,
  requestHash,
  structureHash,
  type StructureIntent,
} from "./structure-state.js";

type Options = {
  storage: StoragePort;
  files: StructureFilePort;
  project: (id: string) => Project;
  legacyPolicies: (id: string) => DirectoryPolicy[];
  // Coordinate only identity-changing writes across project queues.
  identityMutation?: (
    projectId: string,
    input: StructureWriteInput,
    work: () => Promise<StructureState>,
  ) => Promise<StructureState>;
  validateOwnership?: (
    projectId: string,
    document: StructureDocumentV1,
  ) => void;
};
export type StructureSession = { readStructure(): Promise<StructureState> };
const emptyDocument = (): StructureDocumentV1 => ({
  schemaVersion: 1,
  folders: [],
  dependencyRules: [],
});

export class StructureSync {
  private readonly records: StructureRecords;
  private readonly queue = new Map<string, Promise<unknown>>();
  constructor(private readonly options: Options) {
    this.records = new StructureRecords(options.storage);
  }

  private enqueue<T>(projectId: string, work: () => Promise<T>): Promise<T> {
    this.options.project(projectId);
    const previous = this.queue.get(projectId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    this.queue.set(projectId, next);
    void next
      .finally(() => {
        if (this.queue.get(projectId) === next) this.queue.delete(projectId);
      })
      .catch(() => {});
    return next;
  }
  withProject<T>(
    projectId: string,
    work: (session: StructureSession) => Promise<T> | T,
  ): Promise<T> {
    return this.enqueue(projectId, async () => {
      let active = true;
      const session: StructureSession = {
        readStructure: async () => {
          if (!active)
            throw new DomainError(
              "STRUCTURE_CONFLICT",
              "Structure queue scope has ended.",
            );
          const state = await this.readLocked(projectId);
          this.assertUsable(state);
          return state;
        },
      };
      try {
        return await work(session);
      } finally {
        active = false;
      }
    });
  }
  getStructure(
    projectId: string,
    options: { acceptExternalConflict?: boolean } = {},
  ): Promise<StructureState> {
    return this.enqueue(projectId, () =>
      this.readLocked(projectId, options.acceptExternalConflict ?? false),
    );
  }
  private defaultState(projectId: string, verifiedAt: string): StructureState {
    return {
      projectId,
      schemaVersion: 1,
      structureRevision: 0,
      fileDigest: null,
      semanticDigest: null,
      verifiedAt,
      status: "missing",
      diagnostics: [],
      legacyPendingCount: this.options.legacyPolicies(projectId).length,
    };
  }
  private decoded(
    projectId: string,
    read: StructureFileRead,
    previous?: StructureState,
  ): StructureState {
    const state = {
      ...(previous ?? this.defaultState(projectId, read.verifiedAt)),
      verifiedAt: read.verifiedAt,
      legacyPendingCount: this.options.legacyPolicies(projectId).length,
    };
    const withoutDocument = { ...state };
    delete withoutDocument.document;
    if (read.diagnostics.length)
      return {
        ...withoutDocument,
        fileDigest: read.digest,
        semanticDigest: null,
        status: "invalid",
        diagnostics: read.diagnostics,
      };
    if (read.digest === null)
      return {
        ...withoutDocument,
        fileDigest: null,
        semanticDigest: null,
        status: "missing",
        diagnostics: [],
      };
    try {
      if (read.bytes === null)
        throw new StructureError(
          "INVALID_STRUCTURE",
          "Structure bytes are unavailable.",
        );
      const document = parseStructure(Buffer.from(read.bytes).toString("utf8"));
      const semanticDigest = structureHash(canonicalStructure(document));
      return {
        ...state,
        document,
        fileDigest: read.digest,
        semanticDigest,
        status: "ready",
        diagnostics: [],
        lastGood: { document, fileDigest: read.digest, semanticDigest },
      };
    } catch (error) {
      return {
        ...withoutDocument,
        fileDigest: read.digest,
        semanticDigest: null,
        status: "invalid",
        diagnostics:
          error instanceof StructureError
            ? error.diagnostics
            : [
                {
                  pointer: "",
                  kind: "json",
                  message: "Invalid structure file.",
                },
              ],
      };
    }
  }
  private assertUsable(state: StructureState): void {
    if (state.status === "ready" || state.status === "missing") return;
    if (state.status === "invalid")
      throw new StructureError(
        "INVALID_STRUCTURE",
        "Repair the structure file before continuing.",
        state.diagnostics,
      );
    throw new StructureError(
      state.status === "conflict"
        ? "STRUCTURE_CONFLICT"
        : "STRUCTURE_RECOVERY_PENDING",
      "Structure synchronization must be resolved before continuing.",
      state.diagnostics,
    );
  }
  private async readLocked(
    projectId: string,
    acceptExternalConflict = false,
  ): Promise<StructureState> {
    const intent = this.records.intent(projectId);
    if (intent?.pending) {
      if (intent.phase === "conflicted" && acceptExternalConflict) {
        const read = await this.options.files.read(
          this.options.project(projectId).path,
        );
        const parsed = this.decoded(
          projectId,
          read,
          this.records.state(projectId),
        );
        if (parsed.status !== "ready" && parsed.status !== "missing")
          return parsed;
        this.options.storage.transaction(() =>
          this.records.saveIntent({ ...intent, pending: false }),
        );
      } else {
        const recovered = await this.recoverLocked(intent);
        if (!recovered) {
          const previous =
            this.records.state(projectId) ??
            this.defaultState(projectId, new Date().toISOString());
          if (this.records.intent(projectId)?.phase === "conflicted")
            return previous;
          const withoutDocument = { ...previous };
          delete withoutDocument.document;
          return {
            ...withoutDocument,
            status: "recovery_pending",
            diagnostics: [
              {
                pointer: "",
                kind: "recovery",
                message:
                  "Structure publication outcome is awaiting recovery verification.",
              },
            ],
          };
        }
      }
    }
    const read = await this.options.files.read(
      this.options.project(projectId).path,
    );
    const previous = this.records.state(projectId);
    let next = this.decoded(projectId, read, previous);
    if (next.document) {
      try {
        this.checkPolicyOwners(projectId, next.document);
      } catch (error) {
        const withoutDocument = { ...next };
        delete withoutDocument.document;
        delete withoutDocument.lastGood;
        next = {
          ...withoutDocument,
          ...(previous?.lastGood ? { lastGood: previous.lastGood } : {}),
          status: "conflict",
          semanticDigest: null,
          diagnostics: [
            {
              pointer: "/x-atlasmode/legacyPathPolicies",
              kind: "conflict",
              message:
                error instanceof Error
                  ? error.message
                  : "Legacy source conflict.",
            },
          ],
        };
      }
    }
    const changed = !previous
      ? read.digest !== null
      : previous.fileDigest !== next.fileDigest;
    const contextChanged =
      previous?.semanticDigest !== next.semanticDigest ||
      (changed && next.status === "invalid") ||
      (previous?.fileDigest != null && next.fileDigest === null);
    if (changed)
      next.structureRevision = (previous?.structureRevision ?? 0) + 1;
    if (changed || !previous || previous.status !== next.status) {
      this.options.storage.transaction(() => {
        const affectedPlans =
          (changed || previous?.status !== next.status) && contextChanged
            ? this.records.invalidate(projectId)
            : [];
        this.records.saveState(next);
        if (changed || previous?.status !== next.status)
          this.records.saveAudit({
            id: randomUUID(),
            projectId,
            source: "external",
            outcome:
              next.status === "invalid"
                ? "failed"
                : next.status === "conflict"
                  ? "conflicted"
                  : "committed",
            target: "file",
            beforeDigest: previous?.fileDigest ?? null,
            attemptedAfterDigest: null,
            observedAfterDigest: read.digest,
            observedAfterKnown: true,
            beforeSemanticDigest: previous?.semanticDigest ?? null,
            attemptedSemanticDigest: next.semanticDigest,
            validatedAt: read.verifiedAt,
            observedAt: read.verifiedAt,
            ...(next.status === "invalid"
              ? { errorCode: "INVALID_STRUCTURE" }
              : next.status === "conflict"
                ? { errorCode: "STRUCTURE_CONFLICT" }
                : { committedAt: new Date().toISOString() }),
            structureRevision: next.structureRevision,
            affectedPlans,
          });
      });
    }
    return next;
  }
  private checkPolicyOwners(
    projectId: string,
    document: StructureDocumentV1,
  ): void {
    projectStructurePolicies(document, projectId);
    for (const policy of structureLegacyPolicies(document)) {
      const db = this.options.storage.get<DirectoryPolicy>(
        "policies",
        policy.id,
      );
      if (db && db.projectId !== projectId)
        throw new DomainError(
          "PROJECT_MISMATCH",
          "Policy belongs to another project.",
        );
      if (db && canonicalLegacyPolicy(db) !== canonicalLegacyPolicy(policy))
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "File and legacy database policy disagree.",
        );
    }
  }
  policies(projectId: string): DirectoryPolicy[] {
    this.options.project(projectId);
    if (this.records.intent(projectId)?.pending)
      throw new StructureError(
        "STRUCTURE_RECOVERY_PENDING",
        "Recover structure synchronization before reading policies.",
      );
    const state =
      this.records.state(projectId) ??
      this.defaultState(projectId, new Date().toISOString());
    this.assertUsable(state);
    const document = state.document ?? emptyDocument();
    this.checkPolicyOwners(projectId, document);
    const policies = projectStructurePolicies(document, projectId);
    const result = new Map(policies.map((policy) => [policy.id, policy]));
    for (const policy of this.options.legacyPolicies(projectId))
      if (!result.has(policy.id)) result.set(policy.id, policy);
    return [...result.values()];
  }
  listStructureAudit(
    projectId: string,
    page: { offset: number; limit: number },
  ): StructureAuditPage {
    this.options.project(projectId);
    if (
      !Number.isSafeInteger(page.offset) ||
      page.offset < 0 ||
      !Number.isInteger(page.limit) ||
      page.limit < 1 ||
      page.limit > 100
    )
      throw new DomainError("INVALID_INPUT", "Invalid audit page.");
    const items = this.records.audits(projectId);
    return {
      items: items.slice(page.offset, page.offset + page.limit),
      ...page,
      total: items.length,
    };
  }
  private validateInput(input: StructureWriteInput): void {
    const exact = (value: object, keys: string[]) => {
      if (Object.keys(value).some((key) => !keys.includes(key)))
        throw new DomainError(
          "INVALID_INPUT",
          "Unexpected structure input field.",
        );
    };
    if (!input || typeof input !== "object")
      throw new DomainError("INVALID_INPUT", "Expected structure input.");
    exact(input, [
      "mutationId",
      "expectedStructureRevision",
      "expectedFileDigest",
      "operation",
    ]);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input.mutationId,
      ) ||
      !Number.isSafeInteger(input.expectedStructureRevision) ||
      input.expectedStructureRevision < 0 ||
      (input.expectedFileDigest !== null &&
        (typeof input.expectedFileDigest !== "string" ||
          !/^[0-9a-f]{64}$/.test(input.expectedFileDigest)))
    )
      throw new DomainError(
        "INVALID_INPUT",
        "Invalid structure preconditions.",
      );
    const operation = input.operation;
    if (!operation || typeof operation !== "object")
      throw new DomainError("INVALID_INPUT", "Expected structure operation.");
    if (operation.kind === "importLegacy") exact(operation, ["kind"]);
    else if (operation.kind === "upsertFolder") {
      exact(operation, ["kind", "previousPath", "path", "purpose"]);
      if (
        typeof operation.path !== "string" ||
        typeof operation.purpose !== "string" ||
        (operation.previousPath !== undefined &&
          typeof operation.previousPath !== "string")
      )
        throw new DomainError("INVALID_INPUT", "Invalid folder fields.");
    } else if (operation.kind === "upsertLegacyPolicy") {
      exact(operation, [
        "kind",
        "id",
        "pathPrefix",
        "purpose",
        "forbiddenDependencies",
      ]);
      if (
        typeof operation.pathPrefix !== "string" ||
        typeof operation.purpose !== "string" ||
        !Array.isArray(operation.forbiddenDependencies) ||
        operation.forbiddenDependencies.some(
          (value) => typeof value !== "string",
        ) ||
        (operation.id !== undefined &&
          (typeof operation.id !== "string" || !operation.id))
      )
        throw new DomainError("INVALID_INPUT", "Invalid legacy policy fields.");
    } else
      throw new DomainError("INVALID_INPUT", "Unknown structure operation.");
  }
  updateStructure(
    projectId: string,
    input: StructureWriteInput,
  ): Promise<StructureState> {
    this.validateInput(input);
    return this.enqueue(projectId, () => {
      const work = () => this.updateLocked(projectId, input);
      return this.options.identityMutation?.(projectId, input, work) ?? work();
    });
  }
  private async updateLocked(
    projectId: string,
    input: StructureWriteInput,
  ): Promise<StructureState> {
    const digest = requestHash(input);
    if (this.completedRequest(projectId, input.mutationId, digest)) {
      const state = await this.readLocked(projectId);
      this.assertUsable(state);
      return state;
    }
    const state = await this.readLocked(projectId);
    // Inline recovery may have created this mutation's terminal audit.
    if (this.completedRequest(projectId, input.mutationId, digest)) {
      this.assertUsable(state);
      return state;
    }
    this.assertUsable(state);
    if (
      state.structureRevision !== input.expectedStructureRevision ||
      state.fileDigest !== input.expectedFileDigest
    )
      throw new StructureError(
        "STRUCTURE_CONFLICT",
        "Structure file or version changed. Reread before saving.",
      );
    const document = state.document ?? emptyDocument(),
      legacy = this.options.legacyPolicies(projectId);
    if (input.operation.kind === "upsertLegacyPolicy" && input.operation.id) {
      const id = input.operation.id,
        owner = this.options.storage.get<DirectoryPolicy>("policies", id);
      if (owner && owner.projectId !== projectId)
        throw new DomainError(
          "PROJECT_MISMATCH",
          "Policy belongs to another project.",
        );
      if (
        projectStructurePolicies(document, projectId).some(
          (p) => p.id === id,
        ) &&
        !structureLegacyPolicies(document).some((p) => p.id === id)
      )
        throw new DomainError(
          "INVALID_INPUT",
          "Folder projections must be edited as folders.",
        );
      const dbOnly = legacy.find((policy) => policy.id === id);
      if (
        dbOnly &&
        structureLegacyPolicies(document).some((policy) => policy.id === id)
      )
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "Explicitly migrate this legacy policy before editing its file representation.",
        );
      if (dbOnly) {
        const operation = input.operation;
        const validated = applyStructureOperation(
          emptyDocument(),
          operation,
          [],
        );
        const policy = projectStructurePolicies(validated, projectId)[0]!;
        if (canonicalLegacyPolicy(policy) === canonicalLegacyPolicy(dbOnly))
          return this.noOp(projectId, input.mutationId, digest, state);
        const observed = await this.options.files.read(
          this.options.project(projectId).path,
        );
        if (observed.digest !== state.fileDigest || observed.diagnostics.length)
          throw new StructureError(
            "STRUCTURE_CONFLICT",
            "Structure changed during legacy editing.",
          );
        const next = {
          ...state,
          structureRevision: state.structureRevision + 1,
          verifiedAt: observed.verifiedAt,
        };
        this.options.storage.transaction(() => {
          this.options.storage.put("policies", id, policy);
          this.records.saveState(next);
          this.records.saveAudit(
            {
              id: input.mutationId,
              projectId,
              source: "ui",
              outcome: "committed",
              target: "legacy_db",
              beforeDigest: state.fileDigest,
              attemptedAfterDigest: null,
              observedAfterDigest: observed.digest,
              observedAfterKnown: true,
              beforeSemanticDigest: state.semanticDigest,
              attemptedSemanticDigest: state.semanticDigest,
              validatedAt: observed.verifiedAt,
              observedAt: observed.verifiedAt,
              committedAt: new Date().toISOString(),
              structureRevision: next.structureRevision,
              affectedPlans: this.records.invalidate(projectId),
              policyId: id,
              beforePolicyDigest: structureHash(canonicalLegacyPolicy(dbOnly)),
              afterPolicyDigest: structureHash(canonicalLegacyPolicy(policy)),
            },
            digest,
          );
        });
        return next;
      }
      const existing = structureLegacyPolicies(document).find(
        (policy) => policy.id === id,
      );
      if (existing) {
        const validated = applyStructureOperation(
          emptyDocument(),
          input.operation,
          [],
        );
        if (
          canonicalLegacyPolicy(existing) ===
          canonicalLegacyPolicy(structureLegacyPolicies(validated)[0]!)
        )
          return this.noOp(projectId, input.mutationId, digest, state);
      }
    }
    if (input.operation.kind === "importLegacy" && !legacy.length)
      return this.noOp(projectId, input.mutationId, digest, state);
    const operation =
      input.operation.kind === "upsertLegacyPolicy" && !input.operation.id
        ? { ...input.operation, id: randomUUID() }
        : input.operation;
    const candidate = applyStructureOperation(document, operation, legacy),
      semanticDigest = structureHash(canonicalStructure(candidate));
    const migrationPolicies = operation.kind === "importLegacy" ? legacy : [];
    const unchanged =
      state.document !== undefined && state.semanticDigest === semanticDigest;
    if (unchanged && !migrationPolicies.length)
      return this.noOp(projectId, input.mutationId, digest, state);
    if (unchanged && migrationPolicies.length) {
      const observed = await this.options.files.read(
        this.options.project(projectId).path,
      );
      if (observed.digest !== state.fileDigest || observed.diagnostics.length)
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "Structure changed before legacy migration finalized.",
        );
      const next = {
        ...state,
        structureRevision: state.structureRevision + 1,
        legacyPendingCount: state.legacyPendingCount - migrationPolicies.length,
      };
      this.options.storage.transaction(() => {
        this.deleteMigrated(migrationPolicies);
        this.records.saveState(next);
        this.records.saveAudit(
          {
            id: input.mutationId,
            projectId,
            source: "legacy_migration",
            outcome: "committed",
            target: "legacy_db",
            beforeDigest: state.fileDigest,
            attemptedAfterDigest: null,
            observedAfterDigest: state.fileDigest,
            observedAfterKnown: true,
            beforeSemanticDigest: state.semanticDigest,
            attemptedSemanticDigest: state.semanticDigest,
            validatedAt: state.verifiedAt,
            observedAt: state.verifiedAt,
            committedAt: new Date().toISOString(),
            structureRevision: next.structureRevision,
            affectedPlans: this.records.invalidate(projectId),
            migrationIds: migrationPolicies.map((policy) => policy.id),
          },
          digest,
        );
      });
      return next;
    }
    const bytes = Buffer.from(JSON.stringify(candidate, null, 2) + "\n");
    if (bytes.length > 1024 * 1024)
      throw new StructureError(
        "INVALID_STRUCTURE",
        "Structure file exceeds 1 MiB.",
      );
    const actual = await this.options.files.read(
      this.options.project(projectId).path,
    );
    if (actual.digest !== state.fileDigest)
      throw new StructureError(
        "STRUCTURE_CONFLICT",
        "Structure changed before preparing publication.",
      );
    const intent: StructureIntent = {
      recordType: "structure_intent",
      projectId,
      mutationId: input.mutationId,
      requestDigest: digest,
      pending: true,
      phase: "prepared",
      source: operation.kind === "importLegacy" ? "legacy_migration" : "ui",
      operation,
      beforeDigest: state.fileDigest,
      afterDigest: structureHash(bytes),
      beforeSemanticDigest: state.semanticDigest,
      afterSemanticDigest: semanticDigest,
      beforeBytes:
        actual.bytes === null
          ? null
          : Buffer.from(actual.bytes).toString("base64"),
      candidateBytes: bytes.toString("base64"),
      migrationPolicies,
      validatedAt: actual.verifiedAt,
      beforeRevision: state.structureRevision,
    };
    this.options.validateOwnership?.(projectId, candidate);
    this.options.storage.transaction(() => this.records.saveIntent(intent));
    let publication;
    try {
      publication = await this.options.files.publish(
        this.options.project(projectId).path,
        {
          mutationId: input.mutationId,
          expectedDigest: state.fileDigest,
          bytes,
        },
      );
    } catch {
      throw new StructureError(
        "STRUCTURE_RECOVERY_PENDING",
        "Publication outcome is unknown; recover before saving again.",
      );
    }
    if (publication.phase === "not_published") {
      const observed = await this.observe(projectId);
      this.options.storage.transaction(() => {
        this.records.saveIntent({
          ...intent,
          pending: false,
          phase:
            publication.errorCode === "STRUCTURE_CONFLICT"
              ? "conflicted"
              : "failed",
        });
        this.records.saveAudit(
          this.intentAudit(
            intent,
            observed,
            publication.errorCode === "STRUCTURE_CONFLICT"
              ? "conflicted"
              : "failed",
            state.structureRevision,
            [],
            publication.errorCode,
          ),
          digest,
        );
      });
      throw new StructureError(
        publication.errorCode ?? "STRUCTURE_WRITE_FAILED",
        "Structure file was not published.",
      );
    }
    if (publication.phase !== "published")
      throw new StructureError(
        "STRUCTURE_RECOVERY_PENDING",
        "File publication requires recovery before continuing.",
      );
    try {
      const observed = await this.options.files.read(
        this.options.project(projectId).path,
      );
      if (observed.digest !== intent.afterDigest || observed.diagnostics.length)
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "File changed after publication.",
        );
      return this.finalize(intent, observed, false);
    } catch {
      throw new StructureError(
        "STRUCTURE_RECOVERY_PENDING",
        "File is published; database synchronization requires recovery.",
      );
    }
  }
  private completedRequest(
    projectId: string,
    mutationId: string,
    requestDigest: string,
  ): boolean {
    const audit = this.records.audit(projectId, mutationId);
    const receipt = audit ?? this.records.noOp(projectId, mutationId);
    if (!receipt) return false;
    if (receipt.requestDigest !== requestDigest)
      throw new StructureError(
        "STRUCTURE_CONFLICT",
        "Mutation id was already used with another request.",
      );
    if (audit && audit.outcome !== "committed")
      throw new StructureError(
        audit.errorCode ?? "STRUCTURE_CONFLICT",
        "This mutation already ended without committing.",
      );
    return true;
  }
  private noOp(
    projectId: string,
    mutationId: string,
    requestDigest: string,
    state: StructureState,
  ): StructureState {
    this.options.storage.transaction(() =>
      this.records.saveNoOp({
        recordType: "structure_no_op",
        projectId,
        mutationId,
        requestDigest,
        outcome: "no_op",
        structureRevision: state.structureRevision,
        fileDigest: state.fileDigest,
        verifiedAt: state.verifiedAt,
        completedAt: new Date().toISOString(),
      }),
    );
    return state;
  }
  private deleteMigrated(policies: DirectoryPolicy[]): void {
    for (const policy of policies) {
      const actual = this.options.storage.get<DirectoryPolicy>(
        "policies",
        policy.id,
      );
      if (
        actual &&
        (actual.projectId !== policy.projectId ||
          canonicalLegacyPolicy(actual) !== canonicalLegacyPolicy(policy))
      )
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "Legacy policy changed before migration finalized.",
        );
      if (actual) this.options.storage.delete("policies", policy.id);
    }
  }
  private async observe(
    projectId: string,
  ): Promise<StructureFileRead | undefined> {
    try {
      return await this.options.files.read(
        this.options.project(projectId).path,
      );
    } catch {
      return undefined;
    }
  }
  private intentAudit(
    intent: StructureIntent,
    observed: StructureFileRead | undefined,
    outcome: StructureAudit["outcome"],
    structureRevision: number,
    affectedPlans: StructureAudit["affectedPlans"],
    errorCode?: string,
  ): StructureAudit {
    return {
      id: intent.mutationId,
      projectId: intent.projectId,
      source: intent.source,
      outcome,
      target: "file",
      beforeDigest: intent.beforeDigest,
      attemptedAfterDigest: intent.afterDigest,
      observedAfterDigest: observed?.digest ?? null,
      observedAfterKnown: observed !== undefined,
      beforeSemanticDigest: intent.beforeSemanticDigest,
      attemptedSemanticDigest: intent.afterSemanticDigest,
      validatedAt: intent.validatedAt,
      ...(observed ? { observedAt: observed.verifiedAt } : {}),
      structureRevision,
      affectedPlans,
      ...(outcome === "committed"
        ? { committedAt: new Date().toISOString() }
        : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(intent.migrationPolicies.length
        ? { migrationIds: intent.migrationPolicies.map((policy) => policy.id) }
        : {}),
    };
  }
  private finalize(
    intent: StructureIntent,
    observed: StructureFileRead,
    recovered: boolean,
  ): StructureState {
    const existing = this.records.intent(intent.projectId);
    if (!existing?.pending && existing?.phase === "committed")
      return this.records.state(intent.projectId)!;
    const next = this.decoded(
      intent.projectId,
      observed,
      this.records.state(intent.projectId),
    );
    if (
      next.status !== "ready" ||
      next.semanticDigest !== intent.afterSemanticDigest ||
      next.fileDigest !== intent.afterDigest
    )
      throw new StructureError(
        "STRUCTURE_CONFLICT",
        "Recovered file does not match the validated candidate.",
      );
    this.options.validateOwnership?.(intent.projectId, next.document!);
    next.structureRevision = intent.beforeRevision + 1;
    this.options.storage.transaction(() => {
      this.deleteMigrated(intent.migrationPolicies);
      next.legacyPendingCount = this.options.legacyPolicies(
        intent.projectId,
      ).length;
      const changed =
        intent.beforeSemanticDigest !== intent.afterSemanticDigest ||
        intent.migrationPolicies.length > 0;
      const affectedPlans = changed
        ? this.records.invalidate(intent.projectId)
        : [];
      this.records.saveState(next);
      const audit = this.intentAudit(
        intent,
        observed,
        "committed",
        next.structureRevision,
        affectedPlans,
      );
      if (recovered) audit.recoveredAt = new Date().toISOString();
      this.records.saveAudit(audit, intent.requestDigest);
      this.records.saveIntent({
        ...intent,
        pending: false,
        phase: "committed",
      });
    });
    return next;
  }
  private async recoverLocked(intent: StructureIntent): Promise<boolean> {
    if (intent.phase === "conflicted") return false;
    const observed = await this.observe(intent.projectId);
    // Read failure is unknown. Retry later rather than inventing a third digest.
    if (!observed) return false;
    if (
      observed &&
      !observed.diagnostics.length &&
      observed.digest === intent.afterDigest
    ) {
      try {
        this.finalize(intent, observed, true);
        return true;
      } catch {
        return false;
      }
    }
    if (
      observed &&
      !observed.diagnostics.length &&
      observed.digest === intent.beforeDigest
    ) {
      this.options.storage.transaction(() => {
        this.records.saveIntent({
          ...intent,
          pending: false,
          phase: "aborted",
        });
        this.records.saveAudit(
          {
            ...this.intentAudit(
              intent,
              observed,
              "aborted",
              intent.beforeRevision,
              [],
              "STRUCTURE_CONFLICT",
            ),
            recoveredAt: new Date().toISOString(),
          },
          intent.requestDigest,
        );
      });
      return true;
    }
    const previous =
      this.records.state(intent.projectId) ??
      this.defaultState(intent.projectId, new Date().toISOString());
    const withoutDocument = { ...previous };
    delete withoutDocument.document;
    const next: StructureState = {
      ...withoutDocument,
      status: "conflict",
      fileDigest: observed?.digest ?? previous.fileDigest,
      semanticDigest: null,
      structureRevision:
        observed && observed.digest !== previous.fileDigest
          ? previous.structureRevision + 1
          : previous.structureRevision,
      diagnostics: [
        {
          pointer: "",
          kind: "conflict",
          message:
            "Disk content differs from both journal versions. Explicitly reread and accept the external file.",
        },
      ],
    };
    this.options.storage.transaction(() => {
      this.records.saveState(next);
      this.records.saveIntent({
        ...intent,
        phase: "conflicted",
        pending: true,
      });
      this.records.saveAudit(
        {
          ...this.intentAudit(
            intent,
            observed,
            "conflicted",
            next.structureRevision,
            [],
            "STRUCTURE_CONFLICT",
          ),
          recoveredAt: new Date().toISOString(),
        },
        intent.requestDigest,
      );
    });
    return false;
  }
  async recoverStructureWrites(): Promise<StructureRecoverySummary> {
    const result: StructureRecoverySummary = {
      recoveredProjectIds: [],
      blockedProjectIds: [],
    };
    for (const intent of this.records.intents()) {
      try {
        const recovered = await this.enqueue(intent.projectId, () =>
          this.recoverLocked(intent),
        );
        (recovered
          ? result.recoveredProjectIds
          : result.blockedProjectIds
        ).push(intent.projectId);
      } catch {
        result.blockedProjectIds.push(intent.projectId);
      }
    }
    return result;
  }
}
