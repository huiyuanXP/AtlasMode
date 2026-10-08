# Focus-first graph navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make changes visible, double-click dependencies understandable and location navigation immediate.
**Architecture:** Central workspace view events coordinate measured React Flow nodes. Pure funnel layout and scoped breadcrumb navigation are derived from actual indexed relations.
**Tech Stack:** Existing TypeScript, React, Zustand, React Flow, Fastify, Vitest and Playwright.
**Spec:** docs/superpowers/specs/2026-10-08-focus-navigation-design.md

## Global Constraints

- Node24/npm frozen lock; preserve package boundaries, existing approval/hash semantics and static unknown evidence.
- No new worktree in cloud; use current work checkout. No Tunnel restart or target-code execution.
- All action focus is sequence-scoped; no stale response or visual autosave may move the camera.
- 80-node default/300 maximum query budget, truncated visibly; 300ms funnel animation with reduced-motion support.
- Claim each Ticket before implementation. Latest user instructions supersede per-ticket approval/review gates: noncritical UI tickets use meaningful focused checks/self-review; final integration has one bounded review of critical Agent process/write boundaries.

## Review Focus

- Multiple modified nodes offscreen: union of affected nodes must be fitted (Task1).
- Slow obsolete navigation: latest user action wins (Tasks1–3).
- Reciprocal/cyclic relations: no false hierarchy or duplicate center (Task2).
- File dependency aggregation: contains edges are context and never imports/calls (Task2).
- Planned files without indexed identity: breadcrumb must never read fictional source (Task3).

### Task 1: UI-01 Automatic action focus

**Files:** Modify apps/web/src/app/workspace.ts, apps/web/src/features/graph/Canvas.tsx and projection.ts; optional bounded server subgraph relationIds anchor extension in queries/routes and client; create graph focus helper/tests as appropriate; modify apps/web/src/app/workspace.test.ts; add tests/e2e/focus-navigation.spec.ts.
**Interfaces:** Produce FocusRequest with sequence and multi-node domain IDs, preserving nodeId compatibility; workspace emits it only for current successful view/semantic events. Task2 will extend it with a funnel scope; Task3 consumes workspace.focus and scope navigation.

- [x] Write failing tests: selecting a plan fits all add_function/move/annotate/relation endpoints; successful add/edit/remove/reconnect/undo/redo focuses affected surviving IDs; failed update preserves focus; later select/project supersedes delayed plan anchoring; theme/drag do not emit focus. Existing plan history tests stay meaningful.
- [x] Run focused Vitest and new browser case; save RED output.
- [x] Implement pure affected-node derivation and multi-node FocusViewport after current projection measurement. Resolve existing fact anchors with bounded graph query where necessary, do not fit whole unrelated graph. Switch hidden changes into both layer. Deleted nodes use surviving neighbor context. No semantic action updates approval solely for camera movement.
- [x] Run focused tests, focused tests, web typecheck/build and relevant lint. Actual browser create a planned node after overview then assert card is in viewport; select multi-change plan and assert all target cards visible. Save concise evidence and inspect screenshot.
- [x] Self-review and commit only task files. Report to controller; controller marks reviewed status.

### Task 2: UI-02 Animated dependency funnel

**Files:** Modify graph/Canvas.tsx, graph/projection.ts, app/workspace.ts, app/WorkspacePanels.tsx and styles/i18n as needed; create graph/funnel.ts and tests; server query/route/client scope if file dependency gathering requires it; extend tests/e2e/focus-navigation.spec.ts.
**Interfaces:** Consume Task1 multi-node focus. Produce workspace funnel state, explicit enter/exit behavior, pure directional layout and file-scope dependency query if required. Export stable type(s) for Task3 breadcrumb selection. Keep current app.focus/expand usable by existing tests.

- [x] RED tests: caller.y < selected.y < callee.y; only selected at waist; reciprocal/cyclic/isolated cases stable; unrelated nodes in horizontal side lane; contains ignored as dependency; actual cross-file calls/imports aggregate once per file. A planned-only node uses plan relations. Old selected query cannot replace new funnel.
- [x] Run focused tests/save RED before implementation.
- [x] Build bounded true-dependency funnel for function/file. Retain unrelated prior visible nodes in side lane, distinguish them visually, show upper/current/lower lane labels and counts. Double click selects current node. Animate position interpolation 300ms and fit related nodes, respecting reduced-motion and cancelling stale transitions. Do not persist automatic coordinates over user layout. Provide visible exit and Escape.
- [x] Run focused tests and affected build/typecheck/lint; browser assert placement and intermediate animation, selected source/breadcrumb coherence, exit restoration, reduced motion. Save and inspect screenshot.
- [x] Self-review, commit and controller integration verification.

### Task 3: UI-03 Clickable location breadcrumbs

**Files:** Create apps/web/src/features/navigation/Breadcrumbs.tsx and path helpers/tests; modify workspace.ts, WorkspacePanels.tsx, api/client.ts, styles/i18n; server query/route if bounded scope navigation not available; extend browser spec.
**Interfaces:** Consume Task1/2 focus/funnel contracts. Produce workspace.navigateScope(path: string, kind: 'folder'|'file') and ordered breadcrumb segments derived from project and selected node; export navigation component usable in later chat shell.

- [x] RED tests for root/nested folders/file/qualified symbol, same-name files in distinct folders, planned path with missing indexed file, and navigation race/project switch.
- [x] Run focused tests/save RED.
- [x] Implement accessible clickable breadcrumb with scoped sibling navigation where helpful. Click folder/root loads bounded child context; click file enters file scope/funnel; click function focuses corresponding function. Use captured snapshot and stable node IDs, no guessed file identity or target filesystem write. Planned paths use plan-node context.
- [x] Run focused tests and affected build/typecheck/lint; actual browser function→file→folder→root and planned path assertions including viewport/breadcrumb content; preserve previous meaningful focus checks.
- [x] Self-review, commit and controller integration verification. Chat bridge may develop concurrently in disjoint files under latest user instructions.


执行结果：本计划产品任务已实现。最新用户约束取代原逐票门禁；真实证据、并行衔接、后续可读性修正及未执行平台项见 ../reviews/focus-chat-2026-10-08/README.md。原生Mimo实际成功，Claude/Windows原生Chat不作成功声明。独立直接API/源码实施及其余积压按Tickets继续。
