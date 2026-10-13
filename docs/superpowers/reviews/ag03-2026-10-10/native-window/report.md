# AG03 native FIRST window — frozen handoff

2026-10-11 UTC；作者执行模型：原 gpt-6.1-sol high。状态：**首窗口源码/portable 验证冻结，待独立 review；Windows native 编译与运行 UNRUN，AG03 产品未完成，guard A 保留。**

VM2 `/home/agent/projects/AtlasMode` HEAD `0991dbc962981c4aa1b1a13473fce66abd6b8502`。本轮只新增批准的 12 个 native/codec/build/test 文件和本独占 ledger，没有修改 bridge/direct-loop/native/process/gateway/routes/server/index、package/lock/CI、core、共享 dist；没有 stage/commit/push/spawn、安装软件、启动现有实例或读取 auth/密钥/其它进程树。

## 冻结输入与交付

Ledger：`docs/superpowers/reviews/ag03-2026-10-10/native-window/`。

- 最终 `sourcefreeze.json` SHA256 `309270eb5d5c3571b0003d48bf220cb9707349b6beb733ee05cde980f6e55b26`。`sourcefreeze/` 保存所有 12 文件 exact bytes。
- 新增源码 patch `native-source.patch` SHA256 `b327ab59c2dc06ef940161b0502198a6839249f32a268f04f909893cae9cb230`；基于这些路径原本不存在的 HEAD，只有 /dev/null→新增文件，不含任何共享 hunk。未应用到 index。
- `before-manifest.json` / `before/` 保存批准 spec `3a17c125eb89aa4e4f46b569f51331f653fc00401905732f1a25900b5a73186b`、plan `cd4adb3b88294dbc8e5b6c2e6e5fc594e525f00bc8c7ea858cb6369c94c26150`、完整原 REQUEST CHANGES `5ebdaca2642cd7b87f23d519270ec5cae3a01c1a0949fa88dea341eba2528abd`、APPROVE `51f3f65897b44689fbe062ffbeb2f0e6441affc72d78e1b895595101d38581d5` 和 13 个共享源码 exact bytes/hash；当前这 13 个 SHA 与设计历史基线一致。
- `shared-after.json` / `frozen-checks.json`：批准设计、完整 review、13 共享源、package/lock 的 before/after 全相同；最终候选 12 源在全部窄检查前后 SHA 全相同。
- `candidate0-before-ES2023-repair/` 保存首次候选 exact bytes、freeze `d330ec87…`、patch `7306e454…` 和实际 ES2023 noEmit FAIL，未抹去。

独占白名单：

```text
apps/server/native/agent-job/main.cpp
apps/server/native/agent-job/job.cpp
apps/server/native/agent-job/job.h
apps/server/native/agent-job/protocol.cpp
apps/server/native/agent-job/protocol.h
apps/server/native/agent-job/tests/protocol-tests.cpp
apps/server/native/agent-job/tests/job-fixture.cpp
apps/server/native/agent-job/tests/job-harness.cpp
apps/server/src/agent/windows-job-protocol.ts
apps/server/src/agent/windows-job-protocol.test.ts
scripts/build-agent-job.mjs
scripts/build-agent-job.test.ts
```

## 实现与自检范围

自有 C++ Job 类使用创建时 JOB_LIST 原子归属；不存在 AssignProcessToJobObject 后补或 breakaway fallback。private Job KILL_ON_JOB_CLOSE/noninherit，确切三份 std duplicate 放 HANDLE_LIST，TRUE inheritance 与 STARTF_USESTDHANDLES 分别明确。CreateProcess suspended 后先 IsProcessInJob，再 ResumeThread；意外 suspend count 拒绝。目标只接受绝对实际 `.exe` 与 cwd，不用 shell 字符串或 cmd shim。成功继承后 helper 原 stdio 与 temporary duplicate 释放，根/Job/control 持续独立归属。

控制管道采用 overlapped read/write、有限 status queue 和最多 20ms root/control 检查；HELLO 1/version+32-byte nonce，LAUNCH 2/literal UTF8 fields，READY 3/u32 PID，ROOT_EXIT 4/u32 exit code，STOP 5/empty，JOB_EMPTY 6/empty，ERROR 7/u32 reason+u32 Win32 code。帧总长包括 prefix ≤1MiB，status ≤256；args≤256、env pairs≤512、UTF8/UTF16/NUL/case-insensitive duplicate keys/command line≤32767 校验。Node 私有 codec 只定义字节和 manifest schema，没有 runtime 引用、capability 开放或公共 DTO 字段。

同已到达 batch 中 STOP 优先；创建后/Resume 前重新查看 control/owner EOF。不能把该用户态观察描述成外部 pipe 写入与 ResumeThread 的原子事务；真实 race/barrier gate 仍待原生执行。root HANDLE signaled、STOP、owner EOF、setup 5s/runtime 120s deadline 与错误收口同一 latch；Job empty 来自 ActiveProcesses==0，empty 等待≤2s、stop 总预算5s，不按重复 STOP 重置。缺 ack 不提供 verified 给未来 adapter。OVERLAPPED 取消存储在 bounded completion wait 内保留；无法确认 completion 时 helper 自身退出触发 kernel Job close，不能据此假称已确认 ack。生产 helper 没有测试故障开关。

Windows harness 已写：恢复前所属/observer、未恢复 root 的 last-close、exit0/exit1 root-first、嵌套 Job descendant 在根退出后仍持流、outside owned sentinel；实际 helper 控制 pipe HELLO/READY/ROOT_EXIT/JOB_EMPTY、重复 STOP、owner EOF、真实终止 owned helper。只打开本 harness 的已知 PID 来将本 fixture 自己创建的 descendant HANDLE duplicate 给观察者，不扫描 PID 树。descendant observer 在该 descendant Resume 前取得。所有对象为本 harness 创建/持有；finally/RAII 只清理这些对象。**这些源码测试尚未实际运行，不能称 Windows gates PASS。**

独立 build CLI 要求真实 win32/x64 和已激活 MSVC/SDK，拒绝其它平台和假 platform 注入。工具链通过已安装 vswhere 找安装路径，外部可信 build shell 用 VsDevCmd 激活后调用 CLI；脚本本身不安装/下载、不改 package scripts/server build/dev whitelist。`cl.exe` 通过 where 取实际绝对路径，/Bv 报实际 cl version，SDK/tools identity 同日志；flags 为批准 C++20/static CRT/W4/WX/Brepro。sourceDigest 是排序 `[relativePath,fileSha]` JSON 的 SHA，范围固定为生产 helper 5文件+TS protocol+build脚本。构建前后核 sourceDigest；binary+strict manifest 发布到固定 native/bin 目录。该目录当前不存在 native 产物，runtime 的固定路径/完整 hash/reparse 验真仍属未来接桥窗口，当前只提供 manifest shape validator。

Microsoft primary docs 确认 HANDLE_LIST 要求 inheritable handles 和 TRUE、JOB_LIST 的平台下限；nested accounting 包括 child jobs，父 Job 终止覆盖子 Job。文档支持机制选择，不替代本仓库二进制的真实验证：[UpdateProcThreadAttribute](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)、[Nested Jobs](https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs)。

## 实际窄验证与原 FAIL

`frozen-checks.json` 记录完整 argv/退出码/12源 before-after。最终实际执行：

| 命令/证据 | 结果 |
| --- | --- |
| `npx vitest run --config docs/superpowers/reviews/ag03-2026-10-10/native-window/vitest.config.mjs` | 2文件、28/28 PASS；codec23 + build5 |
| scoped eslint 新增两 TS+两 script 文件 | exit0 |
| focused tsc noEmit，真实 ES2023/NodeNext/strict/noUncheckedIndexedAccess | exit0 |
| g++ C++20/Wall/Wextra/Werror 编译独立 portable protocol + tests | exit0 |
| portable binary：UTF8、literal argv、frames/launch budgets | exit0，明确不是 Windows Job gate |
| 同一输入实际 C++ 与 TS encoder 的完整 wire 81字节 | 相同，`cross-language-wire.json` |
| `node scripts/build-agent-job.mjs --tests` 在实际 Linux | **exit1 明确拒绝**；无 skip、binary、manifest 或 fakePASS |

原失败全部保留：`protocol-red.log` 的7个正例未实现 FAIL（23中16拒绝负例在 stub阶段通过，不把其当新增功能证据），`cpp-protocol-red.log` 的 not implemented，`build-red.log` 的5 FAIL；Node PATH 未配置和 Vitest 非法 --include 启动错误分别保留 setup-fail log。首次候选 ES2024 noEmit 虽通过，实际 ES2023 `actual-contract-noEmit.log` **exit2 TS2550 String.isWellFormed**；只改私有 UTF16 检查，原候选和失败保存后，最终按实际契约 GREEN，未放宽 target/lib/timeout。

## 未通过与后续门

1. **Windows native MSVC 编译、binary hash/actual version、Job/pipe/所有 authored harness 案例 UNRUN。** 本机/VM2 为 Linux，没有安装 MSVC、Windows SDK 或 Windows 模拟替代；等待主控独立 high review 后协调 GitHub Windows 原生 gate。独立入口为已激活 x64 VsDevCmd 环境下 `node scripts/build-agent-job.mjs --tests`。缺 helper/toolchain/manifest不会 skip，失败退出。
2. authored harness 当前并未完整覆盖批准 G1–G8：真实 owner process 被终止（区别于 owner EOF）、创建后/Resume前真实 owner crash barrier、detached/breakaway、UTF16 argv/stdin prompt 的实际 executable往返、四并行、READY前取消/坏协议等尚需补足原生证据，不能用本次28测试替代。
3. bridge/runtime ownerregistry、prestart/status/inspect closing/abort/whenIdle、共享10s close预算、configured per-run/probe timeout、stdio drain、gateway已dispatch/journal/storage以及HTTP/MCP/浏览器 gates未接线/未验证。helper当前执行上限是固定120s；更细 per-run/probe期限由未来同预算 owner adapter提供，不把当前裸 helper 当完整 runtime。
4. 现有 guard A 完整保留。真实 Codex/Claude安装形式、`.cmd` unsupported 与交互Ctrl+C仍属 QA02外部缺口。没有 byte-for-byte reproducible 声称；两次同工具链 binary SHA gate未运行。
5. 本交付只是作者自检。源码待独立 high review；没有产品DONE、Windows support available 或生产发布结论。
