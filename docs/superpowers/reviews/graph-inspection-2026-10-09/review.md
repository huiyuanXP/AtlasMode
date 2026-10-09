# UI-05～UI-10 独立代码审查

审查依据：已批准 `docs/superpowers/specs/2026-10-09-graph-inspection-design.md`、实施计划 `docs/superpowers/plans/2026-10-09-graph-inspection.md` 与 `requesting-code-review/code-reviewer.md`。

本次为一轮必要独立审查，按模块分段接续。代码只读，报告为唯一写入；沿用实现者实际验证证据，额外门禁预算为零。

## 第一段：Task 1 后端引用证据

范围：`review-backend.diff` 中 core 查询/行为测试、server 查询/路由/HTTP 测试、web API 调用；结合现役索引器节点/关系生成、core 导出与 HTTP 错误映射确认衔接。

### 规格符合与质量

- 函数详情的 `relatedNodes` 从本页真实关系端点按 ID 取得；同名节点保持独立。
- 文件成员通过现役 `filePath` 或 `parentId` 链确定归属；方法/嵌套声明保持文件关联。
- incoming/outgoing 保留跨文件 resolved calls 的原始 relationId/evidence；内部调用归属清晰，imports 独立保留双向导入，unknown 保留本文件 external/unresolved calls 及原因。
- 五组各自确定性排序并独立应用相同 offset/limit，返回准确总数；`relatedNodes` 随当前页有界，空页为空。`truncated` 与既有函数查询语义一致。
- HTTP 复用严格分页 schema、当前项目快照及现役错误映射；未知/跨项目/错误类型 ID 返回 404，非法/重复/额外分页字段返回 400。client 正确编码项目与节点 ID。
- 核心与 HTTP 测试覆盖真实多调用证据、同名隔离、成员归属、分页稳定性与项目边界；HTTP 测试使用实际 SourceIndexer/SQLite/WorkspaceService 链。

### Findings

- **C（Critical）：0。**
- **I（Important）：0。**
- **M（Minor）：0。**

### 验证证据

引用 `task-1-report.md` 的实际执行记录：初始 RED 5 失败/21 通过；core 定向 GREEN 11 通过；core 构建退出 0 后最终 4 文件/29 项通过（2026-10-09 09:18 UTC）；改动文件定向 ESLint 退出 0。本审查通过源码与差异核对上述行为覆盖，沿用该记录。

### 暂置行为与原因

- Canvas/Workspace 详情异步隔离、拖动、高亮、小地图及 UI-10：实施者正在完成，按主 Agent 后续完整差异接续审查。
- AST 声明类型、本地字体许可与回退：并行 Task 2，按后续完整差异接续审查。
- 仓库全量构建、浏览器实际布局与未批准演示规划：主 Agent 统一验收，属于整体交付证据。

### 结论

**后端段可集成：Yes。** 后端查询、原始证据归属及 HTTP 边界符合 Task 1 规格，当前段无修复项。UI-05～UI-10 整体结论待剩余差异接续后给出。

## 第二段：Task 2 声明类型与本地图标

范围：`review-identity.diff`、新声明类型行为测试、`nodeIdentity.tsx/css/test.tsx` 与 `public/fonts/` 来源、复现和完整许可；结合 Graph ID 参数、TS AST 收集规则、Python Scope 及 strict snapshot schema 核对兼容性。

### 规格符合与质量

- AST 元数据独立于稳定 ID 参数：TS 原 `SyntaxKind` 和 Python 原 class/function 种类继续用于 ID，新增 method 信息只写元数据。测试固定历史 class/method ID，并确认空行变化后 ID 保持。
- 可选 `declarationKind` 同步进入 strict schema，旧快照删除该字段后仍通过校验；既有存储保存节点 JSON，适配此可选元数据。
- TS 区分类、函数、方法、constructor/accessor、类函数属性；Python 区分直接类成员与嵌套函数，静态/异步成员保留 method 类型。
- UI 优先 AST 类型，旧数据只从明确 class 签名回退；未知声明显示原名和类型文字。类、目录、文件与外部依赖均独立呈现，method 保留 qualifiedName 所属信息，派生标签保持原名与 ID。
- 本地六字形 WOFF2 经 CSS 本地路径加载；加载等待/失败返回通用图形，名称和类型文字始终可见，图标 aria-hidden。离线资源衔接与屏幕阅读器文字具有独立回退。
- 字体 README 固定 Nerd Fonts commit、映射、SHA 与可复现工具步骤；随资产保存完整 Font Awesome OFL、Symbols MIT 与综合许可，派生字体家族重命名符合保留名称要求。

### Findings

- **C（Critical）：0。**
- **I（Important）：0。**
- **M（Minor）：0。**

### 验证证据

引用 `task-2-report.md`：AST RED 2 失败；UI 行为 RED 3 失败；GREEN 3 文件/59 项通过；补充固定历史 ID 后新增两文件 5 项通过；相关 ESLint、indexer typecheck 与 core build 退出 0。字体元数据六 cmap/字形与子集复现逐字节一致为实现者已执行证据。报告将本地 Chromium 尝试归为 setup failure，浏览器字体真实加载仍由主 Agent 的统一验收覆盖。

### 暂置行为与原因

- 索引器原有声明覆盖范围（例如未收集的 class expression）：本次补充现役节点元数据，现有范围由项目静态索引能力跟踪。
- Canvas/规划投影接入及真实浏览器字体显示：后续共享模块差异与统一浏览器证据接续审查。

### 结论

**声明类型与图标段可集成：Yes。** Task 2 与 UI-09 本模块规格一致，稳定 ID、旧数据与字体回退边界清晰，当前段无修复项。整体结论待 Canvas/Workspace/UI-10 差异接续。

## 第三段：共享前端 UI-05/06/07/08/10

范围：`review-frontend.diff` 所有追踪差异与新增模块全文；补读共享 Workspace 现役导航、ProjectScope、投影/FocusRequest 和 React Flow MiniMap 实现，确认异步边界与集成路径。

### Strengths

- 拖动开始取消布局帧、点击延时、hover 与相机动画；漏斗偏移按项目/根/节点独立保存，普通图继续走现役布局持久化。
- 点击引用详情保留镜头，hover/focus 有 90ms 延时；实际 relationId 区分相同端点多次调用，文件聚合边缺少具体关系时提供带原始证据位置的精确预览边。
- 函数/文件详情以实际 context 页和 relatedNodes 展示名称、文件、行号、未知原因；默认引用、显式源码、规划事实标记及分页边界清晰。
- 详情关闭、项目切换、快照切换与引用跳转已有 generation/ProjectScope 保护和行为覆盖；跳转使用有预算图查询并通过稳定 ID 更新选择与面包屑。
- 待审入口依据服务端 valid 分类，逐项聚焦采用现役 ID；查看/选择与 approve HTTP 分离。批准继续提交实际 revision 并由现役 baseline 校验保护。

### Findings

**C（Critical）：0。I（Important）：3。M（Minor）：0。**

1. **I1：换选择时保留上一文件的引用证据。** `apps/web/src/app/workspace.ts:584` 的目录导航成功分支和 `focusPlan.emit`（原 diff 约 887–897）清 source/context 并改 selectedNode，却保留 fileContext、detailsOpen 与 relationPreviewId。文件详情→目录/目录面包屑或直接规划选择后，InspectionCard 可能用新对象标题展示旧文件成员与跨文件调用。完整清理或关闭 inspection 状态，并使相应请求失效；回归覆盖文件详情后的目录与规划导航。
2. **I2：规划关系固定选择被 hover 退出清除。** `apps/web/src/app/workspace.ts:706` 将所选变更关系放入 relationPreviewId；`apps/web/src/features/graph/Canvas.tsx:640` 的边 enter/leave 同样写该字段。用户选择规划关系后经过任意边并离开，高亮会清空，而 PlanOverview 的 aria-pressed 仍保留。将所选操作关系和临时 preview 分开，hover 结束恢复固定操作高亮；回归覆盖操作选择→临时预览→结束预览。
3. **I3：小地图外框扩展，SVG 继续采用默认尺寸。** `apps/web/src/features/graph/MapPanel.tsx` 给 MiniMap 的 style 只传 CSS 自定义高度，外框 CSS 设 420px/100%；React Flow 实现明确从 `style?.width ?? 200` 与 `style?.height ?? 150` 计算 SVG/viewBox。外框与真实 SVG 尺寸错位，影响展开地图的可见范围及操作坐标。主 Agent 在真实截图定位此问题；本审查独立核对了上述源码依据。传数值 width/height 对齐面板实际内容尺寸，并用真实 SVG 宽度断言确认。

三项均已及时交接主 Agent，集中修正后按限定差异复核。

### 验证证据及覆盖边界

- 沿用实现/主 Agent 记录：10 文件/68 项定向通过，新增 2 项竞态通过；web build 通过。已读取检查详情关闭/快照/项目隔离、原始关系、偏移根隔离、摆放及规划分类测试。
- `pending-plans.spec.ts` 的实际生产浏览器 1 项通过由主 Agent 提供：查看/操作选择保持未批准，显式确认绑定 revision/baseline，修订需重新确认，过期禁止确认。
- `graph-inspection.spec.ts` 真实浏览器仍在执行；首次错误路由 404 属测试设置，修正后复跑。测试源码覆盖镜头保持、唯一边、漏斗动画中拖动/分页偏移、地图导航与 Esc 层级。
- 真实 Flask 首次 projectionData 引用导致 focus 不生效已修正；主 Agent 提供实际卡宽 274px、pageerror 为零及本地字体成功解码证据。源码中的 FocusViewport 与 highlight decoration 已核对同一 projectionData 归属。
- I1/I2 对应完整状态切换与固定/临时关系叠加是当前定向覆盖缺口；I3 现有外框宽度断言应补充实际 SVG 宽度。上述针对性回归直接对应实际风险。

### 暂置行为与原因

- 狭窄画布展开地图时暂时收起详情，收起地图后回到原稳定选择：作为避免面板覆盖选中对象的空间适配方案评估；主 Agent 应在实际窄屏验收和现役说明中明确此行为。
- 全仓测试、原生其他 OS 与历史独立票据：本轮相称验证边界外，沿用项目既有状态。

### 规格/质量结论

**Ready to integrate：With fixes。** 后端、声明类型/图标与大部分共享交互符合批准规格；I1 的证据归属、I2 的稳定操作高亮及 I3 的真实地图尺寸需集中修正。整体最终批准结论待限定修正差异与已在执行的必要浏览器证据接续。

## 集中修正限定复核：I1/I2/I3

依据：`review-fix.diff`，由首次前端快照到集中修正的限定差异；沿用主 Agent 的 RED→GREEN 与实际浏览器记录。

- **I1 已关闭。** `emptyInspection` 将函数/文件 context、source、详情开关、临时及固定关系状态一起清理；目录导航、规划换选择、丢失范围、删除临时节点及核对统一接入。新回归覆盖文件详情→目录/规划，确认旧证据清空。现役 inspect/node/snapshot guard 与 source 选择保护保持有效。
- **I2 已关闭。** `fixedOperationRelationId` 与 `relationPreviewId` 分离；Canvas 优先临时 preview，结束后回到固定操作关系。新测试覆盖固定关系→临时预览→结束预览，并确认规划批准对象保持。选择、关闭及导航清理固定关系。
- **I3 已关闭。** MiniMap 获得数值 width/height，外框与 SVG 同步；浏览器新增 SVG 实际宽度断言。主 Agent 记录 graph 已通过该断言及地图拖动/漏斗拖动/分页偏移。
- 通用方向图例准确覆盖 imports/规划关系；class/method 的 card meta 使用 AST 身份；桌面纵向停靠保持 320–400px；窄画布地图收起详情有即时说明。上述补充与现役文档对应，当前修正差异未发现新增 C/I/M。

验证来源：集中修正最终 10 文件/74 项定向通过，web build 退出 0；5 个必要浏览器场景中 focus 3 项与 pending 1 项通过。graph-inspection 新滚轮断言仍失败，实施者正在定位实际原因；该场景最终结果与补充差异保持 pending，按新实际问题接续。

**三项集中修正：通过。当前开放 C/I/M：0；整体运行态结论 pending。** 小地图滚轮是已由实际验收发现的当前未完成行为，整体交付需该补充修正/证据完成后给最终结论。

## 最后地图修正与整体结论

限定源码依据：`review-map-fix.diff`（110 行）。展开时捕获选择的几何锚点，地图 side/top/height 与详情暂收分支按该锚点固定，地图自身导航引起的视口变化保持面板位置；收起/重新展开按当前选择重新计算。SVG 数字宽高与外框高度共同按 SVG+112px 预算，总高最多 280px。新增实际面板位置稳定断言，并将真实 wheel 事件明确发送到 SVG。

**最后限定差异无新增 C/I/M。** 该修正消除了滚轮操作前面板换侧造成指针落到详情行的问题，继续共用原图与视口，保持规划状态。

### 最终证据核对

- `artifacts/graph-inspection/graph-final-results.json`：2026-10-09 09:45 UTC，graph-inspection **1 项通过**，单项 6070ms，无失败/跳过/page suite errors；本审查读取实际 JSON。覆盖拖动不弹回、分页偏移、唯一关系、实际 SVG 宽、地图拖动/wheel/按钮/点击及 Esc。
- `artifacts/graph-inspection/regression-results.json`：此前集中场景 **4 项通过/1 项失败**，通过项为 focus 3 项与 pending 1 项；唯一 graph wheel 失败由上述最终单项复验关闭。两份证据按各自执行范围引用。
- `artifacts/graph-inspection/browser-final.json`：真实 Flask page errors 为空，字体 loaded=true，map 420×280、y=674；selected y=505.1469、h=151.8000，底部 656.9469，小地图与选中卡保持约 17px 间距。展开时详情暂收，稳定选择保留。
- `demo.json` 与实际最终记录：演示规划 `67c7b2bd-0ffd-40a4-b400-3f4135f2f21f`、revision 2、baseline `snapshot:fcc9c8eaf26bae545dd3307b53c21126`，approved=false；真实索引 83 文件/1575 函数类/6283 关系。本地字体成功加载。
- 主 Agent 提供最后 web build 退出 0，以及真实 Flask 引用/地图恢复、浅深色、900px、文件详情的实际通过记录；`task-3-report.md` 的 74 项定向、tsc 与 lint 精确范围已核对。审查全程沿用这些已执行证据。

### 最终 Assessment

**Ready to integrate：Yes。C0 / I0 / M0，I1/I2/I3 已关闭。** UI-05～UI-10 的本轮修改符合批准规格及合理使用预期；证据归属、稳定类型/ID、拖动/分页与请求隔离、精确关系高亮、可操作地图和显式规划批准均有源码及对应行为证据。

当前产品边界保持静态 unresolved/external 与旧快照未知声明的如实展示；窄画布展开地图暂收详情的空间适配已告知并同步文档。合并/推送及其他 OS/历史票据由主 Agent 按当前授权和现役状态管理。公开交付说明应引用本报告终态与两次浏览器各自实际范围。

## neat-freak 审查交接

| 事实面 | 状态 | 当前事实 |
| --- | --- | --- |
| 代码 | verified-current | 全部模块、I1/I2/I3 集中修正及最后地图差异已独立审查，开放发现为零 |
| 运行态 | verified-current | 后端 HTTP、74 项定向、最后 web build、focus 3 项/pending 1 项、graph 最终 1 项与真实 Flask/字体已有实际证据 |
| 文档 | changed-and-verified | 本报告是本次审查唯一结果入口；contracts/README/state/Tickets 由主 Agent 整体收尾 |
| 规则 | verified-current | 已批准设计、项目授权、只读范围和门禁预算均用于本段 |
| 记忆 | not-applicable | 本段无记忆维护 |
| 工作区 | verified-current | 唯一新增文件为本报告；其余工作树保持实现者所有权 |
