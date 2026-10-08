# Test：MCP 与本机 Agent 接入

这两个入口使用临时示例源码和独立 SQLite，结束后清理自己创建的服务、MCP 子进程和目录。它们不注册全局客户端配置，不执行目标代码。

先用 Node 24 安装并构建：

```sh
npm ci
npm run build
```

实际 MCP 连接测试无需登录或模型：

```sh
npm run test:mcp
```

它连接真实编译后的服务和官方 SDK stdio，检查通用16工具、绑定项目18工具、函数检索与上下文、提交未批准草稿、更新版本、HTTP/UI同源内容、过期revision冲突和跨项目拒绝。成功输出 PASS。原生模型没有参与，因此该结果不能当成 Agent 对话成功。

真实 Agent 测试复用同机 CLI 已有认证：Codex 账户或 Profile 的 Provider API 环境。已有 API Profile 不需要再次 Device 登录。运行：

```sh
npm run test:agent -- codex
# 复用既有 named profile，例如 Mimo
npm run test:agent -- codex mimo
# 或
npm run test:agent -- claude
```

该测试实际调用本机 Agent，要求它通过 MCP 提交一个草稿，并检查工具完成事件、网关实际保存记录和服务中的规划结果。已有 CLI 账号承担模型请求；测试可使用 CODEMAP_AGENT_COMMAND / CODEMAP_AGENT_MODEL / CODEMAP_CODEX_PROFILE 的受信任本机配置。当前认证来源不可用、未安装或当前平台不支持时，输出 UNAVAILABLE 并退出2；模型或工具失败退出1；实际模型/MCP/草稿闭环通过才输出 PASS。它不会输出模拟成功。

目前原生 Chat 支持受限 POSIX 进程组清理；Windows 原生 Chat 明确未启用，待实现独立所属 Job 清理。Windows 的 HTTP/UI/通用 MCP 不受此限制。

UI 与开发回归：

```sh
npm test
npm run test:e2e
```

浏览器测试中的 test-only Agent 适配器只由测试构造注入，供验证 Chat 状态、实际工具结果和聚焦行为；它不是原生模型验证，也不提供生产模拟回复。实际凭据不加入仓库。接入设置及会话边界见 [Agent Chat](../agent-chat.md) 和 [MCP](../mcp.md)。

本轮实际 Profile 接入：`mimo` / `mimo-v2.6-flash` / Provider `mimo` / `api-environment` 已通过原生模型→MCP→revision 2 未批准草稿闭环。该次运行显式使用本机可信原生 CLI 路径 `CODEMAP_AGENT_COMMAND`；没有重新 Device 登录，也没有运行目标代码。不是所有已列出的 Profile 都已经做过收费模型实测，GPT/Gemini 的配置就绪与 Mimo 的实际成功应分别理解。
