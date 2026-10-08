# Agent Chat 独立设计 / 计划审查

日期：2026-10-08 UTC。范围：`specs/2026-10-08-agent-chat-design.md`、`plans/2026-10-08-agent-chat.md`，以及现有 MCP / HTTP 边界。只写本报告，未修改产品代码。

**结论：需修订后实施 AG-01。** JSONL 子进程方案可行，不要求引入 app-server。3 项 Important、2 项 Minor；下列问题可由控制器按已有自主授权补进设计与计划，无须新增人工审批阶段。

## Important 1：原生 Agent 能力尚未落实“只读规划 / 不执行目标 / 根目录边界”

位置：设计第 11、29 行；计划第 13–15、34 行。

Codex 的 `--sandbox read-only` 限制模型 shell 命令的写入权限，并不等于禁用 shell、禁止执行仓库脚本或把读取范围限定在项目根。当前 CLI help 明确说明 sandbox 针对 model-generated shell commands；官方 JSONL 文档也包含 command execution 事件。Claude 仅约定 print/stream JSON，没有工具、权限模式与写入限制。两者加载本机既有工具 / MCP / rules 的方式也未明确。`shell=false` 保护 spawn 参数，不限制 Agent 随后选择的工具。因此按当前步骤实现，可能在“只改规划”期间运行目标代码、读取根外文件，或通过额外工具写入文件。

修订：给两种 provider 明确一套可验证的规划能力配置：仅暴露 AtlasMode 所需工具，禁用原生执行、写入及可绕过目录约束的读取；明确处理继承的 MCP / rules / hooks，不改全局配置。不支持这些限制的版本应返回 provider unsupported，不能只靠提示词维持约束。若必须保留原生读取，则应单独证明真实隔离能满足承诺。MCP 启动失败应终止运行，Codex 可采用官方文档的 `required = true`。补测试验证生成的实际配置和被拒绝工具；有登录时再验证原生 target sentinel。Claude 协议 fixtures 要以具体版本官方字段为依据，未验证安装版本不能宣称原生已支持。

控制器已给出可落地方案：Codex 使用空的可信临时 cwd、`--ignore-user-config`，按安装版本逐项关闭 shell_tool / unified_exec / code-mode / browser / computer / apps / plugins / multi-agent，仅配置所需 AtlasMode MCP 与工具 allowlist，另加 read-only sandbox；Claude 在确认版本支持后使用 `--tools ''`、`--strict-mcp-config` 和 scoped MCP，否则 fail closed。官方 [Config reference](https://developers.openai.com/codex/config-reference) 确有 `features.shell_tool` 与 MCP `enabled_tools`。实施时应检测不支持的配置，且明确忽略全局配置后如何保留用户期望的 provider / model，避免默默改用默认配置。

## Important 2：聊天的项目校验没有约束 Agent 后续 MCP 调用

位置：设计第 11、15 行；计划第 30、34 行；`apps/mcp/src/server.ts` 的 `list_projects`、`ownedPlan`、`propose_plan`。

现有 MCP 可以列出所有已打开项目；`ownedPlan(projectId, planId)` 只检查传入的两个 ID 相互匹配。聊天入口把项目 A 的上下文放进提示词之后，子进程仍可发现 B 并用匹配的 B ID 修改 B。跨项目 run polling 测试或故意把 A / B ID 混配的测试，都不能证明会话范围有效。既有通用 MCP 服务是面向可信本地客户端的，这次桥接应额外实现会话约束。

修订：为 Chat 启动的 MCP 加不可由模型改写的 project / run scope，在工具执行或内部 scoped HTTP 通道校验全部读取和写入；`list_projects` 只返回所绑定项目，plan 路由由服务验证归属。全局 MCP 保留原有用途。加入“会话 A 用完整合法的 B projectId + B planId”读取 / 写入拒绝测试，且确认 B revision 未改变。scope 机制同时记录实际提交变更，供下项恢复同步使用。

## Important 3：取消与部分提交之间缺少可靠同步规则

位置：设计第 15、19 行；计划第 30、32、40–44 行。

`changedPlanIds when parsed/verified` 不能覆盖“HTTP 写入成功，但 CLI 尚未输出 tool-completed 即被取消 / 超时 / 崩溃”。现有 `propose_plan` 本身也是先建计划再写 operations 的两次 HTTP 操作。仅依赖终态 JSONL 的实现可能漏掉真实 draft。停止浏览器 polling 也不等于停止 Agent / MCP 后代进程；取消后仍有写入时，页面容易显示已停止却缺少实际变化。

修订：明确定义运行取消会停止什么、何时进入 terminal 状态，以及失败 / 取消 / 超时同样触发服务事实刷新。优先从 run-scoped HTTP / MCP 边界记录已提交 mutation，不把未归因的其他用户变更声称为本 run 所为。保留 `createdPlanId` 等 recovery 信息；无法完整归因时显示“可能有已保存变化”并按当前项目重读，焦点仍服从后续用户导航。终止应覆盖拥有的 CLI 与 MCP 后代，设置有限退出宽限并等待实际退出；测试孙进程、建计划后中断、mutation 成功但无 tool-completed、切项目时 POST 尚未返回 runId。后者需要幂等 client request ID / 可恢复 run 注册，或继续接收 start acknowledgement 后立即取消，避免失去 process handle。

## Minor 1：承诺传 scope，但启动契约未包含 scope

位置：设计第 7 行；计划第 30、34 行。

HTTP 入参只有 nodeId / planId，目录或 funnel scope 没有明确字段。用户停在目录且未选函数时，Agent 无法知道当前范围。增加与前序导航票一致的结构化 scope 标识，在服务端按当前项目验证；同时携带 snapshot / revision 标识以解释过期上下文。不得把任意浏览器路径当成 native cwd。

## Minor 2：同一会话并发与总体进程上限未决定

位置：设计第 15 行；计划第 16、30、34 行。

20-turn history 仅限制历史长度，不限制同时 POST 的进程数；同一 project/channel 的两个请求也会产生不明确的历史顺序。建议首版每会话一个活动 run，忙时返回明确 409；设置全局活动 run 上限、消息 / 输出 / 历史字节上限及终态 TTL，并覆盖双击、双标签页、重复请求。无需新增复杂队列。

## 已成立的部分与验证边界

- 本地 spawn 参数数组、stdin prompt、默认不启用、已有 loopback Host / Origin 校验、禁止重启公网 Tunnel 的方向合理。现有 `apps/server/src/index.ts` 监听 `127.0.0.1`；本轮不要求新的公网权限或多用户认证系统。
- 官方 [Non-interactive mode](https://developers.openai.com/codex/noninteractive) 支持 exec JSONL、ephemeral、MCP 事件与 required MCP startup；这些足以支撑首版，但服务端必须过滤 reasoning / raw tool data。
- 已读取控制器缓存的官方页面 `/tmp/atlasmode-codex-noninteractive.txt`，并检查安装的 `codex exec --help`。本轮未运行模型或声称验证了认证。Codex 未登录、Claude 未安装的事实按输入证据保留。
- `test:mcp` 的真实 SDK / HTTP / SQLite 成功与 native Agent completion 分开报告是正确的；缺登录不妨碍实现 / 独立验证桥接协议与 UI，但真实模型闭环仍应标记未执行。
- 失败 / 取消的测试 fixtures 应明确 test-only。已有全局 MCP 集成测试不能替代新增 Chat scope 与取消恢复测试。

修订后请围绕以上条款限定复审；不要求重复已通过的焦点 / funnel 独立任务审查。

## 限定复审：ce29840（2026-10-08 UTC）

**结论：设计 / 计划通过，可实施 AG-01。** 对原 I1 / I2 / I3 / M1 / M2 及其修订引入的矛盾进行复审，5 项均在设计层关闭；未发现新增阻断问题。此结论不代表产品实现、原生 CLI 兼容性或真实模型闭环已通过。

| 原问题 | 修订证据与结论 |
| --- | --- |
| I1 原生能力边界 | 最终边界章节与 Task 1 同时要求可信空 cwd、隔离用户配置、关闭原生执行等工具、MCP allowlist / required startup、版本不支持时 fail closed；Claude 明确限制默认工具并隔离 MCP 配置。模型行为也改成明确的 CLI 默认值 / 管理员 override，消除“忽略配置却继承用户模型”的歧义。关闭。 |
| I2 项目范围 | 新增不可变 MCP project / channel binding，过滤 list_projects，拒绝完整合法的外项目参数；run-owned HTTP gateway 再校验归属并禁止 approval / open-project 转发。Task 1 包含对应负向用例和 MCP 文件范围。关闭。 |
| I3 取消 / 部分提交 | 新增 HTTP mutation journal，不再依赖 CLI tool-completed；明确全部终态重读、保留 recovery、不可归因时提示、不抢占新导航；2 秒退出宽限、拥有的进程树清理、迟到 start acknowledgement 取消均进入实施与测试步骤。关闭。 |
| M1 scope 缺失 | POST contract 增加结构化 scope、snapshotId、expectedRevision，设计明确服务端验证且禁止用作 cwd。关闭。 |
| M2 并发 / 资源上限 | 明确每会话单 run / 409、全局四 run / 429、消息 / 历史 / 输出限制及 terminal TTL，并增加多标签页与过期测试。关闭。 |

实施时沿既定条款验证两项细节：gateway 清理需等待或核对已转发的在途 mutation，不能仅等 CLI 退出就完成最后一次同步；新增 gateway 也应落实已有本地 Host / Origin 约束，拒绝不属于协议的路径 / 方法 / 请求体。它们属于 I2 / I3 已接受边界的实现验收，不新增架构或审批阶段。

本次只读取修订文档与 HEAD（`ce29840`），并追加本报告；未修改正在实施的 focus 产品代码，未执行 native Agent。精确 CLI flags、provider 能力检测及运行时拒绝证据由 Task 1 验证；Codex 未登录、Claude 未安装的限制继续保留。
