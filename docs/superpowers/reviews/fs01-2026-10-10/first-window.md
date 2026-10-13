# FS-01 first implementation window freeze

Date: 2026-10-10. Status: first-window implemented and scoped checks passed; full FS-01 remains PARTIAL/TODO, independent product review and second-window integration gates pending. Main authorized the source window; author checks are not an independent APPROVE. Design limited re-review is preserved separately in [independent-rereview.md](independent-rereview.md), C0/I0/M0. Original design review SHA receipts remain unchanged.

Implemented: shared last-effective path/selected-function retarget coalescing, advanced metadata/annotation preservation, clean form path synchronization and dirty/stale/explicit-reload/ACK guards, PlanningPanel project/plan/node/edge identity key, new standalone target tray/path/nonce/request-generation helpers, optional validated server snapshot precondition in the existing SQLite transaction and required ownership client wrapper. WorkspaceService input changed by one optional field only; route changed by one field only. No Canvas/workspace controller/WorkspacePanels/Nav/i18n/projection integration was made in this window.

Evidence (VM2):

- Unit/integration: **7 files / 38 tests PASS**, `/tmp/atlas-fs01-first-window-green.log`; actual public SQLite storage, source WorkspaceService and source Fastify route fixture, S1-before-save rejects, save-before-S1 becomes stale, baseline/hash/foreign/revision conflicts, legacy omission and client tuple serialization. SQLite uses disposable :memory:, no user DB.
- Actual Chromium component fixture: **4/4 PASS**, `/tmp/atlas-fs01-first-form-playwright.log` and `/tmp/atlas-fs01-first-form-results`. Source Vite component fixture with private cache; not compiled production whole-app drag proof. The fixture belongs to `tests/e2e`, avoiding Chromium requirements in native unit-only CI jobs.
- Real baseline replay: **4/4 RED**, `/tmp/atlas-fs01-first-form-baseline-red.log`, `/tmp/atlas-fs01-first-form-baseline-results`; tracked three forms read from HEAD `619c39a82a4a9d6d3d8c8dec2a8846f7f00d52f2` into private `/tmp/atlas-fs01-form-baseline` and substituted only inside Vite. Shared source was never reverted. It demonstrates old physical-path display and revision remount losing function/title dirty inputs. Earlier fixture path/React DOM import errors were harness failures, not product RED evidence.
- Initial helper/SQLite RED: `/tmp/atlas-fs01-first-red.log`; tray RED: `/tmp/atlas-fs01-tray-red.log`. Preserve failed receipts, including one new HTTP assertion corrected to existing top-level code after 409 was already observed.
- Scoped ESLint PASS `/tmp/atlas-fs01-first-lint.log`; web/service/server no-emit typechecks PASS `/tmp/atlas-fs01-first-{web,service,server}-typecheck.log`; owned full-text whitespace check PASS. No root build/test or shared dist write.

Frozen manifest SHA256: `ac862e8aac6af8d6ddcf3d73096a759d7bf0b74e10275728d3f92859709f27ed`. Manifest `/tmp/atlas-fs01-first-window.sha256`; exact source copies `/tmp/atlas-fs01-first-window-snapshot`. File hashes:

```text
f4ad503d3043ac62107b5bafff1e0e034db954a4da4df26d1fcadc25f8e7d8fc  apps/web/src/features/planning/operations.ts
5018603331e0b9b984ff68ea3b8fc65dc873fff5fe919e5efb70ad4ca7b8fe27  apps/web/src/features/planning/function-target.ts
d428dfc48649553a3fc6e40cf877f3eae1243710bcbb0769c3816ef526d8df89  apps/web/src/features/planning/function-target.test.ts
d244a8e9b199122cb2437f225f36acc730ada215b0e29615fcf978da76fbcd9e  apps/web/src/features/planning/FunctionForm.tsx
aa466e3dbf139a5ca18b7b1f86ca28434d99d6e57db746e4c0c4d4cb84565eb1  apps/web/src/features/planning/PlanEditor.tsx
bc32718d18e105f6884fadefdadb6a2d2dcc1fe505253e56989acf9e23baff01  apps/web/src/features/planning/PlanningPanel.tsx
d5bbe93903474b85cb70e314fbbe610f8c04071095dc0e1ff0c0740fef66bd29  apps/web/src/api/client.ts
27d2d7ccef9a772c0da85ef445c1b443c7a8fef14362d44006ba65cc2838dc70  apps/web/src/api/ownership-request.test.ts
733dfc18518b8a3f3f330a6213657992bab250e37b444cc62cf29da1416be15a  apps/web/src/features/structure/ownership.ts
b55e2d12a15a715f338c6292e16b368a1b6e263d92c921102d8051d2a3c113f4  apps/web/src/features/structure/ownership.test.ts
f19a6d3e696c13848a50c8d6250f93123cb4f0712df0d81dbfa73757e5839856  apps/web/src/features/structure/ownership-controller.ts
45474635f293d42b80a14909b258ced3b0668ea84392f8261d768559a6c0f34b  apps/web/src/features/structure/ownership-controller.test.ts
4c9880d75005cc22d14f4a27809c8d8be8f195470a2ebbc0e47b29fd35629e2f  apps/web/src/features/structure/OwnershipTargets.tsx
e11db867eac682951229c718650435ea9ecff3cec7375d6f67199c63fefbaa0e  apps/web/src/features/structure/OwnershipTargets.test.tsx
487cad592b48b6bf2c38dbe6e63e8093eb49ef8b7487b6ce6f6db02be1c422e8  packages/service/src/planning.ts
45d17cc730e0ca9774cc85f0b4155cefd9d9c85c8da04dd2559c823233fa3c46  packages/service/src/workspace.ts
18ad7fc150093853fa9ea68859eab205fb8bda164b4d658810eac56f179dab90  apps/server/src/routes.ts
66d5f629f9402c7e8fc5cf4975a49df16d141e023111cd6b82e499da6e2a7e30  tests/integration/fs01-precondition.test.ts
9af5c83b374f1125016750bf989fe93a10819667b089b94c3ce22d2b6e06a2ea  tests/e2e/ownership-form.spec.ts
```

Next authorized window: real Canvas ownership gesture, independent target tray/preview/workspace snapshot-bound save, effective path consumers, fact-context/live-source generation checks and localized labels. Preserve IDX-03 diagnostics and existing graph/group/map/layout behaviors. Full browser must prove pointer drag into file and folder, exact filename/path, source byte/path invariants, explicit approval/version/verification and server snapshot races. Product review and main-controlled compiled clean/full gates remain pending. No source mv/write/executor/IDX-04 migration, model/provider request, commit/push or global ticket/state change occurred.
