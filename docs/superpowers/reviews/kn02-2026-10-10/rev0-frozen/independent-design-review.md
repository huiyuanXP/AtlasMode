# KN-02 independent design review

2026-10-10 UTC. Reviewer `/root/ci_repair`, explicitly assigned GPT-6.1-sol high, independent of the design author. **REQUEST_CHANGES: Critical 0 / Important 3 / Minor 1.** This is a design review, not product implementation approval.

## Scope and frozen bytes

Read-only full review of VM2 `/home/agent/projects/AtlasMode`:

| Document | Before SHA256 | After SHA256 |
| --- | --- | --- |
| `docs/superpowers/specs/2026-10-10-kn02-design.md` | `a0b4c376b24dce41afbe1c4d0e51310067c4993e3d39278d46f9e383bbe4d991` | `a0b4c376b24dce41afbe1c4d0e51310067c4993e3d39278d46f9e383bbe4d991` |
| `docs/superpowers/plans/2026-10-10-kn02.md` | `fbd83045d2d3fd559d373117bc1f9e32c5247c1e8860a90760109336766d5813` | `fbd83045d2d3fd559d373117bc1f9e32c5247c1e8860a90760109336766d5813` |

Compared the proposed contracts with the actual KN-02 ticket, KN annotation schemas/target selection/orphan latch, annotation storage/history/context/legacy-registry interfaces, existing group persistence and invalidation, POL operation/intent/request-digest/no-op interfaces, and the existing POL migration design. Also inspected actual package exports and Vitest resolution for execution feasibility. These necessary interface reads do not constitute a review or approval of in-progress POL R1/PERF R1 code. No product, target-document, database, build/dist or index changes, tests, builds, staging or agent spawning occurred; only this local report was written.

## I1 — General apply ordering conflicts with expired/restarted pending-directory recovery

**Important.** Spec **127–129 versus 153–155**; plan Task 2 **61**, Task 3 **74**, Task 4 **83–89**.

The general flow says that when no immutable terminal receipt exists, a new token must be authenticated before entering the POL queue and reading recovery state. Tokens expire after ten minutes and all old tokens become invalid on process restart. The directory-specific flow separately promises that same-request pending retries recover the existing intent without using an expired token to create/replay new work.

Those statements need an explicit precedence rule. A published intent can be durable while finalize/receipt creation has failed; there is then **no terminal receipt**. After token expiry or restart, the general flow rejects the original request before it can reach the promised pending recovery. Re-preview may itself be blocked by that pending intent. Startup recovery can handle immediately readable cases, but does not resolve this ordering for an intent that remains pending due to temporary unknown I/O and becomes readable later. Existing POL explicitly preserves that case as retryable pending rather than a terminal conflict.

**Required narrow repair:** Define three server-side branches before authorizing new work: trusted terminal receipt; matching durable pending directory intent; absent mutation. Scope/access and strict request parsing/hash calculation still come first. Terminal same-request replay returns its existing immutable outcome. Pending same-request retry must match the trusted intent's project/domain/mutation/request hash and restore only that intent through the existing queue, even when its old preview token no longer authenticates; it must not replace its generated IDs/patches/guards, publish a new candidate, or accept another payload. Only the absent/new branch requires a fresh valid signed preview. State mismatched, aborted/failed/conflicted and corrupt-receipt/intent behavior explicitly. This is a narrow existing-POL recovery dispatch, not a cross-domain recovery platform.

Add Task 4 tests for durable pending + **no terminal receipt** + expired token, pending + restarted HMAC key + initially unknown I/O then readable afterDigest, same ID/different payload, and new/absent mutation with an expired token. Require once-only recovery/invalidation, preserved original request/candidate, and no unauthorized new publication. Current terminal-receipt restart tests do not cover this branch.

## I2 — A first-domain no-op cannot invalidate the second token with the listed guards

**Important.** Spec **127, 133, 139–143**, acceptance **175**; plan Task 5 **96–99**, Task 6 **109**.

The product contract expressly requires a fresh preview of the other domain after **any** first-domain success, including no-op, and says the old second-domain token returns 409. The signed guards currently include snapshot, knowledge/plan digests, structure revision/file digest, package/decision hashes, generated IDs and expiry. A true no-op changes none of those guards; only an import receipt is recorded. That receipt is not included in the defined knowledge/plan guards.

Thus preview both domains, apply an equal replacement/no-op in the first, then send the original still-unexpired second token directly to HTTP: the listed server checks still pass. UI discarding that token does not enforce the service contract. This is a design counterexample, not a runtime claim about unimplemented source.

**Required narrow repair:** Add a bounded server-issued preview/flow generation or equivalent receipt-bound guard that changes after each first-domain terminal success/no-op and invalidates the sibling preview. Bind it to the target project/appropriate transfer scope and signed token; specify its update with the successful/no-op receipt and its behavior on rollback, retry and restart. Replaying an existing receipt must not advance the generation again. Preserve the selected two-domain model and separate confirmations/results; do not invent global cross-ticket coordination or change plan/annotation revisions simply to invalidate a preview.

Test both application orders, especially equal/no-op first-domain success, raw HTTP reuse of the old sibling token, fresh re-preview, lost-ACK terminal replay, foreign-project isolation and unrelated view-only changes. Verify old sibling token 409 and no second-domain mutation before the fresh explicit confirmation; UI partial/cancel display remains a separate acceptance gate.

## I3 — Equal-extension explicit migration needs the existing POL source-change trigger

**Important.** Spec **111, 149–155**; plan Task 4 **85–89**. Existing POL spec **98, 105**.

The directory batch currently states that file semantic change or substantive DB-only policy edit triggers once-only plan invalidation. It does not explicitly include a nonempty **source migration** when values and document digest remain equal. Existing POL deliberately treats that as a third independent trigger: an equal extension already covering DB-only records still changes their authority/source when those DB records are removed. The existing contract requires structure revision and current plan revision +1, immutable approval preservation, and no file rewrite or ambiguous beforeDigest==afterDigest publication intent.

KN-02 permits editing and explicit migration in one batch and extends finalize/recovery, so this case must remain explicit. Otherwise equal document/value comparison can classify the source transition as no-op, or unnecessarily create a publication intent whose before/after digests cannot distinguish recovery phases.

**Required narrow repair:** State the batch trigger as the logical OR of file semantic change, substantive DB-only edit and nonempty actual legacy source migration, with only one invalidation for a mixed batch. Define the equal-extension migration as the existing no-publication synchronous finalize: validate exact legacy before-values/owner, delete only selected captured records, store source-transition audit/import receipt, advance structure/current plans once. Zero migration and genuinely unchanged data remain no-op; retries/recovery remain once-only. Reuse the existing controlled POL branch rather than adding a recovery platform.

Add explicit equal-extension/nonempty migration fixtures with unchanged file bytes/digest, no publish call/ambiguous intent, one revision/invalidation, exact selected-ID deletion and preserved approval/history. Include mixed file+DB-edit+migration and zero-migration cases. A generic changed-file migration or batch counter test cannot substitute for this existing authority-transition boundary.

## M1 — Early source tests need an explicit frozen resolution harness

**Minor.** Plan Tasks 2–5 targeted `npx vitest` commands and the implementation prerequisites.

Actual `@codemap/core` and `@codemap/service` package import exports resolve to `./dist/index.js`. The root Vitest configuration has no source aliases. The plan creates new core/service public APIs and runs their consumers before the later main-controlled compiled gate, but does not state how those tests resolve the new frozen source without writing shared dist. Adding an index export does not update the already-built package.

Specify a main-approved frozen-source alias configuration or an isolated scoped compilation step, with the exact source/compiled manifests and commands, before cross-package GREEN claims. Preserve the existing compiled production browser/SDK gate separately. An unresolved new export is setup failure, and a previous ticket's dist is not evidence of the new import implementation.

## Passed design contracts and executable acceptance conditions

- The chosen two application domains match the authorized product decision: notes/groups share one synchronous DB transaction and once-only invalidation; directory knowledge uses POL's queue, intent and finalize. Separate confirmations and receipts honestly retain first-domain success when the other domain fails/cancels. No all-package atomicity or cross-ticket recovery platform is promised.
- Strict v1 package/schema validation and a separate StructureDocumentV1 version prevent guessed v0 migrations or future-version interpretation. Byte/depth/value/item/action/preview/token/receipt limits include unknown directory JSON, reject excess rather than truncate, and do not pretend `StoragePort.list` is streaming. Budget changes cannot be client-enlarged.
- Import payloads cannot select storage kinds/settings keys, import approvals/approved contexts/legacy allowances/history, restore projects/snapshots/plans or execute source. New local identities/timestamps/revisions come from the service. New source is user; replace preserves existing source, with package provenance only in service-controlled receipts.
- Origin IDs and titles/content are hints, not identity authority. Exact target/project/snapshot selection, annotation revision/tombstone checks, complete group content CAS and explicit member mapping preserve domain IDs. Alias/group-card/temp/overlay IDs are rejected as facts. Orphan remains latched until explicit rebind; tombstones cannot be resurrected by replace. Partial/unavailable capture is not an absence proof. Group capability adaptation is read-only; advanced composition remains explicitly unsupported until the real GRP-03 contract is accepted.
- The actual annotation APIs each invalidate independently; the proposed owner-provided internal transaction bridge correctly avoids looping those APIs. It preserves existing immutable revision rows while recording one final combined edit/bind revision, strict local history actions and once-only project-plan invalidation. The existing invalidator has safe revision exhaustion checks, which must continue to roll back the entire batch rather than overflow or partially write.
- HMAC key generation is server-owned and tokens bind project/domain/package/decisions/generated IDs/current guards. Stable request hashes exclude token expiry and server UUID choices for receipt replay; a client hash is not trusted. Immutable terminal receipts, exact conflict ownership, selected-record validation and transaction rollback are appropriate, subject to I1/I2.
- Directory row/root-unknown differences are explicit selections, untouched target rows/extensions remain intact, and natural allowed/forbidden duties do not become executable legacy path constraints. The future type-safe batch entry must enqueue once, keep awaits outside SQLite transactions, preserve POL candidate/actual digest distinctions and block stale finalize guards. It must wait for the real accepted POL claim/recovery contract rather than copy an in-progress sibling API.
- Real UI download/upload/difference/member-mapping/confirmation/receipt/reload flows, both language and keyboard/narrow-screen paths, HTTP/SQLite proof, source/history SHA invariants, owned before/after/third restart fixtures and actual SDK tool discovery/results are defined future gates. MCP stays read-only with bounded payloads and no apply/rebind/approve capability. A source panel/helper test is not the compiled product acceptance gate.

## Context fingerprints and handoff

Necessary interface context fingerprints (these are not a new source-review approval):

| Path | SHA256 |
| --- | --- |
| `packages/core/src/annotations.ts` | `493df01fd4394d899e7098c19bc1439d2f57aeb07a12decf71ea1d97fe01b5f1` |
| `packages/service/src/annotations.ts` | `ec89d918aef2501bf1e2ba076ffac9ccac15d2dc09c0f5d8843df519e551f581` |
| `packages/service/src/knowledge.ts` | `8f07eda48aafb1992411d0709ebeae7b7f65c0be01a6b5cbd59700b9fcf93c4d` |
| `packages/service/src/knowledge-revisions.ts` | `1b551973450e1b6897c9f8d5b554fbe8519060fabc4e47e439c65097a1fe273a` |
| `packages/core/src/structure-types.ts` | `7da4e4b82021b1430f6623b2a1b06a8eb239eefefc481ef334f84f40bf7947bc` |
| `packages/service/src/structure-state.ts` | `fb53b296aae51e609b5406d98d5575d32a0f47803e1d8028ed5488e163a9e9c6` |

Repair I1–I3 narrowly in the two documents and clarify M1's executable test harness. Preserve passed protocol/scope/history/source contracts and this original report, freeze new hashes, and request limited independent re-review. Product windows remain contingent on accepted KN/POL/GRP interfaces and main's owner coordination. None of the proposed tests or features has run in this review; KN-02 remains DESIGN ONLY, not DONE.
