# 无人值守首轮决策记录

状态：T08 和整体审查进行中；本文件记录决策，不代表验收完成。

按实际 ledger 顺序逐项保留代为选择及判断错误时的代价。用户明确要求的范围也保留，以便复核其落实方式。

1. 首轮按问卷增加 Python、多项目切换、英文、分组、目录约束和历史。 代价：若范围理解偏差，需要可回退的模型和界面调整。
2. 无人值守期间继续执行，自检和独立审查取代逐阶段人工等待。 代价：默认选择与用户偏好不一致时，需要返工；不包含发布授权。
3. 使用云任务已有隔离 checkout，不再创建 worktree。 代价：修改留在本地 work 分支，需要用户之后选择整合方式。
4. 顺序执行 SDD，每任务新实现者和独立审查；实现者不另派助手。 代价：增加审查等待和上下文成本，保持单一实现所有者。
5. call_chain 后续步骤必须引用上一节点到当前节点的真实 resolved 调用；walkthrough 的可选关系必须接触对应节点。 代价：较宽松的旧 Agent 路线会被拒绝，需要重新提交。
6. 创建规划可指定基线；MCP 提交规划必须指定基线，拒绝不一致。 代价：旧调用方可能需要增加基线参数。
7. 批准和核对先实际刷新；MCP 读取当前批准也先刷新，网页普通浏览仍显示上次索引。 代价：增加索引延迟，并需要适配异步 service 调用。
8. 源码读取由 indexer 的可选 readSource port 负责；service 只委托。 代价：注入式 indexer 适配器可能需要新增读取方法。
9. 实际索引/存储的生命周期集成测试放在根 tests/integration，保持 service 的依赖边界。 代价：仅影响测试归属位置。
10. indexer 包显式包含 dist 和 Python helper，确保打包后可运行。 代价：需要随包结构更新清单；没有新增依赖。
11. 快照 ID 同时包含稳定分析结果/诊断/覆盖，源码 contentHash 保持字节摘要；观察时间、Git 和根目录不参与事实身份。 代价：解析能力变化时基线和路线需要刷新；历史快照保留。
12. 分页/预算图查询放在纯 core；上下文50/200，子图80/300节点、关系3倍预算；入口为最多50个候选。 代价：未来调整分页或预算时需要同步客户端契约。
13. Python 默认入口只使用公共顶层定义；TS/JS 使用显式导出，均标注候选依据。 代价：部分公开类方法需要通过类或搜索进入，未来可增加框架证据。
14. dev 启动器直接运行固定 TypeScript CLI 构建五个前置包，拒绝不符合已知脚本的配置。 代价：未来自定义构建脚本需要明确更新启动器。
15. MCP 增加分页 list_projects 和仅创建 Agent 来源的 propose_group，仍由共享 service 验证。 代价：增加两个适配工具契约；高级分组操作另行实施。
16. 拆分导航与规划面板，保留负责请求生命周期的协调控制器。 代价：未来界面变更可能需要调整组件参数。
17. MCP 操作明确检查 project/plan 所有权；提交规划为创建后更新，失败返回保留草稿 ID/revision；列表明确总量和截断。 代价：部分失败可能留下需要清理的草稿，响应契约可能需要扩展。
18. 有意义的分组/目录约束修改与该项目所有当前规划 revision 提升、恢复 draft 在同一事务中完成；历史批准不变。 代价：重新确认较保守；历史知识上下文仍不能完全重建。
19. 分组成员每页20个，用已有 context 查询、并发4；404 和其它失败分开，失联注释以 service 的 operationIndex 为准。 代价：每页有多次请求开销，必要时再增加批量元数据接口。
20. 保留约646行的项目/请求协调器，把历史、成员读取和面板职责放在专门模块。 代价：未来出现实际耦合时再做局部提取。
21. T07 的非阻塞语言提示问题带入相关 T08 修复，整体验收前必须解决。 代价：在 T08 完成前不能宣称问卷完整通过。
22. T08 改接候选纳入已加载、同快照的入口/搜索事实，并保留 service 验证和可读端点。 代价：可能需要修复候选生命周期或端点呈现；必须回归测试。

## 原始记录

以下逐行保留 ledger 的原文；原始未明确写代价的三项，在上面的对应条目补足。

原 ledger 第25行：

> Ruling: user questionnaire adds Python, UI project switching, i18n/groups/policies/history; spec updated before implementation. Cost if wrong: reversible schema/UI rework.

原 ledger 第26行：

> Ruling: continuous execution overrides per-stage human review waits by explicit user instruction. Independent code review still mandatory.

原 ledger 第27行：

> Ruling: no extra worktree because Codex Cloud isolation and AGENTS. Cost if wrong: local branch-only changes remain reversible.

原 ledger 第28行：

> Ruling: execute sequential SDD tasks with models explicitly chosen per skill. No implementation agent spawns helpers.

原 ledger 第33行：

> Ruling: call_chain step 2+ references incoming resolved calls edge previous→current with evidence; walkthrough supplied relation must touch its node. Clarifies contract without field changes.

原 ledger 第37行：

> Ruling: createPlan accepts optional baselineSnapshotId and rejects mismatch; MCP propose_plan requires caller baselineSnapshotId. Prevent stale Agent context silently binding to new snapshot; notify T03/T06. Cost if wrong: additive API compatibility adjustment.

原 ledger 第47行：

> Ruling: approvePlan and verifyPlan are async and refresh actual index before decisions; MCP get_approved_plan refreshes before getPlan, while UI manual snapshots remain explicitly last-indexed. Prevent unrefreshed filesystem mutation falsely approved, avoid service duplicate scanner. Cost if wrong: asynchronous service test/client adaptation, HTTP shape unchanged.

原 ledger 第48行：

> Ruling: IndexerPort optional readSource delegates code I/O/realpath confinement to indexer. T02 may add this optional port method in core; service only delegates. Cost if wrong: minor injectable port adaptation.

原 ledger 第51行：

> Ruling: T03 actual-adapter lifecycle tests may live in root tests/integration to preserve service import restrictions; unit ports remain injected. Cost if wrong: test file placement only, no production boundary change.

原 ledger 第56行：

> Ruling: T02 may add indexer package files:["dist","python"] because npm pack dry-run omitted dist via root ignore inheritance; packaged public entry and Python helper must work. Cost if wrong: manifest-only packaging adjustment, no dependencies/lock changes.

原 ledger 第78行：

> Ruling: deferred source-only snapshot-ID observation becomes load-bearing when T03 preserves immutable snapshots; fix it inside the single active T03 implementer rather than hiding new parser diagnostics under an old ID. Source contentHash stays byte-only; snapshot ID also uses deterministic analysis facts/diagnostics/coverage, excludes observation time/Git/root, unchanged content+analysis remains stable. Cost if wrong: opaque snapshot IDs change once and affected baselines/routes need refresh; product not yet launched. T03 brief/contracts updated, own minimal indexer index.ts/index.test.ts dependency fix authorized, no parallel implementer.

原 ledger 第100行：

> Ruling: T04 graph search/context/subgraph algorithms and public response types move into pure core queries.ts; server remains transport glue, matching README package boundaries. Function context is paged default50/max200 with separate incoming/outgoing totals; queries return snapshot/dataSource. Subgraph defaults calls, optional relation types, nodebudget80/max300 plus relationcap3*budget; budget clipping explicit. Summary exports are candidates, max50/total/truncated, no zero-indegree inference. Cost if wrong: additive HTTP/client adaptation before clients exist; adjust paging or edge budget later without rewriting facts. Plan/contracts/task4brief updated.

原 ledger 第107行：

> Ruling: Python exported flag is public-name convention, also set on nested declarations. T04 summary uses only public top-level file children for Python candidates, while TS/JS explicit exports remain candidates; disclose evidence basis, never runtime-confirmed entry. Avoid nested local helpers as fake module API without changing indexer. Cost if wrong: some public class methods require class/search navigation, later __all__/framework evidence can refine candidates. Implementer notified and query regression requested.

原 ledger 第122行：

> Ruling: T04 fix uses direct process.execPath+pinned TypeScriptCLI for five prerequisite scripts verified exactly tsc -p tsconfig.json, eliminating npm build descendants rather than adding native process-tree adapters. Guard changedbuildscripts tofailclearly, preserve orderedcwd/exitcodes/signals. Cost if wrong: future custombuild scripts require explicit devlauncher update; current scripts equivalent. Implementer instructed actuallivecompiler termination regression andreport guard/limit.

原 ledger 第127行：

> Ruling: T06 adds pagedlist_projects so a freshlyconnectedAgent discovers explicitprojectId ratherthan guessingbrowseractiveproject. Promote READMEpropose_group intoT06 because existingvalidatedHTTPgroupservice alreadyavailable; force sourceagent, newgroup only. Cost if wrong: twoadditional thinSDK toolcontracts and focused integrationchecks, no newstorage/serverstate; advancedgroupapproval/combination stilllater. Plan/backlogupdated beforedispatch.

原 ledger 第143行：

> Ruling: T05 purposefulpaneldecomposition approved afterformatgrowth App457/PlanningPanel487: appNavigation+WorkspacePanels andplanningFunctionForm+RelationEditor+PlanEditor; keepcohesive400-line scopedlifecyclecontroller, no newgeneralstateinterfaces. Cost if wrong: componentprops mayneedlateradjustment, no domain/API changes. SourcehandleobservedCSSfix pluscurrentbrowserrerunjustified; fullsuiteoncebeforecommit.

原 ledger 第168行：

> Ruling: T06plan tools require explicitprojectId+planId andcheckownership; propose_plan createsdraft thenupdatesoperations viaexistingHTTP, partialfailure returnscreatedPlanId/revision ratherthanfalseatomicity. Routes/groups/policies locallypagedwithtotals; routesgetstaleflagfromcurrentsnapshot withoutmutatingknowledge. Reason: explicitscope/sharedexistingservice,no newAPI/database. Cost if wrong: additiveadapterresponse/schema refinements, nonatomicdraft mayneedusercleanup; regressionmustexposerecoveryid. Implementer proceeding.

原 ledger 第196行：

> Ruling: T07normalizedmeaningfulgroup/policywrite transactionallysavesknowledgeandbumpsallcurrentplansinthatproject revision/statusdraft/time, no Plan/Approvalschemaextension. Existingrevisionguardsrequire renewedconfirmation; preservehistoricalapprovedPlans/approvals. Setduplicates/order/pathseparators normalize; source-only/noop no bump, newrecordsmeaningful; routes/view/otherprojects untouched. Reason: smalleststableway tobind confirmationtonewresponsibility/constraints/groupdesign withoutnewmigration; Planhash remainscontent,revisiondistinguishescontextchanges. Cost if wrong: conservativewholeprojectreconfirmationmayannoy, historicalknowledgecontextnotfullyreconstructible(laterknowledgeversiontask); knowledge+planmultiwrite rollback/regressions required. Agentproposalapproved; narrowT06integrationexpectations maychangefornewgroupinvalidation, noMCPproductionchange. FocusedKnowledgePanels/history.tsapproved, orchestrationretained.

原 ledger 第201行：

> Ruling: T07groupmember bindingusesexistingcontextendpoint onlyfor20visiblememberpage, limit1/boundedconcurrency4, guardedgroup/page/project/snapshotgeneration. HTTP404currentbindingmissingretainsid; othererrorsshownhonestly, neverinferdeletionfrombudgetedabsence. AuthoritativePlanDetailissuesdetermineannotationlostbinding. Reason: existingvalidatedAPIwithboundedlookups,no fullsnapshot/newbackend. Cost if wrong: perpageHTTPfanout/SQLiteparseoverhead; laterbatchmetadataendpointifmeasurementsjustify. Implementerproposed/approved.

原 ledger 第204行：

> Ruling: T07controllergrowth~500→646lines acceptedcohesiveproject/requestcoordinator after scopedknowledge/history additions; purehistory/memberreadhelpers+panels owndetails. Reason: oneclearasynchronouslifecycleresponsibility, avoidarbitrarysplit. Cost if wrong: futurefocusedcontrollerextraction, independentreviewmayidentifyrealcoupling/duplication; structurestillreviewable. No parent sourcefix. Lostannotationerror mustremainvisible/actionable, no silentdelete/falseapproval.

原 ledger 第216行：

> Ruling: T07nonblockingminorlocale-onlyspecgap acceptedtaskmilestoneunderApproved/0C-I rubric, requiresT08targetedfixbeforewholeMVPclaim. Reason: noCritical/ImportantfixloopforMinor, nextrelatedticketalreadyownsfullUIacceptance. Cost if wrong: localizederrorhelp remainspartialuntilT08; publicstatusmustnotclaimfullquestionnaireacceptancebeforefix.

原 ledger 第223行：

> Ruling: T08 observed UI reconnect cannot choose already-searched reusable B when B is outside bounded graph.nodes; allow deduplicated current-snapshot loaded entry/search facts as editor candidates, retaining service validation and readable accepted endpoint. Reason: required actual A-to-B reconnect cannot complete with graph-only candidates; no new API/indexing/unbounded snapshot. Cost if wrong: candidate-lifecycle or endpoint-display repair; regression must cover absent-from-graph target and project/snapshot isolation. Sole active T08 implementer owns focused RED/GREEN.
