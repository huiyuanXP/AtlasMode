import { z } from 'zod';

export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('atlasmode'),
    phase: z.enum(['P0', 'V1']),
    dataSource: z.enum(['demo', 'code']),
    capabilities: z
      .object({
        indexing: z.boolean(),
        persistence: z.boolean(),
        planApproval: z.boolean(),
        mcp: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
