# KN-01 approval window independent source review

结论：**APPROVE — Critical 0 / Important 0 / Minor 0**。

范围：VM2 `/home/agent/projects/AtlasMode` 的第二 core / approval / Planning 冻结窗口。明确模型为 gpt-6.1-sol、high。独立只读审查 10 个冻结路径，以及理解事务和调用边界所必需的既有 SQLite、Annotations、Workspace、StructureSync 接口。未修改产品、数据库或冻结文件，未执行测试、build、lint、类型检查、stage、commit 或 spawn。本报告只批准该源码模块窗口；KN-01 尚未完成产品接线和验收。

## 冻结完整性

开始、结束分别执行冻结清单 SHA-256 校验，10/10 均 OK；manifest 与 receipt 的开始、结束摘要一致。额外的 unchanged 清单 7/7 均 OK，包括第一窗口 Notes、migration、storage、spec 和 plan。

| 证据 | 开始 SHA-256 | 结束 SHA-256 |
| --- | --- | --- |
| `.superpowers/sdd/2026-10-10-kn01/freeze-approval-window.sha256` | `5fa9f729697eb74664cb17427c8a4ce6cdc9ad7f10099043ddd29d4e59507ac8` | `5fa9f729697eb74664cb17427c8a4ce6cdc9ad7f10099043ddd29d4e59507ac8` |
| `.superpowers/sdd/2026-10-10-kn01/approval-window-receipt.md` | `e990fce948b16c8185a114326b840767fe60079fbf9968ce776dcf956c9a7f9f` | `e990fce948b16c8185a114326b840767fe60079fbf9968ce776dcf956c9a7f9f` |

各路径开始、结束均为以下摘要：

| 路径 | SHA-256 |
| --- | --- |
| `packages/core/src/model.ts` | `a61d1e3fa7fa33b4c50e3416c8c0e82e0f28fb82d8649f30774cdba219ab8abf` |
| `packages/core/src/validation.ts` | `b31bc79d37d2fd0cc7ffaff8f5ae2fb3fb6adf5e7caa98e2d8913ca6a7374874` |
| `packages/core/src/index.ts` | `eb5c78787fc1361d0b4056d5303715c8991687edcce76afae72e878fe2f95396` |
| `packages/core/src/annotations.ts` | `493df01fd4394d899e7098c19bc1439d2f57aeb07a12decf71ea1d97fe01b5f1` |
| `packages/core/src/approval-schema.ts` | `09395085802f47845c22059c79a9071a46d71b78c3bb6de486562981950c2409` |
| `packages/core/src/approval-schema.test.ts` | `be289bed9e067055ea625fc2f9794eda6464b9ffc9e1be17af06ee29320d464b` |
| `packages/service/src/annotation-review.ts` | `22693d71dc9f68bff18944ce39b12e2aaefc2803c8ba054dedc93fa207ad79d1` |
| `packages/service/src/annotation-review-service.ts` | `8a3b350e11763d06561ee6e5333dee80b91c3ccaa327bb02e3756ad093a4543b` |
| `packages/service/src/planning.ts` | `89fdba1f61a4ba2ba9917133f99974ea7fb42a89b20bfff69975a12cd5fbc86f` |
| `tests/integration/annotation-approval.test.ts` | `c79e5ca6cc8bc90ca2ad439f22c150ef9bbf4d3022b1910fce3d01fd34d7222b` |

独立提取 `Planning.update` 从 `  update(` 到其后一行 approve 注释前的原始 1,964 字节，SHA-256 为 `f4b11da3a6354f7646e656ef49ce4110c148ee4873d7a7e942f5311ce47b0613`，与 FS 冻结方法一致。没有用整文件摘要替代此方法级检查。

## 实际源码审查结果

### Schema、入口及初始化

`packages/core/src/approval-schema.ts:1–33` 只运行时导入 zod，model 是 type-only 导入。legacy 是不含 reviewContext 的 strict object；v1 要求 strict version=1、小写 64-hex knowledgeHash；显式 undefined/null、未知版本和多余字段不能降级为 legacy。未发现该 standalone 模块引入 TDZ。`approval-schema.test.ts:22–57` 同时核对两个分支及 index / validation / annotations / standalone 四入口的共享 schema 对象。core index 保留既有结构与注释 exports。

### 当前批准与历史批准的边界

`packages/service/src/annotation-review.ts:33–68` 校验批准规划状态、planId、revision、原 semanticHash、baseline ID/hash，以及 context 项目、snapshot ID 和实际 knowledgeHash。legacy 必须在冻结 registry 内且完全没有 context；仅删 tag 不能降级。hash 使用版本域与 NUL 分隔（22–29），调用现有严格 canonical context（`core/src/annotations.ts:324–357`），纳入正文、署名、来源、约束和完整绑定语义；不以 note revision 代替内容。

`planning.ts:51–84` 严格解析候选批准，按 revision、时间、SQLite 插入序确定最新候选，只验证这一候选，不跳过损坏记录。SQLite `list` 的真实 `ORDER BY rowid` 与这一 tie-breaker 相符（`storage/src/sqlite.ts:359–365`）。历史 guard 在 latest / approvedForVerification / export 路径共享。返回历史对象使用 structuredClone（`annotation-review-service.ts:94–117`），后续 note 编辑不会回写历史捕获。

`planning.ts:93–160` 的同步事务内 getCurrentApproval 要求 current valid v1；无批准、正常 revision/semantic/knowledge 不匹配、stale baseline、当前 policy error 拒绝为 NOT_APPROVED。缺失或损坏最新 context、非法 tag 或 legacy 执行请求拒绝为 APPROVAL_CONTEXT_INVALID。`annotation-review-service.ts:55–60,75,119–127` 在审批捕获及当前知识校验时先严格验证所有原始 note，再进行 Notes 项目筛选，故 `{}` 等损坏所有权不能消失后得到有效批准。正常不匹配与损坏上下文的路径均未授权执行。

可复现案例已经固化于冻结测试：直接 SQL 改正文、author/source/constraint/binding/deleted 字段且不增加 revision 时失效（`annotation-approval.test.ts:171–207`）；损坏 raw note `{}` 拒绝当前批准（509–526）；最新 context/tag/history 损坏时历史消费者全部拒绝、无旧批准回退（254–317）；同 revision/time 的最后插入批准损坏也拒绝（318–329）；无批准和新 snapshot 均 NOT_APPROVED（497–508）。这些是作者既有测试及日志，本审查未重跑。

### 批准事务、CAS 和不可变历史

`planning.ts:271–314` 在单一同步 transaction 内重新读取规划和 expectedRevision，校验当前 baseline/policies，捕获并 hash 当前 notes，再拒绝 approval/history/context 任一 ID 冲突。写入順序为 approved-plan → approved-annotations → approval → current plan，返回前再次读验证。`annotation-review-service.ts:61–93` 使用相同 storage 和 snapshot callback；`Annotations.saveApprovalContext` 本身拒绝历史 key 已存在。嵌套 SQLite transaction 是同步 savepoint，异常向外传播回滚，未将任何 async 读塞入事务。实际 SQLite transaction 拒绝 async callback/thenable，已关闭 scope 的后续写也拒绝（`storage/src/sqlite.ts:384–419`）。

现有测试完整比较 SQL 的 rowid/kind/id/value 原始行，覆盖四处写入前故障（403–424）、hash/capture 故障（425–441）、三类 UUID/history 冲突（442–469），以及四处真实 SQL 写入后再抛异常（527–558）。因此检查的是整个真实 SQLite 事务回滚，不是仅对象状态回滚或 mock 的无写入结果。expectedRevision 和当前 policy 拒绝也保持历史原样（577–609）。

### Legacy 的读取与重新批准

`annotation-review-service.ts:100–109` 仅 legacy 分支读取原冻结 registry，不推断、不追加。`planning.ts:269–314` 新 approve 永远生成 v1 tag 与新的 context key，保留原 plan-only semanticHash 算法。测试 `annotation-approval.test.ts:330–397` 验证 legacy 可历史读取/export、执行拒绝、只读过程不改原始行，显式重新批准产生新 v1，同时保留旧历史原始 JSON、旧 context 缺席及 registry 原值。该最后增加断言的版本有单文件 36 PASS 证据。

### POL 与 FS 接口兼容范围

三参数 Planning 构造仍可用；第四参数注入同一 Notes 实例的服务为同步接口（`planning.ts:35–45`；测试 470–496）。因此 POL 可在项目外层 queue 完成异步 refresh/structure 读取后，再调用这里的同步 approval transaction。

只读检查当前 Workspace 实际代码可见 `withStructure` 的顺序为 project queue → 可选 refresh → readStructure/owner guard → work，approvePlan/getCurrentApproval 调用 Planning 同步入口；StructureSync.withProject 在 work 完成前保留 queue。但 Workspace/HTTP/MCP/refresh 不属于此次 10 路径冻结，可能由其他窗口继续修改，本报告只确认接口可组合，不独立批准这些共享产品接线。历史 verify 仍应使用 approvedForVerification，源码实施必须使用 current approval；AG-02 的 v1 tuple pin/recheck 尚待授权集成。FS update 方法已独立逐字节匹配上列 SHA。

## 已读取的执行证据与限制

读取 `.superpowers/sdd/2026-10-10-kn01/approval-final-scoped-tests.log`：8 files / 149 PASS（migration37、storage6、Notes10、approval36、core annotations28、schema11、historical guard14、Workspace compatibility7）。之后 legacy 额外历史断言改动只有 approval 测试文件，`approval-final-history-tests.log` 为该文件 36 PASS；不得将其相加为 185 个不同测试，也不得称最终断言版本重新执行了全149。

`approval-bundle-runtime.log` 显示四 core 入口 bundled 后执行 `BUNDLED_APPROVAL_ENTRANCES_OK`。receipt 和 scoped lint/noEmit 日志记录相应检查通过。本审查仅读取这些既有证据，没有重新执行；未 combined root build、浏览器/refresh 验收或实际 AG 执行测试。第一 Notes/migration 窗口已批准，本次 unchanged SHA 证明未变，不重新冒称其独立完整审查。

未发现本冻结模块内需要修复的 C/I/M。后续共享接线、真实 browser/refresh、AG-02 pin/recheck 及最终 root gates 是剩余产品验收边界，不能把本报告作为 KN-01 DONE 或源码执行授权。
