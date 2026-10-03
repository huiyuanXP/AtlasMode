# Task 2 independent review

Spec compliance: **PASS for Task 2**. Task quality: **Approved**.
Findings: **0 Critical, 0 Important, 0 Minor**.

Reviewed base `d03614c9e82c6cbe70e5972205a1d3daf040b0b8` through head
`d217e1dc456163eade1f5043d9c5fcde30953751` using the supplied 66,478-byte
`review-d03614c..d217e1d.diff`. Read that package once, in four nonoverlapping
bounded chunks. Read the brief, context, preflight notes, implementation report,
full formal spec/plan, repository instructions, tool adaptation and SDD reviewer
prompt. No replacement diff, repository crawl, helper, source edit, commit,
passing-test rerun, browser or mature-target run occurred. This report is the
only reviewer-authored artifact.

## Spec compliance and strengths

1. **Shared bounded capture:** `packages/indexer/src/metadataRead.ts:15` extracts
   the former configuration reader, rather than duplicating it. The diff retains
   component lstat checks, same-location realpath checks, NOFOLLOW open, opened
   regular-file checks, inode/device/location recheck, bounded allocation/read,
   overflow rejection and finally-close. `metadataRead.ts:7` preserves the exact
   262144/4194304/512 limits. `configCapture.ts:32` delegates reading while leaving
   the selected-chain/depth16 traversal outside this refactor.
2. **Independent acceptance:** `metadataRead.ts:21` shares successful observations,
   while `metadataRead.ts:24` creates separate accepted/failed sets and byte totals
   for each category. Shared bytes still consume each category's count/total;
   category failure cannot poison the other category. Failed overflow reads do
   not enter the shared byte cache. `packageCapture.test.ts:36` checks byte-object
   reuse and one open; its overlap and reverse-order budget cases independently
   exercise both acceptance directions. The production scan calls the categories
   sequentially, so this implementation needs no concurrent-reader coordination.
3. **Opaque package scope and source separation:**
   `packages/indexer/src/scan.ts:112` adds package-specific rejected-seed evidence;
   `scan.ts:263` filters metadata through existing ignores before capture.
   `packageCapture.ts:12` emits the dedicated marker and never reads rejected
   seeds. `index.ts:57` publishes package coverage separately from source files,
   configuration files and graph source nodes. Ignored/symlink/directory/unreadable
   sentinel cases and post-stat growth cases are meaningful filesystem tests;
   the unreadable/growth fault injection is limited to the failure being tested.
4. **Strict captured mode:** `packages/indexer/src/packageMode.ts:7` uses JSON.parse,
   accepts only an object with absent/commonjs/module type, and treats invalid JSON
   or type as unknown. `packageMode.ts:25` accepts only normalized root-relative
   package scopes; exact unavailable markers override captured scope. Its nearest
   scope search stops on unknown and never reads an ancestor or consults a loader.
   Explicit cjs/mjs formats and unknown JSX/TS behavior match the brief.
   `packageMode.test.ts:8` checks nearest invalid/recognized types, nested scope,
   sibling prefix isolation, opaque scope, missing scope and outside-root inputs.
5. **New .js guard is narrow and correctly placed:**
   `packages/indexer/src/commonjs.ts:165` adds only source ESM-syntax eligibility.
   import.meta is rejected at any function depth; await/for-await at depth zero
   is rejected; nested function/method bodies increase depth. Computed method
   names use their enclosing depth, preserving the execution context that the
   authentic computed-name RED exposed. `commonjs.test.ts:518` supplies six
   rejecting syntax cases and three nested async controls. Existing import/export
   guarding remains in the surrounding diff. Task1's registry is not rewritten.
6. **Versioned identity and legacy schema:** `packages/indexer/src/scan.ts:292`
   changes the prefix to v3 and adds a distinct package group to the existing
   typed path/byte-length framing. Invalid captured JSON remains an input;
   rejected bytes stay outside the byte hash and their diagnostics affect facts.
   `index.test.ts:884` checks package-only hash/fact changes, stable declaration
   IDs and unchanged prior returned snapshots; `index.test.ts:928` checks rejected
   scope fact changes without contentHash changes or sentinel disclosure.
   `packages/core/src/model.ts:36` and `validation.ts:152` add an optional field;
   `validation.test.ts:120` distinguishes legacy omission from recorded zero and
   rejects invalid repository paths. No migration or historical rewrite appears.
7. **Scope and documentation:** All 15 planned files have corresponding changes;
   new modules have single capture/reader/mode responsibilities. Contracts document
   budgets, hash migration and static-only format limitations at
   `docs/superpowers/contracts.md:346`. No dependency, lockfile, vendor, transport,
   UI or public port change is included.

## Verification evidence

The following are inspected implementer logs, not reviewer reruns. All paths are
under `.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-2/`.

1. `red.log`: **24 failed, 199 passed / 4 files**, start **04:22:03 UTC**.
   Failures demonstrate absent captures/coverage and false-positive syntax calls,
   not a manufactured environment-only RED.
2. `green-initial.log`: **3 failed, 257 passed / 6 files**, start **04:25:14**.
   All three failures are built-core schema rejection of packageFiles.
   `core-bootstrap-build.log` shows the core rebuild; `green-focused.log` then
   records **266 passed / 6 files**, start **04:27:15**. The final schema change is
   ordinary optional-field validation, with no bypass of validation.
3. `red-computed-await.log`: **1 failed, 5 passed, 86 unselected**, start
   **04:30:22**. The failing computed class method name produced a resolved
   implementation ID where unresolved was required. The final diff fixes the
   precise depth propagation responsible for that failure.
4. `affected-tests-final.log`: **309 passed / 8 files**, start **04:31:03**,
   duration **2.96s**, no failure/skip count or warning. This supersedes the
   earlier 308 result. The package includes the original 83 Task1 cases plus nine
   new syntax cases, along with configuration capture/resolution and core tests.
5. `build-final.log`, `typecheck-final.log`, `lint-final.log` show the requested
   core/indexer build, core/indexer no-emit typechecks and root ESLint commands,
   with no warnings/errors. The implementer reports exit 0 for each; no log
   contradicts that report. `final-check-times.txt` records completion at
   **04:31:05.978325** (tests), **04:31:18.278593** (build),
   **04:31:17.150569** (lint), **04:31:56.563416** (typecheck), all UTC.
6. Reviewer ran only the read-only integrity command
   `sha256sum --check .superpowers/sdd/2026-10-03-static-commonjs/scratch/task-2/source-sha256.txt`:
   **all 15 source/document fingerprints match**. This establishes that the
   reviewed current bytes match the recorded final source manifest; it does not
   independently rerun or prove test execution times.

No named behavioral probe was needed: the diff and existing regression evidence
answered the Task2 capture, cache and syntax questions. No unchanged source file
was opened to broaden the Task1 review.

## Issues

- **Critical:** none.
- **Important:** none.
- **Minor:** none.

## Individually declined judgments and owners

1. Complete unchanged Task1 lexical identity/overwrite/namespace/ESM-bypass
   registry audit: prior Task1 independent gate owns it; this gate checks only
   the new syntax interaction and preserves the recorded regression evidence.
2. Real compiled HTTP package-only freshness lifecycle: **pending Task3**.
3. Actual SDK stdio MCP parity/protocol behavior: **pending Task3**.
4. Plan and route staleness through the service after package-only edits:
   **pending Task3**, beyond the verified indexer hash/fact change.
5. Persisted SQLite legacy snapshots and immutable approval/history across
   refresh/restart: **pending Task3**; schema parsing alone is not that proof.
6. Chinese and English package metadata navigation, legacy unrecorded versus
   recorded zero rendering: **pending Task3**.
7. Browser entry-to-helper/source navigation and visible unknown reasons:
   **pending Task3**.
8. Actual screenshot readability and screenshot viewing: **pending Task3**.
9. Browser external-request denial, console/page errors and SDK stderr:
   **pending Task3**.
10. Final combined root build/typecheck/lint/test gate: **pending Task3**;
    the Task2 affected checks are not that gate.
11. Fixed Express 5.2.1 product browsing, canonical lib entry, unknown dynamic
    behavior and clean HEAD/worktree before/after: **pending Task3**.
12. Product-harness owned process/store cleanup and target nonexecution sentinel:
    **pending Task3**; the Task2 fixture tests do not replace it.
13. Native Windows behavior: **UNRUN**, platform validation owner/controller.
14. Native macOS behavior: **UNRUN**, platform validation owner/controller.
15. Actual Codex/Claude client registration: **UNRUN**, client integration owner.
16. Remote CI execution: **UNRUN**, CI/controller owner.
17. Fresh cloud restore: **UNRUN**, environment/controller owner.
18. Offline product operation or external model behavior for this revision:
    no new Task2 acceptance run; controller retains the prior evidence limits.
19. Workspace exports mappings, forwarding/value-flow analysis and target
    runtime/build success: outside this plan's supported static subset; future
    feature/runtime validation owners, with no positive claim from format mode.
20. Unchanged Vite/Flask product gates: historical evidence only; no rerun or
    current-revision acceptance claim made by this review.

These boundaries are not Task2 failures or Task3 passes. No remaining finding
blocks the Task2 gate; controller adjudication of cross-task ownership remains
required before marking the whole plan complete.
