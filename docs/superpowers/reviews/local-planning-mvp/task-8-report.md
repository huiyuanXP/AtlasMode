# T08 implementation and acceptance report

Status: implementation complete; controller independent T08 and whole-branch review pending.
Original task base: `d3a3b152b3f4f463ab6a97a478140151a8e48031`.
Recovery HEAD: `2c1b474` (intervening controller documentation commits preserved).
T08 implementation commit: `5b22868fdd11e0a8d599b2ba5494a51addd51c49`.
Environment: `/workspace/AtlasMode`, Linux, UTC 2026-10-03.

## Recovery and scope

The original worker disappeared at environment reconnection. Read task-8-brief first,
then both context files, AGENTS, local Superpowers startup/verification/execution
instructions, cloud runtime/networking and setup/onboarding references. Preserved
all uncommitted implementation and ignored artifacts. No reset, clean, checkout
recreation, subagents, push, publication or global client configuration edits.

Runtime status initially returned configuration-changed; its requested retry returned
connected/running, observations_current=true, network policy restricted with
package_managers preset but state=unknown. No secrets, variables or identities were
required. `/etc/codex/network-policy.json` version1, vpn_configured=false. Preserved
proxy/CA trust. No unsupported network readiness or new official Chromium download claim.
Controller owns cloud draft, bundle, subsequent tsconfig docs and independent reviews.

## Final changes

- Added real production process support, a browser acceptance test, smoke script,
  fixed-repository product validator, Playwright config and root scripts.
- CI matrix config: Ubuntu/Windows/macOS npmci, build, types, lint, tests, smoke;
  Linux browser job installs official Chromium/dependencies and uploads artifacts.
  Build precedes tests because integration starts compiled MCP/HTTP entries.
- Portable shutdown tests invoke installed production handlers through a test-only
  preload+IPC bridge in actual processes. Unix retains additional actual SIGTERM
  checks. Production contains no IPC backdoor. Assertions retain exit0, HTTP gone,
  committed SQLite and child-reaping behavior. Windows native Ctrl+C remains unrun.
- M2: stalled response body now reports API_TIMEOUT after the actual30s deadline
  instead of API_INVALID_RESPONSE. Lifecycle cancellation remains distinct.
- M3: cached client help and snapshot mismatch messages store keys and render in
  current locale; backend diagnostics stay verbatim.
- Observed real UI reconnect defect: candidates had only current bounded graph
  functions. Now include current-snapshot loaded entry/search facts, deduplicate,
  reject stale result snapshots, and render referenced off-graph facts as readable
  anchors. Does not fetch the full repository graph or weaken service validation.
- README retains product requirements and adds honest current status/check order.
  Added docs/environment.md; rewrote explicit PASS/PARTIAL/UNIMPLEMENTED coverage;
  updated state and fixed-repository statistics with limits and follow-up tickets.

## Current clean local commands and exact outcomes

Commands executed from `/workspace/AtlasMode`. Shell log capture used `set -o pipefail`
and `2>&1 | tee <log>` so tool exit codes are underlying outcomes, not tee success.

| Command | Exit / outcome | Log basename in this directory |
| --- | --- | --- |
| `npm ci --cache /tmp/atlasmode-npm-cache` | 0; added410 packages in5s; lockfile unchanged | task-8-clean-install.log |
| `npm run build` | 0; all7workspaces; Vite215modules, build2.13s | task-8-clean-build.log |
| `npm run typecheck` | 0; dependency builds and explicit noEmit checks for all7workspaces | task-8-clean-types.log |
| `npm run lint` | 0, no diagnostics | task-8-clean-lint.log |
| `npm test` | 0; 200passed/20files; 0failed/0skipped; start00:44:44,40.01s | task-8-clean-tests.log |
| `npm run smoke` | 0; production assets + TS/Python HTTP/SDK browsing + no target execution + persistent restart | task-8-clean-smoke.log |
| `sha256sum --check docs/superpowers/vendor.sha256` | 0;74 vendored skill files + license75OK | task-8-vendor.log |
| `git diff --check` | 0, no whitespace errors | tool output |

Node24.19.0, npm11.9.0, Python3.12.14, TypeScript5.9.3, AtlasMode build Vite7.3.6,
Playwright1.63.0, Debian Chromium151.0.7922.173, MCP SDK1.32.0.
After checks only docs and prettier formatting of validator changed; validator-specific
eslint and git diff check passed again. No behavioral source edits after clean tests.
No unchanged full suite or joint browser rerun solely for context recovery.

## Preserved RED/GREEN and harness diagnosis

These are original-worker results read from surviving logs, not tests newly rerun
by the recovery worker. Current full200test pass above covers the final source.

- task-8-red.log: real30s MCP stalled-body test failed (API_INVALID_RESPONSE vs
  API_TIMEOUT), plus2 initial locale-test failures. Initial locale SSR setup was
  corrected before drawing the product conclusion.
- task-8-locale-red.log is the meaningful M3 RED:2failed/2passed, original backend
  text persisted but conflict help remained Chinese after English change; member
  snapshot mismatch remained hardcoded English.
- task-8-minor-green.log:21passed/4files,30.24s, actual30s timeout; M2/M3 addressed.
  task-8-locale-current.log: final locale/candidate checks6passed/2files.
- task-8-portable.log:10passed/2files,4.23s, actual CLI/dev portable-handler and
  POSIX signal coverage. This is not Windows execution evidence.
- task-8-browser-2.log: realUI could not choose requestWithRetry after expansion,
  because target select had no option. task-8-candidates-red.log: required candidate
  function missing,1failed. task-8-anchor-red.log: expected readable off-graph
  reference missing,1failed/5passed. task-8-candidates-green.log:7passed/2files.
- Other early browser failures were harness defects and were not hidden: initial
  wrong node data-id (`spare` vs `plan:spare`), edge hit-test before250ms focus
  transition, and stopping before async theme save completed. Current harness uses
  actual edge path midpoint interaction, correct DOM ids, theme persistence polls.
- task-8-browser-5.log reached all behavior but failed empty MCP stderr because
  Playwright FORCE_COLOR conflicted with inherited NO_COLOR. Test helper preserves
  NO_COLOR and removes only conflicting FORCE_COLOR in child environment; no stderr
  filtering, production logging change or general warning suppression.
- Earlier target runs failed incorrect locator/tag assumptions and pagination/busy
  timing. Final target runner uses real search responses, pages through results,
  selects exact source path, and waits for focused card/idle state.

## Browser joint acceptance (preserved final run)

`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` is the reproducible
entry point. Latest actual result in `artifacts/e2e/results.json` starts
2026-10-03T00:23:03.397Z, duration11306.933ms; expected1, unexpected0, skipped0, flaky0.
task-8-browser-knowledge.log reports test10.3s, total11.3s PASS. Earlier PASS in
task-8-browser-6.log is superseded by this knowledge-invalidation-expanded run.

Test path: `tests/e2e/planning.spec.mjs`. Actual production HTTP+SQLite+indexer,
compiled web, real Chromium, actual SDK client with compiled stdio server.
The same process is stopped then started on same port/data directory, not mocked.

Observed steps: TS open/entry/source/call context; actual navigator.clipboard.readText;
expand/search; MCP group/call_chain/walkthrough/plan; UI shared membership and policy;
temporary edge→existing requestWithRetry; spare helper removal; undo/redo; target
services/notes.ts; annotation; real caller→A fact edge removal plus caller→B plan;
validate/approve; forbidden directory causes issue+new revision+invalid approval;
policy repair/purpose edit, reapprove; real layout drag leaves full plan detail equal;
title semantic edit creates revision/invalidates; reapprove; JSON/Markdown download;
UI/MCP exact approved detail equality; dark/narrow/restart/theme/group persistence;
modify fixture source after approval; real satisfied/unmet/unknown checks; stale
route disabled; Python source/expand; empty plan selection; project switch back.

Final actual approval (resume note revision14 was stale; actual file is authoritative):

- planId `9a10011d-63b8-4d3d-a427-c80fc0b6d8ff`, revision16.
- semanticHash `0e88b0efc9dc331316ff36d5795a53a675189eabb2a07e51510db7d2868bd3a8`.
- approvedAt `2026-10-03T00:23:11.156Z`, actor user.
- JSON3356bytes, Markdown3544bytes, actual downloaded content checked.
- Implemented source:4 satisfied, annotation unknown/human review. Deliberate A()
  bypass:1unmet with source evidence. Dynamic fn():unknown with source evidence.
- errors[], external[]; non-loopback browser requests denied, loopback allowed.
  Does not claim machine-wide network isolation or client model offline operation.

Evidence: `artifacts/e2e/joint-flow-evidence.json`, results.json, source.png,
desktop-light.png, desktop-dark.png, narrow.png. Recovery worker actually inspected
all4images; light/dark settled, r16 approval/hash and readable requestWithRetry anchor;
source/call details readable;760px narrow places editor beneath canvas. Parent also
actually inspected settled dark. Long source uses horizontal scrolling; narrow
overview requires zoom for small graph text. No image was synthesized or edited.

## Fixed mature repository product validation

Original actual product runs passed at00:20 with Vite4649ms/Flask1733ms, but screenshots
showed tiny80node overview and Vite Working footer. Current validator contained newer
focus/width>200/idle assertions that lacked matching evidence after interruption.
Parent explicitly requested resolving this named visual gap. Preserved original
JSON/PNG in `artifacts/validation/prior-captures/`; reran changed product harness for
this concern only. Did not rerun standalone indexer benchmark for new counts.

Exact commands (each prefixed `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`):

```sh
npm run validate:repository -- --path /tmp/atlasmode-validation-vite --commit 10033218d239c927cdc375970b5741cce408e81b --symbol createServer --file packages/vite/src/node/server/index.ts --label vite
npm run validate:repository -- --path /tmp/atlasmode-validation-flask --commit 22d924701a6ae2e4cd01e9a15bbaf3946094af65 --symbol render_template --file src/flask/templating.py --label flask
```

Both exit0; logs task-8-vite-settled.log/task-8-flask-settled.log.

| Target | Final evidence time UTC | Open | Files / function-kind / relations | Calls resolved / external / unresolved |
| --- | --- | --- | --- | --- |
| Vite8.3.2 at10033218d239c927cdc375970b5741cce408e81b | 00:45:36.031 | 4651ms | 1583 /8117 /44263 | 5373 /10443 /14435 |
| Flask3.1.3 at22d924701a6ae2e4cd01e9a15bbaf3946094af65 | 00:45:47.279 | 1740ms | 83 /1574 /6281 | 714 /1026 /2176 |

Whole supported checkout source scope, with complete coverage lists in JSON. Target
code and upstream tests never executed, no target checkout/database copied into Git.
Function-kind includes methods/classes and is not a runtime function census.
Vite7diagnostics=5excluded symlinks+2intentional syntax-error fixtures; Flask0.
Entrypoints762/556, first50 clipped. Vite search143hits required UI paging; Flask5.
MCP context limit5 per direction; depth1 budget80 expansions Vite80nodes240relations,
Flask80nodes136relations, both truncated. Budget1/depth2 explicitly truncated.
Sample source files/line windows507–511 and139–151 read through actual HTTP; every
sample outgoing evidence line resolved to nonblank real source. MCP has locations
and call evidence, no invented read_source tool. Summary exactly matched HTTP.
errors[], external[], MCP stderr empty. Unsupported/dynamic/alias analysis remains
unknown; complete tsconfig paths/workspace export resolution is subsequent work.

Final `artifacts/validation/{vite,flask}-product.{json,png}` actually inspected by
recovery worker AND parent: selected createServer/render_template normal-size,
readable card, source/call details and idle footer. Large neighborhoods still require
pan/zoom; captures honestly show bounded context, not entire graph at legible scale.

## Brief checklist and self-review

- Browser failing evidence pins actual reconnect defect; final complete flow passes.
- Python, route types/stale, groups/policies, history, locale/theme/project switch,
  native browser clipboard, actual service restart all executed as described.
- Desktop/dark/narrow/source/target screenshots actually viewed; console/external empty.
- Three-OS CI configured with preserved command outcomes; native runners not claimed.
- Two fixed mature source targets actually exercised through product HTTP/UI/MCP.
- Clean local CI commands, real production process smoke and SDK transport executed.
- Environment, README, state, coverage and target docs updated with explicit gaps.
- Author self-reviewed all final diffs/untracked files: only bounded UI candidate
  projection, locale rendering, MCP timeout and test infrastructure changes; no
  architectural refactor, duplicate service rules or target source mutations.
- Root lockfile unchanged; no DB/cache/node_modules/target copies/credentials staged.
- Test fixtures/servers self-cleaned; final process inspection found no live
  apps/server, apps/mcp, dev or atlas smoke/target/e2e processes. No matching temp
  fixture directories remained. Existing adopted zombie Chromium entries are not
  live services and cannot be reaped by this worker; no unrelated processes killed.

## Limits / next owner

No native Windows/macOS execution, Windows Ctrl+C probe, remote CI, official browser
CDN success, actual Codex/Claude client connection/catalog discovery, publication,
push, new-task restore or remote reproducibility claim. The Linux browser uses the
explicit system executable override. Self-review is not independent review.

docs/superpowers/readme-coverage.md explicitly preserves README gaps: tsconfig/
workspace/CommonJS resolution, independent annotation/rebinding, knowledge migration
and backups, structure.json atomic read/write/audit, full group member editing/
collapse, ownership drag/preview, identity migration and general index differences,
advanced sequence/wrapper, incremental indexing/automatic layout and runtime truth.
Controller continues independent T08+whole-branch reviews, cloud configuration and
future tickets until user wraps up. Local commit only.

## T08 review fix round1 — I1 preload file URLs

FIX_BASE `5b22868fdd11e0a8d599b2ba5494a51addd51c49`.
Fix commit: `24a6d760fe7c4bfb1c80cd7a0fcc7495fb7cfa45`. Independent scoped re-review pending.
Read task-8-review.md Important I1 verbatim and applied only this Important issue.
Reviewer minor M1 (target HEAD without dirty-worktree guard) is controller ledgerM4,
explicitly deferred to final whole-branch triage; not included in this fix.

All three `--import` preload arguments now use
`pathToFileURL(resolve("tests/support/graceful-preload.mjs")).href`, with explicit
`node:url` imports in tests/support/production.mjs and server dev/index tests.
Ordinary filesystem paths remain for executable entry arguments. Production code,
protocol, CI job shape, target validator and browser flow were not changed.

Added tests/integration/preload-loader.test.ts: real Node subprocess imports the
actual production helper, with its cwd set to a temporary checkout path containing
both spaces and `#`; copied compiled server entry and actual preload, linked installed
dependencies. Real HTTP health succeeds, then the actual installed handler stops
cleanly through the shared helper. No mocks, source-text assertions or Windows
platform spoofing. A raw preload path interprets `#` as a fragment on Linux; Windows
raw drive path treats `C:` as an unsupported scheme. Both need the same URL conversion.

Exact focused results (log basenames in this report directory):

- Initial `npm test -- tests/integration/preload-loader.test.ts`: exit1,
  1failed,381ms; raw path truncated at `#`, ERR_MODULE_NOT_FOUND.
  task-8-i1-red.log.
- After three URL fixes, `npm test -- tests/integration/preload-loader.test.ts
  apps/server/src/dev.test.ts apps/server/src/index.test.ts`: exit1 overall,
  existing CLI/dev10passed/2files, new fixture1failed,4.30s.
  task-8-i1-green.log (name does not imply success). The fixture initially symlinked
  apps, which correctly did not satisfy the server main-module identity guard;
  preload no longer errored. Replaced that fixture symlink with a copied compiled
  server entry and dependency junction; no product change for this fixture issue.
- Corrected fixture `npm test -- tests/integration/preload-loader.test.ts`:
  exit0,1passed,824ms, task-8-i1-loader-green.log.
- Explicit mutation check with final fixture: temporarily replaced only shared
  helper file-URL conversion with original raw resolve, ran same focused command,
  restored exact source in finally. Actual exit1,1failed,375ms,
  ERR_MODULE_NOT_FOUND at '/tmp/atlas preload ' before startup;
  task-8-i1-loader-red.log. Underlying exit1 propagated, not masked.
- Final restored `npm test -- tests/integration/preload-loader.test.ts`: exit0,
  1passed/1file,0skipped,932ms, start01:03:56 UTC;
  task-8-i1-loader-final.log. The unchanged10 CLI/dev passes above remain valid.
- `npm run smoke`: exit0; production assets + TS/Python HTTP/SDK browsing + no
  target execution + persistent restart; task-8-i1-smoke.log.
- `npm run typecheck -w @codemap/server`: exit0; task-8-i1-types.log.
  The server project excludes tests, so explicitly checked all affected TS tests:
  `node node_modules/typescript/bin/tsc --noEmit --target ES2023 --module NodeNext
  --moduleResolution NodeNext --strict --noUncheckedIndexedAccess --esModuleInterop
  --skipLibCheck --types node tests/integration/preload-loader.test.ts
  apps/server/src/dev.test.ts apps/server/src/index.test.ts`: exit0/no diagnostics;
  task-8-i1-test-types.log.
- `node node_modules/eslint/bin/eslint.js tests/integration/preload-loader.test.ts
  tests/support/production.mjs apps/server/src/dev.test.ts apps/server/src/index.test.ts`:
  exit0/no diagnostics; task-8-i1-lint.log.
- `node --check tests/support/production.mjs`, prettier check of the four changed
  files and `git diff --check`: exit0; formatter reported all matched files conform.

Self-reviewed exact diff: three loader conversions plus one real-process regression;
all program-entry paths unchanged, no production backdoor. Final own-process and
fixture-directory inspection found none remaining. No unchanged full-suite, browser,
public-target or network reruns. Earlier full suite remains200passed at the pre-fix
commit; no unsupported201-test full-suite claim. Native Windows/macOS remain unrun.
