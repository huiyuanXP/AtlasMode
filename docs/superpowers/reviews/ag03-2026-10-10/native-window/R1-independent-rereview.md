# AG03 FIRST R1 — 原 I1 独立窄复审

2026-10-11 UTC。原独立 reviewer；模型合约 **gpt-6.1-sol / high**。结论：**APPROVE — FIRST/R1 SOURCE CHECKPOINT ONLY**。**原 I1：ADDRESSED_SOURCE；新增 C0 / I0 / M0；原 M1 仍 OPEN_NATIVE_EVIDENCE_GATE。** 整体未关闭 Minor 数为 M1；此结论不表示 Windows MSVC、两个修复负例或 G1–G8 已通过。

## 输入、范围与独立字节核验

本次只审原 I1 的资源生命周期修复与该改动引入的 breakage。原报告 `ag03-native-window-independent-review.md` 的完整 REQUEST_CHANGES 原文在 R1-before 保存，SHA `3ff1b1eeb03eeb6938f14cd8a725e06413beb46ef64964d84d95ff0c109dd92e`，没有被覆盖。

| 本轮输入 | Bytes | SHA256 |
| --- | ---: | --- |
| R1-after/sourcefreeze.json | 2228 | `04e3dfc293a3cb58ea05ba61f5d1c5e3fad009992dadc4336ebd6f86e1ba72be` |
| R1.patch | 12209 | `442ab01cdf5a1c275ff077cf39f23ac656d72d09e725f871c3aca749a045836d` |
| 作者 R1-report.md / 本地 ag03-native-window-R1-report.md | 5592 | `143f9b2c395039113b9e5e42ffe973cbf74e07d8097914df20f5263cbac8c695` |
| R1 harness | 16103 | `1221e0ba6e2324d71f0c87d32216550431a54aeb04d77cbacae053ba96c774ad` |

提示中的本地 `ag03-native-window-R1-evidence/sourcefreeze.json` 实际位于该目录的 `R1-after/sourcefreeze.json`；已按 SHA 识别正确冻结输入，不是缺失证据。

读取完整 patch、新 harness、R1 report、receipt 与 checks.json。通过指定 SSH 配置只读检查 VM2 ledger `docs/superpowers/reviews/ag03-2026-10-10/native-window/`：

- 12 份当前源码与 12 份 R1-after exact bytes 逐一匹配新 manifest；12 份 R1-before exact bytes 匹配原 manifest。
- 新旧 manifest 差异只有 `apps/server/native/agent-job/tests/job-harness.cpp`；另外 11 源逐项相同。
- 从 before→after exact bytes 独立生成 difflib unified patch，与 R1.patch 完全相同。
- 独立重算原 before-manifest 的 20 项共享/设计/review/package/lock 输入，全部仍匹配原 bytes/SHA。
- VM2 manifest/patch/report/原独立审查 SHA 与本地交付一致。

没有改任何源码、VM2 ledger、实例或 DB，没有读取密钥/private sessions，也没有 spawn、stage/commit/push。仅新增本地复审报告。按任务边界没有重跑 28 项 Vitest 或 portable 整套；作者 checks 的 PASS 为历史收据，未作为我的 Windows 执行结果。

## I1：源码层已修复

以下行号均指 R1 的 `apps/server/native/agent-job/tests/job-harness.cpp`。

| 原 I1 要求 | R1 对应位置与判断 |
| --- | --- |
| pipe/event/OVERLAPPED 同属一个不可随意移动/复制的请求 owner | `:25-29,50-51` 将三者持于 PendingConnect；copy 禁用，用户声明 destructor 也抑制隐式 move。destructor body 先收口，成员后销毁。 |
| constructor 发起 pending 后不能异常离开而绕过该 destructor | `:38-48` 在 ConnectNamedPipe 前完成 pipe/event 创建及 noninherit 可抛操作。ERROR_IO_PENDING 后只设置 bool/外部 receipt 字段，没有分配或其它可抛工作。非 pending 的启动错误可正常释放成员。 |
| 正常连接也须以实际完成为准 | `:53-61` event wait 后查询当前 operation 的 GetOverlappedResult；仅成功或指定 terminal error 清 pending。超时、ERROR_IO_INCOMPLETE、其它失败保持 pending，进入 owner 收口。同步成功与 ERROR_PIPE_CONNECTED 分支没有未完成请求。 |
| 取消不能当成完成；completion 前不得释放存储 | `:63-73` 精确 CancelIoEx(pipe,&operation)，忽略取消请求本身的成功/竞争结果，独立等待 event 并查询 completion。仅成功或白名单 terminal error 调用 observed；ERROR_NOT_FOUND 竞争仍检查实际 completion。 |
| 取消有界，未确认不能普通 unwind | `:68,72` 等待最多 2000ms；未观测事件、ERROR_IO_INCOMPLETE 或未知错误进入 ExitProcess(75)，不会运行 C++ destructor 展开释放仍 pending 的存储。这是测试进程 failclosed，不改变生产预算。 |
| helper 创建失败/连接 wait 超时/正常 owner EOF 全覆盖 | `:110-124` 统一使用同一 owner；helper create/resume 或 wait 异常时仍通过该 owner destructor。owner EOF 通过 close 先收口，再关闭 pipe；其它状态读写使用同一 pipe。 |

原先 pending ConnectNamedPipe 的栈上存储与 event 会在最终完成前普通 unwind 的路径已被消除。该判断符合 [CancelIoEx 的 completion/lifetime 要求](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex) 和 [ConnectNamedPipe 的 pending/已连接语义](https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-connectnamedpipe)。这里是独立源码判断，不声称 Windows 已复现或已 GREEN。

## 两个定向负例与新增 breakage 检查

`pending_connect_failure_gates(:79-97)` 在 `wmain:181` 调用；没有通过 guard refusal 或 missing-helper skip 绕过 native suite。

1. `:80-86` 创建无客户端的 random 私有 pipe，20ms wait 产生 ConnectTimeout；外部 receipt 的声明先于请求 owner，存活到 destructor 之后。断言 pending 已发起，并实际观测 ERROR_OPERATION_ABORTED completion，避免只凭超时认定清理。
2. `:87-96` pending connect 后，用 random missing `.exe` 路径触发真实 OwnedJob 创建失败；仅 catch WinError，若意外创建成功则抛普通 runtime_error 使 gate 失败。再断言 pending 与取消 completion。异常期间原请求存储由 PendingConnect 保持。

复核新增类的 constructor、wait、cancel、close 与外部 receipt 生命周期，以及 control_gates 的句柄替换：未发现该 R1 导致的新 Critical/Important/Minor 缺陷。receipt 仅是测试完成见证，生产 helper、codec、build、DTO、runtime 与公共 guard 没有改变。

**这两个 case 状态为 AUTHORED_UNRUN。** Windows 编译器诊断、CancelIoEx/ConnectNamedPipe 实际完成错误与时序、负例运行及原 harness 回归仍需真实 Windows 执行。源码 checkpoint APPROVE 不把它们计为 PASS。

## M1 与本次不判定的行为

**原 M1 保留 OPEN_NATIVE_EVIDENCE_GATE。** TS `toUpperCase()`、portable ASCII fold 与 Windows CompareStringOrdinal(TRUE) 字节未变；没有证据证明全部 Unicode 环境键互通，也没有修复一致性。按主控决定，不将允许域缩成 ASCII，不改批准的 literal Unicode 合同。

未来 native 对照保留 `ß/SS`、`É/é`、Greek `σ/ς/Σ`、single non-ASCII key 的 literal 键值、JS/Win32 ordinal 判定、helper accept/refuse 与平台版本。若证实差异需修互通，须在后续契约窗口修复、重新冻结与复审；这项成本与条件没有因本次 APPROVE 消失。

本次明确不重新审判以下事项：

- 完整 G1–G8 缺失案例或实际 MSVC/Windows 执行：后续 native gate，非 R1 新增 breakage。
- bridge/owner registry/runtime/probe/gateway/journal/storage/pending UI/package/CI/guard B：本 R1 没有授权这些接线窗口。
- 原其它未变源码的行为、真实 Codex/Claude 安装形式与交互 Ctrl+C：保留原独立报告和 QA02 条件。

## C/I/M、compliance 与最终条件

- **Critical：C0；Important：I0。原 I1 ADDRESSED_SOURCE。**
- **新增 Minor：M0；携带原 M1：OPEN_NATIVE_EVIDENCE_GATE。**
- **Spec compliance / code quality：APPROVE FIRST/R1 SOURCE CHECKPOINT ONLY。** 所属范围、异步存储保持、有界取消与新增真实负例源码满足原 I1 的定向修复要求。

真实 Windows MSVC 编译、这两个负例及原 harness/G1–G8 全部 **UNRUN**。后续必须保留相同冻结 source/binary 的编译/manifest/hash/toolchain/执行证据，missing helper 不得 skip。源码 APPROVE 不授权运行接桥、改 CI、解除 guard 或发行。

**guard A unchanged；Windows 产品未放行；AG03 未 DONE；QA02 未完成。** 本复审没有剩余静态 I1 修复阻塞；M1 与原生执行门继续阻止相应产品完成声明。
