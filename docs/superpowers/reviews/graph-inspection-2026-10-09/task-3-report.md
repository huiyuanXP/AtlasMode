# Task 3：Canvas / 引用详情 / 小地图交接

日期：2026-10-09 UTC。独立实现范围 UI-05/06/07/08；UI-09组件由类型agent提供，UI-10由主Agent接线。当前成果在共享work工作区，保留已有修改。

## 实现与消费者接口

- `workspace.ts`：新增 `detailsOpen`、`fileContext`、临时 `relationPreviewId`、持久 `fixedOperationRelationId`。
- `inspectNode(node, offset=0)`：画布选择，保留现有FocusRequest，查询当前快照引用，源码由显式按钮读取。既有 `selectNode` 导航消费者默认行为保留；第三参数支持 `{focus, source}`。
- `closeInspection()`：清选中与全部详情证据，使inspect/source在途请求失效，同时导航generation递增，阻止在途引用跳转恢复关闭的详情。
- `pageInspection(offset)`、`loadSource()`、`previewRelation(id?)`、`jumpToNode(id)`：引用分页、显式源码、临时唯一边预览、有预算80节点查询后导航至真实ID。
- `focusOperation(op)`：逐项规划聚焦；有预算加载真实事实/删除关系端点，设置两端FocusRequest及持久关系ID，保持规划revision/批准。
- `Canvas` 新接线：`projectId`、`selectedNodeId`、`relationPreviewId`、`fixedOperationRelationId`、`previewRelation`、`previewNodes`、`inspection`槽、关闭/关系预览回调。WorkspacePanels已于主Agent要求时明确移交；后续UI-10接线归主Agent。
- 拖动取消布局RAF、点击延时和镜头动画；普通图保存现有view，漏斗按项目+root+node保存本会话临时偏移。翻页/hover/详情保留偏移，重新排列清当前root偏移并适配当前范围。
- `inspectionHighlight` 保留原始projectionData以支撑ReactFlow显式聚焦的投影采纳检查；90ms节点hover与键盘focus预览；固定选中、关系ID与临时hover按共享状态呈现。临时关系离开恢复持久规划关系。
- 文件原始引用在聚合图中以单条真实relationId证据预览覆盖边显示，标签明确“证据预览”与调用位置；预览结束移除覆盖线。原图保持当前加载的聚合事实。关系行点击进入有预算函数图。
- `InspectionCard` 展示函数/文件/规划实际证据、成员、imports、分页与源码按钮；重复同端点调用保留各自ID与源码证据。imports按真实方向跳另一端。函数已解析分组明确本页数量和全体outgoing总数；unknown标本页。规划description/目标文件/实际规划关系保持可读。
- NodeIdentity集成卡片标题/详情；卡片meta也使用实际声明typeLabel，class/method与标题保持一致。
- `MapPanel` 在ReactFlow同一图/视口上使用真实数字style宽高，默认145×85，展开宽度最多420、图区高度最多168，总高上限280并按选中可用空间缩小。支持视口拖动、点击、wheel、按钮缩放、选择定位与当前范围适配，明确已加载对象数。空间使用纵向详情或较窄时，展开地图暂收起详情并显示恢复提示，关闭地图恢复同一选择与证据。
- Esc按展开地图→详情→漏斗处理。空白清选中，保留位置与镜头。

## 精确证据

1. 新Workspace初始4项行为测试先失败（缺少inspectNode接口）；实施后与既有Workspace/Funnel共32项通过。
2. 独立高亮/偏移模块初始缺失失败→4项通过。后续窄画布避让、projectionData采纳与桌面纵向卡宽各观察失败后修正。
3. 引用详情组件初始缺失失败→2项通过（同名端点/唯一调用证据、规划关系）。
4. 独立审查指出文件详情→目录/规划残留：新增2项实际状态回归先失败，修正完整inspection清理后通过。
5. 持久规划关系被hover清空：既有逐项focus测试改为期望固定关系并观察失败，分离临时/持久状态后通过；临时hover结束仍保留持久ID。
6. 地图wheel首轮集中用例实际失败：XYMinimap wheel直接scaleTo，trace截图显示导航导致地图换侧、鼠标落到详情关系行。现固定展开时的selection几何锚点/侧边/暂收分支，保持pan/zoom期间面板位置；将SVG和按钮/恢复提示的总高预算明确为SVG+112、最多280。新增面板位置稳定与SVG内实际wheel断言，最终单项重跑归主Agent。
7. 最终定向单元命令：

```sh
npx vitest run apps/web/src/app/inspection-workspace.test.ts apps/web/src/app/workspace.test.ts apps/web/src/app/funnel-workspace.test.ts apps/web/src/features/graph/inspection.test.ts apps/web/src/features/graph/InspectionCard.test.tsx apps/web/src/features/graph/funnel.test.ts apps/web/src/features/graph/projection.test.ts apps/web/src/features/navigation/workspace-navigation.test.ts apps/web/src/app/WorkspacePanels.test.tsx apps/web/src/features/chat/workspace-sync.test.ts
```

2026-10-09 09:39 UTC：**10文件74项通过**。

8. `npx tsc -p apps/web/tsconfig.json --noEmit` 最终退出0；Canvas/inspection/InspectionCard/MapPanel/workspace/新增测试及本次调整的e2e/helper定向ESLint退出0。
9. `tests/e2e/graph-inspection.spec.ts` 已由主Agent运行首轮通过1项（7.4s），验证多入口聚焦可读尺寸、hover/单击镜头保留、重复调用唯一高亮、显式源码、漏斗真实拖动/500ms不弹回/分页偏移/普通view隔离、地图按钮缩放/点击与Esc分层。其后本轮集中修正新增SVG实际宽度、拖动与wheel真实视口变化断言，由主Agent顺序执行最终web build及graph/pending/focus三文件浏览器。
10. 主Agent真实Flask页面揭示projectionData装饰引用、地图SVG默认200×150及提示增高后遮选中卡的问题；本轮修正已纳入当前源码，真实页面与截图最终复验归主Agent。

## 直接受影响测试适配

- `tests/e2e/focus-navigation.spec.ts`：卡片名称从原名strong切到NodeIdentity标签；Esc先关详情再退出漏斗；关详情后重新通过搜索选择函数再走文件路径。既有真实坐标/可读尺寸/动画/reduced-motion断言保留。
- `tests/support/chat-shell.mjs`：`openSourceDrawer`将“查看源码/View source”按钮限定在`.inspector`，适配新增详情卡拥有相同明确动作。
- 新graph e2e最初使用了文件context风格的函数URL，收到实际404后改为现役`/functions/:id`路由。

## neat-freak 范围收尾与状态

已读取neat-freak技能，按本子任务范围记录当前解释与剩余验收，权威README/state/UI-05～10由主Agent集中更新。

| 事实面 | 状态 | 当前事实 |
| --- | --- | --- |
| 代码 | changed-and-verified | 定向74项、web tsc、专属lint退出0；Canvas/Workspace文件明确移交 |
| 运行态 | pending | 最终集中修正后的浏览器与真实Flask验收由主Agent执行；首轮新E2E1项通过 |
| 文档 | changed-and-verified | 本报告记录现役接口、实际结果与剩余验收；项目权威入口由主Agent同步 |
| 规则 | verified-current | 遵守共享文件所有权、相称定向验证、额外门禁预算0；使用现有checkout |
| 记忆 | not-applicable | 本子任务使用当前代码与交接文档作为事实来源 |
| 工作区 | verified-current | 新模块/测试均为交付文件；本子任务未创建临时服务器/仓库/缓存或提交 |

## 主Agent剩余验收

- 集中修正后的web build及graph/pending/focus浏览器行为（尤其实际SVG宽、视口拖动/wheel和旧source helper）。
- 真实Flask浅/深色、窄屏、文件原始证据预览、地图暂收详情后恢复、选择可见与浮层避让截图。
- 同一独立reviewer限定复核本轮修正，汇总UI-05～10票据与最终权威状态。
