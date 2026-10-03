## Spec Compliance

- ❌ Issues found: the Windows CI/test/smoke path cannot launch the newly introduced preload because `--import` receives a raw Windows absolute path. See I1 at `tests/support/production.mjs:29`, `apps/server/src/dev.test.ts:90`, and `apps/server/src/index.test.ts:37`. The remaining reviewed T08 behavior and documentation satisfy the scoped brief.
- ✅ The requested production browser/SDK flow is implemented in `tests/e2e/planning.spec.mjs:13`: real fixture browsing, routes, groups/policies, reconnection, temporary-node removal, undo/redo, target-file change, approval, exports and project switching. `tests/e2e/planning.spec.mjs:349` checks knowledge invalidation; `:400` checks actual layout persistence without changing approved detail; `:501` restarts the actual service on its previous data directory and port before checking approved UI/MCP state.
- ✅ Deferred M2 is repaired at `apps/mcp/src/client.ts:34` and `:59`: one shared deadline governs both fetch and body consumption, and aborted body consumption distinguishes timeout from cancellation. `apps/mcp/src/client.test.ts:6` uses a real stalled HTTP body; `task-8-red.log:12` records the former API_INVALID_RESPONSE failure, and `task-8-minor-green.log:5` records 21 passing tests.
- ✅ Deferred M3 is repaired at `apps/web/src/app/workspace.ts:109`, `apps/web/src/app/App.tsx:95`, and `apps/web/src/features/groups/GroupsPanel.tsx:127`: local help/message keys resolve at render time while backend diagnostics remain verbatim. `apps/web/src/i18n/locale.test.tsx:65` covers cached help under both 409 and 503 plus the member and post-member snapshot cases; `task-8-locale-red.log:10` and `:26` record meaningful failures, and `task-8-locale-current.log:5` records the final six passing checks.
- ✅ CI includes the requested three native operating systems and a Linux official-Chromium browser job (`.github/workflows/ci.yml:8`). Build precedes tests that spawn compiled entries; commands are individual CI steps without success-masking pipelines. The Windows preload defect must be repaired before this configuration is usable on all three systems.
- ✅ Fixed Vite/Flask product validation, scope/counts/unknowns, explicit README coverage and subsequent tickets are provided by `scripts/validate-repository.mjs:25`, `docs/superpowers/validation-targets.md:58`, `docs/superpowers/readme-coverage.md:10`, and `docs/environment.md:1`. Interleaved captured-tsconfig design/plan and rulings are controller documentation, with future execution explicitly gated; they are not treated as T08 runtime features.
- ⚠️ Native Windows/macOS, Windows Ctrl+C, remote CI, actual Codex/Claude connections and new-environment restoration remain unexecuted, as explicitly disclosed in `docs/environment.md:100` and `:113`. Fixing I1 does not establish those platform results.
- ⚠️ Unchanged core/service architecture, the full existing contracts and client configuration examples are outside this task diff; the controller's whole-branch review remains responsible for those cross-task requirements. No new core/service implementation or transport contract is introduced here.

## Strengths

- `apps/web/src/app/WorkspacePanels.tsx:18` restricts reconnection candidates to loaded facts from the current snapshot and deduplicates them; `apps/web/src/features/graph/projection.ts:84` adds only referenced off-graph anchors. The regression at `apps/web/src/features/graph/projection.test.ts:147` checks readable identity, the relation target, exclusion of unused nodes and preservation of the original graph.
- `tests/e2e/planning.spec.mjs:442` checks real JSON/Markdown downloads and exact SDK agreement with approved detail. The later real source edits distinguish satisfied intent, a deliberate bypass and dynamic unknowns instead of treating a green interface as implementation proof.
- `tests/support/graceful-preload.mjs:1` clearly confines handler invocation to the test process. The server lifecycle tests retain real Unix signals in addition to portable handler invocation; production application code gains no IPC command surface.
- `docs/superpowers/readme-coverage.md:10` distinguishes PASS, PARTIAL and UNIMPLEMENTED, including the remaining knowledge, grouping, resolution and platform gaps. The observed Linux results are not presented as native Windows/macOS success.

## Issues

### Critical (Must Fix)

- None found.

### Important (Should Fix)

- **I1 — Windows preload imports are invalid module specifiers.** `tests/support/production.mjs:29`, `apps/server/src/dev.test.ts:90`, `apps/server/src/index.test.ts:37`. **Trigger:** these launchers run from an ordinary Windows drive checkout, so `resolve("tests/support/graceful-preload.mjs")` becomes a path such as `C:\work\AtlasMode\tests\support\graceful-preload.mjs`. Node's ESM `--import` interprets `C:` as a URL protocol and rejects it with `ERR_UNSUPPORTED_ESM_URL_SCHEME` before installing the preload or starting the application. **Impact:** the new `windows-latest` job's CLI/dev tests and production smoke fail before testing the behavior T08 intends to validate. **Repair:** import `pathToFileURL` from `node:url` and pass `pathToFileURL(resolve(...)).href` at all three preload arguments. Keep ordinary filesystem paths for the actual program entry argument. Add a focused regression for the preload-specifier conversion and run the affected process checks; native Windows remains separately unverified until executed.

### Minor (Nice to Have)

- **M1 — Target pinning checks HEAD but not the indexed working tree.** `scripts/validate-repository.mjs:25`. **Trigger:** a previously prepared target has modified tracked source or added untracked source while HEAD still equals `--commit`. **Impact:** validation succeeds and labels the source with the reviewed commit even though the actual indexed inputs differ, weakening reproducibility of the fixed-target evidence. **Repair:** reject a dirty target before opening it, or record working-tree status and an input fingerprint and label modified inputs explicitly. This does not establish that either recorded target was dirty; it is a validator guard gap.

## Checks and Evidence

- Reviewed supplied package `review-d3a3b15..5b22868.diff` for base `d3a3b152b3f4f463ab6a97a478140151a8e48031` to head `5b22868fdd11e0a8d599b2ba5494a51addd51c49` in bounded passes. Re-read only output-truncated portions. No Git diff regeneration, source-file rereads, broad codebase crawl, suite rerun or browser rerun.
- Named focused probe: **Windows drive-letter preload specifier acceptance**. Ran `node --import 'C:\atlasmode\tests\support\graceful-preload.mjs' --eval ''` on Node 24.19.0. Exit 1, `ERR_UNSUPPORTED_ESM_URL_SCHEME`, protocol `c:`. This checks the loader's rejection of the emitted specifier; it is not a native Windows execution claim.
- Existing evidence checked: `task-8-clean-install.log:2` records 410 installed packages; build/typecheck logs list all seven workspaces; `task-8-clean-lint.log:2` has no diagnostics; `task-8-clean-tests.log:9` records 20 files/200 tests passed; `task-8-clean-smoke.log:5` records production smoke PASS. The reviewed current result summaries contain no warnings. Recorded exit status is supplied by the implementation report/controller rather than reconstructed by rerunning commands.
- Existing browser evidence checked: `artifacts/e2e/results.json:1` records expected 1, unexpected/skipped/flaky 0 and 11306.933 ms. `artifacts/e2e/joint-flow-evidence.json:1` matches revision 16, the reported semantic hash, JSON 3356 bytes, Markdown 3544 bytes, empty error/external arrays and the source-backed satisfied/unmet/unknown results.
- Existing target evidence checked: `task-8-vite-settled.log:5` and `task-8-flask-settled.log:5` match the product JSONs, fixed SHAs, 4651/1740 ms, 1583/83 source files and reported bounded expansion/call statistics.
- Actually inspected existing `artifacts/e2e/desktop-dark.png`, `artifacts/e2e/narrow.png`, `artifacts/validation/vite-product.png` and `artifacts/validation/flask-product.png`. They show the readable dark reference anchor and r16 approval, the narrow editor below the canvas, and readable selected source functions/details with idle footers on both public targets. Narrow overview graph text still requires zoom, consistent with the documented limit.

## Assessment

**Task quality: Needs fixes — 0 Critical, 1 Important, 1 Minor.**

**Reasoning:** The implementation provides meaningful real-process, browser and SDK acceptance evidence and resolves M2/M3 with recorded RED/GREEN regressions. The raw Windows preload paths block a required CI platform and must be fixed before T08 approval; the dirty-target guard is a nonblocking reproducibility improvement.
