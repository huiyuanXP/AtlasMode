import { describe, expect, it } from "vitest";
import { makeId } from "@codemap/core";
import { Graph } from "./graph.js";
import { indexTypeScript } from "./typescript.js";

function index(
  mutation: string,
  reverse = false,
  leafExtra = "",
  mutatorImport = "const mod = require('./barrel.cjs');",
) {
  const files = {
    "leaf.cjs":
      "function main() {} function safe() {} module.exports = main; module.exports.safe = safe; " +
      leafExtra,
    "barrel.cjs": "module.exports = require('./leaf.cjs');",
    "mutator.cjs": mutatorImport + mutation,
    "entry.cjs":
      "const mod = require('./barrel.cjs'); function entry() { mod(); mod.safe(); mod.prototype.foo(); }",
  };
  const graph = new Graph("idx01");
  indexTypeScript(
    Object.entries(
      reverse ? Object.fromEntries(Object.entries(files).reverse()) : files,
    ).map(([path, text]) => ({ path, bytes: Buffer.from(text) })),
    graph,
  );
  return graph;
}
function call(graph: Graph, text: string) {
  const edge = graph.relations.find(
    (r) =>
      r.type === "calls" &&
      r.evidence.filePath === "entry.cjs" &&
      r.evidence.text === text,
  );
  expect(edge).toBeDefined();
  return edge!;
}
function root(graph: Graph, legal: boolean) {
  const id = makeId(
    "function",
    "idx01",
    "leaf.cjs",
    "main",
    "FunctionDeclaration",
  );
  expect(graph.nodes.get(id)?.exported).toBe(legal);
  expect(call(graph, "mod()")).toMatchObject(
    legal
      ? { resolution: "resolved", targetId: id }
      : { resolution: "unresolved", targetId: null },
  );
}
describe("IDX01 bounded nested mutation", () => {
  // A regression to whole-module invalidation breaks the legal default entry.
  it.each([
    "mod.prototype.foo = replacement;",
    "delete mod.prototype.foo;",
    "mod.prototype.foo++;",
    "mod.prototype[key] = replacement;",
    "mod[''].foo = replacement;",
    "mod.self.safe = replacement;",
    "mod.prototype.constructor.safe = replacement;",
    "mod.prototype[key].safe = replacement;",
    "mod.holder.safe = replacement;",
  ])("preserves root and rejects every named export after %s", (mutation) => {
    for (const reverse of [false, true]) {
      const graph = index(
        mutation,
        reverse,
        "module.exports.self = main; module.exports.holder = flag ? main : other;",
      );
      root(graph, true);
      expect(call(graph, "mod.safe()")).toMatchObject({
        resolution: "unresolved",
        targetId: null,
      });
      expect(call(graph, "mod.prototype.foo()")).toMatchObject({
        resolution: "unresolved",
        targetId: null,
      });
      expect(
        graph.nodes.get(
          makeId(
            "function",
            "idx01",
            "leaf.cjs",
            "safe",
            "FunctionDeclaration",
          ),
        )?.exported,
      ).toBe(false);
    }
  });
  it.each([
    "mod[key] = replacement;",
    "mod[key].foo = replacement;",
    "mutate(mod);",
    "const alias = mod;",
  ])("retains whole invalidation for %s", (mutation) =>
    root(index(mutation), false),
  );
  it("preserves root after ESM namespace default nested mutation", () => {
    const graph = index(
      "mod.default.prototype.foo = replacement;",
      false,
      "",
      "import * as mod from './barrel.cjs';",
    );
    root(graph, true);
    expect(call(graph, "mod.safe()").targetId).toBeNull();
  });
  it("keeps initialization cycle calls unresolved despite nested mutation", () => {
    root(
      index(
        "mod.prototype.foo = replacement;",
        false,
        "require('./barrel.cjs');",
      ),
      false,
    );
  });
  it("does not lose an untouched named export after a direct known-property write", () => {
    const graph = index("mod.prototype = replacement;");
    root(graph, true);
    expect(call(graph, "mod.safe()")).toMatchObject({
      resolution: "resolved",
      targetId: makeId(
        "function",
        "idx01",
        "leaf.cjs",
        "safe",
        "FunctionDeclaration",
      ),
    });
  });
  it("guards same-module self and constructor writes too", () => {
    const graph = index(
      "",
      false,
      "module.exports.self = main; module.exports.self.safe = replacement;",
    );
    root(graph, true);
    expect(call(graph, "mod.safe()").targetId).toBeNull();
  });
});
