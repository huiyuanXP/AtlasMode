# AG03 FIRST R1 — I1 targeted repair

2026-10-11 UTC；作者执行模型：原 gpt-6.1-sol high。状态：**仅 I1 harness 源码定向修复冻结，待原 reviewer 复审；M1 OPEN_NATIVE_EVIDENCE_GATE；Windows MSVC/G1–G8 UNRUN；guard A unchanged，AG03 未 DONE。**

只改 `apps/server/native/agent-job/tests/job-harness.cpp`，没有改生产 helper、TS/C++ codec、build接口或共享 bridge/runtime/server/package/CI。没有 shared build/stage/commit/push/spawn、auth/密钥/其它进程树访问。

## 原文与冻结保存

VM2 repo `/home/agent/projects/AtlasMode`，独占 ledger `docs/superpowers/reviews/ag03-2026-10-10/native-window/`：

- `R1-before/independent-review.md` 为完整原 REQUEST_CHANGES 原文，SHA256 `3ff1b1eeb03eeb6938f14cd8a725e06413beb46ef64964d84d95ff0c109dd92e`，未改写。
- `R1-before/sources/` 保存原12源 exact bytes；原 `sourcefreeze.json` SHA `309270eb5d5c3571b0003d48bf220cb9707349b6beb733ee05cde980f6e55b26`、patch `b327ab59c2dc06ef940161b0502198a6839249f32a268f04f909893cae9cb230`、作者原报告 `0af10588a15feb388c7a7200e506b8729d19fd76ab70da01fb001954ce1aee1b` 与原 checks/receipt/before manifest 全部保存。FIRST原根目录收据不覆盖。
- `R1-after/sources/` 保存新12源 exact bytes；`R1-after/sourcefreeze.json` SHA `04e3dfc293a3cb58ea05ba61f5d1c5e3fad009992dadc4336ebd6f86e1ba72be`。
- `R1.patch` SHA `442ab01cdf5a1c275ff077cf39f23ac656d72d09e725f871c3aca749a045836d`：只有同一 harness 的 before→after hunk，未写入 index。
- `R1-after/checks.json` 保存命令原始 argv、exitCode、source/shared-before-after复核。12源在R1检查前后未变，另外11源与原freeze相同，原20项设计/review/共享13源/package/lock全相同。

## I1 改法和真实负例源码

新增测试专属 `PendingConnect`，由同一对象持有 pipe/event/OVERLAPPED、pending latch；复制禁用。constructor 在 I/O 前完成所有可抛工作；成功发起 ERROR_IO_PENDING 后只更新无抛状态并返回。正常 wait 只有 GetOverlappedResult 证实成功或已知 terminal connection error 后才清 pending；超时/启动失败保留 pending，由 destructor 收口。

destructor/close 都按当前请求的 `CancelIoEx(pipe,&operation)` 取消，再最多2000ms等待本事件并读取当前 operation 最终结果。CancelIoEx 本身不被当 completion；ERROR_NOT_FOUND 竞争也仍独立查看最终完成。只有 success 或已知 terminal errors（cancelled/broken/no-data/not-connected）才允许普通 unwind；未观测事件、ERROR_IO_INCOMPLETE 或未知失败则 `ExitProcess(75)`，测试进程自身退出而不销毁仍 pending 的存储。pipe/event/OVERLAPPED 在这个判断前均存活，生产 helper没有故障开关或改动。

`control_gates` 全部改用此 owner：helper create/resume失败、5000ms connection wait失败、后续frame失败、正常owner EOF与正常结束都不能漏掉 connect 所属清理。改变的是测试请求的RAII，不是生产5s/10s预算。

同一 harness 新增两个真实 Windows negative case；外部 `ConnectReceipt` 是仅测试完成见证，不是runtime/DTO字段：

1. 无客户端的私有随机 pipe，20ms orchestration deadline到期；异常展开前取消已发起 pending ConnectNamedPipe，外部 receipt必须证明 `ERROR_OPERATION_ABORTED` completion 已观察。
2. connection 仍 pending时，以新鲜test-owned missing `.exe` 路径造成真实 owned helper creation failure；同样必须在正常 unwind前观察取消完成。仅 catch WinError，unexpected successful creation是测试失败。

这些负例在源码中直接使用 Win32，没有Linux facade、源码文本断言、跳过native或mock API。**尚未在Windows编译/执行，未声称RED/GREEN或crash已复现。** 原根first-loop的Win32缺口仍由原报告单列，修复I1不假定全G1–G8已覆盖。

## M1 保留条件

主控已确认不在缺少 native对照时擅自将允许域缩成ASCII，也不更改批准的literal Unicode合同。本R1保持 TS `toUpperCase()`、portable ASCII fold、Windows `CompareStringOrdinal(TRUE)`原字节；**因此M1没有关闭，也没有一致性PASS。**

未来同 frozen Windows binary 必须比较至少：`ß/SS` expansion、`É/é`、Greek `σ/ς/Σ` 与 single non-ASCII key；保留原始literal键/values、JS判定、Win32 ordinal判定、helper实际accept/refuse以及该平台版本。若结果要求统一允许域/权威规则，需在后续明确契约窗口修复、重新冻结与复审；不能根据本R1 SOURCE检查移除runtime限制/guard A或报告全部Unicode互通。

I1可供原reviewer做限定源码判断；若最终给SOURCE APPROVE，只能携带M1 native evidence条件，不是Windows产品放行。

## 本轮实际检查

`R1-after/check-1.log` 至 `check-6.log` 与 checks.json：

| 实际执行 | 结果 |
| --- | --- |
| 原独立Vitest config，新codec23+build5 | 28/28 PASS、2文件、exit0 |
| 新TS/script scoped eslint | exit0 |
| ES2023/NodeNext/strict/noUncheckedIndexedAccess scoped noEmit | exit0 |
| 原portable protocol/tests g++ C++20/Wall/Wextra/Werror | compile exit0 |
| portable protocol binary | exit0；包含原81字节wire vector；不是harness或Windows Job proof |
| Linux `node scripts/build-agent-job.mjs --tests` | exit1真实平台拒绝；不是nativeFAIL复现或fakePASS |

本轮没有Windows MSVC编译、两个I1负例执行、实际Job/native gate、runtime/server接线或shared/rootbuild。源码仍需独立复审；原正式REQUEST_CHANGES和作者历史FAIL完整保留。
