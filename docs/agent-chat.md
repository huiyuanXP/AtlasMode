# 本地 Agent Chat（AG-01）

网页 Chat 通过本机 Codex 或 Claude CLI 使用 AtlasMode 的真实 MCP。该模式可以查询当前项目、提出路线、保存未批准草稿与功能集；源代码实施另属 AG-02。未配置、未安装或未登录时，状态与提交都会明确报错，不生成模拟回答。

## 设置

先使用 Node.js 24 LTS 安装并构建 AtlasMode：`npm ci`、`npm run build`。原生 Chat 当前支持 POSIX 启动边界，Linux 已验证；macOS 原生清理尚未实跑。Windows 暂不支持原生 Agent Chat，状态检测和进程启动在 spawn 前明确拒绝，等待独立的 Windows owned-job 实现；HTTP、UI 与通用 stdio MCP 的 Windows 支持保持不变。

在支持的平台安装官方 CLI，通过该 CLI 登录，再以受信任的服务启动环境选择提供者：

```sh
CODEMAP_AGENT_PROVIDER=codex npm start
# 或
CODEMAP_AGENT_PROVIDER=claude npm start
```

可选 `CODEMAP_AGENT_COMMAND` 为管理员指定的绝对可执行文件路径，`CODEMAP_AGENT_MODEL` 为管理员选择的模型。浏览器不能选择可执行文件、命令行参数或模型配置。服务启动后检测 CLI 能力与登录状态；修复安装/登录后重启服务。

Codex 每轮使用 `exec --json --sandbox read-only --ephemeral --ignore-user-config --ignore-rules`，在专属空临时目录运行，提示词通过 stdin 传入。禁用 shell、unified_exec、code_mode、浏览器/电脑操作、apps、plugins、hooks、多 Agent 与网页搜索；本次进程只配置 required=true 的 AtlasMode MCP，并明确限定 enabled_tools。版本缺少要求的参数或功能开关会拒绝连接。Claude 使用 print/stream-json、`--tools ''`、`--strict-mcp-config`、空 setting-sources、禁用 slash commands/hooks，并只允许本次 AtlasMode 工具；同样先检查支持的参数。

**模型与登录边界：** Codex 隔离用户 config.toml，保留 CLI 本地账户认证位置。因此未指定 `CODEMAP_AGENT_MODEL` 时，使用隔离配置下 CLI 的默认模型，不能称为继承用户配置的模型。Claude 不加载 user/project/local 设置，也使用自身隔离后默认模型。自定义提供者、用户 profiles、全局 MCP、插件和模型设置不会被自动迁移；此模式支持官方 CLI 默认提供者的既有登录。不会修改全局配置、请求或保存浏览器提供的 API key。

## HTTP 契约

导出类型位于 `apps/server/src/agent/types.ts`，`@codemap/server` 导出 ChatInput、ChatRun、AgentStatus 与受信任构造注入的 AgentRunnerFactory。

- `GET /api/agent/status`：`{provider: 'codex'|'claude'|null, configured, available, reason?}`。available 表示 CLI 安装、隔离参数、既有登录与 MCP 构建检查通过；模型与 MCP 的实际连接成功以本次运行结果为准。
- `POST /api/projects/:id/chat`：`{channel:'explore'|'plan', message, planId?, nodeId?, scope?:{kind:'folder'|'file'|'function',path,nodeId?}, snapshotId?, expectedRevision?}`，返回运行中的 ChatRun。
- `GET /api/projects/:id/chat/:runId`：读取该项目所属运行。跨项目运行 ID 返回 404。
- `POST /api/projects/:id/chat/:runId/cancel`：正文可为空或 `{}`；完成本次所属 CLI/MCP 进程与网关清理后返回终态。

ChatRun 为 `{runId,status,messages:[{role:'assistant',text}],activity:[{tool,status}],errors:[{code,message}],changedPlanIds,mayHaveSavedChanges}`。终态为 completed、failed 或 cancelled；工具活动状态为 running、completed 或 failed。保留公开回答，隐藏 reasoning、工具参数/原始结果和 stderr。CLI 错误使用固定、安全的错误说明。

同一项目/频道已有运行返回 409/AGENT_BUSY，全局四轮上限返回 429/AGENT_LIMIT，提供者未就绪返回 503/AGENT_UNAVAILABLE。无效上下文采用现有 INVALID_INPUT、NOT_FOUND、PROJECT_MISMATCH、BASELINE_CONFLICT 或 REVISION_CONFLICT。snapshotId、函数 ID、规划归属/revision 与 scope 均验证当前服务快照和所选规划。临时函数必须存在于本项目所选规划的实际 add_function 操作；未来文件/目录只能对应 add_function/move_function 的规范目标及其祖先目录。提示中明确标记 planned/indexed，规划目标不会冒充现有源码。scope 为规范仓库相对路径，根目录为 `.`，不会成为执行 cwd。

## MCP、恢复与限额

通用 MCP 的既有 16 个工具与行为保持不变。需要隔离的 stdio 启动可设置 `CODEMAP_MCP_PROJECT_ID` 及 `CODEMAP_MCP_CHANNEL=explore|plan`；程序接口为 `createMcpServer(apiUrl,{projectId,allowedTools})`，配置复制一次，后续工具参数无法扩大范围。绑定项目的客户端另有只读的 `list_plans` / `get_plan` 草稿读取工具（完整绑定工具目录最多 18 个）；Chat 的两个频道都允许这 18 个现有安全工具，以不同提示与聚焦上下文支持同一组 MCP 操作。

两频道均可使用 list_projects、get_project_summary、search_functions、get_function_context、get_subgraph、get_routes、get_groups、get_folder_policies、list_plans、get_plan、propose_route、propose_plan、update_plan、validate_plan、propose_group、get_approved_plan、refresh_index、verify_implementation。刷新与核对只读取/解析本项目源文件，不执行目标代码。没有批准、项目打开、原生命令或源码写入工具。项目列表仅返回绑定项目，合法的另一项目与规划元组也会被拒绝。

每轮 MCP 连接专属 loopback HTTP 网关。网关进一步校验项目/规划归属、方法与规范路径，不能转发批准、项目打开或任意 HTTP；成功写入在转发结果前记入内存日志。原生输出缺失、错误、超时或取消时，仍保留真实已创建/更新的规划 ID。mayHaveSavedChanges 提醒调用者重新读取当前项目的规划/功能集/路线；它不把同时间其他人的改动认领为本轮成果。草稿提交的创建与更新是两步，第二步失败不回滚第一步。

每个项目/频道最多 20 轮上下文（含当前输入），历史最多 65536 字符；单条用户输入最多 4096 字符。每轮 stdout/stderr 合计最多 1 MiB，默认 120 秒运行超时；完成运行保留 10 分钟，并设全局 200 条完成运行和 80 个空闲会话的保留上限。会话/运行在内存，服务重启清空；实际草稿仍保存在原 SQLite 中。

取消及关闭按所属 Unix 进程组清理树；给予 2 秒宽限后强制终止，等待所属主进程与 stdio 关闭。Windows 的 taskkill 在根进程退出后无法保留可靠的后代归属，不能用作此处的清理保证，因此原生 Chat 启动前直接拒绝。临时 cwd 随运行结束清理。服务本来的 Host/Origin 检查继续保护 Chat。该边界限制正常客户端的能力，不宣称抵御拥有本机完整进程/文件权限的恶意软件。

## 验证与限制（2026-10-08 UTC）

当前 Linux 的 Codex 0.160.0 已安装但 `codex login status` 为 **Not logged in**；Claude 未安装。生产状态/提交烟雾验证分别返回禁用、未登录与命令缺失，并拒绝提交；真实索引目标的执行 sentinel 未出现。未尝试模型请求，未声称实际原生 Agent/MCP 模型闭环通过。Claude 协议通过明确标注为 test-only 的子进程夹具验证；原生 Claude/macOS 清理未在本次环境实跑。Windows 原生 Chat 明确不支持，拒绝边界已在 Linux 用 Windows platform 分支与实际子进程 sentinel 验证；这不是原生 Windows 作业清理验证。

针对性验证命令：

```sh
npx vitest run apps/server/src/agent apps/mcp/src
npx vitest run tests/integration/mcp-stdio.test.ts tests/integration/server-shutdown.test.ts
npm run build -w @codemap/server
npm run build -w @codemap/mcp
npm run typecheck -w @codemap/server
npm run typecheck -w @codemap/mcp
```

测试通过 `createServer({service,agentRunnerFactory})` 在服务构造时注入受控进程夹具。没有 HTTP 或环境变量可将产品模式切换为模拟回答；默认配置始终使用真实 CLI。

官方依据：[Codex non-interactive](https://developers.openai.com/codex/noninteractive)、[Codex 配置参考](https://developers.openai.com/codex/config-reference)、[Codex 配置 schema](https://developers.openai.com/codex/config-schema.json)、[Claude CLI reference](https://code.claude.com/docs/en/cli-reference)。实际 CLI 帮助/功能检查与本机登录观察用于兼容性判断，文档不替代实际原生成功证据。
