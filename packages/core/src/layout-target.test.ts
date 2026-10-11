import { describe, expect, it } from "vitest";
import type { CodeSnapshot } from "./model.js";
import {
  getLayoutTarget,
  LAYOUT_LIMITS,
  boundedLayoutJsonBytes,
} from "./layout-target.js";

function snapshot(n = 3, r = 2): CodeSnapshot {
  return {
    id: "s",
    projectId: "p",
    contentHash: "hash",
    createdAt: "now",
    gitRevision: null,
    nodes: Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      kind: i === 2 ? "external" : "function",
      name: "secret",
      signature: "secret",
      filePath: "secret",
    })),
    relations: Array.from({ length: r }, (_, i) => ({
      id: `r${i}`,
      sourceId: "n0",
      targetId: i % 2 ? null : "n1",
      type: "calls",
      resolution: i % 2 ? "unresolved" : "resolved",
      evidence: { filePath: "secret", line: 1, text: "secret" },
    })),
    diagnostics: [],
    coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
  };
}
describe("complete bounded layout target", () => {
  it("counts the complete JSON UTF8 envelope exactly, including escaped and surrogate characters", () => {
    const value = {
      s: '界😀\ud800\u0000\n"\\',
      nothing: null,
      yes: true,
      n: 123,
      items: ["a", "b"],
      optional: undefined,
    };
    const actual = new TextEncoder().encode(JSON.stringify(value)).length;
    expect(boundedLayoutJsonBytes(value, actual)).toBe(actual);
    expect(boundedLayoutJsonBytes(value, actual - 1)).toBeUndefined();
  });
  it("checks oversized raw lengths before touching IDs or relation entries", () => {
    const s = snapshot(5001, 0);
    for (const n of s.nodes)
      Object.defineProperty(n, "id", {
        get() {
          throw Error("ID access before cap");
        },
      });
    expect(getLayoutTarget(s, "s")).toMatchObject({
      status: "rejected",
      reason: "node_budget",
      counts: { nodes: 5001 },
    });
    const r = snapshot();
    r.relations = new Proxy(Array(20001), {
      get(target, key) {
        if (key !== "length") throw Error("relation access before cap");
        return Reflect.get(target, key);
      },
    });
    expect(getLayoutTarget(r, "s")).toMatchObject({
      status: "rejected",
      reason: "relation_budget",
      counts: { relations: 20001 },
    });
  });
  it("copies all raw identities and excludes source-bearing fields without mutation", () => {
    const s = snapshot();
    const before = structuredClone(s);
    const result = getLayoutTarget(s, "s");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.nodes.map((n) => n.id)).toEqual(s.nodes.map((n) => n.id));
    expect(result.relations.map((r) => r.id)).toEqual(
      s.relations.map((r) => r.id),
    );
    expect(result.counts).toEqual({
      nodes: 3,
      relations: 2,
      byKind: { function: 2, file: 0, folder: 0, external: 1 },
    });
    expect(result.relations[1]?.targetId).toBeNull();
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(s).toEqual(before);
    expect(result.nodes[0]).not.toBe(s.nodes[0]);
  });
  it("accepts exact node/relation caps", () => {
    const r = getLayoutTarget(snapshot(5000, 20000), "s");
    expect(r.status).toBe("ready");
    expect(r.limits).toEqual(LAYOUT_LIMITS);
  });
  it.each([
    [5001, 2, "node_budget"],
    [3, 20001, "relation_budget"],
  ])("rejects %i/%i without partial arrays", (n, r, reason) => {
    const result = getLayoutTarget(snapshot(Number(n), Number(r)), "s");
    expect(result).toMatchObject({ status: "rejected", reason });
    expect(result).not.toHaveProperty("nodes");
    expect(result).not.toHaveProperty("relations");
  });
  it("rejects full JSON over the UTF8 byte cap", () => {
    const s = snapshot();
    s.nodes[0]!.id = "界".repeat(2800000);
    s.relations = [];
    expect(getLayoutTarget(s, "s")).toMatchObject({
      status: "rejected",
      reason: "byte_budget",
    });
  });
  it("binds to the exact captured snapshot", () =>
    expect(() => getLayoutTarget(snapshot(), "old")).toThrowError(
      /SNAPSHOT_CHANGED/,
    ));
  it.each(["node", "relation", "endpoint", "parent"])(
    "rejects malformed %s identity",
    (which) => {
      const s = snapshot();
      if (which === "node") s.nodes[1]!.id = "n0";
      if (which === "relation") s.relations[1]!.id = "r0";
      if (which === "endpoint") s.relations[0]!.targetId = "missing";
      if (which === "parent") s.nodes[0]!.parentId = "missing";
      expect(() => getLayoutTarget(s, "s")).toThrow();
    },
  );
});
