# KN-01 observed-change and support-contract final limited review

Reviewer: `/root/ci_repair`, GPT-6.1-sol, high reasoning. Date: 2026-10-10.

**APPROVE — Critical 0 / Important 0 / Minor 0**, limited to the frozen I1 support-contract clarification and I2 observed-disappearance repair. The prior two REQUEST_CHANGES reports remain unchanged. This approval does not declare the full KN-01 ticket DONE or prove the pending integrated service/UI behavior.

## Exact reviewed scope

VM2 repository `/home/agent/projects/AtlasMode`; manifest `.superpowers/sdd/2026-10-10-kn01/freeze-observed-change.sha256`, SHA-256 `773a13dfbb169161ba1bc1b58903e4c65f24fbee368e1997864bd519783905df`. All thirteen manifest checks returned OK. Only these two source/test paths and the narrowly revised spec differ from the previous WAL repair freeze:

| Path | Reviewed final SHA-256 |
| --- | --- |
| `packages/storage/src/sqlite.ts` | `3aef48bfd53d62cfe93fe576d7d46b7bb9e4c84ce5a95d30ce6cc399284f44db` |
| `packages/storage/src/annotation-migration.test.ts` | `e6572599d5ab22602a5faa3da888f62c2ba901ccb09f691c69f5700b1635e63e` |
| `docs/superpowers/specs/2026-10-10-kn01-design.md` | `92fa349ad79e608e392db130cef6832b7a8b384ed254ad35585f6a58d0777802` |

The other ten first-window frozen paths match their previous hashes. Plan `docs/superpowers/plans/2026-10-10-kn01.md` remains `bf82d14740e0f3dd8fe7dc0264c4bb7651f267c58a0e03c48bdd471e32d596c2`. The owned preserved pre-contract spec bytes hash to `6681c5a2029d97a6d662ac1a625de7b68804aa682424ae20260419b525fe4759`; preserved pre-I2 sqlite.ts bytes hash to `ac077907e56ccfa0957922e149e83cb11da6fad02bbed4583a58985486208da6`.

Read `.superpowers/sdd/2026-10-10-kn01/observed-change/receipt.md`, its exact `sqlite-repair.diff` and `spec-contract.diff`, final source/tests, old bytes, focused RED/GREEN logs, and affected-check receipts. This was a read-only independent review. I did not edit source/docs/index, open real user databases, run tests/builds/root gates, spawn an agent, or change the frozen CI fixture. The other unchanged modules were not re-reviewed as new changes.

## Closure of I1: visible ownership contract matches the approved product decision

The revised persistence section explicitly limits support to one service exclusively owning the DB, with no external concurrent writer during initialization/migration or normal use. It replaces the old unconditional zero-sidecar sentence and qualifies A6 consistently. It explicitly says standard VFS does not atomically join the final fingerprint comparison to open/BEGIN and does not claim to lock arbitrary external writers. This is a support precondition, not an enforced cross-process-lock claim.

That matches the main coordinator's explicit adjudication, which I accepted in the preceding limited review. The document retains the supported-input hard protections: exact empty/001/002 gate; raw reads of original files; main/WAL/journal private-copy evaluation; rebuilding only private SHM; no immutable-main shortcut that ignores committed WAL; rejection of observed changes before original open; transaction recheck and rollback; refusal to repair/rebuild unknown schema; stable supported unknown/future input leaves original persistent bytes/schema/markers/JSON/sidecars untouched. It does not silently drop the original protections within the now-explicit supported class. I1 is closed for this scope.

## Closure of I2: observed disappearance now fails before any SQLite open

At `sqlite.ts:237–258`, initial stat has its own catch; only its ENOENT returns the absent sentinel. After initial stat succeeds, read or after-stat ENOENT invokes `observedChange()` and returns the explicit `OBSERVED_CHANGE` domain error. Identity mismatch within a read and full byte/identity mismatch across comparisons use the same fail-closed code. Genuine initially absent sidecars remain accepted.

Private-copy probing still consumes committed WAL/journal and rebuilds only its derived SHM. Owned cleanup remains finally-protected. The original-source connection is reached only after the accepted-image comparison. The immediate transaction's exact schema recheck and raw SQL migration remain intact, with WAL setup only after successful migration. The repair does not claim to eliminate the documented unsupported external-writer gap after that final comparison.

The six new tests use actual owned WAL/SHM/journal files and the real filesystem calls. Each wrapper first lets the initial stat succeed, then physically removes the file before read or after-stat. Their assertions require initial observation and injection to have happened, exact `OBSERVED_CHANGE`, and zero SQLite constructor opens. The constructor proxy delegates through Reflect.construct to the actual better-sqlite3 implementation; it observes opens rather than replacing SQLite behavior. Tests reset fault scope in finally. The preserved trace RED shows the old source actually opened the original after swallowing the disappearance. The repaired GREEN shows zero opens, including no private-copy handle. I2 is closed.

## Execution evidence and limits

- `observed-change-red.log` and `observed-change-red-trace.log`: six failing targeted tests / 31 skipped. The trace explicitly records original SQLite opening on the old implementation after observed deletion. Those failures are preserved.
- `observed-change-green.log`: six passing targeted tests / 31 skipped, duration 2.74 seconds.
- `observed-change-affected-green.log`: **53/53 PASS in three files**, duration 9.56 seconds: migration37, existing storage6, real SQLite annotation integration10. These are the actual current affected reruns. Core28/review14 were not rerun; the older 89-test result remains historical and is not presented as a new 95-test/full-root result.
- The receipt reports scoped ESLint/noEmit exit 0. I read the existing author execution records; I did not independently rerun them.
- Existing stable future-WAL raw fingerprint/watch tests, valid retained-WAL migration/reopen, controlled observed handoff, transaction-internal schema recheck/rollback, and original rowid/value/history/legacy-registry/marker rollback tests remain in the 37 migration tests.

No new Critical, Important or Minor finding remains in this exact repair/document scope. Shared Planning/Workspace/Knowledge/HTTP/UI/AG02 wiring, actual approval consumers, whole-application browser/restart acceptance and main-controlled integration gates remain pending. The first slice remains PARTIAL and this limited APPROVE does not expand implementation scope or close the entire ticket.

## Immutable prior review references

- Initial module source REQUEST_CHANGES: local `kn01-module-review.md`, SHA `fe7d6563220e22f192bb3e6293f2ef0b7fff852c5943b7246ca81d1837e53964`.
- Initial WAL-repair limited REQUEST_CHANGES, including the main's subsequent support adjudication: local `kn01-wal-repair-review.md`, SHA `2a4348f36e9c3f4303ab3ece9e76b52a7e3b7a6b67668a784c09f88dc43f9bdf`.

This final report is a separate artifact; it does not overwrite either earlier report or its findings.
