# KN-01 第四 backend/HTTP 窗口独立源码审查

2026-10-10 UTC。Reviewer `/root/ci_repair`，明确沿用 `gpt-6.1-sol high`，独立于实现者。

结论：**APPROVE，Critical 0 / Important 0 / Minor 0**，限定本窗口三个冻结文件。新 Workspace/HTTP 接线及 snapshot reconciliation 的事务、队列、身份、批准保护合同在此范围通过静态独立审查；不是完整 compiled/browser 门禁，也不标 KN-01 DONE。

## 精确范围与 SHA 前后

VM2 `/home/agent/projects/AtlasMode`：

| 本次源码 | 读前 SHA256 | 读后 |
| --- | --- | --- |
| `packages/service/src/workspace.ts` | `b3a9f0da90de2b99fc9bdab3c086a3eab08c27081f3b2260b1aed7afd702cc3b` | 相同 |
| `apps/server/src/routes.ts` | `3d02ef217ca51eb9a4b0072a8e24ff89ff70a1337e856af45c916f62266f19a1` | 相同 |
| `tests/integration/annotation-workspace-http.test.ts` | `18473e689f7bbef8730c358698a7a5cbf0f9e043ecfd2335427c85bae19429af` | 相同 |

`.superpowers/sdd/2026-10-10-kn01/freeze-http-window.sha256`：`1822e6eedb3327832e6aa4f2bea9e522e51039a7e309016415ccedea27c29d46`；读前与读后 `sha256sum -c` 三项全部 OK。三个 `http-window-source-freeze/` raw copies 实际 SHA 匹配且与读取的源码逐字节相等。

基线使用 `http-window-baseline/` 的 accepted POL R1 exact bytes，不混 Git HEAD 的其它授权工作。Baseline manifest SHA `961cf0d31ad2791fa140b8fa904d5185c4254b81816b3fef06cb6eb108698e6a`，五份原文逐一实际匹配；Workspace 原值 `470630d2...`、routes 原值 `a9a757bf...` 与原 POL R1 reviewed bytes一致。增量 `workspace-http-window.patch` SHA `8ec62f1d2af74a8b7af20fcf97c119ea8954b55293beadbae231bb300cfa1ac5`、`routes-http-window.patch` SHA `aa1244f499b65b96a3d1e7d722c24ef52155e2a696f551393b64f083d0a63ac9`；作者 receipt SHA `2b8477e02a8f4f30c3d594221f03d2fed4685e86fb17b72aa4368bd08aa0e94e`。

没有审查或写入尚在后续修改的 Web/FS 窗口。本报告只对冻结 backend 有效。

## Notes facade、actor/source 与同队列身份保护

Workspace 构造一个 `Annotations(storage,getProject,getSnapshot)`，并把这个实例注入同一个 `AnnotationReviewService`/Planning，而非为批准或 HTTP 分别创建脱离当前存储/快照的内容副本。原 mandatory StructureFilePort、StructureSync callbacks、legacy identity lane/owner checks保持。

七个新异步 facade 的 list/get/create/update/bind/delete/history 均经 `StructureSync.withProject(projectId, ...)` 的既有项目队列。这与 open/refresh/planning/policy publication是同一边界；操作执行时才交给原 Notes严格schema/CAS/ownership检查。Binding 当前 SID、目标 kind+domain ID及项目所有权来自 stored authoritative snapshot；不读取可视节点 alias、不猜 replacement或隐式刷新后改变 selection。

Notes callback不强制 `readStructure`，因此普通文字/history在无 snapshot或结构文件无效时仍独立可用；绑定则确实需要可用 captured SID。Pending 项目工作实际执行时仍要等同队列先行 work完成，不能绕开正在 refresh/publish 的队列。新测试用真实 HTTP 到 facade arrival barrier：refresh被 index gate持住时绑定还未完成且 raw DB不变；放行 refresh后原 SID binding得到409，note不发生第二次写入。

Author/actor是显示作者字段，source是创建来源；更新的 strict schema不接受 source或binding。Binding endpoint不接受 text，delete只接受正 safe expectedRevision。History保留已删除记录且跨项目不能读写；新创建的 revision/time/UUID由既有服务生成，客户端不能注入 stored revision。

## storeSnapshot 与 reconcile 原子性

`storeSnapshot` 原有 snapshotSchema/project validation、immutable SID collision check保持。外层 synchronous storage.transaction写入新 snapshot（如果尚不存在）及 project pointer后，把 **实际已发布的 existing ?? parsed.data** 交给 `annotations.reconcile`，仍在同一外层 transaction中。Reuse immutable SID时不会用未发布 replacement nodes把 Notes误 orphan。

现役 reconcile调用也是 synchronous transaction；SQLite的嵌套事务仍在外层事务范围内，不存在 await或先提交 snapshot再协调 Notes的边界。每个 justified orphan 写入新 Annotation revision及不可变history，所有 changed notes之后只调用一次 project plan invalidator，Workspace没有额外 invalidate。任一步异常向外传播，使 snapshot/pointer/Annotation/history/plan共同 rollback。

必要 core resolve/reconcile依赖仍严格处理 complete capture与diagnostics；partial/unavailable/parser uncertainty只返回unknown，不把缺失数组当absence事实。已经 orphan的 binding先返回 orphan，因此同domain ID重现不自动 rebind。实际 tests覆盖两条 note源码消失→每条revision+1、plan恰好+1，源码ID返现后仍orphan且plan不再加1，显式 rebind保留text/history，以及partial capture不写 orphan/history或失效。

Snapshot、project pointer、Annotation、history、plan五个真实 SQL write points各在 before/after故障下注入异常。Tests通过 real SQLite raw `rowid,kind,id,value` 全记录比较和旧 snapshot pointer比较，证明整个刷新协调回滚；清除故障后同一真实删除重新刷新成功、plan只增加一次。此证据直接覆盖新外层事务接线，而非只运行纯 helper断言。

## 严格真实 HTTP 与既有批准/POL/FS保护

Collection、record、history、binding与delete真实 routes接相应 facade，复用core create/update/bind/ID/revision schemas。分页query把字符串校验为安全整数，limit≤100、default20交给原 Notes分页schema；未知字段/状态/unsafe offset与route query均拒绝。记录错误映射沿用未改 server：SID/revision409、非法target400、wrong-project/missing404、unexpected500。没有为超长路径改全局Fastify限制；实际已有transport先给414，短control参数400仍由真实测试证明。

Same-instance Review/current-v1接线由真实审批后note edit、historical JSON export、raw SQL修改 Notes（不改revision）以及篡改 immutable captured context测试验证：current approval不可继续有效；历史annotationContext/approval/legacyregistry原raw rows保持；tampered context获 APPROVAL_CONTEXT_INVALID409，没有legacy fallback。Snapshot与binding的domain/owner负例均要求失败后raw rows不变。

独立以只读方法提取比较原POL R1与当前Workspace的 **39个既有方法**（除授权storeSnapshot）逐字节相同，并逐一核对作者方法摘要；没有执行作者会写receipt的 `http-methods.mjs`。因此FS updatePlan、fresh export、current-v1/verification、POL queue/identity lane/owner及views/groups/其它方法没有窄窗口漂移。`http-existing-workspace-methods.sha256` SHA `6c59eb5b9ebe8068949bfddf8a75d0dad0ee5616b19e60707545c0b859251172`。

Planning全文件仍 `89fdba1f61a4ba2ba9917133f99974ea7fb42a89b20bfff69975a12cd5fbc86f`，StructureSync仍 `467dd4fa8ada8da7b9ed88db6bee510dc07a6f8d28d985f6785278a278e304cc`，server仍 `5b1132a2fda456a079fd629076cf3a50e2d040c988603ec1e5c96b34b595d4ec`，实际等于baseline。ReviewService `8a3b350e11763d06561ee6e5333dee80b91c3ccaa327bb02e3756ad093a4543b`、Annotations `ec89d918aef2501bf1e2ba076ffac9ccac15d2dc09c0f5d8843df519e551f581`不变。十个纯 UI freeze paths哈希两次全部OK，manifest `d1efc480a1dd7350769beedcc8a3f198c797d15cbaf58fc1f078bcdd2b8e806e`；不借此重审UI或称其已mounted。

## 保存的实际验收证据与局限

作者保存的source-alias config实际解析当前 core/storage/service/indexer公共源码，真实HTTP test启动owned loopback listener并用 fetch；并非 app.inject或旧dist模拟成功。SQLite/StructureFileStore/SourceIndexer是实际实现；清理顺序先关闭app/SQL连接再移除自身mkdtemp root，没有他人进程/用户DB操作。

实际读取的历史 logs：初次 **23/23 FAIL**（routes不存在404）→同案例首次 **23/23 PASS**；扩展 **24 PASS/2 FAIL** 的existing response/list假设错误、再回归 **131 PASS/1 FAIL** 的Fastify414预期错误及noEmit test compiler失败原文仍保留。负例修订与既有schema/transport合同一致，没有放宽产品校验或删除关键断言。

最终 `http-window-regression-final.log` SHA `edf9fbdab74e7404206fb331b00e674b5be5cf6b8ae7cd8408f630b3dff8a46b`，实际 **134 tests / 7 files PASS，15.77s**：新HTTP28、Notes10、approval36、Workspace7、StructureSync29、POL HTTP12、POL R1repair12。Final scoped lint/noEmit保存无错误输出，exit0由作者receipt报告；本 reviewer没有重跑命令。原RED log SHA `893e2fe6842b7ea4eca5ec2313a26b509fc00a236d9aec1c6079a02354e1c11c`保持。

Fresh Workspace+新HTTP listener reopen测试使用原持久SQLite连接；receipt明确未声称进程/SQLite连接重启。真实compiled产物、新Web/API/i18n装配、UI history zero-total M1修复、完整mounted浏览器和actual process restart仍须各自授权、冻结及验收。保存source测试PASS不能替代这些门，也不继承其它票compiled/CI结果为KN01完成。

本轮未改产品/目标docs、未运行test/build/lint/noemit、未打开DB、未stage/commit/spawn；仅必要只读审查与本报告写入。可接受由主控安排下一受控窗口；KN-01仍PARTIAL，不能DONE。
