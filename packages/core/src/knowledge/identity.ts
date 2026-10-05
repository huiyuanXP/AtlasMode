import { z } from 'zod';
import { IdSchema, RelativePathSchema } from '../graph/code-snapshot.js';
import type { CodeSnapshot, FunctionNode } from '../graph/code-snapshot.js';
const symbol = z
  .object({
    id: IdSchema,
    name: z.string(),
    filePath: RelativePathSchema,
    signature: z.string(),
  })
  .strict();
export const IdentityCandidateSchema = z
  .object({
    previous: symbol,
    candidate: symbol,
    reason: z.string(),
    requiresHumanConfirmation: z.literal(true),
  })
  .strict();
export const IdentityRecordSchema = z
  .object({
    id: z.literal('workspace'),
    revision: z.number().int().positive(),
    previousSnapshotId: IdSchema.nullable(),
    snapshotId: IdSchema,
    candidates: z.array(IdentityCandidateSchema).max(2000),
    confirmed: z.array(
      z
        .object({
          previousId: IdSchema,
          currentId: IdSchema,
          snapshotId: IdSchema,
          actor: z.literal('local-user'),
          confirmedAt: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export type IdentityRecord = z.infer<typeof IdentityRecordSchema>;
export function identityCandidates(
  previous: CodeSnapshot,
  current: CodeSnapshot,
): z.infer<typeof IdentityCandidateSchema>[] {
  const prior = previous.nodes.filter(
      (node): node is FunctionNode => node.kind === 'function',
    ),
    next = current.nodes.filter(
      (node): node is FunctionNode => node.kind === 'function',
    );
  const currentIds = new Set(next.map((node) => node.id)),
    previousIds = new Set(prior.map((node) => node.id));
  const added = next.filter((node) => !previousIds.has(node.id)),
    removed = prior.filter((node) => !currentIds.has(node.id));
  const file = (snapshot: CodeSnapshot, node: FunctionNode) => {
    const entry = snapshot.nodes.find((item) => item.id === node.fileId);
    return entry?.kind === 'file' ? entry.path : '';
  };
  const shape = (snapshot: CodeSnapshot, node: FunctionNode) => ({
    id: node.id,
    name: node.qualifiedName,
    filePath: file(snapshot, node),
    signature: node.signature,
  });
  const buckets = new Map<string, FunctionNode[]>();
  for (const node of added) {
    const key = node.symbolKind + '|' + node.signature;
    const group = buckets.get(key) ?? [];
    group.push(node);
    buckets.set(key, group);
  }
  const candidates: z.infer<typeof IdentityCandidateSchema>[] = [];
  for (const old of removed) {
    for (const candidate of buckets.get(old.symbolKind + '|' + old.signature) ??
      []) {
      if (
        old.qualifiedName !== candidate.qualifiedName &&
        file(previous, old) !== file(current, candidate)
      )
        continue;
      candidates.push({
        previous: shape(previous, old),
        candidate: shape(current, candidate),
        reason:
          'Declaration kind and static signature match; name or file changed. This is only a candidate, not a confirmed identity.',
        requiresHumanConfirmation: true,
      });
      if (candidates.length === 2000) return candidates;
    }
  }
  return candidates;
}
