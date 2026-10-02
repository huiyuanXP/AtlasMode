import type { RecordKind, StoragePort } from "@codemap/core";
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { types } from "node:util";
import { dirname } from "node:path";

export class SqliteStorage implements StoragePort {
  private readonly db: Database.Database;

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
    this.db
      .prepare(
        "INSERT INTO records (kind, id, value) VALUES (?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET value = excluded.value",
      )
      .run(kind, id, JSON.stringify(value));
  }
  delete(kind: RecordKind, id: string): void {
    this.db
      .prepare("DELETE FROM records WHERE kind = ? AND id = ?")
      .run(kind, id);
  }
  transaction<T>(fn: () => T): T {
    if (types.isAsyncFunction(fn))
      throw new TypeError("SQLite transactions must be synchronous.");
    return this.db.transaction(() => {
      const value = fn();
      if (
        value !== null &&
        (typeof value === "object" || typeof value === "function") &&
        "then" in value
      ) {
        throw new TypeError("SQLite transactions must be synchronous.");
      }
      return value;
    })();
  }
  close(): void {
    if (this.db.open) this.db.close();
  }
}
