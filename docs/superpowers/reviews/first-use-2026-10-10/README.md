# 首用验收与修复（2026-10-10 UTC）

## 页面观察先于产品文档

真实 VM2 checkout：`/home/agent/projects/AtlasMode`，本轮安全分支 `fix/first-use-20261010`。首次仅阅读运行/安全规则，随后启动独立本地服务并用真实 Chromium 页面观察。初始页面把服务未启动提示当成固定说明；打开项目后双侧 AI 状态与输入占据主要位置，主图函数难以阅读，离线用户缺乏下一步入口。观察后才读取产品说明与票据。本报告不宣称全部按钮或全部36票完成。

## 已修复范围

欢迎页提供选择本地项目的实际入口，去除固定服务错误提示；真实错误横幅保留。左栏先搜索/浏览函数，探索 Chat 和规划 Chat 默认折叠但持续挂载，草稿和会话不随折叠或标签切换丢失。右栏给出手动规划入口，复用现有高级编辑与持久化。初始图提高最低缩放到0.8，保留全部已加载节点、手动缩放及显式聚焦布局。

## 本轮证据

- RED：首用E2E在原实现因欢迎页固定“请先启动”失败，后续定向修复通过；该原始运行终端记录存在本轮会话，未假称保存了已被覆盖的trace。
- `npm run build -w apps/web`通过；相关 ESLint 通过。Vite大于500kB分块建议保留。
- `npm test`：669项、56文件通过，14:18:28 UTC开始；[原始输出](root-test.log)。这是首用修改阶段结果，不冒充随后IDX/GRP修改后的重跑。
- 实际Chromium：first-use、agent-chat、pending-plans、graph-inspection、focus-navigation合计8个场景在各自最终定向运行通过。第一次组合运行7/8通过，入口名称修复后first-use+agent-chat三项通过；没有声称一次完整8项重跑。
- 首用流程实际点击选目录、索引、搜索函数、看源码、创建手动规划；真实适配器Chat流式发送/MCP草稿/取消与项目隔离由agent-chat覆盖。未连接时发送返回503并保留输入。
- 独立只读审查通过：UI diff、CSS、E2E、浅色/900px截图；无可行动阻断项。

[浅色](light.png) · [深色](dark.png) · [900px](narrow.png)。截图禁用动画避免主题过渡态，已查看。浏览器证据使用隔离合成代码，未改变目标项目源码。

## 运行与发布边界

临时公开预览仅使用独立合成项目和限路由网关。公网Chromium搜索→源码交互通过，云端用户浏览器被平台阻止访问trycloudflare，未绕过。已关闭本任务Cloudflare、网关、SSH转发和独立服务；复核PID1960/2663不存在，4310/44310监听不存在。预览与测试数据库不是项目生产数据。

本次未生产部署、未合并、未修改认证/权限。GitHub `work`基线4f04918b5b8d3a1891045bd61f7588b1436c7812已确认是当前HEAD祖先；原AGENTS.md修改保留且不纳入本次提交。

## neat-freak事实面

VM已安装`/home/agent/.codex/skills/neat-freak/SKILL.md` v3.0.0，完整读取并按项目范围执行等价只读盘点，未安装/执行陌生脚本。

| 面 | 状态与边界 |
| --- | --- |
| 代码 | changed-and-verified：本报告所列首用范围 |
| 运行态 | changed-and-verified：本任务真实Chromium场景；生产部署out-of-scope |
| 文档 | changed-and-verified：README、state与本报告；其他票保持pending |
| 规则 | verified-current：AGENTS/CLAUDE保留；用户较新提交授权优先 |
| 记忆 | out-of-scope/generated-read-only：未写生成记忆/私有sessions |
| 工作区 | pending：保留本分支、并行IDX/GRP未集成文件和测试证据；无删除分支/worktree |

GitHub实际7个Issue均open；本地36票13DONE/23TODO。现役票据索引仍以docs/tickets/README.md为准；既有DONE不等于本次全重跑。GRP-01与IDX-01正在实现，完整Express历史FAIL与知识/备份/自动实施等未完成范围保持明确。
