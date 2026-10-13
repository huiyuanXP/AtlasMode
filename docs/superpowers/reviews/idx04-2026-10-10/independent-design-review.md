# IDX-04 独立设计审查（冻结 rev0）

审查者：`/root/grp01_design/grp01_implement`；明确模型 `gpt-6.1-sol high`。这是另一作者设计的独立只读审查，不是 IDX-04 作者自审。日期：2026-10-10。

**结论：APPROVE，C0 / I0 / M1。** 一项非阻断的计划命令路径问题见下。此结论仅批准设计进入主控协调的后续阶段，不表示产品已实施、测试通过或票可 DONE。

## 冻结输入与范围

审查前、结束前两次读取的 SHA256 相同，并与主控指定值一致：

- VM2 `docs/superpowers/specs/2026-10-10-idx04-design.md`：`439750c81287069a7c48b0f61d03f1275fec365780a59a5149389239ed86ba32`，105 行。
- VM2 `docs/superpowers/plans/2026-10-10-idx04.md`：`b553cb8fe3e22122b776a28f141af9dd3ef5cf39e6cdcd95333551f39a35700a`，114 行。
- 读取 `docs/tickets/IDX-04.md` 与 `docs/superpowers/reviews/idx04-2026-10-10/design-ledger.md`。

实现边界核对只读了实际 core/model、annotations、indexer/graph、index、typescript、python.ts、python/index.py，以及 service/annotations、workspace 和 SQLite transaction 入口。共享源码仍含其他任务候选，不能视为 IDX-04 的冻结实现；仅用于核对设计所依赖的现有接口。未运行测试、构建、目标程序或数据库事务，未修改远端任何文件、Git index、票状态或产品；未 spawn。唯一写入是本地本审查报告。

## C / I / M 原文发现

### M1 — Task5 的 server 测试命令路径不正确

位置：`docs/superpowers/plans/2026-10-10-idx04.md:88`。

原命令：

```text
npx vitest run apps/web/src/features/identity-migration packages/server/src/identity-migrations.test.ts
```

实际 server workspace 是 `apps/server`，不是 `packages/server`。如果 web tests 匹配成功，这个命令可能通过但未执行新增 HTTP 测试，不能据此声称 Task5 server gate GREEN。

建议把第二个路径改为 `apps/server/src/identity-migrations.test.ts`，并在 Task5 Files 中明确创建该测试文件；保留严格 body/query、当前 snapshot、非法 caller evidence 和跨项目 HTTP 断言。无需扩大产品范围。此处为实施前可修正的验证计划细节，不阻断设计本身。

无 Critical 或 Important 发现。

## 验收及边界核对

| 核对项 | 审查依据与判断 |
| --- | --- |
| 真实 rename/move 证据 | Spec 25–38、94–97，Plan Task1/2。文件使用已捕获完整 raw bytes；TS/JS 声明只替换该声明自身绑定名，保留完整 token 内容；Python 只替根声明名，保留 AST 的正文、参数、默认值、decorator/docstring 等。该定义能给简单改名和未改内容移动正例；body/参数/字符串/递归引用改动不应得到 exact 候选。测试明确覆盖这些负例。 |
| 不把新函数冒认旧函数 | Spec 36、42、47–51。候选要求旧 fact 当前缺失、目标 ID 在旧快照不存在、同 kind/language/shape 及完整 exact digest；旧 ID 仍存在为 retained_id。摘要相等只证明指定捕获内容相等，接受记录是用户明确声明延续，不能证明行为等价或真实开发操作。唯一候选也不自动绑定；复制后删旧可能相等的限制已明确。 |
| 模糊、歧义及未知 | 多 exact 新候选是 ambiguous，显式选择后仍重新验证一对一；没有旧 capture、未知版本、不可用/解析或预算缺证据为 unknown，禁止迁移接受。完整精确比较没有匹配为 none，不能以未知混称删除；未知时另走 KN 的独立人工绑定不意味着迁移证据通过。没有全局 alias、相似度或 confidence score。 |
| legacy 历史快照 | Spec 25、50、74。旧 snapshot 不回填身份摘要，不用当前 source 字节伪装历史正文；缺 evidence 仍可读取并明确 unknown。新证据进入 facts fingerprint，既有 captured-v3 contentHash、makeId 与事实关系格式不变；版本不兼容不能降级到相似匹配。 |
| Relation/folder | Spec 33–34、62、97。folder 只表示完整捕获支持源码子树，不迁移每个 child；relation 需要同 pair 已接受或本批验证的节点对应及真实端点/捕获表达式，不借行号/生成序号猜 identity。重复表达式不能称唯一；dynamic/external/未解析缺证明。contains/calls 快照均不改。 |
| 当前快照与跨项目 | Spec 42、59–62，Plan Task3/5。查询与接受均限定同项目 immutable snapshot pair，to 必须为当前项目指针；接受在同一事务重读 current snapshot/hash、registry revision，拒绝过期/foreign tuple。请求不能提供可信 digest/status/actor。设置记录限 pair，不串成跨历史 alias。 |
| 显式 KN 重绑 | Spec 60、66–68，Plan Task4。checkbox 默认不选；必须校验当前 annotation 未删除、revision 一致、当前 target 仍为 from ref，复用 KN 当前目标/snapshot/availability guard。仅写选中的 binding、新 revision/history，正文/作者/source/constraint 保持；任何中间失败回滚。重绑后再次丢失仍按 KN orphan 锁存，不因旧 ID 重现自动恢复。 |
| 批准、history 与只一次失效 | Spec 64、68、72–74。映射记录不可变、UUID/history 碰撞拒绝；无 note 语义变化不改知识/plan。选中 note 批量重绑使用窄同事务接口，最后 invalidateProjectPlans 一次，不能逐条 bind 增加多次 revision。旧 approvedPlan、Approval、annotation context 和路线原文不重写；当前 context/批准按 KN 正常失效。 |
| FS intent / verification | Spec 11、74、100。planned ownership/临时函数不是新源码事实，不能进入捕获候选；accepted mapping 不 rebase plan/tempIds/memberIds/routes/view，不让旧批准 valid，也不让 verifyPlan 通过 migration alias 确认源码已移动。保持独立历史批准验证。 |
| 预算、分页与真实 UI | Spec 38、44、53、80、90，Plan Task2/5/6。存储 entry/JSON、每次候选事实扫描/比较、page 和 response 上限均给出具体值；预算未覆盖时不能报告唯一或 total。实现仍须逐一兑现这些约束。UI 有实际候选查看、单选、确认、可选 note 选择、取消、409 保留选择/明确重载；MCP 只读。Task6 要真实双语浏览器/生产 HTTP-MCP/SQLite restart/源码 SHA 与旧上下文保持证据，没有用隐藏按钮代替功能。 |

## 现有代码对接核对及剩余实施条件

实际 Graph 以 path、qualifiedName 和 declaration kind 生成 function ID；class/method 用 `CodeNode.kind=function` 加 declarationKind 区分，所以新 schema 应沿这两个字段，不发明不存在的 node kind。TS 实际采集入口保留完整 AST 供新 evidence hook 使用；Python helper 以 stdin 捕获 bytes 做 AST 分析，设计无需 import/执行目标代码。

实际 `Annotations.bind` 已在同步 storage.transaction 内做 project/CAS/current target guard、写不可变 history 并失效规划；目前没有 `bindMany`。设计正确把批量接口标为 KN owner 的待协调内部接点，不能直接逐条调用现有 bind 后宣称“一次失效”。实际 WorkspaceService 快照保存也走同步 transaction；设计中的两个发布/接受顺序可在后续真实 SQLite barrier 测试验证，当前只读审查没有执行或证明这些测试。

写入 settings 不需新 RecordKind，仍必须实现严格 registry/record schema 和重复/CAS/不可变历史规则。新 evidence schema 的 runtime 依赖禁止从 validation 反向导入，设计已明确这一点。公共预算与 unknown 的实现、metadata 和 fact 一致性、query/accept 使用同一 exact 资格检查、双实例 SQLite 回滚及 KN/POL 最终事务接口，都是实施阶段必须验证的条件，不能将本设计 APPROVE 当作其结果。

在主控协调后可进入后续流程；建议先修正 M1 并记录计划新 SHA，再实施。当前仍无 IDX-04 产品完成、实际 migration/rebind 成功或 CI 通过声明。
