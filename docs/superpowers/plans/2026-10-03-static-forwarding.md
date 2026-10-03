# Static CommonJS forwarding safety implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL superpowers:subagent-driven-development; two sequential tasks, independent gates, no worker helpers.

**Goal:** Add verified single relative forwarding identity without restoring false bindings; use actual pinned Express entry acceptance.
**BASE:**6c2fc16268ffd523fb40577ed9075dbb393531ec, closed CommonJS archive. **Spec:** docs/superpowers/specs/2026-10-03-static-forwarding-design.md.
**Architecture:** validated captured require records feed bounded alias groups; all existing cycle/lexical/consumer mutation guards precede public entries/calls. HTTP/MCP/UI consume unchanged snapshots.
**Tech:** Node24.19/npm11.9, TS5.9.3/ts-morph27.0.2, existing SQLite/HTTP/SDK/React/Playwright; no deps.

## Global Constraints

- Node24.19.0/npm11.9.0/Python>=3.10，现有TS5.9.3/ts-morph27.0.2；不新增依赖、改lockfile/vendor。
- 使用当前隔离checkout顺序SDD；无push/publish/全局客户端配置；实现者不派助手或审查者。
- 只处理捕获字节、AST和已捕获checker声明；不执行目标代码、require、插件、脚本、upstream或读取node_modules/root外/compiler真实FS。
- 当前包/配置预算、16层配置边界、ignore/allowedPaths/root/symlink/opaque scope保持；转发最多16边，17边拒绝。
- actual叶声明名称/路径/行/ID保留；imports为物理转发目标；v3字节hash不升版，旧snapshot/approval不重写。
- 中文默认/英文及只读源码保留；事实不足/动态/循环/escape为unknown，static resolved不等于runtime/build兼容。
- 每任务独立审查；任务修复最多五轮；最后ONE整体审查/ONE集中修复/ONE限定复审/逐项残留裁决。
- 已通过检查仅因改变/失败/具体疑点重跑；root内部重建dist，root/browser顺序；不重跑未改变Vite/Flask。


## Review Focus

1. 有效转发才能豁免namespace escape；conditional/repeated/rewritten/modeunknown/invalid-chain仍拒绝，不能由checker叶声明回绕。
2. alias、leaf及另一消费者共享已知属性拒绝/wholeinvalid，ESM导入同样守护；named.default和callable Symbol不混淆。
3. 16边正例/17边拒绝、自环/多环及leaf再require root的SCC回边；source/遍历顺序无关、终止、无递归loader。
4. 相同真实输入的新facts产生不同snapshotID而v3 contentHash/声明ID保持；actual历史/approve/routes受旧基线约束。
5. 全固定Express gate必须真实检查入口，不窄化target、不把诊断副本当接受；原FAILED状态、原Important退出缺口及所有UNRUN保留。


### Task 1: Guard and resolve the exact forwarding subset

**Files:** Modify packages/indexer/src/commonjs.ts, commonjs.test.ts, index.test.ts, docs/superpowers/contracts.md. A new private pure identity-graph helper is optional only after a concrete controller-approved split proposal; do not change core/service/storage/server/ports/hash/mode provider.
**Consumes:** existing Module/Binding, validated literal require records and private cyclicInitialization, actual implementation declaration IDs; existing mode/config alias guards.
**Produces:** private validated alias identity groups/canonical leaf and shared rejection; createCommonJsAnalyzer returns SAME exportedDeclarationIds/classifyCall/moduleImports; indexTypeScript fifth mode hook unchanged. Binding retains physical module and cycle flag; imports retain physical target/evidence.

- [ ] **Step1 RED:** Real SourceIndexer plus registry fixture must currently fail two-hop exposed entry/call to actual leaf implementation. Capture actual preimplementation baseline on identical fixture bytes for later facts/snapshotID/contentHash/declaration-ID comparison; no fixture execution/fake oldbinary. Object/function/default/named.default positives and unsupported controls.
- [ ] **Step2 Implement:** Recognize only single unshadowed top-level module.exports=require(one relative literal) with captured validCJS target and no other exports/module.exports writes. Static ['exports'] equivalent permitted. Validate after require-cycle data ready; a cyclicInitialization forwarding edge never gains an escape exception. Directed chains at most16edges; cycles/self/17reject. Existing callable/object leaf subset preserved; no valueflow/varlet/property/external/dynamic/conditional/chained-exports forwarding.
- [ ] **Step3 Shared safety:** Collect all alias/leaf/otherconsumer/ESM knownproperty writes and module-wide unknown writes/escape before exposed IDs/call classification. Propagate across validated identity group, with other stableproperty preserved for known-only rejection. Invalid forwarding uses original escape guard; no checker-only leaf recovery or duplicate/renamed Fn nodes. Import relations remain real physical files/path/line/text; callable Symbol versus nameddefault strict.
- [ ] **Step4 Controls:** Two-hop and16positive;17/cycle/self and forwarder→leaf→ordinary-require-back root SCC negatives; source order; lexicalglobalrewrites/modes/opaque/excludedleaf/repeated/conditional/external/dynamic/varlet/propertyforward rejects; crossalias/leafmutation/escape/ESM bypass; unaffected component/local recursion. Retain all110 current registry/whole cycle cases and config/package/Python/const identity regressions.
- [ ] **Step5 Verify/commit:** Focused then all affected indexer/core tests, builds/typechecks androotlint on final source; no fullroot/browser/targets yet. Compare authentic samebytesold/new snapshotfacts without hashversion change; preserve sourceIDs/history assumptions. Document exact limits/self-review/coherentlocalcommit/full report, await fresh independent gate. No worker reviewer/helpers.

### Task 2: Real transport, source UI and strict complete-Express entry gate

**Files:** Create tests/support/forwarding.mjs, tests/integration/forwarding-resolution.test.ts, tests/e2e/forwarding.spec.ts. Modify scripts/validate-repository.mjs (narrow opt-in require-entry boolean), README.md, docs/environment.md, docs/superpowers/validation-targets.md, readme-coverage.md, state.md; no new productUI/service/schema tool unless actual missing behavior/RED is proved and controller rules ownership.
**Consumes:** existing actual compiled HTTP/officialSDKstdio/SQLite, Task1 facts/IDs and same unchanged endpoints. Validator actual sampled node and actual entry IDs/truncation; old generic commands still supported.
**Produces:** unchanged public product plus recorded forwarding lifecycle/browser/source/nonexecution proof, unique express-static-forwarding-product JSON/png with explicit criterion outcome. No stale snapshots/approval rewrite, no MCP approval tool.

- [ ] **Step1 actual lifecycle:** Disposable real source/store; caller requires two-hopbarrel and calls leaf function, physical import versus actual leaf context matchesHTTP/MCP. Create/approve plan+call_chain route; change onlyalias destination to another already-present leaf, refresh; allleaf declarationIDs/sourcebytes remain stable, plan/route stale and approval/history/operations preserved. Readonly leafsource/path/line/name actual; unknownunsafe alias fixture remains unknown. Backend may alreadyGREEN, record honestbaseline. Sentinel file absent, protocolstderr/errors empty, stop/reopenactualSQLite unchangedhistory.
- [ ] **Step2 actual browser:** Supported entry→leaf, unknownreason, Chinese/English originalsource and copylocation; deny nonloopback, collect console/pageerrors, actuallyview screenshots. Do not createUIchanges without genuineRED/missing behavior. Existing root/browser MUSTsequential, no duplicateoffline-routing blocks.
- [ ] **Step3 strict target:** Add opt-in require-entry assertion to existingvalidator; sampled createApplication MUSTexported=true and returned actualentryIDs mustcontain sample, accounttotal/truncation. ONEnew full pinned Express5.2.1 dbac741a49a5a64336b70c06e85c2e2706e36336, cleanfullHEAD+untrackedbefore/after, symbolcreateApplication,filelib/express.js,line36. Unique label express-static-forwarding. Do not narrow fixtures/install/execute/upstream; genericexit0 notacceptance. If fail, preserveactualreason/status and sendcontrollercontext, no blindrerun/unlimitedwidening. Old Express originalFAIL and genericPASS, Vite/Flask historical unchanged.
- [ ] **Step4 final checks:** Onefinal7workspace build/typecheck/rootlint/test thennewintegration/browser (or integration includedroot, no passingduplicate); no unrelatedplanningbrowser repeat withoutactualchangedUI/failure/concrete need. Record finalamendedsourceSHA/exactcounts/times/rawlogs andpriorartifacts preserved, actualownedprocess/tempstore cleanup notSDKpidnull inference. Hostwarning/originalImportantcause/nativeplatform/realclient/remoteCI/freshrestore limits retained.
- [ ] **Step5 docs/commit/gate:** ExactnewstrictExpressoutcome/currentstaticbounds, samebaselineidentity/immutablehistory, no runtimecompatibilityclaim; self-review/coherentcommit/fullreport/freshindependenttaskreview. Controllerfinalwhole review BASE6c2, ONEcombinedfixwave+ONEscopedreview thenresidualrulings/allindividualdeclinedcosts andexhaustive50+new decisions savedbeforearchive/delete. Continuoususerwork notendedbyphaseclosure.

## Plan self-review and producer/consumer preflight

Task1 owns one private registry pipeline and shares no public change withTask2. Current Binding.cyclicInitialization is privateproof andmustsurvivecanonicallookup; physicalimport evidence isnotcanonicalFnidentity. Existing facts fingerprint/service/route snapshotID comparison covers same-byte newanalysis; v3 unchanged. Task2 consumes exact same schemas andbackend; validatoropt-in is the explicitmissingcriterion, oldcommandsretainbehavior. No code writers overlap; initialgoal/designself-reviewed underunattendedauthorization. Freeze Task2 preflight again against actual Task1 helper/interfaces after its independentgate. No additional spec/plan reviewer, no premature implementation or acceptance.
