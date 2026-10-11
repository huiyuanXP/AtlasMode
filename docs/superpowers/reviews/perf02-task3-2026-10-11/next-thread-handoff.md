# Atlas 下一线程：仅原 PERF02 Task4 Window C

## 当前结论

原 PERF02 Task3 完成，独审 R2 APPROVED C0/I0/M0。source ce1aa93d597714c3975b53739ff658b1d72cbc8877064b6b45dbcce08781e979；test db89507d20f190316b8ce6fc93e73ad78ac3d695355030ff94f8947bdfef7e55。最终5文件123/123PASS无skip（Task3 67/global27/controller18/graph6/groups5），owned noEmit含test/lint exit0。R1 C0/I2/M1原报告与四项RED保留，三类修复均独审关闭。测试耗时不是性能实测。

PERF02整票仍未完成；FS01/KN01/POL01 DONE，36=22DONE13TODO1PARTIAL，剩余14。此次不改根票/state为PERF02DONE。原代码e48f927fcd7711b5ad5847a6de1e0b0da299d010 CI38112226930全绿；前项文档5ccf5a15f364ff7357b11bcd415bcdc4760cd041 CI38112726792已由本线程只读核结论四SUCCESS，没有重跑。

## 精确现场与备份

SSH：ssh -F /home/strix/infrastructure/VM/SSH/infrastructure.sshconfig -o BatchMode=yes VM2。VM命令 export PATH=/home/agent/.local/bin:$PATH。

Task3 owner `/home/agent/projects/AtlasMode-checkpoints/2026-10-11-perf02-task3`；原工作区owner/workspace，branch task/perf02-visual-20261011，BASE ed793266b9dcac5cfa65f1a5358ec97d5184a69f，仍15dirty。这是Task1/2已审依赖assembly+两Task3新源，不能只stage两新源作为完整产品，也不能覆盖已接受共享文件。author已停止，原pause report不覆盖；本轮现役包 owner/evidence/review-package-r2（16件SHA），R1 review-package原21件保留。

GitHub证据工作区owner/evidence-workspace，branch checkpoint/perf02-task3-evidence-20261011，基于5ccf。仅docs/superpowers/reviews/perf02-task3-2026-10-11/备份：README、审查、完整source/deps/harness/rawlogs归档、manifest、前项CI收据、本交接。普通commit/push收据另附，不是生产接线提交；其自动CI须只读核固定新SHA，不能继承5ccf绿。

保护审计：1387/1387非owned before-manifest零变化、13/13已装配prior一致、pauseActual15/15保留。server queries/routes与历史approved hash的两差异是原assembly deferred，未改。主checkout0991dbc962981c4aa1b1a13473fce66abd6b8502/157dirty；publishered793/8dirty；ci-runtime5ccf/clean均保留。不要清场、reset/clean、覆盖、merge/deploy。

历史prerequisite function-target501860…不可当当前baseline；Task3/before/acceptedci-runtime现一致 f693b3b456892fe32327281178968d2caaa1ee71890614d9ba6f357c7e645b39。graphprojection464155e6b8831a8057e013b31997e98a48d5b56e45d0ab37811386c545e5b303；groupprojection027249184becc3af2187519ac55c5700302202f16ee89ad7d57e4d94dea60f67。接线前重新核accepted最新SHA，只合授权hunks。

## 下一最小任务

父按用户要求创建新thread，仅原plan Task4 Window C。先读AGENTS/.agents相关技能/README/state、neat-freak、原PERF02 spec/plan及本R2矩阵。Task3验收已结束，不重做A/B/Task3或已有跨平台CI。Task4须确认FS/GRP accepted源码与共享窗口互斥，以5ccf或其证据后继的accepted产品字节为baseline，谨慎组装已审A/B/Task3，server B deferred/client薄调用不得整份旧文件覆盖新source。

Task4范围按原计划：Workspace/session代次、guarded preflight-before-projectGraph/projectGroups、两次测量累计geometry、拒绝no apply/save、currentpatch captured merge/serialized保存、Worker接线与funnel/FS交互保护。不要把全局固定300×220当实际DOM证明；group缺测量fallback360×(220+60ports)。两个rawlength gate exactcounts与视觉lowerbound分开，opaquealias碰撞预检拒绝。新线程仅完成该最小task、独审及交接，不进入Task5实际规模窗口。

Task4/5真实productionWorker、DOM、restart位置、Express/Flask冷热10次计时/p95、Vite真实拒绝仍未运行。固定Express/Flask/Vite已由父恢复持久路径，沿父恢复provenance检查固定完整commit/clean，使用现路径，不重新clone或执行目标代码。原/tmp路径和历史counts不冒充现役收据。Task5才启动中型实测；必要重负载先报告范围，单worker/合理limits，不改VM资源或网络，不干扰其他用户工作。

## 授权与模型契约

用户授权按最小票持续推进、每任务新thread，GitHub文档/证据保底、隔离普通commit/push；不授权merge/deploy/权限修改/凭据或禁止sessions读取。权限auto-review拒绝就停报精确动作父补证据，不能绕过。本次defaultSSH socket阻止后授权require_escalated只读/隔离证据操作已批准，不代表未来自动批准。

每新session明确subagent，先核工具模型allowlist，不静默替换或改全局配置：简单短程gpt-6.1-sol low；简单长程gpt-6-luna xhigh；其他简单gpt-6-luna high/xhigh；复杂gpt-6.1-sol high。forknone显式model+effort，契约传给后代。此次实现/独审solhigh、保护审计sollow。

本线程没有build产品、服务/浏览器/worker/索引/目标执行、重跑全根或现有CI、merge/deploy、生成记忆修改。只Task3；现场与证据保留。结束后平台通知父，父创建下一thread。
