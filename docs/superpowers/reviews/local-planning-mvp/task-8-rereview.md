- **I1 — Windows preload imports are invalid module specifiers.** — **ADDRESSED**. `tests/support/production.mjs:30`, `apps/server/src/dev.test.ts:91`, and `apps/server/src/index.test.ts:38` now pass `pathToFileURL(resolve("tests/support/graceful-preload.mjs")).href` to `--import`, with explicit `node:url` imports. Node receives a `file:` URL rather than interpreting a Windows drive letter as a protocol. Ordinary program entry arguments remain filesystem paths at `tests/support/production.mjs:31`, `apps/server/src/dev.test.ts:92`, and `apps/server/src/index.test.ts:41`.
- **I1 regression coverage — sufficient.** `tests/integration/preload-loader.test.ts:20` creates a real checkout path containing spaces and `#`; `:29` copies the compiled entry so the main-module guard can succeed; `:40` imports the actual shared production helper; `:43` checks real HTTP health; `:46` awaits the installed shutdown handler. This exercises the actual Node loader and launcher rather than a mock or source-text assertion. Existing CLI/dev checks cover the other two amended launchers.

### New Breakage in the Fix Diff

- **None.** The supplied four-file fix contains the three preload-specifier conversions and one real-process regression. No new Critical, Important, or Minor issue identified in the fix diff.

### Out-of-Scope Observations

- **M4 / original review M1 — deferred, nonblocking.** The target-dirty pin guard at `scripts/validate-repository.mjs:25` remains outside this fix, as recorded in `task-8-review.md`. It belongs to final whole-branch triage and does not reopen I1. No additional out-of-scope issue identified.

### Checks and Evidence

- **Scope checked:** supplied `review-5b22868..24a6d76.diff` read once, covering FIX_BASE `5b22868fdd11e0a8d599b2ba5494a51addd51c49` through HEAD `24a6d760fe7c4bfb1c80cd7a0fcc7495fb7cfa45`. No Git diff regeneration, broad repository crawl, source/index/HEAD mutation, or test-suite rerun.
- **Meaningful recorded RED/GREEN checked:** `task-8-i1-loader-red.log:34` reports the final fixture's raw-path mutation failing in Node's loader with `ERR_MODULE_NOT_FOUND` at the path before `#`; `:63` records one failed test. `task-8-i1-loader-final.log:10` records the restored conversion passing one test, with the final run timestamp at `:11`. The fixture and shared-helper code match that failure mechanism.
- **Affected launcher checks checked:** `task-8-i1-green.log:43` records ten CLI/dev tests passing alongside the initial new fixture failure. That combined run was correctly reported as failed, not a successful eleven-test run. The later fixture repair changes only the new test's copied-entry setup, leaving the three conversions and existing CLI/dev tests unchanged; the corrected fixture passes in the final log.
- **Production smoke checked:** `task-8-i1-smoke.log:5` records PASS for production assets, TS/Python HTTP/SDK browsing, no target execution, and persistent restart. The shared production launcher still uses the original executable entry path and shutdown behavior.
- **Type/lint evidence checked:** `task-8-i1-types.log:2` names the server typecheck. `task-8-report.md:262` additionally names the explicit strict TypeScript check of all three affected TS tests and the four-file ESLint check; their supplied logs contain no diagnostics. Exit-zero claims come from the implementer's report rather than reconstructed statuses. No code-level doubt requires another focused probe.
- **Limits retained:** `task-8-report.md:279` explicitly leaves native Windows/macOS unrun. Actual Codex/Claude client connection, remote CI, Windows Ctrl+C, and fresh-task restoration remain unverified as recorded by the original review. The Linux loader regression establishes conversion behavior, not native platform acceptance. The pre-fix 200-test suite is not described as a post-fix 201-test run.

### Verdict

**Fix round: All findings addressed, no new Critical/Important breakage.** I1 is closed; no open blocking finding remains in this scoped fix round. M4 remains deferred to final review.
