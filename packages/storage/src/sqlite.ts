import type { RecordKind, StoragePort } from "@codemap/core";
import Database from "better-sqlite3";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync } from "node:fs";
import { types } from "node:util";
import { dirname } from "node:path";

export class SqliteStorage implements StoragePort {
  private readonly db: Database.Database;
  private readonly transactions = new AsyncLocalStorage<{ active: boolean }>();

  constructor(databasePath: string) {
    if (databasePath !== ":memory:")
      mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    try {
      this.db.pragma("journal_mode = WAL");
      this.db.exec(
        "CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
      );
      this.db.transaction(() => {
        const id = "001-records";
        if (
          !this.db.prepare("SELECT id FROM migrations WHERE id = ?").get(id)
        ) {
          this.db.exec(
            readFileSync(
              new URL("../migrations/001-records.sql", import.meta.url),
              "utf8",
            ),
          );
          this.db
            .prepare("INSERT INTO migrations VALUES (?, ?)")
            .run(id, new Date().toISOString());
        }
      })();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  get<T>(kind: RecordKind, id: string): T | undefined {
    const row = this.db
      .prepare("SELECT value FROM records WHERE kind = ? AND id = ?")
      .get(kind, id) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  }
  list<T>(kind: RecordKind): T[] {
    return (
      this.db
        .prepare("SELECT value FROM records WHERE kind = ? ORDER BY rowid")
        .all(kind) as { value: string }[]
    ).map((row) => JSON.parse(row.value) as T);
  }
  put<T>(kind: RecordKind, id: string, value: T): void {
    this.checkTransactionScope();
    this.db
      .prepare(
        "INSERT INTO records (kind, id, value) VALUES (?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET value = excluded.value",
      )
      .run(kind, id, JSON.stringify(value));
  }
  delete(kind: RecordKind, id: string): void {
    this.checkTransactionScope();
    this.db
      .prepare("DELETE FROM records WHERE kind = ? AND id = ?")
      .run(kind, id);
  }
  transaction<T>(fn: () => T): T {
    this.checkTransactionScope();
    if (types.isAsyncFunction(fn))
      throw new TypeError("SQLite transactions must be synchronous.");
    const context = { active: true };
    return this.transactions.run(context, () => {
      try {
        return this.db.transaction(() => {
          const value = fn();
          if (
            value !== null &&
            (typeof value === "object" || typeof value === "function") &&
            "then" in value
          ) {
            // The synchronous API cannot return this promise to its caller.
            // Observe its rejection; its continuations retain the closed scope.
            void Promise.resolve(value).catch(() => {});
            throw new TypeError("SQLite transactions must be synchronous.");
          }
          return value;
        })();
      } finally {
        // Async resources inherit this object, not the caller's restored scope.
        // Closing it blocks continuations after either commit or rollback.
        context.active = false;
      }
    });
  }
  private checkTransactionScope(): void {
    if (this.transactions.getStore()?.active === false)
      throw new TypeError(
        "SQLite transaction scope has ended; writes must be synchronous.",
      );
  }
  close(): void {
    this.checkTransactionScope();
    if (this.db.open) this.db.close();
  }
}
