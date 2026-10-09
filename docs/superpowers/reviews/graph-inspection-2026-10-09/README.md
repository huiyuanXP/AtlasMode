# 图检查交互验收（2026-10-09 UTC）

状态：**UI-05～UI-10 已实现并完成本轮验收；独立审查通过，0 Critical / 0 Important / 0 Minor。** 设计见 [已批准设计](../../specs/2026-10-09-graph-inspection-design.md)，步骤见 [实施计划](../../plans/2026-10-09-graph-inspection.md)。

## 实际待审规划

- 固定 Flask 3.1.2：`2c1b30d0503cfb064f1cb252e6614a06915a362a`，本轮真实索引83文件、1575函数/类，6283关系。
- 标题：**演示规划：为 Flask 请求分发记录耗时**。
- planId：`67c7b2bd-0ffd-40a4-b400-3f4135f2f21f`；revision：**2**；baseline：`snapshot:fcc9c8eaf26bae545dd3307b53c21126`。
- 变更：新增 `record_request_timing(elapsed_ms)` 于 `src/flask/observability.py`；规划 `Flask.full_dispatch_request` 调用它；添加保留现有异常处理与返回结果的说明。
- 当前为真实已保存草稿，批准为空；目标源码保持当前快照。校验保留接口兼容性待人工核对提示。
- 独立数据：`/tmp/atlasmode-graph-inspection/data`；本地服务端口44320。旧 Tunnel 已按本轮用户回复关闭。
- 本地重开命令：`CODEMAP_AGENT_PROVIDER=codex CODEMAP_CODEX_PROFILE=mimo CODEMAP_PORT=44320 CODEMAP_DATA_DIR=/tmp/atlasmode-graph-inspection/data npm start`（现有服务运行时直接使用当前实例）。
- 页面选择 Flask，点击右侧「待你审查 · 1」→「查看改动」。实际打开记录及图片在 `artifacts/graph-inspection/`，JSON导出为 `plan.json`。

## 验收结果

| Ticket | 用户可见结果 | 实际证据 |
| --- | --- | --- |
| UI-05 | 普通/漏斗所有卡片可拖，根节点位移隔离，翻页保持，重新排列恢复 | 真实拖动坐标、500ms保持位置、翻页与普通view隔离断言通过 |
| UI-06 | 悬停/键盘预览、点击持久选择、唯一关系联动及方向文字 | hover/单击保持镜头，同端点多调用仅高亮真实ID；规划固定关系在临时预览后恢复 |
| UI-07 | 函数/文件引用详情、分页/跳转、成员与跨文件证据、显式源码 | 真实查询/HTTP边界、关闭/导航/项目与快照隔离通过；Flask函数与文件页面已查看 |
| UI-08 | 展开地图、视口框拖动、点击定位、滚轮/按钮缩放、回选择/适配/收起 | SVG实际尺寸、固定面板位置与真实视口变化通过；Flask地图420×280，距选择底边约17px |
| UI-09 | 函数/方法/类/目录/文件类型与本地图标 | AST、旧schema、稳定ID与字形回退通过；1,144字节WOFF2真实浏览器加载成功 |
| UI-10 | 固定待审数量、目的/变更、逐项聚焦与单独确认 | 打开/逐项选择保持未批准；显式批准绑定版本/基线；修改后重审；过期禁用 |

空间受限时详情停靠画布上/下边缘；展开地图期间暂时收起详情并给出恢复提示，收起地图恢复同一选择与引用。展开期间地图位置固定，保持连续拖动/滚轮操作。

### 精确验证范围

子任务记录保留各自移交时的验证阶段，本页与最终审查报告给出整轮终态。

- 文件/函数引用：4文件29项通过，相关lint通过，见 [后端记录](task-1-report.md)。
- AST声明类型与图标：3文件59项通过；补充固定ID后5项通过，见 [类型记录](task-2-report.md)。
- Canvas/Workspace/导航相关：10文件74项通过，见 [画布记录](task-3-report.md)。
- 待审组件：4项通过；共享接线与本次变更文件定向lint通过，见 [待审记录](task-4-report.md)。这些定向计数按命令分别记录。
- core/indexer/server/web构建通过，相关类型检查通过。最后前端构建产物为 `index-SHgE0-ZD.js`（528.55KB，gzip169.69KB）。
- 浏览器最终相关场景共5项获得通过证据：同一轮focus-navigation 3项与pending-plans 1项通过，新graph滚轮断言失败；定位地图随视口变位后修正，**仅复跑graph 1项通过（6.1s，运行总7.0s）**，保持已过4项原证据。
- 实际Flask：浅/深色、900px窄窗口、函数与文件详情、本地图标、展开/收起地图恢复、浮层避让均检查；page errors为空。演示规划r2仍未批准，目标Flask Git HEAD固定且工作树干净。
- 浏览器收据：`artifacts/graph-inspection/regression-results.json` 保留前轮4通过/1失败；`graph-final-results.json` 保留最终单项通过；[实际DOM与规划状态](browser-final.json) 记录最终布局/字体/未批准状态。

### 审查与已解决问题

一次必要独立审查按模块接续，最终 [审查报告](review.md) 为 **Ready to integrate: Yes，0C/0I/0M**。
引用数据切换归属、固定规划关系与临时hover隔离、小地图真实SVG尺寸三项均已修正并限定复核。真实页面发现的投影聚焦就绪判断、地图移动导致滚轮失效及面板高度遮挡均有对应修正和实际验收。

截图位于 `artifacts/graph-inspection/`：`pending-light.png`、`references-light.png`、`references-dark.png`、`references-narrow.png`、`map-light.png`、`map-narrow.png`、`file-references-light.png`，均为本地验收产物；报告提供 [草稿JSON](plan.json) 与 [运行标识](demo.json)。

## neat-freak 文档收尾

| 事实面 | 状态 | 说明 |
| --- | --- | --- |
| 代码 | changed-and-verified | 六票实现、必要定向测试与独立审查通过 |
| 运行态 | changed-and-verified | 独立本地44320服务及真实Flask验收；旧Tunnel已按授权关闭 |
| 文档 | changed-and-verified | README、first-plan、contracts、设计/计划、state与六票及索引就地同步，本页为本轮验收权威入口 |
| 规则 | verified-current | 保留原AGENTS.md修改，CLAUDE指向现役规则，vendored技能保持原样 |
| 记忆 | not-applicable | 本次使用项目文档和正式验收记录承接知识 |
| 工作区 | verified-current | 当前work保存改动；实际待审数据库与截图保留供验收，本轮无用临时目录/字体工具已清理 |

额外门禁预算0；必要编译、行为测试和一次分段独立审查随本轮改动执行。新失败按具体问题补测，已通过场景沿用其阶段证据。

## 当前限制

静态 unresolved/external 按证据展示；旧快照未知声明保持原名与类型文字，刷新后补齐AST信息。
现有双Chat与Codex Profile/API认证保持原结构与配置。Vite主脚本约529KB的分块建议和Playwright宿主颜色环境提示保留。

全仓历史测试总数、原生Windows/macOS、新远端CI与公网验收属于本轮范围之外；本轮结果采用上表实际命令与本地浏览器证据。当前改动保留在work工作区，后续集成按用户指定的交付方式执行。
