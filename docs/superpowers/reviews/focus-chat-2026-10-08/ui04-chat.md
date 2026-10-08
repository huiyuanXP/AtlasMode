> 归档说明：本文保留实现者原始报告（含中间失败和当时限制）。其中相邻日志/截图路径指原 `.superpowers/sdd/2026-10-08-focus-navigation/` 或 `.superpowers/sdd/2026-10-08-agent-chat/`，并非本归档目录。当前最终结论以本目录 README 为准。

# Task 2 implementation report — preparation stage

2026-10-08 UTC. Scope: owned new `apps/web/src/features/chat/**` and
`apps/web/src/features/planning/PlanOverview.tsx`; shared integration is pending
controller release. No shared file edited, no commit yet.

## Implemented preparation

- Web-local exact bridge transport contracts; `ChatApi` routes project/run IDs
  through encoded HTTP paths and retains structured server error codes.
- Project/channel controllers, draft-preserving session registry, 500ms polling;
  terminal completed/failed/cancelled outcomes always invoke reread callback.
- Late start acknowledgement after unmount or early stop is immediately cancelled;
  late polling results cannot overwrite cancellation. Polling connection loss
  cancels the still-owned handle before rereading partial journaled changes.
- New drafts typed during streaming survive. Failed/cancelled input returns when
  there is no newer draft. Each channel retains twenty latest conversation turns.
- Bilingual plain-language Chat shows connection truth, user/model text, concise
  mapped activity and partial-save notice. No tool arguments/raw tool JSON/reasoning.
- Compact readable plan selection/change list plus existing trustworthy
  approval/undo/redo/validation/export/verification callbacks.

## Required shared integration interfaces

Create one `createChatSessions()` per app and cache controllers with
`get(projectId, 'explore'|'plan')`. Panel unmount calls controller.dispose();
registry maintains draft state across switches. App cleanup disposes registry.

`ChatPanel` props: controller, locale, context: () => ChatContext,
onSend: () => Settled. `onSend()` captures project/navigation/current-plan edit
sequence at actual submission. Returned callback receives
`{projectId,channel,run?:ChatRun}`; actual run includes changedPlanIds from mutation
journal and mayHaveSavedChanges. Sync rereads actual current summaries/plans/groups/
routes/policies after every terminal state, focusing only journaled plan IDs and
only if captured sequence still permits. Never infer Agent ownership from changed
plan list differences. Never overwrite newer navigation or concurrent edits.

## Verification evidence

RED witnessed six controller behavior failures, two rendering feature failures,
and transport failure before implementation. Added sync-race/history behavior
RED then GREEN. SSR rendering scenario explicitly supplies prepared state as
Zustand initial server snapshot; no runtime fake provider path.

- `npx vitest run apps/web/src/features/chat`: 14 tests in four files passed.
- `npm run typecheck --workspace=@codemap/web`: exit 0.
- Owned paths `npx eslint ...`: exit 0.
- Root suite deliberately not run, per task scope/latest execution constraint.
- Browser verification and affected production build await shared shell integration.

## Limitations

This is preparation readiness, not completed UI-04. Actual provider here remains
unavailable/unconfigured or unauthenticated; no model completion has been claimed.
Test transport injection is constructor-only; no production env fake adapter.
Source-writing remains AG-02. No install, worktree, tunnel, global config or target
source execution. Independent controller review and final integration still pending.

## Recovery finish — 2026-10-08 UTC

The restarted worker finished shared shell integration in the existing checkout.
Owned files are the modified `apps/web/**`, new chat feature/PlanOverview, the six
adapted existing E2E files, new agent-chat E2E and `tests/support/chat-shell.mjs`.
Server/profile/package/lock/docs integration remains controller/backend ownership.

- Default exploration Chat and planning overview/Chat replace technical forms;
  source and legacy planning/group/policy/diagnostics controls remain explicit
  opt-in drawers, and project opening uses a modal. Search stays directly reachable.
- Agent terminal outcomes reread journaled current state, select/focus actual
  affected changes, and respect newer project/navigation/edit state. Dirty plan
  metadata blocks replacement; dirty-state cleanup now occurs on unmount rather
  than releasing the editor during a dirty-state transition.
- Controller-raised refresh boundary reproduced RED: deleting the selected
  dependency root made the old projection query return NOT_FOUND and prevented
  latest summary/plans from landing. Only projection NOT_FOUND/404 now clears
  obsolete graph/root/context and posts a bilingual missing-location notice while
  accepting fresh metadata. Other service/network errors still surface. Both
  deletion and non-NOT_FOUND error checks pass.
- Profile-ready wording uses existing account or API/Profile configuration,
  instead of universally asking for client login. Optional active profile/model
  metadata is displayed next to Codex/Claude readiness, without credentials,
  environment values or provider URLs. Actual model completion is backend-owned.

### Browser regression causes and final evidence

Existing planning E2E required explicit source drawer and project-open modal
actions, plus a scoped validation banner because Chat adds independent status
elements. Its original approval/revision/hash/source/target assertions remain.
The fixed edge midpoint could hit a crossing contains edge, or lie beneath node
cards. The harness now samples the requested SVG curve and its interactive stroke
using actual document.elementFromPoint, mouse-clicks an exposed segment of that
exact relation, and additionally asserts the selected domain relation ID before
editing. No synthetic event or weakened relation assertions.

- `npx vitest run apps/web/src/features/chat`: **23 tests / 6 files passed**.
- `npm run typecheck --workspace=@codemap/web`: **exit 0**, including final optional
  profile/model rendering change. Owned TS/TSX/E2E/helper ESLint and diff-check
  also exit 0.
- `npm run build --workspace=@codemap/web`: **exit 0**; Vite warns the main JS chunk
  is slightly above 500 kB. This build includes all functional fixes; final small
  ready-profile label/CSS wrapping subsequently passed typecheck/lint and awaits
  the controller's integrated build.
- `npx playwright test tests/e2e/planning.spec.mjs tests/e2e/agent-chat.spec.ts
  --output=artifacts/e2e/ui04-final`: both Chat cases passed (4.3s/4.4s). Planning
  identified the covered-curve sampling gap; after expanding sampling along the
  interactive path, final `npx playwright test tests/e2e/planning.spec.mjs
  --output=artifacts/e2e/ui04-planning-final`: **1 passed**, complete production
  UI/SDK offline planning/approval/export/restart/three-state verification flow
  (17.5s test, 19.4s command).
- Disconnected case explicitly configures a nonexistent trusted executable;
  it does not depend on the host's real CLI login/Profile. HTTP 503, preserved
  submitted input, absence of fabricated assistant replies and opt-in controls
  are verified. The second scenario is clearly labeled as a trusted simulated
  model adapter with actual HTTP/storage journal writes, stream/cancel/project
  isolation and multi-object graph focus.
- Actual screenshots inspected: `artifacts/e2e/agent-chat/light.png`, `dark.png`,
  `narrow.png`, `narrow-plan.png`. The 430px browser scrolls the planning input
  into view and edits it, with no document horizontal overflow; both columns are
  accessible through the responsive workspace scroll.

One early browser invocation used the stale documented system Chromium path,
which is absent after restart; the installed Playwright Chromium works. Two
temporarily overlapping Playwright processes shared the default output directory
and failed trace cleanup with ENOENT after functional steps; isolated output and
serial execution removed that harness conflict. These are not product PASS runs.

Self-review checked shell reachability, lifecycle cancellation, terminal refresh
guards, metadata dirty protection, missing projection recovery, localization,
profile readiness truth and preservation of existing browser assertions. No root
suite or extra review/checksum gate was run per current explicit scope; controller
owns integrated build/typecheck/lint/tests/all-E2E and final review. No native
Windows/macOS, real model call, source-writing, install, tunnel or global config
action was performed by this worker. Commit waits for controller Git lease.

Controller granted exact-path Git lease. UI-04 committed as
`594be0e` (`feat(web): add conversation-led agent planning shell`), 30 owned files.
Owned frontend/E2E/helper paths are clean and the index is empty; no backend,
AGENTS.md, root docs/scripts, manifest or lockfile entered this commit. Lease
released after report handoff. Remaining: controller's integrated checks/final
review, backend actual profile/model smoke, platform/source-writing limitations
tracked in their existing tickets.
