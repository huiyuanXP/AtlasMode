# AtlasMode Tickets

按依赖顺序逐票认领、实施、独立审查。先执行用户要求的 UI-01→UI-02→UI-03→AG-01→UI-04→QA-01，再按优先级处理现有缺口。文档票据是当前来源，不自动发布 GitHub Issue。

状态：TODO → CLAIMED → REVIEW → DONE；失败验收保持 PARTIAL，不用测试数量替代目标。所有剩余需求已登记，未来扩展仍需各自设计。

| Ticket | 内容 | 优先级 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| [UI-01](UI-01.md) | 操作与批量变更自动聚焦 | P0 | 无 | CLAIMED |
| [UI-02](UI-02.md) | 动画漏斗依赖视图 | P0 | UI-01 | TODO |
| [UI-03](UI-03.md) | 可点击路径与作用域导航 | P0 | UI-02 | TODO |
| [AG-01](AG-01.md) | 本地 Agent 到网页 Chat 的真实桥接 | P0 | UI-03 | TODO |
| [UI-04](UI-04.md) | Chat 左栏与规划概述右栏 | P0 | AG-01 | TODO |
| [QA-01](QA-01.md) | 项目内真实 MCP 接入 Test | P0 | UI-04 | TODO |
| [IDX-01](IDX-01.md) | Express严格入口保守失效修复 | P1 | 无 | TODO |
| [IDX-02](IDX-02.md) | workspace包及exports源码映射 | P1 | IDX-01 | TODO |
| [IDX-03](IDX-03.md) | tsconfig references 项目图 | P1 | IDX-02 | TODO |
| [GRP-01](GRP-01.md) | 功能集圈选和成员编辑 | P1 | UI-04 | TODO |
| [GRP-02](GRP-02.md) | 功能集折叠及外部端点 | P1 | GRP-01 | TODO |
| [FS-01](FS-01.md) | 文件目录归属拖入和路径预览 | P1 | UI-03 | TODO |
| [KN-01](KN-01.md) | 独立注释与失联重新绑定 | P1 | UI-04 | TODO |
| [KN-02](KN-02.md) | 知识导出导入和冲突预览 | P1 | KN-01 | TODO |
| [DATA-01](DATA-01.md) | SQLite一致备份及恢复 | P1 | KN-02 | TODO |
| [POL-01](POL-01.md) | structure.json双向同步与审计 | P1 | UI-04 | TODO |
| [POL-02](POL-02.md) | 允许约束与有理由例外 | P2 | POL-01 | TODO |
| [IDX-04](IDX-04.md) | 重命名移动身份迁移 | P2 | IDX-03 | TODO |
| [DIFF-01](DIFF-01.md) | 完整快照差异与引用变化 | P2 | IDX-04 | TODO |
| [GRP-03](GRP-03.md) | sequence与wrapper高级流程 | P2 | GRP-02 | TODO |
| [PERF-01](PERF-01.md) | 增量索引和文件监听 | P2 | IDX-03 | TODO |
| [PERF-02](PERF-02.md) | 全局自动布局 | P2 | UI-02 | TODO |
| [QA-02](QA-02.md) | 真实客户端与Windows退出验证 | P1 | QA-01 | TODO |
| [OPS-01](OPS-01.md) | 新云恢复与分发 | P2 | QA-02 | TODO |
| [SEC-01](SEC-01.md) | 继承依赖审计整改 | P1 | 无 | TODO |
| [FUT-01](FUT-01.md) | P5扩展证据评估 | P3 | DIFF-01 | TODO |
