# POL-01 独立代码审查定向修复

2026-10-10，限定修复 main 转交的 C0/I2/M1。原始审查报告与原模块冻结报告/凭证不修改。仅改 core `structure.ts`/`structure.test.ts`、service `structure-state.ts`/`structure-sync.ts`、server 专属 `structure-sync.test.ts`；不接 Workspace/routes/MCP/Web，不改公共出口，不 root build/commit/push。

## I1：恢复后的终态与 no-op 幂等

`updateLocked` 先检查已完成请求，再恢复读取，之后重新检查同 mutationId 的终态记录，最后才应用 CAS。afterDigest inline recovery 成功后，原请求直接 retry 返回已提交状态；beforeDigest recovery 形成 aborted 后，同请求 retry 明确失败，不重放 candidate、不覆盖 aborted audit。异 payload 同 id 始终拒绝。

四种 no-op 路径（folder、DB-only legacy、已迁移 legacy、零条迁移）各自保存内部 `structure:no-op:<projectId>:<mutationId>` receipt，字段仅 requestDigest、no_op 终态、验证版本/摘要和时间。这是幂等完成凭证，使用同步 StoragePort.transaction；不伪造 file publish audit、不改 bytes、不增 structure/plan revision。重建服务实例后的同请求可 retry；异 payload 同 id 拒绝。该 setting namespace 是 I1 review 补充要求的实现补充，后续 main 接线时需同步最终 spec 的固定 key 清单。

## I2：未知读结果不等于第三摘要

`recoverLocked` 的 observe I/O 失败直接保持 prepared/pending，下一次恢复重新读 disk；不写 conflicted 终态、不编造实际摘要或 terminal audit。公开 read 状态明确 recovery_pending，lock-held session 阻止审批。恢复实际可读后才判 before/after/真实 third；第三摘要仍冲突且保留外部 bytes。pending 提示改为“发布结果待恢复验证”，避免在 before 分支尚未确认 rename 时假称已发布。

## M1：绝对 separator-only 路径

normalizeStructurePath 先把反斜线统一，再拒绝以 slash 开始的绝对路径，最后才剥尾 slash。`/`、`///`、单个反斜线不再变成相对 root；合法 `.`/空相对 root 及现有相对路径规则保持。

## 真实验证与新冻结

- `receipts/recovery-review-red.txt`：原 I1/I2 的 5 FAIL、20 PASS。
- `receipts/recovery-review-noop-red.txt`：补齐四 no-op 路径后的 9 FAIL、20 PASS。
- `receipts/recovery-review-path-red.txt`：M1 的 3 FAIL、17 PASS。
- `receipts/recovery-review-final.txt`：修复后的 core20 + sync29 = **49 PASS**；before/after 的直接 update retry、异 payload audit 不变；unknown I/O 后 before/after/third、无效批准拒绝；四 no-op exact retry/异 payload；三根路径全部覆盖。
- `receipts/recovery-review-types.txt`：生产与测试源码 noEmit TypeScript，exit 0。
- `receipts/recovery-review-lint.txt`：本轮五文件 lint，exit 0。

未改动的 file adapter11 项本轮未重跑；原 `modules-freeze.txt` 的48 PASS只属于原版本，不用来宣称新版本通过。临时 fixture/数据库与原故障凭证全部保留。精确当前源码 SHA 见 `module-review-repair-sha256.txt`；测试配置同原隔离配置。本报告后再次冻结，等待原 high reviewer 对修复进行限定复审。产品票尚未完成。
