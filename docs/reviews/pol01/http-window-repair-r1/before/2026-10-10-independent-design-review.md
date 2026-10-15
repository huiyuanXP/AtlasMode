# POL-01 独立只读设计审查

审查时间：2026-10-10 UTC。结论：Issues Found；修正两项 Important 后再进入实现。Critical 0 / Important 2 / Minor 2（建议）。

现场：VM2 `/home/agent/projects/AtlasMode`，HEAD `cfda22b2ed2eb56ef186c629c5d5ad3a7fff0dc7`，branch `fix/first-use-20261010`。spec 与 plan 均为未跟踪设计草案，存在其他并行 dirty changes（包括 AGENTS.md），全部未改动。读取 AGENTS、using-superpowers/Codex适配、spec reviewer prompt、requesting-code-review、verification-before-completion、真实 neat-freak v3.0.0、state、README 与必要现役源码。vendor SHA256 check 全通过；未运行产品测试、root gates、付费模型或共享 dist 构建。

## Important

I1 — DB-only 同 id 编辑缺少闭合来源切换。

- 证据：spec `2026-10-10-pol01-design.md:64–66` 规定显式迁移才移除 DB records，同时旧 POST 的写目标改成 extension，同 id 不等冲突。plan `2026-10-10-pol01.md:86,88,91,106` 保留旧表单/upsertLegacyPolicy，但只给 importLegacy 定义迁移删除。现役 `packages/service/src/knowledge.ts:171–202` 支持同 id 更新，`apps/web/src/features/structure/PoliciesPanel.tsx:75–82` 提交所选旧 id。
- 可复现设计场景：DB-only `{id:p,pathPrefix:src,purpose:old}`；UI 选择 p 修改 purpose=new，upsertLegacyPolicy 将 p/new 写入 extension，未显式 importLegacy 所以 DB 仍 p/old；并集命中 spec66 的同 id 不等冲突，保存后进入不可写，或实现者被迫静默删除旧库。
- 必须明确：迁移前的旧来源编辑规则，或 preview+显式迁移后再允许 extension 编辑，并仅在 finalize 同步事务删除/替换对应 DB record；重启、失败、同 id 不等的测试须覆盖这条路径。main 已指出可继续旧 DB来源直到显式迁移，或显式迁移后编辑；不能静默迁移或保留冲突旧值。

I2 — 迁移批准失效合同互相冲突。

- 证据：spec45 semanticDigest 包含完整 normalized document（含 extension），spec96 上下文摘要改变就 plan revision+1；plan91 却要求有效规则等价迁移不增 plan，并称上下文为 complete normalized doc+未迁移 legacy 集合。
- 可复现设计场景：文件 `{schemaVersion:1,folders:[],dependencyRules:[]}`，DB存在 p。显式 importLegacy 将 p 写入 x-atlasmode 并删 DB；完整文件摘要必变，而且上述组合上下文也改变。实现者遵守 spec96 会增 revision，遵守 plan91 则不增，验收没有唯一答案。
- 必须统一合同。main 接受最小保守方案：显式迁移使当前批准失效、保留 immutable history，无须另造去来源差异摘要。同步更改 spec/plan/test期望。

## Minor / advisory

M1 — 给批准与 pending-write 交错一个确定性测试。spec96 总体规定同一队列，但 plan92 的“原 refresh 后确认结构可用”应明确审批提交/有效性返回仍处在同一 lock-held 边界。现役 `workspace.ts:113–135` 在 enqueue refresh 返回后调用同步 approve/verify，MCP `server.ts:308–310` 也是 refresh 与 ownedPlan 分开的请求。候选测试：批准刷新完成后阻塞，另一 UI 写入处于 prepared/rename 后 finalize 前；批准与 approved read 必须等待或明确失败，不能给有效旧批准。这里只是实施校准建议，未将现役无结构同步代码称为已复现产品缺陷。

M2 — failed/conflicted audit 建议明确 attemptedAfterDigest 与实际 observedDigest 区分。spec102 prepared.afterDigest 为 candidate，spec110/A5 要“真实前后摘要”；若 barrier 外部将 A 改 C，candidate B 未发布，审计应显示 C 的观察值与 B 的尝试值，不能把 B 标为已存在的 after bytes。现有 publish result.actualDigest 可支持；加一个失败审计断言即可。

## 已满足的设计边界

- README v1 可选 allowed/forbidden、省略/空数组、unknown values roundtrip 有明确合同及行为测试；不误映射 prose/import specifier 为 forbidden target paths。
- legacy 保留与显式迁移总体方向正确；I1/I2 是需要补齐的具体路径。
- 1 MiB字节边界、严格UTF-8/重复key诊断、原 bytes SHA256、项目归属/symlink边界已写明。
- FS/SQLite不伪称跨介质原子；同步事务无 await，prepared/publish/finalize、before/after/third digest恢复、幂等、失败保留和审计来源/验证时间已覆盖。
- 票内 atomic write+audit 可以由当前方案满足：rename确保完整旧/新JSON；单服务合作写者队列/CAS可检出旧版本冲突。spec116–118明确不支持多server与未参与编辑器的最后重检到rename窗口，属于真实产品限制，不应伪称全文件系统CAS，亦不需要为本票扩锁系统或POL-02。
- POL-02 有理由例外、自然语言编辑/规则执行没有偷跑。

状态面：代码 verified-current（只读接口核对）；设计 pending 两项修订；runtime/deploy out-of-scope；规则 verified-current（读取与vendor校验）；generated memory out-of-scope/read-only；workspace evidence preserved。没有commit/push/deploy/merge/权限/密钥/session操作，没有删任何证据。
