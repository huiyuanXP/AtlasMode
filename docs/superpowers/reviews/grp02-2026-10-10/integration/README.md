# GRP-02 clean staged-tree integration receipt

Result: **PASS after authorized single-case test repair**. The independently archived staged tree `2d8a310d92ef222bd4505c294679c80af815d179` was tested with Node v24.19.0 / npm 11.9.0 from HEAD `fe4b52c191640913d192ca514164d972275531d1`. Archive: `/tmp/atlas-grp02-clean-20261010-8k6k_twz/workspace`. A fresh `npm ci` installed dependencies; no node_modules or shared dist were copied. Every build and runtime gate used this archive; no shared root build was run.

| Gate | Result (exit) | Duration | Evidence |
| --- | --- | --- | --- |
| `npm-ci` | PASS (0) | 8.696s | [raw log](npm-ci.log) |
| `build` | PASS (0) | 13.587s | [raw log](build.log) |
| `typecheck` | PASS (0) | 24.053s | [raw log](typecheck.log) |
| `lint` | PASS (0) | 3.236s | [raw log](lint.log) |
| `test` | PASS (0) | 62.764s | [raw log](test.log) |
| `smoke` | PASS (0) | 5.543s | [raw log](smoke.log) |
| `e2e` | FAIL (1) | 113.211s | [raw log](e2e.log) |
| `planning` complete scenario retest + scoped ESLint | PASS (0) | 23.304s | [raw log](planning-helper-final.log) |

Full-root unit summary: `{"filesPassed": 72, "testsPassed": 795}`. All output is retained in [test.log](test.log). The initial all-browser run was **18/19 PASS, 1 FAIL**, retained exactly in [e2e.log](e2e.log) and [Playwright raw JSON](playwright-results.json). Only the failed planning spec was adapted and rerun: **1/1 PASS**, retained in [planning log](planning-helper-final.log) and [raw JSON](planning-retest-results.json). These are separate runs, not a claimed single 19/19 full-suite pass. The parent explicitly authorized rerunning only this changed complete scenario without repeating the 18 unaffected cases or 795 unit tests. The existing >500KB web chunk warning remains informational.

## Legacy planning selector diagnosis and repair

The original `fact:<trueRelationId>` DOM route was absent after grouping; the projected `group-edge:fact:<sameId>:0` route had 99/99 actual unobstructed SVG samples. [Point records](planning-route-points.json), [raw diagnostic](planning-diagnostic.log), [screenshot](planning-routes-before.png), and [initial failure](initial-planning-failure.png) preserve the evidence. The helper searches the original route and every same-relation visual route, then retains SVG/elementFromPoint hit testing and a real mouse click. It checks Call evidence's original ID, endpoints and file:line, clicks the explicit Plan a change action, and keeps selected relation plus true-domain source/target form checks. A fact-reconnection target is intentionally blank in the existing editor; the test explicitly chooses the original A target before the original scenario reconnects to requestWithRetry. The adjacent visibility/name check now uses the existing exact data-domain-id CodeCard attribute and also checks source path. The whole approval/history/SDK/persistence/source scenario remains.

[Minimal approved test patch](planning-helper.patch) contains no product changes. [Attempt1](planning-helper-attempt1.log) documents the added evidence-to-plan transition; [attempt2](planning-helper-attempt2.log) preserves the incorrect added prefill assumption before correction; [attempt3](planning-helper-attempt3.log) reaches the final viewport check and exposes its same obsolete fact-only selector. Both requestWithRetry checks now use exact domainID while preserving visibility/name/path and viewport assertions. Failure traces remain in the isolated archive paths recorded in [receipt](receipt.json).

[Frozen input manifest](manifest.json), [gate commands/times/exit codes/log hashes](results.json), and [verification receipt](receipt.json) preserve reproducible inputs. After all gates and the planning retest, 15/15 production hashes matched the earlier freeze and archived sources. All original staged product/test blobs and the added repaired planning test match the tested archive. The final staged tree additionally contains the approved planning helper/locator change and integration documents/logs; its production blobs are identical to the original tested tree.

Only explicit GRP-02 products/tests/spec/plan/review and the parent-authorized single planning spec repair were staged. User AGENTS, IDX03/POL/KN/AG02 work, and root status documents were excluded. In particular, the index core/model remains only the approved collapsedGroupIds change; subsequent IDX03 working-tree fields were never added. No commit, push, deployment, source relocation, or plan execution was performed. Unloaded group neighbourhood remains unknown; PERF-02 remains the larger graph/layout boundary. Authority/state synchronization and final commit remain the parent task.

## Existing final planning screenshots

+The passing scenario's own screenshots were copied directly after its final 1/1 PASS; no browser rerun was used to produce them. [Desktop light](planning-final-desktop-light.png), [desktop dark](planning-final-desktop-dark.png), and [narrow viewport](planning-final-narrow.png) retain the final approved planning view. [SHA-256/source paths](planning-final-screenshots.json) and the original [joint-flow evidence](planning-final-joint-flow-evidence.json) are preserved. Source/test/Markdown/JSON whitespace checks pass; CLI log/patch bytes are intentionally unchanged, including emitted trailing whitespace and blank EOF lines.

Independent high limited review: **APPROVE, Critical 0 / Important 0 / Minor 0**. The [original reviewer report](planning-helper-independent-review.md) verifies the frozen final helper, actual route/hit-test/evidence transition, exact domain assertions, unchanged scenario and separate-run results.

## Committed remote CI receipt

Commit `6566717ee81981358e36caacb23f80157b0ee61d` [CI 38067062352](https://github.com/huiyuanXP/AtlasMode/actions/runs/38067062352) completed SUCCESS in all four jobs: browser, Linux, macOS and Windows. The browser job reports a single complete **19 passed (1.5m)** run. [Exact head/job results](remote-ci-38067062352.json) and [raw browser log](remote-browser-38067062352.log) preserve this separate remote receipt; the initial local 18/19 failure and single-case 1/1 retest above remain unchanged.
