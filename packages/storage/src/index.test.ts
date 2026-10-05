import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SqliteStorage } from './index.js';
describe('SQLite persistence and concurrency', () => {
  it('retains records across restart, rolls back conflicting multi-writes, and preserves plan history', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'atlasmode-db-'));
    const filename = path.join(directory, 'data.sqlite');
    let store = new SqliteStorage(filename);
    try {
      const annotation = {
        id: 'annotation:test',
        revision: 1,
        targetId: 'fn:test',
        text: 'Keep this note',
        source: 'user',
        constraint: false,
      };
      store.save('annotation', annotation, null);
      store.close();
      store = new SqliteStorage(filename);
      expect(store.get('annotation', annotation.id)).toEqual(annotation);
      expect(() =>
        store.commit([
          {
            kind: 'annotation',
            record: { ...annotation, revision: 2, text: 'Updated' },
            expectedRevision: 1,
          },
          {
            kind: 'group',
            record: { id: 'missing', revision: 2 },
            expectedRevision: 1,
          },
        ]),
      ).toThrow('expectedRevision');
      expect(store.get('annotation', annotation.id)).toEqual(annotation);
      store.save('plan', { id: 'plan:test', revision: 1 }, null);
      store.save('plan', { id: 'plan:test', revision: 2 }, 1);
      expect(store.history('plan:test')).toHaveLength(2);
      expect(() => store.delete('plan', 'plan:test', 2)).toThrow('history');
      expect(() =>
        store.save('annotation', { ...annotation, revision: 2 }, 8),
      ).toThrow('expectedRevision');
      const backup = await store.backup();
      expect(backup).toMatch(/^backup-.*\.sqlite$/);
      store.delete('annotation', annotation.id, 1);
      expect(store.get('annotation', annotation.id)).toBeNull();
    } finally {
      store.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
