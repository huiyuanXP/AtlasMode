import { describe, expect, it } from "vitest";
import { createCapturedReferenceGraph } from "./projectReferenceGraph.js";
import { Graph } from "./graph.js";
import { indexTypeScript } from "./typescript.js";

const captured = (inputs: Record<string, unknown>) =>
  Object.entries(inputs).map(([path, value]) => ({
    path,
    bytes: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  }));
const inputsMap = (inputs: Record<string, unknown>) =>
  new Map(
    Object.entries(inputs).map(([path, value]) => [
      path,
      JSON.stringify(value),
    ]),
  );
describe("IDX03 independent review boundary regressions", () => {
  it("keeps the global 2048 reference budget across recursive parent resumes", () => {
    const inputs = {
      "tsconfig.json": {
        references: Array.from({ length: 2048 }, () => ({
          path: "./shared.json",
        })),
      },
      "shared.json": {
        references: Array.from({ length: 2048 }, () => ({
          path: "./leaf.json",
        })),
      },
      "leaf.json": {},
    };
    const result = createCapturedReferenceGraph(
      inputsMap(inputs),
      ["tsconfig.json"],
      () => true,
    );
    const graph = result.view([]);
    expect(graph.counts.observedReferences).toBeLessThanOrEqual(2048);
    expect(graph.status).toBe("partial");
  });
  it.each([
    ["a", "z"],
    ["z", "a"],
  ])(
    "checks deep reused paths when shallow root is %s and deep root %s",
    (shallow, deep) => {
      const inputs: Record<string, unknown> = {
        [shallow + "/tsconfig.json"]: {
          references: [{ path: "../shared.json" }],
        },
        [deep + "/tsconfig.json"]: { references: [{ path: "../level1.json" }] },
        "shared.json": { references: [{ path: "./leaf.json" }] },
        "leaf.json": {},
      };
      for (let i = 1; i <= 14; i++)
        inputs["level" + i + ".json"] = {
          references: [
            {
              path: i === 14 ? "./shared.json" : "./level" + (i + 1) + ".json",
            },
          ],
        };
      const result = createCapturedReferenceGraph(
        inputsMap(inputs),
        [shallow + "/tsconfig.json", deep + "/tsconfig.json"],
        () => true,
      );
      expect(result.valid(shallow + "/tsconfig.json")).toBe(true);
      expect(result.valid(deep + "/tsconfig.json")).toBe(false);
      expect(result.reachable(shallow + "/tsconfig.json")).toContain(
        "leaf.json",
      );
      expect(result.reachable(deep + "/tsconfig.json")).not.toContain(
        "leaf.json",
      );
    },
  );
  it("shares a leaf veto through a forwarding namespace in another scope", () => {
    const files = {
      "app/entry.cjs":
        'const lib=require("../forward/index.cjs"); function entry(){lib.helper();} exports.entry=entry;',
      "forward/index.cjs": 'module.exports=require("../lib/main.cjs");',
      "lib/main.cjs": "function helper(){} exports.helper=helper;",
      "mutator/change.cjs":
        'const lib=require("../lib/main.cjs"); lib.helper=()=>9;',
    };
    const configs: Record<string, unknown> = {
      "tsconfig.json": {
        files: [],
        references: ["app", "forward", "lib", "mutator"].map((name) => ({
          path: "./configs/" + name + ".json",
        })),
      },
    };
    for (const name of ["app", "forward", "lib", "mutator"])
      configs["configs/" + name + ".json"] = {
        compilerOptions: { composite: true, allowJs: true },
        include: ["../" + name],
      };
    const graph = new Graph("idx03-review-forward");
    indexTypeScript(captured(files), graph, captured(configs));
    expect(
      graph.relations.find(
        (r) =>
          r.type === "calls" &&
          r.evidence.filePath === "app/entry.cjs" &&
          r.evidence.text === "lib.helper()",
      ),
    ).toMatchObject({ resolution: "unresolved", targetId: null });
  });
  it.each(["write", "escape"])(
    "vetoes an independent scope's CommonJS namespace %s before another consumer call",
    (hazard) => {
      const sources = {
        "app/entry.cjs":
          'const {helper}=require("../lib/main.cjs"); function entry(){helper();} exports.entry=entry;',
        "lib/main.cjs": "function helper(){} exports.helper=helper;",
        "mutator/change.cjs":
          hazard === "write"
            ? 'const mod=require("../lib/main.cjs"); mod.helper=()=>9;'
            : 'const mod=require("../lib/main.cjs"); function consume(x){} consume(mod);',
      };
      const configs: Record<string, unknown> = {
        "tsconfig.json": {
          files: [],
          references: [
            { path: "./configs/app.json" },
            { path: "./configs/lib.json" },
            { path: "./configs/mutator.json" },
          ],
        },
      };
      for (const name of ["app", "lib", "mutator"])
        configs["configs/" + name + ".json"] = {
          compilerOptions: { composite: true, allowJs: true },
          include: ["../" + name],
        };
      const graph = new Graph("idx03-review");
      indexTypeScript(captured(sources), graph, captured(configs));
      expect(
        graph.relations.find(
          (r) =>
            r.type === "calls" &&
            r.evidence.filePath === "app/entry.cjs" &&
            r.evidence.text === "helper()",
        ),
      ).toMatchObject({ resolution: "unresolved", targetId: null });
    },
  );
});
