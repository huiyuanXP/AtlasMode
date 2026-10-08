> 归档说明：本文保留实现者原始报告（含中间失败和当时限制）。其中相邻日志/截图路径指原 `.superpowers/sdd/2026-10-08-focus-navigation/` 或 `.superpowers/sdd/2026-10-08-agent-chat/`，并非本归档目录。当前最终结论以本目录 README 为准。

# UI-02 animated dependency funnel — implementer report

Date: 2026-10-08 UTC. Base UI-01 commits: ac8384b + 7f386a9.
Status: IMPLEMENTED; focused checks + actual Chromium pass; controller integration handoff ready.
Commit: `73be64b1620e0a09807de7f525c5ed3880759d7c` (15 task-owned code/test files only). Shared files explicitly released to controller and UI-03 implementer after commit.

## Behavior / self-review

- Double click selects a real function/file or planned-only function and enters its direct dependency funnel. A 200ms single-click gesture delay prevents immediate focus from moving the card between the two click events. Ordinary single click still selects/focuses; React Flow double-click zoom is disabled.
- Direct callers/dependents above, selected root alone at waist, direct callees/dependencies below. Reciprocal cards occur once above with reciprocal badge and both directional edges; self recursion stays on the root; cycles and isolation are deterministic. All containment edges are excluded from funnel edges/dependency classification.
- Existing unrelated visible facts remain in a horizontally arranged, visually secondary side lane. Counts distinguish incoming/outgoing, current, side and unknown/external. Reciprocal counts intentionally count a neighbor in both directions while displaying one card.
- Actual file imports and cross-file calls aggregate once per directed owning-file pair; same-file calls and contains never become file dependencies. Unknown/external evidence stays unknown and does not invent an external file/function card. File aggregate edges are read-only because their IDs denote derived display relationships, not editable original graph relations.
- requestAnimationFrame interpolates actual React Flow node positions for 300ms, with measured card spacing. Its final frame adopts exact destinations to avoid floating-point remainders blocking viewport readiness. New navigation cancels older animation/query work. Related-node fit excludes side lane; stable overview fit options prevent React Flow's queued explicit fit options being overwritten on parent rerender.
- Reduced motion uses immediate layout/camera change. Exit button or Escape restores the original graph/filter, node coordinates and overview viewport. Pending Escape cancels dependency work. Automatic coordinates never go through saveView; dragging is disabled while in funnel.
- Queries default80/max300 nodes; retained union also capped300 nodes/900 relations, with truncation announced. Prior graph retention only uses the same snapshot. Fresh related query is authoritative for edges incident to the root; stale overview facts are excluded.
- Failed semantic plan update preserves existing navigation; accepted semantic action exits transient funnel before UI-01 affected-node focus. app.focus/expand and legacy FocusRequest remain usable.

## Exact contracts for UI-03

`apps/web/src/features/graph/funnel.ts` exports:

```ts
FunnelState = {
  root: CodeNode;
  sequence: number;
  previousGraph?: SubgraphResult;
  previousFilter: LayerFilter;
  unknownCount: number;
};
DependencyGraph = SubgraphResult & { unknownCount: number };
FunnelLane = "dependent" | "selected" | "dependency" | "side";
layoutFunnel({ nodes: GraphNode[], edges: GraphEdge[] }, rootId: string)
// -> {nodes, edges, relatedIds, counts:{dependents,dependencies,side}}
```

Workspace state has optional `funnel`; `app.enterFunnel(node:CodeNode,budget=80)` and synchronous `app.exitFunnel()`.
Task3 can use `funnel.root` for active funnel breadcrumb scope, while `selectedNode` tracks inspector selection. Invoke exitFunnel before replacing scope graph. `sequence` remains the monotonic focus/navigation generation. Root object retains filePath/qualifiedName for navigation.

`HttpApi.dependencies(projectId,nodeId,budget=80)` sends `POST /api/projects/:id/dependencies` with strict `{nodeId,budget?}` and returns `DependencyGraph`. Function/file roots only; default80/max300; foreign/missing IDs rejected. File response nodes are owning files, resolved directed-pair edges have synthesized display IDs and real source evidence, no contains; unknown edges have null target and `unknownCount` counts original unresolved/external evidence even when output is truncated. Existing graph/relationIds API is unchanged.

GraphEdge.data adds optional `relationType` for correct containment exclusion; projection emits actual fact/planned types. Canvas consumes optional funnel/funnelPending and required onFunnel/onExitFunnel callbacks via WorkspacePanels.

## RED evidence (actual)

- `task-2-red.log`:4failed — incoming above root missing, cyclic counts absent, isolated/planned layout absent, server dependency query absent.
- `task-2-workspace-red.log`:2failed — enter/exit API absent.
- `task-2-unknown-red.log`: external node incorrectly included as dependency; test failed before normalizing unknown targets/filtering externals.
- `task-2-snapshot-red.log`: old-snapshot deleted node retained in current funnel; test failed before same-snapshot retention guard.
- `task-2-browser-red-real.log`: old built frontend had no Exit funnel button after double click (actual Chromium).
- Initial `/usr/bin/chromium` invocation (`task-2-browser-red.log`) was setup failure: executable absent. Used already installed Playwright Chromium1243 instead, no browser/dependency installation.
- First new-build double click did not send a dependency request: immediate first-click focus moved the card. Trace/network and screenshot confirmed; gesture disambiguation fixed it.
- `task-2-fit-debug.log`: correct3 related targets/positions + dependencies200, but file card width79px. React Flow StoreUpdater overwrote queued explicit fit options with fresh overview options. Stable options fixed this; readable-card assertion now passes.
- Screenshot-refresh failure (`task-2-browser-screenshot-green.log`, despite provisional filename) showed function cards not inside canvas after strict position readiness. Final frame exact-target adoption fixed floating remainder risk. Final browser log below passes.

## GREEN checks (actual)

Node v24.19.0 / npm11.9.0; current isolated checkout; no worktree/subagents/install/target execution/tunnel/push.

- `npx vitest run apps/web/src/features/graph apps/web/src/app apps/server/src/funnel-query.test.ts`:40passed/6files; `task-2-unit-green.log`.
- `npx vitest run apps/server/src/server.test.ts -t 'bounded subgraph|foreign node IDs|relation anchors'`:3passed,11not-selected; `task-2-api-green.log`.
- `npm run typecheck --workspace=@codemap/web` and server: both exit0. Web build also runs TypeScript on the final Canvas revision.
- `npm run build --workspace=@codemap/server`; `npm run build --workspace=@codemap/web`:exit0; final web bundle `index-Bf6TITB6.js`.
- `npx eslint apps/web/src/features/graph/{Canvas.tsx,projection.ts,funnel.ts,funnel.test.ts} apps/web/src/app/{workspace.ts,WorkspacePanels.tsx,funnel-workspace.test.ts} apps/web/src/api/client.ts apps/web/src/i18n/{en,zh}.ts apps/server/src/{queries.ts,routes.ts,funnel-query.test.ts} tests/e2e/focus-navigation.spec.ts`:exit0. Canvas/browser spec rechecked after final revision.
- `git diff --check`:exit0.
- `npx playwright test tests/e2e/focus-navigation.spec.ts`:2passed,6.9s; `task-2-browser-green.log`. Covers UI-01 creation/plan focus and UI-02 root singleton, up/down cards, readable fit, DOM-position intermediates, source/path coherence, Escape/button exit, exact original transforms/viewport, saved positions unchanged, actual directed file query and reduced motion.
- Actual final browser evidence (`task-2-browser-evidence.json`):52 sampled frames,22 unique root transforms; reduced-motion transforms only `translate(0px, 0px)`; page/console errors[]; external requests[]. Playwright's runner NO_COLOR/FORCE_COLOR warning is environment-only; product browser errors are empty.

## Screenshots actually viewed

- `artifacts/e2e/focus-navigation/funnel-function-light.png`: readable singleton current root with caller above/helper below, arrows downward, lane counts, matching selected function/source.
- `.../funnel-function-dark.png`: same directional structure and source; final screenshot waits for dark button background transition to settle; viewed final dark image.
- `.../funnel-file-reduced-motion.png`: readable caller.ts -> root.ts -> dependency.ts imports; root file/source coherence. Earlier tiny-card screenshot was inspected, exposed fit race, and was replaced after fix. Final readable image viewed.
- Initial failing double-click screenshot was also viewed during diagnosis.

## Remaining / integration

UI-03 breadcrumb rendering is intentionally not in this ticket; source/path coherence and exported root contract are verified here. Controller should perform its integration check with Task3 and update shared plan/state/ticket records. No independent review gate was spawned (updated user instruction: self-review + controller integration, noncritical allowance0). No full root-suite rerun, as explicitly requested. No known remaining UI-02 blocker; existing project-wide unresolved/static analysis limitations remain visible. Keep manual positions as source of overview restoration, and keep aggregated file display relations read-only when extending navigation.
