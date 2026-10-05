import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import { HealthResponseSchema } from '@codemap/core';
import type { ProjectService } from '@codemap/service';
import { registerProjectRoutes } from './routes.js';
import { createRuntime } from './runtime.js';
export { createRuntime } from './runtime.js';
export function serverPort(raw: string | undefined): number {
  if (raw === undefined) return 4310;
  if (!/^[0-9]+$/.test(raw))
    throw new Error('CODEMAP_PORT must be an integer from 1 to 65535');
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('CODEMAP_PORT must be an integer from 1 to 65535');
  return port;
}
export function createServer(service?: ProjectService) {
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 });
  const health = HealthResponseSchema.parse({
    status: 'ok',
    service: 'atlasmode',
    phase: service ? 'V1' : 'P0',
    dataSource: service ? 'code' : 'demo',
    capabilities: {
      indexing: !!service,
      persistence: !!service,
      planApproval: !!service,
      mcp: !!service,
    },
  });
  app.get('/api/health', async () => health);
  if (service) {
    registerProjectRoutes(app, service);
    app.addHook('onClose', async () => service.close());
  }
  return app;
}
async function main() {
  const root =
    process.env.CODEMAP_WORKSPACE_ROOT ??
    fileURLToPath(new URL('../../../', import.meta.url));
  const port = serverPort(process.env.CODEMAP_PORT);
  const service = await createRuntime(root, process.env.CODEMAP_DATA_DIR);
  const app = createServer(service);
  try {
    const address = await app.listen({ host: '127.0.0.1', port });
    console.log(`AtlasMode real-index API listening at ${address}`);
  } catch (error) {
    await app.close();
    throw error;
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void app.close().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
