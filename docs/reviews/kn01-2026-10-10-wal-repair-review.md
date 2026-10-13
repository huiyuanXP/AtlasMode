# KN-01 WAL repair — independent limited source review

Reviewer: `/root/ci_repair`, GPT-6.1-sol, high reasoning. Date: 2026-10-10.

**Initial limited outcome: REQUEST_CHANGES — Critical 0 / Important 2 / Minor 0.** The stable/quiescent WAL problem from the initial source review is materially repaired. At the reviewed freeze, the remaining items are the explicit support-contract adjudication/documentation and observed-disappearance handling. Main subsequently supplied the adjudication below; source/doc re-freeze and limited re-review remain pending. No advance APPROVE is given.

## Frozen review scope and receipts

VM2 repository `/home/agent/projects/AtlasMode`. Before manifest `.superpowers/sdd/2026-10-10-kn01/freeze-before-wal.sha256`, SHA `b74ee1c353edc09af55b57fbb33a14d2a3c15affc5b4f3ea8df037f6a70a822f`. After manifest `freeze-wal-repair.sha256`, SHA `939708a5159e7bcfdf55a1143b3e0840112e55806818e9dfd523c25683ce2f32`. All 12 after hashes passed read-only `sha256sum -c`; before/after differ only in these two authorized paths:

| Path | Before SHA-256 | Reviewed after SHA-256 |
| --- | --- | --- |
| `packages/storage/src/sqlite.ts` | `1f1a4fbb0cd65c473056e26a3aafbb7761dcb492e9b84d2491f3a0f1d77bbeaa` | `ac077907e56ccfa0957922e149e83cb11da6fad02bbed4583a58985486208da6` |
| `packages/storage/src/annotation-migration.test.ts` | `03f5f8269cef039bb9041a8007bf079db3688d581e0621815535f79c21657445` | `82785c663e9348b6cd8303af8eee867acdceb491536ebd202006c7cc9947c61f` |

The other ten first-window module/test/migration hashes remain unchanged. The reviewed spec remains `6681c5a2029d97a6d662ac1a625de7b68804aa682424ae20260419b525fe4759`; plan remains `bf82d14740e0f3dd8fe7dc0264c4bb7651f267c58a0e03c48bdd471e32d596c2`. Receipt `wal-repair-receipt.md` SHA `77e1dccacf2308d5adee4f6ae0239826c0a8e4a8e30655b916733decb558e7b8`.

Existing author execution evidence read under `.superpowers/sdd/2026-10-10-kn01/`:

- `wal-hypothesis.log` shows ordinary readonly opening initializes an originally absent SHM; `wal-red.log` retains five actual original WAL refusal failures.
- `wal-red-replay.log` replays the exact original frozen sqlite.ts bytes in isolation: 6 FAIL / 25 PASS, including transient create/change/delete WAL/SHM events in the controlled handoff even when final hashes match.
- `wal-final-green.log`: 89/89 in five files (28 core, 31 migration, 6 old storage, 14 review, 10 SQLite integration), duration 8.76 seconds. Existing scoped lint/noEmit are reported exit 0. These are author receipts, not independent reruns.

I performed only source/document/evidence reads and hash checks. No test/build/root gate, live user DB read, source edit, shared dist/index change, commit, or spawned agent occurred. Initial source REQUEST_CHANGES stays preserved separately in `kn01-module-review.md`, SHA `fe7d6563220e22f192bb3e6293f2ef0b7fff852c5943b7246ca81d1837e53964`. FS source review and frozen CI fixture are separate and untouched.

## What the repair establishes

`preflightExistingFile` reads original main/WAL/SHM/journal through filesystem operations, copies main/WAL/journal into a private owned temporary directory, and opens SQLite only on that copy. It deliberately rebuilds SHM on the copy instead of trusting a stale source index. Therefore pending committed WAL frames participate in exact schema checking; there is no immutable-main shortcut that accepts a stale 001 image while a future marker/trigger exists in the retained WAL.

The known-schema validator and direct raw rowid/value SQL migration remain intact. Full byte and device/inode/size/nanosecond mtime/ctime comparisons surround copy probing and immediately precede the original write connection. The owned copy is closed/removed in finally. The immediate write transaction still rechecks schema before migration and configures WAL only after successful migration.

New fixtures cover future main with absent sidecars; future WAL-only marker with absent/existing/stale-zero SHM; WAL-only trigger; raw fingerprints before any SQLite inspection of originals; fs.watch transient events; owned private-copy cleanup; valid main/WAL migration/reopen including WAL-only settings; a controlled observed handoff; and an in-transaction injected future marker that rolls back. The previous raw value/rowid/history/registry/marker rollback assertions remain. This is sufficient source and existing-test evidence that the **stable owned-input** form of original I1 has been repaired. It is not a universal guarantee against arbitrary external writers.

## I1 — Important: finalize the explicit supported ownership contract; the original unconditional promise is not proven

Location: reviewed `sqlite.ts:298–305`; unchanged spec line 83; receipt's support-boundary paragraph.

The final filesystem comparison and subsequent `new Database(databasePath)` / `BEGIN IMMEDIATE` are separate standard-VFS operations. An arbitrary external writer may replace/change the original to a future WAL schema after the comparison. Opening/querying the original may then create/rebuild/clean sidecars before the transaction rejects. The immediate recheck protects migration correctness but cannot retroactively establish zero sidecar mutations. Repeated fingerprints do not create an atomic ownership claim.

I can accept a **visible single-service/quiescent-startup support precondition**, with no external concurrent DB writer, for this implementation: the application service then owns publication after the validated handoff, supported unknown/future input is refused through the private copy, and observed changes must fail before original SQLite access. A standard-VFS atomic zero-sidecar guarantee across arbitrary external writers cannot be asserted. If support for such writers is required instead, this patch needs a further ownership/locking/VFS design; ordinary original SQLite locking itself may initialize sidecars and does not solve the pre-validation contract by being called a lock.

At the reviewed freeze, spec 83 still says unsupported input leaves originals/sidecars unchanged unconditionally. A receipt acknowledging the race alone cannot amend that accepted product contract. Main must visibly choose the support boundary and synchronize the narrow spec/plan wording while preserving original bytes and the already-required stable-input protections. No unconditional future-schema refusal requirement within the supported input class should be dropped.

**Subsequent authoritative main adjudication received during this review:** only one service owns the DB; external concurrent writers are unsupported; no standard-VFS atomic fingerprint→open promise; any actually observed change must fail closed before open. Main authorized the author to preserve old spec bytes/hash and narrowly document this boundary. I accept that explicit premise as the product decision; I have not yet reviewed the resulting amended documentation/freeze. This is a stated support precondition, not proof of an enforced cross-process lock.

## I2 — Important: ENOENT after successfully observing a file is swallowed as initial absence

Location: reviewed `sqlite.ts:223–240`.

One try/catch encloses the initial stat, read, and final stat. Any ENOENT returns `{bytes:null, identity:"absent"}`. If initial stat succeeded for a sidecar, but readFileSync or the after-stat sees it disappear, the code has **observed a change** yet records absence rather than refusing. The remaining comparisons can all see stable absence, and the copied/main image may pass before the original write connection opens. This defeats the chosen contract's defensive rule for changes actually observed before opening, even though external writer support is excluded.

This finding is from the exact source branch, not an executed reproducer. A deterministic owned-fixture regression should start with a present sidecar, let its first stat succeed, remove it or inject the actual subsequent ENOENT at read or after-stat, and prove refusal before any SQLite handle is opened on the original. A truly absent file at the initial stat must still be allowed.

Required narrow repair: distinguish ENOENT on **initial stat** from ENOENT after a successful observation. Only initial absence becomes the absent sentinel; disappearance after stat or read must throw a fail-closed domain error. Retain existing fingerprints, WAL consumption, transaction recheck, all raw migration assertions and owned-copy cleanup. Add both stat→read and read→after-stat deterministic cases; do not rely on sleeps or arbitrary concurrent writers. Main has authorized this narrow repair and the author is implementing it; no new frozen repaired bytes were reviewed here.

## Routing and limits

Preserve this initial limited REQUEST_CHANGES and all original RED receipts. Wait for the new two-file repair freeze, targeted test receipts and narrowly amended support-contract documents. Re-review I2 and those exact document changes; do not reopen the ten unchanged modules or repeat root gates. The earlier full module findings remain separately archived. Planning/Workspace/HTTP/UI/AG02 integration and browser/restart acceptance remain pending; the first window and full KN-01 ticket remain PARTIAL.
