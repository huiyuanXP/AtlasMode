# PERF02 Task3：已审纯 helper 检查点

2026-10-11 UTC。仅原 PERF02 Task3 完成：两份视觉预检、pin 来源与可变尺寸局部几何 helper/测试，独立 R2 审查 APPROVED C0/I0/M0。最终单 worker 定向回归 5 文件 123/123 PASS、零 skip（Task3 67）；owned noEmit 类型检查和 lint exit0。原 34 项行为 RED、后续边界失败和审查四项 RED 均保留。

本目录是证据备份，基于已验收文档 SHA `5ccf5a15f364ff7357b11bcd415bcdc4760cd041`，没有将 Task3 接入生产。冻结源在 `evidence.tar.gz` 的 `assembly/` 与原工作区；[source-manifest.json](source-manifest.json)记录精确 SHA。不能单独 stage 两份新源而遗漏仍未提交的已审 Task1/2 依赖。归档包含依赖 assembly、两代审查包、私有 config、原始日志和暂停记录，不包含 node_modules、数据库或固定目标源码。

源码：`ce1aa93d597714c3975b53739ff658b1d72cbc8877064b6b45dbcce08781e979`；测试：`db89507d20f190316b8ce6fc93e73ad78ac3d695355030ff94f8947bdfef7e55`。

[R1 审查](review-r1.md)要求修正 group fallback、raw/emission 下界与 opaque alias 冲突；[R2 独审](review-r2.md)确认三项关闭。归档校验见 [archive.sha256](archive.sha256)。先验证归档，再阅读 `owner/evidence/review-package-r2/README.md` 的复现命令；私有 source harness 不代表 compiled 产品门禁。

[前项 CI 收据](prior-ci.json)：固定5ccf的run38112726792四项SUCCESS，只读核验，无重跑。此证据提交的自动CI须单独按固定提交核对，不继承旧绿；它也不是 Task3 生产集成 CI。

## 验证边界与知识收尾

| 事实面 | 状态 |
|---|---|
| 代码 | changed-and-verified：两 owned 源，真实 bounded preflight、alias/pin、累计两 pass 几何 |
| 运行态 | pending：Task4 实际 session/DOM/apply/save/worker，Task5 compiled 中型目标计时尚未运行 |
| 文档 | changed-and-verified：本 scoped receipt、原始 evidence、下一线程交接；根 state/票不标 DONE |
| 规则 | verified-current：AGENTS 与相关技能已读取，vendor 校验全通过，未改规则 |
| 记忆 | out-of-scope/generated-read-only：未读取禁止 sessions 或修改生成记忆 |
| 工作区 | verified-current：1387 非 owned 原路径、13 装配依赖、pauseActual15及 R1 21件证据原字节保留；原 dirty 成果不清场 |

性能、真实 DOM 几何、重启位置保存与 Worker 生命周期尚未测；测试耗时不作为120ms/p95能力声明。PERF02整票未完成，36票仍22DONE/14未完成。原主checkout0991dbc157dirty、publishered7938dirty、ci-runtime5ccfclean均保留，无merge/deploy、资源或网络调整。

下一最小任务仅由父创建新线程接原 Task4 Window C，详见 [交接](next-thread-handoff.md)。本线程到此停止。
