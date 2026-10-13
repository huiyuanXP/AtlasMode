# KN-01 pure UI window — independent source review

Date: 2026-10-10. Reviewer: `/root/grp01_design/grp01_implement`, explicit `gpt-6.1-sol high`; not the author. Outcome: **APPROVE for the frozen pure UI window — C0 / I0 / M1**. This is not approval of a wired product or KN-01 completion.

## Scope and freeze

Read-only review of the 10 new paths named by VM2 `/home/agent/projects/AtlasMode/.superpowers/sdd/2026-10-10-kn01/freeze-ui-window.sha256`, and its author receipt. Before/after verification found the manifest and receipt equal to the supplied hashes and all 10 source entries passed `sha256sum -c`.

- Manifest SHA256: `d1efc480a1dd7350769beedcc8a3f198c797d15cbaf58fc1f078bcdd2b8e806e`.
- Receipt SHA256: `9e9a501de98bdf79d5c47c211e2ea6fec9d87f23ec2307ee743fe391bbcfa8bc`.

All product locations below are relative to that VM2 checkout. No source edits, test executions, builds, database access, staging, spawning, or process operations occurred in this review. The sole new artifact is this local report.

| Reviewed path under `apps/web/src/features/annotations/` | Frozen SHA256 |
| --- | --- |
| AnnotationHistoryView.tsx | 0599147a53270aae52f6871e9de2a673cfeac8dbcbb567a4d7c53d631d02dc1c |
| AnnotationRecord.tsx | fc8dfdac3cebcc537ce689239792d516eb0815bfe61394fb008f020012fe5e1f |
| AnnotationsPanel.test.tsx | 2d64c884535cb2ef0377492832b460b7119b38bfb6702e25f221c92f9942906a |
| AnnotationsPanel.tsx | c9ee35ce8f3cab99d41305ca412f0cfa0bd3962e0251996ae36e4d00e288a401 |
| annotations.css | 8d88d303533aeb4e782f1e3f6c793f5ca863aa21f18451d12b7321a4863fe134 |
| draft.test.ts | 49bdc1ead13208a1202a86f272806cec669255eba6b19738b73ccc878249d72e |
| draft.ts | 0c3183f6e8a6cbb23c80065ff8e8cd1e6065e40e2d0ada8483b99a6154ba6427 |
| fixtures.test-support.ts | 02d69989fc41c2e9338c79c6cbaeafca012868a321b8551651f2e74982418afc |
| labels.ts | 6db3e79947e537d27dda6631814b07829afa1e091d54b7a20f082d81bb7ed493 |
| reads.ts | 4e5bd211d78d90529d992e9fc57977c321b3600d6086d604b6826f65abac26b6 |

## Findings

### M1 — empty history pagination displays an inverted range

Location: `apps/web/src/features/annotations/AnnotationHistoryView.tsx:117` (range expression at lines 118–120).

For a valid empty history page `{offset:0,total:0,items:[],limit:20}` with `onPage` supplied, the component correctly shows “No recorded revisions”, but its pagination range is `1–0 / 0`. The current-list pager already special-cases zero total in `AnnotationsPanel.tsx:264`. Apply the same zero-total display rule to the history range and add a pure SSR assertion. This is a presentation defect; it neither enables a write nor misrepresents an approval context as current knowledge, and is nonblocking for this window.

No Critical or Important findings.

## Source checks and reasoning

- **Controlled callbacks and mutation start:** `AnnotationsPanel.tsx:144` and `:156` emit state and then the request, without fetch, promises, optimistic persisted records, or a synthetic success fallback. `draft.ts:324` gates pending/uncertain/deleted/stale revision states, creates strict core request payloads, and captures scope, exact project+note key, sequence and submitted local generation. The author receipt at line 15 explicitly requires the future adapter to publish the started state before network work and apply a response against the latest state with its original token. That sequencing remains an integration requirement, not evidence proved by this stateless panel.
- **Project+note isolation and A→B→A:** `draft.ts:25` and `:32` serialize exact scope and draft identities. `:147` preserves drafts and per-project active note, clears obsolete pending/candidate/error/confirmation state and marks an abandoned sent write uncertain. `:420` requires the pending token's scope/key/sequence/generation to match; an old epoch response cannot update the returned-to-project draft or a new request. `AnnotationsPanel.tsx:72` hides a mismatched editor; `reads.ts:25` separately filters project/snapshot/epoch reads. Epoch advancement is explicitly required by the adapter contract, rather than inferred from project IDs.
- **Local edits and late/unknown ACKs:** `draft.ts:246` increments local generation; `:460` checks actual reply ownership, CAS revision, content, immutable source, selected binding provenance and optional resolution snapshot. `:539` refuses to regress an already observed newer server revision. `:545` updates the request's keyed draft and only changes active selection if that request's draft is still active; newer local text is retained and gets the acknowledged base revision. A project scope change makes old ACKs inert. `:194` observes a server record without treating content equality as an ACK; dirty/uncertain state retains its original base. Unknown failures remain blocked until the separate explicit discard/use-loaded-version decision at `:272`. New creation identity comes from a valid matching reply, never from searching a same-text list row. The actual panel disables note selection and further mutation while pending (`AnnotationsPanel.tsx:195`, `:234`, `:373`, `:417`), while leaving content inputs editable (`:307`).
- **Deletion:** `draft.ts:311` pins confirmation to the active draft's base revision; `:194` closes confirmation when a newly observed server revision differs. `:379` requires matching confirmation revision, and `:471` accepts only the same note and expected+1 deletion receipt before making a strict tombstone. Opening another note, changing scope, or editing body clears confirmation. The deleted local buffer remains readonly, not silently erased. Detach remains a distinct binding request.
- **Binding/current facts:** `draft.ts:287` verifies project and current snapshot and delegates exact node/relation eligibility to `selectAnnotationTarget`; this module performs no fuzzy matching or visual-ID normalization. Candidate confirmation emits real target namespace/domain ID/snapshot and expected revision. An existing-note binding ACK compares accepted body while preserving independently unsaved body. `AnnotationsPanel.tsx:81` additionally rejects a candidate no longer matching the actual supplied selection, before exposing a confirm callback; `:439` shows kind/subkind, file, ID and snapshot. New bound creation requires explicit confirmation; cancellation or an expired candidate cannot be silently carried into unbound save. These conclusions concern the module's delegation and inputs, not a fresh independent review of the previously approved core selector.
- **Metadata and historical origin:** `AnnotationRecord.tsx:23` preserves author, immutable creation source, constraint flag and revision, renders text through React, and displays captured target provenance. Current resolution labels are only shown in current mode (`:44`), so historical targets are not labeled as currently resolved. `AnnotationHistoryView.tsx:33` validates project/note ownership for rows; `:56` separates approved context and validates its core schema/project, intentionally showing its historical capture snapshot rather than requiring it to equal the current snapshot. `:141` labels legacy unrecorded context explicitly. This view does not claim cryptographic/server provenance validation. Recorded history and approval contexts are readonly; no mutation controls are inserted into them.
- **Read failures and presentation:** `reads.ts:35` guards page structure, limits, ownership, tombstones and supplied resolution snapshot; malformed rows result in the read-error UI. Local bilingual strings are complete and source/constraint semantics are explicit (`labels.ts:69`). CSS is limited to the annotations classes with a 950px responsive rule. Its actual mounted layout remains unverified.

## Evidence boundary and remaining gates

The author receipt reports **41 passed tests: 24 draft tests + 17 panel tests**. Inspection of `AnnotationsPanel.test.tsx:3`, `:42` and `:56` confirms React SSR plus direct invocation of the actual stateless JSX callbacks; these are not mounted DOM or HTTP tests. `draft.test.ts` covers exact CAS, invalid target namespaces, A→B→A epoch, newer local body, unknown writes, malformed ACKs, deletion confirmation, and selected binding provenance. Fixture records are explicitly test-only. I did not rerun these suites or independently verify their raw execution logs, and do not broaden the receipt's claim.

The author also reports scoped lint and source-alias noEmit success, while retaining the ordinary web noEmit failure caused by stale compiled core declarations. This review does not turn that retained failure into a build pass.

Still required in an authorized integration window: wire actual facade/HTTP reads and writes, advance/synchronize project/snapshot/selection epochs correctly, process actual ACKs against the latest state, refresh current and selected plans without destroying independent plan drafts, connect true graph selection and navigation, and obtain mounted browser/HTTP/CAS/restart/narrow-layout receipts. No SDK, database persistence, shared-plan invalidation, browser screenshot or KN-01 DONE claim follows from this approval.

Final freeze verification: supplied manifest and receipt hashes unchanged; all 10 frozen source entries verified OK after the read-only review.
