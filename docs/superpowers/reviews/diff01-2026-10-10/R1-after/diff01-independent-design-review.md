# DIFF-01 独立设计审查

2026-10-10。独立 reviewer `/root/idx01_impl`，沿用明确 `gpt-6.1-sol high`。本 reviewer 未写 DIFF-01 spec/plan；仅为 IDX-04 依赖设计作者，不把该关系称产品实现证据。授权只读设计/实际源，报告仅存 ROG task-3；未修改目标 docs/source、未执行 tests/build/index、未操作运行实例/DB、未 stage/commit/spawn。

**结论：REQUEST CHANGES — C0 / I3 / M1。** 三项 Important 是读取/校验契约缺口；不要求重写已通过的 captured-pair、unknown、静态证据、UI scope 与无写入设计。

## 冻结对象与实际依据

- spec `docs/superpowers/specs/2026-10-10-diff01-design.md`：`5a33442fd50956d44fae5d4d71f87de01f7f769d1310e715013ba4f4c01b402f`。
- plan `docs/superpowers/plans/2026-10-10-diff01.md`：`7ab46071e1e7920fbf1d8effab3707d66ba539bf92f9dfd19756608105248828`。
- author basis `docs/superpowers/reviews/diff01-2026-10-10/readonly-design-basis.md`：`507adf0a7fad69263fe4da6b792607f155901deea16bfc1d528e5f8d7f896ea1`。
- VM2 repository `/home/agent/projects/AtlasMode`，当前 HEAD `8c305ae5fd68118f53d16e544e8b5f5dc81bfab5`。basis 中 23 项 SHA（18 产品文件 + ticket/IDX04 docs/review/receipt）独立重算全部相符；本报告最终写出后再重算并保存末尾结果。
- 直接核阅实际 `core/model.ts/validation.ts/queries.ts`、indexer `index.ts/graph.ts/scan.ts` 及 TS/Python 捕获限制、storage `sqlite.ts`、service `workspace.ts`、server queries、MCP 现有 snapshot/context/refresh、Playwright 配置，以及实际 DIFF ticket 和 IDX04 spec/plan。没有用执行目标源码证明任何结论。

关键实际行：`packages/core/src/validation.ts:247–277` 的 snapshotSchema 只有 strict 对象/数组字段检查；`packages/storage/src/sqlite.ts:354–365` 的 get/list 在取 value 后 JSON.parse，list materializes 全 kind；`packages/indexer/src/index.ts` 只存事实/整体捕获 hash，readSource 使用当前目录；`graph.ts` 的 relation ID 含 line 和生成序号；`workspace.ts::verifyPlan` 会刷新当前而读历史已批准 baseline。下面反例均为这些契约的静态推演，未运行测试。

## I1 — DIFF 必须在建 ID 索引前拒绝重复事实及损坏端点

**位置：spec:43、47；plan Task1:43–45 / Task2:54–57。**

拟 bounded reader 说“严格 schema/project/id 验证”，但当前 snapshotSchema 允许 nodes 中同一个 id 出现两次、relations 中同一个 id 出现两次，且不检查 relation source/target 指向本快照节点、resolved-null 或 external-kind 一致性。plan 的 duplicate 测试在 Task1:42 对应 manifest typed key；Task2 的 one-to-one/same-ID collision 对应 mappings，均没有明确覆盖原始 snapshot 的重复事实。

例如同一侧两个 node 都为 id=F、但 metadata/body evidence 不同，按 Task2 的 ID indexes 实现可能悄悄保留一项；重复 relation ID 也可能被折叠或重复计数。两个快照 serialized bytes 都小于预算、snapshot/project/id 元字段合法时，仍能得到错误 modified/reference/caller/bypass 结论。StrictObject 不提供这种唯一性保证。

**窄修复：** 明确 DIFF pair 的只读结构验证，在任何 Map/对应关系/引用统计前、且在 50k 工作预算内执行：每侧 node IDs 唯一、relation IDs 唯一；relation.sourceId 存在；非 null target 存在；resolution 的 null/actual node kind 一致性；parentId（存在时）和 identityEvidence 引用不能悬空，manifest/evidence key 不得重复或冒事实。对故意损坏的已知字段 failclosed `INVALID_SNAPSHOT`（定义同一稳定错误），不按“最后值胜出”归一化、不写回存储。保留缺少 optional legacy evidence 的兼容；不要求重新推导所有历史 Graph hash ID 或改既有全局 schema。

**必须增加的未来测试：** duplicate node 同/不同 payload、duplicate relation 同/不同 endpoints、悬空 source/target/parent、resolved-null、external 指向 internal node、evidence 指向不存在事实。纯 compare 入口和真实 SQLite pair reader 都拒绝，readonly记录前后完全不变；正常 unresolved-null/legacy missing evidence 仍可读。写两 docs 的明确契约与具名测试即可，本轮不实施。

## I2 — v1 producer/schema 与未知可选证据版本读取分层尚未一致

**位置：spec:25、31–35、43、51、90；plan Task1:42、45 / Task2:54。**

spec 要求 `diffInputManifest` 严格 version1 schema，并把该 optional 字段接入 snapshot validation；pair reader 又严格解析整个 CodeSnapshot。但同时承诺 manifest 未知版本只是 `inputEvidenceState=unknown`，A5 要显示未知版本的 scope/证据限制。若实现直接把 optional manifest 接成 z.literal(1) 然后调用 snapshotSchema，合法基础事实 + manifest.version=2 会使整 snapshot schema 失败，无法保留已知事实页或达到“只证据 unknown”。Task1 的“version refusal”和 Task2 的“unknown digest/manifest leads unknown”也没有区分生产输入与历史读取。

**窄修复：** 明确两个通道：capture producer/已知 v1 字段 malformed 必须拒绝；读取已存历史的缺字段或不支持的证据版本时，在整个 record 的原始 byte 上限内单独识别 optional evidence 版本，严格验证 base snapshot/已知字段，保留只读 unsupported 状态，不用当前 source、其他快照或后续 capture 补造其 digest/capability。具体可采用专属 bounded read model 和分层 parser；不要笼统把所有 schema 错误降级 unknown。IDX04 identityEvidence 未知版本同样必须与其最终公开 parser 协调，不假设整个 snapshot 能绕过任意已知字段错误。已有版本下重复 key、坏 digest、坏 counts 等属于 malformed，仍 failclosed。

**必须增加的未来测试：** missing manifest、完整合法 v1、未知 version2 的 bounded opaque evidence、已知 v1 malformed 分别得到规定结果；对 version2 snapshot 已知 metadata 正例可比较，input/body 相应 unknown；不输出旧 source/body/config 摘要伪证据。超大未知 evidence 仍先由32MiB raw row门拒绝，不能靠“unknown”跳过预算。

## I3 — Snapshot 原始读取有预算，ledger 原始读取尚可先无界 materialize

**位置：spec:26、41、43、47；plan Ownership:33–35 / Task4:72–77。**

两个 snapshot 的 length-before-value/JSON.parse 设计是正确的。但查询还读取 project pointer、registry 和其 accepted records。新只读 projection 签名仅返回 `AcceptedIdentityCorrespondence[]`，没有 raw registry/record byte 上限或 parsing 前的能力要求；现 generic get 会先 materialize+JSON.parse。`accepted correspondences≤20000` 只控制解析完成后的数组数量，内部结果16MiB也发生在更后面，不能保护 registry/accepted JSON 读取阶段。

例如当前 pair 的 registry 包含巨大的 acceptedIds/额外字段，或单个所引用 settings record 是巨大的 malformed JSON 对象：最终可能被 strict ledger parser 拒绝，却已在 generic get 里读取和 parse 全量。两个 snapshot 完全合法且很小，仍突破“在昂贵工作前/迭代界限拒绝”的资源契约。缺少 bounded projection 的 adapter 也可能无界 fallback，而目前只有 snapshot adapter 明确禁止这种 fallback。

**窄修复：** 给 IDX readonly projection/DIFF reader 约定同事务、exact keys、解析前 raw byte/count/aggregate-work 的 bounds：registry 自身、单 accepted record、全部所选 ledger 合计（及其 project pointer metadata 若仍经 generic get）都要有实际限值和 bounded storage 能力；先检查字节再取 value/parse，先检查 acceptedIds cardinality/重复和总量，再逐项读取本 pair 的确定引用，缺失/损坏仍 failclosed。不得 list 全 settings、读候选链或先 get 全量再 stringify；缺 bounded 能力返回 DIFF_UNAVAILABLE，不自动退空映射。新窄 port 或由 IDX adapter 消费同 storage 的 bounded primitive 均可，由作者给最小精确接口/常数并列 shared-window 需求，不强迫全局改 get/list/schema。

**必须增加的未来测试：** 大 registry、小 registry+巨大 selected record、many small records 合计超限、重复 acceptedIds、foreign/other-pair record、缺失 referenced record、bounded adapter absent、巨大 unrelated settings 不参与读取。证明拒绝先于 value materialization/JSON.parse，未返回 partial mapping、total0或成功差异；正常 ledger 与 snapshot pair 同 transaction/revision parity 保持。

## M1 — 将 bounded baseline metadata 的未落地依赖固定为可验收接点

**位置：spec:45；plan Ownership:33 / Task5:82。**

文档诚实说明 `listIdentityBaselines` 尚无已实现有界保证，这不是假称当前可用。实际 IDX04 设计只有分页同项目列表签名，未定义 storage metadata adapter；现 StoragePort.list 会读取所有 snapshot JSON。建议在 docs 里固定该依赖的 metadata page 字段、total/unknown/truncation、no-list materialization 能力和缺能力错误，并指定 IDX/Storage owner 接口协商为 Task1 前置门。不要在 UI 产品阶段才决定采用 generic list后 slice。

最低未来验收：很多无关项目/超大 unrelated snapshot、当前项目多历史baseline、metadata有界分页精确 totals（无法证明完整时明确 unknown，不把采样数当total）、缺 adapter 的 selector 明示不可用。此 Minor 可保持依赖阻塞说明，由主控协调接口；不要求本轮造索引/迁移或 history 平台。

## 已通过的设计部分（保持）

- 两个明确 captured SID/hash/project；current pointer与historical标签分离，same transaction、CAS、世代防 late ACK；查询无refresh/source/knowledge/approval写入。
- optional manifest 从已捕获 source/config/package buffers生成 rawdigest，不重读目标；参与facts fingerprint但保留原 contentHash/Graph身份；旧 snapshot不补造。
- 只 same-ID 或 user accepted exactpair对应；不接受未确认候选、跨pair alias、FS planned IDs；relation对应独立，不能从 node mapping 自动映射关系。
- caller 与 site 数分别统计，多重集合/对应端点可处理行号导致 relationID变化，零入边无dead判定；动态/parse/unread/excluded/unknown scope 的负向结论保守unknown。
- 内部及同名 external SDK 静态 wrapper模式有两条旧边和新direct边/计数，明确包/runtime身份未验证、意图不判定；不是must_reuse执行判决或自动calls。
- body/source未持久捕获时unknown，digest/preview/truncation独立；live source明确当前磁盘，历史fact不冒用current inspect。
- 50k工作/两跳/结果、page20/50、64KiBresponse、Unicode不割、准确nextOffset/total及预算错误无部分成功；同scope的HTTP/SDK和真实双语browser gates未来列出，没有把设计/SSR/schema当DONE。

## 复审范围与完成口径

请只修 I1/I2/I3 契约与对应plan测试，M1明确依赖接点；原设计 SHA/原报告保留。同 reviewer/model 针对这些失败项复审，不重写已通过部分，不先实施产品。IDX04实际模块与bounded接口、sharedwindows、编译/真实HTTP/MCP/browser与原verification回归仍是后续产品门，当前全部未执行。本报告是设计审查，不是产品安全/性能PASS。

## 最终字节核验

spec/plan/basis 在首次读取及最终定位复核均保持上述指定 SHA。作者 basis 的 23 个来源与本 reviewer 独立重算一致；报告写出后再次重算这 23 项，变更清单：[]。只读来源证据本机保存 `diff01-review-source-before.json` / `diff01-review-source-after.json`。无测试/build/DB/运行时验证。

```text
3bbff5db6580647ea16d2befb0c62af0e14dcff7247011ef03a787e426c989f2  docs/tickets/DIFF-01.md
439750c81287069a7c48b0f61d03f1275fec365780a59a5149389239ed86ba32  docs/superpowers/specs/2026-10-10-idx04-design.md
d6f058cad14305ac7b6568c3cba45c08c2ba86fd1e926fa950fa78d813bb6794  docs/superpowers/plans/2026-10-10-idx04.md
d5169d67045ce1721b8cfba30b63a08b765030f4f86d81ca44f62256c936d435  docs/superpowers/reviews/idx04-2026-10-10/independent-design-review.md
5b271717880838a5c9507a952413461222db6807439ff12dfb4fa8af4ee80205  docs/superpowers/reviews/idx04-2026-10-10/M1-repair-receipt.md
a61d1e3fa7fa33b4c50e3416c8c0e82e0f28fb82d8649f30774cdba219ab8abf  packages/core/src/model.ts
b31bc79d37d2fd0cc7ffaff8f5ae2fb3fb6adf5e7caa98e2d8913ca6a7374874  packages/core/src/validation.ts
4de37d4b8a217a97e507c605237803e87eb7a5a51925895fe9506ba9e8c5525e  packages/core/src/queries.ts
b3b67aefdec1569375deda0fa21b72ac060b2bad21330bd32d983e450efb7a36  packages/indexer/src/index.ts
e5f1526e10c88fb8ae6c69ca69cf86ddfbd902d60185d53e31a59d9778aa2a6f  packages/indexer/src/scan.ts
2705b340bbb9cec95a60bf88f0abaece0bd89a92b8e32691353c5c10e8c4bd4a  packages/indexer/src/graph.ts
b3a9f0da90de2b99fc9bdab3c086a3eab08c27081f3b2260b1aed7afd702cc3b  packages/service/src/workspace.ts
715538ce543856e26ed27532cb71c9316dc19024d5a68d460405dd8d691c9a55  packages/service/src/verification.ts
3aef48bfd53d62cfe93fe576d7d46b7bb9e4c84ce5a95d30ce6cc399284f44db  packages/storage/src/sqlite.ts
3d02ef217ca51eb9a4b0072a8e24ff89ff70a1337e856af45c916f62266f19a1  apps/server/src/routes.ts
8f6ef62561d355bfcb7df9838a9a52de0108096c0c352efd830d0d604fe2e70e  apps/server/src/queries.ts
2039168ec634179df6350c3f083adf4bd6640338ba09b8c78799004317f59b04  apps/mcp/src/server.ts
2cd1ab609c38c8e10099191be4a78a478016739d988da1b45f7b100f941752ea  apps/mcp/src/client.ts
d5bbe93903474b85cb70e314fbbe610f8c04071095dc0e1ff0c0740fef66bd29  apps/web/src/api/client.ts
5aa35e02cba84d67afb7d3e455226c35887a218c2722981ed047108966fbc871  apps/web/src/app/WorkspacePanels.tsx
af89d4f826340b12cf383c6593832be1102e6bec85cb61fb58df1b6be374d75e  apps/web/src/app/Navigation.tsx
63130c58c958c4e557feea65d0118018db49a8d04d3fd37e865b0e96e715fd39  apps/web/src/app/workspace.ts
1811a55b169052352f1134ab93a6702c4983d654c4b30f90302fa5b119a527e2  apps/web/src/features/verification/VerificationPanel.tsx
```
