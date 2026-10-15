# POL-01 UI repair r1 handoff — 2026-10-10

Targeted repair for original independent REQUEST_CHANGES C0/I2/M1, `../ui-mcp-window-independent-review.md`, SHA `9cfdc483400fdf6692d08a06b257028938832a814a899a2b83263e35c047ac2f`. All original nine source bytes, frozen window/reports/logs/configs and independent report were copied and sealed before changes under `before/`. Original files/reports/receipts were not overwritten.

Only four authorized sources differ: controller, its test, pure Panel notice rendering, its test. Existing PoliciesPanel wrapper, API transport/tests and MCP source/tests retain their original hashes. No shared Workspace/API/i18n, service/routes, user file/DB, schema, root build/dist/stage/commit/spawn changes occurred. The ticket remains PARTIAL; shared callback integration, mounted/browser/whole-system acceptance and independent targeted rereview are outstanding.

## Repairs

I1: importLegacy ACK has its own `notice: imported`. It confirms only the actual import request; local draft body and dirty flag are preserved because the import operation never submitted them. Only acknowledged legacy/folder upserts clear that draft's dirty state and normalize acknowledged ID/path. Dirty legacy and dirty folder draft B tests verify exact text/dirty retention, import-only operation, actual accepted callback operation and no false saved-form message. The view has separate import-completed/unsaved-form and import-sync-failed text in both existing local languages.

I2: reload keeps the immutable pending Request privately through the complete matched state/policies read and accepted-read callback. Starting or failing a read is not resolution. readState failure, readPolicies failure, accepted-read failure, or quarantine retain the same UUID/body, exact-retry action and edit/selection lock. No new request or hidden retry/rebase occurs. Only the complete current-scope accepted reread terminates the replay; the input remains for manual review, and a test explicitly selects the observed existing server ID before the next edit. Project selection/dispose still invalidates the old scope as before.

M1: each submit captures a generation token, shared with the existing read-generation counter; all write ACK/completion/failure publication checks epoch plus token. After real ACK, the request is terminal and no longer replayable, while busy stays true through the asynchronous accepted callback. Known ACK followed by callback failure preserves saved/imported notice, needsReload and WORKSPACE_SYNC_REQUIRED, with no uncertain-write flag or second publication. A finally releases busy only for the current token. Normal public reload/edit is blocked during this callback; a separate test forcibly supersedes the exposed store in the same epoch to prove the defensive token prevents old rejection overwriting a newer accepted read. It is explicitly not presented as a naturally permitted busy bypass.

## Actual verification

`red.txt`: original frozen source plus ten new scoped tests: nine assertions fail, 28 pass across affected two files. It genuinely reproduces I1, all three I2 failure points and busy/token/view issues; the already-safe known-ACK no-republish case passes rather than being falsely counted RED.

`green1.txt` retains a transient repair implementation failure (token used in the initial guard before declaration): 17 FAIL, 2 unhandled rejections. The initial scope guard was corrected before token creation. No assertion or timeout was suppressed to conceal that fault. `green2.txt` then passes all 37 affected tests. Four further conformance tests were added after GREEN (quarantine, fully accepted reread with observed ID, delayed callback A→B→A, dispose), not claimed as original RED.

`green-final.txt`: final 5 source files / **51 PASS**, tool exit0: controller30, pure/SSR Panel11, transport3, MCP3, prior MCP scope4. All original37 behaviors remain covered; new14 are counted separately. Actual execution command:

```sh
export PATH=/home/agent/.local/bin:$PATH
./node_modules/.bin/vitest run --config /tmp/atlasmode-pol01-ui-vitest.config.mjs apps/web/src/api/structure-client.test.ts apps/web/src/features/structure/policy-controller.test.ts apps/web/src/features/structure/StructurePolicyPanel.test.tsx apps/mcp/src/structure.test.ts apps/mcp/src/scope.test.ts
```

`types.txt`: existing source-alias config includes all nine paths, actual `./node_modules/.bin/tsc -p /tmp/atlasmode-pol01-ui-tsconfig.json --noEmit`, exit0. `lint.txt`: actual ESLint on four changed paths, exit0. Empty no-error outputs and copied configs are preserved. Prettier ran only on changed paths. No historical pnpm/biome reproduction wording is reused or original old logs altered.

`runtime.json`: unchanged MCP proof fixtures close actual SDK/MCP/owned HTTP servers in finally. Later read-only probes confirm worker PID115981 absent ESRCH and owned ports44329/37745/34831 ECONNREFUSED. No tunnel/DB/root instance was created or source/evidence removed. Pure/SSR/controller tests are not mounted/browser tests; SDK/TCP fixtures are not real SQLite service acceptance.

## Freeze for the independent reviewer

Nine-path `freeze.sha256`: `d911b4f935985f0d3ab16bf0651e041d0c23e2917febf78f881ac4f5c3c2e8e6`. Four-path `changed.sha256` lists exact new hashes; the other five are byte-identical to the original. Incremental `repair.patch` (against sealed `before/source`, not broad HEAD): `f7ecae051b8eddc70930b28358153c0120a55a693892d6aeaa3b4eeadb93b684`. Current source copies are in `frozen-source/`. Full original before archive and current artifacts are independently sealed. No further source writes should occur before targeted review.
