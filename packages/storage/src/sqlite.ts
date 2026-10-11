import { DomainError, type RecordKind, type StoragePort } from "@codemap/core";
import Database from "better-sqlite3";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs";
import { tmpdir } from "node:os";
import { types } from "node:util";
import { dirname, join } from "node:path";

const migrationsDDL =
  "CREATE TABLE migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)";
const registryKey = "annotation-review-legacy-v1";
const oldKinds = [
  "projects",
  "snapshots",
  "plans",
  "approvals",
  "routes",
  "views",
  "groups",
  "policies",
  "settings",
];
type SchemaRow = {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
};

/** Whitespace outside quoted tokens only: literals and CHECK expressions remain authoritative. */
function normalizedDDL(sql: string): string {
  let output = "",
    quote = "",
    space = false;
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index]!;
    if (quote) {
      output += char;
      if (char === quote) {
        if (sql[index + 1] === quote) output += sql[++index];
        else quote = "";
      }
    } else if (char === "'" || char === '"') {
      if (space && output) output += " ";
      space = false;
      output += char;
      quote = char;
    } else if (/\s/.test(char)) space = true;
    else {
      if (space && output) output += " ";
      space = false;
      output += char;
    }
  }
  return output.replace(/;$/, "");
}
function unsupported(): never {
  throw new DomainError(
    "UNSUPPORTED_SCHEMA",
    "Unsupported SQLite schema; no migration was applied.",
  );
}

function assertSupportedSchema(db: Database.Database): "empty" | "001" | "002" {
  const objects = db
    .prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name")
    .all() as SchemaRow[];
  if (objects.length === 0) return "empty";
  if (objects.length !== 4) unsupported();
  const table = (name: string) =>
    objects.find(
      (row) =>
        row.type === "table" && row.name === name && row.tbl_name === name,
    );
  if (
    !table("records") ||
    !table("migrations") ||
    normalizedDDL(table("migrations")!.sql ?? "") !== migrationsDDL
  )
    unsupported();
  for (const name of ["records", "migrations"]) {
    const index = objects.find(
      (row) => row.name === `sqlite_autoindex_${name}_1`,
    );
    if (
      !index ||
      index.type !== "index" ||
      index.tbl_name !== name ||
      index.sql !== null
    )
      unsupported();
    const indexes = db.prepare(`PRAGMA index_list(${name})`).all() as {
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }[];
    if (
      indexes.length !== 1 ||
      indexes[0]!.name !== index.name ||
      indexes[0]!.unique !== 1 ||
      indexes[0]!.origin !== "pk" ||
      indexes[0]!.partial !== 0
    )
      unsupported();
    const indexColumns = (
      db.prepare(`PRAGMA index_info(${index.name})`).all() as { name: string }[]
    ).map((column) => column.name);
    if (
      JSON.stringify(indexColumns) !==
      JSON.stringify(name === "records" ? ["kind", "id"] : ["id"])
    )
      unsupported();
  }
  const columns = (name: string) =>
    (
      db.prepare(`PRAGMA table_info(${name})`).all() as {
        name: string;
        type: string;
        notnull: number;
        pk: number;
        dflt_value: unknown;
      }[]
    ).map((column) => [
      column.name,
      column.type,
      column.notnull,
      column.pk,
      column.dflt_value,
    ]);
  if (
    JSON.stringify(columns("records")) !==
      JSON.stringify([
        ["kind", "TEXT", 1, 1, null],
        ["id", "TEXT", 1, 2, null],
        ["value", "TEXT", 1, 0, null],
      ]) ||
    JSON.stringify(columns("migrations")) !==
      JSON.stringify([
        ["id", "TEXT", 0, 1, null],
        ["applied_at", "TEXT", 1, 0, null],
      ])
  )
    unsupported();
  const ids = (
    db.prepare("SELECT id FROM migrations ORDER BY id").all() as {
      id: string;
    }[]
  ).map((row) => row.id);
  const state =
    JSON.stringify(ids) === '["001-records"]'
      ? "001"
      : JSON.stringify(ids) === '["001-records","002-annotations"]'
        ? "002"
        : unsupported();
  const ddl = readFileSync(
    new URL(
      `../migrations/${state === "001" ? "001-records" : "002-annotations"}.sql`,
      import.meta.url,
    ),
    "utf8",
  );
  const expected =
    state === "001"
      ? ddl
      : ddl
          .slice(0, ddl.indexOf(";"))
          .replace("CREATE TABLE records_next", 'CREATE TABLE "records"');
  if (normalizedDDL(table("records")!.sql ?? "") !== normalizedDDL(expected))
    unsupported();
  const kinds = state === "001" ? oldKinds : [...oldKinds, "annotations"];
  const invalid = db
    .prepare(
      `SELECT count(*) AS count FROM records WHERE kind NOT IN (${kinds.map(() => "?").join(",")}) OR typeof(id) != 'text' OR typeof(value) != 'text' OR NOT json_valid(value)`,
    )
    .get(...kinds) as { count: number };
  if (invalid.count !== 0) unsupported();
  const registry = db
    .prepare("SELECT value FROM records WHERE kind='settings' AND id=?")
    .get(registryKey) as { value: string } | undefined;
  if (state === "001") {
    if (registry) unsupported();
  } else {
    if (!registry) unsupported();
    let value: unknown;
    try {
      value = JSON.parse(registry.value);
    } catch {
      unsupported();
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      unsupported();
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).sort().join(",") !== "approvalIds,version" ||
      record.version !== 1 ||
      !Array.isArray(record.approvalIds) ||
      record.approvalIds.some(
        (id) => typeof id !== "string" || !id || id.length > 200,
      ) ||
      new Set(record.approvalIds).size !== record.approvalIds.length
    )
      unsupported();
  }
  return state;
}

type SourceFile = { suffix: string; bytes: Buffer | null; identity: string };
const sourceSuffixes = ["", "-wal", "-shm", "-journal"];
function fileIdentity(stat: BigIntStats): string {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
}
/** Raw filesystem reads only. Even a readonly SQLite source handle could initialize WAL sidecars. */
function observedChange(): never {
  throw new DomainError(
    "OBSERVED_CHANGE",
    "Observed database file change; source SQLite was not opened.",
  );
}
function isMissing(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
function readSourceImage(path: string): SourceFile[] {
  return sourceSuffixes.map((suffix) => {
    const file = path + suffix;
    let before: BigIntStats;
    try {
      before = statSync(file, { bigint: true });
    } catch (error) {
      // Only absence at the first observation is an absent file.
      if (isMissing(error)) return { suffix, bytes: null, identity: "absent" };
      throw error;
    }
    try {
      const bytes = readFileSync(file),
        after = statSync(file, { bigint: true });
      if (fileIdentity(before) !== fileIdentity(after)) observedChange();
      return { suffix, bytes, identity: fileIdentity(after) };
    } catch (error) {
      // A file which was present has disappeared: never reinterpret this as a stable absent image.
      if (isMissing(error)) observedChange();
      throw error;
    }
  });
}
function sameSourceImage(left: SourceFile[], right: SourceFile[]): boolean {
  return left.every((file, index) => {
    const other = right[index]!;
    return (
      file.suffix === other.suffix &&
      file.identity === other.identity &&
      (file.bytes === null
        ? other.bytes === null
        : other.bytes !== null && file.bytes.equals(other.bytes))
    );
  });
}
function assertOriginalUnchanged(path: string, image: SourceFile[]): void {
  if (!sameSourceImage(image, readSourceImage(path))) observedChange();
}
/** SQLite may rebuild/recover/checkpoint only our disposable copy, including committed WAL pages. */
function preflightExistingFile(path: string): SourceFile[] {
  const image = readSourceImage(path);
  if (!image[0]?.bytes) unsupported();
  const root = mkdtempSync(join(tmpdir(), "atlasmode-schema-probe-"));
  let probe: Database.Database | undefined;
  try {
    const copy = join(root, "records.db");
    // SHM is a derived index: rebuild it on the copy rather than trusting a potentially stale source index.
    for (const file of image)
      if (file.suffix !== "-shm" && file.bytes !== null)
        writeFileSync(copy + file.suffix, file.bytes);
    assertOriginalUnchanged(path, image);
    probe = new Database(copy, { fileMustExist: true });
    assertSupportedSchema(probe);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    unsupported();
  } finally {
    try {
      probe?.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  assertOriginalUnchanged(path, image);
  return image;
}

export class SqliteStorage implements StoragePort {
  private readonly db: Database.Database;
  private readonly transactions = new AsyncLocalStorage<{ active: boolean }>();

  constructor(databasePath: string) {
    let acceptedImage: SourceFile[] | undefined;
    if (databasePath !== ":memory:" && existsSync(databasePath))
      acceptedImage = preflightExistingFile(databasePath);
    else if (databasePath !== ":memory:")
      mkdirSync(dirname(databasePath), { recursive: true });
    // Refuse a changed controlled handoff before SQLite touches the source. The transaction recheck below remains mandatory.
    // Standard VFS cannot atomically couple this filesystem comparison with opening against arbitrary external writers.
    if (acceptedImage) assertOriginalUnchanged(databasePath, acceptedImage);
    this.db = new Database(databasePath);
    try {
      this.db
        .transaction(() => {
          const state = assertSupportedSchema(this.db);
          if (state === "empty") {
            this.db.exec(migrationsDDL);
            this.db.exec(
              readFileSync(
                new URL("../migrations/001-records.sql", import.meta.url),
                "utf8",
              ),
            );
            this.db
              .prepare("INSERT INTO migrations VALUES (?, ?)")
              .run("001-records", new Date().toISOString());
          }
          if (state !== "002") {
            this.db.exec(
              readFileSync(
                new URL("../migrations/002-annotations.sql", import.meta.url),
                "utf8",
              ),
            );
            this.db
              .prepare("INSERT INTO migrations VALUES (?, ?)")
              .run("002-annotations", new Date().toISOString());
          }
          assertSupportedSchema(this.db);
        })
        .immediate();
      this.db.pragma("journal_mode = WAL");
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
