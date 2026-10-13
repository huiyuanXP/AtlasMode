# FS-01 targeted design repair receipt

Date: 2026-10-10. Author: `/root/ag05_impl`. Documentation repair only; limited independent re-review pending. This is not product implementation approval or an independent PASS.

Original independent report is preserved verbatim in [initial-independent-design-review.md](initial-independent-design-review.md): SHA256 `59a777e1dc22d03fb592da32c9c0427b2a7b5313c6f9307afcd6a5b71d8141aa`. Its conclusion is Critical 0 / Important 2 / Minor 1. Read-only source inventory observed HEAD `fe4b52c191640913d192ca514164d972275531d1` before repair upload.

| Document | Reviewed before SHA256 | Repaired SHA256 |
| --- | --- | --- |
| [Spec](../../specs/2026-10-10-fs01-design.md) | `922f657e03d7a6ccc427e2fe4362a9f3defdfcce4e409c2e07d2b795ab8bd862` | `a71cfd3e0960cec757083d6db9e0c6ec2c0c0383d9d0187f616b1d24c1129e0c` |
| [Plan](../../plans/2026-10-10-fs01.md) | `09fd34aa38680c90d5a44f369b890555df3604cbd87a2341f795a9ed42239453` | `098135fc7ab1c93f24ac36719fdf18cf89baa996b675cbbb9959591158f07548` |

I1 repair: optional validated expectedSnapshotId extends the strict update route/service inputs for legacy compatibility, with a required captured tuple wrapper for every ownership/advanced target-path save. Planning.update must atomically read current authoritative plan/project snapshot, check expectedRevision/current snapshot/baseline id+hash and put inside the existing synchronous storage transaction. WorkspaceService.storeSnapshot publishes snapshot/project via that same injected storage boundary. No independent queue or preflight assertion stands in for that boundary. The plan requires actual SQLite barrier tests for both commit orders, HTTP/client/browser stale-preview rejection, no writes/history/focus success on rejection, foreign/stale-baseline checks and legacy omission compatibility. POL-01/KN-01 shared callers require main coordination; no new coordinator is proposed.

I2 repair: shared planning-side effectiveFunctionPath/retargetFunction powers ownership and all advanced targetFile edits. Legacy duplicates have one last-effective display; explicit selected-function editing coalesces moves or folds temporary moves into the addition. Advanced annotation behavior stays separate and existing annotations/unrelated operations remain. Clean same-id forms track accepted effective values; dirty input is retained/expired and cannot silently submit or be overwritten. Mixed-entry/temp/legacy/undo/return/no-op/form tests are explicit.

M1 repair: current snapshot binds actual function context identity/physical path; current project/snapshot/selection/request generation and response path are checked before source dispatch and display. Live disk bytes are labelled current source, without a historical snapshot/hash claim. Mismatch, missing file/read error/late reply refuses source; planned destination bytes are never a fallback. No historical source store or indexer hash API is added.

Author verification: reread actual Planning.update, WorkspaceService.getSnapshot/storeSnapshot/updatePlan, SQLiteStorage.transaction, route/client update parsers, PlanEditor/editFunction/FunctionForm and current source-load code. Before upload, remote documents matched both original hashes. Whitespace and repository-relative link checks are documentation checks only. No build, product test, source movement, provider call, SQLite mutation, shared dist change, product/global status edit or commit/push was performed. Existing mode/drop/filename/approval/no-source/IDX-04 boundaries remain.

Main's product window and limited independent re-review remain required. Keep raw initial findings separately from the later reviewer result; neither this author receipt nor a document-only APPROVE proves a concrete implementation safe.
