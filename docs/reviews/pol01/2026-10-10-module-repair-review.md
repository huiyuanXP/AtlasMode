# POL-01 冻结模块定向修复独立复审

2026-10-10 UTC。**结论：APPROVE（仅原 I1/I2/M1 定向修复）；Critical 0 / Important 0 / Minor 0。原三个问题关闭。** 本结论只允许 main 继续协调后续接线，不代表 POL-01 产品票完成，也不授权共享源码修改。

## 审查对象与边界

先读 `docs/reviews/pol01/2026-10-10-module-review-repair.md`、`module-review-repair-sha256.txt`，核对原始报告，再读五个变化文件及对应回归源码/保存凭证。修复清单的 12 项 SHA256 全部匹配；最终再次检查仍全部匹配。

本次冻结：

- `packages/service/src/structure-sync.ts`：`1634f5fc8a9c006696a75ad68dd3235126cccc66157f1d76163446f19e56d1bc`。
- `packages/service/src/structure-state.ts`：`fb53b296aae51e609b5406d98d5575d32a0f47803e1d8028ed5488e163a9e9c6`。
- `packages/core/src/structure.ts`：`33bb4eff19ca8ad7ab017a79d8553508131657423a06ebaaf63eb007f3cabf1a`。
- 新测试：core `0c23133719a932134bcf218638f0c8a217171ef8d3db0df6139a3337f9e910cc`；sync `170f05ed225ef5c1ecca97967fd3ccca78a87ae654e3ec64bdf74718bc2e2258`。
- 修复说明：`2ef2409eb25109d9f65f679fde1b29f127654407074ebd7fd745caf67b114de0`。

只读核查，无测试重跑、build、lint、产品或共享文件修改、stage、spawn、commit/push。原 `pol01-module-independent-review.md` 的 C0/I2/M1 失败结论保持原样，不被本报告覆盖。未扩大为全模块第二次审查。

## I1 关闭：恢复终态优先于 CAS，no-op 有持久请求凭证

`structure-sync.ts:448–459` 在恢复读取前查询完成结果，`readLocked` 后再次查询，随后才进入 `461–468` 的 CAS。`727–745` 的 `completedRequest` 优先选择 terminal audit，然后 no-op receipt；不同 requestDigest 明确拒绝；aborted/failed/conflicted audit 保持原失败，committed 或相同 no-op 才允许返回经 fresh read 验证可用的状态。因而 afterDigest inline recovery 不再被旧 revision 错误拒绝，beforeDigest inline recovery 不再落入重新发布覆盖 aborted audit。未观察成功时仍由 `assertUsable` 阻断新写入。

四种 no-op 分支 `506–507`（DB-only legacy）、`560–564`（已迁移 legacy）、`567–568`（零条迁移）、`576–579`（folder/等价候选）均进入 `747–766` 的同一 `noOp`。它通过同步 `storage.transaction` 写 `structure_no_op` receipt，记录 requestDigest、验证 revision/digest/时间；不调用 publish、saveAudit、invalidate 或增 revision。`structure-state.ts:34–44,72–86` 的固定 key 为 `structure:no-op:<projectId>:<mutationId>`，通过原 settings 存储而不是进程内 Map 保留，服务重建后仍绑定该请求。

证据：`apps/server/src/structure-sync.test.ts:691–753` 使用真实 SQLite 与文件 adapter，故障停在 before/after publication，**直接 update retry**，断言 after 成功/plan revision 只增一次，before 两次拒绝且 bytes/plan 不变，publish 总数为 1，同 id 异 payload 拒绝且原 audit 相等、历史 approval 保留。`825–907` 覆盖四种 no-op，在重建 service 后 exact retry，再以异 payload 重用 id，断言拒绝、publish=0、bytes 与 plan revision 不变、无该 mutation 的 publish audit。这些断言覆盖原报告的具体失败路径。

## I2 关闭：未知读取保持 pending，实际可读后再分 before/after/third

`structure-sync.ts:882–886` 在 `observe` 失败返回 undefined 时直接 false，不写 conflict state/terminal audit，不改 prepared intent。`readLocked:209–229` 为这一情形返回无当前 document 的 `recovery_pending`，提示“publication outcome is awaiting recovery verification”；`assertUsable:172–186` 与 lock-held session `75–77` 拒绝继续审批。后续普通 read/recovery 仍会再次观察磁盘。

实际可读后，`887–897` 才按 afterDigest finalize；`899–925` 才按 beforeDigest aborted；`927–972` 才记录真实 third/invalid 冲突。真实第三摘要保留外部文件，显式接受合同未被削弱。未读取到 bytes 不能制造第三摘要这一原缺口已修复。

证据：`apps/server/src/structure-sync.test.ts:755–823` 分 before/after/third 三种磁盘内容，首次持续注入 read I/O failure，断言恢复 blocked、公开读 pending、lock-held approval 被拒绝且无记录、无该 mutation audit；恢复可读后，断言分别 aborted/committed/conflicted、observedAfterKnown=true、摘要等于真实文件 hash、plan 只在 after 增 revision，再次恢复不重复增 revision。该测试里的 approval 是模块 barrier fixture，不能宣称实际 Workspace approve/verify/readApproved 已接线。

## M1 关闭：先拒绝绝对路径，再剥尾 separator

`packages/core/src/structure.ts:49–56` 先统一反斜线并检查 slash 开头，之后才去尾 slash；`/`、`///`、单反斜线无法变成空相对根。合法 `.` 与内部空相对 root 仍按 `73–76` 归一；已有 portable relative slash 行为保留。

证据：`packages/core/src/structure.test.ts:230–239` 对三种 separator-only 路径分别要求 `INVALID_STRUCTURE`；原 root/portable 相对路径测试 `98–120` 仍在本轮 core20 集合中。保存的 path RED 凭证正是三项原失败，不能用其他路径测试替代。

## 验证来源与剩余接线边界

读取保存的 RED 凭证：原恢复 5 FAIL/20 PASS、no-op 补齐后 9 FAIL/20 PASS、separator 3 FAIL/17 PASS；读取 `receipts/recovery-review-final.txt`：2026-10-10 16:43:52 开始，core20 + sync29 = **49 PASS**，2 文件，总 2.92 s。本审查没有重新执行这些测试。修复说明记录生产与测试源码 noEmit、五变化文件 lint exit0；其保存输出为空文件，本文不把空输出当作独立重跑证明。

Storage adapter 与其11项测试源码哈希保持原冻结相同；**本轮没有重跑 adapter11**。原48 PASS仅是原版本凭证，不能与本轮49相加宣称本轮60 PASS。

后续 main 接线时需要将最终设计固定 settings namespace 清单同步包含 no-op receipt，这是修复说明已列出的装配事项。Workspace/HTTP/MCP/Web、startup-before-listen、实际批准/验证/已批准读取互斥、浏览器 A7、原生 OS 与 main 集成 gates 仍待对应窗口验收。FS/SQLite跨资源仍不是原子事务，external TOCTOU、single-server 合作队列范围等原限制保持。
