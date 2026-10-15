# POL-01 设计限定修订记录

日期：2026-10-10 UTC。范围：仅原 spec/plan 与本目录审查凭证；不含产品实现、global docs、提交/推送或复核现场清理。

原独立审查结论 C0/I2/M2 原样保留在 `2026-10-10-independent-design-review.md`；本记录不更改其 Issues Found 结论。当前修订是设计者 targeted repair 与自审，独立限定复审仍 pending。

| 审查项 | 限定修订 | 未来确定性验证 |
| --- | --- | --- |
| I1 DB-only 同 id 编辑来源冲突 | 显式迁移前在 StructureSync 队列/前置条件内编辑原 DB，file bytes/digest 不变；preview 后迁移 finalize 同事务仅移除 intent 清单对应 DB id；之后 extension 同 id 可继续编辑；等值 extension 已有记录时单事务切换，无含糊同 digest 发布 intent | Task3 DB-only编辑→迁移→extension编辑→真实SQLite重启；迁移before/after/third恢复；Task4可用迁移按钮；Task5真实UI往返 |
| I2 迁移批准失效矛盾 | 不新增上下文摘要；完整document semanticDigest仍按原定义。文件语义变化、旧DB策略语义编辑、非空实际来源迁移取逻辑或只增plan一次；迁移即使等值也失效，历史approved不改；零条迁移no-op | Task3 migration plan+1/history deepEqual/重试once；等值extension迁移文件不重写但来源/结构revision更新 |
| M1 批准与pending写入交错 | approve/verify/readApprovedPlan从真实索引到结构恢复检查、同步提交/有效性读取持有同一项目queue任务；禁止refresh释放后再读批准 | Task3/4 Promise barrier暂停prepared、rename后pre-finalize；approve/read尚未settled，恢复后旧revision409或pending503，不返回有效旧批准 |
| M2 候选与实际摘要 | audit分beforeDigest、attemptedAfterDigest、observedAfterDigest与observedAfterKnown；无文件写入target=legacy_db且attempted=null；prepared保留原bytes及candidate各≤1MiB，terminal audit仅摘要 | Task3 A→candidate B，外部C导致conflict，audit逐项A/B/C且没有committedAt；DB-only编辑file bytes不变 |

规格位置：`docs/superpowers/specs/2026-10-10-pol01-design.md`。计划位置：`docs/superpowers/plans/2026-10-10-pol01.md`。保留原模型映射、未知值往返、无新增引擎、单服务写者、真实外部TOCTOU、无await SQLite事务和POL-02边界。

验证范围：两份文档限定差异、自审与实际文件格式/占位符检查；独立报告复制逐字节比对。没有运行产品测试，没有把未来测试checkbox标完成。main协调既有high reviewer限定复审与GRP-02共享core/routes/knowledge冻结后的实施窗口；本轮不spawn。
