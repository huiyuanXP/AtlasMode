import { afterEach, expect, it } from "vitest";
import type { CodeSnapshot, ViewState } from "@codemap/core";
import type { RecordKind, StoragePort } from "@codemap/core";
import { Knowledge } from "./knowledge.js";
class MemoryStorage implements StoragePort {
  records = new Map<string, unknown>();
  get<T>(kind: RecordKind, id: string): T | undefined {
    return structuredClone(this.records.get(`${kind}/${id}`)) as T | undefined;
  }
  list<T>(kind: RecordKind): T[] {
    return [...this.records]
      .filter(([key]) => key.startsWith(`${kind}/`))
      .map(([, v]) => structuredClone(v) as T);
  }
  put<T>(kind: RecordKind, id: string, value: T): void {
    this.records.set(`${kind}/${id}`, structuredClone(value));
  }
  delete(kind: RecordKind, id: string): void {
    this.records.delete(`${kind}/${id}`);
  }
  transaction<T>(fn: () => T): T {
    const original = structuredClone(this.records);
    try {
      return fn();
    } catch (error) {
      this.records = original;
      throw error;
    }
  }
  close(): void {}
}

const snapshot = (id: string) =>
  ({
    id: `s-${id}`,
    projectId: id,
    nodes: [],
    relations: [],
    coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
  }) as unknown as CodeSnapshot;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
const fixture = () => {
  const storage = new MemoryStorage();
  cleanups.push(() => storage.close());
  storage.put("groups", "g1", { id: "g1", projectId: "p", memberIds: [] });
  storage.put("groups", "foreign", {
    id: "foreign",
    projectId: "other",
    memberIds: [],
  });
  return { storage, knowledge: new Knowledge(storage, snapshot) };
};
const oldView: ViewState = {
  positions: { "fact:a": { x: 10, y: 20 } },
  theme: "dark",
  locale: "en",
};
it("keeps old ViewState without collapse metadata compatible", () => {
  const { knowledge } = fixture();
  expect(knowledge.saveView("p", oldView)).toEqual(oldView);
  expect(knowledge.view("p")).toEqual(oldView);
});
it("deduplicates known project IDs and filters unknown, stale and foreign groups on read and write without invalidating plans", () => {
  const { knowledge, storage } = fixture();
  storage.put("plans", "plan", {
    id: "plan",
    projectId: "p",
    revision: 1,
    status: "approved",
  });
  const before = storage.get("plans", "plan");
  expect(
    knowledge.saveView("p", {
      ...oldView,
      collapsedGroupIds: ["g1", "foreign", "missing", "g1"],
    }),
  ).toEqual({ ...oldView, collapsedGroupIds: ["g1"] });
  expect(knowledge.view("other").collapsedGroupIds).toBeUndefined();
  expect(storage.get("plans", "plan")).toEqual(before);
  storage.delete("groups", "g1");
  expect(knowledge.view("p").collapsedGroupIds).toEqual([]);
});
it("rejects unbounded and malformed collapse lists before persisting", () => {
  const { knowledge } = fixture();
  for (const ids of [Array(201).fill("g1"), ["x".repeat(201)], [""], [1], "g1"])
    expect(() =>
      knowledge.saveView("p", {
        ...oldView,
        collapsedGroupIds: ids,
      } as unknown as ViewState),
    ).toThrow();
  expect(knowledge.view("p").collapsedGroupIds).toBeUndefined();
});
