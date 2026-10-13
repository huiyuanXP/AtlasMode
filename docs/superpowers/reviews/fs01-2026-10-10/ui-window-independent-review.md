# FS-01 second UI window independent source review

结论：**REQUEST_CHANGES — Critical 0 / Important 2 / Minor 0**。

Reviewer `/root/pol01_review`，明确模型 gpt-6.1-sol、high；非 FS 作者。审查对象为 VM2 `/tmp/atlas-fs01-ui-freeze-20261010-1751/after` 的21个冻结文件、对应 before/owned.patch/manifest，以及理解真实调用所需的第一窗口 ownership/function-target/controller、ProjectScope、PlanningPanel/PlanEditor/R1 接口。只读；未修改任何源码、数据库、目标文档或共享文件，未执行测试/build/typecheck/lint/stage/commit/spawn。以下反例是从冻结代码推导的精确可复现路径，**没有宣称本审查运行了浏览器或新增 RED**。

## 冻结身份和前后校验

开始及结束 `sha256sum -c source.sha256` 均21/21 OK。另逐条验证 manifest 的 after 字节长度/hash、每个非null beforeSha256，全部匹配；新文件的 null before 不伪造基线。

| 冻结文件 | 开始 SHA256 | 结束 SHA256 |
| --- | --- | --- |
| manifest.json | `3958da0d78dcf328019bac643ba3016b5ce3b74dc48b1893068396a6f556a900` | `3958da0d78dcf328019bac643ba3016b5ce3b74dc48b1893068396a6f556a900` |
| source.sha256 | `3d5a4b669346a5687894275efb3b50b6dc84ded8029ac909a1fec9dfc0bb304b` | `3d5a4b669346a5687894275efb3b50b6dc84ded8029ac909a1fec9dfc0bb304b` |
| owned.patch | 冻结收据记录 `44153d0f60dbe8d959a3a005d02ede2c399e48dc1cb465d8c1a88ad619a18eab`，已读取对应patch | 独立计算 `44153d0f60dbe8d959a3a005d02ede2c399e48dc1cb465d8c1a88ad619a18eab` |

此次代码冻结完整稳定。repo `docs/superpowers/reviews/fs01-2026-10-10/ui-window.md` 在审查期间合法追加源码 alias 类型检查收据，第一读无此追加、结束版本 SHA256 `29ed0a00f9efaf5f2b934d280d395c360b6adff60adb77c8b2a88f8a9dd2ec69`。这不是新源码 freeze 或新产品浏览器证明。追加 config 的独立计算 SHA256 为 `0d83b41a29cc7b5f3322ea193066ddd8b18ad5de715514b6e1fca7bc2e072b3b`。

以下位置除明确说明既有接口外，均相对冻结 `after/`。

## I1 — 非 saving 预览的过期状态可通过重新选目标复活旧 intent

**Important。** `apps/web/src/features/structure/ownership-session.ts:130–145,190,192–222,323–335`；实际 UI `OwnershipControls.tsx:12–19,49–52`。

`reconcile` 对非saving的失效只设置 `status: expired`（190），没有退休当前intent的generation/nonce；`currentIntent` 只比较当前 tuple、selection、eligible，不检查 terminal expiry。`choose` 只拒绝 saving，因而上下文回到旧值时可把旧 intent 的 expired 状态重新设为 preview（216–221）。confirm 又只要求 currentIntent 与 status=preview，于是旧手势可以保存。

静态可复现序列（使用已有 session fixture 或真实 UI）：

1. ownership mode；为当前函数 A begin，choose合法文件目标，保持预览未保存。
2. 选择 B，reconcile 把预览置 expired；再选回 A，project/plan/revision/snapshot/hash仍完全相同。
3. 不执行新 begin，不取得新nonce，点击 Structure targets 中同一或另一合法目标。当前 Controls 的 disabled 条件不包含 expired，onChoose 直接调用 choose。
4. currentIntent 再次true，choose成功，把旧intent恢复preview；confirm进入retarget/save。dirty true→false 或 groupSelection true→false 的返回也具有同样结构。

这违反“捕获失效后必须重新开始”的生命周期边界，也与过期文案要求 cancel 后重选不符。保存期间 A→B→A 已有 generation 修复，但不能据此判定非saving预览也永久退休。冻结13个 session tests覆盖单向 delta、保存期间迟到ACK；没有覆盖过期后返回再choose。

必要定向修复：expired 状态必须 terminal 到明确 fresh begin/cancel，新 nonce/捕获才能激活新预览；choose/confirm 不能仅靠当前 tuple 再次相等复活旧intent。保留输入供用户理解，不能把遗留 path 变成再次授权。新增非saving selection A→B→A、dirty/group状态返回、旧nonce再drop/choose及fresh begin恢复测试；断言无保存、nonce退休、合法后续操作可用。保留现saving迟ACK、合法semantic ACK和本地输入保护。

## I2 — 新 snapshot 的 intent 能复用旧 snapshot 的 ready target tray

**Important。** `ownership-session.ts:69–87,130–145,160–190,235–267`；既有 `ownership-controller.ts:25–35`；冻结实际调用 `app/workspace.ts:1401–1408,1434–1455,1713–1783`。

target controller 只保证 scope 与它自己发出的 request 的 snapshot/path/kind相符，未证明它仍对应 session 当前 capture。`ownershipTargets` 只检查 ready/request/scope存在，choose/currentIntent 从不比较 tray.request.projectId/snapshotId 或 tray.scope.snapshotId 与 intent.capture。reconcile 在**没有intent/capture**时不处理同project snapshot更换，也没有取消旧tray。

这不仅是可注入任意 context 的单测假设，真实 Workspace 有下列路径：

1. 在 S0 已批准的合法规划进入 ownership mode，加载 S0 ready tray，尚未 begin；可浏览到某文件目标。此时没有capture。
2. 外部源码变动/刷新发布 S1（例如该目标文件现在缺失）。通过现有 verify 操作取新 summary，workspace.ts:1441–1455 会接受S1 summary，旧规划变stale；session mode和S0 tray仍留着，因为无capture/intent。
3. 创建基于当前 S1 的新规划。createPlan 直接把 api.createPlan 的合法新detail交 acceptPlan（1401–1408），没有 choosePlan 那种 plan=undefined阶段；reconcile 的project/plan变化检查只在已有capture时运行。因此已有S0 ready tray继续保留。
4. 选择S1当前真实函数并 fresh begin，获得正确S1新capture。choose S0托盘里的旧Fact文件目标，所有 currentIntent/target membership 检查仍通过；confirm发出S1/r1预条件，服务器可合法保存目标path。

服务器 snapshot CAS保护的是新S1规划/源函数上下文，不能修补目标证据来自S0的问题。已删除目标可继续被当作当前 Fact；同一path现在是否存在、kind/identity是否变化没有新scope证明。合法 planned path仍应可以选择，但必须如实标planned并来自本次current target规则，而不能用旧Fact清单绕过捕获快照要求。

必要定向修复：无intent时也要在project/snapshot代次变化退休旧tray及pending request；begin/choose/confirm入口对当前target proof与capture做硬比较，不能只依赖DOM disabled。旧S0 response即便与旧request自身相符也不能发布为当前S1可选择目标；只接受重新获取的S1scope。新增空闲ownership模式下 S0→S1、新合法plan创建、旧target拒绝、新scope成功以及晚S0response测试；保持snapshot/hash/revision保存条件、100预算、不发无界查询。

## 其余已核对行为

- 默认 layout，explicit ownership才开启 native HTML draggable。Canvas `CodeCard:58–75` / folded group endpoint `GroupCard.tsx:79–100` 写 local nonce MIME并保留函数真实domain ID；ownership mode禁止ReactFlow布局drag save，默认 `onNodeDragStop` 仍只保存visual position。未知member、group header不能成为函数source；GRP projection membership/raw relation/evidence未改，alias仍同真函数。漏斗offset/分页和map主体没有被此patch重写，必须保留后续真实产品回归门禁。
- `completeTargetPath` 使用第一窗口严格canonical path与单文件名/源码扩展检查；文件目标完整路径、目录初始无filename、显式完成后才save。temporary source以真正当前Plan addition ID识别；retargetFunction继续同函数coalesce，保留其它operations，no-op引用相同时不写server/history。实体源filePath保持physical；projection/overview/planned scope使用最后effective path，不改CodeNode真实归属。
- frozen workspace capture 包含project/plan/revision/snapshotID/hash；`savePlanCaptured` 发送 expectedRevision/expectedSnapshotId，并在请求前与ACK时校验当前capture、server identity/revision+1/baseline。真实SQLite/HTTP预条件fixture仅增加必要MemoryStructureFiles依赖，原7断言未削弱。实际源码writer不存在，FS只写Plan/View。
- savePlan合法server ACK提交plan/history；更晚独立selection使 canFocus=false，不恢复旧camera/funnel。focus/select/expand同一次操作共享sequence，后续selection/project作用域使旧source/context/focus结果退休。ProjectScope的epoch处理项目A→B→A；saving preview额外generation已处理其迟ACK回到A，但I1是另一入口。
- source读取先按真实function/file ID请求context，snapshot/hash/focus-generation在source dispatch前、应用前校验，physical路径与返回source路径相等；临时函数不可读，不能请求planned destination作为fallback。文案明确current live disk bytes，不虚称历史snapshot内容/哈希匹配。
- overview/advanced共用app.approve；其函数级gate拒dirtyPlanEditor与任何pending ownership intent。新Panels传R1 dirty回调、captured save，不改已批准R1的metadata generation/legacy Forms协议；raw本地dirty输入不被新server ACK自动丢弃。source级保护不替代未运行的整个应用交互证明。

## 实际已有验证证据与剩余门禁

读取 `ui-window-source-evidence/` 原日志：first scoped57/60、3 FAIL保留；affected3/3；final66/66、8files PASS；saving A→B→A独立 RED（true误清预览）与修复13/13 GREEN均保留；owned lint收据exit0。没有把原组件browser14 PASS当整个production应用通过。

标准当前web noEmit原始 `ui-typecheck-final.log` 仍为 TS2305 `@codemap/core` 缺 AnnotationContent 的FAIL；审查期间追加的source-only alias noEmit收据为exit0，其config只映射core真实public source/扩rootDir和node typeRoots，并未生成/替换shared dist。新源码alias PASS不覆盖原compiled失败；主控stableisolatedbuild/types门禁仍需完成。

`tests/e2e/ownership.spec.ts:81–101` 是page.mouse move/down/move/up真实pointer路径；132–153的init script只是被动记录原生 drag事件，不构造DragEvent/DataTransfer、不修改app store。fixture使用mkdtemp自有source/SQLite、HTTP、sourcebytehash/无执行marker、server PID/nonce/root/data/start/stop与exact root cleanup收据。源码上具备真实NativeHTML浏览器验收意图；`ui-browser-list.log`只证明6tests可列出，**六个compiled browser tests仍UNRUN**，不提供实际drag、截图、restart或清理完成证据。

原报告结论保留：需先修I1/I2并freeze定向来源/RED→GREEN，再独立限定复审。此后仍需主控stableisolatedcompiledbuild/typecheck、六个真实鼠标案例及既有funnel/layout/map/GRP回归、source invariants/cleanup/截图收据。FS-01当前不能标DONE；本报告不授权实现或接线后续共享窗口。
