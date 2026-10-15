# POL-01 SERVICE/HTTP R1 原 I1/I2 定向源码复审

日期：2026-10-10 UTC。Reviewer：`/root/ci_repair`，沿用明确指定 `gpt-6.1-sol high`；独立于实现者。

结论：**APPROVE，Critical 0 / Important 0 / Minor 0**。仅针对原 SERVICE/HTTP 审查的两项问题及授权六文件 R1 增量；原 I1/I2 已在实际源码中解决。本结论不将未接线的 UI/MCP 或整票 POL-01 标为 DONE。

## 精确范围与读前/读后冻结

Repository：VM2 `/home/agent/projects/AtlasMode`。修复证据目录：`docs/reviews/pol01/http-window-repair-r1/`。读取 actual six-file delta、精确 `repair.patch`、必要 queue/export/ownership/recovery callers；原已通过的内核设计及实现不重复全文重审。

| 冻结 artifact | 读前 SHA256 | 读后 |
| --- | --- | --- |
| `repair-handoff.md` | `2c639fbccd30598ac4a296e9afc62d7b0d68de61a8081ee12b38ac6eb101f456` | 相同 |
| `freeze.sha256`，20 paths | `cab49d7709a3e3de3ce1c06fab6c00464cb7282cc98614ed551ebe19d02366e8` | 相同；20/20 OK |
| `repair.patch` | `aaeb68b6025ac78b399c247a4e211f466804c9c60e17b3f67cc9ba87f58051e6` | 相同 |
| `changed.sha256`，6 paths | `1b65cc3eff4468fb91e3ce69460373851e90dfcd400028c22598ffd32f2caacb` | 相同；6/6 OK |
| `dependencies.sha256`，13 paths | `6294bccdd7ff3f11507f39b6f892777821e6d91a232649d5c1fff2ae11d85517` | 相同；13/13 OK |
| `artifacts.sha256`，116 entries | `2e57e4e363f7bb15cb7c988fafe7fe9be9fdb031d8f37478ac203434fefaca9a` | 相同；116/116 OK |
| `public-exports.sha256`，3 paths | `dc09b3320840fa37b1c99c4f1528a083b11704c5e7f09c2f597599574e98a1e0` | 相同；3/3 OK |

六个 actual changed source SHA 在 `changed.sha256` 中逐一核验，读前后相同：

- `packages/service/src/workspace.ts`：`470630d29a7b040e133cb6effa169caa90184239b51f53ccb9a3b7365de052c0`。
- `apps/server/src/routes.ts`：`a9a757bf6250b12aac6c7c02775023d62a43edf1599a932023d325da26fd5c3b`。
- `apps/server/src/pol01-workspace-http.test.ts`：`bcb974862bbc6f72ca8f9b0ed8accb7225a24bd41719ec695e19279e8ff44bce`。
- `tests/support/pol01-crash.ts`：`c3bddb3a439d7f057e73cdd4acbff991bf90df9e5ce3e30ad459f689648a1cd3`。
- `apps/server/src/pol01-http-repair.test.ts`：`9dcbab7689aca7f4c58a6f389fb2a53d4ee8f4b1e7dba7f861cb49be81eeb41c`。
- `packages/service/src/structure-sync.ts`：`467dd4fa8ada8da7b9ed88db6bee510dc07a6f8d28d985f6785278a278e304cc`。

原审查完整 REQUEST_CHANGES C0/I2/M0，SHA `84b6c1ce9514a4c6f2bb57abf24d41501134f167b34db7f55cc2ad4f2da8f2e5`，在 `before/http-window-independent-review.md` 及本机原报告均实际核得原 SHA；未覆盖或将历史失败改写成通过。

## I1：HTTP export 实际新鲜度——关闭

`routes.ts:293–305` 的实际 JSON/Markdown handler 现在 await `exportPlanFresh`。`workspace.ts:363–366` 从实际 plan 取项目 ID，再进入原 `withStructure`；该边界持有相同 project queue、读取并协调真实磁盘结构、检查文档所有权，之后才同步调用原 Planning.export。不是先计算 cached export 再等待检查。

因此 external semantic edit 后的第一个 export 会先使当前 plan/approval 失效；JSON 的 valid/revision 和 Markdown Current valid 均来自新状态。历史 approvedPlan/approval/context 仍经原已冻结 Planning/KN guard 读取，不被新鲜度协调重写。无效结构拒绝 export；删除结构产生非 current 状态；prepared/published mutation 阻塞同项目 export，等事务完成后再判断，不从 pending publication 期间读取缓存 current=true。

实际回归测试覆盖 JSON/Markdown 都作为磁盘编辑后的第一操作、revision 只前进一次、原审批/approved settings 保持相等、invalid 422、deleted non-current、prepared/published barrier 等待，以及现有 finalize-failure export 503。旧同步 export 保留兼容；本结论只保证已接入 fresh boundary 的 HTTP 路径，不能借此声称尚未接线 MCP 已满足合同。

## I2：跨项目 legacy ID claim 的执行期保护——关闭

`structure-sync.ts:451–455` 在实际 project queue 执行时调用窄 `identityMutation` hook；`workspace.ts:222–245` 的 per-Workspace Promise lane 覆盖 legacy upsert/import 从执行期 owner check、实际 read/CAS、prepare、publish 到 finalize 的整个 await work。读取和 upsertFolder 不取得该 lane，避免把独立读与 folder 编辑全局串行。两项最初均无 DB/state/pending claim 的并发请求也不能共同通过执行检查：后一请求等前一 work 完成后重新检查。

实际 `checkPolicyOwner` 除 DB 与其它 project 的 accepted/lastGood state，还扫描其它项目 durable pending intents 的 candidate legacy IDs。无法 parse 的 pending candidate 明确 recovery_pending，不以未知数据当无主。`validateOwnership` 在 durable saveIntent/publication 前再校验整个 candidate，并在恢复 finalize 前再次校验；原同步 prepare transaction 与最终 transaction 没有被重写。

这是 prepublication protection，不依赖发布 loser 后再删除/回滚其文件。已保存 pending intent 在 lane 因 unknown I/O 释放后仍保护候选 ID；conflicted/unknown 不释放 claim。实际 observe-before recovery 的原子 aborted receipt 才令 pending=false，可允许另一个项目随后取得 ID；observe-after finalize 令 committed state 继续持有 ID。恢复不需另建 claim namespace/table，候选由既有 durable intent 保持；同步 ownership check 与本地 DB finalize 之间没有 async yield。

回归测试包含：B 在自己的 refresh queue 后等待，A 先提交同 ID；prepared 同 ID loser publisher=0；两个初始 unowned 请求在 A 首次 read 被 barrier 持住且尚无 intent 时，B 不 read、不 publish并等待执行 lane，A完成后 B拒绝；owned SIGKILL/restart before/after/unknown 三场景。loser file bytes、plan revision、approval history、committed audit不变。unknown 直到可读恢复仍拒绝 B；before abort 后 B可成功；after恢复后 A ownership保留且 B拒绝。

保护范围沿用单 WorkspaceService / 单服务拥有 DB 的合同。没有宣称跨进程 distributed lock 或外部 editor 与 SQLite/file 的原子发布；既有 file CAS/check-to-rename 限制保持。文件+DB的 crash recovery边界诚实，原已通过内核不被本R1扩成跨票恢复平台。

## 保存证据与相称边界

实际只读检查作者保存的原 RED：同六个初始真实 HTTP/SQLite/file cases **6 failed / 6**，包括 cached valid=true、非法结构 export 200、queued/prepared same-ID loser错误200。`green1.txt` 为同六项 **6/6 PASS**；后加恢复证据 `green-claims.txt` **11/11 PASS**，未伪称全部新 tests 都具有初次 RED。

最终 `green-final.txt` 实际记录 **106 tests / 6 files PASS，16.07s**：Workspace7、Server15、Lifecycle31、旧POL HTTP12、新repair HTTP12、StructureSync29。source-alias config 实际指向 VM2 core/service/storage/indexer/server source入口，不是旧 dist冒充新 runtime。scoped types/lint 的已保存无错误输出、exit0结论由handoff记录；本 reviewer 没有重新执行这些命令，也没有运行 root gates。

独立以只读 Python 按方法边界对 `before/source` 和当前 source 逐字节比较：Planning.update 与 Workspace.updatePlan 实际 equal=true，方法 SHA 分别仍是 `f4b11da3a6354f7646e656ef49ce4110c148ee4873d7a7e942f5311ce47b0613` 和 `39dbfb5232894947f53cd8549f48700dfd12f67f6e7e071fecc68e6a6b59f794`。KN Planning、ReviewService、annotations/schema/storage等十三个非hook依赖以及原 public exports 全部 frozen hash OK。

`runtime-verification.json` SHA `a0f9341b472cb47d7fd8baaefc67acc7954de0329e49df5c78ddb1c806aa61a8` 与 raw final log对应：9 owned children（8 SIGKILL故障子进程、1 source entrypoint正常exit0）均保存 absent-ESRCH probe，2 workers亦 ESRCH；唯一真实 listener 38847 保存 closed-ECONNREFUSED；24 fixture closures/24 sealed roots保存 app/SQLite关闭与文件 SHA。所有116 artifact hashes实际 OK。这里审核保存的 runtime proof，没有重新 probe PID/port，没有触及其它进程或真实用户 DB。

本轮只有必要源码/日志/manifest读取与本独立报告写入；没有产品或目标docs编辑、测试、build、DB打开、staging、commit、spawn。UI 的旧428/preview/CAS/reload、MCP fresh boundary、后续 compiled production与所需原生平台验收仍须分别授权及真实证明。可继续由主控安排下一有限窗口；不得以本修复 APPROVE 或106个source测试宣布全票完成。
