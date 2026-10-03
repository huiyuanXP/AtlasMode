# SDD ledger — plan: docs/superpowers/plans/2026-10-03-local-planning-mvp.md

Goal: local TS/JS/Python planning MVP with MCP; then complete questionnaire extensions and README gaps.
User authorized unattended autonomous execution; no stage waits. Existing cloud checkout on work branch.

## Preflight
| Pair/task | Shared interface/files | Check / ruling |
| --- | --- | --- |
| 1→2,3,4,5,6,7 | core model/schema/ports | all consume contracts.md public entry; no source deep imports |
| 1→2–8 | root manifests/lock/scripts | T01 creates pins; later dependency changes must stay one npm lock |
| 2→3 | IndexerPort | SourceIndexer.index(rootPath,projectId) returns complete CodeSnapshot |
| 3→4 | WorkspaceService | HTTP consumes exact methods in contracts; service imports core only |
| 4→5,6,7,8 | HTTP paths | contracts table fixes body/response, budget and status shapes |
| 5→7 | web features/styles | sequential implementation; core workflow tested before extensions |
| 2,3,4→8 | fixtures/temp data | real file and persistence validation, never commit generated DB |
| 1 | tests vs implementation | pure stable/path/plan/route tests; full build deferred until actual modules |
| 2 | tests vs implementation | TS symbol mapping, Python AST-only side-effect test, containment |
| 3 | tests vs implementation | history and current validity deliberately distinct; SQLite transaction |
| 4 | tests vs implementation | production static/API fallback and max budget must match contract |
| 5 | tests vs implementation | facts/plan projections distinct, project switch/late response defense |
| 6 | tests vs implementation | actual stdio client, no approve tool, same backend |
| 7 | tests vs implementation | service group/policy prepared in T03; semantic undo increments revision |
| 8 | tests vs implementation | Linux evidence separate from threeOS YAML; actual visual screenshots |

Ruling: user questionnaire adds Python, UI project switching, i18n/groups/policies/history; spec updated before implementation. Cost if wrong: reversible schema/UI rework.
Ruling: continuous execution overrides per-stage human review waits by explicit user instruction. Independent code review still mandatory.
Ruling: no extra worktree because Codex Cloud isolation and AGENTS. Cost if wrong: local branch-only changes remain reversible.
Ruling: execute sequential SDD tasks with models explicitly chosen per skill. No implementation agent spawns helpers.

Task 1: pending

Task 1: implementer /root/t01_foundation, base 3438b10, model gpt-6.1-sol high.
Ruling: call_chain step 2+ references incoming resolved calls edge previous→current with evidence; walkthrough supplied relation must touch its node. Clarifies contract without field changes.

Validation preparation: Vite v8.3.2 and Flask3.1.3 pinned outside checkout; targets /tmp/atlasmode-validation-targets.json. Official ReactFlow Overview executed and screenshot inspected: /tmp/atlasmode-reference-demo/evidence.json. Playwright CDN denied; installed Debian Chromium151 works with executablePath=/usr/bin/chromium. Pass this to T05/T08.

Ruling: createPlan accepts optional baselineSnapshotId and rejects mismatch; MCP propose_plan requires caller baselineSnapshotId. Prevent stale Agent context silently binding to new snapshot; notify T03/T06. Cost if wrong: additive API compatibility adjustment.

Task 1: implementation complete 1b33c7f; 43 tests, core build/typecheck/lint and npm ci pass, audit0. Optional npm signature-metadata TUF HTTP403; integrity/TLS not bypassed. Independent review /root/t01_review pending.

Task 1: review spec❌/quality needs fixes; Important disguised Windows drive paths after dot-segment normalization, validation.ts28/53. Fix round1 dispatched original /root/t01_foundation; covering validation.test.ts. FIX_BASE a299eb8 (prior task review1b33c7f, controller doc-only a299eb8).

Task 1: fix round1/5 (1 addressed,0 open; commits a299eb8..415a054). Scoped re-review /root/t01_rereview clean.
Task 1: complete (commits3438b10..415a054, review clean). 51 tests pass, build/typecheck/lint verified. Deferred native platform/full-product checks move to T08; TDD logs/report retained.
Task 2: implementer pending, base415a054.

Ruling: approvePlan and verifyPlan are async and refresh actual index before decisions; MCP get_approved_plan refreshes before getPlan, while UI manual snapshots remain explicitly last-indexed. Prevent unrefreshed filesystem mutation falsely approved, avoid service duplicate scanner. Cost if wrong: asynchronous service test/client adaptation, HTTP shape unchanged.
Ruling: IndexerPort optional readSource delegates code I/O/realpath confinement to indexer. T02 may add this optional port method in core; service only delegates. Cost if wrong: minor injectable port adaptation.

Task 2: active implementer /root/t02_indexer, gpt-6.1-sol high, base415a054; initial 9 behavioral RED tests observed by implementer. Controller-only documentation commit3c76876 is included in subsequent review range; no implementation interference.
Ruling: T03 actual-adapter lifecycle tests may live in root tests/integration to preserve service import restrictions; unit ports remain injected. Cost if wrong: test file placement only, no production boundary change.

Environment draft revision updated: start_skill now reflects real manifests/core checks (saved; not published). Current product startup still deferred until T04/T05.
T03 dispatch reminder: approval/verification await index refresh, then reread revision inside synchronous transaction. Cover plan edit during refresh and out-of-order concurrent refresh; do not hold SQLite transaction across await. Real adapter tests belong in tests/integration. Public async signatures/readSource are in contracts.md.

Ruling: T02 may add indexer package files:["dist","python"] because npm pack dry-run omitted dist via root ignore inheritance; packaged public entry and Python helper must work. Cost if wrong: manifest-only packaging adjustment, no dependencies/lock changes.
Task 2 milestone: implementer reports root tests72/72 and root lint pass; final packaged/other-cwd Python invocation pending. No product startup claimed yet.

Task 2 packaging milestone: actual tar contains dist/index.js and python/index.py; unpacked entry invoked from /tmp with existing verified dependency links returns 2 Python functions/1 resolved call, target side-effect sentinel absent. Source read Latin-1 regression also RED→GREEN; final covering checks/report pending.

Task 2: implementation56ccccf received; public source indexer and optional source read implemented. 72/72 current tests, root lint, core/indexer build/typecheck; packaged helper evidence. Report supplemental actual RED/GREEN output requested without rerunning checks. Independent review package review-415a054..56ccccf.diff generated (includes controller docs as explicitly authorized context).

Task 2: independent review dispatched /root/t02_review (gpt-6.1-sol high), review56ccccf against415a054. Supplement report now includes original RED command/output and final GREEN output/chunk IDs; no rerun.

Task 2: review spec❌/quality needs fixes, reviewer /root/t02_review. Important(1) Python missed except/match/lambda shadows and local def use-before-binding creates false resolved calls; Important(2) TS anonymous callback qualifiedName uses whitespace-sensitive callee text so blank-line insertion changes ID. FIX_BASE56ccccf. Fix round1 assigned original implementer next; no other implementation until scoped review clean.

Task 2: fix round1/5 dispatched original /root/t02_indexer. Covering tests index.test.ts: except/match/lambda variadic shadowing, local call before def, normal direct call control, anonymous callback callee-internal blank lines. Preserve ordinary delayed global function-body resolution and literals; only focused/amended checks before scoped review.

Deferred architecture check for final/T08 review: SourceIndexer snapshot ID currently uses project+source fingerprint only. If parser capability changes (e.g. Python missing then installed) with unchanged source bytes, analysis facts/diagnostics may differ under same ID. Check immutable snapshot storage behavior before claiming historical baselines remain immutable; do not extend current two-finding fix round for speculation.

Task 2: fix round1 commit2c016ec received, RED9fail/GREEN31pass targeted indexer tests plus build/typecheck/affected lint. Scoped re-review /root/t02_rereview (gpt-6.1-sol high), fixdiff56ccccf..2c016ec. Await verdict before T03.

Task 2: fix round1/5 (2 addressed,0 open; commits56ccccf..2c016ec). Scoped re-review /root/t02_rereview clean, no newbreakage, no tests rerun.
Task 2: complete (commits415a054..2c016ec, review clean). Original72 current-suite pass plus31 indexer regression pass afterfix; core51 unaffected. Native/scale checks remain T08; snapshot capability/immutability observation retained for final review.

Task 3: implementer /root/t03_lifecycle (gpt-6-astra high), basea930fad, dispatched lifecycle with exact asyncfreshness/contracts, actual adapters integration, race tests and immutable history. Own storage/service/tests/integration only; no helperagents.

Ruling: deferred source-only snapshot-ID observation becomes load-bearing when T03 preserves immutable snapshots; fix it inside the single active T03 implementer rather than hiding new parser diagnostics under an old ID. Source contentHash stays byte-only; snapshot ID also uses deterministic analysis facts/diagnostics/coverage, excludes observation time/Git/root, unchanged content+analysis remains stable. Cost if wrong: opaque snapshot IDs change once and affected baselines/routes need refresh; product not yet launched. T03 brief/contracts updated, own minimal indexer index.ts/index.test.ts dependency fix authorized, no parallel implementer.

External validation (controller, actual public compiled SourceIndexer): Flask3.1.3 full83Python files, 1989nodes/1574 function-kind declarations (includes class containers), 6281relations, calls714resolved/1026external/2176unresolved, diagnostics0,1665ms,maxRSS179140KiB. Core snapshot schema passed; two templating→_render calls matched exact source lines151/163. Evidence artifacts/validation/python-indexer-evidence.json; module digest pins actual compiled implementation. No target code/upstream suites executed. Vite full checkout indexing running session76691.

External validation actual Vite8.3.2: full checkout supported1583source files,11218nodes/8117function-kind declarations (class containers included),44263relations; calls5373resolved/10443external/14435unresolved,7diagnostics,4465ms,maxRSS550376KiB. Three exact call samples createServer→_createServer, _createServer→resolveConfig,fsPathFromId→normalizePath passed core schema and source evidence. artifacts/validation/typescript-indexer-evidence.json. Larger file count than1550precount includes supported mjs/cjs/mts/cts. Both mature source targets checked; HTTP/UI/MCP scale use still T08.

README follow-up candidates (not dispatched; prioritize after T08 actual core gate): source configuration/monorepo aliases and static CommonJS for self-browsing across @codemap packages; propose_group MCP; independent persistent annotations/lost bindings; knowledge schemaVersion export/import conflict preview and SQLite backup; structure.json atomic write/audit and dependency exceptions; functional group collapse/member editing. Advanced wrapper/sequence/incremental indexing remain later by spec unless time/evidence justifies them. No extra implementation before MVP gate.

Task 3 milestone: actual16 lifecycle tests GREEN, additional race/rollback/historical approval tests GREEN. Self-review RED/fixes: remove_relation must not adopt unimplemented planned move, async SQLite callback continuation must not write after rollback, null input and Windows root validation. Pending complete suite + ready-package dependency-order checks before independent review. DomainError codes reported: NOT_FOUND,INVALID_INPUT,INVALID_PATH,PROJECT_MISMATCH,INVALID_SNAPSHOT,REVISION_CONFLICT,BASELINE_CONFLICT,VALIDATION_FAILED,NOT_APPROVED,SOURCE_UNAVAILABLE; carry HTTPmapping toT04.

T04 dispatch notes: root build/typecheck currently includes still-unimplemented web/MCP, so build ready dependency subset without placeholders; full root checks waitT06. Root dev presently calls workspaces.mjs/concurrently; authorize root script hook + scripts/dev.mjs supervisor and own manifests if needed. Server Zod dependency may require exact existing4.6.5 plus rootlock (no version upgrades). Public query response shapes/counts/entrypoint evidence must be documented for T05/T06. Node24 '--import tsx' and direct Node subprocess avoid npm.cmd/Bash assumptions. Product targets bound127.0.0.1; stderr-only rule applies to MCP, not HTTP server logs.

Task 3: implementationf2d1b11 received,112/112 current suite pass (core51,indexer32,storage4,service4,integration21), implemented-package build/typecheck/lint and actual packaged migration/service approve smoke. Independent reviewer /root/t03_review (gpt-6-astra high) dispatched review-a930fad..f2d1b11.diff. Parent docs4dc20d6/ec2ab2a included as authorized context. No furtherimplementation until reviewgate.

Task 3: review spec❌/quality needsfixes, /root/t03_review. Three Important proven by focused real adapters: unrelated diagnostic hides conclusive direct call; copied temp function inold/new paths mistaken successful move; non-native Promise-returning transaction rejected synchronously yet delayedwrites persist. FIX_BASEf2d1b11. Resume original implementer fixround1 next. No otherimplementation yet.

Task 3: fix round1/5 dispatched original /root/t03_lifecycle. Covering sqlite.test.ts + actual workspace-lifecycle integration: unrelated brokenfile vspositive directcall; tempmove true/copy; normal callback returningPromise.then delayedwrite vsnormal externalwriter/nested sync transactions. Await fix report and covering checks before scoped newreview. FIX_BASEf2d1b11.

Task 3 fix1 milestone: 4 new RED regressioncases reproduced, storage6 and targeted integration4 GREEN. Per-storage AsyncLocalStorage contains rejected async transaction continuations; diagnostics scope to relevant file/directory/language; tempmove original addpath/residue/incomplete checks. Await final scoped checks/report/commit.
T04 pre-dispatch correction to apply afterT03 gate: README forbids graphalgorithms inserver; put pure search/context/subgraph traversal and transport-result types in core queries.ts, server queries.ts only glue/validation. Add function-context edge pagination/truncated counts using same default50/max200 to meet allgraphquery-budget contract, pass newshape toT05/T06. No implementation dispatched yet.

Task 3: fix round1 commit5608f10 received,34 scoped tests/build/type/lint pass. Scoped re-review /root/t03_rereview (gpt-6.1-sol high) dispatched prebuilt fixdiff f2d1b11..5608f10; await verdict.
Ruling: T04 graph search/context/subgraph algorithms and public response types move into pure core queries.ts; server remains transport glue, matching README package boundaries. Function context is paged default50/max200 with separate incoming/outgoing totals; queries return snapshot/dataSource. Subgraph defaults calls, optional relation types, nodebudget80/max300 plus relationcap3*budget; budget clipping explicit. Summary exports are candidates, max50/total/truncated, no zero-indegree inference. Cost if wrong: additive HTTP/client adaptation before clients exist; adjust paging or edge budget later without rewriting facts. Plan/contracts/task4brief updated.

Task 3: fix round1/5 (3 addressed,0 open; commitsf2d1b11..5608f10). Scoped re-review /root/t03_rereview clean, no newbreakage/out-of-scope.
Task 3: complete (commitsa930fad..5608f10, review clean).112 original-suite pass plus34 fix-scope regression/build/type/lint; all native/UI/HTTP/MCP product checks remain later tickets, not claimed.

Task 4: active implementer /root/t04_server (gpt-6.1-sol high), baseba964de. Latest task4brief/contracts scope pure core boundedqueries, allHTTP, actualCLI smoke, crossplatform Node supervisor; no other implementation active. Root web/MCP missing, fullbuild deferred; ready-packages validation required.

Ruling: Python exported flag is public-name convention, also set on nested declarations. T04 summary uses only public top-level file children for Python candidates, while TS/JS explicit exports remain candidates; disclose evidence basis, never runtime-confirmed entry. Avoid nested local helpers as fake module API without changing indexer. Cost if wrong: some public class methods require class/search navigation, later __all__/framework evidence can refine candidates. Implementer notified and query regression requested.

Task 4 milestone: core query RED6 missingexports→GREEN6; real-service HTTP inject RED11 missingfactory→GREEN11. Python nestedpublic entrypoint regression RED1/7 confirms visibility constraint; targeted fix underway. Next CLI/supervision TDD and actual compiled-process smoke.

Task 4 actual-process milestone: CLI RED3 no-listen→GREEN3 health/open/snapshot/function/source, persistentSQLite reopen and SIGINT/SIGTERM. Fixed post-listen Fastifyhook during iteration. Dev supervisor RED3→GREEN3; cwd regression RED exposed Vite atmonoreporoot→fixed apps/web cwd. Final ordered ready-package checks/compiledCLI smoke and one full current suite pending.
Browser environment preflight (controller): system fontconfig lists NotoSansCJK SC and monoCJK, Chinese glyphs available; /workspace30GiB and /tmp17GiB free, cgroup32GiB. No additional font install needed.

Task 4 compiledCLI smoke: node apps/server/dist/index.js actual tempTS fixture healthok, open200, snapshot4nodes, context1outgoing, exact sourcebytes, SIGTERM exit0 and reopenedSQLite retained1project. Logs explicitly UIbuild unavailable. Ordered core/indexer/storage/service/server build/typecheck and affectedlint exit0. Final npm test and commit/report pending.

Task 4: implementationebfa409 received, fullcurrent141 tests/9files pass, allreadypackage build/type/lint andcompiledprocess/persistencesmoke pass. /root/t04_review (gpt-6.1-sol high) dispatched prebuilt review-ba964de..ebfa409.diff. Awaitgate, no UIimplementer yet. Error envelope/publicquerytypes copied fromactual report into contracts forclienthandoff; no implementation changes.

Task 4 review milestone: named actual supervisorprobe confirms build-phase npmchild termination leaves grandchild alive (scripts/dev.mjs14–18,43–50). Probe cleanedchild/temp. Reviewer preparingcomplete Important finding; gate remainsclosed, no UIimplementation. Awaitcomplete report thenresumeoriginalimplementer fix1.

Task 4: review spec❌/qualityneedsfixes /root/t04_review; oneImportant npm prerequisitebuild descendants survive shutdown. FIX_BASEebfa409, parentdoconlyeffcf13current. Original /root/t04_server resumedfixround1, covering scripts/dev.mjs +dev.test.ts actualactivebuilddescendant RED/GREEN; scopedtests/lintonly, no fullsuiterepeat. Nativeplatform/offline/UI/MCP/fullbuild ⚠️ arelaterexplicitT05–T08 requirements, notacceptedcompleteclaims.

Ruling: T04 fix uses direct process.execPath+pinned TypeScriptCLI for five prerequisite scripts verified exactly tsc -p tsconfig.json, eliminating npm build descendants rather than adding native process-tree adapters. Guard changedbuildscripts tofailclearly, preserve orderedcwd/exitcodes/signals. Cost if wrong: future custombuild scripts require explicit devlauncher update; current scripts equivalent. Implementer instructed actuallivecompiler termination regression andreport guard/limit.

Task 4 fix1 milestone: actuallivecompiler-after-stop RED1 then directCLI fix; custombuild/pre/post lifecycle guard RED1 thenfix. Covering devsuite GREEN5/5 preserves runtimesignal/childfailure7/buildfailure9. Scopedformat/lint/syntax/CLIresolution pending beforecommit/review.

Task 4: fix1commit6daac82 received, appendedRED/GREEN5devtests/lint/syntax/CLIversion+manifestguardchecks confirmed. Freshscope /root/t04_rereview (gpt-6.1-sol high) reviewing packageebfa409..6daac82. No newimplementationuntilgate.
Ruling: T06 adds pagedlist_projects so a freshlyconnectedAgent discovers explicitprojectId ratherthan guessingbrowseractiveproject. Promote READMEpropose_group intoT06 because existingvalidatedHTTPgroupservice alreadyavailable; force sourceagent, newgroup only. Cost if wrong: twoadditional thinSDK toolcontracts and focused integrationchecks, no newstorage/serverstate; advancedgroupapproval/combination stilllater. Plan/backlogupdated beforedispatch.

Task 4: fixround1/5 (1 addressed,0 open; commitsebfa409..6daac82). /root/t04_rereview clean/no newbreakage/out-of-scope.
Task 4: complete (commitsba964de..6daac82,reviewclean). Original141suite plus5fixdevcovering tests/build/type/lint/actualcompiledAPIprocess/persistence passed. Nativeplatform/fullproductbuild/offline/UI/MCP checks remain T05–T08 explicitly unclaimed.

Task 5: activeimplementer /root/t05_canvas (gpt-6-astra high), base8f2e32e. RealHTTPtypes/errors/reference actualReactFlowdemo+systemChromium/fontprep passed. ScopeChinesecompactthreepane/budgetedbrowsing/projectlateisolation/planning/route/source/verify/layout; English/groups/policies/historyT07. RequiresactualbuiltUIbrowserfunctional+viewedscreenshot beforecommit; fullE2E/matureUI/3OSCIT08. No otherimplementation active.

Environmentdraft savedconfirmed afterT04: installscript npmci +orderedfiveimplementedbuilds; start_skill verifiedcompiledAPI/defaultloopback/smoke/directskillfallback/exactresume/currentlimits. No repository/network/secret/variablemembershipchanged, notpublished/applied, freshrestorenotclaimed. Upgradefullrecipe afterT06/T08actualwholeproductchecks.

MCP prep controllerreadonly: installedcodex mcp add --help confirms stdio --command and --envKEY=VALUE syntax; no client/globalconfigmutated. InstalledSDK1.32.0 official examples in node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/simpleStreamableHttp.js demonstrate registerTool/inputSchema, useinstalledmajorT06. ActualCodexApp/ClaudeCodeGUIconnectionsunrun, realSDKstdio integrationplanned.

Task 5 milestone implementer: 11behavioralRED projection/operation/requestscope assertions (notmissingimport)→GREEN11/11 at22:15UTC. FollowupworkspaceisolationRED oldopenpath overwrote newlyselectedproject; fullcontrollerinprogress. Agentviewedactualxyflowreference screenshot+source. UIbrowserpending, separatedcontroller/canvas/projection/planning/routes/inspector; no largefileclaimyet.

Task 5 buildmilestone: webbuild/typecheck/lint pass. FIRSTactualChromiumsmokefound HttpApi nativefetch Illegalinvocation classproperty receiverbugbeforeHTTP; diagnosedconsole/body/network, focusedregressionRED observed, repairthenresmoke. Sameprojectsource/graph have latestsequenceperscopekey; controllerreversecompletionregression added. Purpose-specificpanel extractionwithinapprovedfeatures beforecommit; no browserreadinessclaimyet.

Task 5 actualbuiltbrowser milestone: nativefetch receiverfixed/regression; smoke opensrealTSfixture/greetsource/context, createsplan/newfn/must_calledge, validates/approvesr3, downloadsJSON, actualverifyreport,0consoleerrors. Agentviewedsource/lightplan/narrowscreenshots; visualdefect genericsourceCSS leaksReactFlowhandle, fixwithactualbrowserboundsregression pending.
Ruling: T05 purposefulpaneldecomposition approved afterformatgrowth App457/PlanningPanel487: appNavigation+WorkspacePanels andplanningFunctionForm+RelationEditor+PlanEditor; keepcohesive400-line scopedlifecyclecontroller, no newgeneralstateinterfaces. Cost if wrong: componentprops mayneedlateradjustment, no domain/API changes. SourcehandleobservedCSSfix pluscurrentbrowserrerunjustified; fullsuiteoncebeforecommit.

T08 nativeplatform namedrisk (controllerofficialdocsread): Node24 https://nodejs.org/docs/latest-v24.x/api/process.html signal-events says Windows SIGTERM unsupported/listenable; terminalSIGINT supportedallplatforms. Spawnedchild.kill signal tests musthonor platformforcedterminationvsinteractiveCtrlC semantics; do notreportLinuxgracefulsignal evidenceasnativeWinpass. OfficialHTML /tmp/atlasmode-node24-process-docs.html lines1247–1249. T08/wholebranchreviewcheckconcreteOSassertions, nativeCIstillunrun.

T05 followup reminder delivered: sameprojectrapidfocus/source/context/subgraph anddebouncedsearch/query/page latecompletion mustguard latestrequest scope, notonlyprojectId. Agent reports scopes present, controllerreversecompletionregression added. T05source split approval andvisualhandlefix remainactive beforefinalsuite/commit.

Task 5 finalmilestone: fullcurrentnpmtest once165/14files (web22); orderedcore/indexer/storage/service/server/web build+typecheck andweblint exit0, vendorintact. Actualbrowserresmoke afterpanel split/fixes exit0 source/plan/approve/export/verify,0consoleerrors; CSShandle actualRED28px→GREEN8px. Updatedscreensviewed; settleddarkrecapturepending dueCSStransitiontiming. Controller464 cohesiveguard/actionslines, extractedpanels80–216/App104; approvedstructureboundaryunchanged. Awaitcommit/report andindependentreview.

Task 5: implementation2dc95d7 received,165currenttests/22web +allimplementedbuild/type/weblint/actualbrowserandviewedscreens pass. /root/t05_review (gpt-6-astra high) dispatched fullprebuilt review-8f2e32e..2dc95d7.diff. Parentviewingrenderedsource/dark/narrowimagesnow; no codefixes/nosuiterepeat. Native/fulloffline/MCP/English/groups/history/fullE2E/matureUIstilllaterexplicit.

Task 5 parentvisualcheck: actuallyviewed source/light +settleddarkplan +narrow600px screenshots; readableCJK/threepanes/stateicons+labels/compacthandles, no additionalobservedCritical/Importantlayoutdefect. Thisisrenderinspection, notnewbrowserfunctionaltest.
Task 5: review spec❌/qualityneedsfixes /root/t05_review. ImportantI1 route/manualexpand separatekeys letolderroute overwrite newergraph+selection (focusedprobeconfirmed); I2 Canvasfocus selectedIdonly failsremotegrapharrival/repeatedsamefocus. FIX_BASE2dc95d7. Original /root/t05_canvas resumedfixround1 withworkspace/controller +Canvasrealbrowserfocus regressions, scopedchecks only.
Task 5: minor (deferred): M1 editedtemporary-node selectedNode inspector/copylocation retainsoldname/path/signature (workspace.ts101/Inspector25). CarryintonextrelatedT07plan/historytask andfinalwholebranchreview, never discarded.

Cloudbrowserrecipe: actualPlaywright1.63 install --dry-run chromium confirms Chrome153/ffmpeg urls oncdn.playwright.dev andfallbackplaywright.download.prss.microsoft.com. Addedthese2 customdomains todraft preservingexisting5+package_managerpresets; savedconfirmed/notapplied/published. No browserdownloadretry, actualexecution remainsChromium151system. Initialrgexpectedregistryindex missingdueSDKbundledlayout, adaptivecoreBundle+dryrun resolvedmetadata withoutnetwork download.

Task 5 fix1RED: controllernewroute/manual regression fails(route-target vsmanual-target),prior9pass. FocusedREALbrowser withcompiledbase+realfixture/delayedactualHTTP graphremoteFocus off4979.9px/repeatedsame-stepFocusafterpan off250.3px,0consoleerrors; artifacts/t05/focus-browser-red.json. Implementingrouteinvalidation+explicitmeasuredfocusintent; layoutindependent.

Task 5: fix1commita9d27a0 received. Covering18tests/webbuild+type+lint pass; actualdelayedHTTP remote-focus/repeatedsame-step browser GREEN andlayoutdragviewportunchanged,0consoleerrors. /root/t05_rereview (gpt-6.1-sol high) dispatched prebuilt2dc95d7..a9d27a0 scopeI1/I2+newfixbreakage only. MinorM1remainsT07deferred. No suites rerun bycontroller.

Task 5: fixround1/5 (I1/I2 addressed,0 open; commits2dc95d7..a9d27a0). Fresh /root/t05_rereview clean/no newbreakage, M1deferredT07 only.
Task 5: complete (commits8f2e32e..a9d27a0, reviewclean). Initial165tests/14files +fix18coveringtests/actualfocusbrowser passed; implementedbuilds/types/lint andactualsource/plan/approval/export/verificationUI, screenshotviewing passed. T06MCP/T07deferred/T08wholeproduct/nativeCI stillpending.

Task 6: activeimplementer /root/t06_mcp (gpt-6.1-sol high), base3b67ab8. Brief+context refreshed; actualSDKstdio +sharedHTTP/persistence/approvalbaseline gates,16tools, noapprove. No otherimplementation active. Fullrootbuild/type/lint possibleoncerealMCPdone, fullsuiteoncebeforeinitialcommit. NativeclientGUI+extensivebrowser/CI stilllaterexplicit.

Ruling: T06plan tools require explicitprojectId+planId andcheckownership; propose_plan createsdraft thenupdatesoperations viaexistingHTTP, partialfailure returnscreatedPlanId/revision ratherthanfalseatomicity. Routes/groups/policies locallypagedwithtotals; routesgetstaleflagfromcurrentsnapshot withoutmutatingknowledge. Reason: explicitscope/sharedexistingservice,no newAPI/database. Cost if wrong: additiveadapterresponse/schema refinements, nonatomicdraft mayneedusercleanup; regressionmustexposerecoveryid. Implementer proceeding.

T07 pre-dispatch requirements clarified: acceptedtempnodeedit/undo inspector +copylocation mustrefresh(M1); missing-targetannotations retainedandvisible. Directorypurpose/constraint edits mustrequire renewedapprovalevenwhennoexplicitedgeviolation, perMVPspec119/READMEconfirmationsemantics. CurrentKnowledge.savePolicy onlystorespolicy; currentvalidation catchesviolationsbutcontextonlychangesneednarrowservice/contractdesignrulinginT07, no sourcefixnow. Addedplantestscopebeforedispatch.

Clientdocpreflight controllerreadonly: installedCodexCLIavailable; ClaudeCodeCLIabsent. Officialcode.claude.com/docs/en/mcp anddevelopers.openai.com/codex/mcp eachcurl--fail403proxy (2026-10-02 23:08UTC), no retries/insecureflags/clientinstall/globalconfig. T06 implementer notified, actualSDKstdio isgate; nativeclientGUIs remainunrun withofficiallinkexamples.

Task 6 TDDmilestone: actualcompiledHTTP/API started; SDKstdio spawnedabsentcompiledMCP fromunrelatedcwd, RED discoveryConnectionclosed/MODULE_NOT_FOUND.10behavior tests nowwrittenincludingrealconcurrentHTTPedit nonatomicproposalrecovery. Productionclient/server/CLIimplemented, firstfocusedGREENrunning. No successclaimuntil actualoutputs/review.

Task 6 iterationmilestone:9/10actualSDKbehaviorpass; malformedstdioinput leftprocessalive becauseSDKcloseonlypausesstdin andparentpipeopen. Agentactualstandaloneprobereproduced, shutdownnowdestroysstdin; focusedGREENpending.
Cloudrepositorypreflight controller: full/workspacetraversal2188directories completed,1actualrootAtlasMode, sanitizedGitHubidentityhuiyuanXP/AtlasMode, fullHEAD726fd64dfe65efc3e33ae70e6f2e147868a31a9e;7npmworkspacelinksinternal,nootherroots/failures/escape/submodules. /tmp/atlasmode-workspace-checkouts.json. Mustrepeatafterfinalchangesbeforefullrepositorydraftmembershipsave; localonlyfreshrestorationblock remains.

Task 6 finalfocusedmilestone:11/11actualstdio tests10.79spass, actualAPIrestart+persistencesameapproval/route/group andmalformedstdin+activeHTTPshutdown regressionRED/GREEN. CancelpendingHTTPonSDKcloseanddestroyinputstream. Rootfullbuild/type/lint/fulltestONCErunning, no manifests/lock/APIchanges. Parentdocsaf56778/726fd64acknowledged inassigned3b67ab8reviewrange.
T08context nowexplicitofficialWindowskillbehavior/concreteoldtestlines(109/137CLI,145/178dev) andsuggestscontrolledrealhandlerprocessprobevsactualOSforcekill, no fakeproductionIPC/no nativepassclaim. FreshCI mustbuildcompiledmodules beforeactualSDKtests.

Task 6 verificationmilestone: rootallworkspacebuild/type/lint exit0,fullcurrentnpmtestONCE177/15files11.57spass,focusedactualSDKstdio11/11in10.79s, selfreview/smokeprocesscleanupdone. Awaitlocalcommit/reportthenfreshspec+qualityreview; no gatepassclaimyet.

Task5fixparentvisualevidence: actuallyviewed artifacts/t05/focus-remote.png andfocus-repeated.png; selectedrealfunction centered/readable, routecontrols/sourcevisible, no additionalCritical/Importantvisualfinding. No newfunctionaltest/suiterepeat.

Task 6: implementation7f7bd95 received, exactreport11SDKtests+177currentfull/allworkspacebuild,type,lint pass. /root/t06_review (gpt-6.1-sol high) dispatchedreviewpackage3b67ab8..7f7bd95 (3commits/parentdocsonly included). Awaitspec+qualitygate, no T07implementer. State updatedfullbuildactualevidencebutwholeproductT08stillunclaimed.

Clouddraft fullbuildrecipe updated afteractualT06checks: readrev7 first, updateinstallscript strictNode/npm/Python>=3.10+npmci+fullrootbuild; start_skill exactbootstrap/resume/actual177+11SDK+UIevidence/stdio/client/native/offline/restorationlimits. Savedconfirmed, notpublished/applied; omittedrepository/network/env/secretsmembershippreserved. T06reviewpending/T07T08unfinished explicit.

Task 6: review /root/t06_review speccompliant/qualityApproved,0Critical/Important.
Task 6: minor(deferred): M2 apps/mcp/src/client.ts58 body-read deadlineexpiry mislabeledAPI_INVALID_RESPONSE vsAPI_TIMEOUT; actualstalledbodyprobeconfirmed. CarryT08transportacceptance andfinalwholebranchreview, nofixloop.
Task 6: complete (commits3b67ab8..7f7bd95,reviewapproved).11actualSDKstdio/persistence/transport plus177fullsuite/all7build/type/lint pass. NativeclientGUI/Winmac/comprehensiveT08stillunrun.

Task 7: activeimplementer /root/t07_features (gpt-6-astra high), base45b75d3. Regeneratedbrief+contextincludesEnglish/groups/policies/semanticundo/projectlateisolation/M1andlostannotations. Narrowknowledgeapprovalstrategy mustbeproposedbeforecontractchanges; parentwillrule, nohumanwait. No otherimplementationactive, T06minorM2reservedT08.

Ruling: T07normalizedmeaningfulgroup/policywrite transactionallysavesknowledgeandbumpsallcurrentplansinthatproject revision/statusdraft/time, no Plan/Approvalschemaextension. Existingrevisionguardsrequire renewedconfirmation; preservehistoricalapprovedPlans/approvals. Setduplicates/order/pathseparators normalize; source-only/noop no bump, newrecordsmeaningful; routes/view/otherprojects untouched. Reason: smalleststableway tobind confirmationtonewresponsibility/constraints/groupdesign withoutnewmigration; Planhash remainscontent,revisiondistinguishescontextchanges. Cost if wrong: conservativewholeprojectreconfirmationmayannoy, historicalknowledgecontextnotfullyreconstructible(laterknowledgeversiontask); knowledge+planmultiwrite rollback/regressions required. Agentproposalapproved; narrowT06integrationexpectations maychangefornewgroupinvalidation, noMCPproductionchange. FocusedKnowledgePanels/history.tsapproved, orchestrationretained.

Task 7 TDDmilestone: actualRED purpose-onlypolicy/groupchangesleftapprovalvalid→GREEN6service afteratomicrevisionbump. Selectedtemporaryinspector staleRED→GREEN14controller/history inclacceptededit+undo/redo revisions4→5→6→7. Typedlocale/knowledgeUIactive, rollback/browserchecks pending.
ParentREADMEb5f3c2d nowworkingquickstart+T06actual177/checkstatus andquestionnaireoverrides(Python/multiproject) insteadstaledesign-onlyclaim; fullT08status/native/uncompletedexplicit. Existingproductspecpreserved; rootREADME/docscoverageonly,parentneverproductfix.

Ruling: T07groupmember bindingusesexistingcontextendpoint onlyfor20visiblememberpage, limit1/boundedconcurrency4, guardedgroup/page/project/snapshotgeneration. HTTP404currentbindingmissingretainsid; othererrorsshownhonestly, neverinferdeletionfrombudgetedabsence. AuthoritativePlanDetailissuesdetermineannotationlostbinding. Reason: existingvalidatedAPIwithboundedlookups,no fullsnapshot/newbackend. Cost if wrong: perpageHTTPfanout/SQLiteparseoverhead; laterbatchmetadataendpointifmeasurementsjustify. Implementerproposed/approved.

Task 7 milestone:41focusedtestsGREEN/all7rootbuildpass. Memberlookup20page/concurrency4/limit1+snapshotchecks, missingannotation actualINVALID_TARGET/operationIndex retainedthroughtempdelete. ActualbuiltChromiumsmokeisolatedport4327starting, finalfullsuite/type/lintpending.
Ruling: T07controllergrowth~500→646lines acceptedcohesiveproject/requestcoordinator after scopedknowledge/history additions; purehistory/memberreadhelpers+panels owndetails. Reason: oneclearasynchronouslifecycleresponsibility, avoidarbitrarysplit. Cost if wrong: futurefocusedcontrollerextraction, independentreviewmayidentifyrealcoupling/duplication; structurestillreviewable. No parent sourcefix. Lostannotationerror mustremainvisible/actionable, no silentdelete/falseapproval.

Deliveryprep: afterfinalcommits/reviews, controllercancreate+verifyignoredGitbundle forlocalcommittedsource/history because no remotepushauth andclouddraftlocalonlyrestorationunverified. Notdoneyet/notfreshrestoreclaim; noextra sourceimplementation. T08contextnotescontrollerownership toavoidstaleartifact.

Task7parentvisual: actuallyviewed artifacts/t07/light-zh.png,policy-dark-en.png,inspector-dark-en.png afterbrowser-smoke.logPASS (locale/theme reload,2sharedgroups,membermetadata,undo/redo,policyreconfirmation/forbiddenedge,tempinspector+copyafteredit/undo,consoleerrors[]). Readablethreepanes/statecues,0newCritical/Importantvisualfinding. MinorcachedEnglishclipboardnoticeinzh screenshotreportedimplementerfornarrowi18nresetbeforecommit, nofullflowrerunrequested. Stillfinaltests/reviewpending.

Task7actualbrowsermilestone PASS/console[]: locale/theme reload,sharedgroups,members,titleundo/redo,policycreate+purposeonlyreconfirm,forbiddenexistingedge,acceptedtempedit/path/signature/copylocation+undo. Browserpopulatedpolicylabels repaired. ParentMinorclipboardnotice nowtranslationkey; otherdynamicnoticeskeys too. FIRSTfullsuite190pass/1oldreopenexpectationfailed (expectedstillapprovedaftergroup+policy). Contractauthorizedupdate r4draft/historicalr2 preserved, targetedlifecycle24GREEN. Finalfullrerun justified priorFAILED+newlabels/lostbindingchecks; no repeatafterpass. Agentfinishinglostbindingbrowser/rootchecks/report,4327cleanuprequired.

Task7implementation88c1096 received:final192/18files/all7build+type/lint pass, lostbindingbrowser/groupannotationexport/locale-noticePASS, atomicmulti-planrollbackPASS,6screensviewed,own4327stopped/portrefused. /root/t07_review (gpt-6-astra high) dispatchedprebuilt45b75d3..88c1096 4commits/3parentdocsonly. No newimplementerbeforegate, no suitesrerunparent. Sessionhistory50perplan/20plans explicit, historiesnotreconstructedafterpagereload; historicSQLitePlan/Approvalretained.

Task7review /root/t07_review: qualityApprovedwithMinor,0Critical/Important, speccorecompliant/minorlocalizationgap; independentfinal3screensviewed/noC/Ivisualissue. Clipboardevidence interceptedwriteTextpayload, notOSclipboardintegration.
Task7minor(deferred M3): workspace.ts105translatedretry/conflicthelpstoredinerrorretainsoldlocale; memberBindings.ts31/workspace557snapshotmismatchhardcodedEnglish. ReviewerlocalM1renamedledgerM3toavoidT05M1confusion. CarryT08relatedlocale/erroracceptance+finalreview, neverdiscarded.
Ruling: T07nonblockingminorlocale-onlyspecgap acceptedtaskmilestoneunderApproved/0C-I rubric, requiresT08targetedfixbeforewholeMVPclaim. Reason: noCritical/ImportantfixloopforMinor, nextrelatedticketalreadyownsfullUIacceptance. Cost if wrong: localizederrorhelp remainspartialuntilT08; publicstatusmustnotclaimfullquestionnaireacceptancebeforefix.
Task 7: complete (commits45b75d3..88c1096, reviewApprovedwithMinorM3carriedT08).192tests/18files+all7build/types/lint/browser/lostbinding/rollbackpass; source/tempM1fixed, T06M2+T07M3stilltargetedT08. No nativeGUI/Winmac/wholeproductE2Eclaimyet.

Task 8: active implementer /root/t08_acceptance (gpt-6-astra high), base d3a3b152b3f4f463ab6a97a478140151a8e48031. Fresh task-8 brief/context read; exact M2/M3 regressions reproduced. Owns full current production/CI/browser/MCP acceptance and narrowly observed repairs; controller owns cloud recipe/membership and final portable bundle. No second implementer; no parent source fixes or duplicate passed checks.

Task8 milestone: M2/M3 focused21/4files pass, real stalled-body30s timeout; portable real-handler+UnixOSsignal10/2process tests pass; compiled production HTTP/SDK TS+Python/noexecution/restart smoke passed. Full browser and mature targets remain active, native runners unrun.

Ruling: T08 observed UI reconnect cannot choose already-searched reusable B when B is outside bounded graph.nodes; allow deduplicated current-snapshot loaded entry/search facts as editor candidates, retaining service validation and readable accepted endpoint. Reason: required actual A-to-B reconnect cannot complete with graph-only candidates; no new API/indexing/unbounded snapshot. Cost if wrong: candidate-lifecycle or endpoint-display repair; regression must cover absent-from-graph target and project/snapshot isolation. Sole active T08 implementer owns focused RED/GREEN.

Cost clarifications for existing rulings (no change to decisions): continuous execution (original line26) risks reversible rework if autonomous defaults differ from user preferences; sequential SDD (line28) costs review latency/context but preserves a single implementation owner; route edge rules (line33) may reject older loosely specified Agent routes and require their resubmission.

T08 environment recovery 00:41UTC: managed instance connected, checkout/dirty source and evidence preserved; collaboration lists only /root, original worker unavailable. T01–T07 remain complete. Joint browser final1PASS, Vite+Flask product gates PASS recorded; full clean CI/docs/report/commit unfinished. Prepared task-8-resume-context.md; fresh replacement resumes partial T08, never resets or repeats completed tasks. Runtime skill/policy inspected; proxy/trust preserved, runtime network enforcement observation unknown.

T08 parent actual visual inspection: viewed preserved Vite/Flask product and source screenshots; detail/source readable, but mature center overview tiny and Vite still Working. Current validation script contains newer focused-node width>200/in-viewport/idle assertions not proved by old images. Resume implementer independently confirmed and owns changed-harness target recapture (specific evidence gap, not duplicate indexer benchmark); final parent must view corrected images. Latest joint result r16/hash0e88b0ef per preserved evidence, recovery note r14 was earlier stage only. Clean npmci/build passed per resume milestone, types/lint/fulltest underway.

T08 resume verification milestone: npmci410packages/build7/typecheck7/lint exit0, current full200/20files0skips40.01s, persisted production smoke PASS. Changed mature visual harness both actualexit0 Vite4651ms/Flask1740ms; priorcaptures retained. Parent actually viewed corrected Vite/Flask/settleddark images: selectedfunctions readable, source/call panels visible, footeridle,0newC/Ivisualfinding. Docs/selfreview/report/commit pending; no taskreview or wholebranchgate claimed yet.

Task 8: implementation complete, independent review pending (base d3a3b152b3f4f463ab6a97a478140151a8e48031; commit 5b22868fdd11e0a8d599b2ba5494a51addd51c49; clean npmci/build/typecheck/lint/test/smoke exit0; tests200/20files0skips; preserved actual browser1/1; final fixed Vite/Flask product captures PASS after focus/idle wait). Exact evidence/limits: task-8-report.md. No push/publication/native Win/mac claim.

Task8 implementation5b22868fdd11e0a8d599b2ba5494a51addd51c49 received from fresh recovery /root/t08_resume: clean tree, exactreport200/20files0skips +all7build/type/lint/smoke, preservedjoint1PASSr16, correctedmaturebothPASS/viewed. Original base d3a3b15 includes controller-only docsinterleaved. Generating initialreviewpackage, fresh task reviewer next; no taskcomplete/wholeMVPgate claim until verdict. No suitesreruncontroller.

T08 initialreview milestone /root/t08_review: Important Windows test-harness loader risk confirmed by focused Node24.19 raw C-drive --import probe ERR_UNSUPPORTED_ESM_URL_SCHEME. Locations tests/support/production.mjs +apps/server/src/{dev,index}.test.ts require pathToFileURL(resolve(...)).href. Awaitcompletefindings/verdict beforefixdispatch; no controller sourcefix, nativeWindowsstillunrun.

Task8 initialreview /root/t08_review: specissue/Needsfixes0Critical1ImportantI1 rawWindows --importpaths,1Minor. Originalrecoveryimplementer /root/t08_resume resumedfixround1/5, FIX_BASE5b22868, all3locations+realpreloadloader regression/actualprocess10tests+smoke/coveringtypeslint, no broadrepeats. Freshscopedrereviewaftercommit.
Task8 minor(deferred M4; reviewerlocalM1): validate-repository.mjs25 validatesHEADbutnotdirtyworkingtree, so modifiedtargets couldbe mislabeledfixedcommit. No evidence recordedtargetsdirty; deferfinalwholebranchtriage, neverdiscarded/noMinorfixloop. Currenttargetcleanstatus canbereadwithoutindexer rerun.

M4 namedread-onlyevidence01:00UTC: bothactualtargetsgitstatus--porcelain--untracked-files=all EMPTY, exactHEADVite10033218d239c927cdc375970b5741cce408e81b/Flask22d924701a6ae2e4cd01e9a15bbaf3946094af65. Existingfixedtargetevidence notshownwrong; missingfutureguard remainsdeferredminor forwholebranchtriage, notdismissed. No targetcode executed/no indexrerun.

Task 8: fix1 I1 encoded all3preload module specifiers as file URLs (commit 24a6d760fe7c4bfb1c80cd7a0fcc7495fb7cfa45); real space/hash checkout loader regression RED→GREEN1pass, existing lifecycle10pass, actual smoke/types/lint/syntax pass; no unchanged fullsuite/browser/target reruns. Native Windows unrun; scoped re-review pending. Exact task-8-report.md appendix.

Task8 fix1commit24a6d760fe7c4bfb1c80cd7a0fcc7495fb7cfa45 received: all3URLpreloads,actualspace/#productionloader RED→GREEN,10CLI/devprocess checks+1newloader/smoke/coveringtypeslintsyntax PASS. Initialfull200 remains pre-fix; no unsupported201fullclaim. Fresh /root/t08_rereview(gpt-6.1-sol high) dispatchedprebuilt5b22868..24a6d76 scopeI1+newbreakageonly; M4deferred, nativeunrun, no controller/source/suiterepeats.

Task8 fix round1/5 (I1 addressed,0open; commits5b22868..24a6d76). Fresh /root/t08_rereview alladdressed/no newC-I; M4 remainsdeferred.
Task8⚠ resolution: nativeWinmac/client/remoteCI/freshrestore explicitlyunrun andnotclaimed; unchangedcore/service/ports havecompletedT01–T07independentreviewpluscurrentrootboundarylint/build evidence, no newcore/servicecontractinT08. Fullcross-taskreview stillnext, no unresolvedreal taskgapidentified.
Task 8: complete (commitsd3a3b15..24a6d76,reviewfix1clean,M4deferredfinaltriage).200initialfull +11coveringprocess/loaderfix checks,all7build/type/lint/smoke/jointUI-SDK/maturefinal/viewedscreens passed. Startwholebranchgatefromoriginal944b48c, mostcapableavailablegpt-6-astra; no newREADMEimplementerbeforegate.

Whole review: be10c84; 0C/4I/2M, With fixes. WR-I1 exclusion false removal; WR-I2 foreign HTTP authority/origin; WR-I3 cross-file name-only reuse; WR-I4 mutable TS/JS initializer edge; WR-M1 fixed target provenance; WR-M2 compatibility uncertainty. All accepted for ONE complete fix wave, then ONE scoped independent re-review. Prior M1/M2/M3 and T08 preload repair independently verified closed.
Ruling: accept all six whole-review findings and repair them together before the MVP gate. Preserve conservative unknown evidence, genuine deletion/explicit moves/local UI+MCP, nonblocking compatibility warnings and existing clean public-target evidence; do not implement future tsconfig/workspace/migration/runtime work. Cost if wrong: additional conservative unknowns/warnings or local proxy restrictions may require targeted adaptation, while untouched mature target evidence remains bounded to its actual clean runs. Parent dispatches one most-capable implementer and one scoped re-review per final-wave rule; no source fixes by controller.
Whole review declined scopes: all16 lines adjudicated as declared future capabilities, explicit unrun native/client/publishing checks, documented historical/session limitations, target/static/runtime distinctions, bounded review limits or duplication restrictions. None excuse the accepted four Important trust-boundary findings; compatible-call uncertainty was not excluded and is included WR-M2.
Ruling: approve optional coverage.availability {complete:boolean, unavailablePaths:string[]} for bounded scan eligibility evidence, fingerprinted but not source counts, with no new IndexerPort/DB table. Legacy missing metadata stays readable and insufficient absence evidence is unknown. complete is scoped to the supported source-analysis universe; always-excluded dependency/Git/workflow trees must not erase genuine eligible-source deletion proof, while newly ignored/unreadable/symlinked baseline paths/subtrees must. Reason: shared factual metadata lets all consumers avoid false negative-evidence success without service disk access. Cost if wrong: conservative unknowns may need narrower availability categories; added snapshot identity can stale old baselines once, but source IDs and history must remain intact. Worker must prove genuine deletion control and document exact scope.
Ruling: refine approved availability with optional excludedPaths for fixed out-of-scope subtree roots, separating them from otherwise eligible unavailablePaths. Direct target-path checks consider both; global relocation/absence searches consider in-scope unavailability/completeness, not always-excluded Git/dependency trees. Reason: explicit planned targets under fixed exclusions need honest unknown without making all ordinary deletion proof impossible. Cost if wrong: one small optional contract field may need category refinement, no DB/port change; genuine deletion and excluded-target controls required. WR-I2 explicit dev-proxy mode belongs only to dev launcher, production authority/origin stays strict and local origin-less MCP works.
Whole review declined adjudication: whole-declined-adjudication.md records16 separate rows, matching review order, with explicit decisions/reasons and wrong-boundary cost; no excluded capability silently credited.
Controller visual check01:49UTC: actually viewed final-wave artifacts/e2e/compatibility-warning.png and narrow.png. Two visible COMPATIBILITY_UNKNOWN warnings coexist with enabled confirmation; fact/planned/reference cards remain distinguishable. Narrow760 editor is below canvas and graph labels require zoom; accepted documented desktop-first boundary, no mobile-perfect claim. Worker reports all warning/light/dark/narrow/source views.
Whole review single fix wave: 56e7f6f6be10072d5dc65e8035bd9add6d1aeddf, workerDONE_WITH_CONCERNS only evidence limits; all six findings implemented. Full integrated220/22 executed218pass2request-harness failures; corrected focused2pass and enhanced real-process1pass. No product changes after full run; build/types/lint/smoke/joint browser1pass actualwarning+r16/clipboard/restart/three-state; controllerview warning/narrow. No second full220-green claim, unchanged mature targets not rerun. Sole scoped independent re-review next.
Whole review: clean — original944b48c..be10c84 plus the ONE final fix wave56e7f6f and sole scoped whole-rereview.md; allWR-I1–I4/WR-M1–M2 ADDRESSED,0newC/I/M,0out-of-scope newobservations. Each previously declined scope separately adjudicated. MVP milestone accepted at its explicit Linux/static/SDK/native-unrun evidence bounds. Continue prepared captured-tsconfig plan, do not finalize/stop until user requests wrap-up.
Finish milestone: retain local work branch/current isolated checkout by existing continuous authorization; no merge/push/publish/global client configuration. Persist all25 Ruling lines plus wrong-decision costs before scratch cleanup; archive reports/logs and a verified source-history bundle. This is a milestone handoff, not completion of the user's ongoing night build.
