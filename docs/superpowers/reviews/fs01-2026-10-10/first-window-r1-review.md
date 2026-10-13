# FS-01 R1 — independent limited source re-review

Reviewer: `/root/ci_repair`, GPT-6.1-sol, high reasoning. Date: 2026-10-10.

**APPROVE — Critical 0 / Important 0 / Minor 0**, limited to the original first-window I1/I2/M1 repairs in the three frozen R1 files. The original source REQUEST_CHANGES remains unchanged. This approval does not approve later UI wiring or declare full FS-01 DONE.

## Exact scope and preserved baselines

VM2 exact R1 bytes: `/tmp/atlas-fs01-r1-snapshot`; comparison bytes `/tmp/atlas-fs01-r1-before`. Manifest `/tmp/atlas-fs01-r1.sha256` hashes to `7fb13027a2253894d97e8a2aac3565318121af5b6bb0ca60ffd7c300d65aa5bd`; all three checks returned OK.

| R1 path | Frozen SHA-256 |
| --- | --- |
| `apps/web/src/features/planning/FunctionForm.tsx` | `f76830dad5f825f6ca76f50906e32a63cdd56a0a9027866b0c86bd88c29a9e5d` |
| `apps/web/src/features/planning/PlanEditor.tsx` | `3ff6c7fdeb66f4d815a5ef4d914192a497922a04463769f89e8196c8dfa00a44` |
| `tests/e2e/ownership-form.spec.ts` | `c730eeab1decba3f1a1a598c0b0ad41297c2de596ae5c8392a5dc65dc1abb9f0` |

Three-file R1 patch `/tmp/atlas-fs01-r1.patch`, 31,100 bytes, SHA `02b6471b519f68f1160c1075981970e9f9aef68cb1e989e46cf6e45bd1dbf59a`.

Original nineteen-file snapshot `/tmp/atlas-fs01-first-window-snapshot` still passes all nineteen manifest hashes; its manifest remains `ac862e8aac6af8d6ddcf3d73096a759d7bf0b74e10275728d3f92859709f27ed`. PlanningPanel is unchanged in R1. The original source report `fs01-first-window-code-review.md` remains SHA `39d4ac45d36d716ae08b5ce25199f2d0ee4021448a662027da6cf9958cb6a5bd`, REQUEST_CHANGES C0/I2/M1.

Read-only support bytes `/tmp/atlas-fs01-r1-support` pin the actual source Workspace controller, HttpApi, ProjectScope and PlanningPanel used by the fixture. Support manifest SHA `d8a5f585076d29fdbb70790267946684258e325b49b95c80d681098397b4ed13`; all four checks returned OK. These supporting reads establish busy/error/Validate/agent-sync interfaces; they are not additional R1 product changes or approval of future mutating checkout content.

I read only the frozen source, supporting interface bytes, first-window/R1 reports and execution evidence, and checked hashes. I did not edit source/tests/docs/index, run tests/builds/root gates, spawn agents, or change the frozen CI patch.

## I1 closed: exact pending save plus local generation protects a newer draft

PlanEditor captures projectId, planId, baseline snapshot ID/hash, submitted revision, serialized operations and submitted title/description. Its matching ACK requires the same context, exactly revision N+1, and exact operations/metadata. A matching or conflicting accepted advance/context change retires the parent pending claim; failure at the old accepted revision deliberately retains the claim for recovery.

FunctionForm records its edit generation at submit. Every later field edit increments the generation. The ACK consumes that submission but clears its draft only when the current generation still matches; a newer draft keeps its original basis and becomes stale against the accepted revision. Explicit reload increments generation, drops its submission claim and clears only that form. Identity close/remount discards local state through the existing identity key, without restoring revision-based remounts.

The source/controller regression now exercises the real reachability condition raised in the initial review: save A, assert `busy=true` and disabled input, fail the already-committed response, assert unlocked old r1 state, edit B, invoke actual Workspace Validate → HttpApi plan reread → acceptPlan(A/r2). The original frozen implementation's meaningful RED says expected `draft/B.ts`, received `dest/A.ts`. R1 asserts B remains visible, dirty and stale; stale submit and confirmation remain disabled while the server-saved operation remains A. This resolves I1 without pretending typing into a disabled production input is possible.

## I2 closed: add and selected-function drafts have independent revision/dirty/ACK state

The add form now receives the context/revision basis and its own pending-save ACK. Its `addDirty` is separate from selected `functionDirty`, and both are aggregated with metadata dirty. Clearing/reloading one form cannot mark the other clean. The source tests exercise each clearing direction while another draft remains, and confirmation stays blocked.

Dirty add propagates into the actual Workspace dirty flag, so source agent-sync can update the latest plan list without adopting a new current editing revision. Explicit form reload clears its own draft and allows the controller's existing current/latest adoption. A separately accepted revision preserves an add draft but marks it stale and blocks submit. Successful unchanged add ACK clears the form; recovered add ACK preserves later unsent add input. The unchanged recovered add test also confirms selected function `f` remains present, so its reset is not obtained through a selection remount. I2 is closed.

## M1 closed: metadata ACK advances its basis without discarding later text

Metadata submits now capture the exact pending tuple and local generation. A matching ACK with unchanged generation updates metadataBasis to the accepted title/description/revision; the next edit is enabled without a false stale conflict. Later title/description edits increment the generation and remain visible/dirty/stale when the old submitted title is recovered. Explicit metadata reload retires the pending claim and resets its accepted basis. The original remote-title conflict case remains. M1 is closed.

## Actual execution evidence and its limits

- `/tmp/atlas-fs01-r1-controller-red2.log` and its results retain **four meaningful frozen-source RED** cases: lost-response/Validate erases B, component add dirty=false, real-controller add dirty=false, successful metadata ACK dirty=true. I read their actual failed assertions. Earlier Vite resolution errors and wrong translated summary selectors are retained as harness failures, not product RED claims.
- `/tmp/atlas-fs01-r1-final-form.log`: **14/14 source Chromium tests PASS, 14.4 seconds**. Read the final tests and log: the original four cases remain, plus newer-generation ACK, add staleness/confirmation, real busy/lost-response recovery, actual agent-sync behavior, metadata ACK and changed-title recovery, successful/recovered add, independent dirty aggregation and unchanged-add recovery without remount.
- Scoped three-file lint and web noEmit logs are empty; the author report records exit 0. These are existing author receipts. I did not independently rerun them.
- The controller fixture imports actual `createWorkspace`, `HttpApi` and PlanningPanel/PlanEditor/FunctionForm, while its fetch callback simulates persisted server state and response loss. This proves the frontend call/state path, not real production HTTP/SQLite/network behavior or compiled whole-application native dragging. The earlier 38 unit/integration passes and four initial Chromium passes remain historical first-window results; they were not newly rerun by this repair or this reviewer.

No remaining Critical, Important or Minor finding is raised in this exact R1 scope. Full Canvas/native pointer gesture, independent target preview/save wiring, required expectedSnapshotId on all ownership/advanced saves, physical source-path/provenance and stale source response behavior, effective-path consumers, and main-controlled compiled integration gates remain pending. No source move/write, executor, IDX-04 identity change or full production gesture proof is inferred from this review.

## Routing

The coordinator may continue the paused second integration window with these frozen repairs. Preserve the initial REQUEST_CHANGES report, original nineteen-file snapshot and meaningful RED receipts; keep this final limited APPROVE as a separate artifact. Later shared interfaces and real application acceptance need their own review/gates. Full FS-01 remains PARTIAL.
