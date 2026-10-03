# Captured tsconfig — whole-plan review

Reviewed BASE `808fa43e17d2901c210c4449ca56face14a9633c` through HEAD `091687bff3f70e2f94245e758705ac87874a6285`: six commits, 25 changed files, all three tasks. The recorded BASE is the reviewed MVP milestone. This is a broad integration review of the new plan, not a second review of the unchanged, closed MVP.

Read AGENTS.md, the local using-superpowers/tool mapping and requesting-code-review/reviewer instructions, README, full current design and plan, whole-context, exact global constraints, progress rulings, all three implementation reports and all three independent task reviews. Reasonable user expectations were included; the declined behaviors below are explicit decisions for controller adjudication, not implicit approval of those capabilities.

## Strengths

- **Capture policy is concrete and bounded.** `packages/indexer/src/configCapture.ts:8`, `:39`, `:115`, `:224` enforce 262144 bytes per file, 4194304 total captured bytes, 512 successful inputs and 16 levels including the seed. Opened-handle stat checks precede bounded reads, actual byte lengths are checked afterward, retained buffers have their actual length, handles close in finally, and captured/failed paths are reused. The scanner supplies eligible JSON paths after ignore processing; configuration symlinks and nonregular/unreadable seeds retain opaque rejection evidence rather than becoming source coverage (`packages/indexer/src/scan.ts:102`, `:145`, `:258`). The boundary tests include actual filesystem reads/growth and unopened sentinels, not merely matching constants.
- **Capture success does not authorize a rejected semantic chain.** `packages/indexer/src/configResolution.ts:63` independently validates each selected chain, checks cycle/depth/unavailable inputs before using options, and memoizes only successful subtrees within that owning validation. Thus another seed capturing a seventeenth-level or cyclic member cannot enable partial child options. Nearest candidates include opaque markers; parsed membership governs `files/include/exclude/allowJs`, and finding an invalid/excluding nearest candidate terminates search (`:40`, `:127`, `:158`). Named configs/references do not silently broaden ownership.
- **Compiler inputs remain virtual and scoped.** `packages/indexer/src/configResolution.ts:50`, `:183`, `:201` use captured memory files, a synthetic child root, captured-source-only resolver existence/read methods, a supported option subset, inherited paths metadata and scope-specific caches. Returned filenames must belong to captured sources. `packages/indexer/src/typescript.ts:184` prevents missing configured aliases from entering external binding classification; real checker declaration identity remains responsible for resolved calls. Tests exercise nested identical aliases, inherited declaration locations, ordered extends, namespace/default/re-export identity, unavailable targets and ambient unknowns.
- **Freshness and compatibility compose through existing boundaries.** `packages/indexer/src/scan.ts:274` frames a versioned source/configuration byte hash; optional metadata at `packages/core/src/model.ts:35` and `packages/core/src/validation.ts:148` keeps configuration out of source files and nodes. `packages/indexer/src/index.ts:26` forwards both captures and rejection diagnostics. No new public port, database migration, dependency or second approval system appears. The actual integration test checks changed config-only target/path/line, unchanged source bytes and function IDs, stale plan/route, retained operations/approval and historical snapshots (`tests/integration/tsconfig-resolution.test.ts:14`).
- **Legacy behavior is tested as persisted product behavior.** `tests/support/tsconfig.mjs:37` creates a distinct old-shaped snapshot in a stopped disposable SQLite store, then integration/browser tests read it through new compiled server and SDK processes. `apps/web/src/app/Navigation.tsx:165` distinguishes absent metadata from an empty recorded array, renders separate configuration counts/paths with exact bilingual labels, and leaves authored text untouched. Browser assertions exercise entry expansion, actual target source, search and both locales, not just screenshot creation (`tests/e2e/tsconfig.spec.ts:12`).
- **Validation claims have useful limits.** Actual final logs substantiate 293/293 tests in 25/25 files, seven workspace builds/typechecks and root lint exit0, two new browser passes, one existing planning browser/SDK pass and the real HTTP/SDK lifecycle pass. Raw receipts show legacy field omission, six sources/two configurations, empty browser errors/external/protocol errors and target nonexecution. The new fixed Vite receipt records 1583 sources/55 configurations, 8117 function-kind nodes/44263 relations, calls 6223 resolved/8302 external/15726 unresolved, 18 disclosed diagnostics, 5796ms, and the same clean full target SHA before/after. Older Flask/MVP evidence is not represented as a current rerun.

## Issues

### Critical — 0

None found.

### Important — 0

None found.

### Minor — 2

1. **WR-M1 — Inherited runner color settings produce warning noise.** `.superpowers/sdd/2026-10-03-captured-tsconfig/scratch/task-3/ui-green.log:4` and `scratch/task-3/planning-e2e.log:4` emit `The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set`. Trigger: these Playwright invocations inherit both variables. Effect: command output is not pristine and repeated environment warnings make relevant diagnostics harder to notice; the app console and SDK stderr evidence remain empty and assertions passed. Remedy: choose one color policy in the runner invocation/environment when that configuration is maintained, without suppressing unrelated warnings. This is the independently assessed Task3 deferred M1, retained as a nonblocking Minor; no product change or rerun of passed browser gates is warranted solely by it.

2. **WR-M2 — The design's execution-status line is stale.** `docs/superpowers/specs/2026-10-03-captured-tsconfig-design.md:4` says Task1 is approved and Task2/3 are awaiting implementation, while the completed plan, state and ledger show both approved. Trigger: a subsequent worker follows the plan's linked design to determine remaining work. Effect: contradictory handoff state can encourage duplicate execution; it does not affect product behavior. Remedy: update that status line to all three task gates completed/whole-plan gate status, or make it explicitly a dated historical checkpoint and point to the authoritative state. This can be included in the normal review-closeout documentation update.

## Evidence and review method

- Read the prebuilt 3299-line diff in bounded passes without regenerating it. Initial output truncated part of the documentation section; the unreadable contract portion was recovered separately. The complete current spec/plan had already supplied the plan wording. Production and test changes were inspected once in nonoverlapping passes, not re-read through a source crawl.
- Inspected actual `task-1-packages-test.log` (130/4), Task2 `affected-tests.log` (160/4), Task3 backend baseline, root-results/build/typecheck/lint/test logs, UI/planning GREEN logs, persisted browser receipts, Vite provenance/counts/diagnostics/source/budget receipt, planning approval/export/verification receipt, source provenance, cleanup receipt and screenshot-viewing record. Backend's early route/ordering harness errors are not treated as product RED; actual UI RED and final GREEN are documented separately in the task report/review.
- Counted **75** `: OK` entries in the actual vendor receipt: 74 skill files plus the MIT license. The Task3 review's “74 OK entries” wording is inaccurate shorthand; there is no missing checksum result or failed vendor gate. Preserve this corrected count in closeout claims, without rewriting the original review evidence.
- Task1/2's earlier lifecycle, transport and legacy deferrals are closed by Task3's actual assertions and receipts for the exercised fixture. The whole pass inspected their producing/consuming interfaces directly rather than accepting the existence of reports as proof.
- Screenshot viewing is evidenced by the implementer's ten-image record and controller's independent observations; this reviewer did not claim to have viewed those images or rerun a visual gate. Source provenance is receipt-bound; no independent rebuild or fresh environment restoration is implied.
- No code-raised doubt remained that required an additional outside-code read or runtime probe. No passed suite, browser, benchmark, race or high-count loop was rerun. No source/index/HEAD/branch mutation, helper, new checkout or publication occurred. The sole review write is this report.

## Recommendations

Close the documentation Minor during the normal gate/status update, retain the host warning explicitly as environment debt if it is not corrected now, and keep the demonstrated CommonJS safety work next in the queue. No product repair is required by this review. Do not turn the current static-resolution and Linux evidence into complete runtime, native-platform or client-registration claims.

## Declined to judge

Each item below was considered and set aside from this plan's completion verdict, for the stated reason. These are individual controller decisions to accept or reopen.

1. **Shadowed CommonJS `require` yielding a false resolved call:** a demonstrated pre-existing defect recorded in the ledger and prioritized for the next independent ticket; the current diff does not claim to fix it. This remains real debt, not a safe behavior approval.
2. **Overwritten CommonJS exports yielding a false resolved call:** separately demonstrated pre-existing defect with the same explicit next-ticket ownership; not fixed or made acceptable by this plan's static-evidence qualification.
3. **CommonJS exposed-entry discovery gaps:** recorded next-ticket work; this review does not infer full entry coverage from ESM alias cases.
4. **Exact Node package/module-mode runtime resolution, including ESM extension requirements:** package metadata/runtime equivalence is not captured here; the prior targeted task review established only unchanged `.mts` relative-import behavior. Current success is captured static declaration resolution.
5. **Workspace package/exports and build-output-to-source mapping:** explicitly unimplemented mapping work; no package manifests/dependencies are introduced as compiler inputs in this plan.
6. **Package `imports` mapping:** separately excluded from the resolver contract; unconfigured unresolved bare specifiers retain the documented external classification.
7. **Project-reference graph expansion:** intentionally diagnosed rather than traversed; leaf nearest tsconfig behavior is judged in this plan, reference traversal is future work.
8. **Automatic `tsconfig.app.json` or editor-equivalent project selection:** deliberately excluded by the explicit nearest `tsconfig.json` ownership rule; named files remain captured extends inputs.
9. **Package/absolute/non-JSON extends support:** explicitly unsupported and diagnosed under the bounded relative `.json` contract; no package or network fallback is expected.
10. **Dynamic import/require and general dynamic dispatch accuracy:** unchanged unsupported semantic work; no target execution or runtime proof is claimed.
11. **Full target type correctness, plugins, libraries and build-environment equivalence:** intentionally unavailable in the captured host; resolved edges are declaration evidence, not a successful target build or runtime guarantee.
12. **Race-proof adversarial concurrent filesystem traversal or a transactionally frozen target tree:** existing contract disclaims arbitrary concurrent filesystem races; the present opened-handle/component checks and immutable captured inputs are judged, but no atomic cross-platform snapshot guarantee is inferred.
13. **Native Windows execution:** not run; normalized Windows separators and prior path regressions on Linux are not a native-platform pass.
14. **Native macOS execution:** not run; Linux receipts do not establish its filesystem or native-module behavior.
15. **Actual Codex App registration/connection:** SDK stdio coverage is not an installed App-client acceptance test; remains unclaimed.
16. **Actual Codex CLI registration/connection:** likewise not established by the SDK client; remains unclaimed.
17. **Actual Claude Code registration/connection:** likewise not established by the SDK client; remains unclaimed.
18. **Native client automatic discovery of vendored skills:** checksum verification proves installed contents, not each client's discovery behavior; coverage remains partial.
19. **Remote three-OS CI execution:** configuration exists but no remote runner execution is claimed by these receipts.
20. **Fresh-task cloud environment restoration:** saved onboarding draft/configuration is not a tested fresh restoration or publication; remains unverified.
21. **New clean installation and production smoke on this exact ticket:** older installation/smoke evidence is retained as historical, and this ticket did not rerun them or change dependencies; current compiled lifecycle/root checks are the new evidence.
22. **Fresh Flask benchmark/current Flask counts:** unchanged Python target was not rerun; its earlier fixed-target evidence stays historical, while Python regressions are included in the current root suite.
23. **Vite/Flask upstream tests or target-code execution:** explicitly not performed, and must not be performed by this indexer; product browsing does not imply upstream correctness.
24. **Publishing, deployment, remote push or release acceptance:** outside authorized local development/review and not attempted.
25. **Complete group member editing/folding and preserved external endpoints under folding:** README backlog, unchanged by configuration capture/resolution; no completion claim added.
26. **Dedicated file/directory drag placement and path-preview interaction:** existing partial UI capability, outside this backend/input-visibility plan.
27. **Standalone annotation editing and lost-binding reassociation:** existing documented knowledge-workflow gap; this plan preserves history rather than implementing that workflow.
28. **Knowledge import/export conflict handling and SQLite backup entrypoints:** existing explicit future data-preservation work; no migration or destructive cleanup occurs here.
29. **Directory-convention file read/write/audit round trip:** existing separate backlog; current change does not claim to implement it.
30. **Accepted rename/move identity migration and broader structural difference reporting:** existing separate backlog; stable unchanged-source identities are verified here, migration is not.
31. **Advanced sequence/wrapper editing:** future grouping capability, not implied by resolved aliases or existing capability groups.
32. **Watchers/incremental indexing and automatic layout:** intentionally deferred until justified; one recorded fixed-target run does not establish a general performance envelope.
33. **Additional languages, cross-repository graphs, remote collaboration or runtime tracing:** README future directions, not new claims or changes in this bounded TS/JS configuration ticket.

## Assessment

**Ready to merge? Yes — for the captured-tsconfig plan, with two nonblocking Minors recorded.**

**Reasoning:** The complete change coherently connects bounded captured configuration inputs, per-source checker resolution, immutable freshness/history, legacy persistence and bilingual visibility through the existing product boundaries. Actual code and recorded integrated checks support the plan's claims; the two Minors concern runner noise and handoff metadata, while the individually listed remaining capabilities and known pre-existing defects require their own controller disposition. This verdict authorizes no publication or shared-branch action.
