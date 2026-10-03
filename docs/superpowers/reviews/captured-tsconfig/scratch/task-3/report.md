# Task3 implementation report — captured configuration public product

Status: DONE; implementation self-review complete; independent task/whole-plan gates remain controller-owned.
Base: 10eea272940a5c60f5136418ec46c9fabab1efb5. Work branch; sole implementer, no helpers/reviewers/worktrees/dependencies/global configuration/publication.
Commit: `ab9f8c1258ba6be32a88759d511897ad8134a52b` — `feat: expose and verify captured configuration scope`.

## Delivered

- Navigation diagnostics now have an accessible named configuration-input region with exact Chinese/English labels, count and repository-relative paths. Optional historical omission renders explicit unrecorded coverage, never fabricated zero. Source counts and authored source/paths remain separate and unchanged.
- New real compiled HTTP + actual MCP SDK stdio lifecycle regression: inherited JSONC paths changes only config bytes A→B; source bytes unchanged, function identity set retained, new target is targetB.ts:3 and call evidence entry.ts:2. Both transports agree on snapshot/context/summary and source/config metadata (6 sources, 2 configs). Approved revision/operations/approval and original snapshot/route remain unchanged in actual SQLite; plan becomes stale and MCP route reports stale.
- Actual stopped-process SQLite legacy seeding (own historical snapshot ID and old-style hash, omitted optional field), followed by fresh server/SDK read, proves production compatibility rather than schema parse or route stubbing. Refresh preserves that legacy historical record.
- Two real browser regressions: captured and actual SQLite legacy summaries; exposed entry → resolved call expansion → target source, actual search, diagnostics, bilingual coverage, source original Chinese text, HTTP/SDK agreement, external browser request denial, console/page/protocol errors and target execution sentinel. Saved four screenshots and actually viewed all four.
- Shared `tests/support/tsconfig.mjs` is the small additional test-support file needed to reuse the authored fixture and legacy seed across integration/browser tests. It composes existing `production.mjs` fixtures/sentinel and public SqliteStorage; no production boundary changed.
- README, environment, coverage, state and related validation-targets docs distinguish supported captured paths/baseUrl semantics from remaining workspace package/exports/CommonJS/references work, explain contentHash upgrade and legacy compatibility, and preserve historical validation claims.

## TDD and debugging record

The controller explicitly ruled that Task1/2 already implementing backend freshness means backend baseline GREEN is honest; do not manufacture a backend RED. Genuine missing UI behavior supplies Task3 RED.

1. Before any product change, `npx vitest run tests/integration/tsconfig-resolution.test.ts` ran against compiled dependencies already built by Task1/2. `backend-baseline.log`: one test failed because test call_chain step lacked mandatory relationId. Compared existing planning E2E contract and corrected only the fixture's route argument.
2. Same command, `backend-baseline-corrected.log`: one test failed because the assertion compared declaration traversal order, which legitimately changes when the resolved import target changes. The same seven IDs were present; corrected assertion to compare sorted identity sets, retaining target-specific identity/path/line assertions.
3. Same command, `backend-baseline-identity.log`: 1/1 passed, 2.48s total (2.18s test). This is baseline confirmation of Task1/2 behavior, not a claimed product RED/GREEN fix.
4. Before product implementation, `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test tests/e2e/tsconfig.spec.ts`: **2 failed**, both because no Configuration inputs region existed, after actual call/source browsing had passed. Exact failure `expect(...getByRole('region', { name: '配置输入' })).toBeVisible(): element(s) not found`. `ui-red.log`, `ui-red-results.json`, `ui-red-artifacts/` preserved.
5. Added only Navigation and two locale keys per language. `npm run build -w @codemap/web` exit0, `web-build.log`.
6. Same exact browser command: **2 passed, 0 skipped/failed**, 7.1s total; 2.8s captured +3.4s legacy. `ui-green.log`, `ui-green-results.json`. No browser test rerun after passing.

No product/backend correction was required by these probes. Harness corrections are not advertised as product bug fixes. Full diagnostics inspected, no cross-task failure found.

## Final integrated checks

After final product/test changes, run exactly one root sequence. `root-results.json` and individual logs:

| Command | Result | Wall seconds |
| --- | --- | ---: |
| npm run build | exit0; seven workspaces | 10.52 |
| npm run typecheck | exit0; seven workspaces | 18.49 |
| npm run lint | exit0 | 1.69 |
| npm test | exit0; **293/293 tests, 25/25 files; no failures/skips** | 30.61 |

Vitest suite reported30.25s (tests61.60s cumulative). New integration is included in293. No repeat passed root validation. Later changes were documentation only. Product-source fingerprint checked unchanged afterward.
`sha256sum --check docs/superpowers/vendor.sha256` exit0, all74 vendored files; `vendor-check.log`.
`git diff --check` exit0.

Existing production planning E2E justified once by changed navigation/legacy rendering:
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test tests/e2e/planning.spec.mjs`
**1 passed, 0 failures/skips**, test12.3s/total13.3s; `planning-e2e.log` and `planning-e2e-results.json`.
Real UI user approval r16 agrees with SDK semanticHash
`bb414b7f3377ae36550ba996a2c118b9b7e631ab3915607d1e544b3f40c41a26`, approved2026-10-03T03:02:18.569Z.
Retained restart, export JSON3828B/Markdown4016B, knowledge invalidation, layout retention, routes, implementation satisfied/unmet/unknown and no target execution verified by existing test.
Prior planning artifacts saved in `prior-planning-artifacts/` before this run; no historical receipt relabeling.

## Fresh fixed Vite gate

Command (one execution, no unchanged Flask repeat):
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run validate:repository -- --path /tmp/atlasmode-validation-vite --commit 10033218d239c927cdc375970b5741cce408e81b --symbol createServer --file packages/vite/src/node/server/index.ts --label vite-captured-tsconfig`

Exit0. Observed2026-10-03T03:02:18.513Z, opened/indexed5796ms. Before03:02:07.459Z and after03:02:18.513Z full Git HEAD/staged/working/all-untracked provenance clean and same pinned target SHA.
1583 source files, **55 separate configuration files**, 723 folders,8117 function-kind nodes,44263 relations. Calls6223 resolved /8302 external /15726 unresolved.762 entrypoints, first50 truncated; createServer search143; source sample packages/vite/src/node/server/index.ts:507. Budget1 and80node/240relation depth1 actual truncation verified.
18 diagnostics:5 excluded symlinks,2 intentional source syntax errors,2 unsupported package extends,7 unexpanded references,2 capture/resolution diagnostics for the same invalid JSONC fixture. Unknowns are not runtime coverage claims.

Actual compiled HTTP/UI/SQLite plus SDK summary/search/context/subgraph and HTTP source evidence, real browser source selection/expansion passed. No target dependencies/scripts/upstream tests executed. External browser requests denied; actual external[], console/page errors[], SDK stderr empty.
New artifacts `artifacts/validation/vite-captured-tsconfig-product.{json,png}` preserve historical `vite`/`flask` labels, copied into task scratch. `vite-gate.log` is exact stdout receipt.
Product run source: base10eea272 plus Task3 product changes. `product-source-provenance.json` pins exact source-file SHA-256 hashes. The final commit contains those same product source bytes; verification occurred before documentation/commit only.

## Screens actually viewed and observations

All through actual view_image tool, not mere file existence:
- `artifacts/e2e/tsconfig/captured-{zh,en}.png`: diagnostics expanded,6 source files and2 config inputs with config/shared.json andtsconfig.json readable; actual targetA.ts:2 source and entry.ts:2 call evidence visible.
- `artifacts/e2e/tsconfig/legacy-{zh,en}.png`: explicit unrecorded coverage, no fabricated0; source literal `A 原文` remains unchanged in both locales.
- `artifacts/validation/vite-captured-tsconfig-product.png`: selected real createServer card/read-only source/line507 and call evidence readable; bounded dense graph and truncation visible, footer idle.
- Current planning `compatibility-warning.png`, `desktop-light.png`, `desktop-dark.png`, `narrow.png`, `source.png`: warning visible, approvalr16 valid, themes and selected source readable; narrow760px editor stacks below graph as before.

`viewed-screenshots.json` records all10. Configuration screenshots/evidence copied to `tsconfig-browser/`; current planning originals remain artifacts/e2e and preceding screenshots preserved in task scratch.

## Cleanup, protocol and limits

Integration/browser fixtures assert sentinel absence, SDK pid null after close and root removal. Production harness requires actual server exit0 and stop reaps owned child. `cleanup-and-source-check.json` at03:05:41.328852Z confirms no remaining matching temporary fixture/target/browser roots or production server/MCP processes, and product sources unchanged since final checks. Only own disposable SQLite stores removed; user data and target trees untouched.
Actual SDK executes calls and reports no protocol errors; stderr empty. No raw stdout dump is claimed; SDK parsing is the protocol cleanliness check (existing full suite also includes malformed-stdio/protocol-only-stdout regressions).
Playwright test runner emits host NO_COLOR/FORCE_COLOR warning; this is not app console or MCP stderr. Do not describe all command output as warning-free.

No new endpoints/tools/storage schema/auth scheme/dependencies or target-code execution. Native Windows/macOS, remote CI, real client registration, fresh-task recovery, release/publication and upstream target tests remain unrun. Existing CommonJS shadowed require/overwritten exports defects remain explicitly the next independent ticket; no complete runtime binding guarantee. No Flask rerun and no new installation/smoke pass claimed.

## Self-review

Reviewed complete new fixture, integration/E2E and product diffs, final documentation and fresh receipts. Exact optional-field branch distinguishes recorded[] from missing; array order retained for paths; accessible section label matches locale; no source/config count pollution. Legacy fixture is a real separately stored historical record read through fresh production process, not a mocked HTTP response. Historical source bytes/approval equality and transport target assertions independently derived from authored fixture. Actual call_chain now includes its real relationId. No issue requiring product fix found. Independent review is still required and was not simulated or delegated by implementer.

Changed tracked/planned files: README.md; apps/web/src/app/Navigation.tsx; apps/web/src/i18n/{zh,en}.ts; tests/integration/tsconfig-resolution.test.ts; tests/e2e/tsconfig.spec.ts; tests/support/tsconfig.mjs; docs/environment.md; docs/superpowers/{readme-coverage,state,validation-targets}.md. The small shared fixture and related validation-target documentation are necessary scope support. No plan/ledger edits by implementer; controller owns updated ruling/checklist/gates.
