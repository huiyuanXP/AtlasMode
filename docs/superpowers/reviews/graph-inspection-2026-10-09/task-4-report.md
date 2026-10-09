# Task 4 当前记录

待审入口与规划详情组件已实现，WorkspacePanels 已在 Task 3 明确移交后顺序接入。
新增 pending.ts 基于服务端 valid 区分当前有效批准；canApprovePlan 禁止过期/校验错误/已有效批准重复确认。
PendingPlans 固定按钮和草稿清单，逐项标题/目的/数量/状态/查看动作；空状态进入 Chat。
PlanOverview 逐项变更按钮与显式「确认此规划」，过期/改版状态提示。

行为证据：pending.test.tsx 初始3项真实失败→通过；新增过期确认按钮与变更选择测试1项失败→通过。最终该文件4项通过。
浏览器 tests/e2e/pending-plans.spec.ts 已通过（5.2s最终集成运行），验证打开/逐项选择不批准、显式批准绑定版本/基线、修改后重审及过期禁用。
最终聚焦/漏斗既有3项通过；新graph当前滚轮问题定位为导航导致面板追随相机变位，已交画布实现者做唯一集中修正延续。
主Agent真实Flask发现projectionData失配、地图SVG小尺寸、附加提示造成6px遮挡，均用实际DOM/截图证据反馈并要求对应修正。
真实Flask83文件/1575函数类，r2未批准演示规划与同源快照已保存于独立本地data，页面保持既有mimo Profile就绪，用户授权关闭旧Tunnel已执行。
本轮文档同步README/first-plan/contracts/state/Tickets与交付报告；最终结果以交付报告为权威。
