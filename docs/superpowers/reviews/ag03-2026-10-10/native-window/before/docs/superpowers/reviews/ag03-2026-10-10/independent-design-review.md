# AG03 independent design review

日期：2026-10-10。Reviewer：独立 gpt-6.1-sol high；非 AG03 作者。结论：**REQUEST CHANGES — C0 / I1 / M1**。

只读审查冻结 spec/plan、实际票据、13 个产品基线和作者原始 receipt；未修改 VM2 文档/源码，未 build/test/DB/stage/commit/spawn。结论是设计审查，不是 Windows 清理验证，不关闭 AG03/QA02。

## 冻结输入与精确前后核对

VM2 checkout `/home/agent/projects/AtlasMode`：

- `docs/superpowers/specs/2026-10-10-ag03-design.md` SHA256 `9a9704ade638a13c398e698394a5407fa92644abaf30fa781d081fccbfe22b06`
- `docs/superpowers/plans/2026-10-10-ag03.md` SHA256 `c5a0754f4880e7b848686f645503d4fc7fcd7d20ca3dcf9999629ae827f1d885`
- 作者证据：`docs/superpowers/reviews/ag03-2026-10-10/design-readonly-receipt.json`。

审查开始核对 spec/plan SHA 与委派值一致；结束重新 SHA256 全部 13 个产品文件，与作者 inputsBefore 和 inputsAfter 均完全相同。精确 SHA 如下（前后相同）：

| 文件 | SHA256 |
| --- | --- |
| apps/server/src/agent/process.ts | 34592ff12a90b75b900796f89fff7b7a1979630939d38275bea9860405a91eb0 |
| apps/server/src/agent/native.ts | 9051c19aad5f2f24f63511dcc91f57a8ca7991ed79f7623654402ff21636052d |
| apps/server/src/agent/gateway.ts | 59541d6bef5723be82f7f72d0ed5c95604020c18e10a083630fef151847fb80c |
| apps/server/src/agent/bridge.ts | 6fe21a3b7c687bf3f97ad8f599ff9f8e6a220dbe3b3877f7f1c68ab898a5d68d |
| apps/server/src/agent/types.ts | 5addb74004bf7a351788593e02e8036cf980144026ae1bb9838329d8edf28125 |
| apps/server/src/agent/routes.ts | 9f5ac0f102dc3b932b6b3eaf5b3df351b153392a36e6292d51c48859cdbd1df6 |
| apps/server/src/server.ts | 5b1132a2fda456a079fd629076cf3a50e2d040c988603ec1e5c96b34b595d4ec |
| apps/server/src/index.ts | 7599bc60f8ff0226c754de975c24fa5a5df584a749cf38d46336c23c399768be |
| scripts/dev.mjs | 056a5e1ee7900760a1935c1e39f9a8d30687d75d9578a1b57e29f962ae9d8585 |
| .github/workflows/ci.yml | a982c07858397e4a55881503748fea499ee34a00d7fa8102a33c6b5844722095 |
| apps/server/package.json | aa83873de5cfde8f78fedeefb106eaa3249ba1cc02dc7b5415b77b422a02f540 |
| apps/web/src/features/chat/controller.ts | 41cea4f9167bdaa602dd8e2d065dab64c4af415a6512f1cd7d2311b4c20f34bf |
| apps/web/src/features/chat/strings.ts | ba3e07357a1172ec19270d3be487b76a81b5ab298b5c6a76beb6072472846a8a |

13 个文件进行了与机制/生命周期相称的实现读取。gateway 的实际 journaling 位于 app.inject 成功之后、res delivery 之前；close 无界等待 inFlight，bridge 当前 finally 再 terminal。index 的 finally 立即关闭 storage。native 有缓存 inspect 和串行 probes，process/native 三处 Windows refusal 均还在。dev 只允许精确纯 tsc prerequisite，当前 CI native matrix 是三平台全根 build/checks。上述设计基线陈述匹配实现。

## I1 — close/whenIdle 未覆盖尚未登记 run 的 inspect/probe

**位置：** spec:55、61、69；plan Task3:72–77、Task4:84–90。实际 `agent/bridge.ts:260–291`、`agent/routes.ts:25–28`、`agent/native.ts:199–200`、`233`/features/login 串行 probe，以及 `bridge.close()` 尾部只遍历 runs。

现有 start 先建立 `session.active`，随后 await `runner.status()`，之后才创建 StoredRun 并 `runs.set`；独立 `/api/agent/status` 也直接调用 bridge.status/runner.status。这两条路径在能力探测期间没有可供 close 遍历的 run.handle。拟议设计为 probes 提供 owned transport，却只把 close/whenIdle 的归属明确到 active runs 和已派发 gateway work，未定义尚未登记的 inspect/probe 的 shutdown owner、停止入口或 closing latch。

**具体触发：** 阶段 B 原生支持接线后，从 `/api/agent/status` 或 chat.start 进入 help probe，fixture 根/后代持 stdio，再调用 server.close。此时 runs 可能为空；若沿当前流程只 close 已登记 runs，当前 probe 可走完整 setup5s+execute5s+stop5s，随后 cached inspect 还可能继续 features/login。完整主 HTTP 请求又被现 server 生命周期保留，Fastify app.close 可能等待更久。不能据“单个 probe 最终有界”推导 close 总10s，或宣称已停止所有本 server 的 owned helper。

这是从实际生命周期与方案接口推导的缺口，未运行失败重现。当前 unconditional Windows guard 使 native 正常路径尚不启动，不能称当前 Windows 已泄漏；问题作用于拟议 guard 接线后的机制。

**定向修复：** 明确内部 runner/transport lifecycle 在 spawn 之前登记全部 owned launches，包括 status/inspect 的 in-flight probe 和尚未建立 StoredRun 的 start；同一个 closing latch 禁止新探测和后续串行 probe，close 并行停止已有 probes。可以增加 trusted 内部 close/abort/lifecycle 接口，保持 HTTP ChatRun 与原 RunningAgent DTO 不变。`whenIdle` 与主 server shutdown 必须明确包括这些工作，settled:false/unverified 时遵循已有诚实失败与 storage 保护契约，不能伪装当前 run 收口已全部结束。

**必须补设计中的 RED/真 Windows gate：** 1) status endpoint 在 probe launch/READY 前关闭 server；2) chat.start 在 status await 时关闭；3) 已有 cached inspect 被多个请求共享时关闭，后续 probe 不再启动；4) helper/probe 缺 ack 时 bounded unverified；5) unrelated sentinel 保活、所持 owned process HANDLE signaled，close 响应预算不按 probe 数串行增长。原 guard Gate A/B 不提前解除。

## M1 — 将标准句柄所需 Win32 参数写进 Task2

**位置：** spec:35–37、plan Task2 的接口/实现步骤。

设计正确要求 HANDLE_LIST 只含三份 inheritable stdio，但没有明确 `bInheritHandles=TRUE`、`STARTUPINFOEXW.StartupInfo.dwFlags |= STARTF_USESTDHANDLES` 与其 `hStdInput/hStdOutput/hStdError` 必须指向那三份 duplicate。HANDLE_LIST 限定继承集合并不自动设置标准流字段。Microsoft 对这些条件有明确要求；少写任一项会导致 prompt/stdio 错接，尤其是 NO_WINDOW 的 headless fixture。[UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)、[STARTUPINFOW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/ns-processthreadsapi-startupinfow)

请补准确参数、有效 HANDLE 校验以及失败路径的每份原始/duplicate 所属释放。现有 G2/G5 真 stdio gate 足以发现该实现错误，故列 Minor；不要求增加新平台或权限。

## 已确认合理的设计边界

- JOB_LIST 创建时归属、CREATE_SUSPENDED 后 IsProcessInJob 再 Resume 的方案与平台下限一致；它避免设计明确禁止的“创建后再单独 Assign”空窗。HANDLE_LIST 要求目标标准 HANDLE 显式可继承、控制/Job HANDLE 不可继承。[UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)
- 独占 unnamed Job 非继承句柄、KILL_ON_JOB_CLOSE 与 nested Job 清理合理；标准 CreateProcess 后代默认归属，外部服务创建的进程不受此保证，文档已诚实限制。[Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)、[Nested Jobs](https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs)
- 用实际 accounting ActiveProcesses 确认 empty，根 exit/stdio EOF/completion-port 消息不能替代；helper 意外死亡缺 ack 仍 unverified，并不冒充“内核可能清完”即产品 verified。[Job accounting](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_accounting_information)
- 仓库自有 source+显式 build-native+严格 binary/source manifest，x64/exe-only/.cmd 拒绝、无自动安装与全机 kill；现 server build/dev 白名单保留。runtime identity 不是签名或恶意同权限防护，设计说明正确。
- gateway stop ingress 与 service dispatch 分开；5s drain 不完成维持 running/active/mayHaveSavedChanges，whenSettled 后记录真实 journal，storage 不提前关闭。有限响应与任意 service 业务终结期限不混淆，DTO 不新造状态。
- Gate A 不通过 public guard 绕过条件，真实 native fixture 必须执行；Gate B 需主控授权后重跑实际 Windows MCP→HTTP/SQLite。Linux/mock/build 不能替代 Windows 机制，Codex/Claude 安装形态、交互 Ctrl+C 与历史 SIGKILL 因果仍留 QA02。

## 交付与剩余阻断

REQUEST CHANGES 只要求上述 I1/M1 的设计/计划窄修及原 reviewer 复核；不要求现在实施或运行 native tests。源/文档原冻结保持不变。当前无 Windows mechanism PASS、无 guard-removal授权、无 QA02 完成声明。原报告保留本地 ROG，不覆写作者 spec/plan 或 root 状态。
