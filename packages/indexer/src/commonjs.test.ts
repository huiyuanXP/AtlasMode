import { describe, expect, it } from "vitest";
import { makeId } from "@codemap/core";
import { Graph } from "./graph.js";
import { indexTypeScript } from "./typescript.js";

function index(
  files: Record<string, string>,
  mode?: (path: string) => "commonjs" | "esm" | "unknown",
  configs: Record<string, string> = {},
) {
  const graph = new Graph("cjs");
  const capture = (input: Record<string, string>) =>
    Object.entries(input).map(([path, text]) => ({
      path,
      bytes: Buffer.from(text),
    }));
  indexTypeScript(capture(files), graph, capture(configs), [], mode);
  return graph;
}
function relation(graph: Graph, text: string, path = "entry.cjs") {
  const call = graph.relations.find(
    (r) =>
      r.type === "calls" &&
      r.evidence.filePath === path &&
      r.evidence.text === text,
  );
  expect(call, `${path}: ${text}`).toBeDefined();
  return call!;
}
function unresolved(graph: Graph, text = "mod.help()", path = "entry.cjs") {
  expect(relation(graph, text, path)).toMatchObject({
    targetId: null,
    resolution: "unresolved",
    reason: expect.any(String),
  });
}
function resolved(
  graph: Graph,
  text: string,
  name: string,
  path = "lib.cjs",
  kind = "FunctionDeclaration",
) {
  const id = makeId("function", "cjs", path, name, kind);
  expect(relation(graph, text)).toMatchObject({
    targetId: id,
    resolution: "resolved",
  });
  expect(graph.nodes.get(id)).toMatchObject({
    exported: true,
    filePath: path,
    qualifiedName: name,
  });
}
const stable = "function help() {}\nexports.help = help;";
const consumer =
  "const mod = require('./lib.cjs');\nfunction entry() { mod.help(); }";

describe("captured CommonJS", () => {
  it.each([
    ["declaration", stable, "help", "FunctionDeclaration"],
    ["arrow", "exports.help = () => {};", "<anonymous>", "ArrowFunction"],
    [
      "function expression",
      "exports.help = function named() {};",
      "named",
      "FunctionExpression",
    ],
    [
      "const callable",
      "const help = () => {}; exports.help = help;",
      "help",
      "ArrowFunction",
    ],
    [
      "object shorthand",
      "function help() {} module.exports = {help};",
      "help",
      "FunctionDeclaration",
    ],
    [
      "object property",
      "module.exports = {help: function named() {}};",
      "help",
      "FunctionExpression",
    ],
    [
      "literal property",
      "function help() {} exports['help'] = help;",
      "help",
      "FunctionDeclaration",
    ],
  ])(
    "resolves stable %s with unchanged declaration identity",
    (_label, library, name, kind) => {
      const graph = index({ "lib.cjs": library, "entry.cjs": consumer });
      resolved(graph, "mod.help()", name!, "lib.cjs", kind);
      expect(relation(graph, "mod.help()").evidence).toMatchObject({
        filePath: "entry.cjs",
        line: 2,
      });
    },
  );
  it.each([
    [
      "const renamed",
      "const { help: renamed } = require('./lib.cjs');",
      "renamed()",
    ],
    [
      "const property",
      "const renamed = require('./lib.cjs').help;",
      "renamed()",
    ],
    ["literal selection", "const mod = require('./lib.cjs');", "mod['help']()"],
    ["direct property", "", "require('./lib.cjs').help()"],
  ])("supports %s", (_label, binding, call) => {
    resolved(
      index({
        "lib.cjs": stable,
        "entry.cjs": `${binding} function entry() { ${call}; }`,
      }),
      call!,
      "help",
    );
  });
  it.each(["module.exports = help;", "exports = module.exports = help;"])(
    "supports the single default initialization %s",
    (assignment) => {
      const graph = index({
        "lib.cjs": `function help() {} ${assignment}`,
        "entry.cjs":
          "const main = require('./lib.cjs'); function entry() { main(); }",
      });
      resolved(graph, "main()", "help");
    },
  );
  it.each([
    ["repeated", "exports.help = function replacement() {};"],
    ["compound", "exports.help ||= function replacement() {};"],
    ["delete", "delete exports.help;"],
    ["update", "exports.help++;"],
    ["conditional", "if (flag) exports.help = help;"],
    ["nested write", "function mutate() { exports.help = help; }"],
    ["unknown key", "exports[key] = help;"],
    ["root replacement", "module.exports = {help};"],
    ["exports replacement", "exports = {help};"],
    ["namespace escape", "mutate(exports);"],
    ["module escape", "mutate(module);"],
    ["namespace alias", "const alias = exports;"],
    ["function rewrite", "help = function replacement() {};"],
    ["function destructuring rewrite", "({help} = other);"],
  ])("rejects %s export uncertainty", (_label, mutation) => {
    const graph = index({
      "lib.cjs": `${stable}\n${mutation}`,
      "entry.cjs": consumer,
    });
    unresolved(graph);
    expect(
      [...graph.nodes.values()].find(
        (n) => n.name === "help" && n.filePath === "lib.cjs",
      )!.exported,
    ).toBe(false);
  });
  it.each([
    "exports.bad = runtime;",
    "exports.bad = require('outside');",
    "exports.bad = help; exports.bad = other;",
    "if (flag) exports.bad = help;",
    "delete exports.bad;",
  ])("preserves a different stable export when %s", (mutation) => {
    resolved(
      index({ "lib.cjs": `${stable}\n${mutation}`, "entry.cjs": consumer }),
      "mod.help()",
      "help",
    );
  });
  it.each([
    "function wrap(exports) { exports.help = help; }",
    "const exports = {}; exports.help = help;",
    "import exports from './other.mjs'; exports.help = help;",
    "function wrap(module) { module.exports = {help}; }",
    "const module = {}; module.exports = {help};",
  ])("rejects shadowed export identity: %s", (body) => {
    unresolved(
      index({
        "lib.cjs": `function help() {} ${body}`,
        "entry.cjs": consumer,
        "other.mjs": "export default {};",
      }),
    );
  });
  it.each([
    "function entry(require) { const mod = require('./lib.cjs'); mod.help(); }",
    "const require = load; const mod = require('./lib.cjs'); function entry() { mod.help(); }",
    "import require from './other.mjs'; const mod = require('./lib.cjs'); function entry() { mod.help(); }",
  ])("rejects shadowed require identity: %s", (entry) => {
    const graph = index({
      "lib.cjs": stable,
      "entry.cjs": entry,
      "other.mjs": "export default function load() {}",
    });
    unresolved(graph);
    expect(
      graph.relations.filter(
        (r) => r.type === "imports" && r.evidence.text?.startsWith("require("),
      ),
    ).toEqual([expect.objectContaining({ resolution: "unresolved" })]);
  });
  it("retains a user function named require as a direct callee but rejects its assumed namespace", () => {
    const graph = index({
      "lib.cjs": stable,
      "entry.cjs":
        "function require(name) { return {}; } const mod = require('./lib.cjs'); function entry() { mod.help(); }",
    });
    unresolved(graph);
    expect(relation(graph, "require('./lib.cjs')")).toMatchObject({
      resolution: "resolved",
      targetId: makeId(
        "function",
        "cjs",
        "entry.cjs",
        "require",
        "FunctionDeclaration",
      ),
    });
  });
  it.each([
    ["let", "let mod = require('./lib.cjs');"],
    ["var", "var mod = require('./lib.cjs');"],
    ["const rewritten", "const mod = require('./lib.cjs'); mod = other;"],
  ])("rejects %s importer bindings", (_label, binding) => {
    unresolved(
      index({
        "lib.cjs": stable,
        "entry.cjs": `${binding} function entry() { mod.help(); }`,
      }),
    );
  });
  it.each([
    ["member write", "mod.help = other;", false],
    ["compound write", "mod.help ||= other;", false],
    ["delete", "delete mod.help;", false],
    ["unknown key", "mod[key] = other;", true],
    ["namespace escape", "mutate(mod);", true],
    ["namespace alias", "const alias = mod;", true],
  ])(
    "invalidates shared exports across consumers for %s",
    (_label, mutation, all) => {
      const graph = index({
        "lib.cjs": `${stable} function safe() {} exports.safe = safe;`,
        "mutator.cjs": `const mod = require('./lib.cjs'); ${mutation}`,
        "entry.cjs": `${consumer} mod.safe();`,
      });
      unresolved(graph);
      if (all) unresolved(graph, "mod.safe()");
      else resolved(graph, "mod.safe()", "safe");
    },
  );
  it.each(["mjs", "js", "ts", "jsx"])(
    "rejects Node globals without .cjs mode in %s",
    (extension) => {
      const graph = index({
        "lib.cjs": stable,
        [`entry.${extension}`]: consumer,
      });
      unresolved(graph, "mod.help()", `entry.${extension}`);
    },
  );
  it("uses the internal mode provider and rejects .js ESM syntax even with commonjs mode", () => {
    const files = {
      "lib.js": stable,
      "entry.cjs": consumer.replace("lib.cjs", "lib.js"),
    };
    resolved(
      index(files, () => "commonjs"),
      "mod.help()",
      "help",
      "lib.js",
    );
    unresolved(
      index({ ...files, "lib.js": `export {}; ${stable}` }, () => "commonjs"),
    );
    unresolved(index(files));
  });
  it.each([
    "function help() {} exports.help = factory();",
    "declare function help(): void; exports.help = help;",
    "const help = () => {}; help = replacement; exports.help = help;",
    "import type { help } from './types'; exports.help = help;",
    "module.exports = require('./forward.cjs');",
  ])("does not infer an implementation from %s", (library) => {
    unresolved(
      index({
        "lib.cjs": library,
        "entry.cjs": consumer,
        "forward.cjs": stable,
        "types.ts": "export declare function help(): void;",
      }),
    );
  });
  it("guards ESM imports of rejected CJS properties", () => {
    const graph = index({
      "lib.cjs": `${stable} exports.help = function replacement() {};`,
      "entry.mjs":
        "import {help} from './lib.cjs'; import * as mod from './lib.cjs'; function entry() { help(); mod.help(); }",
    });
    unresolved(graph, "help()", "entry.mjs");
    unresolved(graph, "mod.help()", "entry.mjs");
  });
  it("records missing relative/configured imports as unresolved and bare dependencies as external", () => {
    const graph = index(
      {
        "entry.cjs":
          "const a = require('./missing.cjs'); const b = require('@local/missing'); const c = require('outside'); a.help(); b.help(); c.help();",
      },
      undefined,
      {
        "tsconfig.json":
          '{"compilerOptions":{"allowJs":true,"paths":{"@local/*":["./lib/*"]}}}',
      },
    );
    unresolved(graph, "a.help()");
    unresolved(graph, "b.help()");
    expect(relation(graph, "c.help()").resolution).toBe("external");
    expect(
      graph.relations
        .filter((r) => r.type === "imports")
        .map((r) => r.resolution),
    ).toEqual(["unresolved", "unresolved", "external"]);
  });
  it.each([
    ["export destructuring", "({value: exports.help} = other);", ""],
    ["consumer destructuring", "", "({value: mod.help} = other);"],
    ["consumer array write", "", "[mod.help] = other;"],
    ["consumer for-of write", "", "for (mod.help of values) {}"],
  ])(
    "rejects %s while retaining another property",
    (_label, libraryWrite, consumerWrite) => {
      const graph = index({
        "lib.cjs": `${stable} function safe() {} exports.safe = safe; ${libraryWrite}`,
        "entry.cjs": `${consumer} ${consumerWrite} mod.safe();`,
      });
      unresolved(graph);
      resolved(graph, "mod.safe()", "safe");
    },
  );
  it("rejects type-only namespace import calls", () => {
    const graph = index({
      "lib.cjs": stable,
      "entry.ts":
        "import type * as mod from './lib.cjs'; function entry() { mod.help(); }",
    });
    unresolved(graph, "mod.help()", "entry.ts");
  });
  it.each([
    "function help() {} function help() {} exports.help = help;",
    "function help() {} var help = replacement; exports.help = help;",
  ])("rejects ambiguous callable declarations: %s", (library) => {
    unresolved(index({ "lib.cjs": library, "entry.cjs": consumer }));
  });
  it("accepts static object literal keys but isolates unknown values", () => {
    resolved(
      index({
        "lib.cjs":
          "function help() {} module.exports = {['help']: help, bad: runtime};",
        "entry.cjs": consumer,
      }),
      "mod.help()",
      "help",
    );
  });
  it("retains a callable default despite an unsupported known property", () => {
    const graph = index({
      "lib.cjs":
        "function help() {} exports = module.exports = help; exports.bad = require('outside');",
      "entry.cjs": "const main = require('./lib.cjs'); main();",
    });
    resolved(graph, "main()", "help");
  });
  it("guards a rejected CommonJS export through an ESM re-export", () => {
    const graph = index({
      "lib.cjs": `${stable} exports.help = function replacement() {};`,
      "barrel.mjs": "export {help} from './lib.cjs';",
      "entry.mjs": "import {help} from './barrel.mjs'; help();",
    });
    unresolved(graph, "help()", "entry.mjs");
  });
  it("collects consumer mutations before calls regardless of input ordering", () => {
    const graph = index({
      "entry.cjs": consumer,
      "lib.cjs": stable,
      "mutator.cjs":
        "const mod = require('./lib.cjs'); mod.help = replacement;",
    });
    unresolved(graph);
  });
  it("retains IDs across trivia without changing anonymous implementation names", () => {
    const a = index({
      "lib.cjs": "exports.help = () => {};",
      "entry.cjs": consumer,
    });
    const b = index({
      "lib.cjs": "\nexports.help = () => {};",
      "entry.cjs": consumer,
    });
    expect(relation(b, "mod.help()").targetId).toBe(
      relation(a, "mod.help()").targetId,
    );
    resolved(b, "mod.help()", "<anonymous>", "lib.cjs", "ArrowFunction");
    expect(
      [...b.nodes.values()].find(
        (n) => n.kind === "function" && n.filePath === "lib.cjs",
      )!.startLine,
    ).toBe(2);
  });
  it("distinguishes a property named default from a callable module value", () => {
    const graph = index({
      "lib.cjs": "function help() {} exports.default = help;",
      "entry.cjs": "const main = require('./lib.cjs'); main(); main.default();",
    });
    unresolved(graph, "main()");
    resolved(graph, "main.default()", "help");
  });
  it("retains a callable root independently of its default property", () => {
    const graph = index({
      "lib.cjs":
        "function help() {} module.exports = help; module.exports.default = other;",
      "entry.cjs": "const main = require('./lib.cjs'); main(); main.default();",
    });
    resolved(graph, "main()", "help");
    unresolved(graph, "main.default()");
  });
  it("does not confuse ESM namespace default with an exported property named default", () => {
    const graph = index({
      "lib.cjs": "function help() {} exports.default = help;",
      "entry.mjs":
        "import main from './lib.cjs'; import * as mod from './lib.cjs'; main(); mod.default();",
    });
    unresolved(graph, "main()", "entry.mjs");
    unresolved(graph, "mod.default()", "entry.mjs");
  });
  it.each([
    ["exports", "exports.help()"],
    ["module", "module.exports.help()"],
  ])(
    "does not resolve local calls through a shadowed %s root",
    (parameter, call) => {
      const graph = index({
        "lib.cjs": `${stable} function caller(${parameter}) { ${call}; }`,
        "entry.cjs": consumer,
      });
      unresolved(graph, call, "lib.cjs");
      unresolved(graph);
    },
  );
  it.each([
    "function help() {} help = function replacement() {};",
    "const help = () => {}; help = replacement;",
  ])(
    "does not recover a rewritten local CJS callable through checker fallback: %s",
    (declaration) => {
      const graph = index({
        "lib.cjs": `${declaration} exports.help = help; function caller() { help(); }`,
        "entry.cjs": consumer,
      });
      unresolved(graph, "help()", "lib.cjs");
    },
  );
});
