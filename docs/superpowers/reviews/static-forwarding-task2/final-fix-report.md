# One combined final fix wave: M1/M3

Base `c608fdc186832d74d54817eb343fe7d8c6d5c19f`; amended commit SHA pending controller.
M1/M3 repaired in one wave, source frozen; final root/browser checks passed. One scoped review
and residual controller rulings pending; full-goal remains PARTIAL.
No product, API/schema/hash, dependencies/lock/vendor, analyzer/validator or other tests changed.
No helper agents, commits/pushes or target execution. No Express rerun. Old reports/evidence/hashes
remain historical and unchanged; new receipts use unique `final-fix-*` paths.

## M1: sentinel on the actual chain

`tests/support/forwarding.mjs` now prepends the same marker-writing top-level statement to actual
entry.cjs, index.cjs, barrel.cjs and both leaf modules. Existing disconnected scanner sentinel stays.
The statement appears on first line: entry function and both leaf declarations still line2 with
unchanged function/source snippets. Each forwarder retains exactly one module.exports=require
relative literal write; sentinel introduces no other exports write or mutable namespace. Redirect
changes only barrel target from leaf-a to already-present leaf-b and retains the identical sentinel.
Thus requiring/calling the real chain would create the shared marker; the fixtures are only read as
capture bytes, never executed to demonstrate this. Existing assertNotExecuted now covers traversal
and either leaf directly, along with scanner sentinel.

Focused verification: `npx vitest run tests/integration/forwarding-resolution.test.ts`, command
20:03:03.620Z–20:03:07.723Z, exit0, **1/1 PASS**, runner3.46s/test3.08s, start20:03:04 UTC.
Real compiled HTTP/SDK/SQLite verifies exact real leaf context/physical import, line2, stable IDs/
all unchanged bytes through barrel-only refresh, stale plan/route, immutable approval/history,
actual SQLite reopening, empty protocol errors/stderr, marker absence and owned process/temp
cleanup. Actual target runtime code was not invoked. Final source frozen before controller checks;
clock confirmation20:04:34 UTC. Helper SHA256:
`6c6271ebdcafa36bfe5a614ad49afa5400c6faee06076926fc0a4ecaec765150`.

## M3: current handoff and plan

State first latestauthorization now describes reviewed Task2 PARTIAL checkpointc608fdc and current
single M1/M3 repair/scoped-review pending. README links new Task2 handoff README instead of old
Task1 archive and records task/whole checkpoint review. Plan active summary records Task2 reviewed
partial status; steps1/2/4 checked, step3 executedFAILED and still unchecked, step5 task/whole
checkpoint reviews recorded but repair/scoped review/rulings pending. Old Current push checkpoint
heading renamed Historical Task1, original stage body unchanged. Prior implementation report/state
candidate section kept historical. No claim whole-plan goal achieved, fullExpress/runtime support
or all unresolved findings repaired.

## Preserved residuals and verification scope

M2 first failed fixture REDrawreceipt was overwritten in original run; disclosure remains, no
fabricated reconstruction. Important Express still exported=false/absent actual34/34 entries and
original new gate had no PNG; original genericPASS/entryFAIL preserved with no rerun. Historical
unexplained shutdown cause gap remains Important, hostcolorMinor persists. Client/interactive
Windows Ctrl+C/freshrestore/Task2remoteCI and missing old ignoredimages remain explicit limits.

Controller chose final rootlint/test after fixture-data change, preserving existing successful
seven-workspace build/typecheck evidence because product/types/compiled tree is unchanged. No
unnecessary rebuild repetition. After controller root completes, only forwarding browser case will
run for changed fixture bytes; old CommonJS/Express/Vite/Flask/other browser not repeated.
Final `npm run lint` and `npm test` both exit0; **541/31 PASS**, no skips/failures,
tests start20:04:34 UTC,40.38s runner. Controller owns unique root rawlogs. After root complete,
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test tests/e2e/forwarding.spec.ts
--output artifacts/static-forwarding-final-fix/browser-results`: command20:06:05.998Z–20:06:12.195Z,
exit0, **1 PASS**,4.0s test/5.3s runner. Exact Playwright stats and wrapper times in
final-fix-receipt.json. Actual final3 screenshots viewed; source/line2/original Chinese text readable,
both clipboard locations verified, unsafe reason visible. Deliberate externalprobe was blocked with
ERR_BLOCKED_BY_CLIENT, zero unexpected external requests, errors/protocolerrors empty, MCPstderr
empty and marker absent. Host NO_COLOR/FORCE_COLOR warning persists. No product/runtime execution.

`git diff --check` exit0. Helper newhash above unchanged after freeze; five other reviewed codehashes
match original receipt. No new integration/browser test-code changes. New final-fix-integration/
browser logs, final-fix-receipt.json and final-fix-screenshots.tar.gz are distinct from old immutable
archives; current ignored screenshot paths were refreshed by existing browser harness, their older
archived screenshots.tar.gz retained. M2 raw loss is not remedied. Controller commitSHA still pending,
no source edits after freeze. Ready for the ONE scoped review; no whole-plan completion claim.
