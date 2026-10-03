# Task 7 report — questionnaire UI and approval context

Status: DONE. Implementer base: `45b75d370a630c0fba52d32a4ef9541e6e201c4f`.
Parent documentation commits arrived during work (`cf884b5`, `b5f3c2d`, `33433a9`); they are not implementation changes by this worker.
Implementation commit SHA is appended after the local commit. No push.

## Delivered

- Typed, complete zh/en dictionaries in `apps/web/src/i18n`; locale provider updates all existing panels, graph labels, statuses, controls and accessible labels. Original symbols, paths, authored prose and service evidence stay verbatim. Locale/theme use existing project ViewState persistence, tested after real page reload.
- Function groups: select multiple visible fact functions from entry/search/current graph, create/list user groups, show Agent proposals loaded through the same endpoint, shared membership without source movement. Member detail pages contain at most 20 members with at most four concurrent context requests (limit=1). Missing 404/NOT_FOUND bindings remain visible and retained; other errors remain errors. Snapshot consistency is checked both on responses and with a final summary read (404 has no snapshot ID). Project/request scopes suppress late results.
- Directory responsibility/scope/forbidden-prefix create/edit/list forms, server validation and actual forbidden existing dependency demonstration. The form explains human/Agent review of natural-language responsibilities and conservative project-wide approval impact.
- Pure bounded semantic history (50 entries per plan, 20 recently observed plans per workspace controller), keyed by project AND plan. Undo/redo submits title/description/operations with current expectedRevision, advances only after accepted responses, preserves history after failures, discards redo after new edits, and resets after external revision changes. Layout is independent. Session-only storage is explained beside controls. Refresh retains history when the revision is unchanged.
- Accepted temporary function edits and undo refresh selected inspector name/path/signature and copied location without reselection (T05 M1). Clipboard and refresh/validation notices store locale-independent keys, so switching language translates existing notices.
- Removing a temporary function retains authored annotations. Missing targets show a visible lost-binding warning using authoritative INVALID_TARGET + operationIndex. Invalid annotations stay in operations/history/export and honestly block approval until explicitly removed or revised. Choosing such a plan no longer sends its missing annotation target as an invalid graph anchor.

## Approved approval strategy

Controller approved the proposal BEFORE service implementation and documented it in contracts.md. No public Plan/Approval schema extension and no hash-format change.

Meaningful normalized group (title/description/member set) or directory policy (scope/purpose/forbidden set) changes atomically save knowledge and advance every current plan revision in that project, with draft status and updatedAt. New records count as changes. Group source-only provenance and normalized no-op sets do not advance revisions. Other projects, routes and view changes are untouched. Historic approvals and `approved-plan:*` snapshots remain immutable and verifiable. Old expectedRevision requests conflict, and current revision can be reconfirmed.

The policy is deliberately conservative and project-wide. Historic knowledge context is not reconstructed; historic Plan/Approval content and hashes remain verifiable. This limitation is stated in docs/mcp.md alongside Agent guidance to establish knowledge before confirmation and re-read validity after `propose_group`.

## TDD evidence

Commands run from `/workspace/AtlasMode`:

1. `npx vitest run packages/service/src/workspace.test.ts`
   - RED before implementation: 2 failed / 4 passed. Purpose-only policy change expected `{valid:false,revision:2,status:'draft'}`, received `{valid:true,revision:1,status:'approved'}`. Group design change expected revision 2/invalid but remained revision 1/valid.
   - GREEN after atomic saveDesign implementation: 6 passed. Later atomic rollback regression increased this file to 7 tests and passed: simulated failure writing the second affected plan rolls back both knowledge and the first plan write.
2. `npx vitest run apps/web/src/app/workspace.test.ts`
   - RED: accepted temporary edit expected after.ts/after(x)/after, received before.ts/before()/before (10 passed / 1 failed).
   - GREEN with accepted metadata + history wiring: combined controller/history run 14 passed.
   - Later RED: missing-target annotation selection requested a nonexistent graph anchor and populated NOT_FOUND instead of an empty UI error. Filtered only authoritative missing annotation targets; subsequent focused run passed.
   - Self-review RED: same-revision refresh lost visible session history (`past` undefined, 14 passed / 1 failed). Routed accepted refreshed plan through the same acceptance path; GREEN 15 controller tests. External revision refresh resets the history as required.
3. `npx vitest run apps/web/src/features/planning/operations.test.ts packages/service/src/workspace.test.ts`
   - RED: deleting a temporary target returned [] instead of retained authored annotation; 1 failed / 11 passed.
   - GREEN after retaining annotations and updating the earlier deletion expectation to the newly required contract.
4. New history/i18n/memberBindings test files were written before their modules. Initial invocations failed with the expected missing-module import errors (not passing behavioral runs). Implemented modules then passed behavioral assertions for revision/project/plan isolation, bounded history, new branches, English rendered controls, preservation of authored Chinese names/notes, matching dictionary coverage, bounded read concurrency, missing-vs-error distinction and stale snapshot rejection.
5. Focused aggregate before browser: `npx vitest run apps/web/src packages/service/src/workspace.test.ts` → 9 files / 41 tests passed at that point.

Coverage also includes failed undo preserving history, layout not entering semantic history, knowledge save reloading authoritative validity, and late member reads suppressed after project change.

## Full verification and honest failures

Node v24.19.0, npm 11.9.0, Linux. Commands all run in the checkout.

- First `npm test > /tmp/t07-fulltest.log 2>&1`: 190 passed / 1 failed, 18 files. The single failure was `reopen retains approval history, routes, groups, policy, layout and exports show current validity` at workspace-lifecycle.test.ts:456: old expectation true after creating a group AND policy after approval. Updated this expectation to the newly authorized behavior: revision 4 draft/invalid with approval revision 2, and use expectedRevision 4 for the next edit. Historical export/verification assertions remain revision 2. This is a new contract expectation, not a weakened assertion.
- `npx vitest run tests/integration/workspace-lifecycle.test.ts > /tmp/t07-lifecycle.log 2>&1`: 24 passed.
- T06 restart lifecycle expectation similarly now checks group creation leaves revision 2 draft/invalid with the original approval retained. No MCP production changes.
- Final `npm test > /tmp/t07-final-test.log 2>&1`: **18 files, 192 tests passed**, exit 0, duration 16.90s. No skipped/failed tests reported. No further whole-suite rerun after this pass.
- Final `npm run build > /tmp/t07-final-build.log 2>&1`: **all seven workspaces passed**, exit 0. Vite transformed 215 modules; web bundle 465.08 kB / 149.39 kB gzip.
- Final `npm run typecheck > /tmp/t07-final-typecheck.log 2>&1`: **all seven workspaces passed**, exit 0 (root script builds prerequisite workspaces as designed).
- Final `npm run lint > /tmp/t07-final-lint.log 2>&1`: exit 0, no findings.
- `git diff --check`: exit 0, no findings.
- `sha256sum --check docs/superpowers/vendor.sha256 > /tmp/t07-vendor.log`: exit 0; vendored workflow unchanged.

Final and initial-failure logs copied into ignored `artifacts/t07/`.

## Actual built-browser smoke

Started own isolated production server:

`CODEMAP_DATA_DIR=/tmp/atlas-t07-data CODEMAP_PORT=4327 node apps/server/dist/index.js`

Output: `AtlasMode API listening on 127.0.0.1:4327 (built web assets available)`.

Playwright 1.63.0 with `/usr/bin/chromium`, actual Chromium 151.0.7922.173. First default Playwright launch found no downloaded executable; used the already installed system Chromium as in T05, no browser download/trust bypass. Fixtures and database are under /tmp, not tracked; no public preview.

1. `node artifacts/t07/browser-smoke.mjs > artifacts/t07/browser-smoke.log 2>&1` → PASS, exit 0:
   - actual open/index, English switch and dark theme persistence after reload;
   - two user groups containing the same A/B facts, metadata page;
   - title save + undo + redo through revisions 1→2→3→4, real approval;
   - new policy invalidates approval; purpose-only edit after reconfirmation invalidates again;
   - forbidden dependency from core to forbidden directory reported on actual existing code;
   - temporary function name/file/signature edit updates inspector and actual copied text; undo updates inspector/copied file back, without selecting the node again;
   - zero console errors / page errors.
   Browser exposed a populated-textarea label ambiguity; added explicit aria-labels to affected policy fields. Similar select/description fields now have explicit labels. Rerun passed.
2. `node artifacts/t07/missing-bindings.mjs > artifacts/t07/missing-bindings.log 2>&1` → PASS, exit 0:
   - actual source deletion followed by refresh retains group member ID and displays Lost binding;
   - authoritative invalid annotation remains visible, persisted and present in exported JSON;
   - zero unexpected console/page errors; one expected network 404 for the deliberately missing member, correctly shown as lost binding.
   Early smoke attempts used exact labels without explicit selection labels and switched locale immediately before the existing 250 ms view debounce; adjusted accessible labels and awaited persistence before refresh. These were investigated, not claimed as successful runs. Repeated fixture setup produced duplicate authored annotations in the disposable smoke plan; each is retained and shown, not pruned.
3. `node artifacts/t07/locale-notice.mjs > artifacts/t07/locale-notice.log 2>&1` → PASS, exit 0:
   - existing clipboard notice changes English→Chinese without recopy;
   - targeted lost-annotation warning scrolled into view;
   - zero page errors.

Actually viewed using image tools: policy-dark-en.png, inspector-dark-en.png, light-zh.png, lost-bindings-en.png, lost-annotation-en.png, locale-notice-zh.png. Three panes remain readable, fact/planning colors distinguish layers, group/policy controls are usable via independent scrolling, lost-binding warnings and copy location are legible. The earlier light-zh screenshot exposed the cached English clipboard notice; the final locale-notice-zh screenshot verifies the fix.

## Files and self-review

- New: i18n dictionaries/provider/test; groups panel, bounded member reader/test; directory policies panel; pure planning history/test.
- Updated: web API and scoped workspace coordinator/tests, app/navigation/panels, all existing UI panels for translated copy, graph projection/tests, annotation deletion helper/tests, styles.
- Service: only knowledge.ts plus focused service tests. Core schema/hash code unchanged.
- Related integration expectations: MCP restart and service restart lifecycle, preserving historical verification assertions.
- docs/mcp.md documents the new group/policy confirmation impact and historic knowledge limitation.

Self-review found and fixed missing annotation graph-anchor lookup, history disappearance after same-revision refresh, accessible labels for populated fields, and cached-language notices. Current workspace coordinator remains a cohesive ~650-line scoped request owner, with pure history/member work and forms in focused modules; controller explicitly accepted this organization. No unrequested indexer/MCP implementation expansion.

## Limits and handoff

- Session undo history is intentionally not durable across a page reload and is bounded. Remote semantic revisions reset it; conflict responses never silently overwrite server data.
- Natural-language directory purpose is for human/Agent review, not a fabricated semantic validator.
- Independent annotation entities/reassociation, advanced group editing/collapse, complete T08 E2E, mature-target benchmark and native Windows/macOS execution are outside T07. No unchanged indexer benchmark or full T05 flow was repeated. T06 body-timeout Minor M2 remains reserved for T08.
- Historic knowledge-context reconstruction is not implemented by the approved revision-bump strategy.
- Smoke server PID 24092 was verified as the owned `node apps/server/dist/index.js` listening on 4327 and terminated with SIGTERM. Final port/process check follows below. Browser scripts close Chromium in finally blocks.

## Final commit and cleanup evidence

Local implementation commit: `88c109618ae8ef0bd1a0ba3c969201ea09c92b12` — `feat: add localized knowledge controls and revision-safe plan history`.
`git status --short` after commit: empty. Report is in the repository's intentionally ignored `.superpowers/sdd/` working ledger; artifacts are intentionally ignored.
`ps -p 24092 -o pid=,args=`: no process (exit 1). Actual fetch of owned `127.0.0.1:4327/api/health` rejected after termination; cleanup check printed `PASS: owned smoke port 4327 no longer responds`.
Final controller size: 648 lines. No push or publication performed. Independent review remains controller-owned.
