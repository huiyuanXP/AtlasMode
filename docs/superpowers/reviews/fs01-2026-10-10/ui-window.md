# FS-01 second UI source freeze

Date: 2026-10-10. Author: /root/ag05_impl (GPT-6.1-sol high). Status: source frozen for independent implementation review and main's stable isolated compiled browser gate; FS-01 remains PARTIAL/TODO.

## Exact owned bytes

VM2 freeze root: `/tmp/atlas-fs01-ui-freeze-20261010-1751`. It retains complete `after/<repo path>` bytes for 21 files, complete `before/<repo path>` bytes for pre-existing files, plus an owned-only patch. New files have an explicit null beforeSha256 in manifest.json. The precondition fixture's before bytes come from the original first-window freeze; only mandatory MemoryStructureFiles injection was adapted, without weakening its existing assertions.

- source.sha256: `3d5a4b669346a5687894275efb3b50b6dc84ded8029ac909a1fec9dfc0bb304b`
- manifest.json: `3958da0d78dcf328019bac643ba3016b5ce3b74dc48b1893068396a6f556a900`
- owned.patch: `44153d0f60dbe8d959a3a005d02ede2c399e48dc1cb465d8c1a88ad619a18eab`

Original 19-file first-window bytes and R1 three-file frozen bytes/raw reviews remain separate and unchanged. No shared service/SQL/core/schema/routes methods were edited in this window. The constructor-port adaptation uses the actual landed controlled fixture port, not a missing-runtime fallback.

## Implemented behavior

Layout is the default. Explicit Plan ownership enables native HTML function-card drag/drop into the independently bounded, captured-snapshot Structure targets tray, with full file paths and explicit required directory filename. A click/keyboard alternative uses the same preview but is not accepted as native drag evidence. Only a loaded function's true domain ID, or actual current-plan temporary function ID, can start; nonces and exact loaded/planned targets bind the local gesture. Folded group endpoints use optional mode callbacks and retain real function identity; group membership and persistence logic are unchanged.

Captured project/plan/revision/snapshot ID/hash saves carry the server expectedSnapshotId precondition. Physical source context is requested by true function ID first, checked before source dispatch and again before application, and its returned physical path is checked. Source is labelled current live disk bytes without asserting historical snapshot bytes/hash equivalence. Temporary source remains unavailable. Effective paths are consistent across final legacy moves, projection, breadcrumbs, scope IDs, target tray and plan overview while code fact paths stay physical.

Legal semantic ACK updates server plan/history after later selection without restoring an old camera. Same-operation focus/inspection/graph expansion share one generation; independent later operations still invalidate it. An ownership preview interrupted while saving by selection or snapshot change expires permanently, even if selection returns to its old ID; its later ACK cannot clear that preview. Project/plan changes cancel foreign preview. Dirty planning forms retain the independently approved R1 protections and block ownership/confirmation.

## Verification and limits

- Original scoped regression: 57/60 PASS, 3 FAIL. Saved ui-regression-first.log. The two old delayed-source fixtures now wait actual source dispatch without sleeps or changing their assertions. The third exposed a real accepted-ACK camera regression. The subsequently discovered focus-generation collision was fixed, rather than removing source checks.
- Three affected original tests: 3/3 PASS, ui-affected-three.log.
- Final scoped source/controller/projection/navigation/real SQLite and HTTP precondition tests: 66/66 PASS across 8 files, ui-final-scoped.log. These do not establish full application browser integration.
- Additional late ownership ACK A→B→A: actual source helper RED (unexpected true/preview clear), then 13/13 ownership-session GREEN. Both receipts retained.
- Owned 21-file lint: exit 0, ui-lint-final.log.
- Current web noEmit: exit 2, ui-typecheck-final.log, AnnotationContent missing from the available @codemap/core export/declaration while KN changes are in flight. A prior typecheck passed before those later shared changes; it is not reused as current success. Main must build the stable core/KN snapshot and rerun.
- Production ownership.spec.ts parses/lists all 6 tests, ui-browser-list.log. It has NOT executed against a stable compiled application.

The production tests use owned disposable source/SQLite roots, actual HTTP and page.mouse pointer movement; passive drag observation never creates DragEvent/DataTransfer or mutates application stores. Planned coverage: file drop + approval invalidation/undo/redo/current explicit confirmation/verify/restart; folder filename/cancel and external snapshot 409; context-response generation; layout-only persistence vs folder save/reload; folded group true-ID drop with unchanged membership; dirty advanced metadata across actual external revision. They record source path+byte hash invariants, original physical source requests, no execution marker, and denial of external browser requests. Each owned server wrapper records PID/start nonce/root/data/port/start/exit/stop and exact-root cleanup receipts. No compiled server was started by this window yet.

Pending: independent high source review; main stable isolated clean build/typecheck; true compiled Chromium native pointer cases and existing layout/funnel/map/group regressions; exact screenshot/network/source-invariant and cleanup receipts. No source files have been moved, renamed or written by the app. No user DB, paid provider, root build/shared dist, git stage/commit/push or other agents' instances were touched. Internal fixture repairs do not count as another completed ticket.

Additional source check: KN confirmed AnnotationContent is already exported in core source; only the available compiled declaration is stale. A temporary noEmit config extends the unchanged web tsconfig, changes rootDir to the repository and maps only @codemap/core to its actual public source index (plus explicit node typeRoots). Full Web source noEmit with that config passed, ui-source-typecheck.log/source-tsconfig.json. This neither changes package exports nor generates shared dist, and does not replace the pending standard compiled check. All 21 frozen working-tree hashes were checked against source.sha256 after this read-only validation. No owned compiled server or tunnel was launched in this source window.
