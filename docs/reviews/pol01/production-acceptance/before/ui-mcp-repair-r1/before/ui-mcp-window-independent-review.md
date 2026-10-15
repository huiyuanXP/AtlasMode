# POL-01 UI/MCP 九文件独立源码审查

日期：2026-10-10。审查者：KN01，明确模型 gpt-6.1-sol / high。本审查未编写这九个 POL 文件；只读 VM2 checkout，未修改源码、运行测试/build/lint/typecheck、打开数据库、stage/commit 或 spawn。结论来自源码控制流及已有原始收据的只读核查，以下触发序列没有冒称为新执行的 RED。

**结论：REQUEST_CHANGES — C0 / I2 / M1。** 两项 Important 均限定在 controller 的本地草稿与未知结果处理，不重开已独立通过的 POL 服务 R1，也不把尚未接线的共享 Workspace 同步算作当前窗口缺陷。

## 范围与一致性

九个源文件及其精确 frozen-source 副本在审查前后全部匹配 manifest：

| 文件 | SHA256 |
|---|---|
| apps/web/src/features/structure/PoliciesPanel.tsx | 7f25a6aefe4dc01b60e3995d003dc73e2e137b87fe3fe4aa142291541c31fca5 |
| apps/web/src/features/structure/policy-controller.ts | b8c611289f37f6da95254b51bcb1ad3a5a94b7a0b3ce12f6a985ce832f393428 |
| apps/web/src/features/structure/policy-controller.test.ts | 642e55fcf263eb8f3208682348bb5af06876313341fecacde9c378f9b973b9f7 |
| apps/web/src/features/structure/StructurePolicyPanel.tsx | ac3bf71a6e0d774948156d2b24289c13fe3208e471b6aa99cb0ba0c185fec87b |
| apps/web/src/features/structure/StructurePolicyPanel.test.tsx | 296abb33412e847d86cb8d971aea4a85d9e577ec0730c1a233c8c0591f5b3857 |
| apps/web/src/api/structure-client.ts | 81e003af17b21a0f7a3b573acb8b747dd5d9022729b6283f747ef232f66cb1b8 |
| apps/web/src/api/structure-client.test.ts | daa1f25d04c8bfa105b45baf92b66200196214592460518c96227100b94276a8 |
| apps/mcp/src/server.ts | 2039168ec634179df6350c3f083adf4bd6640338ba09b8c78799004317f59b04 |
| apps/mcp/src/structure.test.ts | 1a51e975af1d749787cd2c22c8fd26bafd59566ead48d8684b85e038b9ed6b02 |

VM2 `docs/reviews/pol01/ui-mcp-window/`：handoff SHA `2141054211333804558a5e3d0bc36d7da7405e891a09f5b241468e111cc5fa6d`；freeze SHA `f789c7e4574e38335fe6b75d29b560990cae49c13a0b4278ca50a610eef934e5`；window.patch SHA `0067dd9bd4823d55efe56859519557b9e8b63a1f256bb6f11df33c2b5cf079c0`。审前、审后原值一致，源码与冻结源副本逐字节一致。

已读全部九文件、两个既有文件的窄 patch、新 schema/transport 的直接依赖合同、正式 POL spec/UI 条款、对应 tests、37 PASS 原始输出、最终 no-error types/lint 收据、真实 SDK/TCP runtime 关闭收据、实际 commands-used/config 和 historical-command-correction。补读 MCP scope 的四个既有测试以核其限定权限证据。

## 已核通过的局部行为

- 初始 readState 的 revision/digest 必须有效，随后 policies envelope 必须与该 capture 的 revision/digest/status 一致且所有 policy 属于所选项目；capture 不从提交前的隐藏 latest-read 补取。写入携带捕获的 UUID/revision/digest，内容由具体 operation 构造，不提交整个 schema document。
- 同 ID DB-only 编辑走既有 POST policies；folder 编辑只发 path/purpose/previousPath。源码/时间/audit/projectId 不被 UI 作为客户端元数据写入；实际 audit source 仍由现有严格 backend/use-case 决定。DB-only 与 file extension 显示来自真实 document 的身份，描述字段作为转义文本展示，不伪称机器检查通过。
- 409 保留 path/purpose/forbidden、dirty 及旧 capture，需明确重新读取再手动 save；同项目 reload 保留文本。普通网络失败保留原 immutable Request 并阻止 edit，retry 原 UUID/正文。两项 Important 是这些路径的特定遗漏。
- epoch/generation 防止迟到读污染 A→B→A 的新选择；写 ACK 在 current epoch 不匹配时不进入 accepted callback。dispose 同样使旧操作无效；read accepted callback 期间 busy 保持且末尾复核 generation。共享 owner 仍必须用自己的 selection epoch，不能把新建 controller 的 epoch 当作全局身份。
- 保存 ACK 保留真实 policy ID、folder 改名后的 previousPath；再次保存前要求显式读取。missing 使用实际 null digest，invalid/conflict/recovery/unavailable 不取得可写 capture。
- MCP 只改变既有 get_folder_policies/get_approved_plan handler 和说明；工具名、18 个 scoped 工具、allowlist、readOnlyHints 与写入权限保持。get_approved_plan 先复用 ownedPlan 项目所有者检查，然后请求真实 `/api/plans/:id/approved` 强 guard，无 refresh→释放→缓存读取，也无失败后 fallback。get_folder_policies 从真实 includeStructure envelope 保留分页及 revision/digest/time/status；错误上抛。无策略写/批准工具扩权。

## Critical

无。

## Important

### I1：导入 ACK 清除了没有被发送或保存的表单 dirty 状态

位置：`apps/web/src/features/structure/policy-controller.ts:154`–160（尤其157）；同文件434–448，以及 `StructurePolicyPanel.tsx:163`–166。

可由源码确定的触发序列：reload → 选择现有 policy/folder → edit purpose/path/forbidden，使 dirty=true → previewLegacy → importLegacy 成功。import 的请求 operation 只有 `{kind:"importLegacy"}`，完全未包含表单的修改；submit 的 ACK 分支没有替换这份 draft，却对所有操作统一设置 `dirty:false`、`notice:"saved"`。于是仍未提交的表单文本被呈现为“已保存”，丢失它尚未获 ACK 的状态。这不是已经接上的全局刷新问题，而是本地 controller 已存在的假确认。之后依 dirty 决定保留/同步的 owner 也会接收错误状态。

修复：区分 import 的确认与 draft-save 的确认。import 只清自己已确认的 request/preview，保留原 draft 和 dirty；可用独立的“导入已完成，表单修改尚未保存” notice。仅实际包含并确认这份 draft 的 upsert 操作清 dirty。请求未知、重试、失败仍必须保留草稿。不要通过禁止所有 dirty 期间的预览来悄悄丢掉编辑/迁移流程。

需要定向测试：dirty legacy 与 dirty folder 两个输入 → preview/import 成功，断言 exact draft/dirty 保留、发出的 import 不包含文本、notice 不表示该表单已保存、accepted callback 收到实际 import operation。原 migration 测试只在空表单状态导入，未覆盖此路径。

### I2：未知写结果后的 reread 失败会丢掉唯一可精确重试的 request

位置：`apps/web/src/features/structure/policy-controller.ts:224`–235（尤其229）；319–326；409–413。

可由源码确定的触发序列：发新 policy save → 服务可能已经提交但 ACK 丢失、transport reject → submit 保留 Request(mutationId/input) 且 retryAvailable=true → 用户点击明确“重新读取” → reload 在任何真实读取/accepted-read 成功之前就 `request=undefined` 和 retryAvailable=false → readState/readPolicies 网络失败或 read accepted callback 失败 → catch 不恢复 Request/unknown 状态。原 exact retry 从此无操作，表单编辑也重新允许，但先前写入是否生效仍未知。后续一次成功 reread 后的新 save 会生成新 UUID；对于没有收到 ID 的新 policy，现有 Workspace.savePolicy 由 projectId+mutationId 生成 ID，可因此产生第二条策略，而原 mutation 本可以安全幂等重试。

修复：尝试 reread 时暂存尚未确认的 immutable Request，直到完整、同 scope 的成功 read/accepted-read（以及约定的显式解决动作）再终结它。读取失败应恢复/保留未知 outcome 与原 mutationId/input、exact-retry 入口和 edit 阻止；不要以“开始读取”当作已解决未知写结果。已确定409的读后重试行为保持不变，无自动 rebase/retry。

需要定向测试：unknown save → reread 的 readState 失败、readPolicies 失败、accepted-read 失败各一例；旧正文/UUID 不变，edit 不得修改 uncertain request，retry 仍送原 tuple，且新 policy 不得因读取失败而改用新 UUID。已有网络测试仅验证不经过 reread 的直接 retry，因此37 PASS不覆盖该缺口。

## Minor

### M1：写 accepted callback 还在等待时已解除 busy，同 epoch 的旧回调失败可覆盖新读状态

位置：`apps/web/src/features/structure/policy-controller.ts:155`、163–170；`PoliciesPanel.tsx:83`–93。

write 的真实 HTTP ACK 到达后先 busy=false，再 await onAccepted。与 read accepted callback 的保持 busy 形成不一致。此时可启动新的同项目 reload 并完成 onReadAccepted；若原 write callback 后来 reject，catch 只检查 epoch、不检查 generation/操作身份，仍把 WORKSPACE_SYNC_REQUIRED 写到更新后的状态。新 callback seams 明确允许 Promise，所以这是局部 API 可触达的状态竞争；共享全局 callback 当前未接，故按 Minor 而非把未来 stale plan 风险升级成本轮 Important。

建议：保持 busy 到该 accepted callback 收束；或者给 callback completion 独立 generation/token，使旧失败不能覆盖已经接受的新 read/edit。用可控 Promise 验证 callback busy barrier、后续读完成后旧 callback reject，以及 A→B→A/dispose 隔离；不靠 setTimeout 证明时序。

## 证据边界与未裁定项

- 共享 Web Workspace/Panels/client/i18n 的 read/write callback 接线及真实 plan revision/approval 刷新：已由主控明确延期，handoff 也列 pending，本审查不把缺少全局接线重复当缺陷。它仍是整票完成的真实阻塞。
- mounted/browser、窄窗口视觉、真实服务 SQLite/disk 与进程重启闭环：本窗口没有这些执行证据，37 的 controller/SSR/transport 与 MCP 实际 SDK/TCP 只支持所述局部协议。没有把 in-memory HTTP fixture当成真实业务服务。
- 任意离开项目时缓存并恢复旧项目未保存草稿：POL 正式条款约束同项目冲突/重新读取保留文本与迟到响应隔离，当前选择明确新建/reset controller。本审查验证 A→B→A 不被旧 ACK 改写；不额外引入持久跨项目 draft cache 产品决策。若主控“dirty 保留”另指返回项目必须恢复旧草稿，应在共享接线前明确该合同，不能由本审查悄悄删掉要求。
- get_folder_policies 的 indexed snapshotId 来自第二个 summary read，属于另一个已标识的观察；本票已要求结构 metadata 同 envelope并满足，当前没有把该字段当批准执行授权。本审查不增加跨两个 HTTP 请求的原子全量快照要求。
- 已独立通过的服务 R1、KN 后端与其他共享文件不重审为本窗口 owned 源码；仅读取必要协议以判断适配器是否正确调用。

## 原始执行与历史摘要修正

`green-frozen.txt` 实读5文件/37 PASS（controller18、view/SSR9、transport3、MCP3、scope4），是作者已执行证据，审查者未重跑。最终 types/lint 文件无错误输出，handoff/commands-used 记录原工具退出0；不虚构本审查执行退出。runtime 明确三组 SDK/MCP/HTTP终于关闭、当次 ECONNREFUSED及后续 ESRCH/端口拒绝，fixture 为 in-memory HTTP body，无 DB。

已读 historical-command-correction：原 R1 摘要 pnpm/biome 错误被承认，实际工具是 npm/npx/Vitest/ESLint/Prettier；原106 PASS日志保留，原 shell string 没有在 stdout 中持久化，列出的等价复现明确 reconstructed。本报告不把重建字符串改称原 shell，也不冒称重跑106项。

完成 I1/I2 的定向修复与真实 RED→GREEN 后，保持其余通过行为和原九文件封存证据，给限定高复审即可。M1可一并修复。当前不批准本窗口进入最终合并/整票DONE。
