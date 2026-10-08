# 本地 Agent Chat（AG-01）

网页 Chat 通过本机 Codex 或 Claude CLI 使用 AtlasMode 的真实 MCP。该模式可以查询当前项目、提出路线、保存未批准草稿与功能集；源代码实施另属 AG-02。未配置、未安装或所选认证不可用时，状态与提交都会明确报错，不生成模拟回答。

## 设置

先使用 Node.js 24 LTS 安装并构建 AtlasMode：`npm ci`、`npm run build`。原生 Chat 当前支持 POSIX 启动边界，Linux 已验证；macOS 原生清理尚未实跑。Windows 暂不支持原生 Agent Chat，状态检测和进程启动在 spawn 前明确拒绝，等待独立的 Windows owned-job 实现；HTTP、UI 与通用 stdio MCP 的 Windows 支持保持不变。

在支持的平台复用已有 CLI 账户或 Provider API 环境凭据，以受信任的服务启动环境选择提供者：

```sh
CODEMAP_AGENT_PROVIDER=codex npm start
# 复用现有 Codex file Profile，例如 mimo.config.toml
CODEMAP_AGENT_PROVIDER=codex CODEMAP_CODEX_PROFILE=mimo npm start
# 或
CODEMAP_AGENT_PROVIDER=claude npm start
```

可选 `CODEMAP_AGENT_COMMAND` 为管理员指定的绝对可执行文件路径，`CODEMAP_AGENT_MODEL` 为管理员选择的模型。浏览器不能选择可执行文件、命令行参数或模型配置。服务启动后检测 CLI 能力和所选认证来源；修复安装、配置或凭据后重启服务。

Codex 每轮使用 `exec --json --sandbox read-only --ephemeral --ignore-user-config --ignore-rules`，在专属空临时目录运行，提示词通过 stdin 传入。禁用 shell、unified_exec、code_mode、浏览器/电脑操作、apps、plugins、hooks、多 Agent 与网页搜索；本次进程只配置 required=true 的 AtlasMode MCP，并明确限定 enabled_tools。版本缺少要求的参数或功能开关会拒绝连接。Claude 使用 print/stream-json、`--tools ''`、`--strict-mcp-config`、空 setting-sources、禁用 slash commands/hooks，并只允许本次 AtlasMode 工具；同样先检查支持的参数。

**模型与认证边界：** Codex 默认读取既有 `$CODEX_HOME/config.toml`（默认 `~/.codex`）所选模型与 Provider；`CODEMAP_CODEX_PROFILE` 支持安全名称的 `<name>.config.toml`，缺少文件时使用 base 的内联 profile。标准 TOML 解析后只将所选推理、模型目录、Provider 与认证设置转为本次进程覆盖，仍使用 `--ignore-user-config` 隔离工具/插件配置并保留原认证存储。API `env_key` 使用已有环境，不以 `codex login status` 阻断，也不重复 Device 登录；需要 OpenAI 账户认证的 Provider 检查既有账户状态。内联 bearer/header 凭据转入私有子进程环境，不放入 argv；缺失凭据、无效配置和不支持的认证 helper 明确报不可用。Claude 仍使用隔离配置下默认模型与既有账户认证。不会修改全局配置或请求浏览器 API key；独立直接 HTTP 模型适配器另属 AG-05。

## HTTP 契约

导出类型位于 `apps/server/src/agent/types.ts`，`@codemap/server` 导出 ChatInput、ChatRun、AgentStatus 与受信任构造注入的 AgentRunnerFactory。

- `GET /api/agent/status`：`{provider: 'codex'|'claude'|null, configured, available, reason?, profile?, model?, modelProvider?, authentication?}`。authentication 为 `api-environment`、`openai-account` 或 `none`。available 表示 CLI 安装、隔离参数、所选认证与 MCP 构建检查通过；模型与 MCP 的实际连接成功以本次运行结果为准。
- `POST /api/projects/:id/chat`：`{channel:'explore'|'plan', message, planId?, nodeId?, scope?:{kind:'folder'|'file'|'function',path,nodeId?}, snapshotId?, expectedRevision?}`，返回运行中的 ChatRun。
- `GET /api/projects/:id/chat/:runId`：读取该项目所属运行。跨项目运行 ID 返回 404。
- `POST /api/projects/:id/chat/:runId/cancel`：正文可为空或 `{}`；完成本次所属 CLI/MCP 进程与网关清理后返回终态。

ChatRun 为 `{runId,status,messages:[{role:'assistant',text}],activity:[{tool,status}],errors:[{code,message}],changedPlanIds,mayHaveSavedChanges}`。终态为 completed、failed 或 cancelled；工具活动状态为 running、completed 或 failed。保留公开回答，隐藏 reasoning、工具参数/原始结果和 stderr。CLI 错误使用固定、安全的错误说明。

同一项目/频道已有运行返回 409/AGENT_BUSY，全局四轮上限返回 429/AGENT_LIMIT，提供者未就绪返回 503/AGENT_UNAVAILABLE。无效上下文采用现有 INVALID_INPUT、NOT_FOUND、PROJECT_MISMATCH、BASELINE_CONFLICT 或 REVISION_CONFLICT。snapshotId、函数 ID、规划归属/revision 与 scope 均验证当前服务快照和所选规划。临时函数必须存在于本项目所选规划的实际 add_function 操作；未来文件/目录只能对应 add_function/move_function 的规范目标及其祖先目录。提示中明确标记 planned/indexed，规划目标不会冒充现有源码。scope 为规范仓库相对路径，根目录为 `.`，不会成为执行 cwd。

## MCP、恢复与限额

通用 MCP 的既有 16 个工具与行为保持不变。需要隔离的 stdio 启动可设置 `CODEMAP_MCP_PROJECT_ID` 及 `CODEMAP_MCP_CHANNEL=explore|plan`；程序接口为 `createMcpServer(apiUrl,{projectId,allowedTools})`，配置复制一次，后续工具参数无法扩大范围。绑定项目的客户端另有只读的 `list_plans` / `get_plan` 草稿读取工具（完整绑定工具目录最多 18 个）；Chat 的两个频道都允许这 18 个现有安全工具，以不同提示与聚焦上下文支持同一组 MCP 操作。

两频道均可使用 list_projects、get_project_summary、search_functions、get_function_context、get_subgraph、get_routes、get_groups、get_folder_policies、list_plans、get_plan、propose_route、propose_plan、update_plan、validate_plan、propose_group、get_approved_plan、refresh_index、verify_implementation。刷新与核对只读取/解析本项目源文件，不执行目标代码。没有批准、项目打开、原生命令或源码写入工具。项目列表仅返回绑定项目，合法的另一项目与规划元组也会被拒绝。

工具公布真实 MCP annotations：普通查询只读；草稿、刷新、核对有服务状态变化；所有现有工具均为本地非破坏性操作。只对本轮绑定项目的 AtlasMode MCP 设置 `default_tools_approval_mode="auto"`，与 enabled_tools 配合执行已授权规划操作；全局 `approval_policy="never"` 和原生工具禁用继续保留。

每轮 MCP 连接专属 loopback HTTP 网关。网关进一步校验项目/规划归属、方法与规范路径，不能转发批准、项目打开或任意 HTTP；成功写入在转发结果前记入内存日志。原生输出缺失、错误、超时或取消时，仍保留真实已创建/更新的规划 ID。mayHaveSavedChanges 提醒调用者重新读取当前项目的规划/功能集/路线；它不把同时间其他人的改动认领为本轮成果。草稿提交的创建与更新是两步，第二步失败不回滚第一步。

每个项目/频道最多 20 轮上下文（含当前输入），历史最多 65536 字符；单条用户输入最多 4096 字符。每轮 stdout/stderr 合计最多 1 MiB，默认 120 秒运行超时；完成运行保留 10 分钟，并设全局 200 条完成运行和 80 个空闲会话的保留上限。会话/运行在内存，服务重启清空；实际草稿仍保存在原 SQLite 中。

取消及关闭按所属 Unix 进程组清理树；给予 2 秒宽限后强制终止，等待所属主进程与 stdio 关闭。Windows 的 taskkill 在根进程退出后无法保留可靠的后代归属，不能用作此处的清理保证，因此原生 Chat 启动前直接拒绝。临时 cwd 随运行结束清理。服务本来的 Host/Origin 检查继续保护 Chat。该边界限制正常客户端的能力，不宣称抵御拥有本机完整进程/文件权限的恶意软件。

## 验证与限制（2026-10-08 UTC）

Linux Codex 0.160.0 的既有 Mimo Profile 已完成真实模型→MCP→未批准草稿闭环：`mimo-v2.6-flash`、Provider `mimo`、`api-environment`，实际 propose_plan 成功、草稿 revision 2、目标 sentinel 未执行。精确运行命令如下；使用现有凭据，没有重复 Device 登录。

```sh
CODEMAP_AGENT_COMMAND=/opt/infrastructure/managed/current/Runtime/bin/codex npm run test:agent -- codex mimo
```

该绝对路径是本次环境的原生二进制，其他机器应使用自己的受信任 CLI。默认 `codex` wrapper 仅加载已有凭据后执行同一二进制，本次成功证据使用上方显式路径；没有额外模型调用测试默认 wrapper。GPT/Gemini 的模型闭环未在本次运行验证。`codex login status` 的账户未登录观察不代表 API Profile 不可用。Claude 未安装，其协议通过明确标注为 test-only 的子进程夹具验证；原生 Claude/macOS 清理未实跑。Windows 原生 Chat 仍明确不支持，拒绝边界已在 Linux 用 Windows platform 分支与实际子进程 sentinel 验证；这不是原生 Windows 作业清理验证。

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
