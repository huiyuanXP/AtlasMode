# PERF-02 independent design review

Date: 2026-10-10 UTC. Reviewer: `/root/ci_repair`, explicitly assigned GPT-6.1-sol high; independent of the design author. Decision: **REQUEST_CHANGES**. Critical **0**, Important **2**, Minor **0**.

## Scope and frozen identity

Read-only full review of VM2 `/home/agent/projects/AtlasMode`:

| Document | Before SHA256 | After SHA256 |
| --- | --- | --- |
| `docs/superpowers/specs/2026-10-10-perf02-design.md` | `6a9fbbec9ea3eff885fb828896e78e6dd61bc60bb5f93ebfd07bf3a710bc85a8` | `6a9fbbec9ea3eff885fb828896e78e6dd61bc60bb5f93ebfd07bf3a710bc85a8` |
| `docs/superpowers/plans/2026-10-10-perf02.md` | `97653f4e6f39496ef8092ec36171314c16a0db0d27b11536d19dd6a3b340421c` | `97653f4e6f39496ef8092ec36171314c16a0db0d27b11536d19dd6a3b340421c` |

Compared the proposals with actual current core snapshot/plan types and validation, core bounded queries, server query facade/routes, service snapshot/view handling, web HTTP transport, ProjectScope, workspace load/saveView, graph projection, group projection, and Canvas projection/drag/funnel/measurement handling. Context HEAD was `c9b9206cb83f8bc440aa386140247b08a0eaa734`; these interface reads were from the working tree and are not represented as a frozen product implementation review. No product or target-document edits, tests, builds, stage/index changes, or agent spawning occurred. Only this local review artifact was written.

## I1 — The pre-projection budget does not bound base relations or plan-operation work

**Important.** Spec lines **99, 111**; plan lines **95, 99–102, 120**.

`estimateBaseVisualWork(...)` returns only `{nodes:number}`. The contract checks at most 500 unique visual nodes before calling `projectGraph`, and checks the 2000-route upper bound only after obtaining that base projection, before `projectGroups`. Actual plans have **no operation-count cap**: `packages/core/src/validation.ts:286` is `operations: z.array(operationSchema)`. Actual `apps/web/src/features/graph/projection.ts:67–89` traverses visible operations to collect references and produce each node's changes; lines 168–193 allocate an edge for every endpoint-present `add_relation` operation. The current move change calculation also uses `findLast` inside the per-operation changes scan at line 83.

A valid existing plan can therefore have two loaded fact endpoints and more than 2000 distinct `add_relation` operations. Its node count remains far below 500, so the proposed precheck permits `projectGraph` to create an over-budget base edge array before the later route check rejects it. A much larger operation list can also perform substantial synchronous projection work without increasing the node count. The initial rejection fallback described as a bounded base graph is not safe if it reuses this same already-expanded plan base. This is a static path demonstration from actual source; no runtime reproduction was performed in this review.

**Required narrow repair:** Extend the pre-`projectGraph` contract to account for base-edge upper bounds and bounded operation/projection work, with an explicit rejection outcome and truthful counts or upper-bound labels. Define how the estimator itself stops before excess scans or allocations. Preserve the stored plan, editor content, approval/history, and source; do not add a plan-schema cap, silently truncate operations, or change their meaning to solve a rendering budget. A rejected plan layer should use a genuinely bounded fact-only safe fallback, or a previously accepted safe same-project projection with accurate scope/status.

Add executable tests to Task 3/4 for two loaded endpoints plus 2001 visible planned relations, a large operation list that does not add nodes, filter-dependent visibility, rejection **before calling/allocating the enlarged base projection**, and a fallback that also remains within its budgets. These complement the existing 501-node and group-amplification fixtures rather than replacing them.

## I2 — Candidate and cell-entry limits do not bound collision work within a dense bucket

**Important.** Spec lines **80, 102–117**; plan lines **18, 81–84, 99–103**.

The proposed occupancy limits count candidate positions (32 per auto node / 160000 globally), cells per box (64), and stored cell entries (200000). They do not count bucket-element visits, rectangle comparisons, or manual-overlap diagnostic output. Cell buckets reduce typical work, but do not themselves prevent a large number of legal pins or retained boxes from occupying the same buckets. A candidate can examine many entries while consuming only one candidate probe. Discovering or reporting overlapping saved pins can likewise enumerate quadratic pairs while remaining within every specified candidate/entry limit. The local helper runs synchronously, so the worker's 1000ms termination cannot bound this local path.

The spec explicitly promises no all-placed-node quadratic collision traversal and finite work rejection, but the listed counters and boundary tests do not yet make that promise enforceable. The fixed Express/Flask timing trials are necessary future acceptance evidence; they do not replace concentrated-pin adversarial work tests. This is a design-budget gap, not a claim that a nonexistent implementation has already timed out.

**Required narrow repair:** Specify either an actual bounded bucket-density algorithm with a justified worst-case bound or explicit hard counters for bucket visits / rectangle comparisons, including pin insertion, retained-position reconciliation, candidate collision checks, and final geometry validation. Exhaustion must return a truthful work/geometry rejection before partial ready/apply/save. Define bounded manual-overlap diagnostics, for example affected pin IDs plus aggregate counts, rather than an unbounded list of pair records. Apply this protection to both global worker layout and synchronous visible layout; preserve all saved coordinates and keys on rejection.

Add deterministic dense/co-located and same-cell nonintersecting-pin fixtures at global and local limits, retained-auto versus new-pin cases, and assertions on the actual collision-work counters and diagnostic size. Boundary tests must show early rejection where necessary and no partial layout or view persistence. Numeric limits remain proposals until the existing real-target and DOM timing gates pass.

## Contracts that can remain as drafted

- Full target capture is appropriately snapshot-bound: `WorkspaceService.getSnapshot` already checks project ownership, summary already supplies `contentHash`, and the new query captures a single snapshot object. Exact raw node/relation coverage, external-node counts, null targets, strict minimal fields, byte limits and client validation prevent loaded graph unions or resolved-only sampling from being called complete. The 5000/20000 global limits distinguish the known Express minimum 3254 facts / 15216 raw relations from the 500-card visual limit. Exact external-node totals still require future receipts; their fit is not assumed.
- Iterative SCC and bounded ordering sweeps are appropriate to long-chain/cycle inputs. Raw unknown/external/contains facts remain counted without becoming resolved dependency constraints. Adjacency/SCC/condensation complexity is separated from sorting and placement. Source review must still inspect actual loops and structures at implementation time.
- The domain/visual identity distinction matches existing projection code. Group headers and shared aliases keep their own visual keys; the first ordered alias retains the current legacy canonical-position fallback; true function IDs/path/physical parent and original relation/evidence/ports remain unchanged. Groups must be estimated before mirror allocation, and rejected groups must not be silently collapsed or labelled successful.
- Saved positions, ephemeral auto positions and explicit visible reflow are distinct. Ordinary Canvas dragging currently updates one visual key; existing `saveView` captures a payload, uses the 250ms scope timer, and serializes writes. The proposed merge-at-apply and view/projection/measurement generations address stale closure overwrites while preserving hidden/opaque keys. The design explicitly leaves cross-tab server CAS outside the promise and does not claim existing last-writer-wins storage is transactional across tabs.
- Worker tokens, termination, unsupported outcome, exact current summary hash/snapshot validation, at-most-two-project cache, and late-result rejection have feasible injected-controller tests and separate compiled-browser gates. Local measurement corrections have separate generations and two-pass limits; camera changes do not trigger layout. Default auto results do not persist or alter Plan/review/source state.
- Existing funnel offsets/300ms paging, map actual-node scope, and accepted FS ownership gesture/dirty-state integration remain explicit regressions. Shared UI writes wait for main's accepted FS/GRP freeze and owner windows. Current historical FS status text is not used as evidence of accepted implementation.
- The plan's isolated source-level HTTP fixtures, compiled worker/browser gate, fixed Express/Flask/Vite targets, geometry/evidence hit tests, restart/manual-position restoration and identity/source/approval invariants are executable future acceptance categories. No timing, geometry, worker packaging, new query or product capability has been demonstrated by this document review. The 250ms compute / 1000ms roundtrip / 120ms local targets remain unmeasured proposals; failed medium-project readiness must leave PERF-02 incomplete.

## Necessary next step and implementation boundary

Repair only I1/I2 in these two documents, retain their passed scope/identity/persistence contracts, and freeze new hashes for limited independent re-review. Window A may be authorized only after the design's failed hard-budget conditions are resolved. Subsequent helper, HTTP, shared-UI and compiled real-target reviews remain separate gates. Design approval or query/helper success cannot mark PERF-02 DONE.

## Actual interface context fingerprints

These fingerprints identify the interfaces read for this review; they are not author implementation receipts:

| Path | SHA256 |
| --- | --- |
| `packages/core/src/validation.ts` | `b31bc79d37d2fd0cc7ffaff8f5ae2fb3fb6adf5e7caa98e2d8913ca6a7374874` |
| `packages/core/src/queries.ts` | `4de37d4b8a217a97e507c605237803e87eb7a5a51925895fe9506ba9e8c5525e` |
| `apps/web/src/features/graph/projection.ts` | `464155e6b8831a8057e013b31997e98a48d5b56e45d0ab37811386c545e5b303` |
| `apps/web/src/features/groups/projection.ts` | `027249184becc3af2187519ac55c5700302202f16ee89ad7d57e4d94dea60f67` |
| `apps/web/src/app/workspace.ts` | `e72c07659be63c95663b560abe1b397183341c3e34707b8c61d7a7eb8a22624d` |
| `packages/service/src/knowledge.ts` | `8f07eda48aafb1992411d0709ebeae7b7f65c0be01a6b5cbd59700b9fcf93c4d` |
| `packages/service/src/workspace.ts` | `8bb16ae173684e60c0c6f73e33caab163a133b645908b8b08213e93d0c28f8a9` |
| `apps/web/src/api/client.ts` | `d5bbe93903474b85cb70e314fbbe610f8c04071095dc0e1ff0c0740fef66bd29` |
| `apps/web/src/features/graph/Canvas.tsx` | `b455d3614c69a04d03b4e64c76fa674afd10cab3f111947ef4e42df819c407e2` |
