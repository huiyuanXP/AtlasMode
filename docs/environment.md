# 环境、运行与验收

2026-10-03 UTC：当前 Linux 实例已完成干净锁文件安装、七个 workspace 构建和
类型检查、lint、200 项测试（20 个文件，0 失败、0 跳过）、真实生产 smoke。
实际 Chromium UI 与 SDK stdio MCP 联合流程通过，固定 Vite/Flask 产品浏览通过。
Windows/macOS 的 CI 已配置，尚未在原生 runner 执行；这不代表三系统均已验证。

## 已验证版本

| 工具              | 当前实例版本 / 要求                                              |
| ----------------- | ---------------------------------------------------------------- |
| Node.js / npm     | 24.19.0 / 11.9.0；与 `.node-version`、根 engines 一致            |
| Python            | 当前 3.12.14；索引 Python 需 3.10+，仅标准库 AST，不执行目标代码 |
| TypeScript / Vite | 5.9.3 / 7.3.6；Vite 此处是 AtlasMode 构建器版本                  |
| Playwright        | 1.63.0                                                           |
| 当前浏览器        | Debian Chromium 151.0.7922.173，`/usr/bin/chromium`              |
| MCP SDK           | `@modelcontextprotocol/sdk` 1.32.0，实际 SDK client/stdio 已验证 |

依赖由唯一根 `package-lock.json` 固定。`better-sqlite3` 原生模块已通过实际
SQLite 读写和重启验证；其他机器若无匹配预构建产物，需 Python、make/C++ 等本机
构建工具。无需模型 API key；外部模型联网由 Codex/Claude 等客户端负责。

## 安装、启动与检查

在仓库根目录（含 `package.json`）运行，Linux/macOS shell 与 Windows PowerShell
均使用相同 npm 命令：

```text
npm ci
npm run build
npm start
```

服务只绑定 `127.0.0.1:4310`，生产入口同时提供编译后的网页和 API；健康检查为
`GET /api/health`。浏览器内输入目标仓库绝对路径；路径是运行服务机器的路径。
开发使用 `npm run dev`，它先构建依赖包，再启动 API 与 Vite（默认网页5173）。
开发网页代理自动读取同一 `CODEMAP_PORT`；显式 `CODEMAP_API_URL` 可覆盖代理目标。

干净 CI 顺序如下。测试会启动编译后的 MCP/HTTP 入口，先构建再运行测试。

```text
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npm run smoke
npx playwright install --with-deps chromium
npm run test:e2e
```

`smoke` 启动真实生产进程并读取实际 JS 静态资源；HTTP 与 SDK 查询 TS/Python
临时项目、预算截断、源码、未执行目标代码标记，以及停止后重启的数据持久化。
脚本自行分配端口，并清理其临时数据库和进程。`test:e2e` 也自行启动生产服务。
单独验证 MCP 可运行 `npm test -- tests/integration/mcp-stdio.test.ts`。

当前实例默认 npm cache 曾不可写，因此实际安装用了
`npm ci --cache /tmp/atlasmode-npm-cache`；此路径不是跨平台产品要求。
官方 Playwright 浏览器 CDN 在本实例此前返回代理403，未绕过 TLS/代理或校验。
本实例实际浏览器命令为：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

该变量是可选覆盖；CI 的 Linux browser job 使用官方 Chromium 和依赖安装。
如在 PowerShell 指定已安装浏览器，先运行
`$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\absolute\path\chrome.exe'`；该原生示例未执行。
设置代理允许域名或保存配置草稿不等于运行时已应用，也不证明官方下载成功。

## 本地数据与 MCP

| 可选变量                 | 含义                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `CODEMAP_PORT`           | HTTP 端口，默认4310，范围1–65535                             |
| `CODEMAP_DATA_DIR`       | SQLite 所在目录；目录需可写                                  |
| `CODEMAP_WORKSPACE_ROOT` | 启动时显式打开的目标目录；未设置时不猜当前工作目录           |
| `CODEMAP_PYTHON`         | Python3.10+ 可执行文件路径；不要在值中混入参数               |
| `CODEMAP_API_URL`        | MCP 连接的 HTTP(S) 服务 origin，默认 `http://127.0.0.1:4310` |

Linux/macOS 示例：

```bash
CODEMAP_DATA_DIR="/absolute/path/AtlasMode-data" npm start
```

Windows PowerShell 示例（尚未原生执行）：

```powershell
$env:CODEMAP_DATA_DIR = 'C:\Users\me\AtlasMode-data'
npm start
```

默认数据库 `atlasmode.sqlite` 位于 Linux 的 `$XDG_DATA_HOME/AtlasMode`
（未设置时 `~/.local/share/AtlasMode`）、macOS 的
`~/Library/Application Support/AtlasMode`、Windows 的 `%APPDATA%\AtlasMode`。
SQLite 内含唯一用户知识和批准历史，不能当可随意删除的缓存。
规划 JSON/Markdown 导出已实现；完整知识导入/导出及一致备份入口仍未实现。

MCP 使用绝对 Node 路径直接启动 `apps/mcp/dist/index.js`，HTTP 服务需另外运行。
完整三系统引号/路径和 Codex App/CLI、Claude Code 配置见 [mcp.md](mcp.md)。
真实 SDK 连接已执行；Codex App/CLI 实际注册连接、Claude Code、原生技能目录发现
未验证，不改写用户全局客户端配置。

## 实际验收范围

- `tests/e2e/planning.spec.mjs`：实际入口/搜索/展开/源码与原生 Chromium 剪贴板读取，
  Agent 规划→改接已有 B→移除临时 helper→改目标文件→说明→校验/批准，布局不影响
  revision/hash，语义与目录知识修改使批准失效，再批准并下载 JSON/Markdown。
  实际重启服务后 UI/MCP 读取同 revision16/hash；随后修改临时源码并分别得到
  satisfied、unmet、unknown 和源码证据。还覆盖路线/过期、共享分组、禁止依赖、
  撤销重做、语言/主题重载、Python 浏览与项目切换。
- 浏览器拒绝全部非 loopback HTTP(S) 请求，实际外部请求和 console/page error 都为0。
  本证据覆盖已安装依赖后的本地应用流程；不是断开机器网络的证明，也不包含客户端模型请求。
- 实际查看浅色/深色1600×1000、窄窗760×1000及源码截图。窄窗编辑器移至画布下方；
  大图仍需缩放/平移，长源码可横向滚动。固定目标截图等待选中节点可见且宽度>200px、
  busy 提示消失后捕获，未用完整80节点缩略图冒充可读函数详情。
- Windows `child.kill()` 是强制结束，不能证明 Ctrl+C 优雅退出。测试专用 preload/IPC
  在真实子进程调用已注册的生产退出 handler，验证退出码、HTTP关闭、数据库和子进程清理；
  Unix 额外执行真实 SIGTERM。无生产 IPC 控制入口，原生 Windows Ctrl+C 仍未验证。

运行输出保存于忽略目录 `.superpowers/sdd/2026-10-03-local-planning-mvp/task-8-*.log`；
浏览器结果/截图在 `artifacts/e2e/`，目标证据在 `artifacts/validation/`。
这些本地证据不随 Git 自动分发。准确目标 commit、范围、统计与复现命令见
[validation-targets.md](superpowers/validation-targets.md)，功能缺口见
[readme-coverage.md](superpowers/readme-coverage.md)。

`.github/workflows/ci.yml` 配置 Linux/Windows/macOS 的安装/构建/类型/lint/测试/smoke
和 Linux Chromium job；尚无远端 CI 执行、发布或新环境恢复验证。
本地工作树的成功运行、云端草稿保存、远端提交和快照发布是不同结果。
