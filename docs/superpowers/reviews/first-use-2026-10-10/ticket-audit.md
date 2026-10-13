# AtlasMode 只读票据审计

2026-10-10 UTC。VM2 /home/agent/projects/AtlasMode，HEAD d1638d0aee2de86af213fc3641573bae7a582eab；工作树含主控制器首用UI未提交改动。未修改远程源码、票据状态、凭据、sessions或Herdr。

计数：本地 docs/tickets 为36票，13 DONE、23 TODO，0 CLAIMED/REVIEW/PARTIAL。GitHub已连接工具真实逐票读取 #1–#7及评论，7 open、0 closed，7票评论数组均为空；open搜索也仅返回这7票。这两套计数不可相加当成独立工作量。旧“约32”不是当前精确数。

验收口径：下表核对现存源码、测试及正式历史报告；本轮不重新运行测试，不把历史PASS称为当前首用改动后的PASS。DONE表示限定交付已有证据支持，仍有平台/模型范围限制。未通过/证据不足保持未通过。

| GitHub ID | 状态/评论 | 依赖 | 实现及证据 | 审计结论 |
| --- | --- | --- | --- | --- |
| #1 | open / 0 | #2–#7（父票明示） | core/indexer/storage/service/server/web/mcp均存在；T01–T08报告及规划E2E | 不可关闭：#3导入备份缺口、当前首用UI待验、完整范围无逐条映射 |
| #2 | open / 0 | core/indexer（实现依赖推定） | scan/typescript/commonjs/configResolution；index.test/commonjs.test；真实Vite/Flask历史验收 | 基础实现已有；rename候选迁移及完整验收映射不足，不判整票PASS；Express入口FAIL不掩盖 |
| #3 | open / 0 | storage/service | sqlite.ts/migrations/001-records.sql；sqlite.test/workspace-lifecycle；知识事务与历史 | PARTIAL：KN-02与DATA-01仍TODO，schema导入冲突及备份入口未通过 |
| #4 | open / 0 | #2/#3（推定） | Canvas/Inspector/GroupsPanel/PoliciesPanel；真实导航与布局报告 | 已实现核心浏览；首用默认图当前在修，不能用旧截图判当前PASS |
| #5 | open / 0 | core/service/#2（推定） | planning.ts/validation.ts/PlanEditor；planning.spec.mjs | 版本/hash/baseline/语义失效/布局保留/拒绝伪审批有源码及E2E；整票未逐条重新验证 |
| #6 | open / 0 | server/service（推定） | apps/mcp/src/server.ts；client.test/scope.test/mcp-stdio.test；官方SDK实际工具调用报告 | 主链实现且真实SDK PASS；不能将16/18工具计数替代票要求的所有知识CRUD逐项映射 |
| #7 | open / 0 | #2–#6（推定） | planning.spec.mjs:18/146/184/593/628；verification.ts；UI/SDK重启及绕过负例 | fixture闭环已有，593后是测试写源码，不能冒充原生Agent自动实施（AG-02 TODO）；整票未判PASS |

GitHub的open是平台状态，以上实现判断不等于已关闭；未自动更新Issue。

| 本地ID | 当前状态 | 依赖（票正文） | 实现/验收证据或缺口 |
| --- | --- | --- | --- |
| AG-01 | DONE | 无（与图导航并行；UI-04 集成二者） | apps/server/src/agent/{bridge,native,process}.ts；bridge/native/process/platform-refusal tests；d240a25/b091523；26/16/18定向；Windows原生Chat不支持 |
| AG-02 | TODO | AG-01、UI-04、QA-01 | 只读规划Chat已有；自动源码实施未实现，安全写入独立设计 |
| AG-03 | TODO | AG-01、QA-02 | platform-refusal已有Windows拒绝；原生Job未实现 |
| AG-04 | DONE | AG-01 | apps/server/src/agent/profile.ts + profile.test.ts；c1e5a96；Mimo真实MCP→r2草稿PASS；GPT/Gemini仅配置就绪 |
| AG-05 | TODO | AG-04、QA-01 | CLI Profile已走API认证；独立HTTP模型适配器未实现 |
| DATA-01 | TODO | KN-02 | sqlite.ts已有事务/持久化；一致备份恢复未通过 |
| DIFF-01 | TODO | IDX-04 | 按依赖尚未验收；票正文有明确验收要求，无完成证据，保持TODO |
| FS-01 | TODO | UI-03 | 规划目标文件表单已有；拖入目录补全/预览未通过 |
| FUT-01 | TODO | DIFF-01 | 按依赖尚未验收；票正文有明确验收要求，无完成证据，保持TODO |
| GRP-01 | TODO | UI-04 | GroupsPanel.tsx/memberBindings已有组编辑；圈选创建未通过 |
| GRP-02 | TODO | GRP-01 | 按依赖尚未验收；票正文有明确验收要求，无完成证据，保持TODO |
| GRP-03 | TODO | GRP-02 | 按依赖尚未验收；票正文有明确验收要求，无完成证据，保持TODO |
| IDX-01 | TODO | 无 | commonjs.ts/commonjs.test.ts、forwarding-resolution.test.ts 已有转发；完整Express入口历史FAIL仍未解 |
| IDX-02 | TODO | IDX-01 | packageCapture.ts有scope输入；workspace/exports源码映射未验 |
| IDX-03 | TODO | IDX-02 | configCapture/configResolution已实现extends/checker；references图不是已完成 |
| IDX-04 | TODO | IDX-03 | 按依赖尚未验收；票正文有明确验收要求，无完成证据，保持TODO |
| KN-01 | TODO | UI-04 | knowledge.ts已有绑定知识；独立注释/显式重绑未通过 |
| KN-02 | TODO | KN-01 | 导入schema/冲突预览未通过；直接影响GitHub #3 |
| OPS-01 | TODO | QA-02 | 历史bundle恢复曾验；fresh-cloud与分发仍未通过 |
| PERF-01 | TODO | IDX-03 | 按依赖尚未验收；票正文有明确验收要求，无完成证据，保持TODO |
| PERF-02 | TODO | UI-02 | funnel布局已实现；全局布局未通过 |
| POL-01 | TODO | UI-04 | PoliciesPanel.tsx已有内存/DB策略；structure.json双向原子同步未通过 |
| POL-02 | TODO | POL-01 | 按依赖尚未验收；票正文有明确验收要求，无完成证据，保持TODO |
| QA-01 | DONE | UI-04 | docs/test/README.md；tests/integration/mcp-stdio.test.ts；真实SDK16/18工具、Mimo真实模型；不是所有客户端已验 |
| QA-02 | TODO | QA-01 | 真实Codex/Mimo收据已有；Claude/Windows交互退出/原SIGKILL因果未通过 |
| SEC-01 | TODO | 无 | 现有票要求braces/micromatch/fast-glob复核；本审计未访问网络包审计、整改未通过 |
| UI-01 | DONE | 无 | features/graph/focus.ts；app/workspace.ts；focus-navigation.spec.ts；ac8384b；52项/6文件 |
| UI-02 | DONE | UI-01 | features/graph/funnel.ts + funnel.test.ts；Canvas.tsx；focus-navigation.spec.ts；73be64b/867b25c；最终4布局+3浏览器 |
| UI-03 | DONE | UI-02 | features/navigation/{path.ts,Breadcrumbs.tsx}；breadcrumb-navigation.spec.ts；2ade73a；66项+3浏览器 |
| UI-04 | DONE | AG-01 | WorkspacePanels.tsx；features/chat/ChatPanel.tsx；agent-chat.spec.ts；594be0e；23项+2浏览器 |
| UI-05 | DONE | 无 | Canvas.tsx:712 nodesDraggable；graph-inspection.spec.ts；普通/漏斗位移与500ms保持 |
| UI-06 | DONE | 无 | inspection.ts + inspection.test.ts；唯一关系ID；graph-inspection.spec.ts |
| UI-07 | DONE | UI-06 | InspectionCard.tsx + test；navigation-query.ts + test；29后端查询；项目/快照隔离 |
| UI-08 | DONE | UI-05、UI-06 | MapPanel.tsx；Canvas.tsx:777；graph-inspection.spec.ts；滚轮失败修正后单项PASS |
| UI-09 | DONE | 无 | nodeIdentity.tsx + test；indexer/declarations.test.ts；本地WOFF2；59项+固定ID5项 |
| UI-10 | DONE | UI-06、UI-07 | PendingPlans.tsx + pending.test.tsx；pending-plans.spec.ts；4组件；r2真实草稿仍未批准 |

已DONE的共同证据入口：docs/superpowers/reviews/focus-chat-2026-10-08/README.md（c1e5a96历史636/50与12 Chromium）；graph-inspection-2026-10-09/README.md（后端29、声明59、画布74、待审4；浏览器前轮4 PASS/1 FAIL，最终graph单项修复PASS，独立0C/0I/0M）；docs/test/README.md（官方SDK与原生模型分别记录）。报告对测试时间/源码基线及未测平台区分明确。没有重算或累加各阶段测试为当前全套。

依赖索引与票正文有轻微差异：QA-01正文仅UI-04，README增AG-04；UI-04正文仅AG-01，README增UI-03。按README更严格的顺序实施，当前这些前置均DONE。

首批不需新凭据、权限或破坏性迁移的现有票：GRP-01（复用组持久化，补圈选与成员）；FS-01（只改规划归属预览）；KN-01（先评估现有知识格式是否容纳独立注释/重绑，再实现）；PERF-02（纯布局并保留手动位置）；IDX-01（已有失败证据、固定目标、保守分析安全修复，复杂需设计）。SEC-01可先只读审计锁链，升级需实际包网络与跨平台验证。POL-01会写structure.json，先做读取/校验/预览原型，写回需并发原子设计。

AG-05可实现适配器及协议fixture，不读取/修改凭据；真实Provider付费验证应沿已有授权配置由主控执行。AG-02源码自动写入、AG-03 Windows Job、QA-02真实Windows/Claude、OPS-01全新环境/分发不归入这批无外部条件即可完整验收的票。

当前主控制器修 fix/first-use-20261010；本审计不重复实现。完整Express entry FAIL、历史退出SIGKILL因果证据缺口、未恢复旧忽略Git图片、新云恢复及未实测客户端继续保留。无需为23 TODO创建新票。

