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
  describe("require initialization cycles", () => {
    it.each([false, true])(
      "rejects both destructured cycle bindings regardless of source order (reverse=%s)",
      (reverse) => {
        const files = {
          "a.cjs":
            "const { b } = require('./b.cjs');\nfunction a() { return b(); }\nexports.a = a;",
          "b.cjs":
            "const { a } = require('./a.cjs');\nfunction b() { return a(); }\nexports.b = b;",
        };
        const graph = index(
          reverse ? Object.fromEntries(Object.entries(files).reverse()) : files,
        );
        for (const [path, call, name] of [
          ["a.cjs", "b()", "a"],
          ["b.cjs", "a()", "b"],
        ]) {
          unresolved(graph, call, path);
          expect(relation(graph, call!, path).reason).toMatch(/cycl/i);
          expect(
            graph.nodes.get(
              makeId("function", "cjs", path!, name!, "FunctionDeclaration"),
            ),
          ).toMatchObject({
            name,
            filePath: path,
            startLine: 2,
            exported: true,
          });
        }
        const imports = graph.relations.filter((r) => r.type === "imports");
        expect(imports).toHaveLength(2);
        for (const [source, target] of [
          ["a.cjs", "b.cjs"],
          ["b.cjs", "a.cjs"],
        ]) {
          const edge = imports.find((r) => r.evidence.filePath === source)!;
          expect(edge).toMatchObject({
            resolution: "resolved",
            evidence: { line: 1, text: `require('./${target}')` },
          });
          expect(graph.nodes.get(edge.targetId!)).toMatchObject({
            kind: "file",
            filePath: target,
          });
        }
      },
    );

    it("rejects a self-cycle without losing the actual exported declaration", () => {
      const graph = index({
        "entry.cjs":
          "const { entry: again } = require('./entry.cjs'); function entry() { again(); } exports.entry = entry;",
      });
      unresolved(graph, "again()");
      expect(relation(graph, "again()").reason).toMatch(/cycl/i);
      expect(
        graph.nodes.get(
          makeId(
            "function",
            "cjs",
            "entry.cjs",
            "entry",
            "FunctionDeclaration",
          ),
        ),
      ).toMatchObject({ exported: true });
    });

    it.each([
      ["namespace", "const mod = require('./lib.cjs');", "mod.help()", false],
      [
        "literal namespace",
        "const mod = require('./lib.cjs');",
        "mod['help']()",
        false,
      ],
      [
        "destructured",
        "const { help: selected } = require('./lib.cjs');",
        "selected()",
        false,
      ],
      [
        "property binding",
        "const selected = require('./lib.cjs').help;",
        "selected()",
        false,
      ],
      ["direct property", "", "require('./lib.cjs').help()", false],
      [
        "callable binding",
        "const selected = require('./lib.cjs');",
        "selected()",
        true,
      ],
      ["direct callable", "", "require('./lib.cjs')()", true],
    ] as const)(
      "guards %s in a cycle and preserves its acyclic implementation ID",
      (_label, binding, call, callable) => {
        const files = {
          "entry.cjs": `${binding} function entry() { ${call}; }`,
          "lib.cjs": `function help() {} ${callable ? "module.exports = help;" : "exports.help = help;"}`,
        };
        const cyclic = index({
          ...files,
          "lib.cjs": `require('./entry.cjs'); ${files["lib.cjs"]}`,
        });
        unresolved(cyclic, call);
        expect(relation(cyclic, call).reason).toMatch(/cycl/i);
        expect(
          cyclic.nodes.get(
            makeId("function", "cjs", "lib.cjs", "help", "FunctionDeclaration"),
          ),
        ).toMatchObject({ exported: true });
        resolved(index(files), call, "help");
      },
    );

    it("detects a longer cycle through side-effect requires while preserving outgoing and incoming acyclic bindings", () => {
      const graph = index({
        "entry.cjs":
          "const { help } = require('./a.cjs'); function entry() { help(); }",
        "a.cjs": "require('./b.cjs'); function help() {} exports.help = help;",
        "b.cjs":
          "require('./entry.cjs'); const leaf = require('./leaf.cjs'); function b() { leaf.work(); }",
        "leaf.cjs": "function work() {} exports.work = work;",
        "outside.cjs":
          "const mod = require('./a.cjs'); function outside() { mod.help(); }",
      });
      unresolved(graph, "help()");
      expect(relation(graph, "leaf.work()", "b.cjs")).toMatchObject({
        resolution: "resolved",
        targetId: makeId(
          "function",
          "cjs",
          "leaf.cjs",
          "work",
          "FunctionDeclaration",
        ),
      });
      expect(relation(graph, "mod.help()", "outside.cjs")).toMatchObject({
        resolution: "resolved",
        targetId: makeId(
          "function",
          "cjs",
          "a.cjs",
          "help",
          "FunctionDeclaration",
        ),
      });
    });

    it.each([
      ["shadowed", "function local(require) { require('./entry.cjs'); }"],
      ["dynamic", "require('./' + 'entry.cjs');"],
    ] as const)(
      "does not invent a cycle from a %s require",
      (_label, backEdge) => {
        const graph = index({
          "entry.cjs":
            "const mod = require('./lib.cjs'); function entry() { mod.help(); }",
          "lib.cjs": `${backEdge} ${stable}`,
        });
        resolved(graph, "mod.help()", "help");
      },
    );

    it("does not invent a cycle through an unproved Node-global mode", () => {
      const graph = index({
        "entry.cjs": consumer,
        "lib.cjs": `require('./bridge.js'); ${stable}`,
        "bridge.js": "require('./entry.cjs');",
      });
      resolved(graph, "mod.help()", "help");
    });

    it("preserves ordinary local function recursion even inside a cyclic module graph", () => {
      const graph = index({
        "entry.cjs":
          "require('./other.cjs'); function first() { first(); second(); } function second() { first(); } exports.first = first;",
        "other.cjs": "require('./entry.cjs');",
      });
      for (const name of ["first", "second"])
        expect(relation(graph, `${name}()`)).toMatchObject({
          resolution: "resolved",
          targetId: makeId(
            "function",
            "cjs",
            "entry.cjs",
            name,
            "FunctionDeclaration",
          ),
        });
    });

    it.each([
      ["property mutation", "mod.help = () => {};", true],
      ["unknown mutation", "mod[key] = () => {};", false],
      ["namespace escape", "mutate(mod);", false],
    ] as const)(
      "retains cross-consumer guards for a cyclic importer with %s",
      (_label, mutation, safeSurvives) => {
        const graph = index({
          "cycle.cjs": `const mod = require('./lib.cjs'); ${mutation} function cycle() { mod.help(); }`,
          "lib.cjs":
            "require('./cycle.cjs'); function help() {} function safe() {} exports.help = help; exports.safe = safe;",
          "entry.cjs":
            "const mod = require('./lib.cjs'); function entry() { mod.help(); mod.safe(); }",
          "consumer.mjs":
            "import { help } from './lib.cjs'; export function use() { help(); }",
        });
        unresolved(graph, "mod.help()", "cycle.cjs");
        unresolved(graph, "mod.help()");
        unresolved(graph, "help()", "consumer.mjs");
        if (safeSurvives) resolved(graph, "mod.safe()", "safe");
        else unresolved(graph, "mod.safe()");
      },
    );
  });
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
  // The former unsupported-forwarding case is now the exact supported subset.
  it("resolves single-hop forwarding to the original captured declaration", () => {
    resolved(
      index({
        "lib.cjs": "module.exports = require('./forward.cjs');",
        "entry.cjs": consumer,
        "forward.cjs": stable,
      }),
      "mod.help()",
      "help",
      "forward.cjs",
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
  it("rejects duplicate local executable declarations before checker fallback", () => {
    const graph = index({
      "lib.cjs":
        "function help() { first(); } function help() { second(); } exports.help = help; function caller() { help(); }",
      "entry.cjs": consumer,
    });
    unresolved(graph, "help()", "lib.cjs");
    unresolved(graph);
    expect(
      [...graph.nodes.values()]
        .filter((n) => n.filePath === "lib.cjs" && n.name === "help")
        .map((n) => n.qualifiedName),
    ).toEqual(["help", "help#2"]);
  });
  it("retains unique local CJS declarations and a single implementation with overload signatures", () => {
    const graph = index({
      "lib.cjs": `${stable} function caller() { help(); }`,
      "overloads.ts":
        "function help(value: string): void; function help(value: number): void; function help(value: string | number) {} exports.help = help; function caller() { help('value'); }",
      "entry.cjs": consumer,
    });
    expect(relation(graph, "help()", "lib.cjs")).toMatchObject({
      resolution: "resolved",
      targetId: makeId(
        "function",
        "cjs",
        "lib.cjs",
        "help",
        "FunctionDeclaration",
      ),
    });
    expect(relation(graph, "help('value')", "overloads.ts")).toMatchObject({
      resolution: "resolved",
      targetId: makeId(
        "function",
        "cjs",
        "overloads.ts",
        "help",
        "FunctionDeclaration",
      ),
    });
    resolved(graph, "mod.help()", "help");
  });
});

describe("package commonjs source syntax eligibility", () => {
  it.each([
    "import.meta.url;",
    "function meta() { return import.meta.url; }",
    "await Promise.resolve();",
    "class Holder { [await Promise.resolve()]() {} }",
    "for await (const item of []) {}",
    "if (true) { await Promise.resolve(); }",
  ])("rejects .js module syntax %s", (syntax) => {
    const graph = index(
      {
        "lib.js": `${syntax}\n${stable}`,
        "entry.js":
          "const mod = require('./lib.js'); function entry() { mod.help(); }",
      },
      () => "commonjs",
    );
    unresolved(graph, "mod.help()", "entry.js");
    expect(
      [...graph.nodes.values()].find((n) => n.name === "help")?.exported,
    ).not.toBe(true);
  });
  it.each([
    "async function helper() { await Promise.resolve(); }",
    "const holder = { async method() { await Promise.resolve(); } };",
    "class Holder { async method() { for await (const item of []) {} } }",
  ])("keeps nested async syntax eligible: %s", (syntax) => {
    const graph = index(
      {
        "lib.js": `${syntax}\n${stable}`,
        "entry.js":
          "const mod = require('./lib.js'); function entry() { mod.help(); }",
      },
      () => "commonjs",
    );
    expect(relation(graph, "mod.help()", "entry.js").resolution).toBe(
      "resolved",
    );
  });
});

describe("captured forwarding identities", () => {
  const forward = "module.exports = require('./middle.cjs');";
  const middle = "module['exports'] = require('./lib.cjs');";
  const entry =
    "const mod = require('./barrel.cjs'); function entry() { mod.help(); }";
  const objectLeaf =
    "function help() {} function safe() {} module.exports = { help, safe };";
  const chain = (leaf = stable, consumer = entry) => ({
    "entry.cjs": consumer,
    "barrel.cjs": forward,
    "middle.cjs": middle,
    "lib.cjs": leaf,
  });

  it.each([false, true])(
    "resolves two-hop forwarding without duplicate leaf nodes (reverse=%s)",
    (reverse) => {
      const files = chain();
      const graph = index(
        reverse ? Object.fromEntries(Object.entries(files).reverse()) : files,
      );
      resolved(graph, "mod.help()", "help");
      expect(
        [...graph.nodes.values()].filter(
          (n) => n.kind === "function" && n.name === "help",
        ),
      ).toHaveLength(1);
      const imported = graph.relations.find(
        (r) => r.type === "imports" && r.evidence.filePath === "entry.cjs",
      )!;
      expect(graph.nodes.get(imported.targetId!)).toMatchObject({
        filePath: "barrel.cjs",
      });
    },
  );

  it.each([
    [
      "function declaration",
      "function help() {} module.exports = help;",
      "mod()",
      "help",
      "FunctionDeclaration",
    ],
    [
      "anonymous function",
      "module.exports = function () {};",
      "mod()",
      "<anonymous>",
      "FunctionExpression",
    ],
    [
      "arrow",
      "module.exports = () => {};",
      "mod()",
      "<anonymous>",
      "ArrowFunction",
    ],
    [
      "object",
      "function help() {} module.exports = { help };",
      "mod.help()",
      "help",
      "FunctionDeclaration",
    ],
    [
      "named default",
      "function help() {} exports.default = help;",
      "mod.default()",
      "help",
      "FunctionDeclaration",
    ],
  ])(
    "forwards %s with its actual identity",
    (_label, leaf, call, name, kind) => {
      const graph = index(
        chain(
          leaf,
          `const mod = require('./barrel.cjs'); function entry() { ${call}; }`,
        ),
      );
      resolved(graph, call!, name!, "lib.cjs", kind);
    },
  );

  it("keeps callable default separate from named default", () => {
    const graph = index(
      chain(
        "function help() {} function named() {} module.exports = help; module.exports.default = named;",
        "const mod = require('./barrel.cjs'); function entry() { mod(); mod.default(); }",
      ),
    );
    resolved(graph, "mod()", "help");
    resolved(graph, "mod.default()", "named");
    unresolved(
      index(
        chain(
          "function help() {} exports.default = help;",
          "const mod = require('./barrel.cjs'); function entry() { mod(); }",
        ),
      ),
      "mod()",
    );
  });

  it.each([16, 17])("bounds a forwarding chain of %i edges", (depth) => {
    const files: Record<string, string> = {
      "entry.cjs":
        "const mod = require('./f0.cjs'); function entry() { mod.help(); }",
      "lib.cjs": stable,
    };
    for (let i = 0; i < depth; i++)
      files[`f${i}.cjs`] =
        `module.exports = require('./${i === depth - 1 ? "lib" : `f${i + 1}`}.cjs');`;
    const graph = index(files);
    if (depth === 16) resolved(graph, "mod.help()", "help");
    else unresolved(graph);
  });

  it.each([
    ["self", "module.exports = require('./barrel.cjs');", middle, stable],
    [
      "forward cycle",
      forward,
      "module.exports = require('./barrel.cjs');",
      stable,
    ],
    [
      "ordinary require back edge",
      forward,
      middle,
      "require('./barrel.cjs'); " + stable,
    ],
  ])(
    "rejects %s and preserves an unrelated component",
    (_label, barrel, mid, leaf) => {
      const graph = index({
        ...chain(leaf),
        "barrel.cjs": barrel!,
        "middle.cjs": mid!,
        "safe.cjs": "function okay() {} exports.okay = okay;",
        "other.cjs":
          "const { okay } = require('./safe.cjs'); function other() { okay(); }",
      });
      unresolved(graph);
      expect(relation(graph, "okay()", "other.cjs")).toMatchObject({
        resolution: "resolved",
      });
    },
  );

  it.each([
    ["barrel", "const mod = require('./barrel.cjs'); mod.help = replacement;"],
    ["middle", "const mod = require('./middle.cjs'); mod.help = replacement;"],
    ["leaf", "const mod = require('./lib.cjs'); delete mod.help;"],
    ["ESM default", "import mod from './barrel.cjs'; mod.help = replacement;"],
    [
      "ESM namespace default",
      "import * as mod from './barrel.cjs'; mod.default.help = replacement;",
    ],
  ])(
    "propagates a known-property write through %s to every alias",
    (_label, mutation) => {
      const graph = index({
        ...chain(
          objectLeaf,
          entry.replace("mod.help();", "mod.help(); mod.safe();"),
        ),
        "mutator.cjs": mutation!,
        "leaf-user.cjs":
          "const mod = require('./lib.cjs'); function user() { mod.help(); mod.safe(); }",
      });
      unresolved(graph);
      unresolved(graph, "mod.help()", "leaf-user.cjs");
      resolved(graph, "mod.safe()", "safe");
      expect(relation(graph, "mod.safe()", "leaf-user.cjs")).toMatchObject({
        resolution: "resolved",
      });
      expect(
        graph.nodes.get(
          makeId("function", "cjs", "lib.cjs", "help", "FunctionDeclaration"),
        ),
      ).toMatchObject({ exported: false });
    },
  );

  it.each([
    "const mod = require('./barrel.cjs'); mod[key] = replacement;",
    "const mod = require('./middle.cjs'); expose(mod);",
    "const mod = require('./lib.cjs'); const alias = mod;",
    "import mod from './barrel.cjs'; expose(mod);",
  ])("propagates whole-namespace invalidation: %s", (mutation) => {
    const graph = index({
      ...chain(objectLeaf),
      "mutator.cjs": mutation,
      "leaf-user.mjs":
        "import { help } from './lib.cjs'; function user() { help(); }",
    });
    unresolved(graph);
    unresolved(graph, "help()", "leaf-user.mjs");
  });

  it.each([
    "module.exports = require('./middle.cjs'); module.exports = require('./middle.cjs');",
    "if (flag) module.exports = require('./middle.cjs');",
    "exports = module.exports = require('./middle.cjs');",
    "const mod = require('./middle.cjs'); module.exports = mod;",
    "let mod = require('./middle.cjs'); module.exports = mod;",
    "var mod = require('./middle.cjs'); module.exports = mod;",
    "module.exports = require('./middle.cjs').help;",
    "module.exports = require(name);",
    "module.exports = require('external');",
    "module.exports = require('./middle.cjs'); module.exports.help = replacement;",
    "const module = {}; module.exports = require('./middle.cjs');",
    "const require = () => ({}); module.exports = require('./middle.cjs');",
    "module = {}; module.exports = require('./middle.cjs');",
    "require = other; module.exports = require('./middle.cjs');",
  ])("does not infer unsupported forwarding: %s", (barrel) =>
    unresolved(index({ ...chain(), "barrel.cjs": barrel })),
  );

  it.each(["unknown", "esm"] as const)(
    "rejects a %s leaf module mode",
    (mode) => {
      const graph = index(
        {
          "entry.cjs": entry,
          "barrel.cjs": "module.exports = require('./lib.js');",
          "lib.js": stable,
        },
        () => mode,
      );
      unresolved(graph);
    },
  );

  it("rejects missing captured leaves", () =>
    unresolved(
      index({
        "entry.cjs": entry,
        "barrel.cjs": forward,
        "middle.cjs": middle,
      }),
    ));

  it.each([false, true])(
    "unions sibling alias and leaf writes before exposure (reverse=%s)",
    (reverse) => {
      const files = {
        ...chain(
          objectLeaf,
          entry.replace("mod.help();", "mod.help(); mod.safe();"),
        ),
        "sibling.cjs": "module.exports = require('./lib.cjs');",
        "mutator.cjs":
          "const mod = require('./sibling.cjs'); mod.help = replacement;",
        "leaf-user.mjs":
          "import { help, safe } from './lib.cjs'; function user() { help(); safe(); }",
      };
      const graph = index(
        reverse ? Object.fromEntries(Object.entries(files).reverse()) : files,
      );
      unresolved(graph);
      unresolved(graph, "help()", "leaf-user.mjs");
      resolved(graph, "mod.safe()", "safe");
      expect(relation(graph, "safe()", "leaf-user.mjs")).toMatchObject({
        resolution: "resolved",
      });
    },
  );

  it("preserves stable properties after the leaf rewrites a different export", () => {
    const graph = index(
      chain(
        objectLeaf + " module.exports.help = replacement;",
        entry.replace("mod.help();", "mod.help(); mod.safe();"),
      ),
    );
    unresolved(graph);
    resolved(graph, "mod.safe()", "safe");
  });

  it.each([
    "module.exports = require('./middle.cjs'); module.exports.extra = other;",
    "exports = module.exports = require('./middle.cjs');",
    "if (flag) module.exports = require('./middle.cjs');",
    "module.exports = require('./middle.cjs'); module.exports = other;",
  ])(
    "withholds the escape exemption from an invalid forwarder: %s",
    (barrel) => {
      const graph = index({
        ...chain(),
        "barrel.cjs": barrel,
        "leaf-user.cjs": consumer,
      });
      unresolved(graph);
      unresolved(graph, "mod.help()", "leaf-user.cjs");
      expect(
        graph.nodes.get(
          makeId("function", "cjs", "lib.cjs", "help", "FunctionDeclaration"),
        ),
      ).toMatchObject({ exported: false });
    },
  );

  it("retains local recursion in a valid forwarded leaf", () => {
    const graph = index(
      chain("function help() { help(); } exports.help = help;"),
    );
    resolved(graph, "mod.help()", "help");
    expect(relation(graph, "help()", "lib.cjs")).toMatchObject({
      targetId: makeId(
        "function",
        "cjs",
        "lib.cjs",
        "help",
        "FunctionDeclaration",
      ),
      resolution: "resolved",
    });
  });

  it.each([false, true])(
    "rejects a forwarding edge in an ordinary require SCC (reverse=%s)",
    (reverse) => {
      const files = chain("require('./barrel.cjs'); " + stable);
      const graph = index(
        reverse ? Object.fromEntries(Object.entries(files).reverse()) : files,
      );
      unresolved(graph);
      expect(relation(graph, "mod.help()").reason).toMatch(/CommonJS/);
    },
  );

  it("retains the incoming cycle flag even when the physical target has a canonical leaf", () => {
    const graph = index({
      ...chain(),
      "barrel.cjs": "require('./entry.cjs'); " + forward,
      "entry.cjs":
        "const mod = require('./barrel.cjs'); function entry() { mod.help(); }",
    });
    unresolved(graph);
    expect(relation(graph, "mod.help()").reason).toMatch(/cycl/i);
    expect(
      graph.nodes.get(
        makeId("function", "cjs", "lib.cjs", "help", "FunctionDeclaration"),
      ),
    ).toMatchObject({ exported: true });
  });

  it.each([
    ["ESM", "export {}; module.exports = require('./middle.cjs');"],
    [
      "require function",
      "function require() {} module.exports = require('./middle.cjs');",
    ],
    [
      "module destructuring",
      "const { module } = source; module.exports = require('./middle.cjs');",
    ],
    [
      "compound write",
      "module.exports = require('./middle.cjs'); module.exports += other;",
    ],
    ["ESM syntax in leaf", "module.exports = require('./leaf.mjs');"],
  ])("rejects additional source identity uncertainty: %s", (_label, barrel) => {
    const graph = index({
      ...chain(),
      "barrel.cjs": barrel!,
      "leaf.mjs": "export function help() {}",
    });
    unresolved(graph);
  });

  it("rejects only the known empty-string property across forwarding aliases", () => {
    const graph = index({
      ...chain(
        "function help() {} function safe() {} module.exports = { '': help, safe };",
        "const mod = require('./barrel.cjs'); function entry() { mod[''](); mod.safe(); }",
      ),
      "mutator.cjs":
        "const mod = require('./middle.cjs'); mod[''] = replacement;",
    });
    unresolved(graph, "mod['']()");
    resolved(graph, "mod.safe()", "safe");
  });

  it("keeps callable identity after a named-default property mutation", () => {
    const graph = index({
      ...chain(
        "function help() {} function named() {} module.exports = help; module.exports.default = named;",
        "const mod = require('./barrel.cjs'); function entry() { mod(); mod.default(); }",
      ),
      "mutator.cjs":
        "const mod = require('./middle.cjs'); mod.default = replacement;",
    });
    resolved(graph, "mod()", "help");
    unresolved(graph, "mod.default()");
  });

  it("does not grant forwarding identity to a configured nonrelative require", () => {
    const graph = index(
      { ...chain(), "barrel.cjs": "module.exports = require('@middle');" },
      undefined,
      {
        "jsconfig.json": JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@middle": ["./middle.cjs"] },
          },
        }),
      },
    );
    unresolved(graph);
  });

  it.each([
    "module.exports = require('./middle.cjs');",
    "const mod = require('./middle.cjs'); module.exports = mod;",
    "let mod = require('./middle.cjs'); module.exports = mod;",
    "var mod = require('./middle.cjs'); module.exports = mod;",
    "module.exports = require('./middle.cjs').help;",
  ])(
    "rejects stale local export overlays on unsupported forwarding: %s",
    (root) => {
      const graph = index({
        ...chain(
          stable,
          "const mod = require('./barrel.cjs'); function entry() { mod.added(); }",
        ),
        "barrel.cjs": `${root} function added() {} module.exports.added = added;`,
        "mutator.cjs":
          "const mod = require('./lib.cjs'); mod.added = replacement;",
      });
      unresolved(graph, "mod.added()");
      expect(
        graph.nodes.get(
          makeId(
            "function",
            "cjs",
            "barrel.cjs",
            "added",
            "FunctionDeclaration",
          ),
        ),
      ).toMatchObject({ exported: false });
    },
  );

  it("guards ESM imports through the same forwarding identity", () => {
    const graph = index({
      ...chain(objectLeaf),
      "entry.cjs": "",
      "user.mjs":
        "import mod, { help } from './barrel.cjs'; import * as ns from './middle.cjs'; function use() { mod.help(); help(); ns.help(); ns.default.help(); ns(); }",
    });
    for (const call of [
      "mod.help()",
      "help()",
      "ns.help()",
      "ns.default.help()",
    ])
      expect(relation(graph, call, "user.mjs")).toMatchObject({
        resolution: "resolved",
        targetId: makeId(
          "function",
          "cjs",
          "lib.cjs",
          "help",
          "FunctionDeclaration",
        ),
      });
    unresolved(graph, "ns()", "user.mjs");
  });
});
