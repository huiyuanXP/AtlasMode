import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { CodeSnapshotSchema } from '@codemap/core';
import type {
  CodeSnapshot,
  EntityKind,
  StoragePort,
  StoredRecord,
  Mutation,
} from '@codemap/core';
export class RevisionConflict extends Error {
  readonly code = 'REVISION_CONFLICT';
  constructor() {
    super('expectedRevision does not match the stored revision');
  }
}
export class SqliteStorage implements StoragePort {
  private readonly db: Database.Database;
  private readonly directory: string;
  constructor(filename: string) {
    this.directory = path.dirname(filename);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.db = new Database(filename);
    chmodSync(filename, 0o600);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, digest TEXT NOT NULL, applied_at TEXT NOT NULL)',
    );
    const sql = readFileSync(
      new URL('../migrations/001-initial.sql', import.meta.url),
      'utf8',
    );
    const digest = createHash('sha256').update(sql).digest('hex');
    const previous = this.db
      .prepare('SELECT digest FROM migrations WHERE version=1')
      .get() as { digest: string } | undefined;
    if (previous && previous.digest !== digest)
      throw new Error(
        'Migration 1 has changed after application; add a new migration',
      );
    if (!previous)
      this.db.transaction(() => {
        this.db.exec(sql);
        this.db
          .prepare('INSERT INTO migrations VALUES (1,?,?)')
          .run(digest, new Date().toISOString());
      })();
  }
  saveSnapshot(snapshot: CodeSnapshot): void {
    this.db.transaction(() => {
      const repository = this.db
        .prepare("SELECT value FROM settings WHERE key='repository_id'")
        .get() as { value: string } | undefined;
      if (repository && repository.value !== snapshot.repositoryId)
        throw new Error(
          'Data directory belongs to a different target repository',
        );
      this.db
        .prepare("INSERT OR IGNORE INTO settings VALUES ('repository_id',?)")
        .run(snapshot.repositoryId);
      this.db
        .prepare('INSERT OR IGNORE INTO snapshots VALUES (?,?,?,?,?)')
        .run(
          snapshot.id,
          snapshot.repositoryId,
          snapshot.createdAt,
          snapshot.baselineDigest,
          JSON.stringify(snapshot),
        );
      this.db
        .prepare(
          "INSERT INTO settings VALUES ('latest_snapshot_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(snapshot.id);
    })();
  }
  getSnapshot(id?: string): CodeSnapshot | null {
    const row = (
      id
        ? this.db.prepare('SELECT data FROM snapshots WHERE id=?').get(id)
        : this.db
            .prepare(
              "SELECT data FROM snapshots WHERE id=(SELECT value FROM settings WHERE key='latest_snapshot_id')",
            )
            .get()
    ) as { data: string } | undefined;
    return row ? CodeSnapshotSchema.parse(JSON.parse(row.data)) : null;
  }
  listSnapshots(offset: number, limit: number) {
    return this.db
      .prepare(
        'SELECT id,created_at AS createdAt,baseline_digest AS baselineDigest FROM snapshots ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(limit, offset) as {
      id: string;
      createdAt: string;
      baselineDigest: string;
    }[];
  }
  get(kind: EntityKind, id: string): unknown | null {
    const row = this.db
      .prepare('SELECT data FROM entities WHERE kind=? AND id=?')
      .get(kind, id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }
  list(kind: EntityKind, offset = 0, limit = 1000): unknown[] {
    return (
      this.db
        .prepare(
          'SELECT data FROM entities WHERE kind=? ORDER BY id LIMIT ? OFFSET ?',
        )
        .all(kind, limit, offset) as { data: string }[]
    ).map((row) => JSON.parse(row.data));
  }
  private write(
    kind: EntityKind,
    record: StoredRecord,
    expectedRevision: number | null,
  ): void {
    const previous = this.db
      .prepare('SELECT revision FROM entities WHERE kind=? AND id=?')
      .get(kind, record.id) as { revision: number } | undefined;
    if (
      expectedRevision === null
        ? previous !== undefined
        : previous?.revision !== expectedRevision
    )
      throw new RevisionConflict();
    const data = JSON.stringify(record);
    this.db
      .prepare(
        'INSERT INTO entities VALUES (?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,data=excluded.data',
      )
      .run(kind, record.id, record.revision, data);
    if (kind === 'plan')
      this.db
        .prepare(
          'INSERT INTO plan_history VALUES (?,?,?) ON CONFLICT(id,revision) DO UPDATE SET data=excluded.data',
        )
        .run(record.id, record.revision, data);
    this.db
      .prepare(
        'INSERT INTO audit(kind,id,action,revision,created_at,data) VALUES (?,?,?,?,?,?)',
      )
      .run(
        kind,
        record.id,
        previous ? 'update' : 'create',
        record.revision,
        new Date().toISOString(),
        data,
      );
  }
  save(
    kind: EntityKind,
    record: StoredRecord,
    expectedRevision: number | null,
  ): void {
    this.db.transaction(() => this.write(kind, record, expectedRevision))();
  }
  commit(mutations: Mutation[]): void {
    this.db.transaction(() => {
      for (const mutation of mutations)
        this.write(mutation.kind, mutation.record, mutation.expectedRevision);
    })();
  }
  delete(kind: EntityKind, id: string, expectedRevision: number): void {
    if (kind === 'plan' || kind === 'verification')
      throw new Error('Plan and verification history must be retained');
    this.db.transaction(() => {
      const previous = this.db
        .prepare('SELECT revision,data FROM entities WHERE kind=? AND id=?')
        .get(kind, id) as { revision: number; data: string } | undefined;
      if (previous?.revision !== expectedRevision) throw new RevisionConflict();
      this.db
        .prepare('DELETE FROM entities WHERE kind=? AND id=?')
        .run(kind, id);
      this.db
        .prepare(
          'INSERT INTO audit(kind,id,action,revision,created_at,data) VALUES (?,?,?,?,?,?)',
        )
        .run(
          kind,
          id,
          'delete',
          expectedRevision,
          new Date().toISOString(),
          previous.data,
        );
    })();
  }
  history(planId: string, offset = 0, limit = 100): unknown[] {
    return (
      this.db
        .prepare(
          'SELECT data FROM plan_history WHERE id=? ORDER BY revision LIMIT ? OFFSET ?',
        )
        .all(planId, limit, offset) as { data: string }[]
    ).map((row) => JSON.parse(row.data));
  }
  async backup(): Promise<string> {
    const destination = path.join(
      this.directory,
      `backup-${randomUUID()}.sqlite`,
    );
    await this.db.backup(destination);
    chmodSync(destination, 0o600);
    return path.basename(destination);
  }
  close(): void {
    this.db.close();
  }
}
