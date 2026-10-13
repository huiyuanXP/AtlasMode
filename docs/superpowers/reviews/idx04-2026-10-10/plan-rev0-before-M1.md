# IDX-04 Identity Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after main grants product ownership windows. Steps use checkbox syntax. Current authorization is design documents only; do not start implementation, tests, builds, staging, commits or spawn.

**Goal:** Offer captured exact-evidence rename/move candidates, require explicit user acceptance, and optionally rebind individually selected orphan notes without changing immutable source facts or historical approvals.

**Architecture:** Optional versioned evidence lives in new snapshots; a pure bounded matcher produces candidates. A separate service persists immutable snapshot-pair mappings and atomically applies only selected KN01 note rebinds. Existing fact IDs/calls, FS01 intent and approved verification stay independent.

**Tech Stack:** Existing Node24/npm workspaces, TypeScript5.9.3/ts-morph27, Python stdlib AST parser, Zod, existing synchronous SQLite StoragePort, React and Playwright. No new dependency or target execution.

**Spec:** docs/superpowers/specs/2026-10-10-idx04-design.md

## Global Constraints

- This round owns only spec/plan/ledger; actual product interfaces and build/review windows require main coordination. User autonomous execution exception avoids repeated human-stage prompts, not ownership conflicts.
- Preserve makeId/Graph.edge identity inputs and immutable old snapshots/approval/context/route records; no global alias/fuzzy binding/source moves/writes or DIFF01 rebase.
- Evidence normalizerVersion1/algorithm sha256-exact-v1; ≤20000 entries/16MiB serialized UTF-8; preview≤256 characters with truncation and no split surrogate.
- Query≤50000 fact inspections/20000 evidence comparisons; pages default20/max50; entire serialized response≤64KiB; full relative paths≤2048; only complete comparison can report total/unique/none.
- Accept pairs≤20, selected notes≤20; transaction rechecks current snapshot/hash/ledger/note revisions, one-to-one, exact eligibility; unknown/none/retained rejected. No async critical path.
- KN orphan lock/explicit target guards remain; no-note accept leaves knowledge/plan semantic state unchanged; note batch invalidates each current project plan at most once.
- Main owns root clean CI, shared state/tickets/README, stage/commit/push. Keep raw RED/GREEN/failed-review/phase receipts; no old successful gate represents later inputs.

## Review Focus

1. Recursive/self-referential rename or computed method name must not be silently normalized into a false body match (Task1/2).
2. Legacy or partially captured new facts must not turn one returned exact row into unique authorization (Task2).
3. An ambiguous selected mapping must not overwrite another accepted pair, bind unrelated/deleted note or cascade folder children (Task3/4).
4. Refresh or simultaneous note/mapping writes must linearize in the same DB transaction and preserve immutable approved context on rollback (Task3/4).
5. Locale/project/snapshot changes must not retain a stale confirmation or imply physical move through FS planned ownership (Task5/6).

## Proposed File/Ownership Map

Create packages/core/src/identity-migration.ts and .test.ts; append optional type/schema to model.ts/validation.ts/index.ts only after main shared window. Create packages/indexer/src/identityEvidence.ts/.test.ts; narrow graph.ts/index.ts/typescript.ts/python.ts/python/index.py hooks and capture fixtures, do not change other IDX03 graph logic. Create packages/service/src/identity-migrations.ts/.test.ts and migration transaction integration tests; coordinate WorkspaceService facade and KN Annotations.bindMany with current owner. Coordinate server/routes.ts/client/MCP limited adapters. Create apps/web/src/features/identity-migration/{IdentityMigrationPanel.tsx,migration-controller.ts,tests}; main assigns final existing entry point and en/zh windows after KN/FS freeze. Dedicated new tests/support/idx04-validate.mjs and docs/reviews/idx04 evidence only during implementation authorization.

No edit of current product or tests is authorized by this map now.

## Task1: Captured Versioned Evidence (A1/A3/A4)

**Files:** core new identity-migration.ts/schema tests + approved model/validation/index hunks; indexer new identityEvidence.ts/tests + extraction/graph/index/Python narrow hooks.
**Interfaces:** IdentityFactRef, IdentityEvidenceEntry, IdentityEvidenceCapture; captureIdentityEvidence(capturedFiles,parserDeclarations,relations,availability): IdentityEvidenceCapture. Evidence metadata references actual fact IDs; CodeSnapshot.identityEvidence optional.

- [ ] Write meaningful failing tests: byte-identical moved file; TS/JS root binding rename tokens; Python root rename AST; class/method/nested names; strings/operators/params/decorators preserved; computed/dynamic name unknown; sorted folder relative tree digest; unresolved relation no digest; preview/surrogate limits.
- [ ] Run npx vitest run packages/indexer/src/identityEvidence.test.ts packages/core/src/identity-migration.test.ts; retain behavior RED (not only missing-module error).
- [ ] Implement captured-byte/AST-only normalizers and strict limits/count invariants; reuse scanner buffers and owned parser syntax, no target read/execute. Add evidence to facts fingerprint without changing captured-v3 hash inputs/IDs.
- [ ] Run focused tests GREEN and all existing indexer plus relevant core snapshot schema tests; check legacy field absence and unchanged original function/call IDs. Save original failure/output/input hashes.
- [ ] Main review checkpoint: exact field diff/legacy/caps; no shared build until grant.

## Task2: Pure Bounded Candidate Query (A1/A2/A3/A4)

**Files:** core identity-migration.ts pure query/tests; service new adapter tests (no writes).
**Interfaces:** getIdentityCandidates(from:CodeSnapshot,to:CodeSnapshot,fromFact:IdentityFactRef,acceptedNodePairs,input:{offset,limit}): IdentityCandidatePage; state unique|ambiguous|none|unknown|retained_id; metadata/counts/truncated as spec.

- [ ] Write RED: one exact renamed declaration; two exact new duplicates ambiguous; same-name/body difference no fuzzy; old ID still present retained; recursive rename token difference yields no exact candidate (none after complete comparison); missing legacy/failed/partial/budget evidence unknown even one exact sample.
- [ ] Add folder-no-cascade and relation accepted endpoint+same-expression positives, unknown endpoint/unresolved relation/repeated-expression ambiguity negatives. Public response64KiB and max50 truncation must not authorize an omitted row.
- [ ] Run npx vitest run packages/core/src/identity-migration.test.ts; retain RED.
- [ ] Implement exact eligible indexing/comparison within hard budgets; no source endpoint/Git/history reconstruction, no confidence scoring. Snapshot pair/project and stored metadata consistency failclosed.
- [ ] Run focused GREEN, legacy/no mutation checks and deterministic pagination; assert input snapshots/evidence not modified.

## Task3: Snapshot-Pair Accept Ledger (A2/A3/A5/A7)

**Files:** new service identity-migrations.ts/tests; approved workspace facade/server narrow fields later; tests/integration/identity-migrations.test.ts.
**Interfaces:** listIdentityBaselines, listIdentitySources, getIdentityCandidates, listAcceptedIdentityMappings, acceptIdentityMappings(projectId,AcceptIdentityMappingInput). Registry/settings immutable records per spec, expectedMappingRevision CAS. No MCP acceptance tool.

- [ ] Write RED against real independent SQLite: explicit accept only; unique/ambiguous chosen exact match; wrong tuple/hash/crossproject; same from→different to/target collision; relation endpoints proof; node batch without implicit descendants; unknown/retained refusal.
- [ ] Include repeat/no-op after fresh ledger read versus stale CAS, unknown stored schema/version, UUID/history collision, write fault rollback, snapshot publication barrier two commit orders.
- [ ] Run npx vitest run packages/service/src/identity-migrations.test.ts tests/integration/identity-migrations.test.ts; retain RED.
- [ ] Implement one synchronous storage transaction with full reread/eligibility/CAS before put, immutable record+registry; no awaits, duplicate coordinator or plan verification alias.
- [ ] Run focused GREEN, restart/read pagination and unchanged all snapshots/source facts/old approvals/context/route IDs/hash/value assertions. Save phase source+DB evidence and exact shared diff for main.

## Task4: Explicit Selected Annotation Rebind (A5/A6/A7)

**Files:** coordinate packages/service/src/annotations.ts narrow bindMany plus new dedicated tests; identity-migrations.ts transaction integration.
**Interfaces:** Annotations.bindMany(projectId,{expectedSnapshotId,bindings},{invalidatePlans:false}) or main-approved equivalent same-transaction interface. Existing single bind/create/edit/orphan semantics must remain.

- [ ] Write RED: mapping accepted with notes unselected leaves orphan; selected exact-source orphan note rebinding changes only binding/history/revision, prose/author/source/constraint unchanged; old ID reappears does not restore; new target later missing re-orphans.
- [ ] Pin note deletion/CAS/source mismatch/unavailable target/pairIndex race and midbatch failure rollback; two selected notes invalidate each current plan once, other projects unchanged; no-op records/history/plan revisions unchanged.
- [ ] Run dedicated integration tests plus existing annotation/approval-context tests, retain RED.
- [ ] Implement complete batch preflight→bind writes/history→single invalidateProjectPlans within ledger transaction, reuse KN selectAnnotationTarget and ownership guards.
- [ ] Run GREEN with actual SQLite restart and exact old approvedPlan/Approval/approved annotation context/author route preservation; failclosed current approval after knowledge change. Do not edit semanticHash or old context to “repair” approval.

## Task5: Read APIs / Explicit UI Confirmation (A3/A6/A8)

**Files:** main grants server routes/client/MCP read tools, new migration feature/controller/component/tests, minimum mounting point/i18n after KN/FS source freeze.
**Interfaces:** server strict endpoints listed in spec; UI captured intent {projectId,fromSnapshotId,toSnapshotId,hashes,mappingRevision,pairs,noteRevisions}; MCP only bounded read parity.

- [ ] Write RED: legacy/unknown versus none/retained, unique still requires confirm; ambiguous single selection; default notes unchecked; cancel no writes; selected notes exact identifiers; truthful bounded hash/preview/capture labels and original paths.
- [ ] Add stale generation/project/locale/snapshot/late response and409 with preserved draft/no auto retry; HTTP rejects caller-provided evidence/unknown keys; FS planned function/path never offered as captured source candidate.
- [ ] Run npx vitest run apps/web/src/features/identity-migration packages/server/src/identity-migrations.test.ts; retain RED.
- [ ] Implement bounded baseline/source/candidate/history views and explicit accept, current-source label remains live, old preview labelled captured/truncated. No giant summary payload/new first-use flow.
- [ ] Run GREEN, scoped lint/typecheck/build only granted package slots; freeze same compiled source before real gates.

## Task6: Final Real Lifecycle Gate / Handoff (A1–A8)

**Files:** new tests/support/idx04-validate.mjs + dedicated evidence/report; do not overwrite prior ticket evidence.
**Interfaces:** actual production HTTP / SDK read-only candidate parity, actual browser user accept + note selection/rebind + SQLite restart, owned random ports/tempDB.

- [ ] Create full fixed JS/TS/Python fixture with immutable before capture, simple rename/move, duplicate ambiguous, changed body unknown/no-exact, folder and resolved relation cases, legacy/missing evidence, same-ID return and second project. Source marker must never execute.
- [ ] Record RED where implementation absent/incorrect; no fake DOM event acceptance gate. Run actual clicks in en/zh, source/context/evidence preview and cancel/no-write, stale request then explicit reload/confirm; assert no runtime external requests or target execution.
- [ ] Assert current note state/plan invalidation and complete old snapshot/approval/context/route/history preservation across SQLite restart; source bytes unchanged by migration/accept; current verification identical with/without mapping records and FS pending moves remain unimplemented.
- [ ] Freeze exact owned source/shared hunks and compiled inputs; run full indexer regression plus pinned full Express createApplication35/35 and current IDX03 references isolation/budget gates, same compiled source. Coordinate clean root CI with main; scoped success alone not ticket DONE.
- [ ] Budget-permitted independent explicit gpt-6.1-sol high final review only if main permits spawn/reuse slot; this design round forbids spawning. Fix only failed criteria, retain raw reviews/failures.
- [ ] Deliver precise whitelist/shared patch/RED-GREEN/logs/full source/context/PNGs/SHA/limitations. Main updates state/ticket/README and commits/pushes. No claim of independent review/root CI before actual results.

## Self-Review / Current Design Handoff

- [x] Read actual ticket and Graph/index/captured scanner/TS/Python/KN schema+service/FS design/verification/README boundary.
- [x] Spec sections map to Task1–6, acceptance A1–A8 map to tests; no fuzzy identity or approval rewrite, bounded capture/query and atomic notes/ledger consistent.
- [x] Review Focus five input classes have owning RED tests above.
- [x] Names/statuses/schema budgets shared exactly; retained_id is presence of domain ID, not unchanged implementation; ambiguous chosen mapping allowed, unknown migration refused while independent KN rebind remains possible.
- [x] No product/tests/build/stage/commit/spawn for IDX04; only spec/plan/ledger.
- [ ] Main design review: entity coverage, optional evidence schema/candidate budgets, KN bindMany transaction interface, exact product ownership windows, later review/build slots.
- [ ] Implementation authorized and executed (not this phase).

Execution method for later authorization: executing-plans/native explicit gpt-6.1-sol high, coordinated narrow windows and TDD; commits/rootCI/main coordination retained. Do not infer permission to implement from these unchecked task steps.
