### Spec Compliance

- ✅ Requested T07 behavior is implemented: persisted zh/en/theme controls; fact-backed many-to-many user groups; directory policy create/edit/list; committed-revision semantic undo/redo; refreshed temporary-node inspector metadata; and retained, visibly unbound annotations. Evidence: `apps/web/src/app/App.tsx:78`, `apps/web/src/features/groups/GroupsPanel.tsx:13`, `apps/web/src/features/structure/PoliciesPanel.tsx:57`, `apps/web/src/features/planning/history.ts:19`, `apps/web/src/app/workspace.ts:128`, `apps/web/src/features/planning/PlanEditor.tsx:198`.
- ✅ Binding approval ruling is implemented without public schema/hash changes: meaningful group/policy changes atomically advance all current plans in the same project; normalized member/forbidden sets and provenance-only changes do not; historical approval/settings records are untouched. Evidence: `packages/service/src/knowledge.ts:134`, `packages/service/src/knowledge.ts:174`, `packages/service/src/knowledge.ts:190`; purpose-only, stale-revision, historical verification, isolation, normalization and rollback regressions at `packages/service/src/workspace.test.ts:174`.
- ✅ Missing group members use bounded pages of 20 and at most four context requests, each requesting limit 1; missing 404/NOT_FOUND differs from transport errors; snapshots are checked again after the batch. Evidence: `apps/web/src/features/groups/memberBindings.ts:15`, `apps/web/src/app/workspace.ts:537`. Lost annotation warnings use authoritative INVALID_TARGET/operationIndex, and missing annotation targets are excluded from graph anchors rather than inferred from canvas absence: `apps/web/src/features/planning/PlanEditor.tsx:202`, `apps/web/src/app/workspace.ts:396`.
- ❌ Minor completeness gap in locale switching for client-generated error help, detailed as M1 below; normal controls, projection labels and repaired clipboard notices are translated.
- ⚠️ Native Windows/macOS execution, comprehensive T08 E2E and external native-client integrations remain unverified here, as explicitly scoped out in `task-7-report.md` under Limits and handoff. Existing core forbidden-dependency logic and full rendered-node focus behavior are unchanged; the diff preserves their interfaces, and the controller owns their broader acceptance.

### Strengths

- `apps/web/src/features/planning/history.ts:19` ties history to project, plan, accepted revision and semantic content; clones prevent fact/operation alias mutation, bounded past/future arrays limit retained state, and external changes reset history. `apps/web/src/app/workspace.ts:319` updates history only inside the successful save callback. Controller regressions cover failed undo, independent layout and same-revision refresh (`apps/web/src/app/workspace.test.ts:549`, `apps/web/src/app/workspace.test.ts:698`).
- `packages/service/src/knowledge.ts:196` makes knowledge persistence and plan invalidation one transaction. The rollback regression deliberately fails the second affected plan write and checks both knowledge and the first plan rollback (`packages/service/src/workspace.test.ts:289`). `docs/mcp.md:174` clearly states conservative project-wide reconfirmation and the inability to reconstruct historical knowledge context.
- `apps/web/src/features/planning/operations.ts:32` retains authored annotations after temporary-target removal. `apps/web/src/app/workspace.ts:133` derives selected temporary metadata from the accepted plan; `apps/web/src/app/workspace.test.ts:475` checks name/path/signature through edit, undo and redo. Browser assertions also check the payload passed to clipboard.writeText after edit and undo (`artifacts/t07/browser-smoke.mjs:53`); clipboard is intercepted, so this verifies copied-location content rather than native clipboard integration.
- `apps/web/src/i18n/en.ts:2` has a complete typed dictionary; rendered controls and authored-text preservation are tested at `apps/web/src/i18n/locale.test.tsx:6`. `apps/web/src/features/graph/Inspector.tsx:23` stores a locale-independent copy notice key, and `artifacts/t07/locale-notice.mjs:6` checks switching an existing notice without recopying.
- Recorded verification is consistent: first full run had 190 passes and one obsolete integration expectation (`artifacts/t07/t07-fulltest.log:13`, `:34`); the changed expectation preserves historic approval assertions (`tests/integration/workspace-lifecycle.test.ts:456`). Targeted lifecycle then passed 24 (`artifacts/t07/t07-lifecycle.log:6`), final full run passed 192 across 18 files (`artifacts/t07/t07-final-test.log:9`), all seven workspaces built/typechecked (`artifacts/t07/t07-final-build.log:6`, `artifacts/t07/t07-final-typecheck.log:10`), and lint logged no findings (`artifacts/t07/t07-final-lint.log:3`). No unexpected warnings appear in these recorded final logs.
- Browser logs and assertion sites support new controls, shared groups, policy reconfirmation/forbidden dependencies, history, lost bindings and locale notices (`artifacts/t07/browser-smoke.log:2`, `artifacts/t07/missing-bindings.mjs:17`, `artifacts/t07/locale-notice.log:1`). Independently viewed `lost-bindings-en.png`, `lost-annotation-en.png` and `locale-notice-zh.png`: retained knowledge and translated notice are legible; no Critical/Important visual issue observed. The deliberate missing-member 404 is explicitly accounted for (`artifacts/t07/missing-bindings.log:9`).

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- None found.

#### Minor (Nice to Have)

- **M1 — Remaining client error text does not follow locale changes.** `apps/web/src/app/workspace.ts:105` materializes retry/conflict help using the current locale into the persistent `error` string. Switching language while that error remains visible changes the banner label but leaves its UI-authored help in the old language. Additionally, `apps/web/src/features/groups/memberBindings.ts:31` and `apps/web/src/app/workspace.ts:557` generate a hardcoded English snapshot-change message. Keep service diagnostic text verbatim, but store client help/error keys and translate at render time, as already done for notices; cover error-then-locale-switch and snapshot mismatch in a focused regression. This is a nonblocking localization consistency defect.

### Assessment

**Task quality:** Approved with Minor M1.

**Reasoning:** Semantic history and transactional knowledge invalidation follow the agreed server-authoritative model, with meaningful regressions and recorded real HTTP/browser evidence. The remaining locale issue is limited to client-generated error text and does not compromise persistence, approval validity or project isolation.

- **Review checks:** Read the supplied review package once in sequential ranges; the first tool result truncated App mid-function, so read only `apps/web/src/app/App.tsx:65` onward to complete that function. Named cross-cutting risk “new request keys must reject stale project/page completions” checked unchanged `apps/web/src/api/scope.ts:24`; named risk “knowledge revision bumps during approval refresh must conflict” checked the existing transaction/revision-check sites in unchanged `packages/service/src/planning.ts:146` and `:167`. No suites, browser flows, git diffs or source mutations were run; only this ignored review report was written.
