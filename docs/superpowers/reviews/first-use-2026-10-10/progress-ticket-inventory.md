# AtlasMode 阶段票据盘点

统计基线：原始台账 36 票，接手时已有 13 票 DONE、23 票未完成。本轮没有新增产品票据。

本轮原始待办中，已有完整实施、独立审查、实际交互或对应行为证据并推送完成的 **6 票**：IDX-01、IDX-02、IDX-03、GRP-01、GRP-02、SEC-01。台账累计为 19 DONE、17 未完成；既有 13 DONE 不重复计作本轮交付。首见页、布局与 CI 夹具修复是支持工作，不增加这 6 票。

| 本轮完成票 | 已推送实施提交 | 证据范围 |
| --- | --- | --- |
| IDX-01 | 68876cd | Express 严格入口、实际 HTTP/MCP/页面与源码不变证据 |
| IDX-02 | cfda22b | workspace/exports、配置快照、重启、实际 HTTP/MCP/页面 |
| IDX-03 | f01c1cb；c9b9206 收尾 | references 图、保守 unknown、实际页面；f01 四项 CI 成功 |
| GRP-01 | 6b03adf | 真圈选、完整成员编辑、共享成员、SQLite 与重启 |
| GRP-02 | 6566717 | 折叠/展开、真实端点、布局与规划流程；远端单轮 19 页面测试 |
| SEC-01 | 77e4554；fe4b52c 收尾 | 固定依赖零审计、隔离构建及原生 CI；不把待测外部 Provider 计入 |

当前实现中的票为 **FS-01、KN-01、POL-01、PERF-02**。模块测试通过或设计通过不等于整票完成。

| 未完成票 | 当前进度与具体依赖 / 阻塞 |
| --- | --- |
| FS-01 | 表单、过期预览/旧 tray 和非零 epoch 定向修复已独立 APPROVE；无 request 目标面板崩溃及原生拖放/刷新夹具 R3 已窄修并独立 APPROVE。隔离重建成功，单轮真实九项浏览器全部通过（31.2s），相关 51/5 单测通过；原始 1247 PASS/1 FAIL、首轮九失败和二轮 3 PASS/6 FAIL 均保留。仍须整合 KN/POL 页面接线并恢复原 planning 流程、全量检查；不提前标 DONE |
| KN-01 | 数据库迁移与审批模块复审通过；独立注释页面 41 项源测试通过，独立审查 APPROVE（空历史分页 Minor 待接线修）；notes HTTP/刷新原子接线 134/7 PASS 且独立 APPROVE；共享 Web 接线冻结：136/15、实际 HTTP/SQLite 4、四项 mounted 浏览器单轮通过；独立 high 审查 REQUEST_CHANGES 两恢复竞态（3a4468…），原作者正窄修；成功状态截图/运行收据待补齐，整票保持未完成 |
| POL-01 | 文件同步与恢复模块复审通过；服务接线两 Important 定向修复已独立 APPROVE，106 项源测试通过；UI/MCP 51 PASS 定向修复已独立 APPROVE；共享回调接线等 KN Web 冻结后串行，真实页面/业务 SQLite/stdio/重启尚待验收 |
| KN-02 | 设计三 Important 已定向修订并独立 APPROVE；依赖 KN-01 和 POL-01 稳定接口，导入先预览并显式应用，DB 知识和目录文件两个应用域各自收据 |
| DATA-01 | 依赖 KN-02；尚未完成一致备份、恢复与中断保护实施/验收 |
| POL-02 | 依赖 POL-01；允许/禁止/带理由例外及批准新鲜度尚未实施 |
| IDX-04 | 设计复审通过、测试路径 Minor 已修；等待共享 core/KN 绑定接口窗口，身份候选须用户显式接受 |
| DIFF-01 | 依赖 IDX-04；设计 3 Important/1 Minor 已窄修并独立 APPROVE（398f3…）；bounded 历史存储读取和身份生产前置仍未实施；不能以零入边推断死代码 |
| GRP-03 | 设计复审通过、两 Minor 已修；依赖 FS/KN/POL 共用规划接口冻结后实施 sequence/wrapper 流程 |
| PERF-01 | IDX-03 已满足前置；设计 root 见证 Important 已窄修并独立 APPROVE（117b723…）；增量索引/监听的一致性、回退和真实中型性能尚未实施 |
| PERF-02 | 设计预算缺口修订后已独立 APPROVE；纯 target/布局/Worker controller 73/4 PASS、超时边界窄修独立 APPROVE；bounded HTTP/API Window B 104/6 源测试通过且独立 APPROVE（90c777…）；共享 client 等 KN 串行释放，真实 Worker/画布/中型性能未测 |
| QA-02 | 仍缺真实 Codex/Claude 两客户端接入收据、Windows 交互 Ctrl+C；原生 CI/SDK 不替代这些；历史 SIGKILL 因果仍未证明 |
| OPS-01 | 依赖 QA-02、可恢复备份/分发成果；独立新云目标与相关授权尚未具备，本 VM 临时目录不算新云验收 |
| FUT-01 | 依赖 DIFF-01；额外语言、GitNexus、运行时证据、远程多人分别评估，不提前标完成 |
| AG-02 | 设计复审通过；依赖 KN 当前 v1 批准守卫、POL 新鲜度和写入前复核接线；源码 writer 尚未实施 |
| AG-03 | Windows 自有 Job helper 设计定向复审已 APPROVE（仅设计）；已授限定 native/protocol/build 脚本源码窗口；12 新源首窗口及 harness I1 窄修冻结，28 项窄验证通过、独立 SOURCE checkpoint APPROVE（ecc43d6…）；Unicode M1 原生证据门保持，源码/portable C++ 通过不替代实际 Windows 证据，不提前解除原生 Chat 限制 |
| AG-05 | HTTP/SSE/真实 SDK MCP 实施已推送；仍缺当前真实外部 Provider 配置和最小真实调用授权/收据，保持 PARTIAL |

支持工作：夹具提交 84fd8b3 已推送，CI 38072384523 四项全部成功。实际 Windows 日志为 configCapture 26 项通过、全体 863 通过/18 跳过；浏览器单轮 19 项通过。本支持工作不计用户票完成，也不替代 QA02 的真实客户端/交互退出。原 c9 Windows 超时和清理失败日志、隔离首次缺 core 入口失败、修复的 RED/GREEN 均保留。

资源收尾尚未宣告完成。最终逐一核本任务 tunnel、合成服务的 PID/启动身份/端口/退出与清理收据，只收口本任务资源；保留源码、冻结字节、截图、追踪和原始验收日志，不操作他人的标签、进程或目录。

最新支持提交 0991dbc 已推送。CI 38077305771：browser、Linux、macOS 成功；Windows 861 PASS / 18 跳过 / 2 FAIL（Python 首两例 5s 超时），原始失败已保留。隔离两文件夹具修复 55/55 PASS，真实长生命周期故障原 RED 与修复判据均留存，I1 独立窄复审 APPROVE（befcf749…）；候选未写共享源码，真实 Windows 修复后 CI 未运行，不能称四项全绿。产品完成计数仍为 19/36。
