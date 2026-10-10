import { describe, expect, it } from "vitest";
import { Graph } from "./graph.js";
import { indexTypeScript } from "./typescript.js";
import type { CodeSnapshot } from "@codemap/core";

function analyze(
  sources: Record<string, string>,
  configurations: Record<string, unknown>,
  diagnostics: CodeSnapshot["diagnostics"] = [],
) {
  const graph = new Graph("configuration");
  indexTypeScript(
    Object.entries(sources).map(([path, text]) => ({
      path,
      bytes: Buffer.from(text),
    })),
    graph,
    Object.entries(configurations).map(([path, value]) => ({
      path,
      bytes: Buffer.from(
        typeof value === "string" ? value : JSON.stringify(value),
      ),
    })),
    diagnostics,
  );
  return graph;
}
const entry =
  'import { helper } from "@lib/helper"; export function entry() { helper(); }';
const helper = "export function helper() {}";
const options = {
  compilerOptions: { baseUrl: ".", paths: { "@lib/*": ["lib/*"] } },
};
function callTarget(graph: Graph, path: string, text = "helper()") {
  const call = graph.relations.find(
    (r) =>
      r.type === "calls" &&
      r.evidence.filePath === path &&
      r.evidence.text === text,
  );
  expect(call).toBeDefined();
  return {
    call: call!,
    target: call?.targetId ? graph.nodes.get(call.targetId) : undefined,
  };
}
function expectTarget(
  graph: Graph,
  source: string,
  target: string,
  text = "helper()",
  name = "helper",
) {
  const result = callTarget(graph, source, text);
  expect(result.call.resolution).toBe("resolved");
  expect(result.target).toMatchObject({
    kind: "function",
    filePath: target,
    name,
    startLine: 1,
  });
}
function expectUnknown(graph: Graph, path: string) {
  expect(callTarget(graph, path).call).toMatchObject({
    resolution: "unresolved",
    targetId: null,
  });
  expect(
    graph.relations.find(
      (r) => r.type === "imports" && r.evidence.filePath === path,
    ),
  ).toMatchObject({ resolution: "unresolved", targetId: null });
}

describe("captured configuration resolution", () => {
  it("binds JSONC inherited paths and baseUrl to captured declarations", () => {
    const graph = analyze(
      { "app/entry.ts": entry, "shared/lib/helper.ts": helper },
      {
        "app/tsconfig.json":
          '{ // comment\n "extends": "../shared/base.json", "include":["**/*.ts"], }',
        "shared/base.json": options,
      },
    );
    expectTarget(graph, "app/entry.ts", "shared/lib/helper.ts");
  });
  it("isolates identical aliases in nested projects and re-export/default/namespace declarations", () => {
    const graph = analyze(
      {
        "one/entry.ts": entry,
        "one/lib/helper.ts": helper,
        "two/entry.ts":
          'import def from "@lib/barrel"; import * as ns from "@lib/barrel"; export function entry() { def(); ns.helper(); }',
        "two/lib/barrel.ts":
          'export { helper, helper as default } from "./helper";',
        "two/lib/helper.ts": helper,
      },
      { "one/tsconfig.json": options, "two/tsconfig.json": options },
    );
    expectTarget(graph, "one/entry.ts", "one/lib/helper.ts");
    expectTarget(graph, "two/entry.ts", "two/lib/helper.ts", "def()");
    expectTarget(graph, "two/entry.ts", "two/lib/helper.ts", "ns.helper()");
  });
  it("resolves inherited paths without baseUrl relative to their declaration", () => {
    const graph = analyze(
      { "app/entry.ts": entry, "shared/lib/helper.ts": helper },
      {
        "app/tsconfig.json": { extends: "..\\shared\\base.json" },
        "shared/base.json": {
          compilerOptions: { paths: { "@lib/*": ["./lib/*"] } },
        },
      },
    );
    expectTarget(graph, "app/entry.ts", "shared/lib/helper.ts");
  });
  it("applies ordered arrays of extends with the last parent taking precedence", () => {
    const graph = analyze(
      {
        "entry.ts": entry,
        "left/lib/helper.ts": helper,
        "right/lib/helper.ts": helper,
      },
      {
        "tsconfig.json": { extends: ["./left/base.json", "./right/base.json"] },
        "left/base.json": options,
        "right/base.json": options,
      },
    );
    expectTarget(graph, "entry.ts", "right/lib/helper.ts");
  });
  it.each([
    { files: ["yes.ts"] },
    { include: ["yes.ts"], exclude: ["no.ts"] },
    { include: ["*.ts"], exclude: ["no.ts"] },
  ])("applies only parsed root-file membership: %j", (membership) => {
    const graph = analyze(
      { "yes.ts": entry, "no.ts": entry, "lib/helper.ts": helper },
      { "tsconfig.json": { ...options, ...membership } },
    );
    expectTarget(graph, "yes.ts", "lib/helper.ts");
    expect(callTarget(graph, "no.ts").call.resolution).toBe("external");
  });
  it.each([false, true])(
    "honors allowJs=%s for ownership while still extracting JS",
    (allowJs) => {
      const graph = analyze(
        { "entry.js": entry, "lib/helper.ts": helper },
        {
          "tsconfig.json": {
            compilerOptions: { ...options.compilerOptions, allowJs },
          },
        },
      );
      expect(callTarget(graph, "entry.js").call.resolution).toBe(
        allowJs ? "resolved" : "external",
      );
    },
  );
  it.each([
    "{ invalid",
    { ...options, files: [] },
    { compilerOptions: { baseUrl: 7 } },
  ])(
    "blocks ancestor fallback after an invalid or excluding nearest config: %j",
    (nearest) => {
      const graph = analyze(
        { "child/entry.ts": entry, "lib/helper.ts": helper },
        { "tsconfig.json": options, "child/tsconfig.json": nearest },
      );
      expect(callTarget(graph, "child/entry.ts").call.resolution).toBe(
        "external",
      );
    },
  );
  it.each(["ignored", "symlinked", "unreadable", "budget"])(
    "treats an opaque %s nearest configuration as a scope barrier",
    (reason) => {
      const graph = analyze(
        { "child/entry.ts": entry, "lib/helper.ts": helper },
        { "tsconfig.json": options },
        [
          {
            filePath: "child/tsconfig.json",
            message: `CONFIGURATION_UNAVAILABLE: ${reason}`,
          },
        ],
      );
      expect(callTarget(graph, "child/entry.ts").call.resolution).toBe(
        "external",
      );
    },
  );
  it("does not guess named configuration ownership or expand project references", () => {
    const graph = analyze(
      {
        "entry.ts": entry,
        "leaf/entry.ts": entry,
        "leaf/lib/helper.ts": helper,
        "lib/helper.ts": helper,
      },
      {
        "tsconfig.json": {
          files: [],
          references: [{ path: "./tsconfig.app.json" }],
        },
        "tsconfig.app.json": options,
        "leaf/tsconfig.json": options,
      },
    );
    expect(callTarget(graph, "entry.ts").call.resolution).toBe("external");
    expectTarget(graph, "leaf/entry.ts", "leaf/lib/helper.ts");
    expect(
      graph.diagnostics.some(
        (d) => d.filePath === "tsconfig.json" && /references/i.test(d.message),
      ),
    ).toBe(true);
    expect(
      callTarget(
        analyze(
          { "entry.ts": entry, "lib/helper.ts": helper },
          { "tsconfig.app.json": options },
        ),
        "entry.ts",
      ).call.resolution,
    ).toBe("external");
  });
  it.each(["missing/*", "../outside/*", "node_modules/ignored/*", "linked/*"])(
    "keeps unavailable paths target %s imports and calls unknown, bare packages external",
    (destination) => {
      const graph = analyze(
        {
          "entry.ts": `${entry}\nimport { other } from "package"; other();`,
          "lib/helper.ts": helper,
        },
        {
          "tsconfig.json": {
            compilerOptions: { paths: { "@lib/*": [destination] } },
          },
        },
      );
      expectUnknown(graph, "entry.ts");
      expect(callTarget(graph, "entry.ts", "other()").call.resolution).toBe(
        "external",
      );
      expect(
        graph.diagnostics.some(
          (d) =>
            d.filePath === "tsconfig.json" &&
            /captured|unavailable/i.test(d.message),
        ),
      ).toBe(true);
    },
  );
  it.each([16, 17])(
    "independently validates %i inheritance levels even when every member is captured",
    (levels) => {
      const configs: Record<string, unknown> = {
        "tsconfig.json": { extends: "./tsconfig.2.json", ...options },
      };
      for (let level = 2; level <= levels; level++)
        configs[`tsconfig.${level}.json`] =
          level === levels ? {} : { extends: `./tsconfig.${level + 1}.json` };
      const graph = analyze(
        { "entry.ts": entry, "lib/helper.ts": helper },
        configs,
      );
      expect(callTarget(graph, "entry.ts").call.resolution).toBe(
        levels === 16 ? "resolved" : "external",
      );
      if (levels === 17)
        expect(graph.diagnostics.some((d) => /16|depth/i.test(d.message))).toBe(
          true,
        );
    },
  );
  it.each([
    { "tsconfig.base.json": { extends: "./tsconfig.json" } },
    { "tsconfig.base.json": { extends: "./missing.json" } },
    { "tsconfig.base.json": { extends: "package" } },
    { "tsconfig.base.json": { extends: "../outside.json" } },
    { "tsconfig.base.json": "{ invalid" },
  ])(
    "rejects the whole inherited chain without partial options: %j",
    (base) => {
      const graph = analyze(
        { "entry.ts": entry, "lib/helper.ts": helper },
        {
          "tsconfig.json": { extends: "./tsconfig.base.json", ...options },
          ...base,
        },
      );
      expect(callTarget(graph, "entry.ts").call.resolution).toBe("external");
      expect(graph.diagnostics.length).toBeGreaterThan(0);
    },
  );
  it("does not apply a captured parent that also has rejected-input evidence", () => {
    const graph = analyze(
      { "entry.ts": entry, "lib/helper.ts": helper },
      {
        "tsconfig.json": { extends: "./base.json", ...options },
        "base.json": {},
      },
      [{ filePath: "base.json", message: "CONFIGURATION_UNAVAILABLE: budget" }],
    );
    expect(callTarget(graph, "entry.ts").call.resolution).toBe("external");
  });
  it("does not clamp an escaping baseUrl back into the captured repository", () => {
    const graph = analyze(
      { "entry.ts": entry, "lib/helper.ts": helper },
      {
        "tsconfig.json": {
          compilerOptions: { baseUrl: "../", paths: { "@lib/*": ["lib/*"] } },
        },
      },
    );
    expectUnknown(graph, "entry.ts");
  });
  it("supports baseUrl-only imports and never turns ambient declarations into implementations", () => {
    const graph = analyze(
      {
        "entry.ts":
          'import { helper } from "helper"; helper(); import { ambient } from "@lib/ambient"; ambient();',
        "lib/helper.ts": helper,
        "lib/ambient.d.ts": "export declare function ambient(): void;",
      },
      {
        "tsconfig.json": {
          compilerOptions: { baseUrl: "./lib", paths: { "@lib/*": ["*"] } },
        },
      },
    );
    expectTarget(graph, "entry.ts", "lib/helper.ts");
    expect(callTarget(graph, "entry.ts", "ambient()").call.resolution).toBe(
      "unresolved",
    );
  });
});
