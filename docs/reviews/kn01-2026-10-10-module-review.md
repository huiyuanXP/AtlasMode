# KN-01 first implementation window — independent source review

Reviewer: `/root/ci_repair`, GPT-6.1-sol, high reasoning. Date: 2026-10-10.

Outcome: **REQUEST_CHANGES — Critical 0 / Important 1 / Minor 0.** This is an implementation review, separate from the earlier design review. The authorized first window remains PARTIAL; this report does not approve KN-01 completion or GH-6 completion.

## Frozen scope and evidence

Repository: VM2 `/home/agent/projects/AtlasMode`. Read-only review of the twelve paths in `.superpowers/sdd/2026-10-10-kn01/freeze.sha256`; `sha256sum -c` returned OK for all twelve. I did not edit source, tests, design/plan documents, shared build output, or the frozen CI dev fixture patch. I did not run tests, builds, gates, or spawn another agent.

Reviewed frozen content:

| Path | SHA-256 |
| --- | --- |
| `packages/core/src/annotations.ts` | `e2f22ab395ce941804f8b02e768fca25fc27f3ab5c4d5415b85cc850f3364197` |
| `packages/core/src/annotations.test.ts` | `123d094e4bcefba4d83c792e84fe921e02db62f7c8abe40af42dff5fd4d0cf6c` |
| `packages/core/src/index.ts` | `ed00ed8724f118e511c03e94c3d19999f7c4adc05f968e98026e3591fcefcd34` |
| `packages/storage/migrations/002-annotations.sql` | `49316214c9421f47caefb93b2ce9f12c9a0e5a6e849b283eacb03e873a5c3844` |
| `packages/storage/src/sqlite.ts` | `1f1a4fbb0cd65c473056e26a3aafbb7761dcb492e9b84d2491f3a0f1d77bbeaa` |
| `packages/storage/src/sqlite.test.ts` | `b9ff0123b3f2419facdc163352cd639a8b330fd4a15e38cc74f1344c2f4684bb` |
| `packages/storage/src/annotation-migration.test.ts` | `03f5f8269cef039bb9041a8007bf079db3688d581e0621815535f79c21657445` |
| `packages/service/src/annotations.ts` | `ec89d918aef2501bf1e2ba076ffac9ccac15d2dc09c0f5d8843df519e551f581` |
| `packages/service/src/annotation-review.ts` | `a885e69df37546164799b5af2f30729a9627814e2d2738138eae6e705a0152e2` |
| `packages/service/src/annotation-review.test.ts` | `6a391f025f2cdfddaef525cb5608dd232f81d3e08c00c15cac0877c4d9cc4a38` |
| `packages/service/src/knowledge-revisions.ts` | `1b551973450e1b6897c9f8d5b554fbe8519060fabc4e47e439c65097a1fe273a` |
| `tests/integration/annotations.test.ts` | `0fa70336f71ee510227451f36ff59d43f9dfcbb2016752e97e300221dd16a02f` |

Read the existing `progress.md`, `final-green.log`, focused source configs, and actual tests. Final-green records 80/80 in five files (28 core, 22 migration, 6 existing storage, 14 review, 10 SQLite integration), duration 6.63 seconds. The author ledger reports scoped lint/noEmit exit 0; their final logs are empty. These are existing author receipts, not independent execution by this reviewer.

## I1 — Important: readonly preflight can mutate WAL sidecars before rejecting a future schema

Location: `packages/storage/src/sqlite.ts:215–219`, with test coverage at `packages/storage/src/annotation-migration.test.ts:63–89` and `:156–158`.

The preflight opens the actual existing database using an ordinary better-sqlite3 connection with `{readonly: true, fileMustExist: true}` and queries `sqlite_schema`. SQLite readonly limits database writes; it does not guarantee no filesystem writes to WAL sidecars. On a WAL-mode database in a writable directory, a read connection can create `-wal` and `-shm` files, and normal WAL access can initialize/rebuild the shared-memory index. This occurs during the first read, before `assertSupportedSchema` can reject an unsupported marker, object, or registry. Closing the probe afterward does not satisfy the contract prohibiting creation/deletion/cleanup of sidecars.

This conclusion comes from the implementation plus SQLite's documented behavior, not an executed reproducer. SQLite explicitly permits readonly WAL access when the containing directory allows sidecar creation, and describes creation of the shared-memory index for normal-mode access. See [SQLite WAL: Read-Only Databases](https://www.sqlite.org/wal.html#read_only_databases) and [WAL without shared memory](https://www.sqlite.org/wal.html#use_of_wal_without_shared_memory). That means the current implementation does not establish spec line 83's required rejection with persistent bytes and sidecar state untouched.

The current refusal fixtures initialize a normal DELETE-mode database, so they do not exercise this failure. Moreover, `fingerprint()` calls `inspect()` through another ordinary readonly connection before checking sidecar existence. For a WAL fixture, that measurement itself can initialize the sidecars and conceal the constructor's first-open behavior. It checks only existence, not existing sidecar bytes, and cannot detect transient create/delete mutations.

Required targeted repair and evidence:

1. Keep the exact schema/marker/constraint/kind/registry checks and transaction recheck. Make the unsupported-database probe avoid persistent writes to the original database and its sidecars, including WAL input. Use a reviewed approach that accounts for committed WAL contents; opening only the main file with `immutable=1` can ignore WAL changes and must not silently accept a stale 001/002 image.
2. Add owned fixtures for a future schema in WAL mode with absent sidecars, and future changes in a retained WAL with absent/existing shared-memory state. Compare original main/WAL/SHM/journal existence and byte hashes before any SQLite inspection of the originals; observe transient sidecar creation/cleanup as appropriate. Preserve the original failing evidence, then show the repaired refusal leaves the originals untouched.
3. Exercise the actual readonly-to-write handoff deterministically: change a previously accepted fixture to an unsupported schema between preflight and the write transaction; show the transactional recheck refuses before migration, with no unauthorized persistent sidecar cleanup. Retain all existing raw-rowid/value/registry/marker rollback assertions and run only the authorized focused checks before limited re-review.

I1 blocks approval of this frozen first implementation window. It does not require rebuilding the entire project or changing unrelated modules.

## Passed source findings and integration conditions

- The exact known-schema gate checks markers, four schema objects, normalized DDL without normalizing quoted literals, column/PK/index shape, row kinds/JSON, and the frozen registry. The writable connection rechecks inside an immediate synchronous transaction, and WAL configuration occurs after successful migration. I1 concerns earlier sidecar effects, not missing SQL validation.
- Migration 002 copies `rowid, kind, id, value` directly in SQL, replaces the table, inserts the sorted legacy approval-ID registry, and inserts the 002 marker in the same transaction. The tests compare original noncanonical JSON text and hex bytes/rowids/history, inject failures after all five SQL phases, and inject failure at the final marker. Reopen is covered.
- Core binding selection requires exact domain kind/ID and selected snapshot. Missing/incomplete/excluded/diagnostic captures remain unknown; known absence produces an orphan transition, and a durable orphan remains latched when the same ID returns. Explicit rebinding is required. Independent content and strict input shape are preserved.
- Service writes use project ownership, revision CAS, strictly checked current records, immutable revision-key collision refusal, synchronous mutation/history/invalidation transactions, and explicit delete tombstones. No-op edit/bind does not advance revisions. Missing snapshots permit content edit, detach, and delete. The tests verify cross-project refusal and rollback on history/plan-write failure.
- `Annotations.reconcile` owns exactly one invalidation per changed batch, with nested transactions supported by real SQLite integration coverage. The implementation ledger explicitly assigns this ownership. Future `Workspace.storeSnapshot` must atomically store the snapshot/project pointer with reconciliation and must not invalidate the same batch again. That future wiring is not proven here.
- Canonical v1 uses a copied array sorted by raw UTF-16 ID order and fixed explicit arrays. The SHA-256 prefix has the required NUL delimiter. Text, author, source, constraint, binding/provenance and orphan evidence are included; revision/time metadata is excluded. Strict context checks reject duplicate, deleted, foreign-project, and unknown-version content.
- `validateApprovalContext` checks approved-plan status, exact plan/revision/baseline and semantic hash, then v1 project/snapshot/hash. A missing tag requires a frozen original legacy ID and no replacement context; an explicitly undefined tag is rejected. New IDs cannot downgrade by removing their tag. `matchesCurrentKnowledge` computes the actual current context hash. Both are module helpers; integrated consumers must still call them correctly.
- Immutable annotation contexts refuse overwrite and participate in an outer SQLite transaction. Historical capture survives later edits. The current test simulates caller transaction rollback, rather than proving the not-yet-wired production `Planning.approve` capture/hash/all-write transaction.

No additional Critical, Important, or Minor finding is raised in this limited scope. Public Planning/latest/get/export/verify/AG02 consumers, Workspace refresh integration, Knowledge's shared helper adoption, HTTP error mapping/API, UI creation/rebind/cancel/bilingual/theme/900px, and real browser/restart acceptance remain pending. KN-02, DATA-01 and the complete MCP tool set remain outside this ticket window. Existing `Plan.operations.annotate` is not automatically migrated or treated as independent Annotation data.

## Routing

Send I1 to the main coordinator and KN-01 implementer for a narrow storage/test repair window; do not change the frozen CI fixture patch. Preserve this original REQUEST_CHANGES report. Re-review the exact storage/probe repair and its new fixtures after a new freeze, then separately review the later shared integration window. Do not label the first slice or the entire ticket DONE based on these 80 tests.
