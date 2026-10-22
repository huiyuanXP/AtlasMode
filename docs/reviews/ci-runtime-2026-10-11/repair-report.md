# POL01 CI runtime repair — DONE_WITH_CONCERNS

2026-10-11 UTC。仅本轮CI夹具修复；当前任务结束，等待独审/备份/服务器重启，不启动其它任务。

## 固定环境与边界

- repo/worktree: `/home/agent/projects/AtlasMode-checkpoints/2026-10-11-ci-runtime/workspace`；branch `fix/pol01-ci-runtime-20261011`；BASE/HEAD `ed793266b9dcac5cfa65f1a5358ec97d5184a69f`。
- VM2 Linux，Node24.19.0/npm11.9.0。私有干净npmci397packages；workspace node_modules/dist仅该隔离checkout所有，cache只读复用；无shared dist。global `/tmp/atlasmode-pol01-runtime-tsconfig.json`不存在，未删除/创建全局配置。
- 输入 `/home/agent/projects/AtlasMode-checkpoints/2026-10-11-ci-runtime/repair-brief.md` SHA `e0d6bbc4d93dea91d34f12ea1c9239399ab6555e4939f6a41dc040e7fbac0aeb`；AGENTS及using-superpowers/codex-tools、systematic-debugging/TDD+writing-good-tests/verification读过，Task3始终暂停。显式指令限定targeted验证，未重复1374unit/53browser。
- 仅下列7owned source，production storage/service/index/guard/CAS/timeout、workflowcompiled env、acceptedPython55 helper未动。未stage/commit/push/spawn。

## 具体修复

POL启动选择compiled原生Node24 typestrip运行test-only crashTS，@包实际解析dist；source模式写fixtureowned绝对config，不fallbacksource。两个POL测试验证crashcheckpoint pid/phase/productMode并仍严格 `[null,SIGKILL]` + 空stderr；close后PID不存在。checkpoint只加在原durable publishhook、afterpublish/third externalC之后、原selfhardkill之前，无更改业务或crash顺序。实际entrypoint按mode选dist/src、main仍先recover再listen。

正常APIstop复用**现有**graceful-preload.mjs+IPC，调用已经安装的真实生产SIGTERMhandler；这是受控产品处理函数调用，不是Windows OSsignal。严格exit0/null、close含stdio、PIDabsent、portclosed、freshSqliteStorage reopen/close。workspace freshDB核实planrevision2与approvalhistory1；SDK保原actualrestart/approval/quarantine/immutablehistory断言，记录freshDB计划/审批行数。10s hardkillfallback仍失败而非gracefulPASS。

annotation原37保留并增加3真实控制。unsupported refusal保存原main/WAL/SHM/journal SHA/size/existence+dev/ino/mtimeNs/ctimeNs/mode；只在目标构造前捕获better-sqlite3 openslice并断言originalpath绝不打开；同期观测node:fs同步变更API原路径（覆盖sqlite.ts实际变更imports及额外sync变更入口，合法probe副本不误报）。原fswatch事件完整记录为diagnostic，不宣称25ms空事件证明无瞬时写。测试唯一产品路径是同步fs与SQLiteconstructor；未来改为别种I/O需扩充观测器。

负例先实际RED2：真实sidecar write→restorebytes、remove→recreatebytes时旧recorder为空；实现后这两个控制保持最终bytes相同、仍抓到原路径操作。第三readonly originalSQLite控制显示rawfingerprint不变仍记录原DBopen。所有操作都真实发生在自己syntheticroot，未注入产品行为。native每case start/cleanup-complete阶段收据明确testname/PID/platform，有助下一Windowsrun定位，但**不能证明原worker异常已解决**。

structure权限改为chmod后、publish前实际statmode独立基线，发布后精确保持；POSIX额外原mode640断言保留。30reader只见completeold/new JSON、digest/no-original-unlink/rename barrier均保留。Win writable/readonly实际负例尚需原生runner。

## 精确归属与SHA

`owned-manifest.json`含每文件用途/before-afterSHA；`diff.patch`为单个完整patch（包括新增helper），SHA `d6ce29cc007556a3ea175e883d0b6ca01f4415431f0815b35b32ab0618114e53`。after manifest SHA `4965f91a60a90392a706fa5c1fc18bc3b4b1a94635344ee4a55a1548fdec9af5`。

| Owned path | Before SHA256 | After SHA256 |
| --- | --- | --- |
| `apps/server/src/pol01-workspace-http.test.ts` | `bcb974862bbc6f72ca8f9b0ed8accb7225a24bd41719ec695e19279e8ff44bce` | `cd01e5abe01dad82c515c93437da3c333fc1e5808b6c80a32536186eb4df903b` |
| `apps/server/src/pol01-http-repair.test.ts` | `9dcbab7689aca7f4c58a6f389fb2a53d4ee8f4b1e7dba7f861cb49be81eeb41c` | `8febd1c039dc71ed6a3e239c5459d62caa8035a9eb47c8b0e95a7b25befd0cf8` |
| `packages/storage/src/annotation-migration.test.ts` | `e6572599d5ab22602a5faa3da888f62c2ba901ccb09f691c69f5700b1635e63e` | `2dbb09c3f3ed831d0143fbb074bfced985bfad65fcd684f2d8d67f0b3f8a15eb` |
| `packages/storage/src/structure-file.test.ts` | `cb40238c98e285d661426e2cfd209e51c22d02fec53f14294a3f0762d5ae5fe4` | `88d70c77494ff3ed93cd0488c803002482c74c79e0a785965eca9d1d56c313ab` |
| `tests/support/pol01-acceptance.ts` | `f5506eaa40d2bf29725b7506417504b74777975ae865325f3ff7790fd5116b0f` | `5cbc236454511f04daed15e1cc0ea756eb9d15f43daf10ca2b957184ccfe1086` |
| `tests/support/pol01-crash.ts` | `c3bddb3a439d7f057e73cdd4acbff991bf90df9e5ce3e30ad459f689648a1cd3` | `664790639f45858c55875b054ef26b82e8b03451b1666f6cee42667031de5456` |
| `tests/support/pol01-runtime.ts` | `NEW` | `7f271a951f685a6ac0a2903ee8dff712e9cea214887609eb47ca1566417b65c6` |

## 原始命令与结果

`evidence/commands.json`给实际命令/exit/原log；以下log均持久保留，不覆写旧失败。POL RED UTC03:41:43→03:41:50；最终冻结组合UTC03:46:16→03:46:30。

| Raw log | Exit | 结论 |
| --- | --- | --- |
| `npm-ci.log` | 0 | 397 packages, private clean install |
| `build-before.log` | 0 | all private workspace outputs; Vite chunk-size warning retained |
| `pol-red.log` | 1 | original 8FAIL/16PASS of24,5.77s; missing globalconfig directly confirmed |
| `pol-green-first.log` | 0 | 27PASS,11.47s |
| `observer-red.log` | 1 | 2FAIL/37filtered: mutation recorder empty after real restored-byte writes/removal |
| `storage-green-first.log` | 1 | 50PASS/1FAIL: new readonly negative had incorrect literal count10; legacy fixture contains9; corrected count, original37+structure11 passed |
| `typecheck.log` | 0 | root workspace types/build pass; excludes test files |
| `lint.log` | 0 | first root lint pass |
| `fixture-types.log` | 2 | new IPC spawn nullable stdio + two existing mock typing issues; corrected only owned files |
| `targeted-final.log` | 0 | 78PASS/0skip/0workererrors,15.73s before final URL/type/phase-receipt edits |
| `source-compat.log` | 0 | 1PASS/11filtered,3.41s; source compatibility only, not compiled evidence |
| `fixture-types-final.log` | 0 | all seven owned fixture sources and transitive imports typed |
| `targeted-frozen.log` | 0 | FINAL78PASS/0skip/0workererrors,13.83s:24POL+40annotation(37+3controls)+11structure+3SDK |
| `lint-final.log` | 0 | final root lint pass |
| `tool transcript` | 0 | read-only diff whitespace check; original output in tool transcript |

首次storage新增控制误写count10，实legacy9，纠正并保留原FAIL；首次fixturetypes暴露两个原mock类型问题和新IPC nullablepipe类型，限定owned修正后0。它们不被包装成产品RED。build原Vitechunksizewarning保留。最终78包含全部新增观测控制，无filter/skip、无unhandledworkererror（仅Linux）。

`evidence/compiled-resolution.json`保存实际crashchild import.meta.resolve URLs，compiled全部service/storage/indexer `/dist/`，另source单case记录src且独立标source。`evidence/runtime/`保存crashcheckpoint/runtime-receipt/config，`runtime-receipts.json`汇总完整原stdout收据。

## 已释放资源与持久freeze

`evidence/resource-receipt.json`登记 46 个自有childPID，全部不存在；18 个自有端口全部关闭；106 个日志登记syntheticroot先保存SHA/filelist/关键runtime后删除。annotation自己roots/SQLite句柄在afterEach关闭/清理。activeOwnedServices=[]。从未kill他人进程或删除非登记根；没有长驻服务、挂起测试、mutation窗口。

全部证据/来源beforecopies/aftercandidate/单patch都在持久 `/home/agent/projects/AtlasMode-checkpoints/2026-10-11-ci-runtime`；`freeze/source/`精确7candidate，`freeze/evidence/`冻结原日志及runtime；`freeze.sha256`逐文件校验。不依赖/tmp可恢复；private node_modules与dist可重装/重建，未纳入sourcecandidate。

## 仍缺证据，下一最小步骤

1. root对单patch+manifest独立窄审，source-onlyAPP也不能代表Win/macPASS；精确备份/commit授权由root执行。之后停并重启服务器。
2. 新SHA真实Ubuntu/macOS/Windows CI必须保compiledenv。macOS原stale-SHM延迟事件因果未被Linux证明；新observer是否在真实mac抓到原写/排除setupevent需runner收据。Windows实际mode保持/有效mode负例、真实IPCgraceful与freshDB/drain、strict hardkilltuple全UNRUN。
3. Windows原worker异常未归因：annotation37缺summary仅候选。下一真实Windowsrun按新增case阶段原stdout/PID/workerexit定位；若仍异常，申请精确有限诊断，不扩产品源码、不推断瞬时原文件修改。1374→1372差2为dev/index平台signalcase条件，不能算worker丢2。
4. 原run38108513324 Ubuntu8/mac9/Win12+unhandledFAIL完整保留于pre-restart/resumed-backup/ci；原browser53PASS与Python55WinPASS未重跑/未修改。不改票DONE，不声称全部CI已绿，未开启后续票/线程。
