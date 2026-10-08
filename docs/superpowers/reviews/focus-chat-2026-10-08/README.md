# Focus、漏斗、路径与本地 Agent Chat 交付

用户要求操作后可见变更、双击漏斗动画、可点击路径及Chat主界面，随后明确复用本机现有Codex/Profile API认证而不重新Device登录。剩余规格均已登记为有依赖/验收的版本化 [Tickets](../../../tickets/README.md)；本轮实现UI-01/02/03/04、AG-01/04和QA-01。源码自动实施AG-02、Windows原生Agent所属Job AG-03、独立直接API适配器AG-05以及原有索引/知识/分组等积压仍按各票保留，未冒充全部产品完成。

## 已实现

- 成功新增/修改/删除/改接/撤销/重做与选择规划按受影响节点自动聚焦，旧请求不抢镜头，手动布局/主题不改批准语义。
- 函数/文件依赖漏斗，以唯一当前对象为中心，上游在上、下游在下；300ms位移、减少动态效果和退出恢复；文件来自真实导入/跨文件调用，包含关系不冒充依赖。
- 项目→目录→文件→函数路径可点击；真实索引与未来规划文件分开，异步导航和同名路径正确处理。
- 左侧探索Chat，右侧规划概述与规划Chat，源码/高级编辑显式打开；直接搜索保持可用。取消/错误后读取实际已保存草稿，按项目隔离会话、保留输入，不展示原始工具参数/推理。
- 本机Codex配置与安全命名Profile合并，保留选定模型/Provider/catalog及既有认证；API env_key不依赖login status。可复用现有账户认证，原生工具限制及绑定项目MCP不丢失。
- 真正的Test入口：`npm run test:mcp` 与 `npm run test:agent -- codex mimo`，没有生产假回复。

## 精确验证

产品基线c1e5a96（ce171ff仅文档）最终一次七包build/typecheck、根lint通过，`npm test` **636项/50文件通过**；`npm run test:e2e` **12项通过**（59.2s）。覆盖新Chat/焦点/漏斗/路径与原规划UI+SDK批准、导出、重启持久化、核对及配置/CommonJS展示。日志 `artifacts/final-2026-10-08/`。Vite大于500KB chunk提示及宿主NO_COLOR/FORCE_COLOR提示保留；未宣称输出无warning。

真实SDK测试PASS：通用16工具、绑定项目18工具、函数上下文、实际SQLite草稿revision3、版本冲突/跨项目拒绝及目标sentinel未执行。

真实原生模型PASS：使用 `CODEMAP_AGENT_COMMAND=/opt/infrastructure/managed/current/Runtime/bin/codex npm run test:agent -- codex mimo`，实际 `mimo-v2.6-flash` / Provider `mimo` / `api-environment`，完成MCP规划提交和未批准草稿revision2，源码未执行。现有默认wrapper仅加载既有凭据后执行同一原生binary；本轮未重复收费验证wrapper路径，也未收费验证GPT/Gemini。早期账号login-status阻断、模型目录遗漏、工具缺失metadata导致自动执行被拒绝均保留为历史失败，后续修复后的真实PASS单独记录。

真实Flask3.1.2中型仓库重新索引83文件、1575函数/类，调用714已解析/2176未解析/1029外部；Chromium操作full_dispatch_request漏斗、app.py路径跳转及双Chat就绪，页面错误为空，浅/深色及文件图截图已查看。首次文件高扇出图显示过小，触发UI-02额外可读性修正；该修正的实际验证追加在下方，以上636/12不冒充修正后全量重复运行。

## 工作约束与收口

保留当前work checkout，不新建worktree、不push/merge、不重启Tunnel。独立设计审查和唯一限时关键Agent进程/写入复核记录见父目录相关review；最新用户限制非关键重复门禁后，UI票据采用相称行为验证与主控集成检查。关键复核的Windows后代清理缺陷已用启动前拒绝修复，普通Windows HTTP/UI/MCP仍保留原支持；真实Windows所属Job另票。

模型直连API是下一票AG-05；本次Profile通过API认证运行CLI，不等于已经实现独立HTTP模型适配器。源码实施仍需用户批准后专门执行模式AG-02。Express完整入口FAIL及历史能力限制未在本票解决。

## 最终漏斗可读性修正（867b25c）

漏斗专用padding0.08；桌面每侧3卡，窄窗口1/2卡，独立方向分页。真实双向节点只展示一次并标记总数，未显示相关项不冒充无关。最终4项布局测试、3项浏览器场景、webbuild/typecheck及相关lint通过；浏览器覆盖原操作focus/动画funnel和新增高扇出页面，没有重复根636/12。详细 [报告](ui02-readability.md)。

真实Flask full_dispatch_request：1上游/4下游，页面显示1–3/4及4–4/4，卡片240.23px/最后一页280.5px。app.py：36上游/14下游，其中7双向，页面3上游+3下游均240.23px；上游翻页显示4–6/36，未知/外部174明确保留。4张实际PNG与flask-readable-evidence.json位于artifacts/final-2026-10-08/，controller实际查看了函数与文件/翻页截图。最后新增双向数量文字晚于这些PNG，仅布局/标签字段检查，无伪造刷新图片。

最终所有产品代码已保存在work；本次新Test文档、脚本与Tickets随收口文档提交。删除15个已消耗的文档/调试临时文件，测试自建进程/临时库由finally清理；保留可能含用户演示编辑的旧demo数据及下次验收所需Flask checkout、实际截图/日志。外部AGENTS.md修改未覆盖或代为提交。
