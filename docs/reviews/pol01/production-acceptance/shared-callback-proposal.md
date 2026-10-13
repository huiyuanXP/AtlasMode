# 只读共享窗口提案（未实施）

核实实际挂载：apps/web/src/app/Navigation.tsx 的 advanced-navigation-content 内 `<PoliciesPanel app={app} />`。未来最小共享路径为 workspace.ts 两个 public accepted callbacks 与 Navigation.tsx 此一挂载；当前无证据要求改 WorkspacePanels。等待 KN release 和 root 授权，不写半接线。

建议 public 方法名 acceptPolicyWrite(AcceptedPolicyResponse)、acceptPolicyRead(AcceptedPolicyReadResponse)，Navigation 仅传 onAccepted / onReadAccepted 两引用，wrapper 已有 integrated 判定和异步 callback await，无需重造 CAS/transport。名称尚未产品决定，不宣称现有方法。

必须使用 Workspace 当前 ProjectScope + ownershipEpoch（不可把 controller 私有 response.epoch 当全局epoch），完成 ACK 后一次显式读取 policies/plans/summary，再按当前 project/epoch/operation token提交。read callback 的 policies 来自匹配 revision/digest 的完整 read，不是前50 page。controller 负责已知ACK/未知写结果和表单 dirty；parent失败应 reject 到 controller WORKSPACE_SYNC_REQUIRED，不能重放已知ACK。

当前 workspace run() 在 fail 后把错误写 store 并吞 Promise rejection，不宜直接复用并称 parent sync成功；callback需保留失败传播与 busy finally。这是 read-only看到的必要实现约束。saveKnowledge 对选中 plan 的 acceptPlan()会更新 plan/history；未来 callback须显式保护 dirtyPlanEditor 和原 capture（expectedRevision/expectedSnapshotId），不可静默覆盖未保存操作或偷偷rebasing批准。A→B→A late response/同epoch旧callbackfail/active-plan改变都需受控测试；更新真 approval状态并保历史，不仅替换 policies列表。

既有真实浏览器 planning 用例必须保留原断言。当前 root 旧候选缺新POL panel的428失败不能归到本次已APPROVE新9产品，也不能通过隐藏按钮或修改预期rev来消除。以上提案未修改产品源码，等待串行共享窗口后再把精确方法与依赖固定。
