import { z } from 'zod';

const demoId = z.string().startsWith('demo:').min(6);
const relativeFilePath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('\\') &&
      !value
        .split('/')
        .some(
          (segment) => segment === '..' || segment === '.' || segment === '',
        ),
    'Expected a repository-relative file path without traversal',
  );

export const DemoNodeSchema = z.discriminatedUnion('kind', [
  z
    .object({ id: demoId, kind: z.literal('file'), path: relativeFilePath })
    .strict(),
  z
    .object({
      id: demoId,
      kind: z.literal('function'),
      name: z.string().min(1),
      fileId: demoId,
      signature: z.string().min(1),
    })
    .strict(),
]);

export const DemoRelationSchema = z
  .object({
    id: demoId,
    source: demoId,
    target: demoId,
    type: z.enum(['calls', 'contains']),
  })
  .strict();

// Demo data deliberately has no snapshot ID, baseline, or claim of parser evidence.
export const DemoGraphSchema = z
  .object({
    source: z.literal('demo'),
    nodes: z.array(DemoNodeSchema),
    relations: z.array(DemoRelationSchema),
  })
  .strict()
  .superRefine((graph, context) => {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    if (nodes.size !== graph.nodes.length) {
      context.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'Node IDs must be unique',
      });
    }
    graph.nodes.forEach((node, index) => {
      if (node.kind === 'function' && nodes.get(node.fileId)?.kind !== 'file') {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'fileId'],
          message: 'Function must belong to an existing file',
        });
      }
    });
    const relationIds = new Set<string>();
    graph.relations.forEach((relation, index) => {
      const source = nodes.get(relation.source);
      const target = nodes.get(relation.target);
      let message: string | undefined;
      if (relationIds.has(relation.id)) message = 'Relation IDs must be unique';
      else if (!source || !target) message = 'Relation endpoints must exist';
      else if (
        relation.type === 'calls' &&
        (source.kind !== 'function' || target.kind !== 'function')
      )
        message = 'Calls connect functions';
      else if (
        relation.type === 'contains' &&
        (source.kind !== 'file' ||
          target.kind !== 'function' ||
          target.fileId !== source.id)
      )
        message = 'Contains must match function file ownership';
      relationIds.add(relation.id);
      if (message)
        context.addIssue({
          code: 'custom',
          path: ['relations', index],
          message,
        });
    });
  });

export type DemoGraph = z.infer<typeof DemoGraphSchema>;
export type DemoNode = z.infer<typeof DemoNodeSchema>;
