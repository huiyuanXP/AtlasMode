import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '@codemap/core';
import { createServer, serverPort } from './index.js';

describe('P0 HTTP boundary', () => {
  it('reports health without claiming future capabilities', async () => {
    const app = createServer();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      const health = HealthResponseSchema.parse(response.json());
      expect(health.capabilities).toEqual({
        indexing: false,
        persistence: false,
        planApproval: false,
        mcp: false,
      });
    } finally {
      await app.close();
    }
  });
  it('does not expose a fabricated approval endpoint', async () => {
    const app = createServer();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/plans/approve',
        payload: { approved: true },
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
  it('supports default and explicitly configured ports', () => {
    expect(serverPort(undefined)).toBe(4310);
    expect(serverPort('14310')).toBe(14310);
  });
  it.each(['', '0', '-1', '65536', '4310.5', '0x10', 'invalid', ' 4310 '])(
    'rejects invalid port %j before listening',
    (raw) => {
      expect(() => serverPort(raw)).toThrow('CODEMAP_PORT');
    },
  );
});
