# IDX-02 workspace包及exports源码映射

- 状态：DONE
- 优先级：P1
- 负责人：2026-10-10 VM2独立子代理（主控集成）
- 依赖：IDX-01
- 来源：2026-10-08 用户反馈及 README 当前未完成范围

验收：捕获package workspace/exports配置并保守解析到授权源码；条件/动态不确定项unknown；配置新鲜度、历史与跨包隔离验收。

复杂工作实施前写设计/计划，简单工作沿用整体契约；相称行为验证与必要检查完成才标 DONE；只对极关键变更安排预算内复核。历史失败与未验证限制保留。

2026-10-10：44新增+原349=393/9通过；有界静态workspace/exports及条件收敛已实现。真实HTTP/MCP/浏览器、manifest-only新鲜度/SQLite历史与重启/跨项目隔离及完整Express35/35通过，独立high复审APPROVE。dist→src、完整Node loader与references仍不支持，不能猜测。证据：[IDX02验收](../superpowers/reviews/idx02-2026-10-10/README.md)。
