# PERF02 Task4 Window C — limited independent R2 closure review

2026-10-11 UTC. Independent reviewer, unchanged gpt-6.1-sol/high contract, no descendants. **REQUEST_CHANGES: C0 / remaining I1 / M0.** Remaining Important is the unclosed portion of original R1 I2, not a new helper/Task5 review.

## Frozen scope and evidence

Reviewed only R1 I1/I2/I3/M1 required fixes in evidence/review-package-r2. Read its README, repair notes, R1-to-R2 production/test changes and final gate configuration/receipts. The repair-matrix.md lists the four intended fixes; substantive caller/regression detail is in canvas-r1-repair-notes.md. No source or prior evidence changed.

Independent source probe evidence/task4-independent-r2-probe.log verifies workspace and frozen R2 copy **41/41** SHA pairs against source-manifest.json and all **14 accepted prior files unchanged**, including their R1 frozen copies. R1 original report remains SHA25618eca41f5a47bca5e9a2d46864f3f8fe74a540a942408b3cfdf438e052c0be0b.

Reviewed author final receipt: **19 files/220 tests passing, no skips**, including store23/session37/Canvas SSR5. Frozen run-task4-gates.sh sequences targeted tests, web-production+owned3tests noEmit, core/server noEmit and16modified-file lint and propagates failure codes. Corresponding type/lint logs are empty and parent confirms exit0. These remain author receipts; independent verification used the installed Node/tsx source aliases with cache disabled, controlled in-memory stores and pure helpers. No full-root gate/build/DOM/production Worker/performance/target execution ran.

## Itemized closure

| R1 finding | R2 outcome | Evidence |
|---|---|---|
| I1 stale measurement cache | **CLOSED** | Canvas.tsx:461 binds exact rawProjection and projectionGeneration; producer guard rejects obsolete callbacks before/inside state update. overview-session.ts:250 checks all frame identity fields and :380 performs the actual Canvas completion path. Old effect tokens are screened at Canvas.tsx:632. Independent probe old frame returns pending with no save/adopt, fresh300x600 dimensions return ready with second-card y648. Author caller/frame/token RED→GREEN regressions cover reused IDs and obsolete tokens. |
| I2 live final veto and capture invalidation | **PARTIALLY CLOSED; Important remains** | Authoritative undefined is respected by overview-session.ts:268; completeOverviewJob reads authority before measurement and immediately before apply/save. Current ownership/dirty/draft/project-loading/funnel/selection vetoes and their transitions invalidate captures. Independent dirty and project-loading probes confirm refusal. However pending funnel is omitted from the current store gate and transition generation; see residual below. |
| I3 compact retention across refresh | **CLOSED** | Canvas.tsx:461 separates scope identity from snapshot/measurement freshness; :597 supplies only current survivors from CompactOverviewCache. Cache max2projects/bounded500positions and exact-snapshot current display are implemented at overview-session.ts:325. Independent new-snapshot/addfact00 probe preserves existing fact:1 y128, excludes removed keys and does not show old snapshot as current. Same-snapshot changed global result drops retained inputs for explicit recompute; visible explicit reflow still ignores current visual pins/retained through accepted helper semantics. |
| M1 route upper bound labeled exact | **CLOSED** | Canvas.tsx:1339 labels card counts separately from route upper bounds/not-yet-generated and early route-estimate subtotals. New zh/en strings and SSR group-work regression assert conservative upper bound241, without an exact visual-count claim. |

## Remaining original I2 — funnel loading is not an authoritative veto

Precise locations: apps/web/src/app/workspace.ts:378–393 and :2518–2522; apps/web/src/app/WorkspacePanels.tsx:392; apps/web/src/features/graph/Canvas.tsx:633–644.

WorkspacePanels derives funnelPending from state.busy.funnel and Canvas deliberately treats that flag as blocked. However captureLayout checks busy.project and an already entered state.funnel, but not busy.funnel. stopOverviewScope likewise watches busy.project transitions but not busy.funnel. Thus starting a funnel request before new props reach Canvas leaves the authoritative capture available and unchanged. The repaired completeOverviewFrame still trusts the capture plus last rendered funnelPending=false, so both its live reads authorize adoption. This is the same final-current-state gap identified in R1 I2, narrowed to one accepted blocker.

Minimal executable source reproduction in task4-independent-r2-probe.log:
1. Capture an eligible current job.
2. Set the controlled store to busy.funnel=true, matching the production pending-funnel state while simulating the previous rendered props.
3. Read through the actual app.captureLayout callback: capture remains current and available.
4. Complete the frame through the actual Canvas completion helper with previous blocked=false: result is ready and apply executes once.

Observed log: captureStillCurrent=true, funnelBusy=true, currentCaptureAvailable=true; completion status=ready/applies=1. No real DOM timing claim is made. The defect is established by the authoritative state/caller path; real browser coverage remains Task5.

Impact: queued overview completion or explicit saved reflow can still apply while the user is entering the protected funnel interaction. The next React render can disable buttons/cancel jobs, but that is exactly the stale-props window the R1 repair must close.

Required limited fix: include current busy.funnel in captureLayout's veto and invalidate captures when that pending state changes, so a pending→finished interval cannot revive an old job. Add one source store/caller regression for pending funnel before the next props render, and preserve ordinary funnel offsets/dragging and original semantics. Re-freeze the minimal change, run affected source regressions/checks and limited closure review; no Task5 run is required to repair this source gate.

## Declined to judge / preserved boundaries

- Accepted Task1/2/3 algorithms and helper geometry were not reopened; exact prior14 preservation was verified.
- Production Worker assets, real DOM/effect timing/pointer interactions, restart persistence, pinned Express/Flask/Vite, p95/local120ms and whole PERF02 acceptance remain Task5 **NOT RUN**.
- Cross-tab CAS, other tickets/checkouts, full-root/build/commit/push/merge/deploy remain outside review.
- No Task5-only evidence gap is treated as an additional Task4 blocker.

## Assessment

**REQUEST_CHANGES for this frozen R2** solely because original I2 is not fully closed. I1/I3/M1 are closed and should stay closed during the narrowly targeted pending-funnel repair. No new Critical or Minor finding arose. Task4 is not yet independently approved; PERF02 stays TODO and Task5 NOT RUN. Original R1 report/probe artifacts are preserved.
