import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { SqliteStorage } from "./index.js";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "atlas-sqlite-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "nested", "records.db");
  const db = new SqliteStorage(path);
  cleanups.push(() => db.close());
  return { db, path };
}
test("migrations repeat safely and persisted records survive reopen without kind collisions", () => {
  const { db, path } = fixture();
  db.put("plans", "shared", { title: "original" });
  db.put("routes", "shared", { title: "route" });
  db.put("plans", "shared", { title: "edited" });
  db.close();
  const reopened = new SqliteStorage(path);
  cleanups.push(() => reopened.close());
  expect(reopened.get("plans", "shared")).toEqual({ title: "edited" });
  expect(reopened.list("routes")).toEqual([{ title: "route" }]);
  reopened.delete("plans", "shared");
  expect(reopened.get("plans", "shared")).toBeUndefined();
  expect(reopened.list("routes")).toHaveLength(1);
  const raw = new Database(path);
  expect(raw.prepare("SELECT count(*) AS count FROM migrations").get()).toEqual(
    { count: 1 },
  );
  raw.close();
});
test("transactions commit results and roll back all writes on failure including nested transactions", () => {
  const { db } = fixture();
  expect(
    db.transaction(() => {
      db.put("settings", "stable", 1);
      return "committed";
    }),
  ).toBe("committed");
  expect(() =>
    db.transaction(() => {
      db.put("settings", "stable", 2);
      db.transaction(() => db.put("settings", "nested", 3));
      throw new Error("stop");
    }),
  ).toThrow("stop");
  expect(db.get("settings", "stable")).toBe(1);
  expect(db.get("settings", "nested")).toBeUndefined();
});
test("transactions reject asynchronous callbacks and roll back their synchronous writes", () => {
  const { db } = fixture();
  expect(() =>
    db.transaction(async () => {
      db.put("settings", "bad", 1);
    }),
  ).toThrow(/synchronous/i);
  expect(db.get("settings", "bad")).toBeUndefined();
});

test("async callbacks are rejected before their continuation can mutate SQLite", async () => {
  const { db } = fixture();
  expect(() =>
    db.transaction(async () => {
      await Promise.resolve();
      db.put("settings", "late", "invalid");
    }),
  ).toThrow(/synchronous/i);
  await Promise.resolve();
  expect(db.get("settings", "late")).toBeUndefined();
});

test("Promise-returning callbacks cannot write after rejection while outside and nested writers still work", async () => {
  const { db } = fixture();
  let continuation!: Promise<void>;
  expect(() =>
    db.transaction(() => {
      db.put("settings", "rolled-back", true);
      continuation = Promise.resolve().then(() =>
        db.put("settings", "late", "persisted after rejection"),
      );
      return continuation;
    }),
  ).toThrow(/synchronous/i);
  await continuation.catch(() => {});
  expect(db.get("settings", "late")).toBeUndefined();
  expect(db.get("settings", "rolled-back")).toBeUndefined();
  db.put("settings", "outside", 1);
  db.transaction(() => db.transaction(() => db.put("settings", "nested", 2)));
  expect(db.get("settings", "outside")).toBe(1);
  expect(db.get("settings", "nested")).toBe(2);
});

test("rejected nested asynchronous contexts cannot delete records or start later transactions", async () => {
  const { db } = fixture();
  db.put("settings", "retained", true);
  const continuations: Promise<void>[] = [];
  db.transaction(() => {
    expect(() =>
      db.transaction(() => {
        continuations.push(
          Promise.resolve().then(() => db.delete("settings", "retained")),
        );
        continuations.push(
          Promise.resolve().then(() =>
            db.transaction(() => db.put("settings", "escaped", true)),
          ),
        );
        return Promise.allSettled(continuations);
      }),
    ).toThrow(/synchronous/i);
    db.put("settings", "outer", "committed");
  });
  await Promise.allSettled(continuations);
  expect(db.get("settings", "retained")).toBe(true);
  expect(db.get("settings", "escaped")).toBeUndefined();
  expect(db.get("settings", "outer")).toBe("committed");
});
