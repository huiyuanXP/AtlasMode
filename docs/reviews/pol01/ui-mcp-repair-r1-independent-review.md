# POL-01 UI/MCP I1/I2/M1 限定独立复审

日期：2026-10-10。原审查者 KN01，明确 gpt-6.1-sol / high。只读 VM2 当前源码、冻结副本、repair diff 与既有原始日志；未修改产品源码、运行测试/build/lint/typecheck、打开 DB、stage/commit 或 spawn。

**结论：APPROVE — C0 / I0 / M0，限定于原 I1/I2/M1 修复。** 原 REQUEST_CHANGES 继续保留。本结论允许此修复窗口继续集成，不代表 POL-01 DONE 或共享 Workspace/浏览器/真实 SQLite 业务闭环验收通过。

## 冻结与历史一致性

VM2 `docs/reviews/pol01/ui-mcp-repair-r1/` 三项 SHA 均与主控给定值一致，复审前后未变：

- handoff.md：`796db18c72ef0ce842393f99993846828f6086b70964dd41e46e43a1acfe4e7e`
- freeze.sha256：`d911b4f935985f0d3ab16bf0651e041d0c23e2917febf78f881ac4f5c3c2e8e6`
- repair.patch：`f7ecae051b8eddc70930b28358153c0120a55a693892d6aeaa3b4eeadb93b684`

九个 live 源路径与新 manifest 及 frozen-source 副本逐字节一致。确实只改四路径：

| 路径 | 新 SHA256 |
|---|---|
| apps/web/src/features/structure/policy-controller.ts | 57b28c5e479b18f6ae96f62a437737c7da55e35ef879d1f178ff34770b25396a |
| apps/web/src/features/structure/policy-controller.test.ts | 9238a7b8cf860d03395032b672f130f4b33ac2b754f66f5895d66cc0dafe0427 |
| apps/web/src/features/structure/StructurePolicyPanel.tsx | 7a377dd1680bfd8f6dd90d091f554179aee2f9136fa8a1f8919abe45217de69a |
| apps/web/src/features/structure/StructurePolicyPanel.test.tsx | 289df0ab4d6e357f461517208c3c9d8dc6c1deba4db17b4b84cc08835622de70 |

其余五个 wrapper/transport/tests/MCP 路径与原冻结 SHA 一致，未重开其实现审查。before/source 的原九文件均与原 manifest 一致；before/archive.sha256 的 **59 个封存文件全部匹配**。原报告当前 repo 副本及 before 副本 SHA 都仍是 `9cfdc483400fdf6692d08a06b257028938832a814a899a2b83263e35c047ac2f`。

## 原问题关闭证据

**I1 已解决。** controller:154–161 将 importLegacy 的 ACK 单独标成 `notice: imported`，不替换或清理未发送的 draft，dirty 保持原值；只有实际 upsert 的确认清 dirty。Panel:175–190 在中英文分别展示导入完成、表单未保存和已确认写入但同步失败，不再用“保存成功”确认未发送的表单。两种 dirty legacy/folder 草稿测试检查 exact draft、dirty、import-only operation 及真实 accepted callback operation，view 测试检查未保存提示并拒绝原 saved 提示。

**I2 已解决。** controller:227–239 保留 pending Request 引用；失败或 quarantine 路径269、338 在完整同 scope 的 state/policies/accepted-read 成功前维持 exact-retry。321–328 才允许在当前 epoch/generation 下终结 replay，不清本地 draft/dirty。edit/choose/save 仍受 request/busy/needsReload 限制。三种 failed reread（state、policies、accepted callback）测试检查旧正文/UUID 精确不变、不能替换 unknown 输入、没有新 request、retry 仍发送原 tuple；quarantine 测试同样保留未知状态。完整接受的显式 reread 测试随后明确选择观察到的已有 policy ID 再编辑，未猜测 ID 或自动重放。

**M1 已解决。** controller:108–109 为每次 submit 捕获 generation token，131/171/180/183 同时检查 epoch 和 token。真实 ACK 后 request 终结、不可 replay，但156 busy=true 保持到异步 accepted callback 收束；finally 只释放当前 token。known ACK 后 sync 失败保留 saved/imported notice 和 WORKSPACE_SYNC_REQUIRED，不伪装未知写结果，也不第二次发布。受控 Promise 测试证明正常 public reload/edit 的 busy barrier；另一个明确标注“强制修改公开 store”的防御测试证明同 epoch 的旧 rejection 不覆盖新 accepted read，未把该强制状态修改冒称自然可用 UI 操作。A→B→A 与 dispose 测试验证旧 callback failure 不发布到新 epoch。

## 原始验证收据实读，未由审查者重跑

- red.txt：原源码上新增10个 scoped 用例，实读 **9 FAIL / 28 PASS**；已有安全的 known-ACK 不重发用例没有虚构为 RED。
- green1.txt：实读 token 初始化之前使用导致 **17 FAIL / 20 PASS / 2 unhandled errors**；原实现失败完整保留。最终源码108先检查 epoch，109再定义 token，已移除此 TDZ。
- green2.txt：受影响两测试文件 **37 PASS**。
- green-final.txt：**5 文件 / 51 PASS**，controller30、Panel11、transport3、MCP3、scope4；原37加新14。其余新增四项（quarantine、完整成功 reread、ABA、dispose）被准确描述为 GREEN 后补充，未冒称原 RED。
- types.txt / lint.txt 为原始零错误输出，handoff 记实际工具 exit0；本报告不称自己执行过这些 gate。实际 npm/node/Vitest/ESLint/Prettier 命令来源于本轮收据，未复用旧 pnpm/biome 错误摘要。
- runtime.json 及 green-final 原输出一致：三组真实 SDK/MCP/owned TCP HTTP fixture 终于关闭，当次 ECONNREFUSED 与后续 worker115981 ESRCH/端口拒绝记录保留。它们采用 in-memory HTTP body，不是业务 SQLite 服务闭环，也不是 mounted UI。

## 仍不在本次裁定内

- 共享 Web Workspace/Panels/client/i18n 的 read/write callback 接线、全局 plans/summary/approval 实际 revision 同步：主控明确另窗授权，本复审不据此重复拒绝局部修复；仍是整票完成阻塞。
- mounted/browser、窄屏视觉、实际文件/SQLite/进程重启闭环：没有本轮执行证据，51 PASS 仅支持 controller/SSR/transport/SDK 协议范围。
- 跨项目返回时恢复旧项目未保存草稿的缓存产品决策：沿用原审查的正式 POL 合同范围，本次只核迟到响应/ABA 不覆盖新 scope，不扩成持久 draft 缓存。
- 既有服务 R1、KN 后端及不变的 MCP/transport 权限：保持原审查通过范围，不扩出新的产品源码修改或完整系统批准。

无新增 Critical/Important/Minor。原三项可关闭；继续由主控安排明确共享窗口和最终产品验收。
