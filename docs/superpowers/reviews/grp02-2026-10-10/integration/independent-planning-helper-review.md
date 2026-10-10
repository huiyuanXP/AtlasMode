# GRP-02 planning browser helper — independent limited review

Reviewer: `/root/ci_repair`, gpt-6.1-sol high. Date: 2026-10-10 UTC.

**APPROVE — Critical 0 / Important 0 / Minor 0.**

Scope is only the authorized change to `tests/e2e/planning.spec.mjs`: `clickEdge` resolves the same true relation through grouped visual routes, and the two adjacent requestWithRetry card locators use the existing exact domain identity. This is separate from KN-01 design review and from the broader GRP-02 product/design review.

## Frozen inputs checked

- Comparison baseline: `fe4b52c191640913d192ca514164d972275531d1`.
- Original clean tested tree: `2d8a310d92ef222bd4505c294679c80af815d179`.
- Clean archive: VM2 `/tmp/atlas-grp02-clean-20261010-8k6k_twz/workspace`.
- Repaired planning test SHA-256: `5efae9962c64c0a4ea01ddbf3aa39855da70cb5eca16b4949c75d408002fdeef`.
- I independently checked that the current VM2 file, staged blob and tested archive file match that hash. I read the full baseline diff and the stored `planning-helper.patch`.
- Evidence directory: VM2 `/home/agent/projects/AtlasMode/docs/superpowers/reviews/grp02-2026-10-10/integration/`.

## Findings and preserved behavior

The diagnostic records show the old exact `rf__edge-fact:<true relation ID>` route count was zero after grouping. The corresponding `rf__edge-group-edge:fact:<same true relation ID>:0` had 99 sampled SVG points and 99 unobstructed hits. I read the point records and original failure, and visually inspected `planning-routes-before.png`. This identifies an obsolete visual locator rather than a need to bypass an obstructing overlay.

The anchored, escaped selector accepts only the requested original route or numbered group routes of that same requested relation. The helper still samples SVG screen points and requires `document.elementFromPoint` to resolve to that edge before `page.mouse.click`. It does not use forced clicking, synthetic event dispatch, an arbitrary relation, or a longer timeout. I also evaluated just the literal selector expression for fact/plan IDs and IDs containing regex metacharacters; it correctly matched their own original/group routes.

Read-only inspection of group projection and Canvas confirmed group routes preserve the true relation domain ID and true source/target IDs. Grouped fact clicks open Call evidence; the test checks its original relation ID, caller/A endpoint names and evidence file:line, then clicks the explicit “Plan a change to this relation” action. It retains the exact Selected relation assertion and checks the true source ID in the form. The original target is explicitly selected and checked before the unchanged scenario reconnects to requestWithRetry. That explicit selection follows the current fact-reconnection editor contract and does not claim an automatic target prefill.

Both replaced node locators still target requestWithRetry's exact existing `data-domain-id`. Visibility, name and file-path checks remain, and the later viewport assertion remains. The complete diff contains no removal of planning scenario, HTTP/MCP/SDK, revision, approval/history, export, read-only source, target-not-executed, persistence/restart or viewport assertions. The existing 300ms documented navigation-transition wait and hit-test timeout were not extended.

## Actual evidence and limits

I read `planning-helper-final.log`, verified its SHA-256 against the receipt, and inspected `planning-retest-results.json`: expected 1, unexpected 0, skipped 0, flaky 0. Playwright reported **1/1 PASS, 19.6s** (scenario 17.2s); the receipt records **23.304s** for the command with scoped ESLint and exit 0. The log records real mouse clicks of `plan:new-call` and the grouped true fact relation. I visually inspected the final successful scenario's `desktop-light.png` from the tested archive.

The original clean full-root result was 795 tests /72 files PASS plus build/typecheck/lint/smoke PASS; the original whole browser run was **18/19 PASS, 1 FAIL**. The changed complete planning case was then separately repaired and rerun **1/1 PASS**. These are separate runs; this report does not claim a single 19/19 rerun. Production source hashes and compiled snapshot identity were independently verified by main and recorded in the integration receipt; this limited review does not repeat the product implementation review.

I did not edit tests or product sources, change the index, run Playwright/root gates, rebuild shared products, commit/push, or spawn an agent. The only new file I wrote is this explicitly requested local review artifact. Historical initial and attempt1/2/3 failures remain preserved in the author's integration evidence.

## Completed conclusion

APPROVE for the frozen narrow helper/locator patch above. Critical 0 / Important 0 / Minor 0. The repair follows the real grouped UI and preserves true domain identity and the original complete scenario assertions. No further repair is required within this limited review scope. Final integration and commit remain main's responsibility.
