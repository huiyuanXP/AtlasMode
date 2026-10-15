# IDX04 独立设计审查 M1 窄修复收据

日期：2026-10-10T17:23:30.555703+00:00；作者：/root/idx01_impl，原 gpt-6.1-sol high。

授权范围：只修计划测试命令路径 packages/server→apps/server，保留旧计划确切字节及独立审查原文。无产品窗口；未运行 build/test/index，未 stage/commit/push/spawn。

## 原文与冻结值

- 原计划：docs/superpowers/plans/2026-10-10-idx04.md
- 原计划 SHA256：b553cb8fe3e22122b776a28f141af9dd3ef5cf39e6cdcd95333551f39a35700a
- 原计划逐字节备份：docs/superpowers/reviews/idx04-2026-10-10/plan-rev0-before-M1.md
- 备份 SHA256：b553cb8fe3e22122b776a28f141af9dd3ef5cf39e6cdcd95333551f39a35700a
- 独立审查原文：docs/superpowers/reviews/idx04-2026-10-10/independent-design-review.md
- 独立审查 SHA256：d5169d67045ce1721b8cfba30b63a08b765030f4f86d81ca44f62256c936d435（修复前后不变）
- 设计 spec SHA256：439750c81287069a7c48b0f61d03f1275fec365780a59a5149389239ed86ba32（本任务未改）

## 唯一计划差异

Task5 第88行命令测试路径：
- packages/server/src/identity-migrations.test.ts
+ apps/server/src/identity-migrations.test.ts

同一命令的 web 测试路径与其余计划字节不变；严格 HTTP/current snapshot/非法证据/跨项目断言要求未变。这里只修计划，目标测试文件属于未来实施，未创建或执行。

- 窄 patch：docs/superpowers/reviews/idx04-2026-10-10/M1-test-path.patch
- patch SHA256：34d916a705ff2fb5320575174a2e1b16ae444086d6bc583f2f103bd67b6131fd
- 新计划 SHA256：d6f058cad14305ac7b6568c3cba45c08c2ba86fd1e926fa950fa78d813bb6794

## 检查与状态

已逐字节核对备份等于旧冻结计划；原路径恰有一处；新计划严格等于单次路径替换后的字节；独立审查原文 hash 不变。M1 路径修复已完成；原 APPROVE/C0/I0/M1 报告保留，不重写为复审结果，不宣称任何产品或运行 gate 通过。

下一步：等待主控共享 core/产品窗口；本次不自行实现。
