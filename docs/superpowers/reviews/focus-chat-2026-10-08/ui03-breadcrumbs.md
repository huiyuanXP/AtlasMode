> 归档说明：本文保留实现者原始报告（含中间失败和当时限制）。其中相邻日志/截图路径指原 `.superpowers/sdd/2026-10-08-focus-navigation/` 或 `.superpowers/sdd/2026-10-08-agent-chat/`，并非本归档目录。当前最终结论以本目录 README 为准。

# UI-03 clickable location breadcrumbs — 2026-10-08 UTC

Status: implementation and affected verification complete; task-only commit 2ade73a. Shared ownership and Git-index lease released to controller/UI-04.

## Contracts

- `WorkspaceState.navigationLocation?: { path: string; kind: 'folder'|'file'; planned?: boolean }` (exported `NavigationLocation` in `features/navigation/path.ts`). `selectedNode` supplies current symbol identity and qualified name; scope navigation replaces location, project switches clear it.
- `app.navigateScope(path, kind)` returns an awaited Promise. Success restores a prior funnel before replacing scope. Indexed file resolves exact captured file ID, then calls existing `enterFunnel(root)`; function breadcrumb calls `app.focus(stableNode)`.
- `HttpApi.scope(id,path,kind,budget=80,snapshotId?,allowMissing=false)` POST `/api/projects/:id/scope`. Result is `SubgraphResult & {root?:CodeNode,path,kind,missing?:boolean}`.
- Server assembles root/folder plus immediate captured file/folder children; default80/max300 nodes, max900 containment relations, explicit truncation. Exact kind/full path identifies same-name files. Supplied snapshot ID must match the single service snapshot, otherwise `SNAPSHOT_CHANGED`409 (mapping supplied by bridge implementation).
- `allowMissing:true` returns `missing:true` and empty captured code context when absent from the captured index; it does not infer filesystem existence/deletion. Client sends this only when matching actual supported `add_function`/`move_function` operations supply planned node IDs. Planned files/folders focus those IDs, load existing moved fact anchors as needed, and show a localized planned-context badge. No invented indexed file/folder IDs or source reads.
- Scope request key + focus generation + project epoch discard late requests. Failed scope lookups preserve the old funnel/graph and never start a new focus. Folder scopes include applicable actual planned IDs within80 focus targets; empty indexed projects still focus real planned nodes.
- Successful single-object planning focus synchronizes selected identity/path (new functions and move targets); multi-object focus clears an old selected path and displays plan title/affected count. Choosing empty plans and removing obsolete planned context clear stale paths.
- `Breadcrumbs` is exported for UI-04 shell reuse. Accessible labeled `nav`/ordered list/buttons use `aria-current=location`, keyboard activation and project→nested folders→file→qualified-symbol order. Folder/file cards also navigate their actual scopes. Existing function double-click funnel contract remains intact.

## Verification

No dependency/browser installation, extra worktree, tunnel, shared push or target-source execution. No whole suite per ticket.

- Initial three path tests RED: `task-3-path-red.log`; three server scope tests RED: `task-3-query-red.log`; first six workspace behaviors RED: `task-3-workspace-red.log` (missing navigation method and old selected path).
- Meaningful additional RED/GREEN checks: captured planned absence (`task-3-planned-query-red.log`/`task-3-planned-query-green.log`); rejected navigation preserving funnel (`task-3-failed-navigation-red.log`/`task-3-failed-navigation-green.log`); empty captured-root planned focus (`task-3-empty-root-red.log`/`task-3-empty-root-green.log`); empty-plan stale path clearing (`task-3-empty-plan-red.log`/`task-3-empty-plan-green.log`).
- Final affected unit/API run: `npx vitest run apps/server/src/server.test.ts apps/server/src/funnel-query.test.ts apps/server/src/navigation-query.test.ts apps/web/src/features/navigation apps/web/src/app/workspace.test.ts apps/web/src/app/funnel-workspace.test.ts apps/web/src/features/graph/projection.test.ts`: **66 passed /8files**,4.68s, `task-3-affected-tests-final.log`.
- `npm run build --workspace=@codemap/server`: exit0, `task-3-server-build-final.log`. `npm run build --workspace=@codemap/web`: exit0 (includes tsc), `task-3-web-build-final.log`. Initial separate affected typechecks passed after fixing a TypeScript optional-search narrowing error; final builds check the final source.
- Scoped ESLint over navigation, modified workspace/panels/API/i18n/server queries/routes and browser spec: exit0, `task-3-lint.log`. Final task-file `git diff --check`: exit0.
- Browser initial explicit `/usr/bin/chromium` launch was setup failure (executable absent), `task-3-browser.log`. Used already-installed Playwright Chromium1243, no installation.
- First actual browser run passed all path/viewport/race assertions but reported two expected404 console errors for planned missing paths; original focus/funnel scenarios both passed. Root cause fixed by explicit captured-absence result instead of404 fallback, `task-3-browser-real.log`.
- `npx playwright test tests/e2e/breadcrumb-navigation.spec.ts tests/e2e/focus-navigation.spec.ts`: **3passed**,17.1s, `task-3-browser-final.log` (UI-03 + prior meaningful UI-01/UI-02 scenarios).
- After final empty-plan/source change, refreshed web build and reran only affected UI-03 actual browser: `npx playwright test tests/e2e/breadcrumb-navigation.spec.ts`: **1passed**,10.1s, `task-3-browser-final-single.log`.
- Actual browser asserts function→indexed file funnel→nested folder→parent→project; another same-name file in a distinct directory; automatic new-plan function breadcrumb identity; planned file/folder context; late folder response finishing after root request; requested target cards within actual canvas bounds; no page/console errors or external requests. A delayed response is awaited to completion before final race assertions.
- Screenshots actually inspected: `artifacts/e2e/breadcrumb-navigation/planned-light.png`, `planned-dark.png`, `root-dark.png`. Breadcrumbs are clear in both themes; planned-only card stays visibly planned, and root scope fits captured direct children plus applicable planned context. Screenshots/logs remain ignored artifacts.

## Self-review and handoff

Reviewed code boundary, scope budget, captured identity, source-read truthfulness, late-response guards, selected-node/path alignment, keyboard access and transient funnel restoration. No additional UI approval gates requested (allowance0); this report is implementer self-review, not an independent review. Controller coordinates integrated review and documentation/state/ticket changes.

Task files only: new web navigation component/helpers/tests, new server navigation query/tests, modified queries/routes/API/workspace/panels/i18n/styles, new `tests/e2e/breadcrumb-navigation.spec.ts`. Existing focus-navigation spec, graph files, bridge/server.ts/MCP/AGENTS/controller docs were not edited by this task. Shared frontend ownership released to controller/UI-04 after final source freeze, before the commit lease. Final tracked diff is preserved in task-3-tracked.patch. UI-04 held shared edits until the controller granted the commit lease, so the exact15 task paths were staged directly without mixing later changes.

Commit: `2ade73a` — `feat(web): navigate captured and planned scopes with breadcrumbs`;15 task files. No push. No extra SHA/fingerprint verification after controller clarified the latest user constraint.
