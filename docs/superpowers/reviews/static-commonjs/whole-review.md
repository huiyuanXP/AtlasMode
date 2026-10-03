# Static CommonJS whole-plan independent review

**Range:** `ec1e37515328d58f7249ec8320d76919136bb279..5badf244571699b7b584dbc8c8bf04f1655fa9c3`.

**Result:** With fixes. **0 Critical; 2 Important (one new blocking correctness issue, one existing parked historical evidence gap); 2 Minor (one existing host warning, one current-status documentation issue).** Task1's original duplicate-declaration finding and Task3's duplicated routing finding remain addressed. No clean Task3 approval or original-shutdown-cause claim is granted.

## Strengths

- The new registry collects export writes and captured consumer mutations before classifying calls. Lexical identity and module mode precede require-literal lookup, and handled unknowns cannot fall through to the checker (`packages/indexer/src/commonjs.ts:463`, `:639`; `packages/indexer/src/typescript.ts:305`). The property/module rejection distinction, callable-default separation, and duplicate executable-declaration fix are backed by substantive negative and positive controls.
- Package capture reuses a single confined metadata reader while keeping category budgets independent (`packages/indexer/src/metadataRead.ts:15`, `:24`). Its extracted path checks, NOFOLLOW open, opened-file identity checks, bounded reads and finally-close preserve the prior configuration reader's relevant safety. Tests exercise exact file/total/count boundaries, growth after stat, both category orders, byte reuse, ignored/linked/unreadable inputs and opaque nearest scopes.
- The producer/consumer seams are narrow: an internal mode provider, separately captured manifests and one optional coverage field. The v3 framed hash incorporates actual package bytes, while the existing AST declaration IDs and immutable snapshot/history model remain intact (`packages/indexer/src/index.ts:23`; `packages/indexer/src/scan.ts:292`; `packages/core/src/validation.ts:152`). Strict/opaque nearest scopes do not silently fall back to ancestors.
- Navigation makes omitted historical coverage distinguishable from recorded zero in both languages, preserving source text and relative paths (`apps/web/src/app/Navigation.tsx:182`). The actual compiled HTTP/SDK/SQLite test verifies package-only staleness, stable declarations and immutable approval/history; the browser tests exercise real source/unknown browsing and an actual missing-region RED rather than fabricated metadata responses (`tests/integration/commonjs-resolution.test.ts:13`; `tests/e2e/commonjs.spec.ts:26`).
- The shutdown repair addresses a demonstrated class with a focused preservation test: complete accepted work remains live for 6.1 seconds while a second partial request shares its connection, then delivers HTTP200 and survives reopening SQLite (`apps/server/src/server.ts:35`; `tests/integration/server-shutdown.test.ts:73`). It does not add a shorter application-work timeout or a blanket force-close policy. The newly demonstrated class and the original unexplained failure are accurately separated in the retained reports.
- Express evidence is unusually explicit about its limits: the full pinned target has generic HTTP/browser/SDK browsing evidence, while the original canonical-entry requirement remains FAIL. The pre-review amendment preserves the full target and records the manual-search cost; it does not substitute the smaller diagnostic copy for acceptance (`docs/superpowers/validation-targets.md:133`; `artifacts/validation/express-commonjs-product.json:683`).

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

**WR-I1 — Cyclic CommonJS initialization is accepted as a stable destructured binding. New; blocks approval.**

- **Location:** `packages/indexer/src/commonjs.ts:481`, `:551`, `:697`. Requirement: `docs/superpowers/specs/2026-10-03-static-commonjs-design.md:48` explicitly requires uncertain cycles to reject affirmative mappings.
- **Problem:** `requireBinding` accepts the captured module; the binding pass treats its const-destructured property as stable; `classify` then uses the module's final export map without checking a captured require cycle. Const prevents later reassignment of the consumer binding, but does not prove that the exported property existed when Node initialized that binding.
- **Concrete input:**

  ```js
  // a.cjs
  const { b } = require('./b.cjs');
  function a() { return b(); }
  exports.a = a;

  // b.cjs
  const { a } = require('./a.cjs');
  function b() { return a(); }
  exports.b = b;
  ```

  The single permitted pure captured-AST probe returned **both calls resolved**: `a.cjs:2 b()` targets function `b`, and `b.cjs:2 a()` targets function `a`. Both functions are marked exported. These are observed analyzer results; no fixture code was executed. Under ordinary CommonJS initialization, whichever module is entered first has not assigned its export when the other destructures the initial empty object. That destructured binding remains undefined. Thus both positive call identities cannot be justified independently of load order.
- **Effect:** A user planning reuse across a cyclic Node module graph receives an affirmative edge to an implementation the captured binding may never contain. This is the same false-certainty problem the plan is intended to fix, not a request for runtime compatibility, recursive forwarding or general value-flow support. The current 92 registry cases contain no cyclic-require negative control.
- **Remedy:** Collect the bounded captured require dependency relationships and reject bindings whose initialization is uncertain within a cycle before the checker fallback. A conservative cycle rejection is sufficient; do not execute loaders or build a general evaluator. Cover the two-module reproducer, a self-cycle or equivalent boundary, and an acyclic positive control; ensure the rejection also applies to direct/property selections affected by the same uncertainty and cannot be bypassed through a guarded consumer. Ordinary recursive function calls are a different case and should retain their existing behavior. Export flags need not be indiscriminately removed when only an importer binding is unproved.

**WR-I2 — Original required shutdown failure still lacks causal evidence. Existing Task3-I1; Important, parked at the five-round cap.**

- **Location:** `tests/e2e/planning.spec.mjs:522`; `.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-3/ui-planning-green.log:19`; `task-3-rereview-round-4.md:1`; `task-3-rereview-round-5.md:1`; `progress.md:100`.
- **Problem:** The original actual API child exceeded the unchanged ten-second stop bound and exited by SIGKILL. Original IPC receipt, connection state and stalled shutdown phase were not recorded. The later incomplete-connection RED/repair/GREEN establishes that class, but does not identify the original failed attempt's cause. Both scoped reviewers correctly retain the original finding as NOT ADDRESSED; the controller's cap ruling is a disposition, not a repair.
- **Effect:** A different rare shutdown path may still recur. The original attempt did not establish graceful persistence/restart. No current data loss, Navigation regression or additional deterministic unfixed lifecycle defect is demonstrated by these records.
- **Independent disposition:** I accept stopping the task loop and retaining this real Important limitation at the prescribed cap. Current source and the inspected preservation regression support the targeted repair, and the repaired final suite plus sequential planning run supply current evidence. The unavailable historical observation cannot be recovered by another speculative patch or passing retry. This disposition **does not itself block merging the bounded change once WR-I1 is fixed**, but it forbids an unqualified clean lifecycle/Task3-approval claim. It does not downgrade the finding or erase either reviewer's position.
- **Remedy/owner:** Preserve the original failure, all five verdicts, supported class repair, current receipts and explicit recurrence risk in the archived handoff. A new concrete recurrence should open a separately bounded, instrumented shutdown investigation. Native user signals/platforms remain unverified. No sixth speculative shutdown loop is recommended or authorized here.

### Minor (Nice to Have)

**WR-M1 — Host Playwright warning remains. Existing Task3-M1; nonblocking.**

- **Location:** `.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-3/fix-round-4/planning.log:4` and original `scratch/task-3/ui-planning-green.log:4`.
- **Problem/effect:** The raw output still reports that FORCE_COLOR overrides NO_COLOR. This is noisy host/runner output, not a demonstrated product or SDK failure, and it can obscure later warnings.
- **Remedy:** Retain the raw warning and the non-pristine-output limitation. Address only through a supported host/runner configuration when available; do not remove NO_COLOR, filter the evidence or patch dependencies to manufacture clean output. No repeat browser run is needed merely to restate this known warning.

**WR-M2 — The linked environment page still labels the pre-repair result as current/final. New; documentation correction.**

- **Location:** `docs/environment.md:3`, `:15`, `:25`; contrast with the current repair/cap status in `docs/superpowers/readme-coverage.md:136` and `docs/superpowers/state.md:243`.
- **Problem:** The README's environment link leads to a page whose lead says current/final 436 tests in 29 files and describes the initial failure plus unchanged retry. Its unqualified statement that the service exit implementation was not changed is now stale: `140a3aa` changed `server.ts`, and the final repaired recorded gate is 440/30 followed by a sequential planning pass. There is no current-repair update on this page.
- **Effect:** A reader following the main verification link gets an obsolete description of the delivered code and cannot distinguish the initial gate from the current repaired gate without finding a separate chronological state document. This understates the repair and blurs historical versus current verification.
- **Remedy:** Add a concise current status at the top: repaired class, 440/30 plus seven-workspace checks and sequential planning result, original cause still unknown/Important parked at cap, and whole-review status. Explicitly label the 436/29 and unchanged-retry section as historical initial Task3 evidence; preserve its numbers and raw failure. Update any final whole-review result only after the scoped gate actually occurs. Documentation alone needs no execution rerun.

## Verification evidence and review method

Read the complete reviewer template and whole-review dispatch context, formal design/plan, binding constraints, README, three task briefs/reports/original reviews, Task1 resolution, Task3 rounds4/5, ledger rulings and all 44 routed task dispositions. The one supplied 229148-byte/4846-line netdiff covers 34 files. It was inspected in bounded passes; early combined displays elided some text, so only the missing server/document excerpts were recovered. The new formal spec/plan were also available in their already-read complete documents. No replacement diff, broad repository crawl, changed-source audit repeat or helper reviewer was used. A line-only locator supplied precise references. No unchanged consumer needed an additional source read.

Read the inherited onboarding/runtime skills and repository workflow instructions; this review makes no environment-configuration or new network/credential readiness claim. The explicit review assignment bounds environment work. No install, service/browser/SDK/target start, suite rerun, hash regeneration, screenshot replay, Git/index/HEAD/branch mutation, push or publication occurred. The only authored artifact is this ignored review report.

Recorded evidence inspected directly:

- `scratch/task-3/ui-red.log`: three actual missing-package-region failures; `ui-planning-green.log`: all three new CommonJS UI cases pass, while the required planning shutdown genuinely fails. `backend-baseline-green.log` records the new compiled HTTP/SDK lifecycle baseline passing; the earlier null/undefined harness error is not product RED.
- `scratch/task-3/fix-round-4/connection-red.log`: raw, partial-header and partial-body connections each reach actual SIGKILL at roughly 10008–10014ms after the installed-handler path. `lifecycle-green.log`: 17 tests in two files pass after the repair. The later cleanup-deadline test delta is covered by the final root run.
- `scratch/task-3/fix-round-4/root-{build,typecheck,lint,test}.log`: seven workspace build/typecheck commands, root lint without diagnostics, **440 tests/30 files passed**, start **06:04:27 UTC**, duration **30.24s**. `planning.log`: subsequent **one planning case passes in 11.1s, total 12.0s**, with the host warning retained. The report records its sequential launch at **06:05:17.367Z**. These are inspected execution records, not reviewer reruns; exit-zero statuses are also reported by the implementer.
- `verification-preservation-cleanup.json`: 128 recorded source/test/script/config entries with no mismatches, 91 matching artifact backups, exactly seven expected planning artifact changes, viewed-screenshot hashes, no remaining owned temporary directories or server/MCP processes, and original cause explicitly unproven. This receipt does not rewrite the earlier 114-entry manifest or make SDK `pid === null` a historical OS-reaping proof.
- `express-product.log`, `express-acceptance-ruling.json` and bounded original target JSON excerpts: full pinned SHA clean before/after as recorded; 142 source files, 3070 function/class nodes, 15216 relations, calls304 resolved/22 external/11234 unresolved, 1844ms open, no recorded browser errors/external requests. `createApplication` actually starts at line36 and is `exported:false`. Generic browsing PASS remains separate from original automatic-entry FAIL.
- Task1's independent fix verdict retains 253/6 affected checks after the duplicate-declaration repair. Task2's independent review retains 309/8 and its capture/syntax controls. Initial Task3 436/29 and older 200/220/293 results remain historical. The current 440/30 gate does not cover any future fix to WR-I1; its changed bytes require appropriate new covering evidence.

**One named focused probe: cyclic destructured require initialization.** Executed once with the already-built indexer/Graph and in-memory authored strings, exit0. It does not import or evaluate the fixture modules, start transports, read target dependencies or alter files:

```bash
node --input-type=module <<'NODE'
import { indexTypeScript } from './packages/indexer/dist/typescript.js';
import { Graph } from './packages/indexer/dist/graph.js';
const graph = new Graph('whole-cycle-probe');
const files = {
  'a.cjs': "const { b } = require('./b.cjs');\nfunction a() { return b(); }\nexports.a = a;\n",
  'b.cjs': "const { a } = require('./a.cjs');\nfunction b() { return a(); }\nexports.b = b;\n"
};
indexTypeScript(Object.entries(files).map(([path, text]) => ({path, bytes: Buffer.from(text)})), graph);
console.log(JSON.stringify({
  calls: graph.relations.filter(r => r.type === 'calls' && ['a()', 'b()'].includes(r.evidence.text)),
  nodes: [...graph.nodes.values()].filter(n => n.kind === 'function').map(({id,name,filePath,exported}) => ({id,name,filePath,exported}))
}, null, 2));
NODE
```

Observed `b.cjs:2 a()` → `resolved`, target `function:54090a7bc2150234783c8e758480db26` (a); `a.cjs:2 b()` → `resolved`, target `function:ef09e526803e468cfbb04ac765736456` (b). Both corresponding nodes have `exported:true`. The new finding follows from these results and the inspected missing cycle guard, not from assumed runtime execution.

## Recommendations

1. Use the prescribed **one combined fix wave** for WR-I1 and the small WR-M2 status correction, followed by **one fresh scoped re-review**. Keep that review focused on the cycle guard, new-breakage controls and corrected claims; do not restart the whole audit or the five-round historical shutdown investigation.
2. Preserve the actual original Express failure and prioritize the separately scoped forwarding/alias/mutation safety ticket after closure. Supporting it safely is useful, but loosening namespace escape during this fix would reintroduce the class of false bindings the plan addresses.
3. Keep final checks and browser runs sequential because the root MCP integration rebuilds shared dist. Relabel new verification by its actual source revision; do not reuse 440/30 as proof for future analyzer bytes or relabel the original failure as repaired.
4. Archive the whole report, both sides of the Task3 cap decision and each individual disposition below with the existing raw evidence. Retain native/client/CI/cloud/runtime limits in the user handoff.

## Individually considered and declined/deferred behaviors

These are individual adjudications of all task deferrals, including items now discharged by reviewed work. “Accepted evidence” means the inspected source/test/report/receipt supports the stated bounded claim; it does not mean I reran that check. No failure or UNRUN item is silently converted to PASS.

### Task1's 17 items

1. **Bounded strict package capture and opaque nearest scope:** no longer deferred to an unimplemented task; accepted Task2 implementation/tests and independent gate. General adversarial filesystem races beyond the preserved reader boundary are not newly certified.
2. **Positive .js package mode:** accepted Task2 provider plus syntax guard and public fixture; no implicit outside-root scope or runtime load-success claim.
3. **Independent budgets, overlap reuse and configuration preservation:** accepted reader extraction and exact boundary/order tests; no separate re-audit of the closed configuration feature as a whole.
4. **Optional package schema, v3 hash and separate counts:** accepted optional schema/hash integration and public controls. A package's unrelated byte/whitespace changes may conservatively stale a plan; that documented provenance cost is retained.
5. **Actual HTTP/SDK CommonJS parity:** accepted Task3 compiled transport regression and records; real Codex/Claude applications remain separately UNRUN.
6. **Package-only freshness and persisted approval/history:** accepted actual type-only lifecycle and stopped-store readback; does not establish arbitrary user-database migration.
7. **Legacy absent field versus zero:** accepted current-process legacy fixture and bilingual UI checks; historical binary compatibility is not inferred.
8. **Browser entry/source/unknowns, image viewing and errors:** accepted bounded recorded browser results and worker/parent actual-view receipts; no new reviewer image pass or whole-machine network certification.
9. **Final combined workspace gate:** accepted recorded repaired 440/30 plus seven-workspace build/typecheck/lint. It is not evidence on a subsequent WR-I1 patch.
10. **Pinned Express product and target cleanliness:** accepted recorded full-target browsing/cleanliness only; original canonical-entry FAIL remains an accepted bounded limitation with a forwarding owner and manual-search cost.
11. **Current Vite/Flask acceptance:** declined new certification because unchanged targets were deliberately not rerun; preserved historical gates retain their original revisions.
12. **Runtime load/build compatibility and arbitrary value flow:** declined because the product analyzes captured static evidence. Users still validate runtime behavior; this limitation does not excuse WR-I1's explicitly required cycle guard.
13. **Recursive forwarding, package exports and workspace mapping:** deferred to separately scoped feature work; fewer automatic entries and manual source inspection remain real costs.
14. **Native Windows/macOS, remote CI and actual client registration:** UNRUN; platform/client/CI owners must validate them. Linux/SDK receipts are not substitutes.
15. **Fresh cloud restoration:** UNRUN; environment/controller owner. Local bundle/clone evidence does not prove restoration in a fresh managed task.
16. **Vendor checksum and final repository state:** retain implementer/controller receipts; no reviewer hash/Git confirmation rerun. Final repository-state acceptance remains the controller's responsibility; 75 vendor entries are not a skill count.
17. **Prior host color warning:** retained as WR-M1, nonblocking Minor, not discharged by clean indexer logs.

### Task2's 20 items

1. **Complete Task1 registry audit:** reviewed within this whole netdiff; original duplicate-local finding remains fixed, but WR-I1 is a new cyclic-initialization gap. Prior approval is not treated as immunity from a concrete cross-plan finding.
2. **Compiled HTTP freshness:** accepted Task3's actual production fixture; its success does not diagnose the separate original shutdown failure.
3. **Actual SDK stdio MCP:** accepted recorded SDK parity/protocol behavior; actual Codex/Claude integration remains untested.
4. **Plan and route service staleness:** accepted type-only edit through shared service with stale plan/route and immutable approval assertions.
5. **SQLite legacy/history/approval:** accepted the disposable stopped-store field-omission/readback case; arbitrary old releases and real user databases were not migrated or certified.
6. **Bilingual metadata omission/zero:** accepted authentic UI RED/GREEN and real-response assertions; zero and unrecorded remain distinct.
7. **Browser entry/helper/source/unknowns:** accepted supported fixture browsing; full Express automatic entry remains FAIL and manual search remains necessary.
8. **Screenshot readability and actual views:** retained worker12/parent3 initial views and worker5/parent3 repaired-planning views as reported/receipted. No independent whole-review visual pass; dense/narrow graph still needs zoom/pan.
9. **External denial, console and protocol:** accepted actual browser denial/errors and SDK stderr records only. They do not establish whole-machine air-gapping or external-model networking behavior.
10. **Final root gate:** accepted current recorded 440/30 and sequential planning pass, with original 436 retained historically. Future modified product bytes need covering checks.
11. **Fixed full Express source:** generic browsing accepted on the recorded full pin; canonical exposure not accepted. The pre-review amendment is reasonable conservative scope control, with failure and next-ticket cost retained.
12. **Cleanup/nonexecution:** accepted owned cleanup/sentinel and final process-absence receipts; the first forced shutdown remains a failure, and an SDK null pointer alone is not OS-reaping proof.
13. **Native Windows:** UNRUN; configured CI and portable source are not native execution evidence. Platform-specific path/signal failures may remain.
14. **Native macOS:** UNRUN; no inference from Linux or configuration-only CI.
15. **Actual Codex/Claude clients:** UNRUN; docs plus SDK tests do not establish registration/discovery in those clients, and no global registration was performed.
16. **Remote CI:** UNRUN; no push or remote matrix execution. Its configured status remains separate from test results.
17. **Fresh cloud restore:** UNRUN; saved draft/local bundle verification is a distinct result and may not transfer local-only commits automatically.
18. **Offline product and external models:** local core browser denial is bounded evidence; external client/model network requirements are outside this acceptance and remain their owners' responsibility.
19. **Workspace/forwarding/general value flow/runtime:** deferred explicitly, with static-forwarding safety next. Uncertain captured cycles are not set aside under this heading; WR-I1 requires repair inside the current safety contract.
20. **Current Vite/Flask gates:** no new claim; historical artifacts/revisions preserved, unchanged mature targets not replayed.

### Task3's seven groups

1. **Unchanged Task1/2 capture/registry boundaries:** now inspected in the whole netdiff and reconciled with prior gates; representative E2E tests are not their sole proof. WR-I1 is the remaining new safety defect; no wholesale reopening of closed MVP/config plans.
2. **First shutdown cause and user SIGTERM:** original cause remains Important/parked under WR-I2. Installed-handler IPC tests and the supported new connection repair do not establish original causality or native real-user signal behavior.
3. **Original Express entry, forwarding and runtime:** original entry FAIL accepted only as the amended bounded limitation; forwarding safety remains prioritized next, while dynamic/runtime/workspace compatibility is unclaimed.
4. **Old binary/arbitrary user DB migration:** declined broader certification; current disposable legacy omission establishes only the implemented optional-field compatibility, without deleting user data.
5. **Native/client/CI/install/restore/old-target groups:** Windows and macOS native runs, real clients, remote CI and fresh cloud restore each remain UNRUN. Clean install/production smoke and Vite/Flask retain explicitly historical evidence; none was refreshed here.
6. **Historical exits/views/nonexecution/temporal fingerprints:** inspected bounded receipts and retained actual worker/controller observations. No independent reconstruction of prior OS events or screenshot viewing is claimed; 114 initial and 128 repaired manifests remain distinct.
7. **Whole gate and final fix procedure:** this report supplies the whole review; the one combined fix wave, one scoped re-review and final residual adjudication remain controller-owned and pending. A task completion/cap disposition is not this whole gate's approval.

### Additional whole-review limits

1. **Arbitrary concurrent filesystem mutation and every symlink timing interleaving:** not certified beyond preserved confined-reader logic and scoped safety tests; no new bypass was identified in the inspected extraction. Reopening the unchanged scanner threat model would exceed this concrete integration review.
2. **Very-large-repository performance beyond the recorded target:** no new benchmark or bound claimed. The registry uses repeated AST/symbol work, but the inspected receipts establish only the actual measured Express run; no unsupported performance finding is inferred.
3. **Complete response delivery to every slow/disconnected client during shutdown:** the reviewed regression proves its delayed accepted request plus partial pipeline, not all transport states. No additional current deterministic defect was established, and no blanket lifecycle guarantee is granted.
4. **Missing historical original-cause telemetry:** not reconstructable from the supplied records; preserved under WR-I2 rather than set aside as a PASS or invented causal attribution.
5. **Whole-machine/model offline behavior:** outside the browser deny proof; no host packet capture, model request or external client execution occurred.
6. **Unchanged closed MVP/config functionality:** not audited anew wholesale; only the bounded new metadata extraction and its integration were assessed. Existing closed findings remain closed unless a concrete new interaction supplies evidence.
7. **Dependency installation, publication and fresh environment readiness:** not performed by this read-only review; onboarding setup remains a separate current-instance/configuration/restore claim owned by the controller.

## Assessment

**Ready to merge? With fixes.**

The architecture, captured-input boundaries and actual product lifecycle evidence are strong, but WR-I1 still manufactures affirmative CommonJS call identities for an explicitly unsupported uncertain initialization cycle and must be fixed. The documented five-round disposition of the original shutdown causal gap is acceptable as a retained Important limitation, not a fix or clean Task3 approval; correct the stale environment summary and retain the host warning and all stated runtime/platform/client/cloud limits through the single scoped closing review.
