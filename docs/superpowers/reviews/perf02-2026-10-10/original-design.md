# PERF-02 全项目事实布局与有界局部呈现

日期：2026-10-10 UTC。状态：完整设计草稿，自检完成，**待独立设计审查；无产品实施授权**。本轮只写本 spec 与 [plan](../plans/2026-10-10-perf02.md)，不改源码、状态、票、README、共享 dist，不 build/test/stage/spawn。主控分配接线窗口；原模型约束 gpt-6.1-sol high 保持。先前 `task-3/perf02-design-stage-draft.md`（SHA256 `d950e91213cb08362a57cf9b5d7ed773f9b30dbd8582e2950962cae447403249`）保持原样，500/2000/120ms 是那个阶段的未验证提案，本 spec 将全目标计算预算与局部呈现预算分开，不继承其“仅 loaded overview”范围。

## 目标与现状证据

[PERF-02](../../tickets/PERF-02.md) 要求真实规模评估、保留用户手动位置、大范围有预算；漏斗不等于全部自动布局。面向已索引中型项目，默认计算**当前项目完整 snapshot 内全部事实的布局**，让新显示的事实使用这一全项目拓扑结果；画布继续显示有界当前范围。用户拖动只保存布局，显式重排只改变视图位置，规划 revision/hash/approval、事实身份与源码 bytes 均不改变。

当前 [Workspace load](../../../apps/web/src/app/workspace.ts) 读取 summary 后只取前8入口，以 `api.graph(...,depth=0)` 打开局部图；[subgraph](../../../packages/core/src/queries.ts) 默认80、上限300 nodes，关系上限为 budget×3，并返回 truncated。多批这种查询的 union 不能证明完整 snapshot，深度限制也不能证明全项目。现 [projection](../../../apps/web/src/features/graph/projection.ts) 是三列 index fallback；[Canvas](../../../apps/web/src/features/graph/Canvas.tsx) overview 采用该位置，`layoutFunnel` 只供漏斗。`fitView`/缩放/小地图是摄像机操作，不能用作布局算法或验收。

[GRP-02冻结](../reviews/grp02-2026-10-10/README.md) 已证明 visual alias 不增加事实、端点/evidence保真和局部 loaded/total/unknown；总 group 数没有硬上限。其视觉节点公式 N'=N−U+G+M_expanded、每原关系最多1+g(source)+g(target)条 route，故事实预算不能代替镜像预算。[FS-01设计](2026-10-10-fs01-design.md) 分开布局拖动和归属操作；其 first-window code review 当前 REQUEST_CHANGES，后续必须以主控确认的最终接线 freeze 为准，不能把设计 APPROVE 当实现通过。

只读读取的既有真实收据（不是本轮索引或计时）：

| 目标与收据 | snapshot已知规模 | 本设计中的含义 |
| --- | --- | --- |
| [Express IDX03](../reviews/idx03-2026-10-10/express-after-idx03-product.json)，v5.2.1，git `dbac741a49a5a64336b70c06e85c2e2706e36336`，contentHash `2008eb699bd465fc56b8681250637bcd3ba2b58617698b78b3f1b83f04ff748d` | 142files/42folders/3070functions/15216relations；calls320resolved/11218unresolved/22external | 已知事实至少3254，完整 node 总数还包含实际 external nodes，必须由新 query 记录。500事实上限会全局拒绝该目标，故不采用它作为全项目 cap。 |
| [Flask inspection demo](../reviews/graph-inspection-2026-10-09/demo.json) | 83files/28folders/1575functions/6283relations；calls714resolved/2176unresolved/1029external | 已知事实至少1686；外部节点总数不能以 external relation 数冒充。需新收据记录 exact total。 |
| 原 Express 图 `task-3/express-after-idx03-product.png`，1600px宽 | createApplication 实际高入度图密集；既有完整 context 为16 incoming/5 outgoing；一跳26nodes/99relations未截断 | 已查看历史截图，只作为问题证据。本轮没有新浏览器测量或性能结果；必须取得新的高入度布局/关系点击/几何收据。 |

“全项目”只指**当前 snapshot 的全部已索引事实**，包括实际 file/folder/function/external 节点与所有 raw relations；不包括被排除、无法读取、未支持或未索引的源码。保留 summary coverage/diagnostics，不能把 indexed completeness 说成整个磁盘仓库完整、静态 unknown 已解决或真实运行调用图。

## 方案选择与最小 slice

选择有界最小全目标数据 + Web Worker 纯布局 + 原局部渲染。它让固定 Express/Flask有机会得到全局拓扑位置，同时不把几千卡片全部塞入 React Flow，也不把源码/完整snapshot或全图送给 Agent。

仅给当前80/300子集排布成本最低，却无法满足全项目目标；只适合作为明确标识的降级。直接全量渲染或新增 elkjs 可扩大能力，但增加依赖、打包与呈现成本，本 slice 不采用。若固定真实目标在本设计预算内仍无法通过，保留失败并让独立审查决定调整预算/算法；不能悄悄改“全局”为loaded以过票。

范围：新只读 layout-target query；不含事实的布局数据提取；确定性 SCC/分层位置；受限 worker生命周期；当前范围的紧凑呈现和镜像位置；默认自动位置、显式重排、手动位置恢复；真实规模/几何/不变性证据。没有 source writer/IDX-04迁移、规划操作/schema变化、审批新流程、MCP新工具、导入全仓上下文、增量索引或边路由引擎。

## 完整目标只读契约

新 `POST /api/projects/:id/layout-target`，strict body **仅** `{expectedSnapshotId: string}`，非空当前 snapshot ID，调用方不能提高 hard cap。路由取 `service.getSnapshot(projectId)` **一次**，在同一个捕获对象上校验 id、计数、提取与序列化；不先 summary 再假定另一个GET仍同 snapshot。不匹配沿用 `SNAPSHOT_CHANGED`/409；不存在项目按已有404。读不刷新、不解析源码、不写DB、不使plan失效。

新纯 query helper `packages/core/src/layout-target.ts` 定义类型和 `getLayoutTarget(snapshot: CodeSnapshot, expectedSnapshotId: string): LayoutTargetResult`；它是事实查询而非 UI 布局。由 `apps/server/src/queries.ts` 装配，route只作strict解析。公共出口只在主控授权窗口合并。

```ts
type LayoutFact = { id: string; kind: CodeNode['kind']; parentId?: string };
type LayoutRelation = Pick<Relation, 'id' | 'sourceId' | 'targetId' | 'type' | 'resolution'>;
type LayoutCounts = { nodes: number; relations: number; byKind: Record<CodeNode['kind'], number> };
type LayoutTargetResult = {
  projectId: string; snapshotId: string; contentHash: string;
  scope: 'project_indexed_facts'; counts: LayoutCounts;
  limits: { nodes: 5000; relations: 20000; bytes: 8388608 };
} & (
  { status: 'ready'; complete: true; nodes: LayoutFact[]; relations: LayoutRelation[] }
  | { status: 'rejected'; reason: 'node_budget' | 'relation_budget' | 'byte_budget'; actualBytes?: number }
);
```

总量来自 `snapshot.nodes.length`/`relations.length`，不是 summary入口数或 graph union；byKind includes actual external。ready必须每个真实 nodeID、每个 raw relationID各出现一次，拒绝重复id/不存在非null端点的不一致snapshot而不生成布局。保留 raw unresolved/external关系的身份和计数，但它们不会被升级成 resolved rank constraint。null target保持null，不制造外部卡片。只传id/kind/parentId与上述关系字段；**不传 name/signature/filePath/evidence.text/content/source全文/annotations**。显示/点击/evidence/source仍走原有局部事实接口。父路径事实的parentId只供排序亲和，不生成contains或改所有权。

5001 nodes或20001 raw relations立即返回rejected与**同一snapshot真实总量**，无截断 nodes/relations。ready JSON的UTF-8字节数（整个响应）超过8MiB则 byte_budget，actualBytes记录实际大小，不假报较小。核心用TextEncoder计数，无Node-only Buffer依赖；固定字符串ID可使byte预算先于node预算被触发，必须测。HttpApi仅此新请求用有界body reader，累计读取实际UTF-8响应超过8388608 bytes即拒绝/abort；Content-Length仅用于预检，不能单靠header或在无界response.json之后声称transport有界。旧接口解析不变。UI保留原局部graph、位置与手动pins，明确“全项目自动布局未完成：事实N/5000，关系E/20000，原因…”；不会自动提高cap或请求unbounded snapshot。拒绝不是布局成功，也不改用户positions。

## 独占纯 helper 接口与算法

新 `apps/web/src/features/graph/overview-layout.ts`，无React、DB、fetch、DOM、source、worker全局副作用，接口用只读值，不突变输入：

```ts
type XY = { x: number; y: number };
type LayoutBox = { width: number; height: number };
type GlobalLayoutInput = {
  target: Extract<LayoutTargetResult, {status:'ready'}>;
  pins: Record<string, XY>; // actual domainId keys, mapped from existing fact:<domainId>
  retained: Record<string, XY>; // same-project surviving auto coordinates; not persisted
};
type GlobalLayoutResult =
  | {status:'ready'; positions: Record<string, XY>; ranks: Record<string,number>;
     order: string[]; stats: {nodes:number;rawRelations:number;rankRelations:number;sccs:number;probes:number}}
  | {status:'rejected'; reason:'invalid_input'|'work_budget'|'geometry_budget'};
function layoutProjectFacts(input: GlobalLayoutInput): GlobalLayoutResult;
```

Global positions keys为**实际域id**（没有alias）；pins/retained从实际fact渲染key精确映射到域id。controller只映射存在target.nodes的 `fact:<id>`，不解析任意冒号字符串、不把group或plan key当域id；所有未识别saved keys保留原ViewState。

确定算法：sort真实id；以 **resolved calls/imports、存在且kind不是external的真实两端**建立去重方向约束，按(source,target)去重只用于rank，raw计数不变；contains、unknown/external、null不进入依赖rank。使用**迭代**SCC，避免5000长链递归溢出；condense DAG按稳定id topological order，最长路径rank，保留cycle摘要不声称cycle消失。rank内用两次（前向/反向各一次）稳定邻接平均序位排序，高入度目标的调用方相邻；同权重以id打破平局。构造邻接/SCC/condensation为O(V+E)，排序为O(VlogV+E)，两次sweep有界；不宣称含排序/placement全部严格O(V+E)。

全局自动位置采用列宽400、行高300、最小卡片gap48的保守格点，默认fact box300×220。文件/文件夹在独立结构带按真实parent链稳定排序，external在独立已知外部带，孤立函数与call components按最小域id稳定打包；结构带不伪装依赖rank。组件边界、内部cycle、父链cycle处理均有确定结果。manual pins绝对坐标原样保留；retained自动点在同project下一snapshot仍存活且未显式重算时作为保留点，避免每次refresh重新排现有卡片。新事实按rank附近空格放入，未知旧域id位置不删除。新manual pin或实际尺寸校正与retained auto点冲突时，仅冲突auto点释放保留并重新找空位；saved pin优先，不能把retained auto误列为manual-overlap而跳过碰撞验证。

占用表使用有界cell bucket，绝不能扫描每个已摆节点形成无限N²。每个自动节点最多32个候选、每个布局最多160000候选、每个box最多64占用cells，最多200000 cell entries；耗尽返回work/geometry_budget，无部分ready。任一非finite输入坐标或计算输出不能进入React Flow；拒绝后不清空已有view。保留pins自身重叠时记录manual-overlap提示，绝不为避免重叠移动它们；自动点不得撞入已知pin矩形。超大但finite manual坐标仍保留，若无法安全表示bucket/边界则拒绝自动布局并显示原因，不把值悄悄归零。

## Worker、代次与实时预算

新 `overview-layout.worker.ts` 只调用helper；新 `overview-layout-controller.ts` 管理一个项目一个active worker，采用Vite既有 `new Worker(new URL('./overview-layout.worker.ts', import.meta.url), {type:'module'})`。没有新依赖或shared daemon。request/reply token精确为 `{projectId,snapshotId,layoutGeneration,viewGeneration}`；UI当前project/current summary snapshot/token必须全等，且target.projectId/contentHash与已接收summary一致，否则丢弃。不能用迟到全局结果覆盖用户刚拖动的pin。

controller结果契约为 `OverviewWorkerOutcome = {status:'completed';result:GlobalLayoutResult;computeMilliseconds:number} | {status:'failed';reason:'timeout'|'worker_error'|'unsupported'}`；helper拒绝与worker故障均不会当作ready。不存在Worker时明确unsupported，不能在主线程同步全局fallback。

worker计算预算提案：硬墙钟1000ms（含worker启动/structured clone/计算/回传），到期terminate并展示timeout，取消/project change/refresh/new pin/recompute同样terminate旧worker；晚reply仍按token拒绝。一旦拒绝不会循环每render重试，只有目标代次变化或显式“重算自动布局”才新请求。纯helper有限work预算提供可复现拒绝，墙钟由controller守住，不能只用promise超时让后台继续耗CPU。默认同project保留上一可用auto positions，旧snapshot结果只作明确旧范围fallback，不能作为当前snapshot完整结果；本次新snapshot无法完成时不扩用旧结果覆盖新事实。

性能接受目标（非已测能力）：固定Express/Flask冷/热各5次，10次全部ready；记录query耗时/transport bytes/worker launch+roundtrip/纯compute/主线程long tasks；纯compute p95≤250ms，wall roundtrip每次<1000ms。拒绝、超时或超过目标都保留原FAIL，票不能凭“有timeout”标DONE。VM2/browser/version/source freeze/target commit/CPU必须入收据。真实总nodes包括external、rawrelations包括unknown；不能只测320条resolved关系就声称处理15216条完整事实关系。

## 当前范围呈现、group镜像与测量

全项目worker计算每个事实的全局位置/rank/order；**渲染仍原80/300事实nodes与240/900关系查询**。初始seed、局部expand、file/folder导航、焦点/计划anchors预算保持。新 `overview-visual.ts` 将最终display projection与全项目rank/order映射成当前范围的紧凑坐标：压紧未显示的空rank/行，但保留全局rank与排序关系；auto coordinates因此是全项目结果的**范围呈现**，不能声称当前显示了全部项目。首次当前scope以global位置为seed，后续同scope新节点只补空位，既有自动点保持；scope变化可以重新压紧未保存auto点，手动pins永远固定。局部紧凑坐标不改global facts/IDs，scope状态与generation另计。

```ts
function resolveVisualPins(nodes: readonly GraphNode[], groups: readonly FunctionGroup[],
  saved: ViewState['positions']): Record<string,{position:XY;sourceKey:string}>;
function estimateBaseVisualWork(graph: SubgraphResult|undefined, operations:readonly Operation[], filter:LayerFilter, referenceNodes:readonly CodeNode[]): {nodes:number};
function estimateVisualWork(base: Projection, groups: readonly FunctionGroup[], collapsedIds: readonly string[]):
  {nodes:number;edgeUpperBound:number};
function layoutVisibleOverview(input: {projection:Projection; global:Extract<GlobalLayoutResult,{status:'ready'}>;
  pins:ReturnType<typeof resolveVisualPins>; retained:Record<string,XY>;
  measurements:Record<string,LayoutBox>; ignorePinsFor:readonly string[]}):
  | {status:'ready';positions:Record<string,XY>;manualOverlaps:string[]}
  | {status:'rejected';reason:'visual_budget'|'geometry_budget';actual:{nodes:number;edges:number}};
```

Projection类型复用graph nodes/edges/notices。`ignorePinsFor`只能由用户显式重排当前visual IDs产生，默认空。`resolveVisualPins`首选saved visualID；若first ordered group alias无自己的key，复用GRP-02的首alias `fact:<domainId>` fallback，并明确sourceKey；其余镜像不继承该canonical位置。header=`group:<groupId>`，alias=`group-member:<groupId>:<domainId>`，它们属于视图，`data.node.id/filePath/parentId`继续真实函数。layout不写`node.position`以外任何字段，不重新命名fact、不造contains、不将group设成React Flow/domain parent、不增加真事实/关系。

基础projectGraph之前先从bounded graph、visible add_function与reference anchors计算唯一visual IDs上界，超过500时不生成放大的base projection，明确“计划层超出视觉布局预算”，保留同project上一安全图或bounded事实图，编辑器内容不变。group投影前用同一loaded函数membership计算exact visual node数和保守route上界。显示预算为500 visual cards（含plan/anchors/header/mirrors）与2000 visual routes，**独立于5000全局facts/20000rawrelations**。node数为exact，route值是保守上界；上界超限时文案明确“视觉route上界B/2000（尚未生成）”，不能将上界伪报成实际已生成关系数。超过任一预算不构建扩大镜像数组、不自动collapse/persist用户组状态，显示“组视图超过布局预算”并保留上一幅有同project标记的安全图；初次则呈现bounded base graph，明确“分组布局暂未呈现”，提供collapse/narrow-scope入口。不得把降级base图报group成功。隐藏未加载/unknown members不生成假卡片；groups过滤仅intersect已加载函数沿用GRP-02。

expanded group的**未固定**header/mirrors采用局部block，内部按global域rank/order行列，mirror同域id继承同rank但有独立位置；任何已固定member/header单独作为障碍并保持原坐标。header固定时，未固定成员block从其下方开始，必要时在同一scope空位移动；member固定在组外仍显示同一函数镜像badge，不为造“实体容器”移动它。shared member在多个组不是两份事实。routes位置使用原source/target/handle，方向约束按真实relationID+layoutunit pair去重，同一视觉重复route不增加权重；保留全部原证据/关系身份和collapsed ports，内部dependency不由membership生成。

全局worker未知尺寸的格点不能直接证明当前DOM无重叠；局部compact以实际尺寸做独立校正。只显示卡片才可用实际DOM尺寸；offscope尺寸未知，默认box不是实测。fallback：code300×220、group360×(220+60×portIds.length)。当前scope最多两次measurement-correction，每次最多500cards/2000routes；测量变化≤1px忽略。第一次按fallback产生auto位置，第二次用全部已初始化的实际宽高修正并验证；仍无法无自动重叠则明确geometry拒绝，不宣称零碰撞或无限effect循环。拖动期间不布局；theme/locale导致实际尺寸变化只能走这有界校正，不能保存自动结果或偷走camera。保守格点只给全项目未知尺寸模型；**几何零碰撞验收只针对当前实际测量scope与自动点**，不可宣称5000个未显示卡片都经DOM验收。

当前局部同步布局两次合计目标≤120ms，单帧最多500项位置apply；超时收据需修复/调低visual预算，不把120ms当已证实保证。只对scope/事实代次/plan projection/组collapse或membership/尺寸代次/显式reflow响应，不对pan/zoom/fitView每次运算。visible token为上述worker token再加 `{projectionGeneration,measurementGeneration}`，overlay plan revision、filter、reference anchors、group状态、导航scope变化都增projectionGeneration。旧scope/旧plan/旧measurement结果无效。

## 默认、手动与显式重排的保存合同

默认打开项目先正常加载保存的view/局部graph，后台获得完整layout-target与worker结果；未定位nodes自动呈现，所有saved positions优先。**默认auto不写ViewState**。全项目结果内存最多当前与上一个项目两份（各cap5000/20000），不存源码；project close/unmount释放worker和缓存。reload重新确定性计算auto位置，保存的手动点从SQLite恢复。相同snapshot与输入得到同auto布局；之后同projectrefresh保留存活auto点，不每刷新全重排。重新打开旧项目只保证saved点与确定性auto，不声称未保存临时自动点历史恢复。

保留既有“普通布局拖动→保存visual key”行为；新增 `saveLayoutPositions(patch:Record<string,XY>, capture:{projectId,snapshotId,projectionGeneration,viewGeneration})` 在**实际apply时读取当前view**并只merge位置patch，保留theme/locale/collapsedGroupIds/all offscope/unknown keys。传入capture不一致时拒绝，不拿旧render闭包的view覆盖新theme或拖动。沿用现saveView250ms scope-cancelled timer与serialized writes；递增viewGeneration在任何view修改前完成。layout helper不能直接putDB/调用updatePlan/approve。

overview有两个明确动作：

- “重算全项目自动布局”重新计算完整目标，不使用retained自动点，仍保留全部saved手动pins；新结果仍是derived，不写默认auto positions。超限/失败不改view。
- “重新排列当前视图”在当前overview的真实可见visual IDs上显式忽略pins，显示“替换本视图N个位置，其他位置保留”，完成有界测量校正后只merge这些IDs的新坐标并saveView；不清空整个positions。其结果作为用户显式选择的saved布局，以后与drag位置一样优先，无需origin schema。group首alias新key可覆盖其canonical fallback，但旧`fact:<domainId>`位置仍保留，不能删除隐藏canonical点或误更新原Node字段。scope/filter/groups/plan/view代次在测量期间变化即取消，不自动保存旧结果。

readonly布局没有新revision/history或批准失效；已有 `Knowledge.saveView`只写views。真实pointer drag、theme/collapse并发、更晚拖动/重排、HTTP失败后重试都要验证位置合并。view没有server CAS，多浏览器标签同时写仍是现有last-writer-wins；本票承诺当前单tab序列与作用域取消，不伪称跨tab事务。无ack时保留本地用户位置并提示未保存，不用服务返回旧view覆盖更晚本地修改。

## 漏斗、小地图、归属交互

overview自动布局不进入`layoutFunnel`，不改FunnelOffsets project/root key或300ms分页动画；进入funnel保存overview/cache与viewport，退出恢复同scopeoverview。两个overview动作在funnel/group selection/FS ownership gesture或preview/拖动时禁用；漏斗按钮文案明确“重新排列漏斗”，仅清当前root offset。FS ownership拖动不能产生layout pin，overview布局结果不能触发ownership保存或取消其dirty文本。FS共享窗口接受前不能改这些事件。

MiniMap与扩展map继续显示**当前实际React Flow visual nodes**，同facts多个alias按实际位置呈现，点击focus仍通过真实domainID；不将global5000位置全塞入map或声称map涵盖全项目。既有1600/1900px无重叠overlay与键盘pan/zoom/Esc回归保持。fitView只能在用户显式camera动作/已有focus规则下运行，性能/截图不能靠fitView把全部卡片缩小到不可读。

状态栏独立显示“全项目已索引布局 N事实/E关系，当前显示 n事实/m视觉卡片/r视觉关系”；global rejected/pending、局部truncated、unknown/evidence、groups loaded/total分别显示。global ready即完整位置数组覆盖target facts；局部图不能更改其complete标记或解除query截断。

## 验收与可停止条件

| 接受条件 | 必需证据，均属未来实施，不是本轮PASS |
| --- | --- |
| G1 完整目标/拒绝 | actual SQLite+HTTP同snapshot；每node/relation id覆盖、no source text、exact bytes/counts；5000/20000边界、5001/20001/8MiB拒绝、expectedSnapshot换代409且无writes |
| G2 真全局预算 | pinned Express和Flask fulltarget exacttotal/rawcounts，完整positionIDs覆盖，10次冷/热compute/roundtrip计时达到上述目标，输入与source freeze可复现；较大固定Vite（既有44263relations）按新的真实nodes/relations取得node_budget或relation_budget拒绝收据；reason优先顺序node、relation、bytes，不能通过裁unknown来适配 |
| G3 实际高入度与几何 | Express createApplication同snapshot完整incoming/outgoing counts，当前图可保持80/300；1600/1900真实DOM矩形、auto→auto与auto→pin overlap=0（manual→manual允许但明确）；所有16已知callers可通过实际context/分页/范围展示，不因layout消失；选中节点可读宽≥200px；抽两条关系实际点击命中原relation/evidence；浅深色截图实际查看 |
| G4 saved位置/identity | pointer移动fact及两个shared aliases，restart/reload精确坐标；首alias legacy canonical fallback、offscope/unknown keys保持；显式currentreflow只改当前visual keys，domainID/filePath/parentId/relations/source bytes/plan revision/hash/current approval+历史不变 |
| G5 并发/worker失败 | A→B project、S0→S1刷新、更晚drag/view change/theme/collapse/plan/scope导致late reply丢弃；worker真实termination/超时、无Worker环境明确unsupported不主线程全局fallback；默认auto无PUT view；无无限measurement/layout/effects |
| G6 group/funnel/FS回归 | overlaps/collapsed ports保真、多组route预算先拒绝后安全降级/缩小恢复、map真实节点、funnel entry/exit/offsets、FS pointer归属拖动不保存layout；组/视图不使approval失效 |

helper单测不能替代worker打包/实际浏览器；保存收据标明author/独立审查/主控集成，不把先前48/49或FS/GRP门禁归成本票。完整target cap/worker门槛均是设计成本选择，只有真实计时与几何实验后才可冻结为能力。若Express/Flask exactnodes/bytes实际超限、10次任意拒绝、几何失败、手动位置丢失或全局只覆盖subset，**PERF-02保持未完成**，记录失败后定向改设计，不先标DONE。合法大于cap目标拒绝可通过G1/G2边界，但不能代替中型目标的global ready。

## 实施文件与授权窗口

独占新文件可审查但本轮不实现：core `layout-target.ts/test.ts`；web `overview-layout.ts/test.ts`、`overview-layout.worker.ts`、`overview-layout-controller.ts/test.ts`、`overview-visual.ts/test.ts`、`api/layout-target.ts`（只放共享transport types验证，HTTP请求仍由client负责）。不引入包或lockfile变化。

独立设计审查通过后，主控单独授权Window A纯helper与测试，再freeze独立review。Window B只读query公共出口（core/index.ts）、server queries/routes+HTTP tests、client接口；必须避开POL/KN/FS routes窗口。Window C UI接线（workspace.ts、WorkspacePanels.tsx、Canvas.tsx、projection仅pin来源/auto参数、i18n）；须等待FS/GRP最终冻结及REQUEST_CHANGES关闭，与其Canvas写窗口互斥。Window D主控隔离编译后真实Express/Flask/Vite/浏览器收据与必要集成gates。不得先抢共享文件、build到共享dist或把纯helper成功当全票成功。

自检：原票四项映射G1–G6；全项目与局部呈现、global与visual cap、physical与mirror identity、persist与derived、事实unknown与rank约束、性能提案与实际能力均已分开；没有产品源码/依赖安装/源文件迁移。本文仍待独立设计审查，作者自检不是独立APPROVE。
