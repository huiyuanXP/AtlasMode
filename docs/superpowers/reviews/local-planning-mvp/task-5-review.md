### Spec Compliance

- ❌ Issues found: same-project navigation is not consistently latest-intent-wins, and the required route/entry focus action does not reliably center the selected node. See Important findings I1 and I2.
- ✅ HTTP-only UI, bounded navigation, fact/planning separation, readonly source, revision-aware planning, exports, and route/verification presentation are implemented within the requested T05 scope: `apps/web/src/api/client.ts:26`, `apps/web/src/app/workspace.ts:120`, `apps/web/src/features/graph/projection.ts:26`, `apps/web/src/features/graph/Inspector.tsx:60`, `apps/web/src/app/workspace.ts:256`, `apps/web/src/app/workspace.ts:379`, `apps/web/src/features/routes/RoutePanel.tsx:19`, `apps/web/src/features/verification/VerificationPanel.tsx:23`.
- ⚠️ Native Windows/macOS, full offline installation, mature-repository UI, complete E2E and CI remain explicitly unrun T08 work. T06 MCP examples and T07 deferred features are outside this diff. Compiled package checks are implementer-reported; no independent full-root build is claimed. Parent controller owns rendered-image review.

### Strengths

- `apps/web/src/api/scope.ts:17` and `apps/web/src/api/scope.ts:38`: request sequences plus project epochs prevent old project responses from committing after a switch, including A→B→A; scheduled layout writes capture the originating project.
- `apps/web/src/features/graph/projection.ts:81` and `apps/web/src/features/planning/operations.ts:42`: fact edges resolve through a dedicated fact namespace; reconnecting a fact edge creates removal/addition intents without changing facts. `apps/web/src/features/planning/operations.ts:14` removes dependent temporary-node operations.
- `apps/web/src/api/client.ts:103`, `apps/web/src/api/client.ts:122`, and `apps/web/src/features/planning/PlanEditor.tsx:37`: semantic writes/approval carry expectedRevision, and the panel displays service-owned validity, approval and issues. Layout persistence is separate at `apps/web/src/app/workspace.ts:235`.
- `apps/web/src/features/graph/projection.ts:136`, `apps/web/src/features/routes/RoutePanel.tsx:37`, and `apps/web/src/features/verification/VerificationPanel.tsx:23`: source windows preserve actual line numbers, route copy distinguishes narrative from facts, and verification identifies the actual historical revision.
- `apps/web/src/app/workspace.test.ts:56`, `apps/web/src/app/workspace.test.ts:126`, `apps/web/src/app/workspace.test.ts:245`, and `apps/web/src/app/workspace.test.ts:300`: focused regressions exercise transport/controller behavior, stale selections, deleted temporary nodes, and remote plan anchors. The App/panel/controller decomposition has coherent responsibilities; no arbitrary file-size issue is raised.

### Issues

#### Critical (Must Fix)

- None.

#### Important (Should Fix)

- **I1 — An older route response overrides a newer manual expansion.** `apps/web/src/app/workspace.ts:192` runs expansion under the `graph` key but does not invalidate `route`; `apps/web/src/app/workspace.ts:414` runs route loading under a separate key and unconditionally commits its graph and selection at `apps/web/src/app/workspace.ts:420`. This is reachable in the UI: the existing inspector's expansion buttons only receive `busy.inspect` (`apps/web/src/app/WorkspacePanels.tsx:164`, `apps/web/src/features/graph/Inspector.tsx:35`), so they remain available during a route request. Start a slow route step, expand the currently inspected function, and let the old route finish: it replaces the newer graph and selection. A focused in-memory execution of the actual controller confirmed `manual-target` after the newer expansion, then `route-target` for both graph and selected node after the older route resolved. Use one navigation generation/request ownership rule for every graph/focus producer, or invalidate pending route requests when manual expansion begins; add the delayed-route/newer-expansion regression.

- **I2 — Focus depends on selection changes rather than focus requests and graph readiness.** `apps/web/src/features/graph/Canvas.tsx:90` updates React Flow nodes in an effect, while `apps/web/src/features/graph/Canvas.tsx:92` immediately looks up the selected domain ID in the current instance. Its dependencies at `apps/web/src/features/graph/Canvas.tsx:104` contain only instance and selectedId. Selecting a remote search/entry target can therefore run before the target graph arrives; when that graph arrives there is no retry. Independently, after panning away from the current route step, clicking “聚焦步骤” again leaves selectedId unchanged and never calls fitView. Both defeat the explicit navigation/focus control. Represent focus intent independently of selectedId and consume it once the selected node is present/measured in the rendered graph; avoid recentering on unrelated layout saves. Cover an off-canvas remote target and repeated focus of the same route step.

#### Minor (Nice to Have)

- **M1 — Saved temporary-node edits leave stale inspector metadata.** `apps/web/src/app/workspace.ts:101` only clears selectedNode if the temporary function was deleted. When an add_function's name/path/signature changes, the projection and PlanEditor derive the new fields, but selectedNode keeps the previous object. `apps/web/src/features/graph/Inspector.tsx:25` consequently displays/copies the old planned location until the user clicks that node again. Refresh the selected temporary-node projection from the accepted plan, or derive inspector metadata from the current plan by ID.

### Checks and evidence

- Read the supplied 4,317-line review package once in contiguous chunks, including the parent documentation context. No git diff regeneration, changed-source reread for review, repository crawl, checkout/index/HEAD mutation, additional reviewer, or suite rerun.
- Focused probe for I1 only: transpiled the actual workspace/client/scope modules in memory and executed a delayed route response followed by a newer expansion. Output: `After newer expansion: manual-target`; `After older route resolves: route-target`; `Final selected node: route-target`. No test or probe file was created.
- Evidence-only read for reported test/browser noise: `artifacts/t05/full-test.log:1` reports 14 files/165 tests passed with no warning/error output; `artifacts/t05/browser-final.log:1` and `artifacts/t05/browser-evidence.json:1` record the actual source→draft→must_call→approve→export→verification smoke and empty consoleErrors. No missing evidence or noisy output finding.
- Reference evidence check: `/tmp/atlasmode-reference-demo/evidence.json:1` records the pinned official xyflow Overview, seven nodes/six edges, actual screenshot viewing, and no page errors. No repeat browser flow was run.
- No unchanged production source was inspected. Diff line references were calculated from its hunk metadata; the only new artifact is this ignored review report.

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** The implementation has sound domain boundaries and a useful set of focused regressions, but graph navigation still permits a stale cross-key response and the focus control does not consistently execute user intent. Fix I1 and I2 with targeted behavior regressions before accepting T05.
