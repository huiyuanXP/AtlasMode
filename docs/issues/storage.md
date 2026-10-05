<!-- atlasmode-v1:storage -->

## 实现

新增 storage/service workspaces。core 定义 ports，service 仅依赖 core，server 注入 indexer/storage 实现。使用锁定 better-sqlite3、编号 migration 和事务，不更换持久化设计。

## 验收

- [ ] 验证 Node 24 下的原生安装；首次迁移与重复启动安全。
- [ ] CodeSnapshot/Knowledge/PlanRevision/ViewState 分开存储。
- [ ] 注释、跨目录多对多功能集、目录策略和布局完整 CRUD，修订冲突明确。
- [ ] 审批与 revision/hash 同事务，规划历史不可静默覆盖；取消保留历史。
- [ ] 重启、重索引、删除源码后知识仍保留；失去引用标记待绑定。
- [ ] schemaVersion 知识导出/导入，冲突预览，不静默覆盖；明确 SQLite 备份入口。
