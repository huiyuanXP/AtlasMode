<!-- atlasmode-v1:storage -->

## 实现
新增 storage/service workspaces。core 定义 ports，service 仅依赖 core，server 注入 indexer/storage 实现。使用锁定 better-sqlite3、编号 migration 和事务，不更换持久化设计。

## 验收
- [x] 验证 Node 24 下的原生安装；首次迁移与重复启动安全。
- [x] CodeSnapshot/Knowledge/PlanRevision/ViewState 分开存储。
- [ ] 注释、跨目录多对多功能集、目录策略和布局完整 CRUD，修订冲突明确。
- [ ] 审批与 revision/hash 同事务，规划历史不可静默覆盖；取消保留历史。
- [ ] 重启、重索引、删除源码后知识仍保留；失去引用标记待绑定。
- [ ] schemaVersion 知识导出/导入，冲突预览，不静默覆盖；明确 SQLite 备份入口。

2026-10-10 实际复核：77e4554 的 Linux/macOS/Windows native 锁定安装、build/typecheck/lint/test/smoke 已通过；cfda22b+独立地图修复的 clean 隔离快照 fefda8e 完成781测试/65文件、18/18 Chromium、真实SQLite重启和HTTP/SDK同修订。存储种类分离与迁移/reopen/事务回归已验。证据：https://github.com/huiyuanXP/AtlasMode/blob/fix/first-use-20261010/docs/superpowers/reviews/ci-repair-2026-10-10/README.md 。组合条款继续保留未勾选：独立注释/重绑、完整知识CRUD、规划取消保留历史、知识导入冲突与备份入口仍未完成，不能以组编辑或旧批准历史覆盖代替。本Issue保持open。
