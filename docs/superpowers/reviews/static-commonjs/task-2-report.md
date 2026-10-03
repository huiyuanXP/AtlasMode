# Task 2 implementation report

Status: DONE, pending parent independent review. Base d03614c9e82c6cbe70e5972205a1d3daf040b0b8.
Commit: `d217e1dc456163eade1f5043d9c5fcde30953751` — feat(indexer): capture bounded package scopes for JavaScript mode.

## Implementation

- Extracted configuration capture's existing safe filesystem operations into `metadataRead.ts`, preserving component lstat, same-location realpath, NOFOLLOW, opened regular-file/stat checks, inode/dev/location recheck, bounded remaining-budget-plus-one reads, post-read limits and finally-close.
- Shared only successful captured bytes, with separate category acceptance/failure caches and independent 262144/file, 4194304 total and 512-file budgets. Shared bytes count fully in both categories. Configuration chain16, DAG traversal and exact unavailable prefix remain intact.
- Scanner enumerates ordinary allowed package seeds and opaque rejected seeds; ignored/symlink/nonregular/unreadable manifests do not enter source files/nodes/count/availability. Package diagnostics retain nearest opaque scope and redact input bytes.
- Strict package JSON/type mode provider selects nearest root-contained scope, with no ancestor fallback for invalid/opaque scopes, no implicit scope, explicit cjs/mjs format, and unknown JSX/TS require. SourceIndexer supplies the exact fifth Task1 hook.
- `.js` source guard additionally rejects import.meta and top-level await/for-await; computed method names retain enclosing execution context while async function/method bodies remain eligible. Existing import/export checks and every Task1 identity/stability/checker-fallback guard are retained.
- Optional core `coverage.packageFiles` distinguishes omitted legacy metadata from recorded empty arrays. v3 typed/length-framed captured input hashing includes invalid package bytes; rejected evidence changes snapshot facts, not captured-byte hashing. Package-only edits preserve declaration IDs and returned historical snapshots.
- Updated contracts with capture interfaces, budgets, package modes, v3 migration behavior and runtime/nonexecution limitations.

## TDD and verification evidence

All logs are under `/workspace/AtlasMode/.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-2/`.

1. Authentic initial RED at 04:22:03 UTC: `npx vitest run packages/indexer/src/packageCapture.test.ts packages/core/src/validation.test.ts packages/indexer/src/index.test.ts packages/indexer/src/commonjs.test.ts` → **24 failed, 199 passed / 4 files**. `red.log` records missing `manifests`, unsupported `packageFiles`, missing public package capture and false resolved calls for import.meta/top-level await. Product changes followed this RED.
2. Initial implementation run `green-initial.log` → 257 passed / 3 failed. All three failures were public index tests using stale built `@codemap/core` schema (unrecognized `packageFiles`); core's source-schema tests passed. `npm run build --workspace=@codemap/core` (`core-bootstrap-build.log`) rebuilt the workspace dependency without changing source to bypass validation.
3. Focused GREEN at 04:27:15 UTC: same four files plus packageMode/configCapture → **266 passed / 6 files** (`green-focused.log`). Additional tests cover shared-budget acceptance in both category orders, overlap byte object reuse/no reread, exact budget boundaries, after-stat growth, ignored/linked/nonregular/unreadable seeds, root escape sentinel, strict JSON/type matrix, package scope and legacy metadata.
4. Initial affected run at 04:29:15 UTC: `npx vitest run packages/indexer/src packages/core/src` → **308 passed / 8 files** (`affected-tests.log`); initial two-package build and root lint passed (`build.log`, `lint.log`). This was not the final source checkpoint.
5. Self-review found await in a computed class method name was incorrectly counted inside the method. Focused new RED `npx vitest run packages/indexer/src/commonjs.test.ts -t 'computed|rejects .js module syntax'` at 04:30:22 UTC → **1 failed, 5 passed, 86 unselected**, `red-computed-await.log`: expected unresolved, received resolved implementation ID. The guard now traverses computed names at enclosing function depth. This is confined to Task2 `.js` syntax eligibility.
6. Final affected GREEN at **04:31:03 UTC**, after that guard fix: `npx vitest run packages/indexer/src packages/core/src` → **309 passed / 8 files**, no failures/skips (`affected-tests-final.log`). The final registry file contains the original 83 unchanged Task1 cases plus 9 syntax tests; Task1's 253/6 baseline is not relabeled as this run.
7. On final source bytes: `npm run build --workspace=@codemap/core --workspace=@codemap/indexer`, `npm run typecheck --workspace=@codemap/core --workspace=@codemap/indexer`, and `npm run lint` each exited **0**, with no warnings/errors (`build-final.log`, `typecheck-final.log`, `lint-final.log`). Exact log completion UTC timestamps are in `final-check-times.txt`; final source SHA256s are in `source-sha256.txt`.
8. `git diff --check` clean; all installed vendor checksums passed (`vendor.log`). No vendor/dependency/lock/global settings changes.

## Files changed

Created: `packages/indexer/src/metadataRead.ts`, `packageCapture.ts`, `packageMode.ts`, `packageCapture.test.ts`, `packageMode.test.ts`.
Modified: `packages/indexer/src/configCapture.ts`, `scan.ts`, `index.ts`, `index.test.ts`, `commonjs.ts`, `commonjs.test.ts`; `packages/core/src/model.ts`, `validation.ts`, `validation.test.ts`; `docs/superpowers/contracts.md`.

## Self-review and limits

Reviewed the full diff/new modules for capture safety, independent budgets, cache semantics, nearest opaque/invalid behavior, identity stability and scope discipline. The computed-name await finding was fixed through recorded RED/GREEN. No known outstanding correctness concerns. Existing `commonjs.ts` remains a large Task1 module; only the new source syntax eligibility guard was touched, with no architectural split or registry rewrite.

No target execution, real compiler filesystem, workspace/exports resolution, forwarding/value-flow expansion, dependencies, root-wide test suite, browser, product transports or mature-target run occurred. HTTP/MCP/SQLite/UI historical approval behavior and fixed Express acceptance remain Task3; this report claims only Task2 source/core evidence. No helpers/review agents were dispatched. Local commit only; parent supplies fresh independent gate.
