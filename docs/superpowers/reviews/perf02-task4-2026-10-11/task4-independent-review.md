# PERF02 Task4 Window C — fresh independent critical code review

Date: 2026-10-11 UTC. Reviewer: independent delegated reviewer; did not implement any reviewed source. Contract: gpt-6.1-sol/high; no reviewer descendants. **Verdict: REQUEST_CHANGES — C0 / I3 / M1.** This verdict applies to the frozen Task4 candidate, not to accepted Task1/2/3 algorithms or the unfinished whole PERF02 ticket.

## Scope and evidence

Read workspace AGENTS.md, .agents/skills/using-superpowers/SKILL.md and its codex-tools reference, requesting-code-review/SKILL.md and code-reviewer.md, root README/state, governing PERF02 spec/plan, owner progress, frozen review README/manifest/diff and relevant production dependencies. Reviewed Task4 workspace/save lifecycle, production Canvas effects/dragging/measurement integration, guarded projection/session, panels, App disposal, public query/client assembly and translations. Accepted helper source was read only to establish caller semantics, not re-reviewed as Task3.

Base is 130a64ad6380493dd1f4bb0fdbc8e4480a54876f, with the stated product-equal accepted 5ccf baseline. Independent probe verifies **41/41 workspace source hashes and 41/41 frozen source copy hashes** match source-manifest.json. The 14 assembled prior sources match the same manifest entries. No product source, historical evidence, Git index/HEAD, protected checkout, shared dist, credentials, runtime sessions or resources were modified. Only this report and three new independent probe logs were written.

Author receipt reviewed: task4-final-tests.log records **19 files / 194 tests passing, no skips**, including store16/session19/Canvas SSR4. Lint/typecheck logs and their package README report exit0 for modified16 files and web-production+owned3tests/core/server source noEmit. These are author receipts; I did not re-run the full suite, types, lint or a build. My independent evidence is source reasoning plus the limited executable probes below.

Probe commands used Node24 with the installed tsx loader, TSX_DISABLE_CACHE=1 and owner's source-alias web config; all input was passed on stdin, with only logs saved. Controlled in-memory APIs, stores and pure layout/session helpers were used. No production Worker, browser/DOM, server, actual indexed target or build ran.

## Strengths

- Global worker/target results are checked against current project, snapshot/hash, layout/view/projection generations; cancellation terminates the worker through the accepted controller instead of only rejecting a promise.
- Captured layout patches merge the current view, preserve offscope/opaque/hidden canonical keys and retain source/domain identities. Serialized 250ms saves capture detached payloads and a project/snapshot epoch; server acknowledgements never adopt stale returned views.
- Base/group preflight runs before refused projectors; fact-only fallback independently earns its budget with empty operations/references and no groups.
- OverviewSession keeps the first candidate private and passes its cumulative geometry counters to the measured second pass. Second refusal does not expose the candidate or save it.
- Default auto is derived state with no view PUT or planning write. Cache size is bounded to two projects; disposal releases controller/cache ownership. Funnel offset and native ownership semantics are not rewritten.

## Critical

None.

## Important

### I1 — cached dimensions can complete a different projection with reused visual IDs

Locations: apps/web/src/features/graph/Canvas.tsx:456, :525, :564, :594; OverviewMeasurements producer at :285.

The measurement key includes navigation/filter/collapse/theme/locale, but not rawProjection identity or projectionGeneration. actual.boxes/generation remain cached under that key. When a plan, graph, or group-membership change keeps the same navigation and visual IDs, the begin effect creates a new job for rawProjection and the current capture, then the measure effect can consume old actual.boxes immediately. The projectionData check in OverviewMeasurements only controls a newly emitted callback; it does not prove that cached actual belongs to the projection being completed.

Minimal reproducer: accept fact:0/fact:1 measured at 300x80, then update a same-scope projection that reuses those IDs but changes card contents/dimensions. Start the new job with its fresh capture while actual still contains previous boxes. task4-independent-probe.log demonstrates that old boxes yield ready and fact:1 y=128; current 300x600 / 300x80 boxes yield y=648. The stale result overlaps the first current rectangle. This is a source-level dimension fixture, not a claim that a real DOM screenshot was taken.

Impact: Canvas can mark a current job measured-ready and adopt coordinates before measuring current cards. A later callback may repair the display, but that does not satisfy atomic measured completion; a subsequent explicit rearrange can also consume stale cached measurements during initialization.

Required fix: bind stored measurements to the exact accepted projection/generation, invalidate or reject them when rawProjection changes, and require current initialized measurements before completion. Keep the existing marker check on the producer and cumulative two-pass budget. Add a source-level caller/effect regression where a new projection reuses every visual ID and old boxes cannot publish/apply/save ready.

### I2 — final default adoption can bypass current-store veto; blocking transitions leave capture valid

Locations: apps/web/src/features/graph/Canvas.tsx:594, :596, :612, :622; apps/web/src/app/workspace.ts:372, :390, :2489; WorkspacePanels.tsx:322.

Default adoption checks blocked from the last rendered props, then gets current capture as onCaptureLayout?.() ?? layoutCapture. An authoritative callback returning undefined while a project is loading is replaced with the old render capture; OverviewSession then regards the old job as current and the default branch adopts positions without a final store authorization call. The explicit branch has a store save gate; the default branch does not.

Ownership mode/gesture/preview and dirty editor/group draft transitions also do not invalidate the layout capture, and captureLayout does not inspect these current blocking states. Therefore a queued measurement completion before the next React props/effect cancellation can pass the same capture and apply after native ownership or dirty editing has begun. saveLayoutPositions checks current ownership, but omits dirtyPlanEditor/groupDraft, allowing an old explicit reflow capture to save after a dirty transition.

Minimal reproducer: capture a pending job; make store busy.project=true before its queued completion while props still contain the capture. captureLayout returns undefined, but the exact nullish expression returns the old capture. The retention probe logs nullishFallbackStillCurrent=true. Separately, the first probe calls setPlanEditorDirty(true) after capture: captureStillCurrent=true, saveAccepted=true and one actual controlled PUT occurs after250ms. The eligible valid-plan ownership probe enters mode=ownership through the accepted setMode API and confirms captureStillCurrent=true; explicit ownership save is refused, whereas default adoption has only the unchanged capture. The earlier retention log's mode=layout was an ineligible fixture and is explicitly not ownership evidence; the later ownership log preserves/corrects that limitation.

Impact: layout can steal the current visual state during a protected interaction, or apply an obsolete scope during loading. This violates the Task4 final apply/save guards; it does not indicate a source/ownership semantic write.

Required fix: respect an authoritative capture callback returning undefined (fallback only when the callback is absent), and synchronously authorize both derived adoption and explicit saves against current project/snapshot plus current ownership/dirty/group-selection/funnel/gesture state. Use the accepted state sources. Invalidate pending jobs or provide a current-store guard for these transitions; do not rely solely on the next passive effect. Add late-completion regressions for busy/loading, eligible ownership mode/preview and dirty editing, and ensure ordinary dragging retains its intended saved-pin behavior.

### I3 — same-project refresh discards surviving compact auto positions

Locations: apps/web/src/features/graph/Canvas.tsx:456, :488, :568; apps/web/src/app/workspace.ts:1144; accepted overview-visual.ts:694, :701 establish dependency semantics.

Canvas keys its sole compact auto cache by graph snapshotId. Refresh clears/reloads the graph and the new snapshot has a different key, so the local job receives retained={} even when the project/navigation scope is unchanged. Workspace does preserve full-target canonical positions in autoCache, but the accepted visible helper consumes global ranks/order to compact the view; it does not use global.positions as prior compact coordinates. Consequently surviving unpinned visible cards are rearranged on refresh.

Minimal reproducer in task4-independent-retention-probe.log: s0 has facts0/1; s1 adds fact00. The full-target worker model retains fact1 exactly at y=300, but visible fact:1 changes y=128 -> y=256 using Canvas's empty retained input. Supplying surviving compact retained positions keeps it at y=128. This is a two-snapshot pure helper/caller-input probe, not a production refresh/DOM run.

Impact: adding a fact on refresh moves existing automatic cards in the same scope and breaks the explicit promise to keep surviving auto positions rather than reflow the whole view each refresh.

Required fix: separate retained-position scope identity from measurement/snapshot freshness. Carry only surviving visual IDs for the same project/navigation scope into the new measured job, revalidate them against current dimensions/pins, and keep the previous snapshot's status distinct from current ready. Preserve explicit recompute/rearrange semantics and bounded cache ownership. Add a Task4 caller-level refresh regression proving surviving compact positions remain while only new facts find empty space.

## Minor

### M1 — completed route estimates are labeled exact visual counts

Locations: apps/web/src/features/graph/Canvas.tsx:1283, :1286; accepted estimateVisualWork in overview-visual.ts:357, :395.

The rejection UI labels countStatus=complete as Exact count and renders nodesLowerBound/edgesLowerBound together. For group projection, edges are a conservative route upper bound (1+sourceGroups+targetGroups); complete means the estimate traversal finished, not that this is an exact emitted/rendered relation count. In a projection_work refusal those values can include routes that projectGroups would never emit, yet the UI declares the pair exact. The base raw source lengths shown separately remain exact.

Required fix: use separate labels/fields for exact raw lengths or nodes, conservative route upper bounds (not yet generated), and observed early-stop bounds. Do not use Exact count for a route upper bound. Add a small SSR diagnostic regression for a complete group-work refusal. This is diagnostic accuracy, not a demonstrated unsafe projector execution.

## Declined to judge

- Production Worker asset loading/termination, real DOM rectangles/effect timing, actual pointer interactions, restart persistence, Express/Flask cold/hot10runs/p95 and Vite rejection: explicitly Task5/Window D and NOT RUN; source probes and WorkerDouble/SSR are not substitutes.
- Actual local120ms/global250ms capability: future measured acceptance targets, not established by fast unit fixtures.
- Already accepted Task1/2/3 helper algorithm design/geometry completeness: dependency semantics only; no reopened helper review.
- Cross-tab server CAS, indexing/static-analysis semantics, other tickets/protected checkouts and historical gates: outside authorized Task4 changes.
- Shared merge/deploy/commit/push/full-root gates: not authorized in this review.

No behavior within Task4 was silently set aside.

## Assessment and next action

**REQUEST_CHANGES.** Repair I1–I3 in the authorized Task4 source window, preserving accepted helper bytes and prior failures/evidence; fix M1 with the same diagnostic hunk if practical. Freeze the revised sources, run targeted regressions plus affected checks, then obtain a limited independent re-review of these findings. The author's194passing tests do not cover the identified production caller gaps.

Task4 is not independently approved. PERF02 remains TODO; Task5 remains NOT RUN. No Task5-only evidence gap is promoted to an additional current Task4 blocker.

Supporting new artifacts:
- evidence/task4-independent-probe.log —41/41+41/41 hashes, stale-measurement fixture, dirty captured write.
- evidence/task4-independent-retention-probe.log —compact refresh retention and authoritative-undefined fallback; original ineligible ownership attempt preserved.
- evidence/task4-independent-ownership-probe.log —eligible accepted native ownership mode transition and capture behavior.
