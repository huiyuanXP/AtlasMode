# FS-01 first-window independent source review

Reviewer: `/root/ci_repair`, GPT-6.1-sol, high reasoning. Date: 2026-10-10.

**REQUEST_CHANGES — Critical 0 / Important 2 / Minor 1.** This is an actual frozen-source review, not reuse of the earlier design APPROVE. Full FS-01 remains PARTIAL; full-application gesture, source request, and shared integration acceptance remain pending.

## Exact review scope

VM2 exact frozen bytes: `/tmp/atlas-fs01-first-window-snapshot`. Manifest `/tmp/atlas-fs01-first-window.sha256`, SHA-256 `ac862e8aac6af8d6ddcf3d73096a759d7bf0b74e10275728d3f92859709f27ed`. All 19 checks returned OK. Patch `/tmp/atlas-fs01-first-window.patch`, SHA-256 `b7a831caed7b4a1a451d00b3c00d699557a387a7520c48c55478acb155587a03`. Tracked baseline `/tmp/atlas-fs01-first-window-before`, HEAD `619c39a82a4a9d6d3d8c8dec2a8846f7f00d52f2`.

| Frozen path | SHA-256 |
| --- | --- |
| `apps/web/src/features/planning/operations.ts` | `f4ad503d3043ac62107b5bafff1e0e034db954a4da4df26d1fcadc25f8e7d8fc` |
| `apps/web/src/features/planning/function-target.ts` | `5018603331e0b9b984ff68ea3b8fc65dc873fff5fe919e5efb70ad4ca7b8fe27` |
| `apps/web/src/features/planning/function-target.test.ts` | `d428dfc48649553a3fc6e40cf877f3eae1243710bcbb0769c3816ef526d8df89` |
| `apps/web/src/features/planning/FunctionForm.tsx` | `d244a8e9b199122cb2437f225f36acc730ada215b0e29615fcf978da76fbcd9e` |
| `apps/web/src/features/planning/PlanEditor.tsx` | `aa466e3dbf139a5ca18b7b1f86ca28434d99d6e57db746e4c0c4d4cb84565eb1` |
| `apps/web/src/features/planning/PlanningPanel.tsx` | `bc32718d18e105f6884fadefdadb6a2d2dcc1fe505253e56989acf9e23baff01` |
| `apps/web/src/api/client.ts` | `d5bbe93903474b85cb70e314fbbe610f8c04071095dc0e1ff0c0740fef66bd29` |
| `apps/web/src/api/ownership-request.test.ts` | `27d2d7ccef9a772c0da85ef445c1b443c7a8fef14362d44006ba65cc2838dc70` |
| `apps/web/src/features/structure/ownership.ts` | `733dfc18518b8a3f3f330a6213657992bab250e37b444cc62cf29da1416be15a` |
| `apps/web/src/features/structure/ownership.test.ts` | `b55e2d12a15a715f338c6292e16b368a1b6e263d92c921102d8051d2a3c113f4` |
| `apps/web/src/features/structure/ownership-controller.ts` | `f19a6d3e696c13848a50c8d6250f93123cb4f0712df0d81dbfa73757e5839856` |
| `apps/web/src/features/structure/ownership-controller.test.ts` | `45474635f293d42b80a14909b258ced3b0668ea84392f8261d768559a6c0f34b` |
| `apps/web/src/features/structure/OwnershipTargets.tsx` | `4c9880d75005cc22d14f4a27809c8d8be8f195470a2ebbc0e47b29fd35629e2f` |
| `apps/web/src/features/structure/OwnershipTargets.test.tsx` | `e11db867eac682951229c718650435ea9ecff3cec7375d6f67199c63fefbaa0e` |
| `packages/service/src/planning.ts` | `487cad592b48b6bf2c38dbe6e63e8093eb49ef8b7487b6ce6f6db02be1c422e8` |
| `packages/service/src/workspace.ts` | `45d17cc730e0ca9774cc85f0b4155cefd9d9c85c8da04dd2559c823233fa3c46` |
| `apps/server/src/routes.ts` | `18ad7fc150093853fa9ea68859eab205fb8bda164b4d658810eac56f179dab90` |
| `tests/integration/fs01-precondition.test.ts` | `66d5f629f9402c7e8fc5cf4975a49df16d141e023111cd6b82e499da6e2a7e30` |
| `tests/e2e/ownership-form.spec.ts` | `9af5c83b374f1125016750bf989fe93a10819667b089b94c3ce22d2b6e06a2ea` |

Read-only supporting interface inspection used `git show 619c39...:apps/web/src/app/workspace.ts` and `WorkspacePanels.tsx`, to establish actual busy, dirty, save/error, Validate, and agent-sync call paths. Those files are not part of the reviewed implementation diff. I did not review the author's later mutating UI wiring as frozen product evidence. No source/test edits, tests, builds, root gates, index changes, commits, or spawned agents occurred. The frozen CI fixture patch was not touched.

## I1 — Important: a recovered old save can erase a newer function draft

Location: frozen `FunctionForm.tsx:49–51`; `PlanEditor.tsx:23–26`, `:57–60`, `:202–209`.

`pendingFunction` records only the submitted plan revision and serialized operations. A subsequent plan with revision N+1 and those operations becomes `saveAcknowledged`; FunctionForm's effect unconditionally clears its current draft. It does not establish that the current draft is still the submitted edit or the same local edit generation. There is also no failure/cancellation channel that retires the pending record.

I checked the real busy path. `WorkspacePanels` supplies plan/project/knowledge busy to PlanningPanel, and `Workspace.savePlan` sets `busy.plan=true` synchronously before awaiting the request. The disabled fieldset normally prevents typing a newer draft during an ordinary successful save. Therefore, the simple component-fixture sequence A → Save → type B while pending → ACK is **not proof of the normal production success path**.

A real recovery path remains reachable in the unchanged baseline interfaces:

1. Submit function edit A at rN. The server commits A/rN+1, but the response fails or is lost. `Workspace.run`'s failure handler sets `busy.plan=false`; the component retains `pendingFunction`, A and the old detail.
2. With the actual fieldset unlocked, edit the same function to B. B is dirty against the old accepted basis.
3. Click **Validate**, which remains enabled for a dirty form. `Workspace.validate` calls `api.validate`, then `api.plan`, then `acceptPlan` without unmounting the same project/plan/node editor or asking to discard its draft.
4. The returned persisted A/rN+1 matches the old pending operations, and the ACK effect clears B. The form now shows the accepted A and reports clean, although B was never submitted.

This is a source-path deduction, not an executed production reproducer. It does not depend on typing into a disabled input, `choosePlan` remounting the editor, or treating Validate as an explicit discard. The existing Chromium ACK case only submits and immediately accepts that submission; it does not exercise changed-draft recovery.

Required targeted repair: bind acknowledgement clearing to the exact submitted edit/local generation and accepted project/plan/snapshot/revision context; preserve a newer draft and mark it outdated. Make failure/cancellation/pending retirement explicit as appropriate. Do not fix it by adding a timeout, disabling all recovery, or clearing text on every accepted revision. Add a source/component regression with real busy=true while pending, unlock after a simulated committed-but-lost response, type B, receive A through Validate, and assert B remains visible/dirty/stale and approval remains blocked. Retain the successful unchanged-draft ACK case.

## I2 — Important: the add-function form escapes the new revision/dirty guard

Location: frozen `PlanEditor.tsx:179–187`; `PlanningPanel.tsx:74–78`; `FunctionForm.tsx:30–38`, `:45–48`.

PlanningPanel correctly removes revision from the editor's React key to retain unsaved inputs. The selected-function form receives a revision basis and reports dirty state, but the **add-function** FunctionForm receives neither `revisionKey` nor `onDirtyChange`. Its accepted fields are always empty, so its accepted key does not change when the same plan's revision/snapshot changes. Its local dirty draft survives the removed remount, is never marked stale, and never contributes to `semanticDirty` or `Workspace.dirtyPlanEditor`.

Concrete system effect using the unchanged real call boundary: enter a new function name/path; the parent still reports clean and permits Confirm current revision. `syncAgentChanges` treats that editor as not editing and may accept a new same-plan revision while preserving the same editor identity. The add draft remains visually present and its Add submit remains enabled against the new revision, with no stale warning or explicit reload requirement. A successful add also lacks a submission-specific acknowledgment/reset; the old revision remount previously reset the form, while the new stable-key form retains its submitted fields without representing that dirty state upstream.

The last behavior alone is a UX regression; the missing revision basis and upstream dirty signal are the Important part. They violate the dirty function-form contract and can allow approval/ownership actions while a function draft is unsaved. This finding concerns this frozen first-window form integration, not the still-pending Canvas gesture implementation.

Required targeted repair: give add drafts the same accepted plan/snapshot revision basis and an independently aggregated dirty signal; do not let the selected-function callback overwrite add dirty state. Preserve the add draft across an accepted revision while blocking stale submit until explicit reload/discard; clear only an unchanged submitted add draft on its own acknowledgment. Test dirty Add → accepted revision/agent sync, dirty Add → approval guard, and successful Add with/without subsequent edits. Keep existing authored annotations intact.

## M1 — Minor: a successful metadata save remains falsely dirty/stale

Location: frozen `PlanEditor.tsx:18–22`, `:52–71`, `:96–99`.

Metadata dirty compares title/description against `metadataBasis`; that basis is updated only when metadata is already clean or on explicit reload. Submitting a changed title/description does not record a pending metadata submission. After the server successfully accepts those exact values at the next revision, the local values still differ from the old basis, `metadataDirty` stays true, and `metadataStale` becomes true. The already-saved title presents a conflict and blocks further save/approval until manually reloaded.

Required targeted repair: recognize a matching metadata submission without discarding later edits, update its accepted basis, and test unchanged-title ACK versus title edited again before recovery. Preserve the existing remote-title conflict case. This is a false conflict/usability issue; no data loss is asserted for M1.

## Passed source review and evidence limits

- `Planning.update` rereads the authoritative plan and snapshot inside the same injected synchronous storage transaction used by `WorkspaceService.storeSnapshot`. The optional snapshot precondition rejects current-ID mismatch before write, and then rejects a fresh ID paired with an old baseline/hash. Plan parse/put/returned detail remain in the transaction. Omission deliberately preserves legacy behavior. The HTTP parser/service facade forward the new field; ownership wrapper requires a nonblank snapshot and serializes the captured revision/snapshot.
- The disposable real-SQLite/HTTP tests cover S1-before-save refusal with unchanged plan/approvals, save-before-S1 acceptance followed by stale status, baseline/hash/foreign/revision conflicts, another project's refresh, malformed fields and legacy omission. No awaited preflight or independent queue was introduced into the mutation boundary.
- Last-effective path resolution uses the last applicable move. Explicit retarget coalesces only selected-function moves at a deterministic existing slot, returns the same operation array for an unchanged effective path, removes selected moves on baseline return, and folds temporary moves into their addition. Existing advanced metadata/annotation composition and unrelated authored operations are preserved. Physical node path/identity is not mutated by these helpers.
- Ownership path completion validates canonical folder/file targets and single supported filename segments. Intent captures project/snapshot/plan/revision/source/nonce and detects tuple changes. Target-tray generation rejects late or mismatched snapshot/path replies and cancels on close. Missing/truncated/planned paths are disclosed. The controller/standalone target view are not proof that all future callers cancel correctly or validate drop authority.
- The selected clean form follows accepted effective-path changes; same-node dirty form retains input and blocks stale save. Identity-based editor keys retain form state across revision changes without remounting it. I1/I2/M1 are gaps in that state protocol, not a request to restore revision remounts.
- Existing evidence read: `/tmp/atlas-fs01-first-window-green.log` shows 38 tests in 7 files PASS, duration 1.32s; `/tmp/atlas-fs01-first-form-playwright.log` shows 4 source-component Chromium cases PASS, 7.9s. `/tmp/atlas-fs01-first-form-baseline-red.log` retains all four actual HEAD baseline failures. The author report also lists scoped lint/noEmit receipts. These are author execution results, not independent reruns by this reviewer.
- Whole-app Canvas/native pointer drop, target preview/save integration, advanced-path required-snapshot call wiring, effective-path consumers and fact-context/live-source request-generation checks remain outside this first freeze. No claim is made that destination-path source requests or late whole-app source replies are already prevented. No actual source move/write, executor or IDX-04 migration is included.

## Routing

Request a narrow form/ACK repair and new exact freeze from the author under main coordination. Preserve this initial REQUEST_CHANGES report and all prior RED/GREEN receipts. Re-review only the identified repairs and new tests, then separately assess the later integrated window and main-controlled compiled whole-application gates. This frozen first window is not source-approved; the design APPROVE does not substitute for the source review.
