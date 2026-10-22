# POL01 CI runtime repair — read-only brief

2026-10-11 UTC。结论：新远端CI的POL01八项失败在预期crash前就以code1退出；workspace stderr证明TSX找不到硬编码的 `/tmp/atlasmode-pol01-runtime-tsconfig.json`。两个测试文件忽略compiled门禁，仍无条件启动source。macOS另外有stale-SHM watcher一项失败，必须独立保留/定因，不能把全部九项都归为TSX配置问题。

本席只读源码/日志、计算SHA和查官方平台合同；没有修改VM/source/workflow/Git，没有test/build/service/spawn。Task3 writer窗口不重叠；主控后续通知其已安全暂停（仅初始测试/占位、setup failure非RED），本席仍未变成writer。此前accepted Python两fixture和workflow compiled env保持。本文不改票DONE，不替代后续实现、独审、cleanrunner与三OS真实CI。

## 输入与原失败

提交 `ed793266b9dcac5cfa65f1a5358ec97d5184a69f`；CI run38108513324。

| Job | 原日志结论 |
| --- | --- |
| Ubuntu 114379013700 | 1366PASS/8FAIL，112files（110PASS/2FAIL），code1；76.09s。 |
| macOS 114379013702 | 1365PASS/9FAIL，112files（109PASS/3FAIL），89.80s；同POL8+storage stale-SHM1。 |
| Browser | 主控收据：53passed/2.4m；本席未下载重审browserlog。 |
| Windows 114379013626 | 主控最后状态inprogress；本席不推断成功/失败。 |

只读publisher `/home/agent/projects/AtlasMode-checkpoints/2026-10-11-pre-restart/publisher`。原日志保留于同checkpoint `resumed-backup/ci/ubuntu.log`（144068bytes，SHA `b426f8b5551555770acf3e673fe1237dc9786cdbf4514490e84b5f463290c489`）及 `macos.log`（SHA `ddb8603ea206d9794951de990ca41a1472b1410be938adae11fc52fc0a698c77`）。macOS通过 `gh api …/actions/jobs/114379013702/logs --allow-escape-sequences`只读取得，本机临时原文 `/tmp/pol01-ci-macos-114379013702.log` 与主控VM保存SHA一致；首次gh为escape保护拒绝输出，重取后成功，没有改远端内容。

### 精确源 SHA256

| 路径 | SHA256 |
| --- | --- |
| apps/server/src/pol01-workspace-http.test.ts | bcb974862bbc6f72ca8f9b0ed8accb7225a24bd41719ec695e19279e8ff44bce |
| apps/server/src/pol01-http-repair.test.ts | 9dcbab7689aca7f4c58a6f389fb2a53d4ee8f4b1e7dba7f861cb49be81eeb41c |
| tests/support/pol01-crash.ts | c3bddb3a439d7f057e73cdd4acbff991bf90df9e5ce3e30ad459f689648a1cd3 |
| tests/support/pol01-acceptance.ts | f5506eaa40d2bf29725b7506417504b74777975ae865325f3ff7790fd5116b0f |
| tests/integration/pol01-stdio-acceptance.test.ts | 3ca4281f80bcbeddcf842c054b3c87748861886918a7ad79dc0050d0a97d42f6 |
| apps/server/src/index.ts | 7599bc60f8ff0226c754de975c24fa5a5df584a749cf38d46336c23c399768be |
| .github/workflows/ci.yml | b34caf035c70ed25130db6ed2a3f2e53db9379c949198c1fb3d038f160a5ecbe |
| tsconfig.base.json | dbf717da949b21cf3c485fee0b653f8c0ec3e6e01957fee8285325da3a1e83a5 |
| vitest.config.ts | 68672616694d87ad05393ab353deff075fb307caad5220e661559046d1a1b96f |
| packages/storage/src/annotation-migration.test.ts | e6572599d5ab22602a5faa3da888f62c2ba901ccb09f691c69f5700b1635e63e |
| packages/storage/src/sqlite.ts | 3aef48bfd53d62cfe93fe576d7d46b7bb9e4c84ce5a95d30ce6cc399284f44db |
| tests/support/production.mjs | 4a2228e53a47c0f1731faa89c1ffdea7f4241b6916cb525202d2a62fe084af42 |
| tests/support/graceful-preload.mjs | ccbb8796228e382b27644d04b6d91aa15d3b361726ea188244be5f36d165e247 |

## 八项准确归属与触发顺序

`pol01-workspace-http.test.ts`（12total，5FAIL）：

1. `owned process crash before recovers before HTTP availability without touching user files`
2. 同名phase after。
3. 同名phase third。
4. 同名phase unknown（crash实际用after，再由恢复读端注入unknown I/O）。
5. `actual source entrypoint recovers published intent before it listens`。

`pol01-http-repair.test.ts`（12total，3FAIL）：`I2 durable before/after/unknown crash claim prevents losing publication and recovery releases only proved-before claims`。

Ubuntu/mac七phase都得到 `[1,null]`（workspace含stderr对象），预期 `[null,"SIGKILL"]`。第五个workspace case也在:599前置crash child断言失败，**尚未执行后续server startup/recovery断言**，因此不是已证明的SDKfixture故障。真正SDK fixture `tests/integration/pol01-stdio-acceptance.test.ts` 3/3在Ubuntu与macOS皆实际PASS（含SDK stdio→HTTP→SQLite/restart）。其未来Windows强制SIGTERM合同仍须审查，不能据两POSIX PASS推广Windows。

workspace原diff直接含 `Error: Cannot resolve tsconfig at path: /tmp/atlasmode-pol01-runtime-tsconfig.json` 与tsx加载堆栈；失败发生于support脚本任何业务逻辑前。repair及entrypoint前置assert先检查exit，stderr断言尚未达到；同启动args/env导致同机制失败是源码支持的归因，日志没有独立展示每一子进程的完整stderr，须准确区分。

## 全部相关 subprocess / hardcoded tmp / kill合同

| 调用 | 当前行为/问题 |
| --- | --- |
| workspace :371–390，each4 | `node --import tsx tests/support/pol01-crash.ts`，cwd=process.cwd；:386硬编码全局tmp配置；无compiled选择。 |
| repair :429–449，each3 | 同source support，带policyId；:445相同全局tmp配置；无compiled选择。 |
| workspace :580–599，第5case前置 | env :580同全局tmp；再次spawn crash support；code/signalassert失败阻止后续启动。 |
| workspace :625–638，第5case后段 | `node --import tsx apps/server/src/index.ts`，继承同env；不读compiled模式。子CODEMAP_DATA_DIR=f.root使DB路径匹配atlasmode.sqlite；random reserved loopback port，源码main在listen前recoverStructureWrites。 |
| crash support :32 | publish hook在before/after/third真实边界内 `process.kill(process.pid,"SIGKILL")`，无gracefulclose；after先实际publish，third先写externalC，再hardkill。没有已到达crashpoint见证。 |
| workspace :694–695/:731 | 正常结束 `child.kill("SIGTERM")` 却预期 `[0,null]`，finally只kill自有child。Windows强制kill无法证明production gracefulhandler/storageclose；还需等待stdio close/全部stderr而非只exit。 |
| acceptance :82–141/:149/:167 | 每fixture自己写 `root/runtime-tsconfig.json`，不是hardcoded全局tmp；source→tsx/src，compiled→dist；stop发SIGTERM，10s fallbackSIGKILL，预期exit0。source alias config虽在compiled创建但dist child不importtsx，不是本次缺配置原因；跨OS graceful合同同样待修。 |
| acceptance :227–245 SDK spawn | source→apps/mcp/src/index.ts+tsx，compiled→apps/mcp/dist/index.js；client.close并观察ownPID absent。Ubuntu/mac实际3项PASS，无证据把这条SDK启动列为当前第5FAIL。 |

在publisher `apps/server tests scripts`只读全搜索：硬编码 `/tmp/atlasmode-pol01-runtime-tsconfig.json` 恰好3处（workspace两处、repair一处），未发现写这个全局文件的代码。唯另一个TSX配置来源是acceptance的owned root配置。nativeCI env为POL01_ACCEPTANCE_MODE=compiled，browser另外POL01_PRODUCTION_GATE=1；build/typecheck先于test。不把已有dist或全局env改成source来掩盖缺配置；VM/tmp残留不是cleanrunner证据。

Node24支持erasable TypeScript类型剥离且忽略tsconfig，适用上述无runtime TS语法的crash support作为候选；packages exports仍须实际验证resolved dist。[Node24 TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html)。

Node文档说明Windows缺POSIX信号语义，SIGTERM/SIGKILL通过Node模拟导致强制终止；`child.kill()`不是graceful Windows关闭证明。[Node24 signal events](https://nodejs.org/docs/latest-v24.x/api/process.html#signal-events)。对crashselfkill的具体code/signal tuple必须同Node24.19.0在真实Windows取证，不能现在随意放宽接受任何code1/null。仓库已经有 `graceful-preload.mjs` + IPC：检查生产handler已安装，emit testSignal并disconnect，`production.mjs/startProduction`用它启动**actual compiled entrypoint**并保持exit0。这是可复用的已有test-only机制；不能把crashfixture改用它。

## 最小允许修复建议（给互斥writer，本文未实施）

A. 首先仅测试基础设施（方案由唯一writer结合RED/cleancompiled evidence选择，本文不预判唯一实现）：两POL test files及一个小的owned runtime helper（如 `tests/support/pol01-runtime.ts`），必要时support crash fixture的test-only到达见证。生产service/storage/index/HTTP断言、timeouts、CI compiled env、accepted Python fixture不改。

- **选项1：compiled crash support原生typestrip。** 当前pol01-crash.ts的TS语法仅as tuple（含可选string），无enum/参数属性/namespace；可候选 `node <absolute tests/support/pol01-crash.ts>`，Node24去掉erasable types且import @包按workspace exports读compiled dist，不加载TSX/tsconfig。需Node24.19.0三OS真实试验确认，类型检查另走tsc，不把typestrip当typecheck；明确清除继承TSX配置或避免加载TSX。sourcemode另用自己root生成config/source aliases；不能默认source fallback。
- **选项2：保留TSX test-harness、产品仍compiled。** 每fixture在自己的mkdtemp root创建配置，绝对extends当前checkout tsconfig.base。mode=compiled时不写source paths，`@codemap/{service,storage,indexer}`按workspace exports解析已build dist；support TS是test harness，允许TSX仅转译它本身，**产品包必须compiled**并记录实际resolved product paths。若sourcemode仍需支持，才按原fixture模式写owned绝对source aliases并标source结果。
- 全部child env必须使用自己创建的配置或明确删除继承的TSX_TSCONFIG_PATH；用checkout绝对fileURL/path定位support和dist，不依赖调用者cwd或全局/tmp。文件path保持Windows/mac规范化。不能只在CI预创建共享/tmp文件，也不能复用另个fixture的config。
- 第5case按MODE选actual `apps/server/dist/index.js`（compiled门）/actual src（另列source门），保原listen-before-recovery顺序、sameDB、HTTPready/currentapproval/audit/sourcebytes断言。测试名称/receipt记录mode，不能通过另一个injected createServer代替实际entrypoint。
- 正常entrypointstop复用已有graceful-preload+IPC（或startProduction，在保sameDB/port/devproxy需求后确认接口）；compiled SDK acceptance fixture需同样检查Windowsstop可复用此路径，不改clientSDK连接和数据断言。强制fallback只作为失败/cleanup，不能算exit0/cleanstorage成功；finally只ownchildren。
- 若Windows selfkill tuple与POSIX不同，优先给crashpoint一条可靠test-only IPC/ownedmarker见证（在真实durable intent对应hook到达、afterpublish/externalC之后），父先见证再用ownchild hardkill，保持no gracefulunwind；Linux/mac `[null,SIGKILL]`仍严格验证，Windows从实际Node24.19.0观测制定同等严格predicate并附checkpoint/kill-issued/actualexit/stderr/DBintent证据。不要 `[1,null]`一概PASS或用process.exit代替真实crash。到达见证不能代替父独立reopen/intent/recovery断言。

B. macOS额外storage test需独立限定观测窗，初始建议仅 `annotation-migration.test.ts`，不凭原POL修复顺手改sqlite.ts：

- :411先 `writeFileSync(stale-shm,32768zero)`；:426–430在walFixture返回、rawFingerprint后创建目录watcher；:441拒绝newSqliteStorage，:442等待25ms；:443rawFingerprint equality通过，:444events==[]收到renameSHM。该失败只证明收到一条event，未证明生产造成它，也未证明绝对无瞬时写入。
- macOS directory使用FSEvents，Node官方明确fs.watch跨平台不一致，[Node24 fs.watch caveats](https://nodejs.org/docs/latest-v24.x/api/fs.html#caveats)。**推断/待证**：fixture刚创建SHM的setup事件延迟/合并到新watch；静态preflight只raw读取original、私有copy写入且不copySHM，unsupported拒绝在原Database open之前。不能把这条推断写成根因已定。
- 先在真实macOS以control“setup后只raw读取、无SqliteStorage”收据核对watch startup/flush；明确arm barrier及baseline，不盲增sleep。若event仍不能可靠归因，增加原路径Database构造观察（现有better-sqlite3 Proxy已记observedFault.opened；在目标构造调用前保存openslice起点，随后精确比较这一slice且原Database path绝不出现）和production fs变更API的test-only跟踪，再以raw bytes/size/existence+identity证明原main/WAL/SHM/journal不变。保copy cleanup、拒schema断言和所有原保存合同；watch原events作为诊断保留。若替换events-empty，必须由等强/更强可归因观测与负例支撑，独审批准；不得删assert/macskip/filter掉renameSHM。
- mandatory negative/control：临时回退为readonlySQLite original preflight或受控真实原sidecar write/remove/recreate，新的观测必须RED（即使复原相同bytes也需原操作记录/identity捕获）。确认不会把private probecopy的合法sidecar变化误报original。若观测证实生产真实写入，再申请仅因果路径产品修复；本只读结果不授权或预判这一变化。

## RED / clean compiled 验证方案（未运行）

1. 保存当前exact source/日志/hash；在独立clean checkout/隔离容器且新tmp root（确保无全局配置、不删除共享VM残留）干净npm ci/build。原两test定向运行24例，POL01_ACCEPTANCE_MODE=compiled，记录真实RED8/或Windows实际失败，不由盲缺helper造成空suite；recordstderr必须等child stdio关闭。不称VM/tmp现成PASS为cleanrunner。
2. 最小patch后同clean条件一次GREEN：两test24例全PASS/0skip，runtime receipts区分crashpoint、hardkill与graceful stop、resolved packages=dist、actualentrypoint=dist、sameDB、exit/stdio/pidabsence、portECONNREFUSED、no leftover children。独立保before/after/third/unknown7+entrypoint1完整断言，不改语义预算。
3. compiled stdio integration3实际运行，尤其Windows正常handlerIPC路径与SDK restart/approval/quarantine，targetbytes/SENTINEL+immutablehistory；不得把source结果算compiled。
4. mac storage37 test在真macOS收原watch control/negative RED→GREEN；Linux/Windows相关37回归，证明不削弱no-original-open/sidecar preservation。若只能保持未定因，明报mac失败，不标DONE。
5. 独审精确test/helperdiff后主控唯一clean final build/typecheck/lint/unit（POL01_ACCEPTANCE_MODE=compiled）/smoke/productionbrowser（gate1）顺序运行；之后同frozen SHA真Ubuntu/mac/Windows远端CI。保原run38108513324所有8/9失败，禁止用改CIenv/fallbacksource或仅本机配置存在闭票。

本次分析状态：POL01 root cause配置缺失有直接日志证据；三处硬编码与强制source已定位；Windowskill/graceful合同与macwatch事件因果仍是需真实执行的后续条件，均未被本brief称为PASS。


## Windows 完成后的追加证据（只读，未实施）

Windows job114379013626：12FAIL/1334PASS/18skip/1372total，另1unhandled worker error。原日志 SHA256 `7aebeebb16f99000b7e44aa1013c14588d8bd25fdbd71af5476f2687d4500ff9`。原POL8之外新增SDK3与structure权限1；绝不能只修hardcoded config便声称全绿。

- SDK3均在 `tests/support/pol01-acceptance.ts:184` normal stop assert `[0,null]` 收到 `[null,SIGTERM]`，原records确认API为compiled且portClosed=true；它证明端口关闭，不证明handler/storage drain。:150 spawn stdin=ignore且无IPC，:166 child.kill(SIGTERM)，:169 10s强制fallback；restart/close依赖此stop。当前source SHA见上表 `f5506eaa40d2bf29725b7506417504b74777975ae865325f3ff7790fd5116b0f`。
- [Node24.19 subprocess.kill](https://nodejs.org/download/release/v24.19.0/docs/api/child_process.html#subprocesskillsignal) 明确Windows SIGTERM/INT/KILL/QUIT会forcefully abruptly kill。保持正常stop严格exit0/null；不将任意SIGTERM当graceful，也不把POSIX OS signal机制强加Windows。最小fixture候选为现有graceful-preload+IPC，在实际index已注册SIGTERM listener后受控调用它；另一候选为owned stdin EOF test-onlypreload调用同一已注册处理函数。两者都明确“受控调用产品处理函数”区别“OS发信号”，需实现后独审，不预判唯一方案。保10s有界ownerstop/fallback失败、freshDB reopen/完整history/audit/drain、active请求关闭、port与PID absent receipts；不得改生产shutdown语义或称AG03Job解决。
- `packages/storage/src/structure-file.test.ts:215` concurrent-reader+permission case期望0o640=416，实际0o666=438。SHA256 `cb40238c98e285d661426e2cfd209e51c22d02fec53f14294a3f0762d5ae5fe4`。:180 chmod(640)后未读取实际originalmode便publish。 [Node fs.chmod Windows caveat](https://nodejs.org/docs/latest-v24.x/api/fs.html#fschmodpath-mode-callback) 仅支持write permission区别，owner/group/others无实现。因此最小测试修复是chmod后、publish前stat保存实际originalmode，publish后精确比较它；POSIX保实际original=640额外断言。不skipWindows、不省mode、不容忍任意mode；30concurrent readers complete old/new JSON、digest、no-original-unlink及同步barrier全部保留。Windows writable/readonly平台有效mode变化负例需真实验证，防止mode保持assert空洞。
- worker异常原log:950–968是 `[vitest-pool]: Worker forks emitted error / Worker exited unexpectedly`，无文件/PID/exitcode定位。原log没有annotation-migration summary；root全Linux112expectedfiles比Windows111summary，缺 `packages/storage/src/annotation-migration.test.ts`（37tests）。这是定位候选，不能证明该文件导致异常，也不能证明37全部未跑。下一真实Windowsrun对该37test有界单独raw输出与phase/PID/exit/stdio诊断，再正常全suite，保unhandled为失败；不依此推断产品瞬时原文件写入。
- 1374→1372差2已源码核实：`apps/server/src/dev.test.ts:298` test.each排除Windows signal（9→8），SHA `3876549f0064a121a655e0a9b9a0d7bcda8b50632799143378f1e5b2a713b469`；`apps/server/src/index.test.ts:79`同样排除signal（5→4），SHA `2c48a9aecd0f61fb01295669049b5e15fb32c2243e840ab610ec45551c7005f7`。它们并非worker丢失2test证据；Windows总数仍不能说明annotation37完整完成。

修复范围追加两个测试文件 `tests/support/pol01-acceptance.ts`、`packages/storage/src/structure-file.test.ts`（必要owned shutdown helper），annotation观测修复保持独立因果证据。原accepted Python55在Windows实际PASS15.36s；browser53PASS，不改变此前acceptedhelper/global产品。完整closure需要Ubuntu/mac/Windows cleancompiled、storage负例、SDK真实graceful/drain与Windows无worker错误共同满足，当前全部原FAIL保持。
