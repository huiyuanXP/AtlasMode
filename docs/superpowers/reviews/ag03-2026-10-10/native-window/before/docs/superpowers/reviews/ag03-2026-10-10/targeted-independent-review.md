# AG03 I1/M1 targeted independent design re-review

2026-10-10。原独立 reviewer，明确 gpt-6.1-sol high；非作者。结论：**APPROVE — C0 / I0 / M0**，原 I1/M1 在设计层关闭。本报告不批准产品实施、不表示 Windows native gate 已通过，不解除 Chat guard 或完成 QA02。

## 冻结输入与只读证据

VM2 `/home/agent/projects/AtlasMode`：

| 输入 | Before SHA256 | After SHA256 |
| --- | --- | --- |
| docs/superpowers/specs/2026-10-10-ag03-design.md | 3a17c125eb89aa4e4f46b569f51331f653fc00401905732f1a25900b5a73186b | 3a17c125eb89aa4e4f46b569f51331f653fc00401905732f1a25900b5a73186b |
| docs/superpowers/plans/2026-10-10-ag03.md | cd4adb3b88294dbc8e5b6c2e6e5fc594e525f00bc8c7ea858cb6369c94c26150 | cd4adb3b88294dbc8e5b6c2e6e5fc594e525f00bc8c7ea858cb6369c94c26150 |

读取 rev1 的完整 I1/M1 patch、repair receipt、对应 spec/plan 修订段落及实际 bridge.start/status/close、native cached inspect、status route 原调用链。必要机制依据沿用原审查已读取的 Microsoft primary 文档。本次仅写本地原文报告；未修改 VM2 文档/源码，未 build/test/DB/stage/commit/spawn。

原 spec/plan exact-byte archives SHA 分别 `9a9704ade638a13c398e698394a5407fa92644abaf30fa781d081fccbfe22b06` / `c5a0754f4880e7b848686f645503d4fc7fcd7d20ca3dcf9999629ae827f1d885`；原 REQUEST CHANGES 报告 SHA `5ebdaca2642cd7b87f23d519270ec5cae3a01c1a0949fa88dea341eba2528abd`。原文未覆盖。

`docs/superpowers/reviews/ag03-2026-10-10/rev1-I1-M1-docs.patch` SHA `2add9745c4e1ceb17d6d18a4c07a5e14cdb319711e496b1e90b600718c7a54ae`。以 difflib 从原 exact bytes 到新 spec/plan 计算出的 patch 与该文件完全相同。13 个产品文件重新 SHA256，全部等于作者 repair receipt 的 inputsBefore/inputsAfter，也等于原审查记录的 SHA（明细保留原报告）。这些是只读指纹检查，不是产品测试结果。

## I1：已关闭

Spec 新增“注册运行前的 inspect/probe 所属生命周期”，并贯穿预算、transport、gateway/storage 与 G4；plan Tasks1/3/4/6 给出对应接口和四类真实 Windows gate。

- prestart 在 status await 前、status endpoint 在 runner.status 前、首次 cached inspect 在创建共享 promise 前登记 owner；每个 probe 在 manifest/I/O/pipe/spawn 前同步 reserve lease。多个 waiter 共享实际 inspect，不重新开 probe。
- 同一 registry 的 closing latch/sticky AbortSignal 在所有 awaits 后、下一串行 probe、spawn/Resume 前检查；close 后禁止新 probe、StoredRun、gateway 或 CLI。已 cached 成功 status 不能越过 closing；不因 abort 变更 provider/profile/model/auth 事实或回退配置。
- 已分配 helper 有实际 owned handle 可并行 stop，未分配的 lease 被关闭后不再 spawn；status/prestart 外层 HTTP 可有界 abort，实际底层 raw work 与 leases 仍留在 registry，不能把 Promise.race/empty runs 当真正 idle。
- `whenIdle` 覆盖 prestart、status/共享 inspect、launch leases、runs、gateway dispatch；缺 ack 的 unverified lease quarantine 保持 pending/unavailable，storage 不早 close。callback 在请求可用前登记；一次 finalizer 只在真实 settled+verified 后关闭 storage。
- 共用 server close 10s deadline 从首次关闭开始，重复 close/stop 不重置，不按每 probe 15s 或串行检查次数累计；同时关闭 gateway ingress。四个未来 Windows barrier 分别覆盖独立 status launch/READY 前、chat.start status await、共享 cached inspect、缺 ack quarantine，并保留观察 HANDLE/外部 sentinel、HTTP 有界失败/no-later-spawn/storage 不抢跑断言。

这解决了原实际调用链的缺口：现有 bridge.start 在 runner.status 后才 runs.set，原 close 只遍历 runs。修订明确在该登记点之前建立统一归属，而非仅重复“probe 最终有界”的承诺。待实施时必须证明上述约束，设计 APPROVE 不等于机制已存在。

## M1：已关闭

Spec 原子归属段与 plan Task2 明确写入 `bInheritHandles=TRUE`、`STARTF_USESTDHANDLES`，三个 hStd 字段准确指向 HANDLE_LIST 的对应有效、非 pseudo duplicate。私有 Job/control/observer HANDLE 独立清除 inherit 且不入 list，TRUE 不改变其归属限制；准备/创建失败与成功继承后均明确释放 helper 自己的原始/duplicate 副本。G2/G5 同时检查 stdin prompt/stdout/stderr，不只检查一个流。[UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)、[STARTUPINFOW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/ns-processthreadsapi-startupinfow)

修订保留 JOB_LIST 创建时归属、独占非继承 Job HANDLE、IsProcessInJob/Resume 顺序、ActiveProcesses empty 证明、无全机扫描/提权/自动下载、binary identity 与 x64/exe-only、Gate A/B 条件、真实客户端 QA02 分列等原已审范围。

## 剩余实施门

无新增 C/I/M。需要主控授予精确源码窗口后才能实施；原生 helper 编译、四类 Windows shutdown barrier、root-first/MCP/gateway/SQLite 收据、真实 Chat pending 交互及 clean CI 均仍未执行。缺 ack/raw-work 不 settled 的负例仍只能证明有界诚实 pending，不能报告已清理或提前关闭 storage。guard 保留，产品票不 DONE。
