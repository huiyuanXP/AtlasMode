# FS01 R3 narrow independent review

2026-10-10. Original FS R1/R2 reviewer, existing explicit gpt-6.1-sol high; not the R3 author. Scope: frozen three-file R3 patch and retained failure/source-check evidence. Read-only VM2 SSH inspection, report written locally only. No source/test edits, execution, build, database, staging or delegation.

**APPROVE — C0 / I0 / M0 for the narrow R3 candidate.** The missing-request render repair and fixture corrections are consistent with the stated contracts. During review root supplied its completed exact-overlay build and nine real browser cases; their raw PASS receipts were subsequently read as described below. No whole-application green gate or ticket DONE is inferred. FS01 remains PARTIAL pending root's complete integration/visual/resource acceptance.

## Freeze and retained baselines

Freeze `/tmp/atlas-fs01-real-fixture-freeze-20261010-r3`:

| Input | SHA256, independently checked before and after |
| --- | --- |
| manifest.json | `0e1023d05fe06e89f954565a181963f326caf2b13d5579ff66eb5c56a8987cd1` |
| source.sha256 | `2bb77ee6e4b21d730abb5645bb52581d6bf8123c7a345cc952f5cc4dc1d61c73` |
| owned.patch | `3c98aeaf222123ab7882dabb476a3cd0979ef9285bbf36bb145de905bec231fd` |
| fixture-vs-private.patch | `7d293101c3c644c303393b52f3acf1de0c6e0f8969ad140168ad06d11f9066ed` |
| after tests/e2e/ownership.spec.ts | `5d71a88fd2ec419ccfd36b525ded929023117e820252f5725d1c830f1ec813ff` |
| after OwnershipTargets.tsx | `962b977aab4522600e06c48f6a36cf80fe77c4990b828723bf34d60158e1cf56` |
| after OwnershipTargets.test.tsx | `f4413adacb3828333b8d8a434719309ca14a5a8c1a1d2137e07ddade72ac1534` |

Full owned.patch read; both component files read fully, changed fixture paths and original acceptance assertions inspected. All three before/after hashes match the manifest. Independently checked that all nine original test names and order remain present. Unlike R2's additions, R3 modifies helpers/assertions within existing cases; this review does not call R3 append-only.

Baseline archive `/tmp/atlas-fs01-real-fixture-baseline-20261010-1945` manifest SHA `c5a1e005a3b6350b3c104e7c6b92b053ccbf1eb805a7c2a629d2af797e649f5e`: independently checked all **98** recorded file byte counts and SHA hashes. Global R2 fixture bytes equal R3 before; private five-fix fixture bytes equal R3 private-fixture-before. Original two browser runs, source-unit failure, screenshots/traces/receipts are retained rather than overwritten. This is archive-integrity verification, not a new runtime test or a visual inspection of all images.

## Product-only repair

OwnershipTargets.tsx:45–47 now requires `!!state.request` for active ready actions and uses `currentPath = state.request?.path ?? "."`. Breadcrumb construction uses that safe string rather than dereferencing `request!.path`. Error/idle/loading/requestless malformed-ready render a disabled root breadcrumb. Requestless state cannot activate planned targets, choose/browse/drop; fact cards, if an inconsistent requestless state retained scope, remain disabled via ready=false. Existing diagnostic/loading/partial-scope display remains. Normal ready state with actual request preserves breadcrumbs and target paths.

Existing original two SSR tests remain; the error case adds disabled-root evidence and three idle/loading/ready requestless tests are added. Callback functions that throw are not actually invoked by SSR, so those tests establish rendered availability and absence of planned target markup, not mounted event execution. Source review of ready/onDrop guards complements that limited evidence. No session authority, API, plan, approval, source or lifecycle semantics changed in this product hunk.

Retained actual scoped RED reproduces original 1 FAIL / 1 PASS with `Cannot read properties of undefined (reading 'path')`, OwnershipTargets.tsx:94. Retained GREEN is 51 PASS across five source-level files (Targets5/session27/ownership14/display3/controller2). The three new requestless tests have GREEN evidence only; no separate baseline RED is claimed.

## Fixture changes preserve real proof

- Four function-result click locators are narrowed to the visible exact Search functions region, retaining their function-name assertions. The held late context route encodes project and function domain IDs, matching real client URL construction; the test still holds a real fetched response then fulfills those same bytes, rather than manufacturing context or source.
- `apiPath` decodes observed URL pathname once before comparing it with exact true project/plan IDs. Method, SID/revision/body, response-status and actual request assertions remain; no broad matching or guessed IDs replace them. Query parameters remain parsed normally for actual source paths.
- Native helper still uses ordinary page.mouse move/down/up. Passive capture listener records events and DataTransfer types; it neither synthesizes events/DataTransfer nor injects workspace state. Original source domain ID remains asserted at dragstart. Capture-phase dragstart precedes React's setData, so MIME assertion is moved to **both** native drop and native dragend, with genuine source domain ID additionally pinned on dragend. Original second-run raw failures show exactly empty dragstart types followed by real ownership MIME on drop/end; the correction preserves real MIME acceptance instead of deleting it.
- Two stale/idle-snapshot scenarios previously expected a content-addressed snapshot ID to change despite unchanged input. New externalFixtureChange is explicitly restricted to this test's generated temporary root/project, checks the complete initial source hash map and exact known `other/index.ts` bytes first, appends a fixed harmless comment, and computes a **fixed whole expected hash map** changing that path only. It immediately and later checks all source bytes/paths against that precomputed map, marker non-execution and errors/external requests. It does not bless whatever the application happened to leave on disk. Both cases demand actual refresh/summary SID **and contentHash** changes; there is no injected snapshot or state. The comment edit is an external test actor, not an FS product source write, and the separate receipt records its exact bytes and expected map.
- Folded-group case captures plan before/after actual group creation, requires an exact +1 knowledge-context revision and unchanged baseline SID, confirms current revision remains that value before save, then uses it as expectedRevision/SID CAS and checks ownership save +1. This replaces an obsolete hardcoded revision1 with a verified actual lifecycle transition; it still requires exact sole move_function operation, true function domain ID rather than group ID, unchanged group membership before/after reload, complete filename and source invariants.

Original nine scenarios remain: native file ownership/approval invalidation/reconfirmation/undo-redo/verification/restart; folder complete filename/cancel/actual stale snapshot409; real late source context; layout-only pointer behavior; folded real-domain member; dirty advanced input and external revision; terminal A→B→A; no-intent old tray across actual verification/new draft; visible child/parent browsing. No forced/synthetic click, store injection, click retries, timeout increase, removed failure scenario or API-only substitute for the native UI operation appears in the diff. Actual HTTP calls prepare or observe owned fixtures and assert effects, while ownership actions remain real controls/mouse.

## Raw evidence, not fresh product PASS

| Retained evidence | Actual result read | SHA256 |
| --- | --- | --- |
| baseline approved-fs-nine-browser.log | First nine FAIL | `af358242e10dd8bf2fb32a3614438e07a9e180edb38c9c0818da6c0734bbedb6` |
| baseline fs-nine-fixture-repair-browser.log | Second three PASS / six FAIL | `fe920dafd4801cc226e6217a852491e8c856b5bb92578bb3a47a350291b38911` |
| baseline approved-overlay-unit.log | Original full root1247 PASS / one FAIL | `8b924c6584728c0c5c43379b3c1cccf7f17b95fcb783029ecdeacecaae0ea2ff` |
| evidence/atlas-fs01-real-targets-red.log | Scoped original one FAIL / one PASS | `76609165456d8ce74a4ed431892b61a3634dc3703727339a40b395e8d885b58a` |
| evidence/atlas-fs01-real-targets-green.log | Source51 PASS / five files | `c535717f741171683bd4f96eac7bafe8b96398aafde7ce173549b7f5066d24e1` |
| evidence/atlas-fs01-real-fixture-list.log | Nine definitions discovered, not run | `29b284734f3ba595cfc358b12bdf90fa6eb253efb0c87d905eacc2c5ce963de6` |

Author receipt reports scoped lint/noEmit exit0; empty lint and production-test-type logs alone cannot independently establish exit status. Target product/test types file SHA `9bf3819c9ef8d36d183377b637c4c3f4cbc7c55f5872a8a176e8557741ac3605` is source-alias scoped evidence, not a ordinary compiled root build. Reviewer executed none of these tests or source. Prior registered-server resource audit is limited to prior runs; this review does not declare other root/KN resources stopped.

## Newly supplied exact-overlay compiled gate

After the initial source review, main authorized reading its newly completed gate at `/tmp/atlas-integration-fs-kn-pol-20261010-c9d842hi`. Independently checked the isolated workspace's three source hashes equal the R3 frozen after hashes, then read `fs-r3-build-exit.json` (npm run build exit0), `fs-r3-nine-browser.log` (all nine PASS,31.2s) and `fs-r3-nine-browser-exit.json` (Playwright ownership spec exit0). These are main's actual executions, not reviewer reruns:

- build exit receipt SHA `0166c8bb4a0bceedf49924ddee8043cc6fde421681771cc45faec053cda3e420`; build.log SHA `1ba5c3e0248a041779950679980e223a873c5fd6fc484f5d327fd09e5479992a`.
- browser log SHA `f356d9a0f9550f1f7b4debf31d1d558679f4073c697da6f14f90ab6a17337643`; exit receipt SHA `28aac5b7719c178aac8b03de789a6a8e22538016a6cb97c2609287db02aaaf82`.

Read native-file/retired-preview/idle-tray/browse/layout/folded/folder receipt JSON under `workspace/artifacts/fs-r3-nine/results`. File/A→B→A/idle/browse receipts record empty capture-phase dragstart types with genuine function domain ID, native drop and dragend ownership MIME, and that same genuine domain ID on dragend; accepted move operations use those domain IDs. Idle S0→S1 receipt records both real SID and contentHash change. Both explicit-editor receipts change exactly `other/index.ts`, preserve the complete filename set, and fixed expected maps match final source maps; unchanged cases' maps match originals. Nine cleanup receipt files are present. This is receipt inspection; reviewer did not independently probe live PIDs/ports, inspect every screenshot, or execute tests. Main owns those remaining checks.

The initially guessed results JSON parent path was absent; no aggregate-JSON statistics or zero-retry claim is inferred from that path. The raw browser log and explicit exit0 receipt establish the stated single nine-case PASS. Prior failures remain separately preserved.

## Remaining gates

Root's exact-overlay build and nine native cases now have the above recorded PASS. Root still owns screenshot review, live resource closure verification, fresh independent helper/target checks and all required merged gates. Main explicitly reports an old planning.mjs panel/CAS failure and pending POL callback/merged integration; this review does not declare wholeapp/root all-green or certify that separate scope. Preserve raw failures and diagnose any remaining failure without assertion weakening. No product DONE or broad root acceptance is claimed. R3 manifest/source/patch/private-diff hashes and all before/after files remained exact at the source-review end; isolated overlay also matched all three hashes when new gate receipts were inspected.
