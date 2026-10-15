# AG03 native FIRST window — 独立源码审查

2026-10-11 UTC。独立 reviewer；本席模型合约为 **gpt-6.1-sol / high**。结论：**REQUEST_CHANGES — C0 / I1 / M1**。这是批准的 FIRST 12 新文件的源码结论；不批准 Windows 产品接入、guard B、发布或 AG03 DONE。Windows MSVC 编译和原生执行仍 **UNRUN**，guard A 保留。

## 输入与只读验证

先读作者 `ag03-native-window-report.md`，再核 manifest、完整新增 patch、批准 spec/plan、原 REQUEST_CHANGES 与设计复审 APPROVE。审核全部 12 文件，没有只看作者摘要。

| 冻结输入 | Bytes | SHA256 |
| --- | ---: | --- |
| 作者 report.md / 本地 ag03-native-window-report.md | 9259 | `0af10588a15feb388c7a7200e506b8729d19fd76ab70da01fb001954ce1aee1b` |
| sourcefreeze.json | 2118 | `309270eb5d5c3571b0003d48bf220cb9707349b6beb733ee05cde980f6e55b26` |
| native-source.patch | 63060 | `b327ab59c2dc06ef940161b0502198a6839249f32a268f04f909893cae9cb230` |
| 批准 spec | 25155 | `3a17c125eb89aa4e4f46b569f51331f653fc00401905732f1a25900b5a73186b` |
| 批准 plan | 22410 | `cd4adb3b88294dbc8e5b6c2e6e5fc594e525f00bc8c7ea858cb6369c94c26150` |

本地 patch 逐份重建到 `/tmp/ag03-review-source/`；12 份内容的 bytes/SHA 与 manifest 完全一致。通过指定 SSH 配置，只读核验 VM2 `/home/agent/projects/AtlasMode`：12 份当前源码与 ledger `sourcefreeze/` 副本各自都匹配 manifest；report/manifest/patch 同本地字节。再次独立计算 before-manifest 中 20 项当前共享源码、设计、review、package/lock 的 bytes/SHA，全部匹配。`shared-after.json` SHA 为 `8202d4868b6e84f95f14cd284f59ede1591643f759e95b3d9482614db321e9fa`。

已读取 VM2 AGENTS.md，以及 using-superpowers/codex-tools、requesting-code-review 的 reviewer 模板、verification-before-completion；reviewer 模板明确只读且不再派 reviewer。本文是唯一新增交付文件；没有改源码、运行实例、读取密钥/private sessions/用户 DB、stage/commit/push 或 spawn。首次 SSH 被本地网络沙箱阻止，获自动批准后完成上述只读核验，未留下阻塞。

没有重跑作者 28 项 Vitest 或 portable 整套测试。`frozen-checks.json` 的 argv/exitCode/frozenExitCode/sourceBefore/sourceAfter 已读；它们是作者历史收据，不能充作我实际运行 Windows 的证明。

## 在本窗口符合设计的部分

| FIRST 要求 | 源码位置与判断 |
| --- | --- |
| Win10+/x64、创建时原子所属、无后补或 breakaway fallback | `job.cpp:21-28,39-48` 设置私有 KILL_ON_JOB_CLOSE Job；JOB_LIST 随 CreateProcessW 创建；先 IsProcessInJob 再 `resume()`。平台/工具链入口拒绝其它平台，JOB_LIST 不可用时失败收口。 |
| 三份 stdio 与私有 HANDLE 分离 | `job.cpp:9-12,38-46` 显式 inheritable duplicate、准确 HANDLE_LIST、TRUE、STARTF_USESTDHANDLES 和三个 hStd；`job.cpp:26,47` 与 `main.cpp:18,46` 清除 private inherit。成功继承后 duplicates 与 helper 自有 stdio 分别释放。 |
| root-first 与 Job lifetime、有限 failclosed | `main.cpp:73,89-105` 统一 stop latch，root HANDLE 触发 ROOT_EXIT，TerminateJobObject 后以 ActiveProcesses==0 确认；`job.cpp:52-55` 最多 20ms 轮询。根退出不释放 Job；helper 退出触发最后 Job HANDLE 关闭。 |
| 控制 I/O 独立、不挤占 payload stdio | `main.cpp:24-67` 分离 overlapped read/write、有限队列与取消存储存活等待。owner EOF/协议错误不虚构 JOB_EMPTY 已交付；生产无故障注入开关。 |
| 帧/文本/args/环境/命令行预算与 exe-only | `protocol.cpp:40-60,63-108`、`windows-job-protocol.ts:7-72`；literal CRT quoting 和 strict Unicode/NUL 校验。Unicode 环境键两端规则存在 M1。 |
| 独立显式构建/manifest | `build-agent-job.mjs:29-64` 要求真实 win32/x64、激活的 MSVC/SDK，绝对 cl 路径；C++20、静态 CRT、W4/WX/Brepro；固定 7 文件 sourceDigest、构建前后检查、binary hash 和固定产物目录。`windows-job-protocol.ts:74-81` 是 schema 校验，完整 runtime 验真属于后续窗口。 |
| authored native harness 与观察者 | `job-harness.cpp:67-105` 已写恢复前所属、未恢复 root 的 last-close、root-first、nested descendant、独立 sentinel、真实 helper 控制/EOF/终止；observer duplicate 明确 FALSE，未扫描进程树。失败路径有 I1。 |
| 边界保持 | 12 文件之外的共享输入指纹均一致；没有 runtime 引用、公共 DTO/capability/guard 或 package/CI 接线。 |

Microsoft primary 文档支持 HANDLE_LIST 的 inheritable/TRUE 约束和 JOB_LIST 的 Win10/Server2016 下限：[UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)。机制选择的静态符合不等于已测二进制。

## C / I / M

### Critical

**C0**：本次未发现达到 Critical 等级的确定缺陷。

### Important — I1：harness 的 pending ConnectNamedPipe 未在异常路径保持 OVERLAPPED 生命周期

**位置：`apps/server/native/agent-job/tests/job-harness.cpp:33-36`；关联 `:108`。**

`ConnectNamedPipe` 以栈上 `connect` 发起异步操作，通常返回 ERROR_IO_PENDING。其后 `helper_owner.create()`、`resume()` 可以失败；连接的 5000ms wait 也可以超时。上述异常路径没有取消 pending connect 并等待最终完成。循环作用域展开时，`connect` 的生命周期结束、`connect_event` 被关闭，然后才关闭此前声明的 pipe；异步操作仍可能使用该 OVERLAPPED 存储。单独的 HANDLE RAII 不满足异步请求所引用存储的生命周期要求。

这是当前已授权 harness 源码的错误路径缺陷，不是要求提前补完整 G1–G8。比如现有 fixture/helper 的创建在外层 Job 不兼容时拒绝，或 helper 启动后在连接前退出，就会进入此路径。它使 native gate 的正常失败处理本身存在失效存储写入/不可靠退出风险，削弱“所有测试对象 finally/RAII 仅清 own 对象”的设计要求（spec:106，plan Task2:71）。未运行 Windows；这里是可从 pending 请求与栈作用域直接判定的生命周期问题，未宣称已经复现 crash。

**要求修复：**为 connect 引入只覆盖该请求的 RAII pending-operation owner，在所有退出路径取消本 pipe 的 connect，保持 pipe/event/OVERLAPPED 存活到实际完成，使用有界等待；不能确认 completion 时走测试进程的明确退出路径，避免普通 unwind 释放存储。`pipe_io()` 的现有取消/有界等待和生产 Channel 的存储保持可作为实现思路。增加本 harness 的“未连接/连接前启动失败”定向负例并保留 Windows 执行收据；不需要改生产 helper 或共享文件。

[ConnectNamedPipe](https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-connectnamedpipe) 明确 ERROR_IO_PENDING 代表请求仍未完成；[CancelIoEx](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex) 明确取消不等待完成，完成前不得释放或复用 OVERLAPPED。

### Minor — M1：Unicode 环境键的大小写等价规则未在 TS/C++ 对齐

**位置：`apps/server/src/agent/windows-job-protocol.ts:47,50`；`apps/server/native/agent-job/protocol.cpp:33-38,48`。**

TS 用 ECMAScript `toUpperCase()` 生成 duplicate key，而 Windows C++ 用 `CompareStringOrdinal(..., TRUE)`；portable C++ 又只折叠 ASCII。前者可以做多字符 uppercase expansion，Windows API 按系统 uppercase table 做 ordinal 比较，两端并非一个已证明相同的规则。一个需纳入真实 Windows 对照的具体输入是两个键 `ß` 与 `SS`：TS 会先把它们合并拒绝；当前 wire/duplicate tests 只验证 Path/PATH，不能证明完整 Unicode 环境键互通。这里没有把 Windows 对照写成实测 FAIL。

**影响与建议：**这是合法 Unicode 环境的兼容性/拒绝一致性问题，当前表现首先是安全地多拒绝，不是已证明的逃逸或数据损失，因此列 Minor。明确同一允许域和权威规则，增加 expansion/非 ASCII 键的跨语言 Windows 对照；需要限制允许域时先确认符合批准的 literal 环境设计，不在此审查擅自收窄契约。[CompareStringOrdinal](https://learn.microsoft.com/en-us/windows/win32/api/stringapiset/nf-stringapiset-comparestringordinal) 规定系统 uppercase table 与 binary/ordinal 比较语义。

## 未作为本窗口代码缺陷判定的行为

以下逐项留给主控决定后续窗口，没有静默删除：

- 未实现 Node owner registry、prestart/status/inspect/probe 生命周期、固定路径/重解析点/binary 验真、scope adapter：本 FIRST 明确不授权这些新文件与共享调用链。
- 未实现 gateway/journal/storage/pending UI 和 10s server.close 总预算：需要后续共享窗口；不能因当前未接线扣本 12 文件源码，但不能宣告产品完成。
- 固定 helper runtime 120s 与未来 per-run/probe 5s 的具体期限：作者已明确裸 helper 的限制，adapter 的 STOP/同预算收口仍须后续证明。
- 缺真正 owner process termination、after-create/before-resume crash barrier、detached/breakaway、真实 Unicode argv/stdin prompt 往返、READY 前取消/坏协议、四并行的完整 authored gate：作者准确列为尚未补足；是剩余 native 条件，不把完整 Gate A 提前强加成这次狭窄源码窗的新增实现范围。
- package script、ignore、CI、guard B 接入、真实 Codex/Claude `.cmd` 安装形式与交互 Ctrl+C：本窗口未授权；QA02 外部条件保留。

## Windows 条件与产品放行

**实际 Windows MSVC 编译、binary/manifest/toolchain receipt、所有 Windows harness 执行均 UNRUN。** 作者 28/28、ES2023 noEmit、scoped lint、Linux portable C++、81 字节 wire 一致及 Linux 明确拒绝已有收据；这些不替代以下真实 gates，也不验证 W4/WX 下 Windows 编译。

| Gate | 本次真实证据状态与剩余条件 |
| --- | --- |
| G1 | UNRUN；恢复前所属/last-close 有源码。仍须真实创建后恢复前 helper/harness 崩溃与外部观察者证明无 orphan。 |
| G2 | UNRUN；root-first 0/1、nested descendant 持流有源码。须真实 helper/最终 adapter 的 ROOT_EXIT→JOB_EMPTY→受限 drain。 |
| G3 | UNRUN；真实 helper termination、owner EOF 有源码；真正 owner process 被终止与无 ack 诚实 unverified 未证实。 |
| G4 | UNRUN；重复 STOP 有源码；READY 前取消/坏协议/timeout/四并行及 status/prestart/cache inspect shutdown barriers 尚待完整实现与执行。 |
| G5 | UNRUN；exe refusal 与 nested Job 部分源码；实际 literal Unicode argv/stdin/stdout/stderr、detached/breakaway、identity/arch negatives 未证实。 |
| G6 | UNRUN；实际 SDK MCP→HTTP→独立 SQLite/journal/gateway 收据需要后续接线窗口。 |
| G7 | UNRUN；真实 5s dispatch drain、10s close、pending UI、journal/storage 顺序需要后续共享窗口。 |
| G8 | UNRUN；全部 native 必要案例不得 missing-helper skip；最终 Windows/Linux/macOS/浏览器/privacy 回归需主控清洁冻结候选。QA02 单列。 |

同一冻结 source/binary 的原生验证、缺 helper 不 skip、两次同工具链 binary SHA（若要声称 byte-for-byte reproducible）仍需协调已有 Windows runner。源码静态审查不提供这些 PASS，也不授予修改 CI 或 guard 的权限。

## Verdict

**Spec compliance：本 FIRST 主要结构符合；I1 违反其异步资源/失败收口要求，M1 留有 Unicode 互通差异。Code quality：REQUEST_CHANGES。**先在现有白名单内定向修 I1、保存新冻结 manifest/patch 和负例收据，交原 reviewer 复核；M1 可明确处置并纳入真实 Windows 对照。

I1 关闭后最多给出 FIRST 源码 checkpoint 的 APPROVE。只有后续真实 Windows G1–G8 与产品接线/独立复审条件全部满足，主控才能决定 guard B；当前 **guard A unchanged、Windows unavailable、AG03 未 DONE、QA02 未完成**。
