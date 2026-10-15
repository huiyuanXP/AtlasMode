# POL01 shared callback window — independent frozen source review

日期：2026-10-11 UTC。Reviewer：`/root/pol01_review`，沿用明确指定的 gpt-6.1-sol / high；非本窗口作者，没有 spawn。

**APPROVE（仅本窗口）。Critical 0 / Important 0 / Minor 0。** 未发现需要阻止这五个冻结路径接入稳定候选的缺陷。本结论不代表 POL01 全票完成，也不替代 root 正在独立候选中执行的整体 gates。

## 冻结对象与完整性

VM2 目录：`/home/agent/projects/AtlasMode/docs/reviews/pol01/shared-callback-window-2026-10-11`。审查以该目录的 before/after 为准，不以在途 checkout 为准。完整阅读 author-report、root-rulings、实际差异和必要的现役调用方；只读审查，未运行测试/build/服务，未写产品源码、DB、stage、commit 或 push。

下列输入 SHA 在开始、结束均逐字一致；独立计算验证 before 的全部 43 个文件、after 的全部 5 个文件。局部证据副本保存在本机 `pol01-shared-callback-review-inputs/`。

| 输入 | 开始及结束 SHA-256 |
|---|---|
| after.sha256 | `17d85796c38849a8c13c40834aa1cb12b08663d3489e8a85c0da4a9ae23a4d72` |
| before.sha256 | `d1bc97acf68e741c1cfbad655aa1ff534c25ba1fc556f6f254bbf5c0ddf14e10` |
| window.patch | `c002aa35f41e32ceef1be7e0d08955369e4a5606a1e17508b9881f9558361664` |
| author-report.md | `7f92ffca1e8585274938491898be45d8018111a9055e1c9bfbf0fcb2421eebfc` |

| 冻结 after 路径 | SHA-256 |
|---|---|
| apps/web/src/app/workspace.ts | `77bb9744d2b1e7b70f16679a887c6118a14128701e887a65f098b3e7b8a973c5` |
| apps/web/src/app/Navigation.tsx | `e7e4623080c934f08a187188fb5cdbf631bdf47ea036a49c10bc2ed481b98d45` |
| apps/web/src/app/pol01-policy-sync.test.ts | `f5e450a193a0ef197bacd635a46db609a3421d884cecaead4bf379e0c2eb89b3` |
| tests/e2e/planning.spec.mjs | `153a7087714a89983bb1af9ba23b285b7edc00a27695ffcf849fd1e883c1f0b8` |
| tests/e2e/pol01-structure.spec.ts | `7317521476fd698091977f728ac6ac13116f7caec973ff81c8581aa67822554b` |

## 判定与精确源码证据

1. **实际挂载和只读同步闭合。** `after/apps/web/src/app/Navigation.tsx:175–180` 将实际 PoliciesPanel 接到两个 public 方法；`workspace.ts:2181–2188` 导出这两个方法。`workspace.ts:2050–2055,2092` 的请求只有 policies/plans/summary/currentApproval GET，没有重发写、隐式 retry、重新获取 CAS 后保存或伪造 revision。已批准 `before/apps/web/src/features/structure/policy-controller.ts:154–180` 在 ACK 后先清 request，保留 saved/imported 与 needsReload，再 await callback；callback 失败只进入 WORKSPACE_SYNC_REQUIRED。新增测试最后一个真实 controller 用例确认 retry 后 writes 仍为 1。

2. **捕获上下文和 lease。** `workspace.ts:1980–2016` 校验 project 所属并捕获 workspace ownershipEpoch、focusGeneration、selected plan ID/revision、source snapshot/hash、sync token。`2054,2122` 附近分别在首批读取及强批准读取后核对上下文；A→B→A 即使 project ID 相同也因 epoch 不同拒绝。`2021–2047` 的 quarantine/busy 拒绝发生在 generation/active lease 提交前。`2156–2179` 将错误向上抛出，仅当前 owner 显示错误，finally 只释放自己仍持有的 token，并保留 annotationBusyOwned/mutating。新增同 epoch 晚失败、公开 choosePlan 切换、A→B→A、quarantine 不能抢旧 lease、其他 knowledge owner busy 的确定性用例与真实 RED→GREEN 收据相符。

3. **强 current approval 没有宽 fallback。** `workspace.ts:2091–2120` 使用现役 currentApproval，校验严格 v1 approval、plan/project/revision、baseline snapshot/hash、当前 summary 和列表 approval 一致。只有 `ApiError` 且 status=409、code=NOT_APPROVED 被视为正常未批准；APPROVAL_CONTEXT_INVALID、503/NOT_APPROVED、错误 owner/receipt 都继续 reject。`2122–2143` 拒绝覆盖已有更高列表 revision；未批准 selected 项强制 valid:false。没有用旧 valid:true 或历史批准代替当前批准。

4. **脏计划/CAS、历史和 FS/KN 边界保持。** `workspace.ts:2018–2020` 仅使当前 validity/report 不可信，保留原 plan body/revision/approval。`2147–2154` 在两个 dirty 标记任一个为真或 plan busy 时不 acceptPlan；脏计划用例逐对象检查原 body、capturePlan CAS 与真实服务列表 revision。完整 before/after 差异证实旧 53 个 Workspace 函数未被编辑，只有类型 import、新 callback block 和两个 return 成员新增。client 整文件 `857148…`、KN controller `98c138…` 保留；新方法不写 annotation controller state、不清 executionBlocked/unknown request，现役 annotationExecutionGate 及未知写恢复门保持。source/group draft 不在新 set 中被替换；历史批准和服务端事务实现不在此窗口改动。

5. **fixture 的适配与原断言保持。** 对两个 fixture 的完整 before/after diff 独立核对：planning 四类名称的九个调用、Edit policy 的 legacy 值、两次真实 Read structure again（额外断言只读 revision 不变）与 SDK isError/code/status 的更强负例均对应 root 已授权范围。原 policy +1/+2、规划 +2、禁止依赖、历史 approval、groups、正向审批、导出、restart/持久化、源码验证及无外网断言保留。native fixture 只有完整 view payload 和四处 encoded project URL 谓词；原 HTTP method/status/domain 断言保留。没有新增 skip/retry、扩大 timeout 或修改生产 SDK/MCP 强校验。

6. **三条预期 409 的分类严格。** `planning.spec.mjs:25–62,812–841` 保留所有 raw console，pageerror 从不筛掉；仅收集准确 selected URL 的 GET/409，再要求三条 response JSON 均为 NOT_APPROVED、console 精确 URL/Chromium 文本、数量相等且 errorIndex 唯一，删除前逐条验证原 errors 槽。其余 errors[] 与 MCP stderr 空断言保留，不是忽略全部 409。独立解析保存的 joint-flow-evidence.json 得到恰三条 typed response / 三个唯一 console index，URL 一致、body code 精确，unexpected errors 与 external 都空。root 对原失败 trace ZIP `18850a8f…` 的独立核对另存 `pol01-root-trace-negative-check.md`；本审查不把该旧失败 trace 当最终 PASS。

## 验证证据与限制

本次没有复跑已通过 suite。阅读原始日志确认：source 初始 13 RED，另加 lease 用例出现 13 PASS/1 FAIL，最终当前 source 14 PASS；compiled stdio/真实 SQLite/API 3 PASS；native 编译产物浏览器 policy 2 PASS；原完整 planning flow 最终 1 PASS。`runtime-evidence/planning-browser-typed.txt` 与 `joint-flow-evidence.json` 属于同一最终 typed collector 运行。source-alias unit 的 HTTP transport mock 与真实编译浏览器/stdio 证据已区分，不互相冒充。

作者 scoped 类型检查/ESLint/格式检查通过收据已阅；空日志按 author-report 的明确成功记录解释，未独立重执行。不覆盖首次失败、工具误操作或中间 fixture 的原始日志。整票 combined gates、其他平台/未执行场景及上线状态仍由 root 各自判定，本限定 APPROVE 不作额外完成声明。

结束校验：全部原始输入及 43 before / 5 after SHA 未变化。报告是本审查新增的独立原文，不改作者报告、原审查结论或任何冻结源码。
