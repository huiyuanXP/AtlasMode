# 可见交互验收边界

目标 VM2 AtlasMode，HEAD 0991dbc，现有 pending 修复窗口。表中 PASS 只对应指定冻结候选，不代表未提交共享树已经全部可交付。

| 页面动作 | 实际证据 | 状态 |
| --- | --- | --- |
| Plan ownership、Choose/Browse/父路径、原生函数→文件/文件夹拖放 | FS R3 单轮 9/9 Chromium，真实领域 ID、完整文件名、CAS、native drop/dragend | PASS |
| 取消、Undo/Redo、明确确认、源码查看、刷新后重新选择 | 同一 FS R3，旧预览过期与 S0→S1、A→B→A 负例 | PASS |
| 布局拖动、折叠组端点拖动、重载持久化 | 同一 FS R3，图坐标与规划语义分开验证、真实成员 ID | PASS |
| 无 request 的归属目标面板 | 窄修及 51/5 定向测试、独立审查 APPROVE | PASS；组件测试，不冒充额外浏览器场景 |
| 注释新增/保存/删除/历史/显式重新绑定、刷新/重启 | KN 作者私有编译副本，原四项 mounted 通过；R2 三项竞态另轮通过，执行端点增量零；独立窄复审 APPROVE | 限定候选 PASS；组合验收待完成 |
| unknown 写入后 Reload、dirty 草稿保留、执行入口保护 | R2 实际 lostACK 与 A→B/ABA，21 source PASS；unknown 页面截图已查看 | PASS；不把旧 recovery 当新写入的恢复凭据 |
| 宽屏五个右侧标签入口 | 原裁切真实复现；局部 CSS 换行后，1600px 浅色与900px 深色五入口原生点击、按钮/文字边界通过，root 与独立 reviewer 实际查看截图 | PASS；独立 APPROVE，组合验收待完成 |
| 目录策略保存/导入/冲突后的重读 | 模块源测试已通过；实际 Navigation 缺 accepted 工作区回调 | PENDING；不得隐藏按钮或改变原规划修订号断言 |
| 当前外部 Provider 真调用、Windows 原生 Chat、真实 Codex/Claude 两客户端 | 现有协议/SDK/构建证据不替代这些 | PENDING |

截图实际已查看：R3 parent/child tray、过期目标、重新开始预览、新 snapshot scope、重启截图。重启截图呈新 origin 欢迎页，UI 重新打开不由此图证明；数据库持久化由实际 HTTP 收据证明。

未声称所有可见按钮均已验收。其余原票继续登记在进度台账；本轮无生产部署、push、合并或权限更改。
