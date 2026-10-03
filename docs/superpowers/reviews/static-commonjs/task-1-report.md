# Task1 implementation report

Status: DONE. Base `04b440b341107888d9bb49a4d9ae810fcb3377bd`.

## Implemented

- Added pure captured-AST CommonJS registry and exact internal module-mode/provider interfaces. Default positive scope is `.cjs`; `.mjs`/ESM syntax and other paths without supplied mode evidence stay guarded. Task2 can supply the optional fifth `indexTypeScript` argument.
- Collected lexical identities, actual callable declarations, export writes, importer bindings and shared consumer mutation/escape facts before emitting positive exports/calls. Actual checker SourceFile symbols are consulted for require literals only after lexical/mode validation.
- Supported stable top-level named function/arrow/declaration/const exports, static module.exports object properties/shorthand, callable module.exports, canonical initial exports=module.exports=callable, const consumers/destructuring/literal selections/direct require-property calls.
- Kept callable module values distinct from literal properties named default, including guarded ESM imports. No name matching or recursive alias/forwarding value flow. Unknown calls cannot fall through to checker-only target resolution.
- Preserved implementation names/qualified names/IDs, real paths/lines/text, ordinary ESM and unmodified direct calls, and direct user function named require identity. Entries update only existing exported flags. Public Ports/service/schema/DB remain unchanged.
- Documented positive scope and conservative rejection rules in contracts.

## Files

Created packages/indexer/src/commonjs.ts and commonjs.test.ts. Modified packages/indexer/src/typescript.ts, index.test.ts, docs/superpowers/contracts.md. No other tracked files changed.

## TDD evidence

All logs are in `.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-1/`.

1. Public RED: `npx vitest run packages/indexer/src/index.test.ts -t 'CommonJS public safety'` → 3 failed, 43 skipped. Both overwritten exports and shadowed require falsely resolved actual helper ID; stable .cjs help had exported=false. `red-public.log` records these authentic preimplementation failures. An initial overwrite-to-unknown-identifier case already passed; replacing the overwrite with an actual replacement function reproduced the documented checker false positive without changing production.
2. Initial registry RED: `npx vitest run packages/indexer/src/commonjs.test.ts` → 57 failed, 5 passed. `red-registry.log`. Real in-memory captured compiler/graph pipeline, no mocks or target execution.
3. First implementation attempt: `npx vitest run packages/indexer/src/commonjs.test.ts packages/indexer/src/index.test.ts -t 'CommonJS'` → 62 passed, 3 failed, 43 skipped. Root causes: synthetic compiler exports property symbol hid lexical const; destructuring shorthand required its value symbol; tsconfig fixture omitted allowJs and therefore did not own its .cjs source under existing config rules. Fixed actual guards and authored fixture membership, without broadening resolver behavior. Same command then → 65 passed, 43 skipped (`green-initial.log`).
4. Extra guard RED: 7 failed, 67 passed in `red-extra-guards.log`: destructuring writes, type-only namespace import, duplicate/redeclared callable identity and static object literal computed key. Investigation showed invalid JS function/var redeclarations have separate checker symbols but one lexical runtime identity. After scoped fixes, 74 passed (`green-extra-guards.log`).
5. Default identity RED: focused default tests → 3 failed, 3 passed, 71 skipped (`red-default-identity.log`). Separate internal symbol key for callable module.exports and ESM namespace/default handling fixed all 77 registry tests (`green-default-identity.log`).
6. First affected final gate → 247 passed/6 files. Build/typecheck/lint also passed. Final source review found local CJS shadowed-root/rewritten-callable checker bypasses; added four tests and observed all four fail (`red-local-guards.log`). Narrow guards apply to actual CJS root shadowing/visible symbol rewrites; existing ordinary direct and ESM controls remain intact.
7. Final affected GREEN on final source bytes: `npx vitest run packages/indexer/src packages/core/src` → **251 passed/6 files**, including 81 dedicated registry tests and three public CommonJS regressions. `final-tests.log` is the final run, superseding the earlier 247-test gate.

## Final verification

- `npx vitest run packages/indexer/src packages/core/src`: 251/251 passed, 6 files, no warnings/errors. Existing ESM/TS-config/Python/const identity and core schema/graph regressions included.
- `npm run build --workspace=@codemap/core --workspace=@codemap/indexer`: exit0 (`final-build.log`).
- `npm run typecheck --workspace=@codemap/core --workspace=@codemap/indexer`: exit0 (`final-typecheck.log`).
- `npm run lint`: exit0 (`final-lint.log`).
- `git diff --check`: clean. Vendor checksums verified (`vendor-check.log`).
- No root full suite/browser/mature-target run: those belong Task3. No fixture/target JS execution, dependency install, lock/vendor change, global config modification, database mutation, publication or push.

## Self-review and limitations

Reviewed source/integration diff and requirements; additional concrete false positives found during review received genuine RED and fixes, followed by affected checks on final bytes. Registry is one phased implementation module (roughly 700 formatted lines); controller was informed and accepted keeping one responsibility in the planned file. No split or value-flow expansion occurred.

Conservative limits are intentional: package metadata/.js mode capture is Task2; var/let require-derived calls, forwarding require exports, recursive aliases, dynamic properties/values, type-only/ambient implementations and unverified ESM barrels remain unknown. Namespace escape or whole identity uncertainty poisons the module; known unsupported/repeated/conditional property values isolate rejection to that property. Static positives do not claim runtime load/build compatibility. Independent task review remains controller-owned.

Commit: `23b60de9d5675130cdca27862e44ea19988cab0a` — `fix(indexer): guard captured CommonJS identities and stable exports`. Working tree clean after commit.

## Task1 fix round1 — I1 duplicate local executable declarations

Status: DONE. Fix base `23b60de9d5675130cdca27862e44ea19988cab0a`.

Read the complete task review and exact I1 finding, then verified that export validation counts executable declarations while the local-call fallback guard checked only writes. Added a captured-AST regression using the review's two distinct help bodies: local `help()` must have null target/unresolved (never the first body), imported `mod.help()` remains unresolved, and both original `help`/`help#2` implementation identities remain present. Added a positive control for an ordinary unique CJS direct call and a CJS-candidate TS source with multiple overload signatures but one implementation body.

Minimal production fix: extracted existing executable-value declaration filtering into `valueDeclarations`. Export validation and CJS-candidate local-call validation now share it. More than one executable declaration produces an explicit unresolved classification before checker fallback. Signature-only function declarations do not increase the executable count. No package behavior, value-flow propagation, ESM analysis or public interfaces changed.

Logs: `.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-1/fix-round-1/`.

- RED: `npx vitest run packages/indexer/src/commonjs.test.ts -t 'duplicate local executable|single implementation with overload'` → exit1, **1 failed / 1 passed / 81 skipped**. `red.log` shows local help() incorrectly resolved to `function:563953d26ba37b022c679175a28f413d`; expected unresolved/null. The unique/overload control already passed.
- Focused GREEN: `npx vitest run packages/indexer/src/commonjs.test.ts` → exit0, **83 passed / 1 file** (`green-focused.log`). Imported ambiguous-call negatives, user-defined require identity, unique CJS calls and overload controls pass.
- Affected GREEN: `npx vitest run packages/indexer/src packages/core/src` → exit0, **253 passed / 6 files** (`affected-tests.log`, start04:12:49, duration2.39s). Existing ordinary ESM/direct/config/Python/core controls remain passing.
- `npm run build --workspace=@codemap/core --workspace=@codemap/indexer` → exit0, both tsc builds clean (`build.log`).
- `npm run typecheck --workspace=@codemap/core --workspace=@codemap/indexer` → exit0, both tsc --noEmit checks clean (`typecheck.log`).
- `npm run lint` → exit0, eslint clean (`lint.log`).
- `git diff --check` clean. Self-reviewed the two-file diff: 25 production lines changed/added by the shared-filter extraction and predicate, 43 test lines. No other files changed. These checks reran because the reviewed source changed; no root full suite/browser/mature target tests ran.

Self-review: I1 addressed at the existing CJS identity boundary, with no unconditional filtering of ordinary ESM calls and no overload-signature false rejection. No remaining implementation concern identified; independent scoped re-review is controller-owned. No target execution, dependency/lock/vendor/global-config/DB change, helpers, review agents, push or publication.

Fix commit: `b0b2a2bb70539eac73d633482577ab0a37bc855d` — `fix(indexer): reject duplicate local CommonJS implementations`. Working tree clean after commit.
