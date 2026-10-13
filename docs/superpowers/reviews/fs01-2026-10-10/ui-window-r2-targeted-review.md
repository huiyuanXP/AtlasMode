# FS01 UI R2 targeted independent review

Date: 2026-10-10. Reviewer: original R1 reviewer, existing explicit gpt-6.1-sol high; not the repair author. Scope: frozen R2 one-line product repair, actual-workspace transport regression tests, and appended production test candidates. Read-only SSH inspection; no source/test edits, test execution, build, DB, staging, or subagents.

**APPROVE — C0 / I0 / M0. R1's new epoch-navigation I1 is closed at source level.** The compiled production browser gate remains unrun, and FS01 remains PARTIAL. This is not whole-product acceptance or ticket DONE.

## Exact frozen basis

Freeze: `/tmp/atlas-fs01-ui-r2-freeze-20261010-1843`.

| Input | SHA256 |
| --- | --- |
| manifest.json | `10bd36560437a521171f902865370d472d4df7eaef4f335bf316da53e457182f` |
| source.sha256 | `98e0ff77666a742138bce3ade69c6053835ededd31380bc9184a485536cfa79e` |
| owned.patch | `2705bfcfc720e68fe81a3f3feaa7f893cc01f6e903fc9c37795a511e3eca035b` |
| after ownership-session.ts | `a6abc4a2dbf7be6bfd0da23724f1d5808495530db580838e7d49a4329186f5c5` |
| after workspace-ownership.test.ts | `ea5f192ca0641efbe8db958597aaaca8ad00449bb3ba0c0b003435d668b27c8f` |
| after tests/e2e/ownership.spec.ts | `c248c93efdb73eb1068fb3c98b1509359f1441615da47ab211f2b36b72800ade` |

Read full manifest and patch, relevant unchanged guards, added test fixture and three production candidates, README/receipt and raw evidence. Independently checked all three before/after file hashes against manifest at beginning and end. Byte reconstruction verifies after ownership-session.ts equals before with exactly one inserted `epoch: context!.epoch ?? 0,` line in browse's tray.load request; no other product bytes changed. All six original R1 frozen after files still match their original manifest. Original raw REQUEST_CHANGES report retained exactly with SHA `62ceb98f4565ade789b0988d61f4e831ab06a4f31802f1c25e81ac0f3a83000c`.

Independently asserted R2 production file retains its before (eight cases) as an exact byte prefix; that before equals the previous production-R1 after, which in turn retains the original six-case file as an exact byte prefix. Thus all three production additions are append-only and do not remove or relax prior scenarios. Review makes no new whole-original-product-manifest claim outside this narrow scope.

## I1 repair and authority boundaries

ownership-session.ts browse near line 321 now forwards the context epoch, matching setMode's root load. For normal actual open/selectProject epochs greater than zero, current child and parent tray requests now pass the existing strict requestCurrent authority comparison. Epoch remains an internal request authority token; HTTP scope payload continues to use real project URL plus snapshotId/path/kind/budget100/allowMissing, without inventing server epoch semantics.

Exact one-line byte reconstruction proves all surrounding R1 guards remain intact: requestCurrent requires observed current project/plan/snapshot/hash/epoch authority, exact project/SID/epoch and budget100; returned scope validation remains enforced by the controller. Expired intent remains terminal until fresh begin. choose and confirm still require current captured intent, current ready scope, real target membership and preview status; save completion remains guarded by generation and capture/CAS. The repair does not make old requests current, erase epoch comparisons, or weaken late reply handling.

## Added tests and preserved negative behavior

workspace-ownership.test.ts added `openedOwnershipFixture` creates the real workspace with a fetch transport double and activates via actual `openProject` or `selectProject`, not store initialization. Polling waits for real project loading completion; choosePlan/focus/setMode follow the actual methods. Parameterized positives assert root epoch >0, ready child and parent scopes with that identical epoch, exact snapshot-scoped budget100 HTTP scope bodies, fresh begin/target choice/confirm and real function domain ID plus complete destination filename and expectedRevision/expectedSnapshotId in the save request.

The additional held-child negative starts a real browse, reselects the same actual project/SID through selectProject to increment epoch, establishes the fresh root tray, then releases the older child response. Exact fresh tray equality, targetsReady true and zero PUT writes assert that old authority cannot overwrite new state. Existing late-response and scope/expired/capture tests are retained rather than replaced.

Read retained author RED: actual openProject epoch2 and selectProject epoch1 matching child scopes each fail as idle; earlier-epoch late-response negative passes; original nine workspace ownership tests are filtered/skipped only in this targeted RED invocation. Read retained final GREEN: 65 passed across session27/controller2/workspace24/workspace-ownership12, retaining original62 plus these three cases. Reviewer did not run tests.

## Production candidates: definitions only

Read all three appended candidates and shared setup/helpers:

1. A→B→A non-saving preview stays expired, retained filename/path survives, ordinary pointer clicks on disabled old target/save create no PUT or operations; explicit fresh begin then normal choose/save uses actual function ID and persists after reload.
2. Idle S0 tray is cleared after actual server refresh and UI verification. The test takes the actual post-verification summary SID rather than guessing the external refresh's SID, creates a fresh draft through UI, demands old tray hidden/no writes and a fresh current-SID scope before native drop/save, then checks CAS/full filename/domain ID and reload.
3. Real project selection followed by visible Browse child→parent→child verifies real HTTP scope SID/path/kind and enabled controls; ordinary mouse drag to the actual fact file target produces passive dragstart/drop observation, saved actual function ID/full destination path, revision2 and reload persistence. Scope bodies remain exact budget100 snapshot requests.

Existing pointerDrop uses page.mouse move/down/up; event listener only records native drag/drop, without constructing DataTransfer or dispatching events. Shared sourceReceipt/assertSource cover unchanged source bytes/paths and non-execution marker, external requests/page errors, and existing owned server PID/root/data/port/nonce plus finally cleanup. No API/store mutation substitutes for the native UI action in the new candidate paths. The three candidates add real functionality checks rather than hiding controls. They are **UNRUN**: source review cannot certify successful native drag, visible UI timing, compiled imports, HTTP save acceptance, cleanup, restart, or full legacy behavior.

## Raw receipts and limits

| Evidence under freeze/evidence | Observed author result | SHA256 |
| --- | --- | --- |
| atlas-fs01-ui-r2-epoch-red.log | 2 FAIL / 1 PASS / 9 filtered skips | `23e1a3b4bd6d7e0aa2a4374b1bb1086b6bf425eaff239d829150946d1718f141` |
| atlas-fs01-ui-r2-green.log | 65 PASS / four files | `f9466e432510e68d7e0484220e590c3980404d8e6cfce6ba852c55eec5ed23f2` |
| atlas-fs01-production-r2-list.log | Nine discovered cases; no execution | `ac98fdb16ff88d15b8f31a928c9d10afb34c344ce6a539999d9a317c95967fc2` |
| atlas-fs01-ui-r2-owned-types.log | Source-alias scoped --listFiles; author receipt exit0 | `a62a5dca4641c276d074eeb14f5346496ff2b444343ec33b97ca6def5be250ed` |

Read scoped source/test noEmit configs: source aliases reference actual core source and narrow web inputs/transitive imports; scoped file list contains no unfrozen overview-layout. Separate production spec noEmit includes actual test with DOM libs and shared imported helpers. Empty lint and production-type logs each SHA `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; exit0 is stated in the author receipt, not independently established merely from empty logs. Scoped source tests/typecheck/list are not ordinary full build or compiled/browser execution. Original failure report, RED source and logs, R1 six-file freeze and previous two-case production freeze remain retained.

## Next gate

No targeted blocking findings remain. Root may proceed with isolated compiled real-pointer acceptance including original six plus three appended cases, original approval/source/owned-restart invariants and current scope/capture hard boundaries. Any real browser failure must be recorded and diagnosed without weakening assertions or substituting mocked UI evidence. No FS01 DONE or remote CI success is claimed here. All R2 frozen SHA checks and original R1 frozen six-file checks remained exact at review end.
