# KN-01 independent design review and limited re-review

Reviewer: `/root/ci_repair`, gpt-6.1-sol high. Date: 2026-10-10 UTC.

Scope: `docs/superpowers/specs/2026-10-10-kn01-design.md` and `docs/superpowers/plans/2026-10-10-kn01.md`, with read-only inspection of necessary existing storage, approval hashing and availability interfaces. No product implementation, build, root gates, source/doc edits or agent spawning occurred during review. This artifact is separate from the later GRP-02 planning helper review.

## Initial report — REQUEST_CHANGES, preserved

KN-01 独立 sol high 只读设计审查：REQUEST_CHANGES，C0 / I2 / M0。

I1 Important spec:91、plan Task3 接口95–96/Step4:113：approved-annotations 虽 immutable capture，但 Approval.semanticHash 当前 service/planning.ts:25 只 SHA semanticPlanContent(plan)（core validation:488 排除 revision，完全无 notes）。靠 plan revision+1 仅当前有效性防护，未让真实审批审核 hash 覆盖 note 正文/author/source/isConstraint/binding。请明确 versioned 审核 context/hash（或等价 Approval 显式 knowledgeHash 且实际所有 approval/latest/get/export/后续 AG02 tuple checks 验证），canonical 排序/纳入字段与 volatile 排除、批准同 transaction 先 capture 后 hash 且不可覆盖，legacy 旧批准保留原 hash/明确 context 未记录不回填。新 context 缺失/被篡改 fail closed，测试 note 变更/reordering/tamper/current vs historical、capture/hash/plan 写失败整体 rollback。

I2 Important spec:83、plan Task2:79–83：“不降级”未落具体 unknown future schema gate。当前 SqliteStorage 仅查001 marker，未来002 重建固定 CHECK 不能默认任何已有表都旧001。请在 DB 迁移 DDL 前显式只接受 empty/已知001/已知001+002 且验证 markers+对应 schema/constraints，未知 future marker/schema/unknown kind 需安全拒绝且不重建/改 marker/丢 trigger/index/data；保留原 value 文本 bytes（SQL 原样 copy，不 JSON.parse/stringify）/rowid/旧 Approval/settings。加 future003 或未知 CHECK/trigger fixture 无修改，旧非 canonical JSON 空白/key order/value bytes 等真 SQLite 迁移回滚 proof。

其余 orphan ID 返现不 rebind/partial-parser fail unknown/CAS target kind+ID+snapshot/同事务 invalidate/history 不覆盖/UI 无 plan 重启900 双语/KN02 DATA01 MCP 排除通过。仅改两 docs 再通知我限定复审，无产品实施批准。

## Completed limited re-review — APPROVE

KN-01 原 I1/I2 限定独立 high 复审 APPROVE（docs 层），C0 / I0 / M0。

实读两 docs 与本机精确 repair diff；SHA 一致：

- spec: `6681c5a2029d97a6d662ac1a625de7b68804aa682424ae20260419b525fe4759`
- plan: `bf82d14740e0f3dd8fe7dc0264c4bb7651f267c58a0e03c48bdd471e32d596c2`

I1 已定义 Approval.reviewContext v1 + knowledgeHash 覆盖 notes 全部语义字段/固定 canonical，approve capture/hash/历史写同 transaction，latest/get/export/verify/AG02 授权真实统一 guard，current 知识 hash 可捕漏 revision 失效，new missing/tamper 无 legacy fallback；冻结002 legacy registry 防删 version 降级，旧 hash/history 不改，AG02 未 pin/recheck v1 前不得开执行。

I2 已规定 DDL/WAL 持久写前 readonly known empty/001/002 schema gate + 事务复查，未知 future marker/CHECK/kind/trigger/index/view 拒绝不改 DB/schema/rows/sidecars，raw SQL rowid/value 字节 copy/registry/marker 同 transaction，真 SQLite rollback/future-byte-unchanged fixture 要求充分。

此前 orphan/CAS/UI/restart/900 双语/KN02 DATA01 MCP 边界保持。未改 code/docs/build/test。请将原 REQUEST_CHANGES 与本 APPROVE 分开保留；具体迁移/guard/浏览器实现与共享窗口仍 pending，非 KN01 DONE/GH6 完成批准。

Evidence read: the two remote reviewed document versions above and local `/tmp/kn01-design-review-repair.diff`, `/tmp/kn01-plan-review-repair.diff`. This completed report records a design review; no future implementation or runtime result is represented as passed.
