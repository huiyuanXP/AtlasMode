# PERF-02 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对完整当前项目已索引事实进行有界全局位置计算，保持局部画布可读、手动位置持久、显式重排无语义变化。

**Architecture:** 只读 query 从同一 snapshot 返回最小全目标布局数据，独占纯 helper 经受限 Web Worker 计算全项目 SCC/rank/order/positions。局部 projection 使用全局结果做有界紧凑呈现与group镜像布局，view writes仅保存用户drag/显式重排，保留未显示位置；原80/300事实渲染与funnel仍独立。

**Tech Stack:** Node24.19.0/npm11.9.0、现有TypeScript5.9.3/React19.3.0/React Flow12.12.0/Vite7.3.6、Vitest4.1.11、Playwright1.63.0、现有SQLite/Fastify；不加依赖。

**Spec:** [2026-10-10-perf02-design.md](../specs/2026-10-10-perf02-design.md)。日期2026-10-10 UTC，完整草稿，作者自检完成，待独立设计审查和主控窗口授权。本轮没有执行下列步骤；方框不能被当作PASS。

## Global Constraints

- 只读全目标上限5000 actual snapshot nodes、20000 raw relations、8388608 UTF-8 response bytes；完整已索引snapshot不等于完整磁盘仓库。
- 原局部事实查询默认80/上限300 nodes、240/900 relations保持；group/plan/anchors视觉cap500 cards/2000 routes，投影前预检。
- Worker wall timeout1000ms；真实Express/Flask各10次ready，compute p95≤250ms为未来接受目标，未实测；局部两次校正合计≤120ms为未来目标。
- Occupancy每auto节点最多32候选/全局160000 probes/每box64 cells/全局200000 cell entries；只做两次ordering sweeps/最多两次测量校正，拒绝无partial ready。
- Saved positions全部视为用户明确位置；默认auto不PUT view，不删offscope/unknown keys；不存在position-origin schema。
- Layout仅改view/visual position，保留真实domainID/filePath/parentId/原relation及evidence，no source/fulltext/annotations transport，不改规划revision/hash/current approval或历史。
- Project/snapshot/layout/view/projection/measurement代次必须匹配；旧回复不覆盖更晚drag/主题/组状态；无跨tab server CAS保证。
- 不源码迁移、不IDX-04/AG-02、不MCP新工具、不全量React Flow render、不新增layout依赖；fitView不能验收layout。
- 原PERF阶段草稿、POL/FS/GRP失败收据不改；main负责shared文件窗口/最终commit/push/集成，author不擅自stage/build shared dist/spawn。

## Review Focus

1. 80/300 subset、summary入口截断、snapshot查询换代：不能变成complete project结果；Task1/5测试覆盖所有ID与409。
2. 跨组同域函数、首alias canonical legacy pin、collapsed ports：只改visual key，不删hidden canonical位置或改真Node；Task3/5实际验证。
3. Worker迟到与更晚drag/theme/collapse/plan/scope：token拒绝且view patch合并当前state；Task2/4覆盖。
4. Unknown/external/raw关系、长链/cycles、巨型pin、group放大：预算包含真实raw总量，不伪造resolved或无界N²；Task1/2/3覆盖。
5. 初次auto/重载/显式re排/HTTP失败：默认不存auto，手动固定/历史不变，失败不清view；Task4/5覆盖。

---

## 授权顺序与测试环境

计划属于一个产品slice，分窗口是文件互斥与review gate，不是把query/helper单独称PERF-02完成。主控先取得独立设计审查；有失败项仅定向修doc。方法建议`executing-plans`，主控逐窗口授予一个实现者，再独立关键review；无需本代理spawn。

Window A：Task1纯core query与Task2/3纯web模块，新文件独占；现有公共出口/index、routes、Canvas、Workspace不动。Task1测试直接import新source文件，web测试type-only引用core types；已有依赖正常使用，无安装/build需求。worker production打包验证留后窗。

Window B：Task1装配到core public export/server queries/routes、client，避开POL/KN/FS共享routes窗口；Task4/5 UI前必须先freeze并审read-only HTTP。需要源级API测试时由owner创建`/tmp/atlas-perf02-window-b/vitest.config.ts`：root指向主控批准的冻结源码副本，aliases明确指向该副本core/service/storage源码，沿用现Vitest node环境/native SQLite；不从未冻结shared dist取新模块。

Window C：Task4共享UI，仅FS-01最终source修复/集成审查accepted、GRP02最新freeze核对后由main授权。当前FS first window REQUEST_CHANGES不是accepted基线。不得与Canvas/workspace/WorkspacePanels/i18n其它writer交叠。

Window D：Task5真实规模与compiled browser，main新建冻结副本，按既有模式root build输出该副本dist；禁止修改共享checkout dist。主控控制最终集成检查与提交。每窗记录sha manifest、命令/exit/时间，保存RED，不使用上窗或他票PASS代替新窗。

### Task 1: 完整最小布局目标与有界只读HTTP

**Files:**

- Create `packages/core/src/layout-target.ts`、`layout-target.test.ts`。
- Window B Modify `packages/core/src/index.ts`、`apps/server/src/queries.ts`、`apps/server/src/routes.ts`、`apps/web/src/api/client.ts`。
- Create `apps/web/src/api/layout-target.ts`（response validator/types适配）、`layout-target.test.ts`；Create `apps/server/src/layout-target.test.ts`。

**Interfaces:**

- `getLayoutTarget(snapshot: CodeSnapshot, expectedSnapshotId: string): LayoutTargetResult`，类型/字段/拒绝分支按spec，不返回完整CodeNodes/source。
- `projectQueries(service).layoutTarget(projectId:string, input:{expectedSnapshotId:string})`捕获一次getSnapshot，调用helper。
- `HttpApi.layoutTarget(projectId:string, expectedSnapshotId:string, signal?:AbortSignal): Promise<LayoutTargetResult>`；私有request添加可选`{signal,maxBytes}`转发，仅新请求maxBytes=8388608；有界stream读取后JSON.parse，超限abort，不在无界response.json之后才检查；不改变旧调用参数语义。
- `validateLayoutTarget(value:unknown, expected:{projectId:string;snapshotId:string;contentHash:string}): LayoutTargetResult`严格完整性/数字/枚举/uniqueIDs/端点/预算/响应字节校验；rejected不能带partial arrays，返回不得偷偷cast。

- [ ] **Step1 写RED** `layout-target.test.ts`：5000/20000边界ready、5001/20001拒绝、长id使>8388608 bytes拒绝；same snapshot精确完整IDs/counts/byKind、actual external+所有rawunknown、no signature/filePath/evidence/content；重复id/坏端点拒绝；S0 expected/S1实际409；foreign project失败。客户端测试无Content-Length的分块响应跨过8388608即abort、header不可替代body限制、ready阵列少1、counts伪造、null变假target、混snap/hash、rejected带nodes、超字节拒绝。
- [ ] **Step2 运行RED** `npx vitest run packages/core/src/layout-target.test.ts apps/web/src/api/layout-target.test.ts`，保存实际missing/helper失败，区分setup失败。
- [ ] **Step3 实现pure helper/validator**：caps在构造最小数组前按full snapshot lengths；UTF8整个readyJSON计数；scope只project_indexed_facts；不按resolved采样或裁unknown。导出types/constants均在新file，A窗不动index。
- [ ] **Step4 运行GREEN** 同Step2命令；确认只读输入未突变、精确counts与拒绝。freeze A窗新文件供Task2。
- [ ] **Step5 B窗写/运行HTTP RED** `npx vitest run apps/server/src/layout-target.test.ts --config /tmp/atlas-perf02-window-b/vitest.config.ts`。使用真实SqliteStorage/WorkspaceService/Fastify disposable DB，S0→S1 between summary/request拒绝，ready只同一捕获对象；取records前后深比且plan/view/approval/history不写；严格bodyunknown/malformed拒绝；client abort signal转发。
- [ ] **Step6 B窗装配** query facade+strict新POST route+core出口+client请求，不改refresh/storeSnapshot/planning/approvals；public出口按main最新KN/POL来源合并，不能覆盖其改动。
- [ ] **Step7 B窗GREEN/类型/冻结** 同HTTP命令与client单测；main冻结副本 `npm run typecheck` 在必要包范围验证（core/server/web），保留输出+12项或实际数量SHA，不预填PASS。独立query review通过后交Task4。

### Task 2: 全项目确定性算法与受限Worker

**Files:** Create `apps/web/src/features/graph/overview-layout.ts`、`overview-layout.test.ts`、`overview-layout.worker.ts`、`overview-layout-controller.ts`、`overview-layout-controller.test.ts`。

**Interfaces:**

- `layoutProjectFacts(input:GlobalLayoutInput):GlobalLayoutResult`的domain positions/ranks/order/stats按spec。
- `LayoutToken={projectId:string;snapshotId:string;layoutGeneration:number;viewGeneration:number}`。
- `OverviewLayoutController`构造参数`{createWorker:()=>WorkerPort|undefined,onResult:(token:LayoutToken,outcome:OverviewWorkerOutcome)=>void,setTimer:(callback:()=>void,delay:number)=>unknown,clearTimer:(handle:unknown)=>void}`，`request(token,input):void`、`cancel():void`、`dispose():void`；WorkerPort仅postMessage/terminate与message/error listener，注入方便单测，真实实现是module Worker。
- `OverviewWorkerOutcome={status:'completed';result:GlobalLayoutResult;computeMilliseconds:number}|{status:'failed';reason:'timeout'|'worker_error'|'unsupported'}`。Worker消息`{token,input}`/`{token,result,computeMilliseconds}`，createWorker返回undefined是unsupported，构造/运行错误是worker_error，错误/超时由controller返回明示failed outcome，不伪造GlobalLayoutResult.ready。

- [ ] **Step1 算法RED**：chain5000不stack overflow、mutual-cycle/rankcondensation、shuffle node/relation输入完全确定、重复constraint不增rank权重、contains/unknown/external不rank；raw计数仍15216/20k全部；手动pin精确、不finite拒绝、碰撞knownpin、同project retained存活、新节点只补位，新manual pin撞retained auto时仅该auto让位；32/160000/64/200000各硬边界和无partial ready；输入/输出不突变facts。
- [ ] **Step2 运行RED** `npx vitest run apps/web/src/features/graph/overview-layout.test.ts`，留存失败。
- [ ] **Step3 实现helper**：迭代SCC、稳定DAG longest-rank、两次序位sweep、结构/external/孤立带、格点occupancy；没有全节点pairwise碰撞遍历。给stats probes等真实数字，不存measure/source/ReactNode。
- [ ] **Step4 算法GREEN** 同Step2；复杂度review检查实际loops与allocation，不能仅凭快单测断言O(V+E)。
- [ ] **Step5 controller RED** fakeWorker+fakeClock：1000ms terminate once/late reply拒绝，newerdrag(viewGeneration)/S1/projectB cancel，dispose清listeners/timer，worker.onerror一次failed，无Worker不跑同步全局；exacttoken仅current成功。
- [ ] **Step6 运行RED并实现controller/worker** `npx vitest run apps/web/src/features/graph/overview-layout-controller.test.ts`；有界clone数据，request前cancel旧worker，reply后release；terminate真实调用不能只reject promise。
- [ ] **Step7 GREEN/冻结A窗** 同Step2/6命令，生成owned-source manifest，独立helper review。真实module Worker加载、主线程longtask和性能尚未验证，交Task5而不是宣称ready。

### Task 3: 视觉镜像、位置来源与有界几何

**Files:** Create `apps/web/src/features/graph/overview-visual.ts`、`overview-visual.test.ts`。A窗仅import现projection/group types，不改GRP02/Canvas。

**Interfaces:**

- `Projection=ReturnType<typeof projectGraph>`，`estimateBaseVisualWork/resolveVisualPins/estimateVisualWork/layoutVisibleOverview`签名按spec。
- ready positions严格以已有visualIDs为key；`manualOverlaps`只报saved pins，不把已知auto overlap误当手动。
- input global ready canonical domain ranks与nodes.data.node.id关联，不通过split alias猜函数id。显式ignorePinsFor由Task4捕获当前visualIDs，不供正常default调用。

- [ ] **Step1 RED**：shared alpha在G1/G2是真同域、两个alias位置；first-alias oldcanonical pin唯一继承并返回sourceKey、自身alias key优先、group header key独立、offscopeopaque keys原样；含plan/anchors base唯一IDs预检、501 base nodes不生成放大projection、exact group node计数/route保守上界文案不可当actual数、15组每relation上界非225；501/2001拒绝于构造amplified projection之前；collapsed source/target/handle/evidence identity不变。
- [ ] **Step2 运行RED** `npx vitest run apps/web/src/features/graph/overview-visual.test.ts`。
- [ ] **Step3 实现pin/work helpers** 完全复用GRP02membership/首组stable排序规则；estimate为保守上界且不漏unknown/plan工作；拒绝结果不包含大数组或saveview。
- [ ] **Step4 geometry RED/GREEN** 加实际尺寸fixture（不同width/height、collapsed manyportheader、固定header/固定member/共享member、自动两点碰撞、manual两点重叠、world超大pin/64cells拒绝），实现局部block/格点、安全当前scopecompact；不重写edge endpoints/data，不加入physicalparent；两次测量条件由Task4驱动。运行同Step2，断言auto-auto/auto-pin无碰撞、pinsexact、数据深比不变。
- [ ] **Step5 A窗freeze独立review** 接口/geometrybudget/topologysemantic区别入原文，保留单测与真实DOM之间的未验证边界。

### Task 4: 共享UI接线与保存生命周期

**Files (Window C only):** Modify `apps/web/src/app/workspace.ts`、`WorkspacePanels.tsx`、`features/graph/Canvas.tsx`、`features/graph/projection.ts`（仅auto position input/pin provenance）、`i18n/zh.ts`、`i18n/en.ts`；现有workspace/client/Canvas tests相称补充。Create `apps/web/src/app/overview-layout.test.ts`（store协议测试）、`features/graph/overview-session.ts/test.ts`（scope/measurement状态机，避免塞Canvas算法）。保留MapPanel/FunnelOffsets既有逻辑。

**Interfaces:**

- Workspace state新`overviewLayout`包含global status/token/currenttargetcounts/result，`viewGeneration`与`projectionGeneration`；不作为PlanOperation，不写coreViewState。
- `recomputeProjectLayout():Promise<void>`完整target重算，saved pins优先、不用retained；`rearrangeVisibleOverview(capture,visualIDs):void`显式忽略当前pins，最多两次校正后保存这些visualkeys。
- `saveLayoutPositions(patch,capture):boolean`签名按spec，apply时从`get().view`merge，token不匹配false。any view change递增viewGeneration，再走原saveView capturedpayload/250ms/serialized queue。
- `OverviewSession`通过`projectionGeneration/measurementGeneration`与`begin(input)/measure(token,boxes)/cancel()`管理最多两次布局，dragging/FS ownership preview/funnel/group-selection拒绝overview apply/save；复用accepted FS状态源，不invent另一份dirty flag。

- [ ] **Step1 main确认窗口** 读取最新FS修复+整合freeze与GRP source hashes，关闭原REQUEST_CHANGES后冻结起点；POL/KN等Workspace writer互斥。未满足则保持文档阶段，不先改Canvas。
- [ ] **Step2 Store/session RED** source-state测试：默认auto不PUTview、不updatePlan；更晚主题/collapse/drag与旧reflow回调合并失败而当前保持；current patch只改visiblekeys、offscope/unknown/hiddencanonicalkey不删；project/S1/plan/filter/membership/nav代次取消；失败view保存保留本地未保存提示、retry无旧ack覆盖新操作；2 measurement/≤1px稳定、不panzoom触发layout。
- [ ] **Step3 运行RED** `npx vitest run apps/web/src/app/overview-layout.test.ts apps/web/src/features/graph/overview-session.test.ts`，记录行为失败而不是missingbrowser setup成功。
- [ ] **Step4 Workspace装配** load先原view/seedgraph，另发snapshot-bound target请求；validate response/summary hash+id，worker token与scope取消；最大2project auto cache，close/dispose释放；新snapshot保留surviving auto点但旧snapshotstatus不伪current ready。
- [ ] **Step5 Canvas/Panels装配** 当前scope先estimateBase再projectGraph，estimate镜像再projectGroups、global→visiblecompact、fallback/真实geometry2pass、capturedmerge savepatch。两个overview按钮与准确zh/en状态、funnel独立文案，map仍真实flow nodes。FS ownership native gesture/preview和dirty state禁layout，ordinarydrag继续savevisualkey；不得顺手改其retarget/source协议。
- [ ] **Step6 Store/session GREEN和邻近回归** 同Step3；`npx vitest run apps/web/src/features/graph/projection.test.ts apps/web/src/features/groups/projection.test.ts apps/web/src/api/client.test.ts apps/web/src/app/WorkspacePanels.test.tsx`；main加入accepted FS/inspection/funnel实际测试文件列表，不凭空填测试数。必要包typecheck与owned-file lint在主控冻结副本执行。
- [ ] **Step7 freeze独立criticalreview** 全部changedsource/reviewdiff/作者检查输出具SHA，特别liveworker迟到、saveview closure、sourceidentity和scopecomplete。未过不能触发真实产品完成门禁或标票DONE。

### Task 5: 固定真实规模、浏览器与语义不变性

**Files:** Create `tests/e2e/overview-layout.spec.ts`、`scripts/validate-layout.mjs`（只验证AtlasMode public API/production UI，不执行目标代码）；证据 `docs/superpowers/reviews/perf02-2026-10-10/`，root docs/ticket更新仅main。

**Interfaces:** validation script arguments `--path <fixedcheckout> --commit <fullSHA> --symbol <name> --file <path> --label <label>`，输出`layout-target.json/timing.json/geometry.json/identity-before-after.json/freeze.sha256`及浏览器图。非source全文JSON只保存IDs/计数/summary/布局几何/模型摘要，目标仓库/DB不commit。

- [ ] **Step1 主控冻结build** 全窗source freeze复制到独立temp checkout，依赖用现锁定环境，`npm run build`/necessary `npm run typecheck`在该副本；确切compiled worker资产hash入manifest，不能使用前一票bundle或test组件页面当production。
- [ ] **Step2 realproject RED/计时** `node scripts/validate-layout.mjs --path /tmp/atlasmode-idx01-express --commit dbac741a49a5a64336b70c06e85c2e2706e36336 --symbol createApplication --file lib/express.js --label express`。Flask用validation-targets pinned `22d924701a6ae2e4cd01e9a15bbaf3946094af65`、`/tmp/atlasmode-validation-flask`、`render_template`、`src/flask/templating.py`。现fixture不存在先报告，不能虚拟同counts冒充真实。冷/热各5次真实worker计时/完整IDs覆盖、exactnode incl external、rawrelations/bytecounts、main-thread longtasks，目标10次ready/computep95≤250ms/wall<1000ms；保存原FAIL后仅在main批准范围定向修helper。
- [ ] **Step3 更大真实拒绝** 同script Vite pinned `10033218d239c927cdc375970b5741cce408e81b`、`/tmp/atlasmode-validation-vite`、`createServer`、`packages/vite/src/node/server/index.ts`；新的exactcounts决定真实reason，旧44263relations仅历史预期。拒绝必须无partialarrays/autoviewwrite/布局丢失，原手动坐标保留；不得裁unknown后ready。
- [ ] **Step4 browser G3/G4 RED→GREEN** `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test tests/e2e/overview-layout.spec.ts`（当前VM2可选本机路径，CI用已安装browser）。实测1600/1900、浅深色、createApplication完整16in/5out上下文与bounded当前图、2条可点击evidence关系、选中宽≥200、auto-auto/auto-pin矩形碰撞=0。真实鼠标drag fact+两个alpha aliases、首alias legacy pin、currentreflow、reload/serverrestart坐标恢复；保留offscopeopaque keys；截图实际查看。全部node/filePath/parentId/关系、source hashes、plan revision/hash/currentapproval/history before/after严格相等。
- [ ] **Step5 browser G5/G6** compiled真实worker终止/延迟网络/项目A→B/S0→S1、更晚drag/theme/collapse/plan/filter/nav取消、group501/route2001超限先拒绝后安全图且state不被自动collapse，缩小恢复；funnel300ms/分页/独立offset/rearrange/退出恢复、map1600/1900/keyboard/Esc、accepted FS nativeownership拖动不saveLayout/currentreflow禁用；零page error。性能失败/不支持worker/超限不能静默走主线程全局fallback。
- [ ] **Step6 相称回归与独立收据审查** 在同冻结副本跑上述targetedunit/HTTP/browser和必需types/lint；source变更后只重跑受影响真实fixture，不重复无关paidmodel/rootgates。独立review确认G1–G6、统计与sourcecompiledhash相符、FAIL保留，原票不被“全部拒绝有预算”假完成。
- [ ] **Step7 main收尾** 实测决定cap是否能冻结；如果中型目标不ready或几何/保存失败保持PERF-02未完成，提出定向repair，不擅自提高cap。通过后main同步README/ticket/state、按已授权main阶段commit/push；无deploy/merge/权限/keys/sessions。记录native OS/browser未验证，不把本地Chromium替代三OS。

## 作者自检与交接

Spec G1→Task1/5；G2→Task2/5；G3→Task3/4/5；G4→Task3/4/5；G5→Task2/4/5；G6→Task3/4/5。所有跨任务签名一致；接口没有sourcewriter/自动审批，defaultauto无persist；完整5000/20000计算与80/300事实/500/2000视觉呈现分开，5000未知offscope几何没有伪DOM证明。placeholder无；数值为spec未来目标，真实能力未验证。

下一步为**独立设计审查**，不是产品implementation。本author不会spawn/review自己或修改state；主控选择/授予执行window与方法。原始stage draft/POL报告/FS失败与真实Express历史证据均保持。
