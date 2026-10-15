# POL-01 冻结模块独立代码审查

2026-10-10 UTC。**结论：Issues Found；Critical 0 / Important 2 / Minor 1。原冻结模块先修 I1/I2 并定向复审，再进入共享接线。** 模块阶段没有产品装配/UI/HTTP/MCP/Workspace批准接入，绝不能称POL-01完成。

按要求只读：先读 `docs/reviews/pol01/2026-10-10-module-freeze.md`、`module-freeze-sha256.txt`、`public-exports.patch`、`receipts/modules-freeze.txt`，再读core/schema/adapter/state/sync及三个测试源文件。首次 `sha256sum --check ...module-freeze-sha256.txt` 所有13项均OK；以下行号/结论固定指向原冻结源码，其中structure-sync SHA256 `ef64969a33ac6b543989dcf605d22b4299bde2e8ee61a0586c87f539e8be6585`、core structure SHA256 `1b12ba935fb06dfbdbaa9d7d118d1a0eb345baa48044b058462b2c0c66be6b98`。不吞后续修复或替换原结论。

## I1 — 直接重试会绕过恢复中新生成的terminal mutation结果

`packages/service/src/structure-sync.ts:447–461`仅在恢复前查一次same mutationId audit；`462`的readLocked能recover并生成committed/aborted audit，但后续仍继续走旧CAS和publish，不重新校验terminal请求结果或pending intent的requestDigest。

场景A（afterDigest）：rename成功、finalize暂时DB异常，原update返回RECOVERY_PENDING且无audit；故障恢复后客户端直接发送原sameid/samepayload请求。prior查询未命中；readLocked在recoverLocked848–852/finalize813–838成功生成committed audit并增structureRevision；返回update到465–470用旧expectedRevision检查，因此错误地返回409，虽然此请求已经成功保存。现有成功retry测试162–174仅覆盖已经terminal之后重试；DB恢复测试296–331先单独调用recoverStructureWrites，不覆盖update直接retry。

场景B（beforeDigest）：publish抛出未知结果、intent仍prepared、disk仍before。客户端直接sameid重试：recoverLocked857–883写aborted audit且pending=false，但before state/revision不变；update继续CAS通过，重新创建同id prepared并publish候选，最后saveAudit同key覆盖已aborted历史。sameid不同payload在该路径也可能替代原request结果。违反terminal幂等、不同请求不能复用id、before恢复不重放及审计不覆盖合同。现有prepared test518–558只独立recover，不测直接update resumption。

同类缺口：no-op返回点509–510/566–570/578–580没有保存mutationId/requestDigest结果；同id在no-op后改变payload仍可写入。设计要求无虚假写入audit，但仍需一个durable no-op outcome/receipt，不能因此取消同id不同请求约束。

修复方向：pending/terminal request绑定在恢复前及恢复后都可信校验；readLocked恢复后重新读取sameid terminal记录，committed返回其既有结果/新鲜state，aborted/failed/conflicted保持原terminal outcome且不publish；payload不同一律拒绝，不覆盖原audit。no-op可独立保留请求结果，不能生成伪造写入audit。加actual SQLite直接retry after-finalizefail / before-abort / differentpayload / noopreuse的定向测试，assert publish次数、plan revision、audit原结果不变。

## I2 — 无法观察磁盘被误判为第三摘要冲突，阻断自动恢复

`observe`746–755遇到任意files.read错误返回undefined；`recoverLocked`842–885只有已观察的after/before判断，undefined落入885–929的第三版本分支：写state.status=conflict、intent.phase=conflicted/pending=true，诊断称磁盘内容不同于两个journal版本。实际上没有观察到任何第三digest；audit虽然observedAfterKnown=false，状态诊断仍无证据。

场景：已有rename后pending intent、disk正是afterDigest；恢复时read发生一次临时EIO/权限或瞬时文件访问失败。模块写phase=conflicted；后续即使read已正常、disk仍after，recoverLocked843立即false，不再重新观察。普通读、withProject、restart recovery均无法自动finalize，要求用户显式acceptExternalConflict才能解除一个从未真实存在的外部冲突。也可能在beforeDigest下把本可自动aborted的请求永久阻塞。

修复方向：观察未知的I/O失败保持prepared/pending与STRUCTURE_RECOVERY_PENDING，不编造third摘要/外部冲突，不写terminal conflicted audit；允许下一fresh read/recovery重新读取。只有已真实读到其他digest或诊断invalid bytes才进入third/conflict。测试一次read失败后after与before分别恢复，assert第一轮pending、无“第三digest”声称/假审计，第二轮普通恢复自动finalize/abort一次，history与legacy符合原恢复合同。现有第三digest测试384–411确实观察C，不能替代未知I/O测试。

## M1 — slash-only绝对folder路径在剥尾斜线后被当作相对根

`packages/core/src/structure.ts:49–69`先replace反斜线并删除所有尾slash，再检查startsWith('/')。输入folder.path为 `/`、`///` 或反斜线-only时变为空串，绕过absolute检查，被投影为root，编辑后序列化`.`。core测试66–96覆盖`/src`，不覆盖slash-only。

建议在剥尾slash前检查absolute/UNC开头，root继续使用`.`/明确内部空prefix；加slash-only schema与patch拒绝测试。目标文件adapter固定路径，故这不是任意源码路径写入漏洞，但违反v1“拒绝绝对路径”的格式合同。

## 已核对的可靠部分及验证边界

- JSON custom parser检测解码后的重复key/null-prototype对象、有限数字；schema可选字段省略与root/folder/rule/extension未知值保留。patch不突变原doc，policy extension owned字段合并，folder不误装prose/import规则。
- file adapter读真实bytes SHA256、UTF8/1MiB stable invalid摘要；temp write/sync/close→重检→rename，没有delete目标；phase明确，发布后错误不会标not_published；原权限保留。真实外部重检→rename TOCTOU限制与未跑Windows/macOS如实保留。
- prepared intent在I/O前通过同步SQLite事务持久化；finalize/deleteMigrated/state/plan失效/audit/terminal intent同一同步事务，没有await。migration按捕获清单检查所有者与canonical旧值，仅删对应id；finalize失败事务回滚保留旧策略与plan。
- sameversion合作写者queue覆盖get/update/withProject；prepared与published barrier测试412–462确实先assert审批尚未settled，再release并assert旧revision拒绝。它证明模块scope能力，不证明未接线Workspace批准已正确。
- before/after/real-third恢复方向、external接受保留文件、invalid lastGood只读、一次plan失效和immutable approvals方向正确；I1/I2是这些边界中的未覆盖具体故障。
- terminal audit区分A/B候选/C真实观察与known未知、无全文外泄；public出口patch保留KN01 annotations，未把他票出口归因POL。

测试证据：读取 `receipts/modules-freeze.txt`：2026-10-10 16:26:20开始，3文件48PASS（core17/file11/sync20）；测试源码与该计数相符。冻结报告记录隔离noEmit和8文件lint exit0；本次不运行任何测试/build/lint，没有用历史PASS宣称本审查发现的问题通过。上述两个直接retry与unknown-observation路径不在48项中。

后续仍pending：模块定向修复及独立复审、shared装配、新鲜HTTP/MCP元数据、startup-before-listen、实际Workspace approve/verify/readApproved互斥、UI/browser A7、原生OS adapter、main集成gates。未改产品/shared/globaldocs/remote文件，未build/重跑测试/碰dist/spawn/付费模型/commit/push/deploy/merge/权限/keys/sessions。原冻结失败结论与复核现场保留。
