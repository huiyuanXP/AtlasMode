# ONE combined whole-plan fix report

Status: **DONE_WITH_CONCERNS**. Fix base `5badf244571699b7b584dbc8c8bf04f1655fa9c3`.
The new cycle-binding defect and stale environment status are addressed by this candidate; the original shutdown causal gap and host warning remain unresolved. This is implementer evidence and self-review, not independent whole-plan approval. Parent owns the single fresh scoped re-review and residual disposition. No helper/reviewer was spawned, no second wave initiated, no push/publication.

## All four finding verdicts

| Finding | Implementer verdict | Evidence / retained limit |
| --- | --- | --- |
| WR-I1, blocking Important: uncertain cyclic require initialization accepted | **ADDRESSED** | Authentic pre-fix RED: 11 failures reporting resolved real implementation IDs where null/unresolved was required. Iterative captured dependency components now reject imported values on cycle edges before checker fallback. All 110 registry cases, 327 affected tests and final 458-test root suite pass. Independent scoped verification remains pending. |
| WR-I2, real Important: original required shutdown failure lacks causal evidence | **NOT ADDRESSED** | Original SIGKILL and all five task re-review verdicts remain unchanged. Whole reviewer accepted nonblocking cap disposition conditional on WR-I1 repair; disposition is not a causal repair. The supported unfinished-HTTP repair and accepted-request/SQLite preservation remain intact. No sixth investigation, speculative patch, retry or causal attribution. A different rare shutdown path may recur; any concrete recurrence needs a separately bounded instrumented investigation. |
| WR-M1, nonblocking Minor: host Playwright color warning | **NOT ADDRESSED** | Original raw warning and NO_COLOR retained. Existing supported per-invocation CLI guidance retained with its explicit worker limitation. No environment/global/library/preload hack, stderr filtering, browser replay or claim of pristine historical output. |
| WR-M2, Minor: stale current/final environment page | **ADDRESSED** | Environment lead now records final amended 458/30 plus seven-workspace build/typecheck/lint, and the still-pending scoped whole gate. Initial 436/29 and unchanged retry are explicitly historical; later 140a3aa repair/440/30/sequential planning are a distinct historical stage. Unknown original cause, cap, warning, raw failure, Express original entry FAIL versus generic browse PASS and native/client/CI/restore UNRUN remain explicit. |

## Scope, cause and implementation

Read the full dispatch brief and complete whole review (all four findings and individual dispositions), formal spec/plan/global constraints, Task1 brief/report including duplicate-declaration fix, current progress rulings and Task3's current repair/cap state. Read the repository's vendored SDD/TDD/debugging/verification guidance. Inherited onboarding/runtime skills were read within this bounded coding assignment; the read-only managed status observation reported running/current observations but network policy state unknown. No new network/credential readiness or configuration/restoration claim is made; no configuration save was needed in this fix role.

Owned product source: **packages/indexer/src/commonjs.ts only**. Owned tests: **packages/indexer/src/commonjs.test.ts only**. Documentation: README.md, docs/environment.md, docs/superpowers/contracts.md, readme-coverage.md and state.md. No public-interface/hash/dependency changes. No core/service/storage/server/helper/preload/browser source changed; no parent-source takeover or extra-unit proposal was necessary. Parent acknowledged the in-unit proposal before implementation.

The original implementation completed the final export map and accepted const consumer bindings without accounting for require initialization cycles. A constant destructured value can therefore be permanently undefined even though the target's final export map contains a function. Const stability does not establish the value's initialization identity.

The fix reuses **existing requireBinding validation** and **captured checker module identity**. It builds forward and reverse adjacency sets only from require calls that already passed lexical identity, Node-global mode, rewrites, one-literal and captured-target checks. Dynamic/shadowed/unknown-mode/unavailable/external require calls cannot invent captured dependency edges. Side-effect-only require calls participate; nested calls participate conservatively because no execution timing is proven.

Two iterative graph passes compute strongly connected components in O(V+E) time/space bounded by captured modules and validated require edges. No recursive module-chain traversal, loader execution, runtime value evaluation, recursive export forwarding or new filesystem/network read occurs. A require edge whose importer and target share a component (including a singleton self-edge) receives a private `cyclicInitialization` flag **before derived const/property/destructured bindings are collected**. Classification turns that flag into handled unresolved with a cycle reason, preventing checker fallback.

The private flag is separate from `reason` and keeps the actual target module/property. That matters to the existing consumer mutation pass: a known member write still invalidates only that export rather than accidentally escalating every cycle binding to whole-module invalidation; unknown writes/namespace escape still invalidate the module across consumers, including ESM consumers. Import relations continue to prove captured module dependency with real path/line/text. Stable exported declaration IDs/flags are preserved when only the importing value is uncertain. Ordinary local function recursion and acyclic edges into/out of a cyclic component retain their existing guards.

Accepted conservative cost: a nested/conditional require, an export assigned before require, or a namespace used only after initialization may be safe at runtime but still falls outside the proven cyclic subset. No load order or reachability evaluator is added. Only the existing captured require subset contributes edges; this is not a general mixed-loader/module graph or runtime compatibility claim. Missing/dynamic/unsupported paths retain their existing unknown behavior. Static forwarding remains explicitly deferred.

## Meaningful RED and coverage

Tests were authored and executed before production changes. They index in-memory authored captured source through the real indexTypeScript/Graph pipeline, without mocks or executing fixture modules. The break each new negative detects is acceptance of a cycle-dependent callable from the final export map. Controls detect overbroad rejection, loss of identity/evidence, or bypass of existing safety facts.

18 added cases, taking registry92→110 and root440→458:

- Exact review reproducer: both directions of two-module destructuring must be unresolved, in both source orders. The actual function declaration IDs, line2/export flags and both real resolved import edges remain asserted.
- Self-require destructuring must be unresolved while its actual stable export stays exported.
- Seven forms each compare cyclic rejection with an acyclic positive control targeting the exact original implementation ID: namespace property, literal namespace property, renamed destructuring, selected-property binding, direct require property, callable-default binding, direct require callable. Several cover nested require calls as well as top-level capture.
- Three-module cycle closed by side-effect require, with separate acyclic outgoing and incoming calls that must still resolve to exact declaration IDs.
- Shadowed require, dynamic require and an unknown-mode bridge do not fabricate cycle rejection.
- Ordinary self/mutual local function recursion inside a cyclic module graph still resolves to actual local declarations.
- A cyclic importer's known-property write, unknown-property write and namespace escape preserve cross-consumer rejection including an ESM consumer; a separate safe property survives only the known-property case.

All logs/receipts below are in `.superpowers/sdd/2026-10-03-static-commonjs/scratch/whole-fix/`. Command stdout/stderr were captured raw; JSON receipts retain underlying process exit codes and UTC timestamps. The RED recording wrapper itself completed successfully after preserving exit1; no failing test was relabeled passing.

| Stage / exact command | UTC start / actual outcome | Logs |
| --- | --- | --- |
| RED `npx vitest run packages/indexer/src/commonjs.test.ts -t 'require initialization cycles'` | command06:51:29.570779, runner06:51:30; **exit1, 11 failed / 7 passed / 92 unselected**, runner747ms, command1.230s. Failures are resolved-vs-unresolved assertions with real target IDs, not harness errors. | cycle-red.log/json |
| GREEN `npx vitest run packages/indexer/src/commonjs.test.ts` | command06:52:30.093530; **exit0, 110/110**, 1 file, runner1.05s, command1.522s. | cycle-green.log/json |
| Affected `npx vitest run packages/indexer/src packages/core/src` | command06:53:34.168419, runner06:53:34; **exit0, 327/327**, 8 files, runner3.17s, command3.656s. Includes CommonJS/public indexer/config capture/resolution/package budgets/mode/Python and core checks. | affected-green.log/json |
| Final `npm run build` | 06:53:56.963026; **exit0, seven workspaces**, command11.556s. | root-build.log |
| Final `npm run typecheck` | 06:54:08.519687; **exit0, seven workspaces**, command19.685s. Existing workspace helper also performs prerequisite builds. | root-typecheck.log |
| Final `npm run lint` | 06:54:28.204823; **exit0**, no diagnostics, command1.763s. | root-lint.log |
| Final `npm test` | command06:54:29.968191, runner**06:54:30**; **exit0, 458/458, 30 files, no failed/skipped**, runner**30.24s**, command30.572s. | root-test.log, root-checks.json |

Formatting: `npx prettier --write packages/indexer/src/commonjs.test.ts` before RED; `npx prettier --write packages/indexer/src/commonjs.ts` before GREEN. Both exit0. Final `git diff --check` clean. `sha256sum --check docs/superpowers/vendor.sha256` retained 75 OK entries and no failure in vendor-check.log.

Exactly one final sequential root build/typecheck/lint/test was run on the final coherent product/test bytes. Existing root tests include actual compiled HTTP/SDK/SQLite type-only freshness/history and real server shutdown preservation; the MCP suite's internal shared-dist rebuild is unchanged. No browser ran concurrently or at all during this fix. No additional root repeat, benchmark, mature target/Express/Vite/Flask replay, smoke replay, dependency installation, native client probe or fake backend RED.

## Current versus historical evidence

The current amended analyzer's result is **458/30**, not 440 or 436. The historical Task3 436/29 (30.32s), first actual SIGKILL and one unchanged isolated retry remain initial-stage evidence. The separately supported server repair140a3aa has historical440/30 (06:04:27 UTC,30.24s) and subsequent sequential planning1 PASS (06:05:17.367Z launch,11.1s case/12.0s total). That later success does not explain the original event. All five reviewer findings remain NOT ADDRESSED for the original causal gap; no Task3 clean approval is inferred.

Historical UI3, screenshot actual-view receipts and full pinned Express generic browser/HTTP/SDK PASS remain at their original source revisions/times, with Express's original canonical automatic-entry **FAIL** intact. Mature target artifact files were preserved, not regenerated or used as current analyzer acceptance. No native Windows/macOS, actual Codex/Claude client, remote CI, fresh cloud restore, publication or whole-machine/model-offline claim is added.

## Preservation and owned cleanup

Before affected/root checks, copied all **91** existing artifact files to `prior-artifacts/` and recorded SHA256 for both originals and backups. The same `before-checks.json` fingerprints **353** prior current-plan records (excluding this fix directory and the controller-owned progress ledger) and **121** tracked product/test/script/config files. The 121 list selects tracked packages/apps/tests/scripts/.github files plus root package/lock/vitest/tsconfig.base/.node-version; it is a new exact receipt, not a relabeling/replacement of historical114 or128 manifests. The original raw first failed run, all five re-review files and target evidence are among preserved records/artifacts.

`verification-preservation-cleanup.json` at **06:56:45.400236Z** verifies:

- 121/121 source entries match the final bytes present before the covering checks; no source/test change after verification.
- 91/91 original artifact files unchanged; 91/91 backups match. No historical screenshot or target JSON changed.
- 353/353 previous plan records unchanged, including original raw failure and prior review evidence.
- No new owned atlas/codemap temporary directories relative to the pre-check inventory; no remaining server/MCP Node process in the post-run `/proc` observation. Only tests' disposable stores/directories were eligible for cleanup; user SQLite was never deleted or migrated.
- SDK `pid === null` remains **distinct from OS process reaping proof**. The current post-run absence check is an additional present observation and does not reconstruct original child cleanup timing.

No target checkout was read, installed, modified or executed. No instrumentation or temporary source changes need restoration. Generated shared dist changed only through the authorized existing builds/tests.

## Self-review and handoff

Reviewed the complete source/test and documentation diff, focusing on phase ordering, iterative component membership, singleton self-edge, file-order independence, copied flags through selections/destructuring, preservation of mutation/escape granularity, actual implementation/import identity, local recursion and conservative mode/shadowing boundaries. Mutating the cycle flag/classification away recreates the 11 observed RED failures; poisoning entire cyclic modules would fail export/acyclic controls; erasing module identity would fail cross-consumer guards; treating function calls as dependencies would fail recursion controls. No implementation concern requiring another source amendment was identified. Human prose updates required no new execution.

The fix is a coherent reviewed-change candidate, **not self-approved whole-plan closure**. Parent should read this report and the complete diff and dispatch the prescribed one fresh scoped re-review. Residual WR-I2 Important and WR-M1 Minor are deliberately NOT ADDRESSED; their nonblocking dispositions and exact costs remain visible. No second wave/publication is authorized by this report.

Local commit: **15d2c1656ed22f2afb3e6ff2eb3b3bbb7f4417be** — `fix(indexer): reject uncertain cyclic CommonJS bindings`. Seven tracked files committed; working tree clean immediately afterward. The committed product/test bytes are exactly the fingerprinted final bytes covered by the checks above; documentation subsequently records their actual results. Ignored report/evidence will be archived by the parent under the existing workflow.
