# T02 implementation report

Status: implementation complete; ready for the controller's independent review. No pushes, dependency installation, dependency version changes, or lockfile edits. Implementation commit is recorded below after commit creation.

## Public API and scope

- `@codemap/indexer` exports only `SourceIndexer`. No-argument construction; `index(rootPath, projectId): Promise<CodeSnapshot>` implements the core port.
- `SourceIndexer.readSource(rootPath, filePath): Promise<{filePath,content}>` implements the controller-authorized optional core port extension. Normalizes repository paths, rejects traversal/absolute paths, verifies realpath containment, and reads an opened regular file. Root-contained symlinks may be read; outside file and directory symlinks are rejected. Missing source is `DomainError('NOT_FOUND')`; invalid roots/paths are `INVALID_PATH`.
- Scanner/graph/TS/Python/text helpers are internal modules, not package exports. No consumer should depend on them; the service can use the core index/readSource port.
- Authorized manifest exception: added `files: ["dist", "python"]` to the indexer package. This repairs npm packaging of the public compiled entry point and sibling Python helper; dependencies and frozen versions remain unchanged.

## Implemented behavior

- Scans TS/TSX/JS/JSX (also conventional `.mts/.cts/.mjs/.cjs`) and `.py`. Uses fast-glob, root and nested Git ignore rules, deeper negations, and explicit exclusions for Git/dependencies/build/cache/vendor/skills directories. Parent-ignored directories cannot be reopened by a nested ignore file.
- Scanner never follows source or directory symlinks; reports them. Captures source bytes once; hashes and both parsers consume those captured bytes. Sorted repository paths and unambiguous length framing feed SHA-256. Ignored source does not enter facts or fingerprint.
- Function IDs derive from project, relative path, qualified lexical name, and declaration category. Blank lines do not alter function IDs. Anonymous TS callbacks have enclosing/call/argument structure identities with deterministic duplicate ordinals. Getter/setter categories remain separate. Root folders omit an invalid `.` filePath.
- Snapshot ID derives from project plus content fingerprint, so unchanged refresh preserves route baseline IDs. Git HEAD is read using `git rev-parse`; non-Git targets get null. Created-at is observation time.
- TS runs an in-memory ts-morph/TypeScript project over captured sources. Symbols/declarations resolve relative imports, aliases, reexports, namespace/default imports, named arrows/function expressions and class methods. It does not infer targets by matching names across scopes or from callback type signatures. Syntax diagnostics, contains/import/call evidence, external module references and unknown calls are emitted.
- Classes use the fixed core `function` node category as declaration containers/constructor targets; their signatures identify class declarations and methods are contained children. This does not introduce a new core node kind.
- Python 3.10+ detection honors an explicit CODEMAP_PYTHON path, otherwise python3/python (Windows also py -3). An explicitly invalid configuration produces actionable diagnostics while TS remains available.
- Python helper uses `-I`, JSON stdin and base64 source bytes; only standard-library AST/tokenization is applied. Encoding cookies are respected by `ast.parse(bytes)`. It never imports or executes a target module. Implements lexical function/class/nested-function identities, package/relative imports and aliases/reexports, direct/self/cls calls, external imports, and unknown dynamic/shadowed calls. Missing relative targets are unknown, not external.
- Source display decodes UTF-8/UTF-16 BOMs and Python coding cookies, including exact Latin-1. Unsupported display encodings fail honestly rather than silently replacing bytes. Python AST parsing can support additional codecs beyond Node's TextDecoder.
- Each invocation owns its compiler, declaration maps, graph, Python process and source capture; concurrent projects cannot share symbol mappings or fabricate cross-language calls.

## TDD and focused evidence

Initial run: missing `./index.js` module confirmed the implementation was absent. After an empty implementation stub, all 9 initial behavior tests failed (real fixtures, missing functions/coverage/hash/revision/diagnostics); this was not a claimed passing or executed-zero-test result.

Actual initial RED command, run from `/workspace/AtlasMode`:

```text
npx vitest run packages/indexer/src/index.test.ts
```

Existing tool output at 20:22:53 UTC (chunk `674a9c`, exit 1), before the entry module existed:

```text
FAIL packages/indexer/src/index.test.ts [ packages/indexer/src/index.test.ts ]
Error: Cannot find module './index.js' imported from /workspace/AtlasMode/packages/indexer/src/index.test.ts
Test Files  1 failed (1)
     Tests  no tests
```

The same command was then run against the empty snapshot stub. Existing tool output at 20:23:14 UTC (chunk `199f82`, exit 1) proves actual behavior assertions executed and failed:

```text
❯ packages/indexer/src/index.test.ts (9 tests | 9 failed) 62ms
FAIL SourceIndexer > indexes JS, JSX and TSX calls and records source evidence/containment
AssertionError: plain.js:usePlain: expected undefined to be defined
FAIL SourceIndexer > honors nested gitignore and explicit exclusions and rejects outside symlinks
AssertionError: expected [] to deeply equal [ 'keep.ts' ]
FAIL SourceIndexer > detects Git revision read-only and rejects invalid roots
AssertionError: expected null to be 'b7cc204091f58eeec2eb32869859f2bd6771f9cb'
Test Files  1 failed (1)
     Tests  9 failed (9)
```

Final GREEN command: `npm test` from `/workspace/AtlasMode`. Existing tool output at 20:39:59 UTC (chunk `e2e63c`, exit 0):

```text
> atlasmode@0.1.0 test
> vitest run
RUN v4.1.11 /workspace/AtlasMode
Test Files  2 passed (2)
     Tests  72 passed (72)
Start at  20:39:59
Duration  1.73s
```

These excerpts are quoted from existing tool results. No old version or suite was rerun to produce this evidence supplement.

RED → GREEN corrections subsequently observed:

1. Callback `typeof target` incorrectly linked to target; removed type-signature identity as proof of a runtime implementation.
2. Missing relative Python module incorrectly created an external call; retained relative provenance and unknown target.
3. Optional source-reading method absent; implemented normalized containment and outside-symlink/traversal checks.
4. Nested ignore negation failed; implemented hierarchical ignore precedence while respecting closed directories.
5. Getter/setter nodes collided; distinguished accessor names and declaration identity categories.
6. Staticmethod parameter called `self` incorrectly resolved as a class instance; left that parameter unknown.
7. Missing source exposed raw ENOENT; mapped source/root errors to core domain errors.
8. Latin-1 source display replaced é; decoded the declared source encoding while keeping AST/hash input raw.
9. Packaging RED: after a successful build, `npm pack --dry-run --json` shipped source plus Python but no `dist/`, because root `.gitignore` excludes build output. The approved files list restored the compiled public entry.

Final 21 indexer tests cover TS/JS/JSX/TSX aliases/reexports/default/namespace imports, named arrows/classes/anonymous callbacks, independent nested names, evidence/containment, stable IDs and snapshots, deterministic relocated facts, ignore rules, symlinks/traversals, Python relative imports/reexports/self/nested functions, shadowing/dynamic callbacks, syntax/encoding diagnostics, missing Python, nonexecution sentinel, Git revision, safe source reads, and concurrent project/language isolation. Several added defensive/characterization checks already passed when first run; they are not claimed as new failing-feature RED evidence.

Final verification (2026-10-02 20:39 UTC):

- `npm test`: 2 files, **72 tests passed** (51 core + 21 indexer), 0 failures/skips.
- `npm run build -w @codemap/core` and `npm run build -w @codemap/indexer`: both exit 0.
- `npm run typecheck -w @codemap/core` and `npm run typecheck -w @codemap/indexer`: both exit 0.
- `npm run lint`: repository lint exit 0, including actual committed fixtures.
- Toolchain observed: Node v24.19.0, Python 3.12.14. Frozen ts-morph 27.0.2 / TypeScript 5.9.3 / fast-glob 3.3.3 / ignore 7.0.12 were reused.

Packaging GREEN: actual npm tarball extracted to `/tmp/atlasmode-indexer-pack-MqCAvK`; 20 entries include `dist/index.js`, declarations, internal compiled helpers, and `python/index.py`. Imported the packed dist entry in a separate Node process with cwd `/tmp`, indexed a fresh Python target, obtained 2 functions and 1 resolved call, zero diagnostics, and proved the target's SENTINEL file absent. Dependencies were linked to the existing verified workspace tree (ignore specifically to the indexer-local frozen version), not reinstalled. This proves built helper location independently of repo cwd and source files; it does not claim a clean-room dependency installation.

## Limits and unrun validation

- No target tsconfig/package configuration is read, no complete dependency type environment is loaded, and no complete TS semantic typecheck is claimed. Standard captured relative modules are the confirmed resolution range. TS path aliases, CommonJS require module bindings, dynamic imports/reflection, higher-order values and runtime dispatch are not fully resolved. Calls without indexed declaration proof retain unknown edges; bare nonrelative imports are represented as external module references, without proving an installed dependency.
- Python uses static lexical bindings and captured repository module paths (including conventional src layouts). It does not simulate runtime sys.path, decorators, monkey patches, assignments/instance flow, inheritance dispatch or target execution. Rebindings generally cause conservative unknowns. Lambda bodies are scoped but not standalone named-function nodes. Exported on Python means a public-name candidate, not proof of `__all__` exports.
- Qualified duplicate ordinals/anonymous structural IDs can change when same-named declarations or structurally identical callbacks are inserted; blank-line edits remain stable. Relation IDs may change with source evidence/order; function IDs and same-content snapshot IDs are the promised stable identities.
- The byte capture is coherent with its hash and parser inputs; it is not an atomic transaction over an actively changing checkout. Scanner symlink exclusion is intentionally stricter than source reading. Ordinary realpath/no-follow containment checks are used; hostile concurrent filesystem mutation is not claimed to be a sandbox.
- Python detection has 5-second candidate probes; the AST subprocess has a 60-second deadline and returns diagnostics on failure. Forced timeout/crash paths and native Windows/macOS executable discovery were not exercised. Large subprocess output is held in memory; large-project benchmarks belong to later validation.
- Project-wide root build/typecheck, server/UI/MCP/startup/E2E and Vite/Flask scale checks were not run in this task: later workspace implementation is still pending. Only the implemented core/indexer build/typecheck and complete currently available test/lint suites are reported passing.
- No new cloud installation/configuration fields were needed; this task reused the prepared environment.

Implementation commit: `56ccccf7eaaf22472fa36101533b7d5c81a8e622` (`feat(indexer): index captured TS and Python sources with stable facts`). Working tree clean after commit; report remains in the controller's ignored SDD ledger.

## Fix round 1/5 — review Important findings

FIX_BASE: `56ccccf7eaaf22472fa36101533b7d5c81a8e622`. Read the complete task-2-review.md. Scope is only Python binding correctness and TS anonymous-callback trivia-independent identity; changed three files: python/index.py, src/typescript.ts and src/index.test.ts. No subagents, dependency changes, manifest/core changes, other-task edits, pushes or full-repository test reruns.

Python fix: all supported bindings use one scope-local bind operation. Repeated binding events remain unknown rather than allowing the final def/import to retroactively resolve earlier values. ExceptHandler.name, MatchAs.name, MatchStar.name and MatchMapping.rest are collected explicitly; lambda positional/keyword/vararg/kwarg parameters are unknown local bindings. Each unique declaration/import records its completion position, and direct calls in the same executing scope cannot resolve a name before initialization. Declarations/imports within conditional statements remain unknown because this pass does not prove branch execution. Nested lexical lookup uses a conservative enclosing-definition cutoff. Function/lambda bodies still resolve unique module globals declared later, so valid deferred calls are preserved; class self/cls calls still use completed class declarations.

TS fix: anonymous callbacks use callee AST leaf-token kinds/text plus argument position. AST traversal drops whitespace/comments, preserves literal/template/regex token contents, and avoids source positions. Inserting trivia inside a member-access callee keeps both callback qualifiedName/ID and its calls' sourceId stable. String literals containing spaces remain distinct from strings without spaces.

Coverage added (10 test cases):

- `keeps Python %s calls unknown`: exception binding, match capture, starred match capture, mapping-rest match capture, lambda vararg, lambda kwarg, late local declaration, and local rebinding.
- `preserves definite Python direct calls and deferred global declarations`: normal local call after a local def and a function-body call to a later module-level global both resolve.
- `preserves anonymous callback IDs across callee trivia while retaining literal contents`: internal callee blank line + comment edits preserve IDs and call source IDs; `'a b'` remains present and distinct from `'ab'`.

Actual RED command, cwd `/workspace/AtlasMode`: `npx vitest run packages/indexer/src/index.test.ts`. Existing output at 20:51:45 UTC, chunk `edfa67`, exit 1:

```text
❯ packages/indexer/src/index.test.ts (31 tests | 9 failed) 1149ms
× keeps Python exception binding calls unknown
× keeps Python match capture calls unknown
× keeps Python match starred capture calls unknown
× keeps Python match mapping rest calls unknown
× keeps Python lambda vararg calls unknown
× keeps Python lambda kwarg calls unknown
× keeps Python late local declaration calls unknown
× keeps Python local rebinding calls unknown
× preserves anonymous callback IDs across callee trivia while retaining literal contents
Expected: resolution 'unresolved', targetId null
Received: resolution 'resolved', targetId 'function:42f561daa7745725a15ce3768e73b02d'
Callback expected: caller.<callback:items\n.map:0>
Callback received: caller.<callback:items\n\n/* comment */ .map:0>
Test Files 1 failed (1)
Tests 9 failed | 22 passed (31)
```

The direct-call control passed in RED, demonstrating the desired behavior to preserve. First GREEN at 20:53:14 UTC (chunk `b5605a`, exit 0): 31/31 tests passed. After formatting and strengthening literal-content assertions, final affected verification at 20:54:04 UTC (chunk `5edf65`):

```text
npx vitest run packages/indexer/src/index.test.ts
Test Files 1 passed (1)
Tests 31 passed (31)
Start at 20:54:04
Duration 1.59s
npm run build -w @codemap/indexer
> tsc -p tsconfig.json
npm run typecheck -w @codemap/indexer
> tsc -p tsconfig.json --noEmit
npx eslint packages/indexer/src/index.test.ts packages/indexer/src/typescript.ts
git diff --check
```

All commands above exited 0; lint and diff check were silent. No complete repository suite was rerun, as the controller explicitly requested focused checks for this fix round. Previous 72/72 full-suite evidence belongs to the original implementation, not this fix commit.

Self-check: read the affected production diff; verified rebinding cannot restore a known target, all listed string-name AST binding forms are handled, vararg/kwarg params cannot fall through to globals, current-scope initialization cutoffs do not apply to deferred module-global lookup, and callbacks no longer include callee source trivia. All original 21 indexer cases still pass, including relative import/reexport/self calls, dynamic unknowns, concurrent projects, nonexecution sentinel and stable named IDs.

Limits: this remains conservative static analysis, not runtime control-flow simulation. Rebinding or conditional declarations may turn valid runtime calls into unknowns; closures initialized after their nested function's declaration may also remain unknown without invocation-flow evidence. Unique deferred globals follow normal completed-module semantics and do not model a function deliberately invoked before module initialization completes. Existing runtime dispatch/decorator/global side-effect/platform/scale limitations remain. Anonymous callback IDs intentionally change once from the original raw-text identity format to the fixed token format; subsequent trivia-only edits are stable.

Fix commit: `2c016ecb4ff0d70a5c461b242c331d12e915c7a9` (`fix(indexer): preserve Python binding uncertainty and callback identities`). Working tree clean after commit; only the three scoped files were committed.
