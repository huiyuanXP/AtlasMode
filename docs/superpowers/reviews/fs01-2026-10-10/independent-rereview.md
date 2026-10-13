# FS-01 限定独立复审

2026-10-10 UTC。仅原 I1/I2/M1，结论：**APPROVED；原三项在设计层关闭，本次 Critical 0 / Important 0 / Minor 0。** 可按主任务授予的共享产品窗口进入实施；本报告不授权产品写入，不代表产品测试通过。

原报告仍为 Issues Found / C0/I2/M1，未修改历史。VM2保留副本 `docs/superpowers/reviews/fs01-2026-10-10/initial-independent-design-review.md` 的SHA256为 `59a777e1dc22d03fb592da32c9c0427b2a7b5313c6f9307afcd6a5b71d8141aa`。

I1关闭。spec66/70–76明确new ownership及advanced target-path save必须带captured expectedRevision+expectedSnapshotId；legacy omission兼容明确不承诺snapshot race拒绝。Planning.update既有同步transaction内重读current plan/current.projectId对应权威snapshot，校验snapshot id以及plan baseline id/contentHash，再parse/put/return detail；不接受preflight检查、cached summary、另一个ownership queue、await gap。plan60–64规定actual SQLite、barrier Indexer、production refresh publication的两种commit顺序与HTTP/client/browser测试，以及stale baseline/foreign/invalid/legacy/rollback。

独立核对真实可行性：现役 `WorkspaceService` 构造传给 `Planning` 的storage和snapshot resolver来自同一实例（workspace.ts36–43）；getSnapshot重读projects record再读相应snapshot并查project归属（72–79）；storeSnapshot在storage.transaction同步发布snapshot record和project.snapshotId（187–203）；Planning.update当前也是同一storage.transaction同步check/put/get（planning.ts146–162）；SqliteStorage.transaction使用better-sqlite3同步transaction并拒绝async callback/thenable（sqlite.ts69–95）。因此无需新项目锁即可在单server/connection里线性化snapshot检查与put：S1 publication先commit则S0失败；S0 update先commit则该刻合法，之后S1才使其stale。spec74/76正确限定unindexed live disk与scan开始不算publication，以及未来公共coordinator改变边界必须复审。设计没有虚称两个独立事务为一个跨流程事务。

I2关闭。spec56/62/64强制共享planning/function-target.ts effectiveFunctionPath/retargetFunction，所有advanced PlanEditor/editFunction目标路径入口与ownership共用；last-effective用于legacy重复move及temp legacy move显示，显式编辑仅coalesce当前函数，保留unrelated ops/annotation。advanced文本metadata行为单独组合，ownership不造annotation；同id clean form随accepted有效path/revision更新，dirty input保留/expired并禁止stale submit，不能用key remount/effect吞掉。plan37/42–44及spec98明确ownership→advanced→ownership、advanced→ownership、temp+legacy、baseline return/no-op/undo-redo、form dirty/clean测试；spec112/plan92将PlanEditor/FunctionForm/operations/projection/focus/PlanOverview/breadcrumb纳入必要共享窗口。不是仅新mode修复。

M1关闭。spec82–84及plan66–67明确实际context domain id/returned snapshotId绑定physical path，source dispatch/response application前后校验project/snapshot/selection/request generation及返回path，mismatch/missing/readerror/late reply拒绝/清空，不fallback到destination。live source标current bytes，不宣称snapshot内容hash一致或历史存档，明确local snapshot不检测任意未索引外部变化；不扩历史源码存储/新hash协议/indexer。spec101有对应接受门，planned/physical路径分开。

`targeted-design-repair.md:3,5,12–20`如实保留原C0/I2/M1，分别记录三项修复与设计自审/独立复审/product window区别。spec继续保留真实pointer拖动、布局独立、完整filename/path、批准历史、unimplemented verification及IDX-04排除，不因修订扩大实际源码写入。

复审快照：VM2 HEAD `fe4b52c191640913d192ca514164d972275531d1`；spec SHA256 `a71cfd3e0960cec757083d6db9e0c6ec2c0c0383d9d0187f616b1d24c1129e0c`；plan SHA256 `098135fc7ab1c93f24ac36719fdf18cf89baa996b675cbbb9959591158f07548`，与主任务指定完全一致。

验证仅只读文档/现役事务源码核对及原报告摘要；未运行产品测试、gates、provider、build，未改产品/shared/remote文档或dist，未spawn、commit/push/deploy/merge/权限/keys/sessions操作。后续SQLite/server/browser行为仍pending，GRP-02 freeze及POL-01/KN-01共享窗口仍由main协调。
