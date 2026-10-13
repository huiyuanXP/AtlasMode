# POL-01 service / HTTP window independent code review

2026-10-10 UTC. Reviewer `/root/ci_repair`, explicitly assigned GPT-6.1-sol high; independent of this window's implementation. **REQUEST_CHANGES — Critical 0 / Important 2 / Minor 0.**

## Exact scope and frozen identity

Reviewed the actual VM2 `/home/agent/projects/AtlasMode` source identified by `docs/reviews/pol01/http-window-freeze.sha256`, the precise shared patch, handoff, dependency manifest, tests and saved receipts. All **18 owned paths** matched before review and again afterward. All **14 dependency paths** matched before and afterward. The read source therefore matched the frozen bytes throughout the review; this does not expand the conclusion to subsequent owner changes or the full product.

| Artifact | SHA256 (before and after where applicable) |
| --- | --- |
| Owned 18-path manifest | `e56afc0c87dddb65201bb3e4f3897b2def45b5f7e8bef4fbfcbfe43356f551e9` |
| Dependency manifest | `06454f4954ad9f2151deb69078a04b7f3b408d33f0c4464827ae494d0bd5bad6` |
| Shared exact patch | `0387cac10936969a4334459781cf4fc75c05ad32a0e187701802a4850e7fadbc` |
| Receipt manifest | `0ecb7af3da0969c42c6783040e1b48e011c9b0ad9898cd421ba1203dd3638840` |
| Artifact manifest | `72e3f07a7862f730b6e59dedeede80db866abc082b907c6e9721ceea26225b38` |
| Workspace source | `683d9f92155c836219c6d08fb2b620772d07f8fea6ce684551f214ca8beee1c1` |
| KN Planning dependency | `89fdba1f61a4ba2ba9917133f99974ea7fb42a89b20bfff69975a12cd5fbc86f` |
| KN AnnotationReviewService dependency | `8a3b350e11763d06561ee6e5333dee80b91c3ccaa327bb02e3756ad093a4543b` |

Reviewed the five production paths (Workspace/Knowledge/server index/routes/server), the new HTTP tests and two helpers, and the mechanical port/await/CAS fixture changes identified by the patch. Necessary caller reads included actual agent bridge/gateway and MCP HTTP client/tool paths. StructureSync, StructureRecords, file adapter, Planning and review services were read as frozen dependencies to assess the new integration, not silently reclassified as newly authored code. The prior module review and limited module repair APPROVE remain unchanged and separate.

No source, target document, database, index or build artifacts were written. No tests/build/lint were run, and no agents were spawned. Read-only SHA checks and an exact-byte substring comparison of two methods were performed; only this local report was created.

## I1 — HTTP export bypasses fresh structure reads while claiming current validity

**Important.** `apps/server/src/routes.ts:294–304`, `packages/service/src/workspace.ts:301–302`; dependency `packages/service/src/planning.ts:316–334`.

Most ordinary plan HTTP reads were correctly changed to queue-held `readPlan`/`readPlans`, and approved reads call the new strict current guard. Export still directly calls synchronous `service.exportPlan`, which calls `Planning.export` → `get`. Its policy callback is synchronous `listPolicies` → `StructureSync.policies`, which reads cached state and does not read the file. The exported JSON spreads `detail.valid`, and Markdown explicitly prints `Current valid: ${detail.valid}`.

Concrete path: approve a current v1 plan with a valid structure file; an external editor changes that file's semantics; before any structure/policies/plan read or refresh, call HTTP export. Neither export nor its callbacks observes the new bytes, so the old cached structure and unchanged stored plan can yield `valid: true` / `Current valid: true`. Reading the ordinary plan or approved endpoint would instead synchronize the semantic change and invalidate the current approval. The new policy source can thus be bypassed by an existing user-facing validity read. This is a static actual-source finding, not a runtime reproduction from this review.

The design explicitly permits immutable historical approval export, but requires it to be clearly historical and not masquerade as current effective approval (POL spec line 100). Labelling an approved revision separately does not make an unchecked **Current valid: true** safe.

**Required narrow repair:** Either make the exported current-validity component a same-project queue-held fresh read/use case, or make unchecked export explicitly historical-only with current validity unavailable rather than asserted true. Preserve immutable approved plan/annotation context and legitimate history access; invalid/conflict/pending structure must remain explicit and must not become a valid cached current result. Do not solve this by replacing the KN historical guard, downgrading its errors, or rewriting the preserved FS update methods.

Add actual source HTTP JSON and Markdown fixtures for a direct valid external semantic edit → export with no intervening synchronization call, deletion/invalid bytes, and prepared/published pending barriers if export claims current validity. Assert no stale `valid:true`, truthful fresh/current or historical status, appropriate once-only invalidation, and exact immutable approval/history preservation. The existing final 12 HTTP tests do not exercise this export-first path.

## I2 — Policy identity ownership is checked before enqueue and can become stale

**Important.** `packages/service/src/workspace.ts:145–151, 218–245, 378–387`; dependencies `packages/service/src/structure-sync.ts:471–478, 830–875`.

The new Workspace guard checks existing DB records and other projects' stored file projections, but `updateStructure` calls it **before** handing the operation to the per-project queue. `savePolicy` likewise performs an early check. When queued work actually runs, StructureSync only rechecks the `policies` DB owner for an explicit legacy ID. Newly created/migrated file extensions live in structure state, not that DB table. Its candidate/finalize path does not recheck another project's file projection or in-flight claim.

Deterministic supported single-service interleaving: hold project B's queue with an owned barrier; enqueue B's creation of a previously unowned explicit legacy ID X (the outer owner check passes); use independent project A's queue to create X and fully finalize; release B. B can publish and finalize its already-enqueued X although X is now a known A policy. Both projects then contain the same supposedly exclusive policy identity. Their later `readPolicies` calls execute `checkDocumentOwners` and can reject one another as foreign, leaving API-created state that its own guarded read cannot use. The existing Workspace test explicitly supports another project's progress while one project waits; this is not a multi-server or arbitrary external-writer claim.

A second case is two projects concurrently claiming the same initially unowned ID: moving the check into each project queue alone is insufficient unless publication/claim ownership is protected across those queues. The new guards intentionally establish cross-project identity ownership; it cannot be checked only on the request's arrival. POL spec's legacy extension contract rejects references to known IDs belonging to another project.

**Required narrow repair:** Revalidate ownership at the actual queued mutation boundary and protect competing claims of an explicit ID within the supported single service. Cover pending intents/recovery as needed so ownership is not lost across a prepared/published outcome. Reject the losing claim **before file publication**, or use an explicitly reviewed reservation/serialization contract with honest recovery; a post-publication rejection cannot be described as rolling the file back. Main should coordinate any necessary narrow StructureSync dependency change rather than overwriting its previously frozen repair or adding unrelated storage/public-export work.

Add owned real SQLite + file/HTTP barrier tests for queued B / fully committed A / released B and simultaneous new-ID claims. Require one accepted owner, a truthful loser conflict/project-mismatch, losing file bytes unchanged, no false committed audit, preserved plans/approvals and usable successful-project reads. Also retain DB-only edit, migration, same-project CAS, idempotent retry and existing cross-project progress semantics. No new source or runtime tests were executed by this reviewer.

## Verified integration and preserved boundaries

- Production explicitly injects `StructureFileStore`; Workspace's constructor requires a port. The scheduling tests use an explicit memory port, and real SQLite/file/HTTP fixtures supply a real adapter. No absent-port fallback reintroduces unchecked DB-only policy writes.
- `index.ts` awaits `recoverStructureWrites()` before optional workspace opening and before creating/listening on the HTTP server. The actual source-entrypoint fixture uses `node --import tsx`, an owned database/root, an injected runtime source-alias configuration and a reserved local port. Its first structure/plan/audit HTTP observations are recovery-aware. It does not establish a newly built distribution result.
- `withStructure(..., refresh=true)` holds the StructureSync project queue through actual source indexing, structure read/recovery/usable-state checking and the synchronous approve/current/verify callback. There is no public refresh-return/read split in these three new service use cases. HTTP plan list/read/create/update/validate now use queue-held fresh wrappers. The two real prepared/published fixtures assert approve/current remain unsettled and index count does not increase before release; old expected revision then conflicts and immutable approval count remains one.
- KN integration uses actual `Planning.getCurrentApproval`, not ordinary `getPlan`. It requires current valid v1 review context and maps `NOT_APPROVED` / `APPROVAL_CONTEXT_INVALID` to 409. Ordinary read preserves history and exposes `valid:false`/review issues; verification selects the latest immutable guarded history and has no older-history fallback. The tampered-context HTTP fixture verifies both strict current and historical verification failures.
- Strict structure requests exclude client source/project/time/audit claims; two observed CAS preconditions and a UUID mutation are required. Missing policy transport preconditions return 428. Folder projections are not edited as legacy policies, and natural-language folder constraints are not promoted into executable forbidden dependencies.
- DB-only same-ID policy edits retain their DB source and do not rewrite file bytes. Explicit preview/import performs the source transition in finalize, removes only captured matching legacy IDs, and invalidates once. No-op durable receipts preserve retry identity without a fabricated write audit or plan revision increase. The one spec amendment adds that receipt key and retains original bytes/SHA; prior failed module reports are not overwritten.
- Prepared intent precedes publication. Publication/finalize failure leaves recoverable pending state; unknown I/O remains unknown rather than inventing missing or third-version bytes. Actual before/after/third SIGKILL fixtures and a persistent-intent unknown-read fault cover abort/no replay, once-only finalize, preservation of external C and quarantine, and later successful reobservation. The file and SQLite operations are not a cross-resource atomic transaction; pending recovery, external last-check→rename TOCTOU and untested native OS behavior remain explicit.
- The two FS methods were independently compared against exact saved original bytes, each appearing **once and unchanged** in the frozen current source: Planning update SHA `f4b11da3a6354f7646e656ef49ce4110c148ee4873d7a7e942f5311ce47b0613`; Workspace update SHA `39dbfb5232894947f53cd8549f48700dfd12f67f6e7e071fecc68e6a6b59f794`. `expectedSnapshotId` and coalescing are preserved. Planning's broader hash legitimately includes KN-owned changes.
- Actual agent direct service plan reads inspected here are context/ownership checks, while mutations route through the guarded HTTP service. They are not accepted as current-approval execution authority. The existing MCP `get_approved_plan` still uses separate refresh/read and `get_folder_policies` lacks the single metadata envelope; these are explicitly deferred wiring, not falsely approved by this window.

## Actual receipts and what remains unverified

All **21 receipt files** and **13 handoff/config/artifact entries** matched their recorded SHA manifests. Read `http-window-kn-guard-green.txt`: four files / **65 tests PASS**, start 17:29:39, duration 15.38s (Workspace7 + server15 + lifecycle31 + HTTP12). Read the final empty lint/noEmit outputs together with the handoff's scoped exit-zero receipts; this reviewer did not independently rerun them. The newly exercised entrypoint is actual TypeScript source; old compiled-dist subprocess cases are not proof of new production behavior.

The wider old-fixture noEmit failure is retained with original bytes/port-only diff and is not renamed a full typecheck success. Historical RED, malformed/oversize setup failures, earlier test counts and failed settings baseline attempt remain separate. The main-approved lifecycle baseline adjustment preserves exact post-read settings equality and approval/DB rollback assertions; no history filter or assertion deletion is accepted as a shortcut.

This review concerns only the frozen service/HTTP window. Old UI policy forms still lack CAS and receive 428; UI/reload/409-draft preservation and MCP atomic endpoint/envelope wiring require the next owner windows. Compiled production, main integration gates and Windows/macOS remain separate. **POL-01 is not DONE.** Repair I1/I2, preserve this initial report, freeze exact changed bytes/receipts and request limited independent re-review before accepting this window.
