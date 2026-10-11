import { describe, expect, it } from "vitest";
import { validateLayoutTarget } from "./layout-target.js";

const expected = { projectId: "p", snapshotId: "s", contentHash: "hash" };
function ready() {
  return {
    ...expected,
    scope: "project_indexed_facts",
    status: "ready",
    complete: true,
    counts: {
      nodes: 2,
      relations: 2,
      byKind: { function: 1, file: 0, folder: 0, external: 1 },
    },
    limits: { nodes: 5000, relations: 20000, bytes: 8388608 },
    nodes: [
      { id: "a", kind: "function" },
      { id: "b", kind: "external" },
    ],
    relations: [
      {
        id: "r",
        sourceId: "a",
        targetId: "b",
        type: "calls",
        resolution: "external",
      },
      {
        id: "u",
        sourceId: "a",
        targetId: null,
        type: "calls",
        resolution: "unresolved",
      },
    ],
  };
}
describe("strict complete target validator", () => {
  it("accepts complete raw arrays and does not mutate", () => {
    const r = ready(),
      before = structuredClone(r);
    expect(validateLayoutTarget(r, expected)).toEqual(r);
    expect(r).toEqual(before);
  });
  it.each([
    "nodes",
    "counts",
    "kindCount",
    "endpoint",
    "nullTarget",
    "duplicate",
    "hash",
    "snapshot",
    "project",
    "extra",
    "enum",
    "limit",
    "complete",
  ])("rejects forged %s", (fault) => {
    const r = ready();
    switch (fault) {
      case "nodes":
        r.nodes.pop();
        break;
      case "counts":
        r.counts.relations = 3;
        break;
      case "kindCount":
        r.counts.byKind.function = 2;
        break;
      case "endpoint":
        r.relations[0]!.sourceId = "gone";
        break;
      case "nullTarget":
        r.relations[1]!.targetId = "invented";
        break;
      case "duplicate":
        r.relations[1]!.id = "r";
        break;
      case "hash":
        r.contentHash = "wrong";
        break;
      case "snapshot":
        r.snapshotId = "old";
        break;
      case "project":
        r.projectId = "foreign";
        break;
      case "extra":
        Object.assign(r.nodes[0]!, { name: "secret" });
        break;
      case "enum":
        r.nodes[0]!.kind = "bogus";
        break;
      case "limit":
        r.limits.nodes = 99999;
        break;
      case "complete":
        r.complete = false;
        break;
    }
    expect(() => validateLayoutTarget(r, expected)).toThrow();
  });
  it("checks actual UTF8 bytes", () => {
    const r = ready();
    r.nodes[0]!.id = "界".repeat(2800000);
    r.relations[0]!.sourceId = r.nodes[0]!.id;
    r.relations[1]!.sourceId = r.nodes[0]!.id;
    expect(() => validateLayoutTarget(r, expected)).toThrow();
  });
  it("accepts truthful rejection and rejects partial or contradictory rejection", () => {
    const { projectId, snapshotId, contentHash, scope, counts, limits } =
      ready();
    const common = {
      projectId,
      snapshotId,
      contentHash,
      scope,
      counts,
      limits,
    };
    const rejected = {
      ...common,
      status: "rejected",
      reason: "node_budget",
      counts: {
        ...common.counts,
        nodes: 5001,
        byKind: { function: 5000, file: 0, folder: 0, external: 1 },
      },
    };
    expect(validateLayoutTarget(rejected, expected)).toEqual(rejected);
    expect(() =>
      validateLayoutTarget({ ...rejected, nodes: [] }, expected),
    ).toThrow();
    expect(() =>
      validateLayoutTarget(
        { ...rejected, reason: "relation_budget" },
        expected,
      ),
    ).toThrow();
    expect(() =>
      validateLayoutTarget(
        { ...rejected, counts: { ...rejected.counts, nodes: -1 } },
        expected,
      ),
    ).toThrow();
  });
});
