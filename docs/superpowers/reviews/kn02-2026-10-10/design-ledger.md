# KN02 design-only stage ledger

Observed 2026-10-10T17:42:41.589770+00:00; HEAD 84fd8b3add03ac43d8ac160a6ae231fb99fde370.

Explicit delegated model: gpt-6.1-sol high. No independent review claimed. Only the two exclusive documents and this ledger written. No source/test/DB/build/stage/commit/push/spawn or ticket/root-state writes. Concurrent source/interface candidates remain owned by their existing agents; hashes are observed read baselines, not a claim that their whole integration is complete.

Read: AGENTS/workflow skills (using-superpowers/brainstorming/writing-plans), README/state, KN02 and DATA01 tickets; core model/annotations/structure, StoragePort and SQLite guard/transaction, service notes/history/review legacy registry/context, groups/semantic invalidation, POL raw file/queue/intent/finalize/recovery, UI Navigation/workspace and MCP project-scoped tool framework; frozen KN/POL/GRP03 designs.

Main decision accepted: two explicit application domains; DB notes/groups one batch/one invalidation; directory through existing POL queue/one finalize/invalidation. Mixed preview requires separate confirmation, truthful per-domain receipts and fresh second-domain preview; cancellation cannot roll back already successful first domain. No cross-domain recovery platform.

## Frozen design deliverables

- `docs/superpowers/specs/2026-10-10-kn02-design.md` SHA256 `a0b4c376b24dce41afbe1c4d0e51310067c4993e3d39278d46f9e383bbe4d991`
- `docs/superpowers/plans/2026-10-10-kn02.md` SHA256 `fbd83045d2d3fd559d373117bc1f9e32c5247c1e8860a90760109336766d5813`

## Observed exact read baselines

- `docs/tickets/KN-02.md` SHA256 `339c6ddd58db2a441a2cd0dbafd616ae979fd5ebd3f51d103d5b5ab03105e572`
- `packages/core/src/model.ts` SHA256 `a61d1e3fa7fa33b4c50e3416c8c0e82e0f28fb82d8649f30774cdba219ab8abf`
- `packages/core/src/annotations.ts` SHA256 `493df01fd4394d899e7098c19bc1439d2f57aeb07a12decf71ea1d97fe01b5f1`
- `packages/core/src/structure.ts` SHA256 `33bb4eff19ca8ad7ab017a79d8553508131657423a06ebaaf63eb007f3cabf1a`
- `packages/service/src/annotations.ts` SHA256 `ec89d918aef2501bf1e2ba076ffac9ccac15d2dc09c0f5d8843df519e551f581`
- `packages/service/src/annotation-review.ts` SHA256 `22693d71dc9f68bff18944ce39b12e2aaefc2803c8ba054dedc93fa207ad79d1`
- `packages/service/src/knowledge.ts` SHA256 `8f07eda48aafb1992411d0709ebeae7b7f65c0be01a6b5cbd59700b9fcf93c4d`
- `packages/service/src/structure-sync.ts` SHA256 `1634f5fc8a9c006696a75ad68dd3235126cccc66157f1d76163446f19e56d1bc`
- `packages/service/src/structure-state.ts` SHA256 `fb53b296aae51e609b5406d98d5575d32a0f47803e1d8028ed5488e163a9e9c6`
- `packages/storage/src/sqlite.ts` SHA256 `3aef48bfd53d62cfe93fe576d7d46b7bb9e4c84ce5a95d30ce6cc399284f44db`

## Self-review and pending gates

Self-review: bounded strict v1/unknown-version failure; no invented v0 portable format; explicit current-domain binding/member maps; tombstone/orphan preserved; immutable approval/context/legacy registry/history forbidden as input; no silent POL file overwrite/migration; retry/CAS/no-op/once invalidation and two-phase failure evidence specified. No independent APPROVE or product PASS.

Pending main independent design review and shared product windows. KN transaction bulk bridge, POL directory batch intent/finalizer and GRP03 composition support are future implementation conditions, not available interfaces asserted by this design. Product tests and real UI/MCP/disk-restart evidence are planned, not executed. Source writes and tests are prohibited in this design-only stage.

Self-review narrow corrections before first main freeze: exact StructureOperation path confirmed structure-types.ts; portable advanced union parsing separated from runtime unsupported rows; duplicate target decision blocked; stable requestHash excludes preview token/expiry/generated UUID so persisted replay works after restart; terminal receipt lookup precedes new-token validation; directory pending retries recover trusted intent only; source keys explicit for all row types; receipt budget256KiB and existing large groups not silently truncated. No source changes.

Document-only checks (not product tests): newline/whitespace/fences/local Markdown link targets checked; all pass. First independent review pending. Final source read baselines remain recorded above; no root diff/status mutation.

## I1/I2/I3/M1 directed design repair — 2026-10-10T18:00:10.453388+00:00

Main authorized docs-only repair after independent AG03 review completed. Original KN02 review REQUEST CHANGES C0/I3/M1 SHA `f3369ea0f3bc46b3274f53fbfdaf6430a0d592bd769e83aebaa3fd5de7f27239` preserved unchanged. Exact rev0 spec/plan/ledger/review bytes plus SHA manifest stored in `rev0-frozen/` before edits. No product/test/build/dist/DB/stage/commit/push/spawn or root-state/ticket edits.

- I1: terminal→trusted matching pending→absent dispatch before new-token authentication. Samehash pending recovers durable original intent even after expiry/restart/initialunknownIO; no newcandidate/publication. Mismatch/corrupt/terminalfailure states failclosed and cannot become newwork.
- I2: one bounded project import-generation record, success/no_op receipt+generation atomic commit in each domain, rollback/pending/failure/cancel noadvance, receipt replay noadvance. Sibling stale enforced rawHTTP bothdirections including no_op, without knowledgeHash/plan/approval edits for preview invalidation.
- I3: semanticfile OR DBedit OR nonempty source migration -> exactlyoneinvalidate. Equalextension migration no publication/ambiguousintent, exactselecteddelete, structure/plan+1 and preservedhistory; zero migration no_op.
- M1: explicit frozen sourcealias Vitest config in separate clean temporary archive for early tests, no old/shareddist; compiled SDK/browser/entry gate in a second noalias cleanbuild archive, precise manifests/logs and setupFAIL distinct from behaviorRED.

- Revised `docs/superpowers/specs/2026-10-10-kn02-design.md` SHA256 `f9b8c05681b13356777b2e03a452e9126b2832f2b24f2df74c335af554871e61`
- Revised `docs/superpowers/plans/2026-10-10-kn02.md` SHA256 `5f3867aaf27c29563303af6792fc1c44657cf2264ba8ecdce6e8c863ad6a5c7a`

Document-only newline/whitespace/fence/local-link checks pass. All future rawHTTP/noop/retry/pendingunknown/restart/mixed-domain atomic-boundary tests are plan entries, not executions or PASS. Await original independent reviewer; KN02 DESIGN ONLY remains unfinished product.
