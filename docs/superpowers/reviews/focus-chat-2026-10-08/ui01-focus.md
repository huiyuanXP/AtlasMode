> 归档说明：本文保留实现者原始报告（含中间失败和当时限制）。其中相邻日志/截图路径指原 `.superpowers/sdd/2026-10-08-focus-navigation/` 或 `.superpowers/sdd/2026-10-08-agent-chat/`，并非本归档目录。当前最终结论以本目录 README 为准。

# UI-01 Task 1 implementation report

Base: `9a008b666dd1e3721b578a2bab5034a7b4dca409`.
Status: implementation and self-review complete; controller owns final integration.

## Behavior and interface

- `features/graph/focus.ts` produces operation differences and affected domain IDs. Plan selection uses all operations; edits/undo/redo use only changed operations, including old/new relation endpoints. Removed temporary functions are excluded, preserving connected surviving context. Invalid retained annotation bindings remain readable without invalid anchor requests.
- `FocusRequest` accepts `sequence`, optional multi-node `nodeIds`, and optional legacy `nodeId`. Canvas still re-exports its type. Subsequent funnel/scope tasks can extend it.
- Workspace requests focus after an accepted semantic update, plan selection, or explicit node navigation. Current project/request identity plus focus sequence and plan revision prevent obsolete queries and successful-but-superseded updates from moving the camera. Failed updates preserve the previous request. Theme/manual layout do not emit new focus or semantic revisions.
- Canvas fits affected projected cards together, once per sequence, after the current projection reaches React Flow and target cards have measured dimensions. Unrelated nodes are excluded from fit bounds. Hidden affected content switches to combined layer. Explicit fit can go below the normal control minimum for widely spread saved layouts; positions remain unchanged. Reduced-motion preference selects duration zero.
- Controller-authorized scope extension: HTTP subgraph accepts optional `relationIds` (maximum 300), allowing empty `nodeIds` only with relation anchors. Query assembly resolves actual source/target endpoints from one selected-project snapshot before delegating the existing budget-limited core query. Missing/foreign relations fail even when the node budget is small. Node-only clients/MCP calls remain compatible. No complete snapshot is sent to the browser.

## RED evidence

Logs are adjacent to this report.

1. `npx vitest run apps/web/src/app/workspace.test.ts`
   - `task-1-red-unit.log`: 3 failed / 18 passed. Absent plan and semantic multi-node focus; explicit selection lacked affected ID request.
2. `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/agent/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test tests/e2e/focus-navigation.spec.ts`
   - `task-1-red-browser.log`: application RED, fact layer remained `fact` instead of revealing selected plan content.
   - Stronger creation assertion then ran against the baseline workspace implementation, temporarily restored only for building baseline assets and restored before further edits: `task-1-red-browser-creation.log`, expected created card width >200px, actual 35.918px. This proves overview visibility alone was insufficient.
3. `npx vitest run apps/server/src/server.test.ts apps/web/src/app/workspace.test.ts`
   - `task-1-red-relation.log`: 2 failed / 35 passed. Relation anchor HTTP request returned 400; unloaded relation selection emitted no endpoint focus.
4. Same focus browser command after adding widely spread manual positions:
   - `task-1-red-wide.log`: affected cards failed full canvas containment at x=-20000/+20000 because normal minimum zoom cropped the target bounds.
5. Final relation contract self-review added an imports-removal case:
   - `task-1-red-import-removal.log`: 1 failed / 23 passed, actual import relation endpoints were omitted because browser graph requests selected calls/contains only. The narrow follow-up includes imports only when explicit relation IDs are requested; node-only browsing stays unchanged.

Initial browser setup using the old documented `/usr/bin/chromium` path failed because that executable is absent. Located the existing Playwright Chromium cache and used it without installing dependencies. This setup failure is not counted as product RED.

Intermediate typecheck found null/index narrowing issues and they were corrected. The first relation GREEN attempt exposed a fixture assumption: core graph queries include actual parent file/folder context; the endpoint assertion now checks actual function IDs and continues asserting budget/snapshot/project behavior.

## GREEN and validation

- `npx vitest run apps/web/src/app/workspace.test.ts apps/web/src/app/WorkspacePanels.test.tsx apps/web/src/features/graph/projection.test.ts apps/web/src/features/planning/history.test.ts apps/web/src/features/planning/operations.test.ts apps/server/src/server.test.ts`
  - `task-1-focused-final.log`: **52 tests / 6 files passed**, 0 failures (5.42s).
  - Covers accepted add/edit/reconnect/removal/undo/redo focus, conflict preservation, metadata/layout history, node/project/plan supersession, actual unloaded relation endpoints, budget and missing/foreign IDs, prior lifecycle/selection races, projection and operation behavior.
  - Narrow final imports follow-up: `task-1-green-import-removal.log`, **24 workspace tests passed**; changed client/test ESLint and web typecheck also passed (tool output).
- `npm run build --workspace @codemap/web`
  - `task-1-web-build.log`: TypeScript plus production Vite build passed; final post-wide-layout build succeeded.
- `npm run build --workspace @codemap/server`
  - `task-1-server-build.log`: passed before parallel agent bridge files appeared.
- `npm run typecheck --workspace @codemap/web`
  - `task-1-web-typecheck.log`: passed on final UI code.
- `npm run typecheck --workspace @codemap/server`
  - Passed earlier during UI-01 verification before parallel agent files appeared (tool output).
  - Latest `task-1-server-typecheck.log` preserves the concurrent failure: `src/agent/native.ts:73,76` TS2339, `command` missing on one detected union branch. This is another implementer's unfinished file, preserved and reported to controller and bridge implementer. It is not represented as a current green server package check.
- `npx eslint` with the ten explicit task paths listed in the commit below:
  - `task-1-lint.log`: exit 0, no diagnostics on final files.
- `git diff --check`: passed.
- `sha256sum --check docs/superpowers/vendor.sha256`
  - `task-1-vendor.log`: all vendored workflow files passed unchanged.
- Chromium production browser:
  - `task-1-browser-final.log`: focus-navigation plus pre-existing complete production UI/SDK planning lifecycle **2 passed / 20.0s**. Actual planning, approval validity, undo/redo, clipboard, exports, persistence, source verification and offline boundary remain covered.
  - After final wide-layout camera adjustment, `task-1-green-wide.log`: final focus browser **1 passed / 4.3s**, including readable creation, multi-target canvas bounds, fact-to-combined switch, theme preserving semantic plan, and widely spread targets fitting without moving saved positions.
- Per latest explicit user/controller instruction, no root suite was rerun per ticket; controller performs one final integrated suite. No dependency installs, new worktrees, tunnels, pushes, or shared configuration changes.

## Visual inspection

Actually viewed with `view_image`:

- `artifacts/e2e/focus-navigation/created-light.png`: new purple planned card centered and readable, without fitting unrelated existing facts.
- `artifacts/e2e/focus-navigation/multi-light.png`: both planned cards and affected move/annotation anchor contained in the canvas; unrelated retained facts are outside the fitted target bounds calculation.
- `artifacts/e2e/focus-navigation/multi-dark.png`: same contained target set and consistent dark styling.

Final creation and dark screenshots were viewed again after the final browser run. The fixture deliberately uses distant saved positions; fitting multiple distant targets necessarily reduces their on-screen size. Browser assertions verify full card containment, not file existence or generic page visibility. `errors=[]`, `external=[]` were asserted in Chromium.

## Self-review and concerns

- Checked all brief requirements against code/tests, including surviving deleted context and old reconnect endpoints; accepted server revisions continue controlling history and approval.
- Current projection data identity and measured dimensions guard against fitting a prior graph with the same domain ID.
- Queries remain bounded to max 300; truncated graph response uses the existing visible warning. Missing relation endpoints remain source truth rather than invented cards.
- No manual positions or plan approvals are changed by camera movement. Semantic accepted content still updates inspector metadata through existing `acceptPlan` behavior.
- Empty affected sets (for example deleting an isolated temporary function) do not move to unrelated content.
- Latest server typecheck is pending the independently running bridge implementer's union narrowing fix; its exact failure is preserved above. Earlier UI-01 server package build and meaningful server tests passed. Controller final integration must verify the shared package again once parallel work settles.
  - Bridge implementer subsequently confirmed the union narrowing fix and owns its server check/build; this implementer did not rerun another worker's package checks.
- Independent review was not dispatched by this implementer; latest user override assigns final integrated review/checks to controller.
- External AGENTS.md, docs/tickets, controller specs/plans and other agents' server/MCP files are preserved and excluded from the task commit.

## Commit

`ac8384b39d4ac3b51e7a3365a11c6fd6a7d98961` — `feat(web): focus graph navigation on successful plan changes`.
Only the ten code/test files listed by the commit were included; report/evidence and external work were not committed.
`7f386a94c041049bf143ed66d98b3d55662a3eea` — `fix(web): include imports when focusing removed relations` (client and workspace test only).
