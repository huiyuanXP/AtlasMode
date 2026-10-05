import { createHash, randomUUID } from 'node:crypto';
import {
  AnnotationInputSchema,
  AnnotationSchema,
  GroupInputSchema,
  GroupSchema,
  PolicyInputSchema,
  PolicySchema,
  ViewInputSchema,
  ViewStateSchema,
  PlanInputSchema,
  PlanSchema,
  KnowledgeExportSchema,
  VerificationReportSchema,
  validatePlan,
  planSemanticContent,
  canonicalJson,
  verifyStructure,
  IdentityRecordSchema,
  identityCandidates,
  assertExpectedRevision,
  revisePlan,
  validationRevision,
  approveRevision,
  approvalValidity,
  beginRevision,
  cancelRevision,
} from '@codemap/core';
import type {
  StoragePort,
  IndexerPort,
  KnowledgeFilePort,
  EntityKind,
  CodeSnapshot,
  PlanRevision,
  PlanInput,
  FolderPolicy,
  Mutation,
  KnowledgeExport,
} from '@codemap/core';
import { searchFunctions, subgraph } from './graph.js';
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const inputSchemas = {
  annotation: AnnotationInputSchema,
  group: GroupInputSchema,
  policy: PolicyInputSchema,
  view: ViewInputSchema,
};
const recordSchemas = {
  annotation: AnnotationSchema,
  group: GroupSchema,
  policy: PolicySchema,
  view: ViewStateSchema,
};
export type KnowledgeKind = keyof typeof inputSchemas;
export class ProjectService {
  private activeRefresh: Promise<CodeSnapshot> | null = null;
  constructor(
    private readonly indexer: IndexerPort,
    private readonly storage: StoragePort,
    private readonly files?: KnowledgeFilePort,
  ) {}
  async initialize(): Promise<void> {
    await this.refresh();
  }
  refresh(): Promise<CodeSnapshot> {
    if (this.activeRefresh) return this.activeRefresh;
    const previous = this.storage.getSnapshot();
    this.activeRefresh = this.indexer
      .scan()
      .then((snapshot) => {
        this.storage.saveSnapshot(snapshot);
        const stored = this.storage.get('identity', 'workspace');
        const identity =
          stored === null ? null : IdentityRecordSchema.parse(stored);
        if (!identity || identity.snapshotId !== snapshot.id) {
          this.storage.save(
            'identity',
            IdentityRecordSchema.parse({
              id: 'workspace',
              revision: (identity?.revision ?? 0) + 1,
              previousSnapshotId: previous?.id ?? null,
              snapshotId: snapshot.id,
              candidates: previous
                ? identityCandidates(previous, snapshot)
                : [],
              confirmed: identity?.confirmed ?? [],
            }),
            identity?.revision ?? null,
          );
        }
        return snapshot;
      })
      .finally(() => {
        this.activeRefresh = null;
      });
    return this.activeRefresh;
  }
  snapshot(id?: string): CodeSnapshot {
    const snapshot = this.storage.getSnapshot(id);
    if (!snapshot)
      throw new ServiceError(404, 'SNAPSHOT_NOT_FOUND', 'Snapshot not found');
    return snapshot;
  }
  summary() {
    const snapshot = this.snapshot();
    return {
      repositoryId: snapshot.repositoryId,
      snapshotId: snapshot.id,
      source: snapshot.source,
      gitRevision: snapshot.gitRevision,
      baselineDigest: snapshot.baselineDigest,
      createdAt: snapshot.createdAt,
      counts: {
        functions: snapshot.nodes.filter((node) => node.kind === 'function')
          .length,
        files: snapshot.scope.included.length,
        relations: snapshot.relations.length,
        unresolved: snapshot.relations.filter(
          (relation) => relation.resolution === 'unresolved',
        ).length,
      },
      scope: {
        includedCount: snapshot.scope.included.length,
        configuration: snapshot.scope.configuration,
        exclusions: snapshot.scope.excluded.slice(0, 100),
        limits: snapshot.scope.limits,
        diagnostics: snapshot.scope.diagnostics.slice(0, 30),
      },
    };
  }
  snapshots(offset: number, limit: number) {
    return { items: this.storage.listSnapshots(offset, limit), offset, limit };
  }
  search(query: string, offset: number, limit: number) {
    return searchFunctions(this.snapshot(), query, offset, limit);
  }
  graph(seeds: string[], depth: number, budget: number, types?: string[]) {
    const snapshot = this.snapshot();
    for (const id of seeds)
      if (!snapshot.nodes.some((node) => node.id === id))
        throw new ServiceError(
          404,
          'NODE_NOT_FOUND',
          `Unknown seed node: ${id}`,
        );
    return subgraph(snapshot, seeds, depth, budget, types);
  }
  context(id: string, limit: number) {
    const snapshot = this.snapshot(),
      node = snapshot.nodes.find((node) => node.id === id);
    if (node?.kind !== 'function')
      throw new ServiceError(404, 'FUNCTION_NOT_FOUND', 'Function not found');
    const outgoing = snapshot.relations.filter(
        (relation) => relation.source === id && relation.type === 'calls',
      ),
      incoming = snapshot.relations.filter(
        (relation) => relation.target === id && relation.type === 'calls',
      );
    return {
      snapshotId: snapshot.id,
      source: 'code',
      function: node,
      file: snapshot.nodes.find((file) => file.id === node.fileId),
      outgoing: outgoing.slice(0, limit),
      incoming: incoming.slice(0, limit),
      unresolved: outgoing
        .filter((relation) => relation.resolution === 'unresolved')
        .slice(0, limit),
      truncated: outgoing.length > limit || incoming.length > limit,
    };
  }
  identities(offset = 0, limit = 50) {
    const data = IdentityRecordSchema.parse(
      this.storage.get('identity', 'workspace'),
    );
    return {
      ...data,
      candidates: data.candidates.slice(offset, offset + limit),
      confirmed: data.confirmed.slice(offset, offset + limit),
      candidateCount: data.candidates.length,
      offset,
      limit,
    };
  }
  confirmIdentity(
    previousId: string,
    currentId: string,
    expectedRevision: number,
  ) {
    const data = IdentityRecordSchema.parse(
      this.storage.get('identity', 'workspace'),
    );
    if (
      data.revision !== expectedRevision ||
      data.snapshotId !== this.snapshot().id
    )
      throw new ServiceError(
        409,
        'IDENTITY_PREVIEW_STALE',
        'Identity candidates changed; refresh the preview',
      );
    if (
      !data.candidates.some(
        (item) =>
          item.previous.id === previousId && item.candidate.id === currentId,
      )
    )
      throw new ServiceError(
        422,
        'UNKNOWN_IDENTITY_CANDIDATE',
        'Explicit current candidate required',
      );
    const mutations: Mutation[] = [];
    for (const value of this.storage.list('annotation', 0, 10000)) {
      const item = AnnotationSchema.parse(value);
      if (item.targetId === previousId)
        mutations.push({
          kind: 'annotation',
          record: { ...item, revision: item.revision + 1, targetId: currentId },
          expectedRevision: item.revision,
        });
    }
    for (const value of this.storage.list('group', 0, 10000)) {
      const item = GroupSchema.parse(value);
      if (item.members.includes(previousId))
        mutations.push({
          kind: 'group',
          record: {
            ...item,
            revision: item.revision + 1,
            members: [
              ...new Set(
                item.members.map((id) => (id === previousId ? currentId : id)),
              ),
            ],
          },
          expectedRevision: item.revision,
        });
    }
    const mapping = {
      previousId,
      currentId,
      snapshotId: data.snapshotId,
      actor: 'local-user' as const,
      confirmedAt: new Date().toISOString(),
    };
    mutations.push({
      kind: 'identity',
      record: {
        ...data,
        revision: data.revision + 1,
        candidates: data.candidates.filter(
          (item) => item.previous.id !== previousId,
        ),
        confirmed: [...data.confirmed, mapping],
      },
      expectedRevision: data.revision,
    });
    this.storage.commit(mutations);
    return { rebound: mutations.length - 1, mapping };
  }
  private knownReference(id: string) {
    return (
      this.snapshot().nodes.some((node) => node.id === id) ||
      this.storage.get('group', id) !== null
    );
  }
  list(kind: EntityKind, offset = 0, limit = 100) {
    const items = this.storage.list(kind, offset, limit);
    const snapshot = this.snapshot();
    return {
      snapshotId: snapshot.id,
      source: 'knowledge',
      items: items.map((item) => {
        if (kind === 'annotation') {
          const record = AnnotationSchema.parse(item);
          return {
            ...record,
            binding: this.knownReference(record.targetId)
              ? 'bound'
              : 'orphaned',
          };
        }
        if (kind === 'group') {
          const record = GroupSchema.parse(item);
          return {
            ...record,
            orphanedMembers: record.members.filter(
              (id) => !snapshot.nodes.some((node) => node.id === id),
            ),
          };
        }
        return item;
      }),
      offset,
      limit,
    };
  }
  get(kind: KnowledgeKind, id: string) {
    const item = this.storage.get(kind, id);
    if (item === null)
      throw new ServiceError(404, 'RECORD_NOT_FOUND', 'Record not found');
    return recordSchemas[kind].parse(item);
  }
  private validateKnowledge(
    kind: KnowledgeKind,
    input: unknown,
    previous?: unknown,
  ) {
    const parsed = inputSchemas[kind].parse(input);
    if (kind === 'annotation') {
      const annotation = AnnotationInputSchema.parse(parsed);
      const prior = AnnotationSchema.safeParse(previous);
      if (
        !this.knownReference(annotation.targetId) &&
        !(prior.success && prior.data.targetId === annotation.targetId)
      )
        throw new ServiceError(
          422,
          'UNKNOWN_TARGET',
          'Annotation target must exist when created/edited',
        );
    }
    if (kind === 'group') {
      const group = GroupInputSchema.parse(parsed);
      const prior = GroupSchema.safeParse(previous);
      if (
        group.members.some(
          (id) =>
            !this.snapshot().nodes.some(
              (node) => node.id === id && node.kind === 'function',
            ) && !(prior.success && prior.data.members.includes(id)),
        )
      )
        throw new ServiceError(
          422,
          'UNKNOWN_MEMBER',
          'Group members must be indexed functions',
        );
    }
    return parsed;
  }
  async create(kind: KnowledgeKind, input: unknown) {
    const parsed = this.validateKnowledge(kind, input);
    const record = {
      ...parsed,
      id: kind === 'view' ? 'workspace' : `${kind}:${randomUUID()}`,
      revision: 1,
    };
    this.storage.save(kind, record, null);
    await this.syncKnowledge(kind);
    return record;
  }
  async update(
    kind: KnowledgeKind,
    id: string,
    input: unknown,
    expectedRevision: number,
  ) {
    const current = this.get(kind, id);
    if (current.revision !== expectedRevision)
      throw new ServiceError(
        409,
        'REVISION_CONFLICT',
        'expectedRevision mismatch',
      );
    const parsed = this.validateKnowledge(kind, input, current);
    const record = { ...parsed, id, revision: expectedRevision + 1 };
    this.storage.save(kind, record, expectedRevision);
    await this.syncKnowledge(kind);
    return record;
  }
  async remove(kind: KnowledgeKind, id: string, expectedRevision: number) {
    this.get(kind, id);
    this.storage.delete(kind, id, expectedRevision);
    await this.syncKnowledge(kind);
    return { deleted: true, id };
  }
  private async syncKnowledge(kind: KnowledgeKind) {
    if (kind === 'policy')
      await this.files?.writePolicies({
        schemaVersion: 1,
        policies: this.storage.list('policy', 0, 10000),
      });
  }
  exportKnowledge(): KnowledgeExport {
    return KnowledgeExportSchema.parse({
      schemaVersion: 1,
      annotations: this.storage.list('annotation', 0, 10000),
      groups: this.storage.list('group', 0, 10000),
      policies: this.storage.list('policy', 0, 10000),
    });
  }
  async saveKnowledgeExport() {
    const data = this.exportKnowledge();
    await this.files?.writeKnowledge(data);
    return data;
  }
  previewImport(input: unknown) {
    const data = KnowledgeExportSchema.parse(input);
    const conflicts: {
      kind: KnowledgeKind;
      id: string;
      currentRevision: number;
      incomingRevision: number;
    }[] = [];
    for (const [kind, records] of [
      ['annotation', data.annotations],
      ['group', data.groups],
      ['policy', data.policies],
    ] as const) {
      const seen = new Set<string>();
      for (const record of records) {
        if (seen.has(record.id))
          throw new ServiceError(
            422,
            'DUPLICATE_IMPORT_ID',
            'Duplicate knowledge IDs',
          );
        seen.add(record.id);
        const previous = this.storage.get(kind, record.id);
        if (previous !== null)
          conflicts.push({
            kind,
            id: record.id,
            currentRevision: recordSchemas[kind].parse(previous).revision,
            incomingRevision: record.revision,
          });
      }
    }
    return {
      previewToken: hash(
        canonicalJson({ incoming: data, current: this.exportKnowledge() }),
      ),
      conflicts,
      counts: {
        annotations: data.annotations.length,
        groups: data.groups.length,
        policies: data.policies.length,
      },
    };
  }
  async importKnowledge(
    input: unknown,
    previewToken: string,
    replaceConflicts: boolean,
  ) {
    const data = KnowledgeExportSchema.parse(input),
      preview = this.previewImport(data);
    if (preview.previewToken !== previewToken)
      throw new ServiceError(
        409,
        'IMPORT_PREVIEW_STALE',
        'Knowledge changed since import preview',
      );
    if (preview.conflicts.length && !replaceConflicts)
      throw new ServiceError(
        409,
        'IMPORT_CONFLICT',
        'Explicit replacement approval is required for conflicts',
      );
    const mutations: Mutation[] = [];
    for (const [kind, records] of [
      ['annotation', data.annotations],
      ['group', data.groups],
      ['policy', data.policies],
    ] as const) {
      for (const record of records) {
        const existing = this.storage.get(kind, record.id);
        const expected =
          existing === null
            ? null
            : recordSchemas[kind].parse(existing).revision;
        mutations.push({
          kind,
          record: { ...record, revision: expected === null ? 1 : expected + 1 },
          expectedRevision: expected,
        });
      }
    }
    this.storage.commit(mutations);
    await this.syncKnowledge('policy');
    return { imported: mutations.length };
  }
  backup() {
    return this.storage.backup();
  }
  private policies(): FolderPolicy[] {
    return this.storage
      .list('policy', 0, 10000)
      .map((item) => PolicySchema.parse(item));
  }
  createPlan(input: unknown): PlanRevision {
    const parsed = PlanInputSchema.parse(input),
      snapshot = this.snapshot(parsed.baselineSnapshotId);
    const validation = validatePlan(parsed, snapshot, this.policies());
    const plan = PlanSchema.parse({
      ...parsed,
      id: `plan:${randomUUID()}`,
      revision: 1,
      baselineDigest: snapshot.baselineDigest,
      semanticHash: this.currentSemanticHash(parsed, snapshot.baselineDigest),
      status: 'draft',
      validation,
      approval: null,
    });
    this.storage.save('plan', plan, null);
    return plan;
  }
  plan(id: string): PlanRevision {
    const stored = this.storage.get('plan', id);
    if (!stored)
      throw new ServiceError(404, 'PLAN_NOT_FOUND', 'Plan not found');
    return PlanSchema.parse(stored);
  }
  private expect(plan: PlanRevision, expectedRevision: number) {
    assertExpectedRevision(plan, expectedRevision);
  }
  private currentSemanticHash(plan: PlanInput, baselineDigest: string) {
    return hash(
      planSemanticContent(plan, baselineDigest) +
        canonicalJson(
          this.policies()
            .map(
              ({ id: ignoredId, revision: ignoredRevision, ...semantic }) => {
                void ignoredId;
                void ignoredRevision;
                return semantic;
              },
            )
            .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
        ),
    );
  }
  updatePlan(
    id: string,
    input: unknown,
    expectedRevision: number,
  ): PlanRevision {
    const previous = this.plan(id),
      parsed = PlanInputSchema.parse(input),
      snapshot = this.snapshot(parsed.baselineSnapshotId);
    const updated = revisePlan(
      previous,
      parsed,
      snapshot.baselineDigest,
      this.currentSemanticHash(parsed, snapshot.baselineDigest),
      validatePlan(parsed, snapshot, this.policies()),
      expectedRevision,
    );
    this.storage.save('plan', updated, expectedRevision);
    return updated;
  }
  async validate(id: string, expectedRevision: number) {
    const plan = this.plan(id);
    this.expect(plan, expectedRevision);
    const validation = validatePlan(
      plan,
      this.snapshot(plan.baselineSnapshotId),
      this.policies(),
    );
    const updated = validationRevision(
      plan,
      validation,
      await this.indexer.fingerprint(),
      this.currentSemanticHash(plan, plan.baselineDigest),
    );
    this.storage.save('plan', updated, expectedRevision);
    return updated;
  }
  async approve(id: string, expectedRevision: number): Promise<PlanRevision> {
    const plan = this.plan(id);
    this.expect(plan, expectedRevision);
    const validation = validatePlan(
      plan,
      this.snapshot(plan.baselineSnapshotId),
      this.policies(),
    );
    const approved = approveRevision(
      plan,
      validation,
      await this.indexer.fingerprint(),
      this.currentSemanticHash(plan, plan.baselineDigest),
      new Date().toISOString(),
    );
    this.storage.save('plan', approved, expectedRevision);
    return approved;
  }
  async approved(id: string) {
    const plan = this.plan(id);
    return {
      plan,
      ...approvalValidity(
        plan,
        await this.indexer.fingerprint(),
        this.currentSemanticHash(plan, plan.baselineDigest),
      ),
    };
  }
  async begin(id: string, expectedRevision: number) {
    const plan = this.plan(id);
    this.expect(plan, expectedRevision);
    const current = await this.approved(id);
    const updated = beginRevision(plan, current);
    this.storage.save('plan', updated, expectedRevision);
    return updated;
  }
  cancel(id: string, expectedRevision: number) {
    const plan = this.plan(id);
    this.expect(plan, expectedRevision);
    const updated = cancelRevision(plan);
    this.storage.save('plan', updated, expectedRevision);
    return updated;
  }
  history(id: string, offset = 0, limit = 100) {
    this.plan(id);
    return { items: this.storage.history(id, offset, limit), offset, limit };
  }
  async verify(id: string) {
    const plan = this.plan(id);
    if (
      !plan.approval ||
      plan.approval.revision !== plan.revision ||
      plan.approval.semanticHash !== plan.semanticHash
    )
      throw new ServiceError(
        409,
        'APPROVAL_REQUIRED',
        'Verification requires the exact human-approved revision',
      );
    const current = await this.refresh();
    const result = verifyStructure(
      plan,
      this.snapshot(plan.baselineSnapshotId),
      current,
    );
    const { items, bindings } = result;
    const report = VerificationReportSchema.parse({
      id: `verification:${randomUUID()}`,
      revision: 1,
      planId: plan.id,
      planRevision: plan.revision,
      snapshotId: current.id,
      createdAt: new Date().toISOString(),
      items,
      bindings,
      behaviorVerified: false,
    });
    const updated: PlanRevision = {
      ...plan,
      status: items.every((item) => item.status === 'satisfied')
        ? 'completed'
        : items.some((item) => item.status === 'unsatisfied')
          ? 'needs_revision'
          : 'verifying',
    };
    this.storage.commit([
      { kind: 'verification', record: report, expectedRevision: null },
      { kind: 'plan', record: updated, expectedRevision: plan.revision },
    ]);
    return report;
  }
  verification(id: string) {
    const report = this.storage.get('verification', id);
    if (report === null)
      throw new ServiceError(
        404,
        'REPORT_NOT_FOUND',
        'Verification report not found',
      );
    return VerificationReportSchema.parse(report);
  }
  close() {
    this.storage.close();
  }
}
