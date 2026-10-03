# T05 implementation report

Status: implemented, verified locally, ready for controller's independent review.
Base requested: `8f2e32e87ccb9b153cd2e7bf923374e5270c1946`.
Controller's documentation-only `9c3ffe8` arrived during implementation; preserved.
Commit: recorded below after staging/commit.

## Scope and decisions

- Added actual Vite/React browser application under `apps/web` only. No dependency upgrades, new packages, target-source writes, service/core changes, or HTTP contract changes.
- Vite uses loopback 5173 and `/api` proxy from `CODEMAP_API_URL`, falling back to `127.0.0.1:${CODEMAP_PORT ?? 4310}`. Compiled server's existing asset detection serves the actual built UI.
- Compact navigation/canvas/inspector layout, offline system fonts, light/dark theme through `ViewState`. Initial Chinese copy is centralized in `app/strings.ts`; domain names, source, paths, and HTTP errors remain verbatim. Projection labels have isolated display strings ready to join the locale work in T07.
- Project path entry/list/selection, browser-persisted last selected project, actionable errors and pending controls. No guessing browser project for external agents.
- Summary's real entry candidates (up to50 with totals/truncation) clearly distinguish TS/JS explicit exports from Python public-name top-level convention; none are claimed runtime-confirmed.
- Initial graph seeds up to8 entry candidates at depth0, keeping actual file/directory context. Search/context pages50; expansion defaults80 nodes and can request300. Each expansion replaces a bounded subgraph rather than accumulating an unbounded graph. Server truncation, unresolved/external reasons and diagnostics remain visible.
- Pure projection namespaces fact/planned node and edge identities; even invalid colliding temporary IDs cannot redirect fact edges. Fact/plan/both filtering, with existing code anchors marked as fact references in plan-only mode. Selecting remote plans requests bounded real anchors through subgraph HTTP.
- Source inspector is readonly, includes actual signature/path/line, copy-location action, paginated incoming/outgoing evidence, and a clearly labelled200-line window cap.
- Planning UI creates/selects/edits drafts, functions/name/target-file/signature/description, typed `calls`/`must_call`/`must_reuse` relations, reconnection/removal, temporary-node deletion with dependent planning operations, and descriptive annotation operations. Existing-function edits produce explicit move/annotation operations; fact-call reconnection produces remove/add operations.
- Confirmation uses actual HTTP `expectedRevision`; valid/issues/approval/hash render server responses. No duplicate client approval state machine. Export uses actual Markdown/JSON endpoint. Manual refresh reloads baseline statuses; implementation verification displays actual approved historical revision and satisfied/unmet/unknown/source evidence.
- Routes render actual server steps/notes/source/kind, previous/next/focus, and snapshot-based staleness. Route instructions never become code facts.
- `ProjectScope` generation plus request-key sequences guard all asynchronous project requests; switching clears graph/node/source/context/plan/route/report. Same-project rapid selection, plan/route deselection, and delayed graph/source responses are covered. Debounced ViewState payloads capture the project identity and cancel on switch; submitted writes serialize to their original IDs.
- Layout changes write only ViewState and do not touch plan revisions.

## File organization / self-review

Controller approved the purposeful split before commit:
- `app/App.tsx`104 lines: boot/top bar; `Navigation.tsx`166; `WorkspacePanels.tsx`208.
- `app/workspace.ts`464 lines: cohesive request-scoped project lifecycle and orchestration; retained together rather than introducing extra state interfaces.
- Planning components: `PlanningPanel`80, `PlanEditor`216, `FunctionForm`73, `RelationEditor`159 lines.
- Feature-owned pure graph projection, operation transforms, source inspector, route and verification panels; HTTP client/scope under api.
- Existing `.codemap/structure.json` already governs `apps/web/src` and its allowed React/HTTP/core dependencies. No responsibility/boundary change; web lint validates imports.
- No worktree, reviewers, child agents, push, external repo copies, SQLite files, or generated assets committed. Vendored skills untouched.
- Self-review found and repaired browser fetch receiver binding, CSS `.source` handle collision, pending graph selection, deleted temporary-node inspector, pending plan/route deselection, remote plan anchors, and colliding-ID fact-edge projection.

## TDD evidence (observed outputs)

Commands run from `/workspace/AtlasMode`.

1. `npx vitest run apps/web/src/features/graph/projection.test.ts apps/web/src/features/planning/operations.test.ts apps/web/src/api/scope.test.ts`
   - RED22:14 UTC: `Test Files 3 failed (3); Tests 11 failed (11)`.
   - Examples: delayed A overwrote B; same-project old source overwrote new; queued view write was missing; missing fact/planned nodes/edges; source window startLine undefined; operation results incorrectly empty.
   - Full initial runner output: `artifacts/t05/red-initial.log` (shell displayed the captured file afterward; failure counts are runner output).
   - GREEN22:15 UTC: `Test Files 3 passed (3); Tests 11 passed (11)`.

2. `npx vitest run apps/web/src/app/workspace.test.ts`
   - Initial skeletal stub produced one callback setup error; expanded it to execute the real HTTP transport before claiming behavioral RED.
   - Behavioral RED22:17: `2 failed | 1 passed`; project switch did not clear fields, and old open response restored projectA instead ofB.
   - GREEN22:19: `3 passed` after scoped controller and complete fact fixture.
   - Additional same-project focus regression passed existing sequence guard; graph-click cancellation RED22:33: `expected 'old' to be 'f'`.
   - GREEN with client regression: `Test Files 2 passed; Tests 6 passed`.
   - Temporary deletion/deselection RED22:35: `2 failed | 5 passed`; deleted node inspector and old plan response restored stale selection.
   - GREEN: `7 passed`.
   - Remote anchor/route deselection RED22:38: `2 failed | 7 passed`; expected `existingAnchor` received`fn`, and deselected route restored old node.
   - GREEN: `9 passed`.

3. `npx vitest run apps/web/src/api/client.test.ts`
   - Actual first browser run exposed `Failed to execute 'fetch' on 'Window': Illegal invocation` before HTTP requests.
   - Narrow RED22:32: `1 failed`, promise rejected `TypeError: Illegal invocation`.
   - Root cause: invoking native fetch as `this.transport(...)` binds the HttpApi receiver. Extracted standalone transport invocation.
   - GREEN22:33 included in the six-test focused run above.

4. `node artifacts/t05/handle-check.mjs`
   - Screenshot review prompted actual computed-handle-size assertion.
   - RED22:34: `Source handle should remain compact, actual width 28px`.
   - Root cause: readonly source `<pre>` style `.source` also matched React Flow's source handle class.
   - Renamed to `.source-code`; GREEN: `Source handle 8px`, repeated against final build.

5. `npx vitest run apps/web/src/features/graph/projection.test.ts`
   - RED22:40: invalid colliding tempID redirected fact edge source to`plan:a`, expected`fact:a` (`1 failed | 4 passed`).
   - Dedicated fact endpoint map; GREEN `5 passed`.

## Final checks

- Dependency-ordered builds and typechecks, exit0:
  ```bash
  for target in core indexer storage service server web; do npm run build -w @codemap/$target || exit; done
  for target in core indexer storage service server web; do npm run typecheck -w @codemap/$target || exit; done
  ```
  Web Vite final output:209 modules; JS444.76kB / gzip142.81kB; CSS27.31kB / gzip5.48kB. No warnings.
- `npx eslint apps/web`: exit0.
- Full current `npm test` run once before initial commit,22:42 UTC:
  `Test Files 14 passed (14); Tests 165 passed (165); Duration 5.44s`.
  Log: `artifacts/t05/full-test.log`. Includes22 web tests. No skipped/failed tests reported.
- `sha256sum --check docs/superpowers/vendor.sha256`: all74 files OK.
- `git diff --check`: clean (staged check recorded with commit below).
- Root all-workspace build/typecheck intentionally not claimed while T06 MCP implementation remains absent. All implemented packages listed above were actually checked.

## Actual browser / server evidence

Started compiled HTTP CLI:
```bash
CODEMAP_PORT=4325 CODEMAP_DATA_DIR=/workspace/AtlasMode/artifacts/t05/data node apps/server/dist/index.js
```
Observed: `AtlasMode API listening on 127.0.0.1:4325 (built web assets available)`.

Real TS fixture under `artifacts/t05/fixture/src`: greet/announce/main.ts and formatName/format.ts; no disguised demo facts. UI opened its absolute path through actual HTTP indexing. Temporary data and fixture remain ignored.

Browser: Playwright1.63, system `/usr/bin/chromium`, observed Chromium151.0.7922.173, Linux only. No browser CDN retry; no public preview.

`node artifacts/t05/browser-smoke.mjs` final exit0,22:42 UTC:
1. Opened fixture; selected greet; read real source and function context.
2. Created draft r1, added deliver at src/deliver.ts with signature/description -> r2.
3. Added typed must_call edge to existing greet -> r3.
4. Called actual validation and approval; displayed current approval validity/hash.
5. Downloaded actual server JSON (`artifacts/t05/export.json`, revision3/approval/hash/validity).
6. Switched theme; rendered light/dark.
7. Triggered actual verification of approved r3 against unchanged source; service reported unimplemented operations.
8. Narrow600px viewport: no horizontal document overflow. Responsive panels use internal scrolling.
9. Console/page error collection empty: `consoleErrors: []`.

Logs/scripts: `artifacts/t05/browser-final.log`, `browser-evidence.json`, `browser-smoke.mjs`, `handle-check.mjs`.

A repeat smoke initially assumed persisted theme was light and timed out after toggling dark→light; this was harness state, not a product failure. It now normalizes the starting theme before testing the toggle. No product checks weakened.

Actual screenshot files viewed using view_image:
- `artifacts/t05/browser-source.png`: real source/context, navigation, fact graph.
- `artifacts/t05/browser-plan-light.png`: approved plan, typed edge, controls/minimap.
- `artifacts/t05/browser-plan-dark.png`: final settled dark view, compact handles, real fact anchor and planned node. Initial immediate capture caught120ms CSS transition; recaptured with `animations:'disabled'` via `capture-settled.mjs`, viewed again.
- `artifacts/t05/browser-narrow.png`:600px viewport with scrolling stacked navigation/canvas/inspector; no overlapping controls.

Actual reference studied: official xyflow Overview at commit`3d35b57317576b0916c0bfeaaedd573aaacc2839`, source `/tmp/atlasmode-ui-reference-xyflow`, prepared runnable demo `/tmp/atlasmode-reference-demo/{Overview.tsx,reference.css,evidence.json,overview.png}`. Read actual source/CSS and viewed actual screenshot. Inspiration: thin borders, dotted canvas, clear handles/edge labels, bottom-left controls and bottom-right minimap. No copied external repository/assets in commit.

## Limits / handoff

- This is T05 functional smoke plus focused unit regressions, not the mature T08 end-to-end suite, visual regression suite, performance validation on large repos, or three-platform CI.
- Windows/macOS native execution not performed; no platform pass claimed. Browser UI avoids platform-specific filesystem assumptions and leaves path parsing to existing service/indexer.
- T06 MCP, T07 English/groups/policies/history/undo, and T08 complete real coreflow remain separate tickets. No model keys/account/CDN fonts introduced.
- Browser edit forms use explicit save; selection/remount can discard unsaved form text. Saved revisions/approvals remain server-owned. Large functions expose first200 lines and copyable actual location.
- Layout is a simple bounded deterministic grid with saved drag positions; file/folder context uses labelled cards, not inferred containment or automatic source moves.
- Scope report is self-review only; controller must obtain the prescribed independent reviews.

## Commit and cleanup

Committed `2dc95d7` (`feat(web): add real code canvas and revision-aware planning UI`):26 web files,4052 insertions. Staged `git diff --cached --check` clean; post-commit working tree clean. Controller documentation commit preserved. Temporary compiled smoke server PID14979 (port4325) stopped with SIGTERM after verification. Ignored artifacts/evidence remain for review; nothing pushed.

## Fix round1 — review I1 / I2 only

FIX_BASE: `2dc95d75b3f89c5bd3720b0504226b730ca7580c`.
Read full `task-5-review.md`. Minor M1 remains deferred as instructed; no unrelated implementation changes.

I1: manual expansion now invalidates the independently pending route request, clears its pending state, and advances navigation generation. Its graph/selection cannot later be replaced by the superseded route. Existing project epochs and per-request sequence guards remain intact.

I2: workspace emits an explicit `{nodeId, sequence}` focus request when the corresponding graph is accepted, including repeated requests for the same route step. Canvas's FocusViewport waits for the current projection to reach React Flow's rendered node store, for node measurement and viewport initialization, then consumes that request once. Selection changes and ViewState saves alone no longer trigger recentering. Ordinary node drag changes only saved layout.

Changed source only: `app/workspace.ts`, `app/workspace.test.ts`, `app/WorkspacePanels.tsx`, `features/graph/Canvas.tsx`.

### Observed RED / GREEN

- `npx vitest run apps/web/src/app/workspace.test.ts`
  - RED22:52 UTC: `Tests 1 failed | 9 passed`; new regression `newer manual expansion keeps its graph and selection when an older route finishes last` received`route-target`, expected`manual-target` after deliberately reversed HTTP completion.
- Focused real browser RED, before production edits:
  - Started existing compiled server with `CODEMAP_PORT=4325 CODEMAP_DATA_DIR=/workspace/AtlasMode/artifacts/t05/focus-data node apps/server/dist/index.js`.
  - `node artifacts/t05/focus-browser.mjs`: exit1.
  - Actual indexed11-function TS fixture, saved remote node position5000/4000, real HTTP route and real browser input. Held actual remote subgraph request until selection rendered, then released it: selected remote node remained4979.888px from canvas center (required<35px).
  - Selected real route step, manually panned viewport, clicked `聚焦步骤` for the same step: node remained250.343px from center (required<35px).
  - `consoleErrors: []`; failures were behavioral viewport assertions, not mocked effect calls.
  - First probe's route precondition also caught early graph-arrival centering drift; refined the precondition to wait for actual route selection, then performed the pan/refocus sequence above. Both final RED cases failed after their intended actions.
  - Evidence retained: `artifacts/t05/focus-browser-red.json`.
- After fix:
  ```bash
  npx vitest run apps/web/src/app/workspace.test.ts apps/web/src/api/scope.test.ts apps/web/src/features/graph/projection.test.ts
  ```
  GREEN22:55 UTC: `Test Files 3 passed (3); Tests 18 passed (18); Duration248ms`.
- `npm run build -w @codemap/web`: exit0;209 modules; JS445.56kB/gzip143.08kB.
- `npm run typecheck -w @codemap/web && npx eslint apps/web`: exit0, no errors/warnings.
- `node artifacts/t05/focus-browser.mjs`: final exit0.
  - Delayed remote entry centers within35px after real graph arrival.
  - Actual subsequent node drag leaves viewport transform exactly unchanged after the debounced ViewState save; reported72.402px offset is the deliberately dragged node AFTER the successful focus assertion, demonstrating no automatic refit.
  - Same route-step refocus after pan centers to0.0000153px.
  - `consoleErrors: []`.
  - Evidence/script: `artifacts/t05/focus-browser-evidence.json`, `artifacts/t05/focus-browser.mjs`.
  - Captured and actually viewed with view_image: `artifacts/t05/focus-remote.png`, `artifacts/t05/focus-repeated.png`.
- `git diff --check`: clean.

No root full suite, unrelated package builds/tests, or whole planning browser flow rerun in this fix round. Linux Chromium only, same native-platform limitations. This remains self-verification pending controller re-review.

Fix round1 committed `a9d27a0957628bcfd3fc77ec58f5e06b40144df7` (`fix(web): preserve latest navigation and focus rendered targets`). Staged whitespace check and post-commit working tree clean. Stopped only this round's smoke server PID18319/port4325 after verification. No push.
