import { afterEach, describe, expect, it } from "vitest";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { snapshotSchema, type CodeSnapshot } from "@codemap/core";
import { SourceIndexer } from "./index.js";

const temps: string[] = [];
const fixtureRoot = fileURLToPath(
  new URL("../../../fixtures/", import.meta.url),
);
async function temp() {
  const p = await mkdtemp(join(tmpdir(), "codemap-indexer-"));
  temps.push(p);
  return p;
}
async function fixture(language: string) {
  const p = await temp();
  await cp(join(fixtureRoot, language), p, { recursive: true });
  return p;
}
function fn(s: CodeSnapshot, path: string, name: string) {
  const n = s.nodes.find(
    (n) =>
      n.kind === "function" && n.filePath === path && n.qualifiedName === name,
  );
  expect(n, `${path}:${name}`).toBeDefined();
  return n!;
}
function call(
  s: CodeSnapshot,
  fromPath: string,
  from: string,
  toPath: string,
  to: string,
) {
  const a = fn(s, fromPath, from),
    b = fn(s, toPath, to);
  expect(
    s.relations.some(
      (r) =>
        r.type === "calls" &&
        r.sourceId === a.id &&
        r.targetId === b.id &&
        r.resolution === "resolved",
    ),
  ).toBe(true);
}
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});

describe("SourceIndexer", () => {
  it("changes input and snapshot identity for configuration-only and whitespace edits while retaining symbol IDs and history", async () => {
    const root = await temp();
    await writeFile(join(root, "a.ts"), "export function a() {}");
    await writeFile(
      join(root, "tsconfig.json"),
      '{"compilerOptions":{"baseUrl":"."}}',
    );
    const indexer = new SourceIndexer();
    const before = await indexer.index(root, "configuration");
    const historical = structuredClone(before);
    await writeFile(
      join(root, "tsconfig.json"),
      '{"compilerOptions":{"baseUrl":"./src"}}',
    );
    const changed = await indexer.index(root, "configuration");
    await writeFile(
      join(root, "tsconfig.json"),
      ' {"compilerOptions":{"baseUrl":"./src"}}\n',
    );
    const whitespace = await indexer.index(root, "configuration");
    expect(changed.contentHash).not.toBe(before.contentHash);
    expect(changed.id).not.toBe(before.id);
    expect(whitespace.contentHash).not.toBe(changed.contentHash);
    expect(whitespace.id).not.toBe(changed.id);
    expect(fn(changed, "a.ts", "a").id).toBe(fn(before, "a.ts", "a").id);
    expect(fn(whitespace, "a.ts", "a").id).toBe(fn(before, "a.ts", "a").id);
    expect(before).toEqual(historical);
    expect(changed.coverage.files).toEqual(["a.ts"]);
    expect(changed.coverage.configurationFiles).toEqual(["tsconfig.json"]);
    expect(
      changed.nodes.filter((n) => n.kind === "file").map((n) => n.filePath),
    ).toEqual(["a.ts"]);
    snapshotSchema.parse(changed);
  });

  it("hashes invalid configuration bytes and captured inherited inputs without indexing JSON nodes", async () => {
    const root = await temp();
    await mkdir(join(root, "sub"));
    await writeFile(join(root, "a.ts"), "export function a() {}");
    await writeFile(
      join(root, "sub", "tsconfig.json"),
      '{ // JSONC\n "extends": "../shared.json", }',
    );
    await writeFile(join(root, "shared.json"), "{invalid");
    const indexer = new SourceIndexer();
    const before = await indexer.index(root, "configuration");
    await writeFile(join(root, "shared.json"), "{invalid changed");
    const after = await indexer.index(root, "configuration");
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(after.id).not.toBe(before.id);
    expect(after.coverage.configurationFiles).toEqual([
      "shared.json",
      "sub/tsconfig.json",
    ]);
    expect(after.coverage.files).toEqual(["a.ts"]);
    expect(after.nodes.some((n) => n.filePath?.endsWith(".json"))).toBe(false);
    expect(
      after.diagnostics.some(
        (d) =>
          d.filePath === "shared.json" && /invalid.*JSONC/i.test(d.message),
      ),
    ).toBe(true);
  });

  it("keeps source-only indexing deterministic without configuration inputs", async () => {
    const root = await temp();
    await writeFile(join(root, "a.ts"), "export function a() {}");
    const indexer = new SourceIndexer();
    const first = await indexer.index(root, "source-only");
    const second = await indexer.index(root, "source-only");
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.id).toBe(first.id);
    expect(second.coverage.configurationFiles).toEqual([]);
  });

  it("resolves TS aliases, reexports, named arrows and class methods by declaration identity", async () => {
    const s = await new SourceIndexer().index(
      await fixture("typescript"),
      "ts",
    );
    snapshotSchema.parse(s);
    call(s, "main.ts", "fetchNotes", "lib.ts", "requestWithRetry");
    call(s, "main.ts", "fetchNotes", "lib.ts", "arrow");
    call(s, "main.ts", "fetchNotes", "lib.ts", "Client.run");
    call(s, "lib.ts", "Client.run", "lib.ts", "Client.send");
    for (const name of ["dynamic", "shadow"])
      expect(
        s.relations.filter(
          (r) => r.type === "calls" && r.sourceId === fn(s, "main.ts", name).id,
        ),
      ).toEqual([
        expect.objectContaining({
          resolution: "unresolved",
          targetId: null,
          reason: expect.any(String),
        }),
      ]);
    expect(
      s.nodes.some(
        (n) => n.kind === "external" && n.name.includes("node:fs/promises"),
      ),
    ).toBe(true);
    expect(
      s.relations.some(
        (r) => r.type === "imports" && r.resolution === "external",
      ),
    ).toBe(true);
    expect(
      s.relations.some(
        (r) => r.type === "calls" && r.resolution === "external",
      ),
    ).toBe(true);
  });
  it("indexes JS, JSX and TSX calls and records source evidence/containment", async () => {
    const s = await new SourceIndexer().index(
      await fixture("typescript"),
      "ts",
    );
    call(s, "plain.js", "usePlain", "plain.js", "plain");
    call(s, "view.jsx", "JsView", "plain.js", "plain");
    call(s, "view.tsx", "View", "lib.ts", "arrow");
    expect(fn(s, "view.jsx", "JsView").language).toBe("javascript");
    const n = fn(s, "lib.ts", "Client.send");
    expect(s.nodes.some((p) => p.id === n.parentId)).toBe(true);
    expect(
      s.relations.some((r) => r.type === "contains" && r.targetId === n.id),
    ).toBe(true);
    expect(
      s.relations
        .filter((r) => r.type === "calls")
        .every((r) => r.evidence.line > 0 && r.evidence.text),
    ).toBe(true);
  });
  it("uses stable qualified IDs after blank lines while raw source changes alter the fingerprint", async () => {
    const p = await fixture("typescript"),
      indexer = new SourceIndexer();
    const a = await indexer.index(p, "stable"),
      b = await indexer.index(p, "stable");
    expect(a.id).toBe(b.id);
    expect(a.contentHash).toBe(b.contentHash);
    await writeFile(
      join(p, "lib.ts"),
      "\n\n" + (await readFile(join(p, "lib.ts"), "utf8")),
    );
    const c = await indexer.index(p, "stable");
    expect(fn(a, "lib.ts", "Client.send").id).toBe(
      fn(c, "lib.ts", "Client.send").id,
    );
    expect(c.contentHash).not.toBe(a.contentHash);
    expect(c.id).not.toBe(a.id);
  });
  it("honors nested gitignore and explicit exclusions and rejects outside symlinks", async () => {
    const p = await temp(),
      outside = await temp();
    await writeFile(join(p, "keep.ts"), "export function keep() {}");
    await writeFile(join(p, ".gitignore"), "ignored.ts\n");
    await writeFile(join(p, "ignored.ts"), "function hidden() {}");
    await mkdir(join(p, "sub"));
    await writeFile(join(p, "sub", ".gitignore"), "hidden.py\n");
    await writeFile(join(p, "sub", "hidden.py"), "def hidden(): pass");
    await mkdir(join(p, "node_modules"));
    await writeFile(join(p, "node_modules", "dep.ts"), "function dep() {}");
    await writeFile(join(outside, "outside.ts"), "function outside() {}");
    await symlink(join(outside, "outside.ts"), join(p, "escape.ts"));
    await symlink(outside, join(p, "escape-dir"));
    const s = await new SourceIndexer().index(p, "safe");
    expect(s.coverage.files).toEqual(["keep.ts"]);
    expect(s.coverage.excludedPatterns).toContain("**/node_modules/**");
    expect(s.diagnostics.some((d) => /symlink|outside/i.test(d.message))).toBe(
      true,
    );
  });
  it("indexes Python relative package aliases, nested functions and self calls without executing targets", async () => {
    const p = await fixture("python");
    await writeFile(
      join(p, "side_effect.py"),
      "from pathlib import Path\nPath(__file__).with_name('SENTINEL').write_text('executed')\ndef safe():\n    return 1\n",
    );
    const s = await new SourceIndexer().index(p, "py");
    snapshotSchema.parse(s);
    call(
      s,
      "pkg/main.py",
      "fetch_notes",
      "pkg/helpers.py",
      "request_with_retry",
    );
    expect(
      s.relations.filter(
        (r) =>
          r.type === "calls" &&
          r.sourceId === fn(s, "pkg/main.py", "fetch_notes").id &&
          r.targetId === fn(s, "pkg/helpers.py", "request_with_retry").id,
      ),
    ).toHaveLength(2);
    call(s, "pkg/helpers.py", "Client.run", "pkg/helpers.py", "Client.send");
    call(s, "pkg/main.py", "outer", "pkg/main.py", "outer.inner");
    for (const name of ["dynamic", "shadow"])
      expect(
        s.relations.find(
          (r) =>
            r.type === "calls" && r.sourceId === fn(s, "pkg/main.py", name).id,
        )?.resolution,
      ).toBe("unresolved");
    expect(
      s.relations.some(
        (r) => r.type === "calls" && r.resolution === "external",
      ),
    ).toBe(true);
    await expect(readFile(join(p, "SENTINEL"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
  it("uses Python encoding declarations and hashes raw bytes", async () => {
    const p = await temp();
    await writeFile(
      join(p, "latin.py"),
      Buffer.from(
        "# coding: latin-1\n# caf\xe9\ndef encoded():\n    return 1\n",
        "latin1",
      ),
    );
    const s = await new SourceIndexer().index(p, "encoding");
    expect(fn(s, "latin.py", "encoded").name).toBe("encoded");
    expect(s.diagnostics).toEqual([]);
    expect(
      (await new SourceIndexer().readSource(p, "latin.py")).content,
    ).toContain("café");
  });
  it("reports parse failures and missing Python with an actionable diagnostic, retaining TS", async () => {
    const p = await temp();
    await writeFile(join(p, "bad.py"), "def broken(:");
    await writeFile(join(p, "ok.ts"), "export function ok() {}");
    let s = await new SourceIndexer().index(p, "bad");
    expect(
      s.diagnostics.some(
        (d) => d.filePath === "bad.py" && /syntax/i.test(d.message),
      ),
    ).toBe(true);
    const old = process.env.CODEMAP_PYTHON;
    process.env.CODEMAP_PYTHON = join(p, "missing-python");
    try {
      s = await new SourceIndexer().index(p, "missing");
      expect(fn(s, "ok.ts", "ok")).toBeDefined();
      expect(
        s.diagnostics.some((d) => /CODEMAP_PYTHON|Python 3/i.test(d.message)),
      ).toBe(true);
    } finally {
      if (old === undefined) delete process.env.CODEMAP_PYTHON;
      else process.env.CODEMAP_PYTHON = old;
    }
  });
  it("isolates concurrent projects and languages", async () => {
    const a = await temp(),
      b = await temp();
    await writeFile(
      join(a, "a.ts"),
      "export function target() {} export function caller() { target(); }",
    );
    await writeFile(
      join(b, "b.ts"),
      "export function caller(callback: () => void) { callback(); }",
    );
    await writeFile(join(b, "target.py"), "def callback(): pass");
    const indexer = new SourceIndexer(),
      [x, y] = await Promise.all([
        indexer.index(a, "a"),
        indexer.index(b, "b"),
      ]);
    call(x, "a.ts", "caller", "a.ts", "target");
    expect(y.relations.filter((r) => r.type === "calls")).toEqual([
      expect.objectContaining({ resolution: "unresolved", targetId: null }),
    ]);
    expect(x.nodes.every((n) => !y.nodes.some((m) => m.id === n.id))).toBe(
      true,
    );
  });
  it("detects Git revision read-only and rejects invalid roots", async () => {
    const p = await temp();
    execFileSync("git", ["init", "-q", p]);
    await writeFile(join(p, "a.ts"), "function a() {}");
    execFileSync("git", ["-C", p, "add", "a.ts"]);
    execFileSync("git", [
      "-C",
      p,
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Test",
      "commit",
      "-qm",
      "fixture",
    ]);
    const s = await new SourceIndexer().index(p, "git");
    expect(s.gitRevision).toBe(
      execFileSync("git", ["-C", p, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
    );
    await expect(
      new SourceIndexer().index(resolve(p, "missing"), "bad"),
    ).rejects.toThrow();
  });
  it("reads only contained source paths and rejects traversal and outside symlinks", async () => {
    const p = await temp(),
      outside = await temp();
    await mkdir(join(p, "sub"));
    await writeFile(join(p, "sub", "a.ts"), "export function a() {}\n");
    await writeFile(join(outside, "secret.ts"), "secret");
    await symlink(join(outside, "secret.ts"), join(p, "escape.ts"));
    await symlink(outside, join(p, "escape-dir"));
    const indexer = new SourceIndexer();
    expect(await indexer.readSource(p, "sub\\a.ts")).toEqual({
      filePath: "sub/a.ts",
      content: "export function a() {}\n",
    });
    for (const path of [
      "../secret.ts",
      "/etc/passwd",
      "sub/../../secret.ts",
      "escape.ts",
      "escape-dir/secret.ts",
    ])
      await expect(indexer.readSource(p, path)).rejects.toThrow();
  });
  it("does not treat a callback type signature as its runtime implementation", async () => {
    const p = await temp();
    await writeFile(
      join(p, "a.ts"),
      "export function target() {} export function caller(callback: typeof target) { callback(); }",
    );
    const s = await new SourceIndexer().index(p, "signature");
    expect(
      s.relations.find(
        (r) => r.type === "calls" && r.sourceId === fn(s, "a.ts", "caller").id,
      ),
    ).toMatchObject({ targetId: null, resolution: "unresolved" });
  });
  it("records missing relative Python call targets as unknown rather than external", async () => {
    const p = await temp();
    await mkdir(join(p, "pkg"));
    await writeFile(join(p, "pkg", "__init__.py"), "");
    await writeFile(
      join(p, "pkg", "a.py"),
      "from .missing import target\ndef caller():\n    target()\n",
    );
    const s = await new SourceIndexer().index(p, "missing-relative");
    expect(
      s.relations.find(
        (r) =>
          r.type === "calls" && r.sourceId === fn(s, "pkg/a.py", "caller").id,
      ),
    ).toMatchObject({ targetId: null, resolution: "unresolved" });
  });
  it("retains anonymous callback identities and scopes duplicated names independently", async () => {
    const p = await temp();
    await writeFile(
      join(p, "a.ts"),
      "export function a() { function same() {} same(); [1].map(() => same()); } export function b() { function same() {} same(); }",
    );
    const s = await new SourceIndexer().index(p, "nested");
    call(s, "a.ts", "a", "a.ts", "a.same");
    call(s, "a.ts", "b", "a.ts", "b.same");
    expect(
      s.nodes.some(
        (n) =>
          n.kind === "function" && n.qualifiedName?.startsWith("a.<callback:"),
      ),
    ).toBe(true);
  });
  it("applies nested ignore negation without reopening an ignored directory", async () => {
    const p = await temp();
    await mkdir(join(p, "sub"));
    await mkdir(join(p, "closed"));
    await writeFile(join(p, ".gitignore"), "*.ts\nclosed/\n");
    await writeFile(join(p, "sub", ".gitignore"), "!keep.ts\n");
    await writeFile(join(p, "sub", "keep.ts"), "export function keep() {}");
    await writeFile(join(p, "sub", "hidden.ts"), "export function hidden() {}");
    await writeFile(join(p, "closed", ".gitignore"), "!keep.ts\n");
    await writeFile(join(p, "closed", "keep.ts"), "export function leak() {}");
    expect(
      (await new SourceIndexer().index(p, "negation")).coverage.files,
    ).toEqual(["sub/keep.ts"]);
  });
  it("keeps getter and setter declarations distinct and stable after whitespace", async () => {
    const p = await temp(),
      content =
        "export class C { get value() { return 1; } set value(v: number) {} }";
    await writeFile(join(p, "a.ts"), content);
    const a = await new SourceIndexer().index(p, "accessors");
    const accessors = a.nodes.filter(
      (n) =>
        n.kind === "function" &&
        n.filePath === "a.ts" &&
        n.qualifiedName !== "C",
    );
    expect(accessors).toHaveLength(2);
    expect(new Set(accessors.map((n) => n.id)).size).toBe(2);
    await writeFile(join(p, "a.ts"), "\n" + content);
    const b = await new SourceIndexer().index(p, "accessors");
    expect(b.nodes.map((n) => n.id)).toEqual(a.nodes.map((n) => n.id));
  });
  it("does not bind a staticmethod parameter named self to a class method", async () => {
    const p = await temp();
    await writeFile(
      join(p, "a.py"),
      "class C:\n    def target(self): pass\n    @staticmethod\n    def caller(self):\n        self.target()\n",
    );
    const s = await new SourceIndexer().index(p, "static");
    expect(
      s.relations.find(
        (r) =>
          r.type === "calls" && r.sourceId === fn(s, "a.py", "C.caller").id,
      ),
    ).toMatchObject({ resolution: "unresolved", targetId: null });
  });
  it("reports TS syntax errors while retaining coverage and unknown call evidence", async () => {
    const p = await temp();
    await writeFile(join(p, "bad.ts"), "export function bad( { mystery();");
    const s = await new SourceIndexer().index(p, "syntax");
    expect(s.coverage.files).toEqual(["bad.ts"]);
    expect(s.diagnostics.some((d) => d.filePath === "bad.ts" && d.line)).toBe(
      true,
    );
    expect(s.coverage.unresolvedCount).toBe(
      s.relations.filter((r) => r.resolution === "unresolved").length,
    );
  });
  it("resolves default and namespace imports without cross-scope name guessing", async () => {
    const p = await temp();
    await writeFile(
      join(p, "lib.ts"),
      "export default function named() {} export function target() {}",
    );
    await writeFile(
      join(p, "main.ts"),
      "import renamed from './lib.js'; import * as ns from './lib.js'; export function caller() { renamed(); ns.target(); }",
    );
    const s = await new SourceIndexer().index(p, "default");
    call(s, "main.ts", "caller", "lib.ts", "named");
    call(s, "main.ts", "caller", "lib.ts", "target");
  });
  it("returns deterministic facts for repeated and relocated equal-content projects", async () => {
    const p = await fixture("python"),
      q = await temp();
    await cp(p, q, { recursive: true });
    const [a, b] = await Promise.all([
      new SourceIndexer().index(p, "same"),
      new SourceIndexer().index(q, "same"),
    ]);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.id).toBe(b.id);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.relations).toEqual(b.relations);
  });
  it("returns domain errors for missing sources and invalid roots", async () => {
    const p = await temp(),
      indexer = new SourceIndexer();
    await expect(indexer.readSource(p, "missing.ts")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      indexer.index(join(p, "missing"), "bad"),
    ).rejects.toMatchObject({ code: "INVALID_PATH" });
  });
  it("does not attribute a returned callable to its getter or a computed dynamic property", async () => {
    const p = await temp();
    await writeFile(
      join(p, "a.ts"),
      "export function target() {} class C { get fn() { return target; } } export function caller(c: C, key: string) { c.fn(); c[key](); }",
    );
    const s = await new SourceIndexer().index(p, "returned");
    expect(
      s.relations.filter(
        (r) => r.type === "calls" && r.sourceId === fn(s, "a.ts", "caller").id,
      ),
    ).toEqual([
      expect.objectContaining({ resolution: "unresolved", targetId: null }),
      expect.objectContaining({ resolution: "unresolved", targetId: null }),
    ]);
  });
  it.each([
    [
      "exception binding",
      "def caller():\n    try:\n        raise Exception()\n    except Exception as target:\n        target()\n",
    ],
    [
      "match capture",
      "def caller(value):\n    match value:\n        case target:\n            target()\n",
    ],
    [
      "match starred capture",
      "def caller(value):\n    match value:\n        case [*target]:\n            target()\n",
    ],
    [
      "match mapping rest",
      "def caller(value):\n    match value:\n        case {**target}:\n            target()\n",
    ],
    ["lambda vararg", "def caller():\n    return lambda *target: target()\n"],
    ["lambda kwarg", "def caller():\n    return lambda **target: target()\n"],
    [
      "late local declaration",
      "def caller():\n    target()\n    def target():\n        pass\n",
    ],
    [
      "local rebinding",
      "def caller(value):\n    target = value\n    target()\n    def target():\n        pass\n",
    ],
  ])("keeps Python %s calls unknown", async (_case, body) => {
    const p = await temp();
    await writeFile(join(p, "a.py"), "def target():\n    pass\n\n" + body);
    const s = await new SourceIndexer().index(p, "binding-regression");
    expect(s.diagnostics).toEqual([]);
    expect(
      s.relations.find(
        (r) => r.type === "calls" && r.evidence.text === "target()",
      ),
    ).toMatchObject({ resolution: "unresolved", targetId: null });
  });
  it("preserves definite Python direct calls and deferred global declarations", async () => {
    const p = await temp();
    await writeFile(
      join(p, "a.py"),
      "def caller():\n    target()\n\ndef local_caller():\n    def local_target():\n        pass\n    local_target()\n\ndef target():\n    pass\n",
    );
    const s = await new SourceIndexer().index(p, "binding-control");
    call(s, "a.py", "caller", "a.py", "target");
    call(s, "a.py", "local_caller", "a.py", "local_caller.local_target");
  });
  it("preserves anonymous callback IDs across callee trivia while retaining literal contents", async () => {
    const p = await temp();
    const content =
      "export function target() {} export function caller(items: any) { items\n.map(() => target()); items['a b'].map(() => target()); items['ab'].map(() => target()); }";
    await writeFile(join(p, "a.ts"), content);
    const a = await new SourceIndexer().index(p, "callback-trivia");
    const callbacks = (s: CodeSnapshot) =>
      s.nodes.filter(
        (n) =>
          n.kind === "function" &&
          n.qualifiedName?.startsWith("caller.<callback:"),
      );
    expect(callbacks(a)).toHaveLength(3);
    await writeFile(
      join(p, "a.ts"),
      content.replace("items\n.map", "items\n\n/* comment */ .map"),
    );
    const b = await new SourceIndexer().index(p, "callback-trivia");
    expect(callbacks(b).map((n) => [n.qualifiedName, n.id])).toEqual(
      callbacks(a).map((n) => [n.qualifiedName, n.id]),
    );
    expect(
      a.relations
        .filter(
          (r) =>
            r.type === "calls" && r.targetId === fn(a, "a.ts", "target").id,
        )
        .map((r) => r.sourceId),
    ).toEqual(
      b.relations
        .filter(
          (r) =>
            r.type === "calls" && r.targetId === fn(b, "a.ts", "target").id,
        )
        .map((r) => r.sourceId),
    );
    const literalCallbacks = callbacks(a).slice(1);
    expect(literalCallbacks[0]!.qualifiedName).toContain("a b");
    expect(literalCallbacks[1]!.qualifiedName).toContain("'ab'");
    expect(literalCallbacks[0]!.qualifiedName).not.toBe(
      literalCallbacks[1]!.qualifiedName,
    );
  });
});

it("changes snapshot identity when Python capability changes for identical source bytes", async () => {
  const p = await temp();
  await writeFile(join(p, "main.py"), "def hello():\n    pass\n");
  const old = process.env.CODEMAP_PYTHON;
  let unavailable: CodeSnapshot;
  try {
    process.env.CODEMAP_PYTHON = join(p, "missing-python");
    unavailable = await new SourceIndexer().index(p, "capability");
  } finally {
    if (old === undefined) delete process.env.CODEMAP_PYTHON;
    else process.env.CODEMAP_PYTHON = old;
  }
  const original = structuredClone(unavailable);
  const available = await new SourceIndexer().index(p, "capability");
  expect(unavailable.diagnostics.length).toBeGreaterThan(0);
  expect(available.nodes.some((n) => n.name === "hello")).toBe(true);
  expect(available.contentHash).toBe(unavailable.contentHash);
  expect(available.id).not.toBe(unavailable.id);
  expect(unavailable).toEqual(original);
  expect((await new SourceIndexer().index(p, "capability")).id).toBe(
    available.id,
  );
});

describe("mutable callable evidence", () => {
  it.each(["ts", "js"])(
    "keeps reassigned %s initializers unresolved while retaining immutable and direct calls",
    async (extension) => {
      const root = await temp();
      await writeFile(
        join(root, `main.${extension}`),
        'export let handler = () => "original";\nhandler = () => "replacement";\nexport var variable = () => "first";\nvariable = () => "second";\nexport const object = { handler: () => "first" };\nobject.handler = () => "second";\nexport const stable = () => "stable";\nexport function direct() { return 1; }\nexport function caller() { handler(); variable(); object.handler(); stable(); direct(); }\n',
      );
      const snapshot = await new SourceIndexer().index(root, "mutable");
      const calls = snapshot.relations.filter(
        (r) =>
          r.type === "calls" &&
          r.sourceId === fn(snapshot, `main.${extension}`, "caller").id,
      );
      expect(calls.find((r) => r.evidence.text === "handler()")).toMatchObject({
        resolution: "unresolved",
        targetId: null,
      });
      for (const text of ["variable()", "object.handler()"])
        expect(calls.find((r) => r.evidence.text === text)).toMatchObject({
          resolution: "unresolved",
          targetId: null,
        });
      call(
        snapshot,
        `main.${extension}`,
        "caller",
        `main.${extension}`,
        "stable",
      );
      call(
        snapshot,
        `main.${extension}`,
        "caller",
        `main.${extension}`,
        "direct",
      );
    },
  );
});
