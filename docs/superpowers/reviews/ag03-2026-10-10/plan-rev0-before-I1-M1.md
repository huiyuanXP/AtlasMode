# AG03 Windows Owned Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after main grants the product window. Steps use checkbox syntax. 当前仅 DESIGN ONLY；不运行下列命令、不实现、不 stage/commit。实施和独立复审沿用明确 gpt-6.1-sol high；不自行 spawn 或替换模型。阶段提交均由主控完成。

**Goal:** Windows 每个原生 run/probe 有独立 Job，根先退出/MCP后代持 stdio 时仍有界清理和诚实 gateway/journal 收口。

**Architecture:** 仓库自有 C++ helper 在 CreateProcessW 中通过 JOB_LIST 原子归属；Node owned transport 保留 JSONL/parser 与 scoped gateway。gateway 有界关闭 ingress，超时保留真实 pending 与 storage 所属 work。先内部机制 native CI，再经主控授权接入 conditional guard。

**Tech Stack:** Node.js 24.19.0、npm 11.9.0、TypeScript、Vitest、现有 MCP SDK/SQLite；Windows 10+/Server2016+ x64、已安装 MSVC/Windows SDK、C++20/Win32。

**Spec:** `docs/superpowers/specs/2026-10-10-ag03-design.md`。

## Global Constraints

- Windows10+/Server2016+ x64；ARM64/x86/旧系统 unavailable。
- 本轮不解除 guard；阶段 A 保留，阶段 B 须独立实现 review + 原生机制证据 + 主控窗口。
- 无新 npm dependency、安装 lifecycle、自动下载、提权、全机 taskkill/进程扫描或目标源码执行。
- server build 保持精确 `tsc -p tsconfig.json`；新增独立可选 `build:agent-job`，dev白名单保持。
- root/probe 都通过 owned Job；不支持 `.cmd`/`.bat`/PowerShell shim 或 shell fallback。
- setup5000ms、运行默认120000ms、probe执行5000ms/65536bytes；Job empty2000ms、stdio drain1000ms、process stop总5000ms、gateway drain5000ms、cancel/bridge.close总10000ms。
- Job cleanup verified 要 ActiveProcesses==0；缺ack/异常 helper为 AGENT_CLEANUP_FAILED，不把 root exit/EOF 代替证明。
- pending 维持 running/会话active/mayHaveSavedChanges；storage只在实际服务tasks settled后close。
- CLI privacy、1MiB JSONL、isolation/tool/approval restrictions、HTTP/UI/通用MCP和POSIX行为保留。
- QA02真实Codex/Claude与交互Ctrl+C独立，fixtures/SDK/nativeCI不能替代。
- tests只用独立DB/端口/cwd、owned handles；Windowshelper缺失不得skip该平台机制suite。
- rootscoped checks先协调，主控独占最终clean rootCI/提交；原FAIL、review和每阶段source/binarySHA不覆盖。

## Review Focus

1. 创建后恢复前 helper 崩溃：根已属Job，绝无 suspended orphan（任务2/G1）。
2. CLI根退出但孙进程持stdio：ROOT_EXIT触发清理，独立于close事件（任务2、3/G2）。
3. owner/control/helper故障与重复stop：只清own Job，bounded failure不声称verified（任务2、3/G3/G4）。
4. gateway派发mutation跨5s deadline：DB不能先close，pending不漏journal/会话锁（任务4、5/G7）。
5. runnerimage变动、manifest漂移、cmd shim、nestedJob与literalquotes：safe refusal/真实Windows验证（任务1、2、3、6/G5）。

## 文件和共享窗口

新文件：`apps/server/src/agent/owned-process.ts`（私有 transport 类型/平台选择）、`windows-job-protocol.ts`（frame codec/校验）、`windows-job.ts`（Node helper owner）、对应三个 `.test.ts`；`apps/server/native/agent-job/{main.cpp,job.cpp,job.h,protocol.cpp,protocol.h}`（helper/atomic launch/协议）；`apps/server/native/agent-job/tests/{job-fixture.cpp,job-harness.cpp}`（纯测试observer/sentinel/故障）；`scripts/build-agent-job.mjs`、`scripts/build-agent-job.test.ts`；`apps/server/src/agent/windows-job.integration.test.ts`。

修改窗口：`apps/server/src/agent/{process.ts,native.ts,gateway.ts,bridge.ts,routes.ts}` 及现有专属 tests；`apps/server/src/{server.ts,index.ts}` 生命周期与 `shutdown.test.ts`；`apps/web/src/features/chat/{controller.ts,strings.ts,controller.test.ts}` pending 显示；根 `package.json` 仅可选 script、`.gitignore` 仅native输出、`.github/workflows/ci.yml` 仅native编译/证据。server/package build、core/indexer/storage/service源码不改。新 `owned-process.ts` 只适配现 spawn/group代码，不重构 JSONL/parser。

生成产物：`apps/server/native/bin/win32-x64/atlas-agent-job.exe`+manifest 不commit；test fixture/harness另放测试产物目录，不能被 runtime manifest接纳。原 spec/plan read-only冻结，后续范围变化需新revision receipt。

### Task 1: Manifest、frame codec 与显式构建入口（guard保留）

**Files:** 新 `windows-job-protocol.ts/.test.ts`、`scripts/build-agent-job.mjs/.test.ts`；未来获窗后根package.json/.gitignore。

**Interfaces:** `encodeLaunch(input:OwnedLaunch):Buffer`、`decodeControl(frame:Buffer):ControlEvent`；`OwnedLaunch={command:string,args:string[],cwd:string,env:NodeJS.ProcessEnv}`。ControlEvent只有 HELLO/READY/ROOT_EXIT/JOB_EMPTY/ERROR，包含 spec确定字段；codec 支持任意chunk和连续帧、只拒非法状态次序，不拼 shell、不输出敏感 payload。`buildAgentJob({toolchainDir,outputDir}):Promise<Manifest>` 用已有toolchain，返回strict manifest与源清单。

- [ ] 写 RED：roundtrip empty/Unicode/quote/slash args；frame>1MiB、unknown type、重复launch、invalidUTF8/NUL、argc257、envc513、case-insensitiveduplicate、Win32line32768均拒绝；manifest missing/hash/source/version/arch/unknownkey均 unavailable。测试不调用目标CLI、不伪造Windows已支持。
- [ ] `npx vitest run apps/server/src/agent/windows-job-protocol.test.ts scripts/build-agent-job.test.ts`；预期新module/实现缺失导致真实RED，保存log和inputSHA。
- [ ] 实现有界codec/manifest验真；buildscript从已安装vswhere/VsDevCmd发现compiler，仅明确的可信固定build命令可用开发者shell激活，CLI启动仍无shell。缺工具链失败，不自动安装；加入独立script与native产物ignore。
- [ ] 同命令GREEN；检查 `apps/server/package.json` build/lifecycle、`scripts/dev.mjs` 不变。当前Linux只能证明codec/refusal/buildscript规则，nativecompile留任务2/6。
- [ ] freeze独占diff、scopedlint/noEmit；交主控限定checkpoint，不自行gitadd。

### Task 2: C++ 原子 Job、根退出与观察句柄（内部 adapter Gate A）

**Files:** 新native source与tests、`windows-job.integration.test.ts`。

**Interfaces:** `OwnedJob::Launch(const Launch&, HANDLE stdin, HANDLE stdout, HANDLE stderr)` 内部返回root/threadHANDLE；`OwnedJob::Stop(deadline)` 与 `OwnedJob::ActiveProcesses()`；helper发布协议1事件，不读payloadstdio。测试harness链接同job.cpp，在test-only callback插入“CreateProcess完成、Resume前”故障；release main无故障开关。

- [ ] 写真实Windows RED：observer在放行根前持有根/后代非inherited HANDLE；assert `IsProcessInJob(root,ownedJob)` 在Resume前true。fault-after-create使helper/testharness退出，根HANDLE最终signaled。root-first0/root-first1+持stdout/stderr孙进程，STOP重复/race、owner退出、helper真实被终止、nested outerJob、detachedchild、breakaway请求均验证所持HANDLE；outside sentinel始终WAIT_TIMEOUT。
- [ ] 已安装Windows环境 `npm run build:agent-job` 后 `npx vitest run apps/server/src/agent/windows-job.integration.test.ts`；首RED可以是helper未实现/无JOB_EMPTY，不能因当前publicguard提前refusal当机制RED，也不能missingexe skip。
- [ ] 实现Job KILL_ON_JOB_CLOSE、JOB_LIST+HANDLE_LIST CreateProcessW suspended、确认归属后Resume、overlapped控制等待、rootHANDLE事件、TerminateJobObject与ActiveProcesses轮询。所有HANDLE RAII归本实例，止于deadline；不启breakaway，不给payload控制/Job/observerHANDLE。
- [ ] GREEN G1/G2/G3/G5：记录build/source/binary/manifest/OS/arch/toolchain SHA和各handler时间；helper崩溃missingack结果明确unverified，即使testobserver证明内核已经终止后代。
- [ ] 保留publicguard，交主控review；没有真实Windows执行环境则任务BLOCKED，不能用mockwin32或Linux模拟GREEN。

### Task 3: Node owned transport、JSONL与probe统一归属

**Files:** 新owned-process.ts/windows-job.ts及tests；修改process.ts/native.ts和对应tests，publicguard仍保留。

**Interfaces:** `launchOwnedProcess(input:OwnedLaunch):OwnedProcess`，`OwnedProcess` 的stdio/rootExit/done/stop按spec；package内部 `bindAgentTransport(input:ProcessInvocation,emit,transport:OwnedProcess):RunningAgent` 可由阶段A可信test runner调用，保原parser规则。`startProcess(input:ProcessInvocation,emit):RunningAgent` 与 `RunningAgent{done,stop}`保持，publicguard此时不变。probe rawmode走同transport，保留现private `{code,text}`返回，不输出stderr。runtime `verifyWindowsHelper():Promise<Manifest>` 每次launch验真；测试注入helperpath仅可信构造私有adapter，不能HTTP配置。

- [ ] RED：namedpipe HELLOnonce/version错误、controlEOF、READY前取消、missing/mismatchedexe拒绝不跑CLI；rootExit早于stdioEOF触发stop；samePromise重复stop不重置deadline；真实argv往返；probe建后代持stdio后根先退出，65537bytes和5s运行超时也清Job；断言所有原JSONL/privacy/unsafe-tool案例仍成立。
- [ ] `npx vitest run apps/server/src/agent/windows-job.test.ts apps/server/src/agent/owned-process.test.ts apps/server/src/agent/process.test.ts apps/server/src/agent/native.test.ts` 保存RED，平台OS特有机制分开标记。
- [ ] 实现固定路径helper owner/namedpipe单连接、bounded协议、stdio直通与stop latch；复用现POSIXgroup策略，JSONL parser只替换transport入口。Windowsmetadata/hash失败、cleanupunverified令当前runner unavailable、invalidate inspect缓存；临时cwd仅verified cleanup删除。
- [ ] GREEN再跑任务2真实Windows套件；确认probe/setup/stop分别deadline与完整inspect串行最大值，不能把capturetimer/测试timeout代替产品期限。
- [ ] freeze和独立review；runtime available仍被原publicguard拒绝。

### Task 4: gateway drain、journal 与 storage 生命周期

**Files:** gateway.ts/bridge.ts/routes.ts/server.ts/index.ts、对应tests、新shutdown.test.ts。

**Interfaces:** `GatewayCloseResult={settled:true}|{settled:false;whenSettled:Promise<void>}`；gateway.close idempotent。`AgentCloseReport={settled:boolean;whenSettled:Promise<void>}`；bridge.close并行有界；内部 `AgentLifecycle{whenIdle():Promise<void>}` 从registerAgentRoutes返回，createServer可选 `onAgentLifecycle?:(lifecycle:AgentLifecycle)=>void`。ChatRun DTO、MCP/publicHTTP字段不增加；onAgentLifecycle只trustedconstructor，不允许请求注入。

- [ ] RED真实barrier案例：dispatch mutation后hold；调用cancel，gateway新连接失败，5s后run仍running/AGENT_CLEANUP_PENDING/mayHaveSavedChanges true，同会话新start409，storage.close未调用；release后actualPlanIDs一致、只一次mutation、statusfailed/AGENT_GATEWAY_DRAIN_TIMEOUT，active才清。never-settle negative用ownedbarrier最后release，不遗留测试进程。
- [ ] RED server.close：四runs并行，10s总期限不四倍；mainlistener关闭，pending whenIdle未resolve则storage保留；release后storage最后close且只一次。测试失败handler也settles，成功journal先于delivery，no-ID/跨project过滤保留。cleanupfailed即使cancelrequested仍statusfailed。
- [ ] `npx vitest run apps/server/src/agent/bridge.test.ts apps/server/src/agent/routes.test.ts apps/server/src/shutdown.test.ts`；pre-fix预期hang/提前DBclose/terminal错误必须保存真实RED，不用盲增timeout。
- [ ] 实现ingress同步close+ownedconnectionsdestroy，inFlight真实drain期限、whenSettled跟踪；bridge pending保active及error，deadline后cancel有界snapshot；settle再实际journal终结。routes preClose 有界后让Fastify close主listener；index移除盲finally DBclose，注册一次whenIdle storage finalizer，失败只安全报告。
- [ ] GREEN：真实5s/10s产品预算的测试外层timeout20000ms，说明这是orchestration覆盖setup/收口的测试预算。scoped typecheck确认所有原createServer调用兼容；no abandoned promises/no new queue/sourcewrites/approval路径。
- [ ] freeze共享接口精确hunks交主控复审，不自行stage。

### Task 5: pending 在实际 Chat 停止流程可见

**Files:** web/features/chat/controller.ts/strings.ts/controller.test.ts（另需主控UI窗口）。

**Interfaces:** ChatRun仍四状态、errors结构不变。poll/cancel返回running+AGENT_CLEANUP_PENDING时显示错误，继续500ms既有poll/保持busy，不能调用settled callback；实际terminal之后再同步已保存IDs。

- [ ] RED：fake transport按真实HTTP返回pending，assert busy true/输入保留/未settled/继续poll；release后failed只settled一次与actualIDs。zh/en错误文案均显示“本轮连接已关闭，已派发变更仍在收口”对应译文，保既有partial提示；不用新enum。
- [ ] `npx vitest run apps/web/src/features/chat/controller.test.ts` 保存RED。
- [ ] 实现pending错误显示和strings映射，不改provider/selectors/Nav/ChatPanel布局。
- [ ] GREEN及实际browser stop点击：独立服务controlled dispatch barrier，保存pending/terminal双截图与HTTPjournalreceipt；真实执行前先协调webbuild和浏览器窗口，不用component测试冒browsergate。
- [ ] freeze精确UIbytes并释放窗口交主控。

### Task 6: 真实 Windows CI 机制与 guard 条件接入

**Files:** `.github/workflows/ci.yml`、platform-refusal.test.ts/native.test.ts/process tests与Windowsintegration；阶段B才修改native/processguard相关hunks。

**Interfaces:** native job现matrix Windows step在npmci之后、tests之前显式 `npm run build:agent-job`；不改变server纯tsc build或Linux/macOS执行行为。Actions evidence名包含OS/commit，内容仅safe metadata/manifest/test receipts与原失败，不上传prompt/env/accountstores/DB。

- [ ] Gate A编译releasehelper+testfixture/harness，所有任务2/3/4 realWindows案例必须执行；记录BuildTools/SDK、binary/hash/sourcefreeze，G1-G7原始PASS/FAIL。helper missing/arch错误需要FAIL或明确capabilityrefusal testcase，机制suite不得skip。
- [ ] 独立solhigh实现审查，主控审核GateA receipts及共享diff；未满足则停止，原guard保留。当前docs交付未通过此步。
- [ ] 授予阶段B后写RED：Windows x64/validmanifest+trusted.exe fixture inspect可验证能力，缺exe/hash/arch/cmdshim及不兼容outerJob明确unavailable。POSIX/nativeprivacy和responses provider原行为保留。真实codex/claude未获得收据时labelsimulated，绝不声称QA02完成。
- [ ] 仅将三处unconditional拒绝替为capability条件式guard；safe failures仍拒绝。同一冻结source/binary运行root-first实际SDKMCP→HTTPdraft/cancel/serverclose，正常收口≤10s、journal正确、gateway拒新连接/DBreopen、targetSHA不变。
- [ ] 原native matrix完整checks+Linuxbrowser回归由主控clean snapshot排队；平台Job/源码构建不能通过Linuxgate代替。所有原FAIL归档后才可标阶段B实现已验证。
- [ ] artifact分发只记录仓库自有CI产物路径/hash，公开发行或生产部署没有本计划授权。

### Task 7: 冻结、独立复审与分开验收

**Files:** 专属 `docs/superpowers/reviews/ag03-2026-10-10/` 未来evidence report；主控管理tickets/state/README。

**Interfaces:** receipt包含source-manifest/helpermanifest/compiledhash/OS工具链/nativecase结果、HTTP/MCP/browserpath、原失败、独立review与修复、guard阶段；QA02 client/interactive列表独立。

- [ ] 核 frozen source在build/gates前后hash不变；排除其它作者未审改动，所有sharedfilehunks由主控限定集成。
- [ ] 列 G1-G8 每项真实证据与未通过/无法复现项；Windows机制全部必要positive+negative才建议AG03DONE，设计/compile/sdk/mock不能替代。
- [ ] 原reviewer/model只读独立high复审；失败项targetedRED→GREEN保原记录，未修关键项停止guard接入。
- [ ] 明列QA02真实Codex/Claude安装形态、登录/交互CtrlC、历史SIGKILL尚未验证；不自动关闭QA02或称所有Windows发行支持。
- [ ] 提交白名单/精确shared-hunks给主控；commit/push和root checks归主控，之后释放窗口。

## 作者自检

Spec范围对应任务1分发identity/协议、2Job与race、3run/probe、4pending/storage、5UI、6nativeCI/guard、7历史/证据。私有transport与公共RunningAgent/ChatRun区分；GatewayCloseResult和AgentCloseReport名称前后一致；没有packages/server路径、泛泛“加测试”或实现中再猜平台。五项reviewfocus均有明确反例。设计/计划冻结后等待独立审查及主控授权；本次没有产品实现或native成功声明。
