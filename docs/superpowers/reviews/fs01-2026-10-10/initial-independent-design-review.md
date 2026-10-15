# FS-01 独立只读设计审查

2026-10-10 UTC。结论：**Issues Found；Critical 0 / Important 2 / Minor 1。现版先修两项 Important，再限定复审后进入实现。** 本审查不改任何产品/shared文件，不扩大IDX-04，不spawn。

审查 VM2 `/home/agent/projects/AtlasMode` 的 `docs/superpowers/specs/2026-10-10-fs01-design.md`、`docs/superpowers/plans/2026-10-10-fs01.md`，并核对 core paths/operations、Planning.update、workspace/source/focus、PlanEditor/FunctionForm/editFunction、Canvas drag、scope navigation、verification。仓库规则及相关审查技能沿用本任务已读取内容。

## I1 — 捕获 snapshotId 目前只在客户端检查，远端 snapshot race 仍可保存

证据：spec14/42/61、plan57–58承诺捕获 project/snapshot/plan/revision 后避免 stale save；spec95/plan85却称现有server update契约足够，无server更改。目前 `packages/service/src/planning.ts:131–162` 的更新事务只检查 expectedRevision，随后写 operations/r+1，没有当前snapshot前置条件。`workspace.ts:81–86` 的refresh会换project.snapshotId，不改plan revision。客户端旧summary本地依旧是S0时无法知晓别的客户端已完成S1刷新。

复现场景：客户端A捕获S0/r1并打开路径预览；客户端B刷新同项目到S1，plan仍r1；A本地tuple比较通过，发送expectedRevision=1，server保存r2并仅返回status=stale。这已经保存了基于过期事实的所有operations，而非阻止保存。

实际只读/内存 probe（现有 compiled service，无build、SQLite或target源文件写入）输出：

```json
{"captured":{"snapshotId":"project:122424acf11e15fe31428d3046d2d568:base","revision":1},"currentSnapshot":"project:122424acf11e15fe31428d3046d2d568:changed","acceptedRevision":2,"acceptedStatus":"stale"}
```

最小复现 recipe：用MemoryStorage与返回base snapshot的IndexerPort创建WorkspaceService/openProject/createPlan；捕获snapshot.id/revision；Indexer改为changed，refreshIndex；updatePlan同plan且expectedRevision取旧捕获值、operations=[]。服务接受r2，证明接口缺条件；空operations只隔离版本问题，移动操作也使用同一更新事务。

必须修设计：ownership新请求带捕获expectedSnapshotId（及既有expectedRevision/项目归属），在server同项目队列/同步更新事务的原子边界校验真实当前snapshot和plan baseline，再写operations；不以preflight scope请求代替原子检查。旧客户端可选兼容性可以明确，但ownership入口必须携带tuple。服务器snapshot变化barrier race应断言拒绝、无r+1/operations/history写入，UI保留未提交路径并要求新preview。main已同意给设计作者新增这个server原子precondition的设计范围，尚未授权产品src编辑。

## I2 — 高级编辑仍能重新制造多move，混合路径缺少统一合同

证据：spec28已观察focus-first/verify-last风险；spec51要求preview/PlanOverview/graph/advanced/breadcrumb一致，spec58/81要求一份effective move。但spec55–59/plan41仅定义新的retargetFunction，plan37让既有operations helper修改“only when necessary”，没有明确所有路径编辑入口必须复用它。现役 `apps/web/src/features/planning/PlanEditor.tsx:136–142` 继续调用editFunction，`operations.ts:77–83`追加move；`workspace.ts:920–924`取第一个move作selectedNode/焦点，`packages/service/src/verification.ts:33–38`取最后一个move；`projection.ts:80–83`列出每条move。

复现场景：ownership f→dest/b.ts并保存单move；在高级FunctionForm改到dest/c.ts，旧helper生成[move b,move c]。UI focus/breadcrumb仍b，verification目标c，图卡显示两条。再次ownership虽然可能coalesce，不会修复中间用户看到的矛盾；高级编辑既有表单key为domain id，revision/path改变时还需确保显示的有效值同步且dirty输入不被静默吞掉。

必须修设计：明确归属拖动与高级FunctionForm目标路径编辑共用retarget/coalesce；高级name/signature/description的annotation逻辑单独保留，不用伪造文本。所有有效路径消费者使用一致规则，对导入/旧plan重复moves也明确最后effective target，主动编辑本function时压成一条；不改无关operations。增加ownership→advanced→ownership、advanced→ownership、temp add+legacy move、return baseline/no-op/undo-redo测试，以及同id路径改后的form值/dirty输入测试。此修订仍在web/planning范围，无需IDX-04身份迁移。

## M1 — 原函数源码身份核对需明确snapshot结果边界

spec67/69与plan60正确要求实际事实id/path，不读新target。但当前 `api/client.ts:153–163` context回包含snapshot，source仅接受filePath；`routes.ts:184–190` sourceQuery也只有filePath。精确源码证据：`packages/service/src/workspace.ts:168–178`直接委托indexer.readSource；`packages/indexer/src/index.ts:13–21`只返回filePath与decoded content，未返回hash/snapshot/provenance/stale；`scan.ts:52–84`做归属/symlink/file校验后handle.readFile，未与snapshot内容摘要比较；`source.ts:5–42`只解码与错误诊断。因此现役源码API是live disk bytes，没有hash相符证明或snapshot stale判断。`workspace.ts:389–410`旧loadSource直接用selectedNode.filePath，FS integration需要替换这一来源路径，而不能只改ownership卡片。

建议明确：查实际function context的返回snapshotId必须等于captured snapshot后才能接受其path；source请求及回包应用前再次核对当前project/snapshot/selection generation。事实path与计划path分开保存；snapshot绑定的是函数身份/路径，live源码不是旧snapshot存档bytes，未提供hash验证时不得宣称与snapshot内容一致。文件消失、身份/版本不匹配或读取失败时拒绝/提示，不用destination bytes兜底。不需要新增历史源码存储。测试移动到已有dest文件后点击source，assert请求的是src原path；context/server刷新或late reply时不展示不匹配身份源码。此项是实施校准建议，不单独阻止设计。

## 设计已覆盖

- visible Structure targets tray、captured-snapshot bounded scope、fact/planned/missing/truncated标记和native HTML drag真实browser proof；keyboard/touch替代不冒充pointer验收。
- 默认layout位置/funnel offset独立，ownership native拖动不持久化坐标；group/file/folder不是source，外部data/foreign tuple/nonce拒绝。
- folder filename单segment先拒traversal再join，root正确，完整file target不重复拼basename，同名不同目录保持全路径身份。
- temp在add内retarget，fact主动编辑coalesce，annotations/unrelatedops保留的方向正确；需按I2打通混合旧入口。
- explicit preview save/approval/history/verification分别表述，当前源文件保持、未实现move仍unmet/unknown；不扩真实mv、AG-02执行或IDX-04持久身份迁移。
- 单元测试之外要求production compiled browser实际mouse drag、source byte/path list不变与55x30/map/group/breadcrumb回归证据。

快照：观察HEAD `fe4b52c191640913d192ca514164d972275531d1`；spec SHA256 `922f657e03d7a6ccc427e2fe4362a9f3defdfcce4e409c2e07d2b795ab8bd862`；plan SHA256 `09fd34aa38680c90d5a44f369b890555df3604cbd87a2341f795a9ed42239453`。

实际验证仅只读接口阅读、文档逐项合同核对、现有compiledservice内存probe。未运行完整门禁或浏览器，未build/修改共享dist，未改产品/globaldocs，未commit/push/deploy/merge/权限/keys/session操作。原现场与报告保留。
