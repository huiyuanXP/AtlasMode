import { z } from 'zod';
export const IdSchema = z.string().min(1).max(256);
export const RelativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path.includes(':') &&
      !path.split('/').some((part) => !part || part === '.' || part === '..'),
    'Expected a repository-relative path',
  );
export const SourceFilePathSchema = RelativePathSchema.refine(
  (value) => /\.(?:[cm]?[jt]s|tsx|jsx)$/.test(value),
  'A complete TS/JS source filename is required',
);
export const SourceRangeSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .strict();
export const CodeNodeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      id: IdSchema,
      kind: z.literal('folder'),
      path: z.union([z.literal('.'), RelativePathSchema]),
      parentId: IdSchema.nullable(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      kind: z.literal('file'),
      path: RelativePathSchema,
      parentId: IdSchema,
      contentHash: z.string(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      kind: z.literal('function'),
      name: z.string(),
      qualifiedName: z.string(),
      fileId: IdSchema,
      signature: z.string(),
      range: SourceRangeSchema,
      exported: z.boolean(),
      symbolKind: z.enum([
        'declaration',
        'arrow',
        'expression',
        'method',
        'constructor',
        'callback',
      ]),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      kind: z.literal('external'),
      packageName: z.string(),
      version: z.string().nullable(),
    })
    .strict(),
]);
export const CodeRelationSchema = z
  .object({
    id: IdSchema,
    source: IdSchema,
    target: IdSchema.nullable(),
    type: z.enum(['calls', 'imports', 'contains']),
    sourceKind: z.literal('code'),
    resolution: z.enum(['resolved', 'unresolved']),
    expression: z.string(),
    reason: z.string().nullable(),
    evidence: z
      .object({ fileId: IdSchema, range: SourceRangeSchema })
      .strict()
      .nullable(),
  })
  .strict();
export const CodeSnapshotSchema = z
  .object({
    id: IdSchema,
    repositoryId: IdSchema,
    createdAt: z.string(),
    source: z.literal('code'),
    gitRevision: z.string().nullable(),
    baselineDigest: z.string(),
    fileHashes: z.record(z.string(), z.string()),
    nodes: z.array(CodeNodeSchema),
    relations: z.array(CodeRelationSchema),
    scope: z
      .object({
        included: z.array(z.string()),
        configuration: z.array(z.string()).default([]),
        excluded: z.array(z.object({ path: z.string(), reason: z.string() })),
        limits: z.object({
          maxFiles: z.number(),
          maxBytes: z.number(),
          maxEntries: z.number().default(100000),
        }),
        diagnostics: z.array(z.string()),
      })
      .strict(),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
    if (nodes.size !== snapshot.nodes.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate node IDs' });
    for (const node of snapshot.nodes) {
      if (node.kind === 'function' && nodes.get(node.fileId)?.kind !== 'file')
        ctx.addIssue({
          code: 'custom',
          message: `Invalid function file: ${node.id}`,
        });
      if (
        (node.kind === 'file' || node.kind === 'folder') &&
        node.parentId !== null &&
        nodes.get(node.parentId)?.kind !== 'folder'
      )
        ctx.addIssue({
          code: 'custom',
          message: `Invalid parent folder: ${node.id}`,
        });
    }
    const ids = new Set<string>();
    for (const relation of snapshot.relations) {
      if (ids.has(relation.id))
        ctx.addIssue({ code: 'custom', message: 'Duplicate relation IDs' });
      ids.add(relation.id);
      if (
        !nodes.has(relation.source) ||
        (relation.target !== null && !nodes.has(relation.target))
      )
        ctx.addIssue({
          code: 'custom',
          message: `Dangling relation: ${relation.id}`,
        });
      if (
        relation.resolution === 'unresolved' &&
        (!relation.reason || relation.target !== null)
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'Unresolved relation needs a reason and no fabricated target',
        });
      if (relation.resolution === 'resolved' && relation.target === null)
        ctx.addIssue({
          code: 'custom',
          message: 'Resolved relation needs a target',
        });
    }
  });
export type CodeNode = z.infer<typeof CodeNodeSchema>;
export type FunctionNode = Extract<CodeNode, { kind: 'function' }>;
export type CodeRelation = z.infer<typeof CodeRelationSchema>;
export type CodeSnapshot = z.infer<typeof CodeSnapshotSchema>;
