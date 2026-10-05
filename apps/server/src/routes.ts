import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  PlanInputSchema,
  KnowledgeExportSchema,
  PlanningRuleError,
} from '@codemap/core';
import type { ProjectService, KnowledgeKind } from '@codemap/service';
import { ServiceError } from '@codemap/service';
const pagination = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const idParams = z.object({ id: z.string().min(1).max(256) });
const revision = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
const update = revision.extend({ data: z.unknown() }).strict();
function loopbackOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      ['http:', 'https:'].includes(url.protocol)
    );
  } catch {
    return false;
  }
}
export function registerProjectRoutes(
  app: FastifyInstance,
  service: ProjectService,
) {
  const uiToken = randomUUID();
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (
      (origin && !loopbackOrigin(origin)) ||
      request.headers['sec-fetch-site'] === 'cross-site'
    )
      return reply.code(403).send({
        code: 'ORIGIN_REJECTED',
        message: 'Only local UI origins are accepted',
      });
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        code: 'INVALID_INPUT',
        message: 'Request schema validation failed',
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    if (error instanceof PlanningRuleError)
      return reply
        .code(error.code === 'INVALID_PLAN' ? 422 : 409)
        .send({ code: error.code, message: error.message });
    if (error instanceof ServiceError)
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message });
    const failure: Error & { code?: string; statusCode?: number } =
      error instanceof Error ? error : new Error('Unknown failure');
    if ('code' in failure && failure.code === 'REVISION_CONFLICT')
      return reply
        .code(409)
        .send({ code: 'REVISION_CONFLICT', message: failure.message });
    const status =
      typeof failure.statusCode === 'number' ? failure.statusCode : 500;
    if (status >= 500) console.error('API operation failed:', failure.message);
    return reply.code(status).send({
      code: 'REQUEST_FAILED',
      message:
        status >= 500
          ? 'Operation failed; inspect local service logs'
          : failure.message,
    });
  });
  app.get('/api/ui/session', async () => ({ approvalToken: uiToken }));
  app.get('/api/identity', async (request) => {
    const query = pagination.parse(request.query);
    return service.identities(query.offset, query.limit);
  });
  app.post('/api/identity/confirm', async (request, reply) => {
    if (request.headers['x-atlasmode-ui-token'] !== uiToken)
      return reply.code(403).send({
        code: 'HUMAN_CONFIRMATION_REQUIRED',
        message: 'Identity rebinding requires local UI confirmation',
      });
    const body = z
      .object({
        previousId: z.string(),
        currentId: z.string(),
        expectedRevision: z.number().int().positive(),
      })
      .strict()
      .parse(request.body);
    return service.confirmIdentity(
      body.previousId,
      body.currentId,
      body.expectedRevision,
    );
  });

  app.get('/api/project', async () => service.summary());
  app.get('/api/snapshots', async (request) => {
    const query = pagination.parse(request.query);
    return service.snapshots(query.offset, query.limit);
  });
  app.post('/api/index/refresh', async () => {
    await service.refresh();
    return service.summary();
  });
  app.get('/api/functions', async (request) => {
    const query = pagination
      .extend({ query: z.string().max(500).default('') })
      .parse(request.query);
    return service.search(query.query, query.offset, query.limit);
  });
  app.get('/api/functions/:id', async (request) =>
    service.context(
      idParams.parse(request.params).id,
      pagination.parse(request.query).limit,
    ),
  );
  app.post('/api/graph', async (request) => {
    const input = z
      .object({
        seeds: z.array(z.string()).max(50).default([]),
        depth: z.number().int().min(0).max(3).default(1),
        budget: z.number().int().min(5).max(200).default(100),
        types: z.array(z.enum(['calls', 'imports', 'contains'])).optional(),
      })
      .strict()
      .parse(request.body);
    return service.graph(input.seeds, input.depth, input.budget, input.types);
  });
  for (const [plural, kind] of [
    ['annotations', 'annotation'],
    ['groups', 'group'],
    ['policies', 'policy'],
    ['views', 'view'],
  ] as const) {
    app.get(`/api/${plural}`, async (request) => {
      const query = pagination.parse(request.query);
      return service.list(kind, query.offset, query.limit);
    });
    app.get(`/api/${plural}/:id`, async (request) =>
      service.get(kind, idParams.parse(request.params).id),
    );
    app.post(`/api/${plural}`, async (request) =>
      service.create(kind, request.body),
    );
    app.put(`/api/${plural}/:id`, async (request) => {
      const body = update.parse(request.body);
      return service.update(
        kind,
        idParams.parse(request.params).id,
        body.data,
        body.expectedRevision,
      );
    });
    app.delete(`/api/${plural}/:id`, async (request) =>
      service.remove(
        kind,
        idParams.parse(request.params).id,
        revision.parse(request.body).expectedRevision,
      ),
    );
  }
  app.get('/api/knowledge/export', async () => service.saveKnowledgeExport());
  app.post('/api/knowledge/import/preview', async (request) =>
    service.previewImport(KnowledgeExportSchema.parse(request.body)),
  );
  app.post('/api/knowledge/import', async (request) => {
    const body = z
      .object({
        data: KnowledgeExportSchema,
        previewToken: z.string(),
        replaceConflicts: z.boolean().default(false),
      })
      .strict()
      .parse(request.body);
    return service.importKnowledge(
      body.data,
      body.previewToken,
      body.replaceConflicts,
    );
  });
  app.post('/api/storage/backup', async () => ({
    filename: await service.backup(),
  }));
  app.get('/api/plans', async (request) => {
    const query = pagination.parse(request.query);
    return service.list('plan', query.offset, query.limit);
  });
  app.post('/api/plans', async (request) =>
    service.createPlan(PlanInputSchema.parse(request.body)),
  );
  app.get('/api/plans/:id', async (request) =>
    service.plan(idParams.parse(request.params).id),
  );
  app.put('/api/plans/:id', async (request) => {
    const body = update.parse(request.body);
    return service.updatePlan(
      idParams.parse(request.params).id,
      PlanInputSchema.parse(body.data),
      body.expectedRevision,
    );
  });
  app.delete('/api/plans/:id', async (request) =>
    service.cancel(
      idParams.parse(request.params).id,
      revision.parse(request.body).expectedRevision,
    ),
  );
  app.get('/api/plans/:id/history', async (request) => {
    const query = pagination.parse(request.query);
    return service.history(
      idParams.parse(request.params).id,
      query.offset,
      query.limit,
    );
  });
  app.post('/api/plans/:id/validate', async (request) =>
    service.validate(
      idParams.parse(request.params).id,
      revision.parse(request.body).expectedRevision,
    ),
  );
  app.get('/api/plans/:id/approved', async (request) =>
    service.approved(idParams.parse(request.params).id),
  );
  app.post('/api/plans/:id/approve', async (request, reply) => {
    if (request.headers['x-atlasmode-ui-token'] !== uiToken)
      return reply.code(403).send({
        code: 'HUMAN_CONFIRMATION_REQUIRED',
        message:
          'Approval is available only through the local UI confirmation flow',
      });
    const id = idParams.parse(request.params).id;
    const body = revision
      .extend({ semanticHash: z.string() })
      .strict()
      .parse(request.body);
    if (service.plan(id).semanticHash !== body.semanticHash)
      throw new ServiceError(
        409,
        'SEMANTIC_HASH_MISMATCH',
        'Displayed semantic content no longer matches',
      );
    return service.approve(id, body.expectedRevision);
  });
  app.post('/api/plans/:id/implement', async (request) =>
    service.begin(
      idParams.parse(request.params).id,
      revision.parse(request.body).expectedRevision,
    ),
  );
  app.post('/api/plans/:id/verify', async (request) =>
    service.verify(idParams.parse(request.params).id),
  );
  app.get('/api/verifications', async (request) => {
    const query = pagination.parse(request.query);
    return service.list('verification', query.offset, query.limit);
  });
  app.get('/api/verifications/:id', async (request) =>
    service.verification(idParams.parse(request.params).id),
  );
}
export type { KnowledgeKind };
