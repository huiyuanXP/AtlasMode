import { describe, expect, it } from "vitest";
import { snapshotSchema } from "./validation.js";

const snapshot = {
  id: "snapshot",
  projectId: "project",
  createdAt: "2026-10-10T00:00:00.000Z",
  gitRevision: null,
  contentHash: "hash",
  nodes: [],
  relations: [],
  diagnostics: [],
  coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
};
function graph() {
  return {
    version: 1,
    status: "complete",
    counts: {
      observedRoots: 1,
      observedProjects: 1,
      observedReferences: 1,
      sourceScopes: 1,
      resolved: 1,
      unconfigured: 0,
      ambiguous: 0,
      invalid: 0,
    },
    roots: ["tsconfig.json"],
    projects: [{ configPath: "tsconfig.json", status: "resolved" }],
    references: [
      {
        sourceConfigPath: "tsconfig.json",
        referencePathPreview: "./child",
        targetConfigPath: "child/tsconfig.json",
        status: "resolved",
        referencePathTruncated: false,
        reasonTruncated: false,
      },
    ],
    scopes: [
      {
        sourcePath: "src/a.ts",
        configPath: "tsconfig.json",
        status: "resolved",
      },
    ],
    truncated: {
      roots: false,
      projects: false,
      references: false,
      scopes: false,
    },
  };
}
const parse = (value: unknown) =>
  snapshotSchema.safeParse({
    ...snapshot,
    coverage: { ...snapshot.coverage, configurationProjectGraph: value },
  });
describe("IDX03 bounded configuration project graph schema", () => {
  it("accepts legacy missing field", () =>
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true));
  it("accepts the exact optional graph and preserves it", () => {
    const result = parse(graph());
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.coverage.configurationProjectGraph).toEqual(graph());
  });
  it("accepts a bounded sample with accurate larger counts", () => {
    const value = graph();
    value.counts.sourceScopes = value.counts.resolved = 72;
    value.truncated.scopes = true;
    expect(parse(value).success).toBe(true);
  });
  it.each(["roots", "projects", "references", "scopes"] as const)(
    "rejects over-limit %s array even with consistent totals",
    (key) => {
      const value = graph(),
        limit = key === "references" ? 100 : 50;
      value[key] = Array.from(
        { length: limit + 1 },
        () => value[key][0],
      ) as never;
      if (key === "roots") value.counts.observedRoots = limit + 1;
      if (key === "projects") value.counts.observedProjects = limit + 1;
      if (key === "references") value.counts.observedReferences = limit + 1;
      if (key === "scopes")
        value.counts.sourceScopes = value.counts.resolved = limit + 1;
      expect(parse(value).success).toBe(false);
    },
  );
  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects nonnegative safeinteger count violation %s",
    (count) => {
      const value = graph();
      value.counts.observedProjects = count;
      expect(parse(value).success).toBe(false);
    },
  );
  it("rejects scope category totals that disagree with all sources", () => {
    const value = graph();
    value.counts.invalid = 1;
    expect(parse(value).success).toBe(false);
  });
  it.each(["roots", "projects", "references", "scopes"] as const)(
    "rejects returned %s greater than observed",
    (key) => {
      const value = graph();
      if (key === "roots") value.counts.observedRoots = 0;
      if (key === "projects") value.counts.observedProjects = 0;
      if (key === "references") value.counts.observedReferences = 0;
      if (key === "scopes")
        value.counts.sourceScopes = value.counts.resolved = 0;
      expect(parse(value).success).toBe(false);
    },
  );
  it.each(["roots", "projects", "references", "scopes"] as const)(
    "rejects contradictory %s truncated flag",
    (key) => {
      const value = graph();
      value.truncated[key] = true;
      expect(parse(value).success).toBe(false);
    },
  );
  it("rejects returned scope categories greater than complete category counts", () => {
    const value = graph();
    value.counts.resolved = 0;
    value.counts.invalid = 1;
    expect(parse(value).success).toBe(false);
  });
  it("rejects missing reason with reasonTruncated true", () => {
    const value = graph();
    value.references[0]!.reasonTruncated = true;
    expect(parse(value).success).toBe(false);
  });
  it.each([
    "root",
    "project",
    "referenceSource",
    "referenceTarget",
    "source",
    "scopeConfig",
  ])("rejects overlong %s public path", (key) => {
    const value = graph();
    const path = "a".repeat(2049);
    if (key === "root") value.roots[0] = path;
    if (key === "project") value.projects[0]!.configPath = path;
    if (key === "referenceSource") value.references[0]!.sourceConfigPath = path;
    if (key === "referenceTarget") value.references[0]!.targetConfigPath = path;
    if (key === "source") value.scopes[0]!.sourcePath = path;
    if (key === "scopeConfig") value.scopes[0]!.configPath = path;
    expect(parse(value).success).toBe(false);
  });
  it("rejects overlong preview and reason strings", () => {
    const value = graph();
    value.references[0]!.referencePathPreview = "a".repeat(257);
    expect(parse(value).success).toBe(false);
    value.references[0]!.referencePathPreview = "./child";
    Object.assign(value.references[0]!, { reason: "a".repeat(513) });
    expect(parse(value).success).toBe(false);
  });
  it("accepts budget partial status and explicit string truncation", () => {
    const value = graph();
    value.status = "partial";
    Object.assign(value.references[0]!, {
      status: "budget",
      reason: "a".repeat(512),
      reasonTruncated: true,
      referencePathPreview: "a".repeat(256),
      referencePathTruncated: true,
    });
    expect(parse(value).success).toBe(true);
  });
  it("rejects invalid paths and unknown fields", () => {
    const value = graph();
    value.roots[0] = "../escape.json";
    expect(parse(value).success).toBe(false);
    expect(parse({ ...graph(), hidden: true }).success).toBe(false);
  });
});
