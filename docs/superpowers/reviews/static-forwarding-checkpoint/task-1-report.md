# Task1 — guarded static CommonJS forwarding

Status: implemented and locally verified candidate; **independent Task1 approval pending**. Base HEAD `18bfe5bd948f50ac7e0f35daf0be8163fa6412d4`, prior code `15d2c1656ed22f2afb3e6ff2eb3b3bbb7f4417be`, closed milestone `6c2fc16268ffd523fb40577ed9075dbb393531ec`. This report is implementer evidence/self-review, not independent approval or product-target acceptance. No helpers/reviewers were spawned.

## Scope and producer/consumer contract

Owned four files: `packages/indexer/src/commonjs.ts`, `commonjs.test.ts`, `index.test.ts`, `docs/superpowers/contracts.md`. The controller additionally owns/amended `docs/superpowers/plans/2026-10-03-static-forwarding.md` to resolve the historical-test conflict below and explicitly requested its inclusion in this coherent commit. No helper split was needed. No public fields, return shape, fifth mode hook, core/service/storage/server/UI, hash version, dependency, lockfile, vendored file or target checkout changed.

Read complete fresh task context/brief, global constraints, ledger preflight/ruling, formal spec/plan, current producer/consumer registry and relevant contracts; vendored Superpowers using/TDD/test-writing/debugging/verification guidance and current prior whole-fix report. SDD is controller-orchestrated; this worker remained sole writer of its assigned source. Inherited onboarding/runtime skill guidance was read. Current managed status reported running/current observations with network policy **unknown**, not network readiness. Existing Node24.19.0/npm11.9.0/Python3.12.14 satisfied the selected local test workflow; no install, network credential/configuration change, draft save, startup or restore validation was needed/claimed by this bounded coding task.

The original registry had no validated identity for a root `module.exports = require(...)`. Its namespace escape pass invalidated the target leaf while the forwarder itself had no callable export map. A real two-hop SourceIndexer capture therefore had an unexposed actual leaf and an unresolved call before implementation.

Implementation phases:

1. Existing export-write/lexical/mode guards collect an exact potential forward only for the initial root assignment, no canonical `exports = module.exports = ...` chain and no additional property assignments. Existing repeated/root/conditional-write checks still mark invalid sources. Static `module['exports']` remains equivalent.
2. Existing require validation and iterative require-SCC marking run unchanged. Derived bindings keep physical `module`, selected property and `cyclicInitialization`; no canonical reassignment erases that flag.
3. A narrow imported-root guard rejects unsupported root values recognized by the **existing** direct/const/import reference machinery. This prevents local property overlays on an unsupported imported namespace/callable from acquiring stale affirmative exports. It does not introduce alias/value-flow propagation or reject arbitrary unrelated root expressions. Existing local callable/static-object/canonical-function exports retain their original guards.
4. Iterative walks from each potential forward validate at most16 relative captured edges. Every source is noninvalid, each binding is valid/captured/noncyclic, the specifier is relative and the target is valid CJS. The terminal leaf must be noninvalid. Invalid, self/cyclic, SCC-uncertain or17-edge chains get no escape exemption. Rejections are applied only after every chain was checked so traversal order cannot affect proof.
5. Only the exact validated forward call (including its transparent expression wrappers) bypasses the existing namespace escape check. All other existing consumer writes/escapes are collected across all captured files. Empty-string literal writes are known-property writes, using `property !== undefined`, not a truthiness check that would poison the whole namespace.
6. Proven aliases and leaf share the union of rejected properties and module invalidity before exported IDs or calls are exposed. Canonical lookup is used only for the protected export map. Physical require/import evidence and actual implementation IDs/names/locations remain unchanged. No duplicate function nodes or wrapper identities are generated.

The chain walk is bounded by16 edges per forwarder, plus existing captured AST/require graph processing and a linear group union. No recursive loader traversal, target execution, name matching, real-filesystem compiler lookup or runtime order proof was added. A conservative rejected over-budget/invalid forwarder's ordinary escape can invalidate a shorter chain and its leaf; this coverage cost is documented.

## Authentic RED, self-review findings and controller ruling

Initial new tests ran before product mutation: the registry two-hop/leaf/default/ESM positives and actual SourceIndexer positive failed for unresolved calls or `exported:false`. New negative controls passed already; they are reported as controls, not fake RED. The first RED used an incorrect anonymous qualified-name expectation and CJS mutation fixture extension; these were corrected to the existing `<anonymous>` identity and `.cjs` before implementation and RED rerun. Both logs are preserved. The corrected run still failed the expected16 positive assertions, with25 controls passing.

Self-review then found two specific edge cases, each with authentic failing tests before its fix:

- Known `mod['']` mutation over-invalidated a different stable `safe` property. `property-red.log`:1 failed/2 controls passed. Changing the existing consumer guard to explicit `!== undefined` preserves known-property granularity while dynamic/nested selections retain their `reason` and still invalidate the module.
- Unsupported direct/const/let/var/property forwarding plus a local `module.exports.added = added` overlay could resolve the stale local `added` implementation even when another consumer mutated the shared target. `overlay-red.log`: all5 failed, each resolving `function:61de3c47804e7c96675d6eacf971c501` instead of null/unresolved. The narrow imported-root guard rejects these source identities before chain validation; it uses already-established bindings only. Controller acknowledged this in-unit repair and prohibited broader value-flow/identity expansion.

The first complete registry run (`registry-green.log`, despite its preliminary name) was **NOT GREEN**:173 passed/1 failed of174. The sole failure was the historical exact `module.exports = require('./forward.cjs')` row, which expected unknown even though the new spec explicitly supports that stable captured single-hop form. Controller recorded a ruling in the plan/ledger/brief: migrate only that row to a positive asserting the actual `forward.cjs` `help` declaration ID; preserve all other109 old expectations and every new unsupported/mutation/cycle/mode/escape control. That amendment was applied, with no production rollback or safety shortcut. Cost: changing an old negative could hide false resolution, so exact leaf-ID and independent safety controls remain mandatory. Final counts are174 registry cases (109 unchanged historical +1 migrated historical +64 new),54 public SourceIndexer cases (48 previous +6 new), and397 affected cases across8 files.

## Test coverage

All fixtures are authored bytes parsed/indexed, never executed. Existing110 cases are retained under the explicit single-row migration above, including all private require-cycle, callable rewriting, config/package/Python/const identity controls. New cases cover:

- Exact two-hop and migrated single-hop actual leaf identity/export flags; physical import target/line/text; no duplicate implementation node; forward source order reversal.
- Named callable, anonymous function, arrow, object, named `default`, and callable-default versus string-default distinction, including named-default mutation leaving callable identity stable.
-16-edge positive/17-edge negative, self/directed forwarding cycles, ordinary leaf-to-forwarder require back edge in both source orders, unrelated component and local recursion controls. A separate incoming-cycle case proves physical binding's cycle flag survives successful canonical lookup to an acyclic leaf, while that actual leaf remains exported.
- Known-property writes through root/middle/leaf/sibling aliases and ESM default/namespace-default consumers; sibling and leaf consumers in opposite source orders; leaf's own rewrite of one property retaining a different stable property; empty-string property case.
- Computed writes/namespace escape across aliases and leaf with ESM consumers; invalid/chained/conditional/repeated forwarders receiving no escape exemption; unsupported local export overlays.
- Unsupported const/let/var/property/dynamic/external/configured-nonrelative forwarding, global/lexical rewrites, extra root/property writes, explicit ESM/source-mode rejection, missing captured leaf.
- Real SourceIndexer ordinary `.js` valid commonjs package scope positive and opaque ignored nearest manifest, ignored/excluded leaf, ESM package mode and invalid manifest negatives. Ignored sentinel content is never exposed.
- Full affected indexer/core includes capture/resolution/config/package budgets/modes/Python and core checks, not merely the forwarding test file.

## Actual same-byte preimplementation/postimplementation comparison

Diagnostic script: `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/baseline.ts`. It imports the actual source `packages/indexer/src/index.ts` through existing `tsx` and calls `new SourceIndexer().index(root, 'forwarding-samebytes')`. It does not load/execute fixture modules. `before` created four fixture files once; `after` reads the same retained files without rewriting them. Both full real returned snapshots were preserved independently as `before.json`/`after.json`; tests do not depend on these ignored records. This is not an old-binary reconstruction or stored-approval simulation.

- Before capture:2026-10-03T07:40:17.133Z, before analyzer mutation, committed source HEAD18bfe5bd948f50ac7e0f35daf0be8163fa6412d4.
- After capture:2026-10-03T07:50:54.234Z, final analyzer bytes (later test migration/docs only did not change analyzer).
- Commands: `node --import tsx .superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/baseline.ts before` and the identical command with `after`; both exit0, stdout retained in before.log/after.log.
- Old analyzer SHA256: `986d731b48be3090ed8e865168a565e2f117ab06f08180ff71d7edd6eb4d114a` (committed baseline source also used by actual before invocation).
- New analyzer SHA256: `6c71b28b750926b8492c50e9e10dea3e5e04867c9a41d6d9599f40ec450f8778`.
- Same v3 contentHash: `8ac99f75be03b8420dc25628a767fd50b8d45179a0ad67c470346c1c2b110477`.
- Old snapshot ID: `snapshot:f4a5d38e0914cecb3af34f4ef6b3d76d`.
- New snapshot ID: `snapshot:020d2df8055846ca8caf35400dc2f0c5`.
- Same actual `leaf.cjs:1` `help` ID: `function:9adf3b0c79cc88621e1af01aa2926a81`; exported false→true.
- Same caller ID: `function:6d8d915ceaa61ce3cec83912b757327e`.
- Call at `entry.cjs:2`, `mod.help()`: null/unresolved with reason `CommonJS export help has no unique stable captured implementation` → resolved to the actual leaf ID.
- Call relation ID changes appropriately from `relation:d2ff884fd629ac66e23fe6f3f1174803` to `relation:3e1431810ffe7b6bf2354451fa37b21f` with new target facts.
- All function declaration IDs/paths/qualified names/lines and all physical import relations compare exactly equal. Existing facts fingerprint, not an input-hash version change, owns the snapshot difference.

Per-file SHA256, equal before/after:

| Captured file | SHA256 |
| --- | --- |
| entry.cjs | `0c0dff91d75fb247be80cccfe7ae1b530913490dccfdb16e762e1eaf58bf4ee7` |
| barrel.cjs | `17811429929898fc8ffd96c54b655185e0a41c4c5d50b70010afd50bfd0b4b05` |
| middle.cjs | `c8e815305db36b2eb449212cd29c2c418fd5dd3cff944a09d14b677e8f11c1fd` |
| leaf.cjs | `7d56ecd811ab1a3d7df29d7fe2ec30886a9d1a4929002a3a204eba0176990899` |

Comparison receipt `samebytes-comparison.json` at07:51:54.480737Z includes assertions, source provenance and complete values. SHA256 of actual before.json `79f9263cc00228a5f37684fa7880076a1ec7c4b510332f8bf7ebf8e16cbe7530`; after.json `f8cdcc8b1ac21db02148dc866354fba29867cac6eb8ed0dd7a79150c94aafd55`. Same-byte facts/identity evidence is complete for Task1; actual transport plan/route/approval/history behavior belongs to Task2 and was not simulated here.

## Exact verification record

All logs below are under `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/`. Commands executed from `/workspace/AtlasMode`; times UTC. Early rows report runner wall durations (shell command timing was not separately recorded); final rows have exact command receipts in `checks.json`, generated by the retained `run-checks.py`, which preserves child exit codes and stops on failure.

| Command | Start / result / duration | Raw log |
| --- | --- | --- |
| `npx vitest run packages/indexer/src/commonjs.test.ts packages/indexer/src/index.test.ts -t 'forwarding'` initial RED |07:42:15; exit1;16 failed/25 passed/158 unselected;1.01s runner |red.log |
| Same corrected RED command |07:42:41; exit1;16 failed/25 passed/158 unselected;921ms runner |red-corrected.log |
| Same focused command after initial implementation |07:43:44; exit0;41 passed/158 unselected;853ms runner |green-focused-1.log |
| Same focused command after expanded adversarial controls |07:46:00; exit0;62 passed/158 unselected;1.03s runner |green-focused-2.log |
| `npx vitest run packages/indexer/src/commonjs.test.ts -t 'empty-string\|named-default property\|configured nonrelative'` (the shell regex string uses literal `|`, without the table escape backslashes) |07:47:14; exit1;1 failed/2 passed/166 unselected;640ms runner |property-red.log |
| `npx vitest run packages/indexer/src/commonjs.test.ts -t 'stale local export overlays'` |07:49:25; exit1;5 failed/169 unselected;642ms runner |overlay-red.log |
| `npx vitest run packages/indexer/src/commonjs.test.ts` first complete registry |07:50:09; exit1;173 passed/1 historical-spec conflict;1.27s runner |registry-green.log (failure preserved) |
| `npx vitest run packages/indexer/src packages/core/src` final amended affected suite |07:52:42.016235; exit0;**397/397,8 files**, no skipped/failed;4.04s runner/4.522s command |affected.log |
| `npm run build --workspace @codemap/core --workspace @codemap/indexer` |07:52:46.538357; exit0;both packages;2.542s command |build.log |
| `npm run typecheck --workspace @codemap/core --workspace @codemap/indexer` |07:52:49.081000; exit0;both packages;2.134s command |typecheck.log |
| `npm run lint` |07:52:51.214871; exit0, no diagnostics;1.781s command |lint.log |

Formatting before covering checks: `npx prettier --write packages/indexer/src/commonjs.ts packages/indexer/src/commonjs.test.ts packages/indexer/src/index.test.ts`; then `npx prettier --write packages/indexer/src/commonjs.ts packages/indexer/src/commonjs.test.ts` after narrow guards; finally `npx prettier --write packages/indexer/src/commonjs.test.ts` after controller-authorized historical migration. All exit0, format.log/format-final.log/format-migration.log retained. `git diff --check` exit0. Documentation-only line wrap after checks changes no tested source. No passing broad suite was repeated for confidence.

## Preservation, limitations and self-review

`preserved.json` fingerprints203 preexisting artifact/review records; `verification.json` at07:54:55.076465Z confirms all203 unchanged and records SHA256 of all five final changed files. Final source/tests were not amended after covering checks. Own four-byte fixtures and full snapshots/logs remain in ignored Task1 scratch as review provenance. Public tests remove only their own temporary directories through existing cleanup. This task launched no persistent server/SDK/browser process, touched no user database and performed no broad cleanup. Historical records/screenshots/target artifacts remain unchanged; no original failure was deleted or reclassified.

Self-reviewed the full source/test/docs diff against producer/consumer ordering and bounds: no canonical replacement of Binding.module; cycle flag precedes classification; invalid imported roots are rejected before alias proof; rejected forward chains receive no exemption; all consumer facts finish before group union and exposure; known-property rejection preserves unrelated exports; callable Symbol/string-default separation is retained; terminal maps contain actual implementation IDs; imports are never canonicalized. Tests that remove these controls would fail actual-target/unknown/export-flag assertions, not mock interactions or source-text checks. Only the required historical single-hop expectation changed; all other109 historical expectations are untouched. No optional private helper or abstraction was created.

Accepted static limits: only exact single relative captured forwarding, maximum16 edges, conservative shared rejection, existing source/package/config/root/ignore bounds, no loader/runtime timing/general value-flow proof. An unsupported or over-budget alias can reduce leaf/other-alias coverage. Static resolved is not runtime/build compatibility.

Explicitly UNRUN here: full root suite, seven-workspace build/typecheck, new HTTP/SDK/SQLite lifecycle, browser/source/copy/host checks, strict full pinned Express acceptance, Vite/Flask, installs/native Windows/macOS, actual Codex/Claude clients, remote CI, fresh environment restore and publication. Task2 owns the new public/strict Express gates; unit facts do **not** establish them. Original Express entry FAIL and older generic browse PASS remain historical. Original shutdown causal gap (Important WR-I2) and host warning (Minor WR-M1) are **not addressed**; no lifecycle retry, speculative causal attribution, warning suppression or prior-suite replay occurred.

Local candidate commit: **d0cab481dbc64756c04c2a16a8b9ac661cdbc776** — `feat(indexer): resolve guarded static CommonJS forwarding`. All five committed file hashes match the verified final bytes; tracked working tree clean immediately afterward (`scratch/task-1/commit.json`). Parent owns the fresh independent Task1 gate before Task2.

## Independent gate I1 — fix round 1/5

The fresh Task1 gate at `task-1-review.md` found one Important issue and returned **Needs fixes**: a forwarder's original local `exports` object was incorrectly canonicalized to its replaced `module.exports` leaf. Its pure captured-AST probe resolved both `exports.help()` and `module.exports.help()` to the same leaf, despite the first object being detached. The initial candidate above was therefore **not approved**. This round addresses only I1, with parent-owned scoped re-review still pending; the original review/probe and every earlier log/comparison remain preserved.

Read the full finding, exact recorded fixture/probe/results and the surrounding reference/classification pipeline. Added9 focused cases before implementation: dot/literal local `exports` calls must stay unknown while supported `module.exports.help()` and an external consumer resolve to the exact leaf ID; selected const, literal selection, second const, destructuring/computed destructuring and namespace-const destructuring cannot recover the detached leaf through checker fallback. Existing parenthesized bare-namespace handling remains a conservative escape rejection rather than gaining new support.

Initial RED had3 failures/6 controls passing: two actual false leaf resolutions, plus a too-strong expectation that an already-rejected parenthesized bare namespace should retain the positive external call. Before product mutation, corrected that third case to preserve the existing escape guard, then reran RED: **2 failed/7 passed**, both failures falsely targeting `function:563953d26ba37b022c679175a28f413d` instead of null/unresolved. The selected/derived/destructured cases already stayed unknown and are honestly recorded as regression controls, not claimed new REDs.

Repair is10 lines in `commonjs.ts`'s existing local export-reference classification: a reference rooted at local `exports` in a forwarding candidate returns a handled detached-identity reason. `classify` stops at that reason before canonical lookup/checker fallback. References rooted at `module.exports` remain distinct, and physical Binding.module, imported cycle flags, canonical leaf IDs, group mutation union and16-edge proof are unchanged. Existing selector spreading preserves the rejection for nested selections; unsupported const/destructured aliases retain their existing unknown behavior without new value-flow machinery. The contract now explicitly describes detached local `exports`. No core/provider/public shape/hash change, helper, broader alias support or source takeover occurred.

The controller's **already-existing documentation-only** Task2 offline-helper ownership amendment is included in this fix commit as instructed. It adds future shared-helper relocation ownership to the formal plan; no Task2 harness, browser, validator or product implementation was performed here.

All round1 logs/command receipts live in `scratch/task-1/r1/`; full old records stay at their original paths. Exact commands from `/workspace/AtlasMode`, UTC:

| Command | Outcome / timing | Log |
| --- | --- | --- |
| `npx vitest run packages/indexer/src/commonjs.test.ts -t 'detached'` initial RED |08:10:50; exit1;3 failed/6 passed/174 unselected;637ms runner |red.log |
| Same command, corrected RED before product repair |08:11:35; exit1;2 failed/7 passed/174 unselected;606ms runner |red-corrected.log |
| Same command after repair |08:11:53; exit0;9 passed/174 unselected;656ms runner |green.log |
| `npx vitest run packages/indexer/src packages/core/src` |08:12:44.285943; exit0;**406/406,8 files**, no failed/skipped;3.36s runner/3.830s command |affected.log |
| `npm run build --workspace @codemap/core --workspace @codemap/indexer` |08:12:48.116753; exit0;both packages;2.435s command |build.log |
| `npm run typecheck --workspace @codemap/core --workspace @codemap/indexer` |08:12:50.551853; exit0;both packages;2.154s command |typecheck.log |
| `npm run lint` |08:12:52.706116; exit0, no diagnostics;1.840s command |lint.log |

`npx prettier --write packages/indexer/src/commonjs.ts packages/indexer/src/commonjs.test.ts` exited0 before GREEN and covering checks (`format.log`). `git diff --check` exited0. Final registry count183 =174 prior cases +9 focused identity cases; public SourceIndexer54 and all other affected cases retained. No covered source/test amendment followed these checks. The repeated affected/build/type/lint checks are justified by the actual analyzer change; no root/public/browser/mature target/lifecycle replay was run.

One necessary post-fix source comparison used the retained actual fixture/project/bytes: `node --import tsx .superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/baseline.ts after-r1` exited0. It writes only new `after-r1.json`/`after-r1.log` output names and does **not** rewrite the fixture files. The baseline script, genuine `before.json`, original `after.json` and original comparison receipt remain unchanged. New `samebytes-comparison-r1.json` records the final analyzer SHA256 **`df04e94dd8bdd66241212f28527f3d72a7f66ac6742a8b21742cdfc82f02e7b4`**, capture **2026-10-03T08:13:43.405Z**, comparison08:13:43.444217Z, and post-fix JSON SHA256 `41141ad2b547a9feb78cb81457be12ba9b3af056a645643532c8382858474955`.

Final-source same-byte results: project `forwarding-samebytes`; v3 contentHash **`8ac99f75be03b8420dc25628a767fd50b8d45179a0ad67c470346c1c2b110477`** unchanged; original snapshot **`snapshot:f4a5d38e0914cecb3af34f4ef6b3d76d`** → final **`snapshot:020d2df8055846ca8caf35400dc2f0c5`**; actual leaf ID **`function:9adf3b0c79cc88621e1af01aa2926a81`** unchanged, exported false→true and actual leaf call null/unresolved→resolved. All4 individual captured file hashes, all function IDs/locations and physical imports match the genuine before capture. The final snapshot equals the earlier positive postimplementation snapshot because this retained fixture contains no detached local-exports read; that equality is expected, while final-source provenance is newly captured rather than relabeling the old analyzer hash. The new9 regression cases separately cover I1's changed facts.

`r1/verification.json` records final hashes for the4 changed files and verifies all203 previous artifact/review files plus original before/after snapshots unchanged. No persistent process was started or user data cleaned. Self-review checked the reason before canonical/checker resolution, preserved module-vs-local-export distinction, unchanged physical binding/cycle data, exact leaf-positive controls, and retention of unsupported const/destructured/parenthesized namespace behavior. All109 original unchanged expectations, the controller-migrated single-hop case and all prior forwarding mutation/depth/cycle/mode tests pass. No new issue was identified by this self-review; independent scoped re-review remains required.

Verdict for I1: **addressed by candidate, not self-approved**. Prior shutdown causal gap Important WR-I2 and host warning Minor WR-M1 remain NOT ADDRESSED. Task2 public/strict-Express gates and all previously stated UNRUN limits remain unchanged. Round1 local commit **1346a8f70ff3fdc7afb852e02bd3954c40491ad1** — `fix(indexer): guard detached exports in forwarding modules`; all4 committed file hashes match final verified bytes and tracked tree is clean (`r1/commit.json`). Source/HEAD are frozen for the independent scoped gate.
