# GRP-03 独立设计审查

**结论：APPROVE。C0 / I0 / M2。** 两项 Minor 是实施前的明确化建议，不阻断本次设计批准；本报告不批准产品完成、测试通过或票 DONE。

- 审查者：`/root/idx01_impl`，原 **gpt-6.1-sol high**；未替换模型，未 spawn。
- 审查时间：2026-10-10 17:14 UTC。
- 方法：独立只读审查完整 spec/plan、实际核心模型与验证、Knowledge/Planning/verification、HTTP/MCP、组分页/投影、规划删除/焦点与 FS/KN/POL 设计合同。
- 范围：只在本地写本报告；未修改 VM2 源码、目标设计、测试、构建、索引、Git index 或票状态，未运行测试/构建/索引/浏览器。

## 冻结输入

两份目标文档开始及结束时 SHA 均与主控提供值一致：

| VM2 路径（相对 `/home/agent/projects/AtlasMode`） | SHA-256 |
| --- | --- |
| `docs/superpowers/specs/2026-10-10-grp03-design.md` | `6c41004d26b98490a9ee9feeccf8c6d0f9adbd92f0aa4320973fa68e585645dd` |
| `docs/superpowers/plans/2026-10-10-grp03.md` | `b8651cb3c9430beab56c7a27254df4785661db0586142ffa83db5358a2321a10` |

结束时实际 HEAD 为 `c9b9206cb83f8bc440aa386140247b08a0eaa734`。spec 第 9 行所列 `619c39a` 是作者盘点基线；共享工作区有其他作者并行集成，本审查不把源码观察宣称为某个完整冻结提交或未来接口完成。目标两文档的审查结论只针对上述精确 SHA。

## 已核对的关键边界

1. **类型和事实隔离正确。** spec:31–55 将无序 `memberIds` 与 sequence.order 分开，要求准确排列；wrapper.entryId 可独立于成员集合。既有 `FunctionGroup` 只有成员集合（`packages/core/src/model.ts:161`），既有组投影仅按加载的真实成员交集建立镜像（`apps/web/src/features/groups/projection.ts:16–44`）。spec:94 保留该投影边界，不以 order 生成事实 calls，不扩查非成员/范围之外入口，也不把临时入口写入持久组。
2. **真实与规划入口生命周期可实施。** spec:51、55、73–82 区分当前真实 function 和同一 Plan 的 add_function.tempId，约束外部/展示/跨项目/跨规划身份；实际 `verify` 收集当前受验规划自身 add_function，并按路径/名称/可选签名绑定，历史验证使用已批准规划及其基线（`packages/service/src/verification.ts:27–30,106–161`；`workspace.ts:189–205`）。显式重新索引后选择实际入口符合现有行为，无自动猜测迁移或源码 writer。
3. **must_reuse 和组合验证保持真实含义。** `verification.ts:165–219,291–298` 将 add_relation 的所有规划类型核对为真实直接 calls；无调用为 unmet，动态、覆盖或绑定不确定为 unknown。spec:78–90 和 plan Task5 明确 caller→entry/所选步骤，以及独立勾选 entry→member；禁止 self reuse，建议默认不加硬要求。group_contract 始终将顺序/分支/数据传递标 unknown，直接要求 satisfied 不推出完整 wrapper 行为。
4. **冻结契约和旧批准兼容方向正确。** `Planning.latest/get/approve/export` 核对原 semanticHash 并保存不可变 approved-plan（`planning.ts:35–77,195–257`）；`semanticPlanContent` 只 canonicalize 既有规划字段及严格解析的操作（`core/validation.ts:598–614`）。spec:55–61 冻结完整 title/memberIds/composition，新增/修改合同在更新事务核对源组，未变合同保留历史；旧六种操作序列化不变。plan Task1/2/5 要求旧 hash fixture、历史 JSON、修改合同失效及旧 add_function 绑定回归。无需增加或回填旧 Group approval hash。
5. **知识 CAS 与保守失效有明确落点。** 现有 `knowledge.ts:115–156,161–185` 验真实全成员，成员集合排序比较，语义变化使本项目当前 plan revision 增加，历史批准不改。spec:47–59 和 plan Task2 将 reread/CAS/snapshot/domain 校验及组/plan 写放同一事务，CAS 先于 no-op、正 safe integer/溢出拒绝、legacy 省略 composition 保留最新值，非法成员修改整体回滚。真实 SQLite 双实例 CAS 与他项目隔离列入验收。
6. **全成员、分页和范围保持分离。** 当前 `readMembers` 只读 20 项、并发最多 4，404 missing 与 transport/snapshot error 分开（`memberBindings.ts:11–60`）；GroupsPanel 编辑源是完整 draft.memberIds。spec:49–51、100–107 与 plan Task1/3/6 要求 25+ 全成员/仅 20 已加载、超限 capability 保留、不截断、两组共享成员和迟到回复。order 的初始草稿不声称静态执行顺序。
7. **HTTP/MCP 与批准权限有可验证路径。** 当前 HTTP 严格 group/updatePlan 输入分别在 `apps/server/src/routes.ts:58–77,273–281`；MCP `propose_group` 不接收 id/source，固定 Agent 来源，不覆盖用户组（`apps/mcp/src/server.ts:333–346`）。规划提案经服务 update，MCP 无批准工具；plan Task2/6 列出 schema 边界、409、Agent scope、实际浏览器批准和网络域 ID 收据。新增合同不得绕过服务验证；MCP 新 operation 共用 operationSchema。
8. **FS、KN、POL 接口边界正确且有顺序条件。** spec:86–94、plan Task4 采用 captured project/plan/revision/snapshot 保存，阻止 pending 草稿批准旧版本，迟到 response 不换项目/焦点；源代码读取用物理域 ID/path 与 generation，规划入口不伪称源码字节。与 FS 设计的事务 expectedSnapshotId、有效目标路径和 live-byte guard 一致。KN 注释上下文版本/hash 独立，不把新合同偷加进旧 annotation context；Plan 自己的 semanticHash 覆盖合同。POL 最终项目队列/批准 facade 复用，不另造协调器。实施必须等待主控冻结这些共享接口并授予窗口，此项是计划执行条件而非当前产品已满足的声明。
9. **完成验收不是纯 schema/build gate。** spec:96–109 与 plan Task6 覆盖真实类型切换/排序/取消/保存、现有入口源码、新 wrapper 完整路径、must/suggested/internal、CAS 竞态、pending 批准、删除/undo/reload/restart、真实 reindex 和人工 fixture 阶段区分、scope/多对多回归、完整 source SHA 收据。可执行的验收规划完整；本审查没有替代任何未来真实 gate。

## Minor 建议

**M1：把新操作在焦点收集器中的明确处理加入 Task4 文件窗口及 RED 场景。**

- 位置：plan:36、78–85、94；实际 `apps/web/src/features/graph/focus.ts:44–70`。
- 实际 `affectedNodeIds` 是穷尽旧六种操作的 flatMap switch。新增 union 后缺 case 会引入 undefined（或由类型检查发现）；当前计划提及 switch/typecheck，但该真实消费者没有明确列入文件窗口或规定返回语义。
- 建议明确 `group_contract` 本身返回 `[]`，只打开合同详情；组合中另有 add_function/must_reuse 时，沿已有操作各自处理真实端点。追加合同单独变更不传 groupId/contractId/undefined 到 CodeNode API、不强行拉入 200 个成员的聚焦/分页负例，并向主控申请此单文件窄窗口。
- 非阻断理由：spec:88、94 已明确合同不能当 CodeNode，plan:94 已要求 variant 遗漏被 typecheck 发现；缺的是具体消费者和测试落点，无需改变设计方向。

**M2：明确删除临时入口后的失效合同保存在何处，统一保存与批准文案。**

- 位置：spec:55、75、82；plan:46、73、82、105；实际 `planning.ts:177–190,195–209`。
- spec:55 要求缺失/删除入口阻止保存和批准；spec:82/plan:73 要求删除 add_function 后保留失效合同、显示 invalid 并阻止批准。现有 Planning.update 只 parse 后保存草稿，再返回 issues，approve 才拒绝结构错误。因此实施需明确选择，不能无意将一般既有失效草稿改成不可保存，或通过旧 parse-only 路径保存被新规则明令禁止的缺失入口合同。
- 建议按 spec:55 的现有强规则写清：删除后的失效合同保留在**未提交预览/draft**，拒绝该组合提交并持续阻止批准服务端旧版本；用户可显式选择合并删除入口和合同，一次 CAS 保存。不改变其他旧 operation 的失效草稿兼容语义。若产品选择可持久化失效合同，应先统一这两处规则和 server/browser RED 预期。
- 非阻断理由：现有文字可以一致解释为保留未提交草稿；pending/失效提示、明确合并删除和保存失败保留输入已经在 spec/plan 中要求，只需写明这个实施状态。

## 观察源码 SHA 收据

以下为结束时实际读取文件的 SHA；共享源码可能由获授权的其他作者继续变化，实施时应再冻结自身候选并重核。

```text
2c4a9c0334af9dcf1993218be6911b4af304def2082385123795c5ba3a1b4a0d packages/core/src/model.ts
11b4af2d64d651823ad0a06c444ac32842681a005519ef14e1105ca4b3c0156d packages/core/src/validation.ts
487cad592b48b6bf2c38dbe6e63e8093eb49ef8b7487b6ce6f6db02be1c422e8 packages/service/src/planning.ts
8f07eda48aafb1992411d0709ebeae7b7f65c0be01a6b5cbd59700b9fcf93c4d packages/service/src/knowledge.ts
715538ce543856e26ed27532cb71c9316dc19024d5a68d460405dd8d691c9a55 packages/service/src/verification.ts
67940c9006450fe59d4834eab6d5c72620076475a0f234840b54aeb5552605a9 packages/service/src/workspace.ts
267c0d1f68f74d2db5e8120230f2bc3056b7e739f76b78c874881991ab38af09 apps/mcp/src/server.ts
2c4976ae708713d6fb72dfa8631203623a0b4143847e8dba993b8cfa1fd1af67 apps/server/src/routes.ts
e28346719156e389cbd38b12842c3b454efe89ae9a574ecc1c5bd3f2edf54341 apps/web/src/features/groups/GroupsPanel.tsx
37e4575b75c21afe5c78ce757f7cfecb1b0a877966d35bf22f27f44d102454a5 apps/web/src/features/groups/memberBindings.ts
027249184becc3af2187519ac55c5700302202f16ee89ad7d57e4d94dea60f67 apps/web/src/features/groups/projection.ts
398b76b06777fe2962fcc739a4e9b7f53881fff0242eb7bbdbfc6a4e279cdc52 apps/web/src/features/graph/focus.ts
f4ad503d3043ac62107b5bafff1e0e034db954a4da4df26d1fcadc25f8e7d8fc apps/web/src/features/planning/operations.ts
df84e59da7d1c1c1dfcdeaa89ae44590bb939a3a1f1d4202267c1f699c934d2b docs/superpowers/specs/2026-10-10-fs01-design.md
92fa349ad79e608e392db130cef6832b7a8b384ed254ad35585f6a58d0777802 docs/superpowers/specs/2026-10-10-kn01-design.md
6e8a2d0be72e4ed8e888147bae3fbf67fdf2beb0d31b1878aba6d0354388e27c docs/superpowers/specs/2026-10-10-pol01-design.md
```

**设计审查批准范围：仅上述两份冻结设计/计划。产品实现、共享接口冻结、真实 HTTP/MCP/browser gate、独立实现复审及 clean 集成仍待实施阶段完成。**
