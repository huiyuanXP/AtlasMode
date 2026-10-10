import { describe, expect, it } from "vitest";
import { createConfigurationResolver } from "./configResolution.js";
import { indexTypeScript } from "./typescript.js";
import { Graph } from "./graph.js";
import type { SourceFile } from "./scan.js";

const capture = (inputs: Record<string, unknown>): SourceFile[] =>
  Object.entries(inputs).map(([path, value]) => ({
    path,
    bytes: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  }));
const libConfig = { compilerOptions: { composite: true }, include: ["../lib"] };
const appConfig = {
  compilerOptions: { composite: true },
  include: ["../app"],
  references: [{ path: "./lib.json" }],
};
const configInputs = {
  "tsconfig.json": { files: [], references: [{ path: "./configs/app.json" }] },
  "configs/app.json": appConfig,
  "configs/lib.json": libConfig,
};
const sources = {
  "app/no-import.ts": "export function noImport(){ helper(); }",
  "app/side-effect.ts":
    'import "../lib/global.js"; export function sideEffect(){ helper(); }',
  "app/import.ts":
    'import { helper } from "../lib/module.js"; export function imported(){ helper(); }',
  "lib/global.ts": "function helper(){ return 1; }",
  "lib/module.ts": "export function helper(){ return 2; }",
};
function analyze(
  inputs = sources,
  configs: Record<string, unknown> = configInputs,
) {
  const graph = new Graph("idx03");
  indexTypeScript(capture(inputs), graph, capture(configs));
  return graph;
}
const call = (graph: Graph, path: string) =>
  graph.relations.find(
    (r) =>
      r.type === "calls" &&
      r.evidence.filePath === path &&
      r.evidence.text === "helper()",
  )!;
function resolver(
  inputs = sources,
  configs: Record<string, unknown> = configInputs,
) {
  return createConfigurationResolver(capture(inputs), capture(configs));
}
describe("IDX03 captured project references scope", () => {
  it("assigns actual referenced named project members independently without option inheritance", () => {
    const result = resolver();
    expect(result.scopeFor("app/import.ts")).toEqual({
      sourcePath: "app/import.ts",
      configPath: "configs/app.json",
      status: "resolved",
    });
    expect(result.scopeFor("lib/module.ts").configPath).toBe(
      "configs/lib.json",
    );
    expect(result.projectGraph.counts).toMatchObject({
      observedRoots: 1,
      observedProjects: 3,
      observedReferences: 2,
      sourceScopes: 5,
      resolved: 5,
    });
    expect(result.projectGraph.status).toBe("complete");
  });
  it("never resolves a no-import callable to a referenced global script", () => {
    expect(call(analyze(), "app/no-import.ts")).toMatchObject({
      resolution: "unresolved",
      targetId: null,
    });
  });
  it("never uses side-effect-only import as a callable binding proof", () => {
    expect(call(analyze(), "app/side-effect.ts")).toMatchObject({
      resolution: "unresolved",
      targetId: null,
    });
  });
  it("resolves a named binding module import to the exact referenced captured implementation", () => {
    const graph = analyze();
    const edge = call(graph, "app/import.ts");
    expect(edge.resolution).toBe("resolved");
    expect(graph.nodes.get(edge.targetId!)?.filePath).toBe("lib/module.ts");
  });
  it("does not mix global symbols between independent owned scopes", () => {
    const inputs = {
      ...sources,
      "other/tsconfig.json": "",
      "other/global.ts": "function helper(){ return 9; }",
    };
    delete inputs["other/tsconfig.json"];
    const graph = analyze(inputs, {
      ...configInputs,
      "other/tsconfig.json": { include: ["*.ts"] },
    });
    expect(call(graph, "app/no-import.ts").targetId).toBeNull();
  });
  it("keeps a valid named leaf ownership and own aliases when solution root also references missing configuration", () => {
    const configs = {
      "tsconfig.json": {
        files: [],
        compilerOptions: { baseUrl: ".", paths: { "@leaf": ["wrong.ts"] } },
        references: [{ path: "./configs/client.json" }, { path: "./missing" }],
      },
      "configs/client.json": {
        compilerOptions: {
          composite: true,
          baseUrl: "../src/client",
          paths: { "@leaf": ["helper.ts"] },
        },
        include: ["../src/client"],
      },
    };
    const inputs = {
      "src/client/entry.ts":
        'import { helper } from "@leaf"; export function entry(){ helper(); }',
      "src/client/helper.ts": "export function helper(){}",
    };
    const result = resolver(inputs, configs);
    expect(result.scopeFor("src/client/entry.ts")).toMatchObject({
      status: "resolved",
      configPath: "configs/client.json",
    });
    expect(result.projectGraph.status).toBe("partial");
    expect(
      result.projectGraph.projects.find((p) => p.configPath === "tsconfig.json")
        ?.status,
    ).toBe("invalid");
    const graph = analyze(inputs, configs);
    expect(
      graph.nodes.get(call(graph, "src/client/entry.ts").targetId!)?.filePath,
    ).toBe("src/client/helper.ts");
  });
  it("invalidates failing root's own members while preserving the valid leaf", () => {
    const configs = {
      ...configInputs,
      "tsconfig.json": {
        files: ["root.ts"],
        references: [{ path: "./configs/app.json" }, { path: "./missing" }],
      },
    };
    const inputs = {
      ...sources,
      "root.ts": "function helper(){} function root(){helper();}",
    };
    const result = resolver(inputs, configs);
    expect(result.scopeFor("root.ts").status).toBe("invalid");
    expect(result.scopeFor("app/import.ts").status).toBe("resolved");
    expect(call(analyze(inputs, configs), "root.ts").resolution).toBe(
      "unresolved",
    );
  });
  it("rejects overlap rather than picking a candidate by topology order", () => {
    const configs = {
      ...configInputs,
      "configs/lib.json": { ...libConfig, include: ["../app", "../lib"] },
    };
    expect(resolver(sources, configs).scopeFor("app/import.ts").status).toBe(
      "ambiguous",
    );
    expect(call(analyze(sources, configs), "app/import.ts").resolution).toBe(
      "unresolved",
    );
  });
  it("does not guess standalone named configuration ownership", () => {
    const result = resolver(sources, {
      "configs/standalone.json": { include: ["../app"] },
    });
    expect(result.scopeFor("app/import.ts").status).toBe("unconfigured");
    expect(result.projectGraph.counts.observedProjects).toBe(0);
  });
  it("honors nearest failed configuration barrier without ancestor fallback", () => {
    const configs = {
      ...configInputs,
      "app/tsconfig.json": { extends: "./missing.json" },
    };
    const result = resolver(sources, configs);
    expect(result.scopeFor("app/import.ts").status).toBe("invalid");
    expect(call(analyze(sources, configs), "app/import.ts").resolution).toBe(
      "unresolved",
    );
  });
  it("marks cycle closure invalid without invalidating an independent valid reachable branch", () => {
    const configs = {
      ...configInputs,
      "configs/lib.json": {
        ...libConfig,
        references: [{ path: "./app.json" }],
      },
      "configs/independent.json": {
        compilerOptions: { composite: true },
        include: ["../valid"],
      },
      "tsconfig.json": {
        files: [],
        references: [
          { path: "./configs/app.json" },
          { path: "./configs/independent.json" },
        ],
      },
    };
    const result = resolver(
      { ...sources, "valid/file.ts": "export function valid(){}" },
      configs,
    );
    expect(result.scopeFor("app/import.ts").status).toBe("invalid");
    expect(result.scopeFor("valid/file.ts")).toMatchObject({
      status: "resolved",
      configPath: "configs/independent.json",
    });
    expect(
      result.projectGraph.references.some((e) => e.status === "cycle"),
    ).toBe(true);
  });
  it("rejects referenced non-composite implementation authorization", () => {
    const configs = {
      ...configInputs,
      "configs/lib.json": { include: ["../lib"] },
    };
    const result = resolver(sources, configs);
    expect(result.scopeFor("lib/module.ts").status).toBe("invalid");
    expect(result.scopeFor("app/import.ts").status).toBe("invalid");
  });
  it("keeps excluded sources unconfigured rather than falling back to ancestor options", () => {
    const configs = {
      "tsconfig.json": { include: ["app"] },
      "app/tsconfig.json": { files: ["import.ts"] },
    };
    expect(resolver(sources, configs).scopeFor("app/no-import.ts").status).toBe(
      "unconfigured",
    );
  });
  it("records all scope counts while returning bounded stable samples without altering ownership", () => {
    const inputs = Object.fromEntries(
      Array.from({ length: 72 }, (_, i) => [
        `app/file${String(i).padStart(3, "0")}.ts`,
        "export function item(){}",
      ]),
    );
    const result = resolver(inputs, { "tsconfig.json": { include: ["app"] } });
    expect(result.projectGraph.counts).toMatchObject({
      sourceScopes: 72,
      resolved: 72,
    });
    expect(result.projectGraph.scopes).toHaveLength(50);
    expect(result.projectGraph.truncated.scopes).toBe(true);
    expect(result.scopeFor("app/file071.ts").status).toBe("resolved");
  });
  it("preserves legacy no-reference same-scope global callable behavior", () => {
    const graph = analyze(
      {
        "one.ts": "function helper(){}",
        "two.ts": "function entry(){helper();}",
      },
      { "tsconfig.json": { include: ["*.ts"] } },
    );
    expect(call(graph, "two.ts").resolution).toBe("resolved");
  });
});
