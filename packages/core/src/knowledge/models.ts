import { z } from 'zod';
import { IdSchema, RelativePathSchema } from '../graph/code-snapshot.js';
const base = { id: IdSchema, revision: z.number().int().positive() };
export const OriginSchema = z.enum(['user', 'agent']);
export const AnnotationInputSchema = z
  .object({
    targetId: IdSchema,
    text: z.string().min(1).max(20000),
    source: OriginSchema,
    constraint: z.boolean(),
  })
  .strict();
export const AnnotationSchema = AnnotationInputSchema.extend(base);
export const GroupInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    type: z.literal('capability'),
    members: z
      .array(IdSchema)
      .min(1)
      .max(1000)
      .refine(
        (items) => new Set(items).size === items.length,
        'Duplicate members',
      ),
    description: z.string().max(20000),
    source: OriginSchema,
    guidance: z.enum(['reference', 'must_reuse']),
  })
  .strict();
export const GroupSchema = GroupInputSchema.extend(base);
export const PolicyInputSchema = z
  .object({
    path: z.union([z.literal('.'), RelativePathSchema]),
    purpose: z.string().min(1).max(20000),
    forbiddenDependencies: z.array(z.string().min(1)).max(256),
    allowedDependencies: z.array(z.string().min(1)).max(256),
    exceptions: z
      .array(
        z
          .object({ dependency: z.string(), reason: z.string().min(1) })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const PolicySchema = PolicyInputSchema.extend(base);
export const ViewInputSchema = z
  .object({
    positions: z.record(
      IdSchema,
      z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
    ),
    collapsed: z.array(IdSchema),
    viewport: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        zoom: z.number().min(0.05).max(10),
      })
      .strict(),
  })
  .strict();
export const ViewStateSchema = ViewInputSchema.extend(base);
export const KnowledgeExportSchema = z
  .object({
    schemaVersion: z.literal(1),
    annotations: z.array(AnnotationSchema),
    groups: z.array(GroupSchema),
    policies: z.array(PolicySchema),
  })
  .strict();
export type Annotation = z.infer<typeof AnnotationSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type FolderPolicy = z.infer<typeof PolicySchema>;
export type ViewState = z.infer<typeof ViewStateSchema>;
export type KnowledgeExport = z.infer<typeof KnowledgeExportSchema>;
