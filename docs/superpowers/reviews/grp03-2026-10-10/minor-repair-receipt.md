# GRP-03 两项 Minor 文档修订收据

时间：2026-10-10T17:24:53.343212+00:00。作者 `/root/grp01_design/grp01_implement`，显式 gpt-6.1-sol high。主控仅授权修设计两 Minor、原字节冻结归档与新 SHA 收据；没有产品窗口。

## 原始冻结与独立报告

- 原 spec SHA256 `6c41004d26b98490a9ee9feeccf8c6d0f9adbd92f0aa4320973fa68e585645dd`，逐字节副本 `rev0-frozen/2026-10-10-grp03-design.md`。
- 原 plan SHA256 `b8651cb3c9430beab56c7a27254df4785661db0586142ffa83db5358a2321a10`，逐字节副本 `rev0-frozen/2026-10-10-grp03.md`。
- 原独立 review APPROVE C0/I0/M2，`independent-design-review.md` SHA256 `15fc8ca9bec752fddc1e79da87330f34789e23bb9a3413fe1b8c55f1d0c4e9fd` 保持不变；没有将原批准结论冒用于新字节的独立复审。

## 精确修订

M1：Task4 明确新增 graph/focus.ts 单 case 窄窗口和新 focus.test.ts。group_contract 在 affectedNodeIds 返回 []；合同单独变更不传 undefined/groupId/contractId 到 CodeNode API，不把200成员自动聚焦/拉图；同组合中 add_function/must_reuse 仍各自处理真实端点。spec、Files、Interface、RED 场景和运行命令对齐。

M2：删除 planned entry 留下的失效合同只保留未提交预览/draft，显示 INVALID_TARGET、阻止保存并以 pending 阻止 UI 批准旧服务端版本；取消无写，用户明确合并删除入口与合同后一次 CAS 保存。Planning.update 对最终操作集中 group_contract 的错误拒绝（包括未变合同引用本次删掉入口），Plan/revision/history 不变；仅限新 group_contract 类型，旧一般 invalid draft 兼容不变。Task2 服务/SQLite RED、Task3 删除预览、Task4 pending/API与Task6真实UI对齐。

## 修订后 SHA

- `docs/superpowers/specs/2026-10-10-grp03-design.md`：`7f23f957319d78f8bccb22e84f1167789e5b6be119df308f702cd3d252c7505c`。
- `docs/superpowers/plans/2026-10-10-grp03.md`：`eb987123c1bd4060345830834ee9f65ad4acf0414dcbd9ae4c4ea080afb863bb`。

自审：复核修订锚点唯一、两份原文件归档字节与原 SHA 一致、原 review SHA 不变；未更改票/state/README/AGENTS/product/tests/index，未运行 build/test/browser，未 stage/commit/push/spawn。此收据是文档修订自审，不是产品 gate 或新的独立审查。后续产品窗口仍由主控协调。
