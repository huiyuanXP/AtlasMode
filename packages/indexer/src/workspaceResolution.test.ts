import { describe, expect, it } from "vitest";
import { Graph } from "./graph.js";
import { indexTypeScript } from "./typescript.js";
import type { SourceFile } from "./scan.js";

const capture = (inputs: Record<string, unknown>): SourceFile[] =>
  Object.entries(inputs).map(([path, value]) => ({
    path,
    bytes: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  }));
function analyze(
  exports: unknown,
  entry = 'import { helper } from "@demo/lib"; export function entry() { helper(); }',
  extraPackages: Record<string, unknown> = {},
  extraSources: Record<string, string> = {},
  workspaces: unknown = ["packages/*"],
  configs: Record<string, unknown> = {},
  captureDiagnostics: Parameters<typeof indexTypeScript>[3] = [],
) {
  const graph = new Graph("workspace");
  const files = {
    "packages/app/entry.ts": entry,
    "packages/lib/src/main.ts": "export function helper() { return 1; }",
    "packages/lib/src/other.ts": "export function helper() { return 2; }",
    "packages/lib/src/feature.ts": "export function helper() { return 3; }",
    "packages/lib/src/main.cjs": "function helper(){} exports.helper = helper;",
    ...extraSources,
  };
  indexTypeScript(
    capture(files),
    graph,
    capture(configs),
    captureDiagnostics,
    undefined,
    capture({
      "package.json": { private: true, workspaces },
      "packages/app/package.json": { name: "@demo/app" },
      "packages/lib/package.json": { name: "@demo/lib", exports },
      ...extraPackages,
    }),
  );
  return graph;
}
function edge(graph: Graph, file = "packages/app/entry.ts", text = "helper()") {
  const result = graph.relations.find(
    (r) =>
      r.type === "calls" &&
      r.evidence.filePath === file &&
      r.evidence.text === text,
  );
  expect(result).toBeDefined();
  return result!;
}
function target(
  graph: Graph,
  path = "packages/lib/src/main.ts",
  file = "packages/app/entry.ts",
) {
  const call = edge(graph, file);
  expect(call).toMatchObject({ resolution: "resolved" });
  expect(graph.nodes.get(call.targetId!)).toMatchObject({
    kind: "function",
    filePath: path,
    name: "helper",
  });
  const imported = graph.relations.find(
    (r) =>
      r.type === "imports" &&
      r.evidence.filePath === file &&
      r.resolution === "resolved",
  );
  expect(imported?.resolution).toBe("resolved");
}
function unknown(graph: Graph, file = "packages/app/entry.ts") {
  expect(edge(graph, file)).toMatchObject({
    resolution: "unresolved",
    targetId: null,
  });
  expect(
    graph.relations.find(
      (r) => r.type === "imports" && r.evidence.filePath === file,
    ),
  ).toMatchObject({ resolution: "unresolved", targetId: null });
}
describe("IDX02 captured workspace exports", () => {
  it("continues outer default after nested NO_MATCH but never after BLOCKED", () => {
    target(
      analyze({
        import: { custom: "./src/main.ts" },
        default: "./src/main.ts",
      }),
    );
    unknown(analyze({ import: { custom: null }, default: "./src/main.ts" }));
    unknown(
      analyze({
        import: { custom: "./src/missing.ts" },
        default: "./src/main.ts",
      }),
    );
  });
  it("rejects numeric condition keys and over-budget condition trees", () => {
    unknown(analyze({ "0": "./src/main.ts", default: "./src/main.ts" }));
    let nested: unknown = "./src/main.ts";
    for (let i = 0; i < 17; i++) nested = { default: nested };
    unknown(analyze(nested));
    const broad: Record<string, string> = {};
    for (let i = 0; i < 2049; i++) broad["custom" + i] = "./src/main.ts";
    broad.default = "./src/main.ts";
    unknown(analyze(broad));
  });
  it("maps root exports to the exact captured implementation", () =>
    target(analyze("./src/main.ts")));
  it("maps exact subpaths and static single-star source patterns", () => {
    target(
      analyze(
        { "./extra": "./src/other.ts", "./*": "./src/*.ts" },
        'import {helper} from "@demo/lib/extra"; function entry(){helper();}',
      ),
      "packages/lib/src/other.ts",
    );
    target(
      analyze(
        { "./*": "./src/*.ts" },
        'import {helper} from "@demo/lib/feature"; function entry(){helper();}',
      ),
      "packages/lib/src/feature.ts",
    );
  });
  it("selects literal import and require conditions without merging identities", () => {
    const exports = { import: "./src/main.ts", require: "./src/main.cjs" };
    target(analyze(exports));
    const graph = analyze(
      exports,
      "",
      {},
      {
        "packages/app/entry.cjs":
          'const {helper}=require("@demo/lib"); function entry(){helper();}',
      },
    );
    target(graph, "packages/lib/src/main.cjs", "packages/app/entry.cjs");
  });
  it("accepts convergent custom conditions and rejects divergent alternatives", () => {
    target(analyze({ custom: "./src/main.ts", default: "./src/main.ts" }));
    unknown(analyze({ custom: "./src/other.ts", default: "./src/main.ts" }));
    unknown(analyze({ custom: "./src/main.ts" }));
  });
  it("honors ordered default and inactive branches", () => {
    target(analyze({ default: "./src/main.ts", import: "./src/other.ts" }));
    target(analyze({ require: "./src/other.ts", import: "./src/main.ts" }));
  });
  it("rejects mixed request modes when their selected targets diverge", () => {
    unknown(
      analyze(
        { import: "./src/main.ts", require: "./src/main.cjs" },
        'import {helper} from "@demo/lib"; const lib = require("@demo/lib"); function entry(){helper();}',
      ),
    );
  });
  it.each([
    null,
    ["./src/main.ts"],
    { ".": "./src/main.ts", import: "./src/main.ts" },
    "./src/missing.ts",
    "../app/entry.ts",
    "./src/../src/main.ts",
    "./node_modules/main.ts",
    "./src/%2e/main.ts",
    "./src/main.ts?x",
    "./src/main.js",
  ])("keeps invalid/blocked/missing/guessed target unknown: %j", (exports) =>
    unknown(analyze(exports)),
  );
  it("does not infer private subpaths when exports lacks the requested key", () =>
    unknown(
      analyze(
        { ".": "./src/main.ts" },
        'import {helper} from "@demo/lib/src/main"; function entry(){helper();}',
      ),
    ));
  it("rejects duplicate workspace names without affecting unrelated names", () => {
    unknown(
      analyze(
        "./src/main.ts",
        undefined,
        {
          "packages/duplicate/package.json": {
            name: "@demo/lib",
            exports: "./src/main.ts",
          },
        },
        { "packages/duplicate/src/main.ts": "export function helper(){}" },
      ),
    );
  });
  it("rejects unregistered consumers and package targets crossing a nested package boundary", () => {
    unknown(analyze("./src/main.ts", undefined, {}, {}, ["packages/lib"]));
    unknown(
      analyze("./src/main.ts", undefined, {
        "packages/lib/src/package.json": { name: "nested" },
      }),
    );
  });
  it("supports object packages syntax and explicit workspace directories", () =>
    target(
      analyze(
        "./src/main.ts",
        undefined,
        {},
        {},
        { packages: ["packages/app", "packages/lib"] },
      ),
    ));
  it("does not apply unsupported workspace globs", () =>
    unknown(analyze("./src/main.ts", undefined, {}, {}, ["packages/**"])));
  it("preserves explicit paths precedence and refuses failed paths fallback", () => {
    const entry =
      'import {helper} from "@demo/lib"; function entry(){helper();}';
    const configs = {
      "packages/app/tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: { "@demo/lib": ["../lib/src/other.ts"] },
        },
        include: ["entry.ts"],
      },
    };
    target(
      analyze("./src/main.ts", entry, {}, {}, ["packages/*"], configs),
      "packages/lib/src/other.ts",
    );
    const bad = {
      "packages/app/tsconfig.json": {
        compilerOptions: {
          baseUrl: ".",
          paths: { "@demo/lib": ["missing.ts"] },
        },
        include: ["entry.ts"],
      },
    };
    unknown(analyze("./src/main.ts", entry, {}, {}, ["packages/*"], bad));
  });
  it("isolates nested workspace owners with identical package names", () => {
    const graph = analyze(
      "./src/main.ts",
      "",
      {
        "one/package.json": { workspaces: ["*"] },
        "one/app/package.json": { name: "one-app" },
        "one/lib/package.json": { name: "@same/lib", exports: "./main.ts" },
        "two/package.json": { workspaces: ["*"] },
        "two/app/package.json": { name: "two-app" },
        "two/lib/package.json": { name: "@same/lib", exports: "./main.ts" },
      },
      {
        "one/app/entry.ts":
          'import {helper} from "@same/lib"; function entry(){helper();}',
        "two/app/entry.ts":
          'import {helper} from "@same/lib"; function entry(){helper();}',
        "one/lib/main.ts": "export function helper(){}",
        "two/lib/main.ts": "export function helper(){}",
      },
    );
    target(graph, "one/lib/main.ts", "one/app/entry.ts");
    target(graph, "two/lib/main.ts", "two/app/entry.ts");
  });
  it("does not turn type-only workspace imports into callable runtime identity", () => {
    const graph = analyze(
      "./src/main.ts",
      'import type {helper} from "@demo/lib"; function entry(){helper();}',
    );
    expect(edge(graph)).toMatchObject({
      resolution: "unresolved",
      targetId: null,
    });
    expect(
      graph.relations.find(
        (r) =>
          r.type === "imports" &&
          r.evidence.filePath === "packages/app/entry.ts",
      )?.resolution,
    ).toBe("resolved");
  });

  it("rejects opaque consumer/target package manifests", () => {
    unknown(
      analyze("./src/main.ts", undefined, { "packages/app/package.json": "{" }),
    );
    unknown(
      analyze("./src/main.ts", undefined, {
        "packages/app/package.json": { name: "@demo/app", type: false },
      }),
    );
    unknown(
      analyze("./src/main.ts", undefined, {
        "packages/lib/package.json": {
          name: "@demo/lib",
          type: false,
          exports: "./src/main.ts",
        },
      }),
    );
  });
  it.each(["../private", "%2e", "folder//x", "node_modules/x", "feature?x"])(
    "rejects unsafe requested subpath even with a fixed pattern target: %s",
    (subpath) =>
      unknown(
        analyze(
          { "./*": "./src/main.ts" },
          `import {helper} from "@demo/lib/${subpath}"; function entry(){helper();}`,
        ),
      ),
  );
  it("does not infer runtime targets from type-only namespace and re-export chains", () => {
    const namespace = analyze(
      "./src/main.ts",
      'import type * as lib from "@demo/lib"; function entry(){lib.helper();}',
    );
    expect(edge(namespace, undefined, "lib.helper()")).toMatchObject({
      resolution: "unresolved",
      targetId: null,
    });
    const named = analyze(
      "./src/main.ts",
      'import {type helper} from "@demo/lib"; function entry(){helper();}',
    );
    expect(edge(named)).toMatchObject({
      resolution: "unresolved",
      targetId: null,
    });
    const barrel = analyze(
      "./src/main.ts",
      'import {helper} from "./barrel"; function entry(){helper();}',
      {},
      { "packages/app/barrel.ts": 'export type {helper} from "@demo/lib";' },
    );
    expect(edge(barrel)).toMatchObject({
      resolution: "unresolved",
      targetId: null,
    });
  });
  it("ignores shadowed require when selecting a separate static import request", () => {
    target(
      analyze(
        { import: "./src/main.ts", require: "./src/main.cjs" },
        'import {helper} from "@demo/lib"; function local(require:any){require("@demo/lib");} function entry(){helper();}',
      ),
    );
  });
  it("supports explicit own-package exports self-reference without a workspace", () => {
    target(
      analyze(
        "./src/main.ts",
        "",
        { "package.json": {} },
        {
          "packages/lib/entry.ts":
            'import {helper} from "@demo/lib"; function entry(){helper();}',
        },
      ),
      undefined,
      "packages/lib/entry.ts",
    );
  });

  it("requires nonempty wildcard matches and validates export-star type-only chains", () => {
    unknown(
      analyze(
        { "./foo*bar": "./src/main.ts" },
        'import {helper} from "@demo/lib/foobar"; function entry(){helper();}',
      ),
    );
    target(
      analyze(
        { "./foo*bar": "./src/main.ts" },
        'import {helper} from "@demo/lib/fooxbar"; function entry(){helper();}',
      ),
    );
    const graph = analyze(
      "./src/main.ts",
      'import {helper} from "./barrel"; function entry(){helper();}',
      {},
      { "packages/app/barrel.ts": 'export type * from "@demo/lib";' },
    );
    expect(edge(graph)).toMatchObject({
      resolution: "unresolved",
      targetId: null,
    });
  });
  it("rejects unavailable registered consumers and opaque nested target boundaries", () => {
    unknown(
      analyze(
        "./src/main.ts",
        undefined,
        { "packages/app/package.json": null },
        {},
        undefined,
        {},
        [
          {
            filePath: "packages/app/package.json",
            message: "PACKAGE_MANIFEST_UNAVAILABLE: ignored",
          },
        ],
      ),
    );
    unknown(
      analyze("./src/main.ts", undefined, {
        "packages/lib/src/package.json": "{",
      }),
    );
  });
  it.each([
    'function local(){var require:any; require("@demo/lib");}',
    'function local(){const require=(x:any)=>x; require("@demo/lib");}',
    'function local(){function require(x:any){} require("@demo/lib");}',
    'function local(){try{}catch(require){require("@demo/lib");}}',
    'function local(){for(const require of []){require("@demo/lib");}}',
  ])(
    "does not mix shadowed require binding with a static import: %s",
    (local) => {
      target(
        analyze(
          { import: "./src/main.ts", require: "./src/main.cjs" },
          'import {helper} from "@demo/lib"; ' +
            local +
            " function entry(){helper();}",
        ),
      );
    },
  );

  it("retains own __proto__ condition keys through wildcard substitution", () => {
    unknown(
      analyze(
        JSON.parse(
          '{"./*":{"__proto__":"./src/other.ts","default":"./src/main.ts"}}',
        ),
        'import {helper} from "@demo/lib/feature"; function entry(){helper();}',
      ),
    );
  });
  it("rejects case variants of forbidden node_modules segments", () => {
    unknown(
      analyze(
        "./NODE_MODULES/main.ts",
        undefined,
        {},
        { "packages/lib/NODE_MODULES/main.ts": "export function helper(){}" },
      ),
    );
    unknown(
      analyze(
        { "./*": "./src/main.ts" },
        'import {helper} from "@demo/lib/NODE_MODULES/file"; function entry(){helper();}',
      ),
    );
  });
});
