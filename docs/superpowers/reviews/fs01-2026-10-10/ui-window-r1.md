# FS-01 second UI window R1 author repair receipt

Status: **source repair frozen, independent rereview pending; FS-01 remains PARTIAL**. This receipt covers only I1/I2 from the original independent source review. It does not claim production browser acceptance.

## Preserved baseline and exact review scope

The original 21-file freeze remains unchanged at `/tmp/atlas-fs01-ui-freeze-20261010-1751`. Before repair, the complete archive and raw review were copied to `/tmp/atlas-fs01-ui-r1-baseline-20261010-1800`; the additional original controller bytes are in its `additional-before` directory. Raw review SHA256: `d0510e5d873b1afb20765dc437e609fb2ee9643ab48993e4ff6bcc654f60fb3f`.

Formal R1 freeze: `/tmp/atlas-fs01-ui-r1-freeze-20261010-1828`. It contains complete `before/` and `after/` bytes, six-path manifest, source hashes, exact narrow patch, raw review, raw RED tests, and evidence/configuration files.

- manifest.json: `f6d0951d23b7df837bf473ee632f26ebb84fe32006eea2080eb6eb178bd2bf37`
- source.sha256: `36c73a7f6ef558356d89b5e95dbb3af67f9458255e700288b821087035522068`
- owned.patch: `6a5828232ea05eaf5ad91168d8b50179b2b1e14abab6f1a19102405860afb4fd`
- receipt.json: `b75619ab2293bd569970af1399c1a74b9951c2c0be6961fc30e86749073ef9c4`

Changed paths:

1. `apps/web/src/features/structure/ownership-session.ts`
2. `apps/web/src/features/structure/ownership-session.test.ts`
3. `apps/web/src/features/structure/ownership-controller.ts`
4. `apps/web/src/features/structure/OwnershipControls.tsx`
5. `apps/web/src/app/workspace.ts`
6. `apps/web/src/app/workspace-ownership.test.ts`

The earlier `/tmp/atlas-fs01-ui-r1-freeze-20261010-1823` is preserved as an intermediate snapshot with a now-corrected inferred parameter type error; it is not the review candidate.

## I1 / I2 repair

Expired previews are terminal. Selection/dirty/group A→B→A cannot make an old nonce current again, and choosing another target cannot revive it. Only an explicit fresh begin can create a new preview nonce. Filename/source/target diagnostic state remains visible on expiration.

The session records project, plan, snapshot identity/hash, and workspace epoch even with no intent. Project/epoch changes cancel the tray; snapshot changes retire its request and any preview. Pending old requests cannot publish after retirement. Begin, choose, and confirm require a ready tray whose request project/snapshot/epoch and returned scope snapshot/path/kind agree with the current capture. Current target membership is checked again before save. UI controls use the same readiness predicate.

## Reproducible evidence

Evidence filenames below are relative to the freeze's `evidence/` directory; a durable copy is in `ui-window-r1-source-evidence/` beside this receipt.

- `atlas-fs01-ui-r1-session-red.log`: original product bytes plus the archived RED tests produced **10 failed / 13 skipped**. Failures cover non-saving selection/dirty/group return cycles, idle S0 tray after S1 verification/new plan, and request/scope proof mismatches.
- `atlas-fs01-ui-r1-workspace-red.log`: **1 failed / 8 skipped**, actual `createWorkspace` → `api.verify` → summary/plan acceptance → `api.createPlan` source path retained an S0 ready tray under S1. This uses a fetch transport double, not a production HTTP server.
- `atlas-fs01-ui-r1-workspace-setup-error.log` preserves the earlier incorrect fixture route (GET instead of the actual POST scope route); that setup failure is not counted as a product RED.
- `atlas-fs01-ui-r1-green-final.log`: **62/62 PASS across four files** (27 session, 9 workspace ownership, 24 existing workspace, 2 existing controller). Four additional late pending-tray cases passed; no pre-fix RED is claimed for those four.
- `atlas-fs01-ui-r1-lint-final.log`: all six changed files, exit 0.
- `atlas-fs01-ui-r1-owned-typecheck.log`: owned source-alias NoEmit, exit 0, includes the actual transitive dependencies; `--listFiles` proves the unrelated unfrozen PERF `overview-layout.ts` was not imported.
- `atlas-fs01-ui-r1-source-typecheck-final.log`: broad source-alias NoEmit exit 2, only six readonly assignment errors in the other owner's currently unfrozen `overview-layout.ts:447`. That file was not modified here. No whole-web typecheck PASS is claimed.

The exact broad and scoped source-alias configurations are archived. The scoped configuration includes the four changed product entry points and their transitive dependencies; it does not change package exports or shared dist.

GREEN command:
```sh
npx vitest run apps/web/src/features/structure/ownership-session.test.ts apps/web/src/features/structure/ownership-controller.test.ts apps/web/src/app/workspace-ownership.test.ts apps/web/src/app/workspace.test.ts
npx eslint apps/web/src/features/structure/ownership-session.ts apps/web/src/features/structure/ownership-session.test.ts apps/web/src/features/structure/ownership-controller.ts apps/web/src/features/structure/OwnershipControls.tsx apps/web/src/app/workspace.ts apps/web/src/app/workspace-ownership.test.ts
npx tsc -p /tmp/atlas-fs01-ui-r1-owned-tsconfig.json --noEmit --listFiles
```

To reproduce RED in a separate disposable source checkout, overlay the freeze's `before/` product bytes and the two corresponding `red-source/` test files at their repo paths. Run the session test with test-name regex `non-saving|idle S0|choose and confirm` (10 cases), and workspace ownership test with `actual verify then createPlan` (1 case). Do not overlay the current shared checkout. The final test bytes include the additional four late-response cases and formatting, so the archived original RED test bytes are retained separately.

## Remaining gates and cleanup

Independent limited high rereview is pending. The original six production browser cases are unchanged; two additional real page/HTTP/native pointer regressions are pending a separate parent followup. No compiled browser test was run in this repair phase, and source fixtures do not satisfy that gate. The parent will coordinate a stable isolated compiled snapshot and whole-app browser execution.

No server, fixture process, or tunnel was started in this repair phase. All owned SSH/scp/test/typecheck invocations exited. No shared build/dist, real user database, target source execution/move/write, stage, commit, or paid provider request occurred.
