# DIFF-01 R1 限定独立设计复审

2026-10-10。原独立 reviewer `/root/idx01_impl`，明确沿用 `gpt-6.1-sol high`；未写 DIFF spec/plan，未将自身 IDX04 依赖作者角色冒充 DIFF 实现或独立产品验收。

**结论：APPROVE — Critical 0 / Important 0 / Minor 0。** 原 I1/I2/I3/M1 已在设计与计划层面定向解决。批准范围仅为这些文档修订；不授产品窗口、不证明接口存在或测试通过、不标 DIFF-01 DONE。

## 精确对象与原证据保留

| 文件 | SHA256 |
| --- | --- |
| R1 spec | `acdf7b831a49b9eba9dde0d7333daa301f31974748537fe66198361c7c032b24` |
| R1 plan | `4c6e347b7edb13156b8f235c1fea181ced7721e3b8deda6cc74d4438217fd60e` |
| R1 manifest | `efa9ee57254f72dd076bf3f8779ae0a23a81ba8adc17912b6bbda9afc81672bc` |
| R1 patch | `4ac811df0af1bd4dea4339281cb26b865047a453a2f6abb9fd072e4321a6fe7f` |
| R1 repair receipt | `61f8d92691c709a66d4de24131818fe03c43665274fccd7b0d9dad01379f760d` |
| 原 spec（R1-before） | `5a33442fd50956d44fae5d4d71f87de01f7f769d1310e715013ba4f4c01b402f` |
| 原 plan（R1-before） | `7ab46071e1e7920fbf1d8effab3707d66ba539bf92f9dfd19756608105248828` |
| 原 readonly basis | `507adf0a7fad69263fe4da6b792607f155901deea16bfc1d528e5f8d7f896ea1` |
| 原 REQUEST CHANGES report | `61176835b8028fa7ae29d96eb07f40126aaa494178601c080a7d416b78ce5536` |

VM2 `/home/agent/projects/AtlasMode`：当前 spec/plan 与 `docs/superpowers/reviews/diff01-2026-10-10/R1-after/` 的完整归档对应，R1-before 的原 spec/plan/basis/report 与 manifest before SHA 一致。原 basis 和原 report 在原位置完全未改；共15个当前/修前/修后/修复凭据文件独立 hash 验证通过。报告只写 ROG task-3，未改目标 docs 或产品代码。

## I1 — PASS：在比较索引前证明事实集合结构有效

spec:49、A6-R1 与 plan Task1:48/50、Task2:56 已明确：pair reader和直接pure入口都调用 `validateCapturedSnapshotForDiff`；先事实50k预算，再 validation-only Sets/200000-work验证每侧 node/relation ID唯一（重复相同payload也拒绝）、source/nonnull target/parent存在、resolved/external/unresolved null与kind一致性、known evidence事实引用/key、manifest typed keys。通过前不建比较Map、不统计映射/caller/bypass；损坏固定 INVALID_SNAPSHOT，禁止 last-value-wins/去重修复/写回。

具名未来测试覆盖原反例及 SQLite reader/pure入口两个边界，正常 unresolved-null 和 legacy optional evidence缺失保留兼容；结构/work超限在下一项前拒绝。它直接解决当前 snapshotSchema strictObject不提供 uniqueness/endpoint一致性的问题，不要求改全局legacy schema或重新推导所有历史Graph hash IDs。

## I2 — PASS：producer严格与历史unsupported证据读取分层

spec:37–39、47，plan Global Constraints与 Task1:46/50、Task2:59 定义专属 `CapturedSnapshotDiffReadModel` 和 `parseCapturedSnapshotForDiff`。Producer/publicwrite只接受合法v1；读取严格验证 base/known字段，optional不存在为missing，不支持的合法正整数version且有界object为unsupported。unsupported payload在preflight后丢弃，不作为正文/配置/身份证明，不向pure/UI复制；validatedValue仅supported存在，直接pure入口校验state/version/value一致性。

已知v1坏digest/count/path/key/reference、base损坏、非法version/非object不能降为unknown；未知版本仍受整row32MiB、manifest8MiB/identity16MiB、depth64/token1000000及duplicateJSONkey拒绝。缺失/validv1/opaquev2/malformedv1/oversize/depth/token/extra已知base均有对应未来用例；v2仍可比较knownmetadata，body/input unknown，不用当前source或别的snapshot补造。IDX分层parser仍是公开合同前置依赖，不假装已存在。

## I3 — PASS：ledger/pointer 的 raw读取在 parse前有真实界限

spec:51–55、plan Ownership:35与 Task4:81 定义同storage/same readonly transaction的 `DiffBoundedRecordReadPort.measureExact/readExactWithin`，exact keys、chunk≤256，limits为server常数。Project pointer16KiB、registry1MiB、selected record64KiB、registry+selected合计16MiB，acceptedIds/correspondences≤20000；length-first不是get后stringify。

Registry bounded raw的lexical preflight在20001 acceptedIds项前拒绝，strictparse验证version/revision/uniqueUUID/extra fields；随后先量测全部selected exact row长度并验证单项与aggregate，再读取任何accepted value。Registry+selected累积token≤1000000、扫描工作≤量测aggregate bytes两倍，不能逐record重置无界预算。Missing/foreign/otherpair/duplicate/malformed failclosed；仅有界确认absent且expectedrevision=0允许空ledger；无能力/不同transaction返回DIFF_UNAVAILABLE，不fallback generic get/list/空数组。

Future真实SQLite及materialization/parse-spy用例包含每个raw/count/aggregate边界、duplicate/missing/foreign、巨大unrelated记录、capability absent及正常revision/SID/hash一致性；原“先无界load再拒”缺口已转成可验证的读协议。现 generic get/list不受本复审改动，也未被当作满足此新能力。

## M1 — PASS：baseline metadata 变为真实 Task0 前置合同

spec:57–59 与 plan Ownership Task0、Task5:91 固定 `IdentityBaselineMetadataReadPort.readPage` / `IdentityBaselinePage`：metadata-only SID/hash/date/git、current pointer/revision、indexedTotal、exact total或null/unknown、all-captured/indexed-subset coverage，以及returnedCount/nextOffset/hasMore。Page20/50、project rows20000、row8KiB、aggregate16MiB、response64KiB；有界length/count/aggregate先于raw/parse，不读整snapshot或物化无关项目。

Proposed settings header/coverage marker及生产责任必须由IDX/Storage owner在Task0冻结；未来capture可原子维护derived header，但本次不改IDX04文档/源、不新增migration、不自动backfill旧snapshot，也不把该metadata能力称现役接口。All-captured exacttotal须有可信coverage/count同事务证明；legacy subset则unknown/null，缺能力/marker不可信时selector不可用，不返回空列表称无历史。Many-baseline/huge unrelated/partial-vs-exact/byte-page/absentcapability具名owner验收是Task1产品工作前的门，消除了到UI阶段才选择list后slice的缺口。

## 修订范围与源码新鲜度

对原patch检查表明修订集中于四个失败项和所需typed read-model/port/Task0；原immutable same-project SID/hash/current-history、same-ID/accepted exactpair、caller/site/lineID多重集合、unknown负向范围、零入边不死、externalSDK静态pattern而不判意图/runtime、历史source/body不补造、无approval/knowledge/plan/sourcewrites、实际HTTP/SDK/browser futuregates保留。本复审不重新宣称这些已实现。

原basis的23个来源独立重算，本次开始时有5个在途owner路径相较旧basis改变：`apps/server/src/routes.ts`、`apps/server/src/queries.ts`、`apps/web/src/api/client.ts`、`apps/web/src/app/WorkspacePanels.tsx`、`apps/web/src/app/workspace.ts`。原basis/report保持历史原SHA，不能当这5个路径的当前产品freeze。I1/I3实际依据 core/model/validation、storage/sqlite 等仍为原SHA；本限定复审是文档读取契约审查，5个在途UI/API改动未作产品复审。实施前需主控冻结当时源与Task0接口、重新核对共享窗口及真实编译gate，不借本文冒名整仓/source不变验收。

## remaining与批准限界

- 原 I1/I2/I3/M1 设计问题关闭，无新增C/I/M；原 REQUEST CHANGES报告和所有原字节保留。
- Task0 metadata/producer、IDX layered evidence及accepted projection、sameTXN bounded storage能力均仍待owner交付与主控批准。没有这些不能开始Task1；设计APPROVE不授产品窗口。
- 产品TDD、scoped/clean build、实际SQLite/HTTP/MCP SDK/双语browser/readonly invariants/原verification回归都未执行。DIFF-01未DONE，不将本次静态审查计为任何门禁PASS。
- 未修改目标docs/source、未运行tests/build/index、未访问运行DB/实例、未stage/commit/spawn；仅本独立报告与只读hash见证写ROG。

## 最终只读完整性见证

15个reviewed artifacts复核前后SHA一致，变化清单 `[]`。23个来源本次复核前后变化：["apps/web/src/app/workspace.ts"]；相较旧basis的5个在途路径差异另见上节。读取前/后完整hash见证为本机 `diff01-R1-review-before.json` / `diff01-R1-review-after.json`。以下为本次实际来源SHA，不将其冒名为产品验收freeze：

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
9a906e8e637aeafacc2197e3959b27ac76636dd0fb0a62ad50549374d872cfdb  apps/server/src/routes.ts
6ca8563aa93c7b4a7f6a2384aba97b322a40bf3a831618902559b021959958b2  apps/server/src/queries.ts
2039168ec634179df6350c3f083adf4bd6640338ba09b8c78799004317f59b04  apps/mcp/src/server.ts
2cd1ab609c38c8e10099191be4a78a478016739d988da1b45f7b100f941752ea  apps/mcp/src/client.ts
d578a2452ba09b2bd6e51f1c1b92c16d95cdfe25ce75a90776798bc008b78281  apps/web/src/api/client.ts
963c93fc6cace123175196dc1d690f392a434df755e2f43aeaaf72bf32530ff2  apps/web/src/app/WorkspacePanels.tsx
af89d4f826340b12cf383c6593832be1102e6bec85cb61fb58df1b6be374d75e  apps/web/src/app/Navigation.tsx
534506c3e103bfcc80c09957571674ae23cdff4dec65a6e70bde68026a76dbbc  apps/web/src/app/workspace.ts
1811a55b169052352f1134ab93a6702c4983d654c4b30f90302fa5b119a527e2  apps/web/src/features/verification/VerificationPanel.tsx
```
