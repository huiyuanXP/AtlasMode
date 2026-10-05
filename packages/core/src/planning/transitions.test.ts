import { describe, expect, it } from 'vitest';
import { CodeSnapshotSchema } from '../graph/code-snapshot.js';
import { PlanInputSchema, PlanSchema, planSemanticContent } from './models.js';
import { validatePlan } from './validate.js';
import {
  approveRevision,
  approvalValidity,
  revisePlan,
  validationRevision,
  cancelRevision,
} from './transitions.js';
import { PolicySchema } from '../knowledge/models.js';
const span = { start: 0, end: 10, startLine: 1, endLine: 1 };
const snapshot = CodeSnapshotSchema.parse({
  id: 'snapshot:fixture',
  repositoryId: 'repo:fixture',
  source: 'code',
  createdAt: '2026-10-04T00:00:00Z',
  gitRevision: null,
  baselineDigest: 'baseline',
  fileHashes: { 'src/http.ts': 'hash' },
  nodes: [
    { id: 'folder:root', kind: 'folder', path: '.', parentId: null },
    { id: 'folder:src', kind: 'folder', path: 'src', parentId: 'folder:root' },
    {
      id: 'file:http',
      kind: 'file',
      path: 'src/http.ts',
      parentId: 'folder:src',
      contentHash: 'hash',
    },
    {
      id: 'fn:retry',
      kind: 'function',
      name: 'retry',
      qualifiedName: 'retry',
      fileId: 'file:http',
      signature: '() => string',
      range: span,
      exported: true,
      symbolKind: 'declaration',
    },
  ],
  relations: [],
  scope: {
    included: ['src/http.ts'],
    excluded: [],
    limits: { maxFiles: 10, maxBytes: 1000 },
    diagnostics: [],
  },
});
const input = PlanInputSchema.parse({
  baselineSnapshotId: snapshot.id,
  title: 'Fetch using retry',
  reason: 'Reuse an existing entry',
  source: 'agent',
  changes: [
    {
      op: 'add_function',
      id: 'plan:fetch',
      name: 'fetch',
      signature: '() => string',
      filePath: 'src/services/notes.ts',
    },
    {
      op: 'add_call',
      id: 'plan:call',
      source: 'plan:fetch',
      target: 'fn:retry',
    },
  ],
  requirements: [
    {
      type: 'must_call',
      nodeId: 'plan:fetch',
      target: 'fn:retry',
      reason: 'Reuse retry',
    },
  ],
});
function draft() {
  return PlanSchema.parse({
    ...input,
    id: 'plan:fixture',
    revision: 1,
    baselineDigest: 'baseline',
    semanticHash: 'semantic',
    status: 'draft',
    validation: validatePlan(input, snapshot, []),
    approval: null,
  });
}
describe('pure planning and approval invariants', () => {
  it('keeps an approved revision frozen and revokes it on semantic revision', () => {
    const approved = approveRevision(
      draft(),
      draft().validation,
      'baseline',
      'semantic',
      '2026-10-04T00:00:00Z',
    );
    expect(approvalValidity(approved, 'baseline', 'semantic').valid).toBe(true);
    const changed = revisePlan(
      approved,
      { ...input, title: 'Different intent' },
      'baseline',
      'different',
      draft().validation,
      1,
    );
    expect(changed.revision).toBe(2);
    expect(changed.approval).toBeNull();
    expect(approved.approval?.semanticHash).toBe('semantic');
    expect(() =>
      revisePlan(
        approved,
        input,
        'baseline',
        'semantic',
        draft().validation,
        9,
      ),
    ).toThrow('expectedRevision');
  });
  it('blocks stale baselines and changed constraints without replacing the approved hash', () => {
    const approved = approveRevision(
      draft(),
      draft().validation,
      'baseline',
      'semantic',
      'time',
    );
    expect(approvalValidity(approved, 'changed', 'semantic').valid).toBe(false);
    expect(approvalValidity(approved, 'baseline', 'different').valid).toBe(
      false,
    );
    expect(() =>
      approveRevision(
        draft(),
        draft().validation,
        'changed',
        'semantic',
        'time',
      ),
    ).toThrow('Refresh');
    expect(
      validationRevision(approved, approved.validation, 'changed', 'semantic')
        .status,
    ).toBe('stale');
  });
  it('does not resurrect a cancelled plan through validation', () => {
    const cancelled = cancelRevision(draft());
    expect(() =>
      validationRevision(
        cancelled,
        cancelled.validation,
        'baseline',
        'semantic',
      ),
    ).toThrow('new revision');
    expect(() =>
      revisePlan(
        cancelled,
        input,
        'baseline',
        'semantic',
        cancelled.validation,
        cancelled.revision,
      ),
    ).toThrow('cancelled');
  });
  it('enforces complete file names and rejects client approval injection', () => {
    expect(
      PlanInputSchema.safeParse({ ...input, approved: true }).success,
    ).toBe(false);
    expect(
      PlanInputSchema.safeParse({
        ...input,
        changes: [
          {
            op: 'add_function',
            id: 'plan:new',
            name: 'newFn',
            signature: '() => void',
            filePath: 'src/services',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      planSemanticContent(
        { ...input, layout: { x: 10, y: 20 } } as typeof input,
        'baseline',
      ),
    ).toBe(planSemanticContent(input, 'baseline'));
  });
  it('checks explicit directory bans/allowlists and honors reasoned exceptions', () => {
    const policy = PolicySchema.parse({
      id: 'policy:test',
      revision: 1,
      path: 'src/services',
      purpose: 'Service orchestration',
      forbiddenDependencies: ['src/http.ts'],
      allowedDependencies: [],
      exceptions: [],
    });
    expect(
      validatePlan(input, snapshot, [policy]).errors.some((message) =>
        message.includes('Forbidden'),
      ),
    ).toBe(true);
    expect(
      validatePlan(input, snapshot, [
        {
          ...policy,
          exceptions: [
            { dependency: 'src/http.ts', reason: 'Approved retry entry' },
          ],
        },
      ]).errors,
    ).toEqual([]);
    expect(
      validatePlan(input, snapshot, [
        {
          ...policy,
          forbiddenDependencies: [],
          allowedDependencies: ['src/elsewhere'],
        },
      ]).errors.some((message) => message.includes('allowlist')),
    ).toBe(true);
  });
  it('allows self-recursion and flags insufficient interface evidence as unknown', () => {
    const recursive = {
      ...input,
      changes: [
        input.changes[0]!,
        {
          op: 'add_call' as const,
          id: 'plan:recursive',
          source: 'plan:fetch',
          target: 'plan:fetch',
        },
      ],
      requirements: [],
    };
    const validation = validatePlan(recursive, snapshot, []);
    expect(validation.errors).toEqual([]);
    expect(validation.unknown.length).toBeGreaterThan(0);
  });
});
