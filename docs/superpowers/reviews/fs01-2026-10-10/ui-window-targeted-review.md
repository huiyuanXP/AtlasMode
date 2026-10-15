# FS-01 second UI R1 — independent targeted source review

2026-10-10. Reviewer `/root/grp01_design/grp01_implement`, original explicit `gpt-6.1-sol high`; not an implementation author. **REQUEST_CHANGES — C0 / I1 / M0.** Original I1 and I2 are addressed at source level, but the new epoch guard introduces a real target-tray browsing regression described below. No tests or browser interactions were executed by this reviewer.

## Frozen input and scope

VM2 candidate: `/tmp/atlas-fs01-ui-r1-freeze-20261010-1828`. Review is limited to its six before/after paths and exact narrow patch, the original review, and author raw R1 receipts. Locations below are relative to the candidate's `after/` unless specified otherwise. The earlier `1823` archive is not the candidate.

| Artifact | Verified starting/ending SHA256 |
| --- | --- |
| manifest.json | f6d0951d23b7df837bf473ee632f26ebb84fe32006eea2080eb6eb178bd2bf37 |
| source.sha256 | 36c73a7f6ef558356d89b5e95dbb3af67f9458255e700288b821087035522068 |
| owned.patch | 6a5828232ea05eaf5ad91168d8b50179b2b1e14abab6f1a19102405860afb4fd |
| receipt.json | b75619ab2293bd569970af1399c1a74b9951c2c0be6961fc30e86749073ef9c4 |
| ui-window-independent-review.md | d0510e5d873b1afb20765dc437e609fb2ee9643ab48993e4ff6bcc654f60fb3f |
| Repo docs/superpowers/reviews/fs01-2026-10-10/ui-window-r1.md | 7b252abf5a5d630c74c222c7984dfd436cef25ea5458963fd4822e847a65e05f |

`sha256sum -c ../source.sha256` from `after/` reports 6/6 OK before and after review. Every manifest beforeSha256 and after sha256/bytes matches the archived file bytes. An initial checksum invocation from the archive root could not locate the relative `apps/...` paths; it was corrected to `after/`. That invocation is a review command-path error, not a product test failure or change to the freeze.

| Frozen path | after SHA256 |
| --- | --- |
| apps/web/src/features/structure/ownership-session.ts | 580ce066f4fdb14c499f1d5eb9ce1a2e77cd3199f0871a3d98da60ed188da0f7 |
| apps/web/src/features/structure/ownership-session.test.ts | 2c45011de0ef9bfabab6d2be9e2db7007c98652d12462d52489ce922e3cd86a3 |
| apps/web/src/features/structure/ownership-controller.ts | 1070a70e5461d1c6995b1bd49ec8a16dbaead2ad487c1c984bc692f49fc5e7ef |
| apps/web/src/features/structure/OwnershipControls.tsx | 6991b82b35b7a9a88cb70897211df6da7e4997a097d724ee8bc899698c133014 |
| apps/web/src/app/workspace.ts | 63130c58c958c4e557feea65d0118018db49a8d04d3fd37e865b0e96e715fd39 |
| apps/web/src/app/workspace-ownership.test.ts | 2121f7f03d5af4fe3b23a92383c0df8d5d21d509c09fbf5c0efcfe17a7b46606 |

Only this local report is written. No VM2 source/docs/DB edits, tests, builds, stage, process operations or spawn.

## Important finding

### I1-new — browsing a tray omits the current epoch and rejects every valid response after normal project selection

Locations: `apps/web/src/features/structure/ownership-session.ts:318` (load input at 318–322), guard at `:143`, initial root-load input at `:302`; `ownership-controller.ts:31`; actual caller authority at `apps/web/src/app/workspace.ts:300`, `:312`, `:188`; UI browse callback at `OwnershipControls.tsx:64`.

R1 adds an epoch comparison to `requestCurrent`: `(request.epoch ?? 0) === (context.epoch ?? 0)`. The initial `setMode("ownership")` root request includes the epoch, but `browse(path)` still calls `tray.load` with only projectId, snapshotId and path. Thus every child-directory or parent navigation request has no epoch and is treated as epoch 0. Real `selectProject` increments `ownershipEpoch` before loading a project; `openProject` increments it and then invokes `selectProject`, and `capturePlan` exposes this nonzero authority to the session. This is not a malformed injected-context-only scenario.

Static, deterministic reproduction from the frozen actual path:

1. Open/select a project through the real workspace method, create/select a current eligible plan, enter ownership mode. Epoch is at least 1. Initial root scope request correctly carries that epoch and can publish ready.
2. Click a target folder's Browse button, or its parent control. `OwnershipControls` calls `app.ownership.browse(path)`.
3. The HTTP scope request can return perfectly matching project snapshot/path/kind. Nevertheless, the controller calls `isCurrent(request)`; missing request epoch becomes 0 and differs from the current nonzero epoch.
4. The controller retires the request and publishes `{status:"idle"}` instead of the current directory scope. `targetsReady()` is now false. Choose/confirm/fresh begin cannot use the tray; UI browsing and start controls are disabled by that predicate. Re-entering ownership mode can restore the root tray, but browsing fails again.

This prevents normal directory traversal, including valid deeper file destinations not present in the bounded root tray. The guard should remain strict: **propagate the captured current epoch into every `browse` load just as the root load does**, rather than relaxing `requestCurrent` or defaulting missing authority to the current value.

Necessary narrowly scoped tests: a session with explicit nonzero epoch enters mode, browses child then parent, and remains ready with the exact epoch on each request; valid choose/confirm still succeeds. Include an actual `createWorkspace.selectProject` or `openProject` fetch-double path, not only direct store initialization. Retain the existing late old-epoch response rejection/terminal intent/CAS tests. Author should demonstrate the new positive navigation case RED against frozen R1 and GREEN after repair, then freeze for targeted rereview and parent compiled/native-pointer gates.

Why 62 existing source tests do not cover it: `ownership-session.test.ts:14` fixture omits epoch (equivalent to 0); its late-request fixture starts at epoch 0 (`:325`). The actual verify/createPlan fixture directly initializes the workspace store (`workspace-ownership.test.ts:335`) rather than selecting/opening a project, so ownershipEpoch stays 0. Neither frozen test file invokes `browse` at all. Existing negative epoch rejection tests therefore pass while the legitimate nonzero-epoch positive path breaks.

No other Critical/Important/Minor findings in the limited repair scope.

## Original I1 and I2 disposition

- **Original I1, terminal expired intent: addressed in this source candidate.** `ownership-session.ts:177` refuses `expired` in `currentIntent`; `:208` increments generation when retiring and retains diagnostic input; `choose` and `confirm` call reconcile and enforce this predicate before saving (`:250`, `:391`). Selection/dirty/group return cycles cannot make the old nonce authoritative. Editing diagnostic filename does not change the expired status. Only explicit fresh `begin` captures new input/operations/nonce and advances generation (`:324`). Controls disable old choose/drop while expired (`OwnershipControls.tsx:58`). The original saving late-ACK attempt guard remains (`ownership-session.ts:427`). Test lines 233–259 retain source/target/filename, require no old save, reject old nonce, then test a fresh begin.
- **Original I2, idle tray source mismatch: addressed in the guard and retirement paths, subject to fixing the navigation regression above.** The new `observed` capture exists independently of intent (`ownership-session.ts:122`); reconcile compares project/plan/epoch even idle, and snapshot ID/hash changes cancel the tray (`:214`). Tray cancel advances controller generation, so retired pending replies cannot publish (`ownership-controller.ts:55`). `targetsReady` hard-checks request project/snapshot/epoch/budget and returned scope snapshot/path/folder against current authority (`ownership-session.ts:152`). Begin/choose/confirm enforce that same predicate, and confirm rechecks current target membership. No silent reliance on DOM disabled remains. New helper tests cover idle S0→S1 and direct request/scope mismatches; the workspace fetch-double test covers actual verify→summary/plan acceptance→fresh createPlan path. That test is still a source/fetch-double proof, not a production HTTP/browser proof.
- **Preserved save authority:** workspace capture now includes project epoch; pre-HTTP and ACK checks retain project/plan/revision/snapshot/hash (`workspace.ts:1263`, `:1311`). The repair does not change operations, server source writer semantics, historical approvals or graph facts. Plan-save and same-selection focus behavior are not replaced by the target-tray readiness guard. No conclusion about the entire first-window form or 21-file application integration is inferred from this six-file repair review.

## Raw evidence actually read

All below are the author's archived logs under candidate `evidence/`; the reviewer read but did not execute them.

| Evidence | Observed record | SHA256 |
| --- | --- | --- |
| atlas-fs01-ui-r1-session-red.log | 10 failed / 13 skipped helper cases against original bytes | 269f619f709467c48867af15205ac211446472a39d613ed09a32113692aae636 |
| atlas-fs01-ui-r1-workspace-red.log | 1 failed / 8 skipped actual workspace path with fetch transport double | 3670770dfc5321f53753c8ab1ee9a538e91e53bd9e8816ae2fc2513b00daaafb |
| atlas-fs01-ui-r1-green-final.log | 62 passed / 4 files: session27, workspace ownership9, existing workspace24, controller2 | 84c502e095d13709482240e6e4a35f9698ae5c1edcb5572353f165380be7cbe8 |
| atlas-fs01-ui-r1-owned-typecheck.log | source-alias listFiles; author records exit0, excludes unfrozen overview-layout | 1507e18a67fc05ac31d6b63f3baa9344abda5b0c9d2d0e861b89958e56b18cba |
| atlas-fs01-ui-r1-source-typecheck-final.log | six TS2540 readonly assignments in other-owner overview-layout.ts:447; author records exit2 | 94011e5b9376166530f50e35cef80af87727c66b4d11d277be26a592f9563472 |

Four additional pending-late-response cases have GREEN but no claimed baseline RED; that distinction remains. The earlier incorrect fixture-route setup error is retained and is not counted as a product RED. Lint logs are empty; exit0 is recorded by the author receipt, not independently executed here. Source-alias checks do not validate shared compiled exports or the ordinary whole-web build. The original compiled and broad-source failures remain evidence, not overwritten as PASS.

## Remaining gates and disposition

Repair I1-new with positive nonzero-epoch browsing source evidence and freeze/review the narrow change. Then the parent must obtain a stable isolated compiled build/typecheck and actual mouse/native HTML drag/page/HTTP cases, including valid folder browsing/parent return and deeper destination selection, plus project/snapshot retirement, source invariants, restart/owned cleanup and existing layout/funnel/map/GRP regressions. This review provides no compiled/browser/production-persistence PASS. FS-01 remains PARTIAL; the original review/report/RED and this new finding must be preserved.

Final verification: manifest/source list/patch/receipt/original review hashes unchanged; all six frozen after hashes OK and all six before/after manifest entries verified. No remote mutation was made.
