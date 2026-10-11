import { afterEach, expect, test, vi } from "vitest";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  copyFileSync,
  writeFileSync,
  watch,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SqliteStorage } from "./sqlite.js";

const observedFault = vi.hoisted(() => ({
  path: "",
  phase: "" as "" | "read" | "after-stat",
  statCalls: 0,
  firstStatSucceeded: false,
  injected: false,
  opened: [] as string[],
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    statSync: (...args: Parameters<typeof actual.statSync>) => {
      const relevant = String(args[0]) === observedFault.path;
      if (relevant) {
        observedFault.statCalls++;
        if (
          observedFault.phase === "after-stat" &&
          observedFault.statCalls === 2
        ) {
          actual.rmSync(observedFault.path);
          observedFault.injected = true;
        }
      }
      const result = actual.statSync(...args);
      if (relevant && observedFault.statCalls === 1)
        observedFault.firstStatSucceeded = true;
      return result;
    },
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (
        String(args[0]) === observedFault.path &&
        observedFault.phase === "read" &&
        observedFault.firstStatSucceeded &&
        !observedFault.injected
      ) {
        actual.rmSync(observedFault.path);
        observedFault.injected = true;
      }
      return actual.readFileSync(...args);
    },
  };
});
vi.mock("better-sqlite3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("better-sqlite3")>();
  return {
    ...actual,
    default: new Proxy(actual.default, {
      construct(target, args) {
        observedFault.opened.push(String(args[0]));
        return Reflect.construct(target, args);
      },
    }),
  };
});

const roots: string[] = [];
const handles: SqliteStorage[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const handle of handles.splice(0)) handle.close();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
const originalSchema = readFileSync(
  new URL("../migrations/001-records.sql", import.meta.url),
  "utf8",
);
function legacy(extra?: (db: Database.Database) => void) {
  const root = mkdtempSync(join(tmpdir(), "kn01-migration-"));
  roots.push(root);
  const path = join(root, "records.db"),
    db = new Database(path);
  db.exec(
    "CREATE TABLE migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  db.exec(originalSchema);
  db.prepare("INSERT INTO migrations VALUES (?,?)").run(
    "001-records",
    "old-time",
  );
  const insert = db.prepare(
    "INSERT INTO records (rowid,kind,id,value) VALUES (?,?,?,?)",
  );
  [
    "projects",
    "snapshots",
    "plans",
    "approvals",
    "routes",
    "views",
    "groups",
    "policies",
    "settings",
  ].forEach((kind, index) => {
    insert.run(
      10 + index * 3,
      kind,
      kind === "approvals"
        ? "old-approval"
        : kind === "settings"
          ? "approved-plan:old-approval"
          : kind,
      '{ "z" : 2, "a" : [1, 3], "中文" : "保留" }',
    );
  });
  extra?.(db);
  db.close();
  return path;
}
function inspect(path: string) {
  const db = new Database(path, { readonly: true });
  try {
    return {
      schema: db
        .prepare(
          "SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY name",
        )
        .all(),
      markers: db.prepare("SELECT * FROM migrations ORDER BY id").all(),
      rows: db
        .prepare(
          "SELECT rowid,kind,id,value,hex(CAST(value AS BLOB)) AS bytes FROM records ORDER BY rowid",
        )
        .all(),
    };
  } finally {
    db.close();
  }
}
function fingerprint(path: string) {
  return {
    bytes: createHash("sha256").update(readFileSync(path)).digest("hex"),
    contents: inspect(path),
    sidecars: ["-wal", "-shm", "-journal"].map((suffix) =>
      existsSync(path + suffix),
    ),
  };
}
test("known 001 migrates without reencoding old JSON bytes, losing rowids or rewriting approval history", () => {
  const path = legacy(),
    before = inspect(path);
  const db = new SqliteStorage(path);
  handles.push(db);
  db.put("annotations", "note", { id: "note", text: "persistent" });
  db.close();
  const after = inspect(path);
  expect(
    after.rows.filter((row) =>
      before.rows.some(
        (old) =>
          (old as { rowid: number }).rowid === (row as { rowid: number }).rowid,
      ),
    ),
  ).toEqual(before.rows);
  expect(after.markers).toHaveLength(2);
  const reopened = new SqliteStorage(path);
  handles.push(reopened);
  expect(reopened.get("annotations", "note")).toEqual({
    id: "note",
    text: "persistent",
  });
  expect(reopened.get("settings", "annotation-review-legacy-v1")).toEqual({
    version: 1,
    approvalIds: ["old-approval"],
  });
  reopened.close();
  expect(inspect(path)).toEqual(after);
});
test("fresh databases freeze an empty legacy registry and retain CHECK and JSON constraints", () => {
  const root = mkdtempSync(join(tmpdir(), "kn01-fresh-"));
  roots.push(root);
  const path = join(root, "records.db");
  const storage = new SqliteStorage(path);
  handles.push(storage);
  expect(storage.get("settings", "annotation-review-legacy-v1")).toEqual({
    version: 1,
    approvalIds: [],
  });
  storage.close();
  const db = new Database(path);
  expect(() =>
    db.prepare("INSERT INTO records VALUES (?,?,?)").run("future", "id", "{}"),
  ).toThrow();
  expect(() =>
    db
      .prepare("INSERT INTO records VALUES (?,?,?)")
      .run("annotations", "id", "broken"),
  ).toThrow();
  db.close();
});
test.each([
  "future-marker",
  "wrong-marker",
  "future-kind",
  "weak-json",
  "trigger",
  "custom-index",
  "view",
  "table",
  "unknown-column",
  "bad-row-kind",
] as const)(
  "unsupported %s is refused before durable mutation, with file/schema/rows unchanged",
  (condition) => {
    const path = legacy((db) => {
      if (condition === "future-marker")
        db.prepare("INSERT INTO migrations VALUES (?,?)").run(
          "003-future",
          "future",
        );
      if (condition === "wrong-marker")
        db.prepare("DELETE FROM migrations").run();
      if (["future-kind", "weak-json", "unknown-column"].includes(condition)) {
        db.exec("ALTER TABLE records RENAME TO old_records");
        let sql = originalSchema;
        if (condition === "future-kind")
          sql = sql.replace("'settings'", "'settings','future'");
        if (condition === "weak-json")
          sql = sql.replace("CHECK (json_valid(value))", "");
        if (condition === "unknown-column")
          sql = sql.replace("PRIMARY KEY", "future TEXT, PRIMARY KEY");
        db.exec(sql);
        db.exec(
          "INSERT INTO records(rowid,kind,id,value) SELECT rowid,kind,id,value FROM old_records; DROP TABLE old_records",
        );
      }
      if (condition === "trigger")
        db.exec(
          "CREATE TRIGGER keep_future AFTER INSERT ON records BEGIN SELECT 1; END",
        );
      if (condition === "custom-index")
        db.exec("CREATE INDEX future_index ON records(kind)");
      if (condition === "view")
        db.exec("CREATE VIEW future_view AS SELECT * FROM records");
      if (condition === "table") db.exec("CREATE TABLE future_table (id TEXT)");
      if (condition === "bad-row-kind") {
        db.pragma("ignore_check_constraints=ON");
        db.prepare("INSERT INTO records VALUES (?,?,?)").run(
          "future",
          "future",
          "{}",
        );
      }
    });
    const before = fingerprint(path);
    expect(() => new SqliteStorage(path)).toThrow(/unsupported.*schema/i);
    expect(fingerprint(path)).toEqual(before);
  },
);
test.each(["missing", "malformed", "future-version", "duplicate"] as const)(
  "known 002 refuses a %s frozen legacy registry without changing the database",
  (condition) => {
    const path = legacy(),
      storage = new SqliteStorage(path);
    handles.push(storage);
    storage.close();
    const raw = new Database(path);
    if (condition === "missing")
      raw
        .prepare(
          "DELETE FROM records WHERE kind='settings' AND id='annotation-review-legacy-v1'",
        )
        .run();
    else
      raw
        .prepare(
          "UPDATE records SET value=? WHERE kind='settings' AND id='annotation-review-legacy-v1'",
        )
        .run(
          condition === "malformed"
            ? '{"version":1,"approvalIds":"wrong"}'
            : condition === "future-version"
              ? '{"version":2,"approvalIds":[]}'
              : '{"version":1,"approvalIds":["old-approval","old-approval"]}',
        );
    raw.close();
    const before = fingerprint(path);
    expect(() => new SqliteStorage(path)).toThrow(/unsupported.*schema/i);
    expect(fingerprint(path)).toEqual(before);
  },
);
test.each([1, 2, 3, 4, 5])(
  "real SQL failure after migration phase %s rolls back DDL, raw bytes, markers and history",
  (phase) => {
    const path = legacy(),
      before = inspect(path),
      exec = Database.prototype.exec;
    vi.spyOn(Database.prototype, "exec").mockImplementation(function (
      this: Database.Database,
      sql: string,
    ) {
      if (sql.includes("CREATE TABLE records_next")) {
        exec.call(this, sql.split(";").slice(0, phase).join(";") + ";");
        throw new Error("injected migration write failure");
      }
      return exec.call(this, sql);
    });
    expect(() => new SqliteStorage(path)).toThrow(
      "injected migration write failure",
    );
    vi.restoreAllMocks();
    expect(inspect(path)).toEqual(before);
    const recovered = new SqliteStorage(path);
    handles.push(recovered);
    expect(recovered.get("settings", "annotation-review-legacy-v1")).toEqual({
      version: 1,
      approvalIds: ["old-approval"],
    });
  },
);
test("failure writing the final 002 marker rolls back table replacement, registry and original raw bytes", () => {
  const path = legacy(),
    before = inspect(path),
    prepare = Database.prototype.prepare;
  vi.spyOn(Database.prototype, "prepare").mockImplementation(function (
    this: Database.Database,
    sql: string,
  ) {
    const statement = prepare.call(this, sql);
    if (sql === "INSERT INTO migrations VALUES (?, ?)") {
      const run = statement.run;
      vi.spyOn(statement, "run").mockImplementation(function (
        this: Database.Statement,
        ...args: unknown[]
      ) {
        if (args[0] === "002-annotations")
          throw new Error("injected marker failure");
        return run.apply(this, args);
      });
    }
    return statement;
  });
  expect(() => new SqliteStorage(path)).toThrow("injected marker failure");
  vi.restoreAllMocks();
  expect(inspect(path)).toEqual(before);
});

// Measure original files without opening them through SQLite: reads must not initialize a WAL index.
function rawFingerprint(path: string) {
  return ["", "-wal", "-shm", "-journal"].map((suffix) => {
    const file = path + suffix;
    if (!existsSync(file)) return { suffix, sha256: null, size: 0 };
    const bytes = readFileSync(file);
    return {
      suffix,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
    };
  });
}
function walFixture(
  condition:
    | "main-future"
    | "pending-future"
    | "existing-shm"
    | "stale-shm"
    | "pending-trigger"
    | "valid-pending"
    | "valid-main",
) {
  const origin = legacy(),
    db = new Database(origin);
  db.pragma("journal_mode=WAL");
  db.pragma("wal_autocheckpoint=0");
  db.pragma("wal_checkpoint(TRUNCATE)");
  if (condition === "main-future") {
    db.prepare("INSERT INTO migrations VALUES (?,?)").run(
      "003-future",
      "future",
    );
    db.pragma("wal_checkpoint(TRUNCATE)");
  }
  if (["pending-future", "existing-shm", "stale-shm"].includes(condition))
    db.prepare("INSERT INTO migrations VALUES (?,?)").run(
      "003-future",
      "future",
    );
  if (condition === "pending-trigger")
    db.exec(
      "CREATE TRIGGER future_wal AFTER INSERT ON records BEGIN SELECT 1; END",
    );
  if (condition === "valid-pending")
    db.prepare("INSERT INTO records VALUES ('settings','wal-only',?)").run(
      '{ "pending" : true }',
    );
  const root = mkdtempSync(join(tmpdir(), "kn01-wal-fixture-"));
  roots.push(root);
  const path = join(root, "records.db");
  copyFileSync(origin, path);
  if (!["main-future", "valid-main"].includes(condition))
    copyFileSync(origin + "-wal", path + "-wal");
  if (condition === "existing-shm")
    copyFileSync(origin + "-shm", path + "-shm");
  if (condition === "stale-shm")
    writeFileSync(path + "-shm", Buffer.alloc(32768));
  db.close();
  return path;
}
test.each([
  "main-future",
  "pending-future",
  "existing-shm",
  "stale-shm",
  "pending-trigger",
] as const)(
  "WAL %s refusal preserves raw originals and never creates, updates or cleans sidecars",
  async (condition) => {
    const path = walFixture(condition),
      before = rawFingerprint(path),
      events: string[] = [];
    const watcher = watch(join(path, ".."), (event, name) =>
      events.push(`${event}:${String(name)}`),
    );
    const close = Database.prototype.close;
    let copyRoot: string | undefined;
    vi.spyOn(Database.prototype, "close").mockImplementation(function (
      this: Database.Database,
    ) {
      if (this.name.includes("atlasmode-schema-probe-"))
        copyRoot = dirname(this.name);
      return close.call(this);
    });
    try {
      expect(() => new SqliteStorage(path)).toThrow(/unsupported.*schema/i);
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(rawFingerprint(path)).toEqual(before);
      expect(events).toEqual([]);
      expect(copyRoot).toBeDefined();
      expect(existsSync(copyRoot!)).toBe(false);
    } finally {
      watcher.close();
    }
  },
);
test.each(["valid-pending", "valid-main"] as const)(
  "known WAL %s migrates with committed WAL content retained",
  (condition) => {
    const path = walFixture(condition),
      storage = new SqliteStorage(path);
    handles.push(storage);
    expect(storage.get("settings", "annotation-review-legacy-v1")).toEqual({
      version: 1,
      approvalIds: ["old-approval"],
    });
    if (condition === "valid-pending")
      expect(storage.get("settings", "wal-only")).toEqual({ pending: true });
    storage.close();
    const reopened = new SqliteStorage(path);
    handles.push(reopened);
    expect(reopened.get("settings", "annotation-review-legacy-v1")).toEqual({
      version: 1,
      approvalIds: ["old-approval"],
    });
  },
);

test("controlled preflight-to-write handoff detects a newly unsupported WAL main image before opening originals", async () => {
  const path = legacy(),
    future = walFixture("main-future"),
    close = Database.prototype.close;
  const sidecarEvents: string[] = [],
    watcher = watch(join(path, ".."), (event, name) => {
      if (/-(wal|shm|journal)$/.test(String(name)))
        sidecarEvents.push(`${event}:${String(name)}`);
    });
  let injected = false,
    changed: ReturnType<typeof rawFingerprint> | undefined;
  vi.spyOn(Database.prototype, "close").mockImplementation(function (
    this: Database.Database,
  ) {
    const result = close.call(this);
    if (
      !injected &&
      (this.name === path || this.name.includes("atlasmode-schema-probe-"))
    ) {
      injected = true;
      writeFileSync(path, readFileSync(future));
      changed = rawFingerprint(path);
    }
    return result;
  });
  try {
    expect(() => new SqliteStorage(path)).toThrow(/observed.*change/i);
    expect(injected).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(rawFingerprint(path)).toEqual(changed);
    expect(sidecarEvents).toEqual([]);
  } finally {
    watcher.close();
  }
});

test("the immediate write transaction still rechecks schema rather than trusting the accepted private image", () => {
  const path = legacy(),
    before = rawFingerprint(path),
    transaction = Database.prototype.transaction;
  let injected = false;
  vi.spyOn(Database.prototype, "transaction").mockImplementation(function (
    this: Database.Database,
    fn: (...args: unknown[]) => unknown,
  ) {
    return transaction.call(this, (...args: unknown[]) => {
      if (this.name === path && !injected) {
        injected = true;
        this.prepare("INSERT INTO migrations VALUES (?,?)").run(
          "003-future",
          "injected inside immediate transaction",
        );
      }
      return fn(...args);
    });
  });
  expect(() => new SqliteStorage(path)).toThrow(/unsupported.*schema/i);
  expect(injected).toBe(true);
  expect(rawFingerprint(path)).toEqual(before);
});

test.each(
  ["-wal", "-shm", "-journal"].flatMap((suffix) =>
    ["read", "after-stat"].map((phase) => ({ suffix, phase })),
  ),
)(
  "observed $suffix disappearance at $phase fails closed before any original SQLite open",
  ({ suffix, phase }) => {
    const path = suffix === "-journal" ? legacy() : walFixture("valid-pending");
    if (suffix !== "-wal")
      writeFileSync(
        path + suffix,
        Buffer.alloc(suffix === "-shm" ? 32768 : 512),
      );
    Object.assign(observedFault, {
      path: path + suffix,
      phase,
      statCalls: 0,
      firstStatSucceeded: false,
      injected: false,
      opened: [],
    });
    let storage: SqliteStorage | undefined, failure: unknown;
    try {
      try {
        storage = new SqliteStorage(path);
      } catch (error) {
        failure = error;
      }
      expect(observedFault.firstStatSucceeded).toBe(true);
      expect(observedFault.injected).toBe(true);
      expect(observedFault.opened).not.toContain(path);
      expect(observedFault.opened).toEqual([]);
      expect(failure).toMatchObject({ code: "OBSERVED_CHANGE" });
    } finally {
      Object.assign(observedFault, { path: "", phase: "" });
      storage?.close();
    }
  },
);
