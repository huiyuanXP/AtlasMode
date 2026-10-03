# 环境、运行与验收

2026-10-03 UTC：当前 Linux 的 captured-tsconfig 最终集成检查通过：七个 workspace
build/typecheck、lint、293 项测试（25 个文件，0 失败、0 跳过）。新增配置浏览
2 项及现有 UI/SDK 联合流程1项通过，固定 Vite 产品验收已刷新。干净安装、生产
smoke 与 Flask 浏览沿用前轮记录，未在本票据重复运行。
Windows/macOS 的 CI 已配置，尚未在原生 runner 执行；这不代表三系统均已验证。

## 整体审查修复波次（2026-10-03 UTC）

四项 Important 与两项 Minor 已实施并独立复审通过（56e7f6f）。本轮七包 build/typecheck、
lint 退出0；一次全套执行220项/22文件，218项首次通过、2项新增请求测试失败。
失败均为测试请求问题：Node24 fetch 替换自定义 Host，以及 JSON Content-Type
却未附 body。改为 node:http 真正发送 Host、validate POST 附 {} 后，两项定向
检查通过（2通过/14未选）；随后扩展真实端口上的 source/approval 拒绝与零审批
持久化检查，1项通过/4未选。未声称修正后再次全量220项通过。
生产 smoke 已通过 TS/Python HTTP/SDK、静态资源、目标不执行与持久化重启。
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` 本轮1项通过
（测试10.2s，总计11.2s），UI/SDK同revision16/hash，兼容性warning可见且可批准；
external[]、console/page errors[]，截图warning/light/dark/narrow/source均实际查看。
该轮 `joint-flow-evidence.json` 的批准时间是2026-10-03T01:46:13.750Z，
semanticHash为 `dd3888680bb47dd48bcfd83153beaca0ad52c7d8e922fd642a48c5096670e1dc`；
JSON/Markdown下载分别3828/4016bytes。所有本轮日志位于
`.superpowers/sdd/2026-10-03-local-planning-mvp/scratch/whole-fix/`。

本轮新增边界：忽略/不可用源文件不能证明删除；明确的 move 或稳定 ID 才能建立
跨文件复用目标；可变 TS/JS callable initializer 保留 unresolved；规划调用接口
兼容性未知以 warning 呈现，不阻断结构有效的批准。完整 contract 在
[contracts.md](superpowers/contracts.md)。旧快照仍可读取，缺失扫描证据时保守 unknown。

固定目标 validator 在浏览捕获开始前和结束时分别校验相同完整 HEAD、干净 staged/
working tree/全部未跟踪文件，并在 evidence.provenance 保存两个检查结果。4项
临时 Git 回归通过；此检查不是文件系统锁，不能发现两次检查之间修改后又还原的内容。
Vite/Flask 本轮未重新索引或浏览；旧指标和截图只属于原 T08 修订/时间戳，尤其
本轮可变 callable 修复可能改变调用确定性计数，不能将旧指标重标为当前代码结果。

## Captured tsconfig 最终集成（2026-10-03 UTC）

在基线 `10eea272940a5c60f5136418ec46c9fabab1efb5` 加 Task3 界面/回归变更后执行。
Task1/2/3 均已独立审查通过；整体票据审查在091687b完成（0C/0I/2M）。
唯一Minor修复波次后的一次范围复审与残余warning裁决待controller gate。
这里记录实际检查，不将实现者自检称为独立审查。

- 最终产品源码完成后 root `npm run build`、`npm run typecheck`、`npm run lint`、
  `npm test` 各执行一次且退出0；293/25全部通过，无失败/跳过，suite30.25s。
- `npx vitest run tests/integration/tsconfig-resolution.test.ts`：真实编译HTTP和SDK
  stdio，继承配置仅由A改B，源码不变，调用目标变为targetB.ts:3；原规划/路线
  过期，历史批准/快照保留，函数ID不变；6个源文件与2个配置分列。实际SQLite
  持久化缺字段历史快照，经新HTTP/MCP进程读取及刷新后仍保留原数据。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test tests/e2e/tsconfig.spec.ts`：
  2项真实浏览器回归先因缺配置区域RED，再GREEN（7.1s）。通过真实入口→调用→
  只读源码、搜索、诊断展开与双语路径/计数，legacy明确未记录而非零；4张截图
  `artifacts/e2e/tsconfig/{captured,legacy}-{zh,en}.png`已实际查看。
- 相同浏览器覆盖运行 `npx playwright test tests/e2e/planning.spec.mjs`：1项通过，
  测试12.3s/总13.3s，批准r16的UI/SDK hash一致，实际服务重启/导出/核对通过。
  当前hash为`bb414b7f3377ae36550ba996a2c118b9b7e631ab3915607d1e544b3f40c41a26`，
  批准时间03:02:18.569Z，5张规划/源码/窄屏截图已查看。前轮图片另存本任务
  `prior-planning-artifacts/`，没有将旧hash重标为当前结果。
- SDK调用通过且无协议错误/stderr；浏览器拒绝所有非loopback请求，实际external、
  console/page errors均空；sentinel未执行。测试只清理自己的临时目录/SQLite，
  server正常退出0、SDK关闭后PID清空，没有清理用户知识库。
- 一次固定Vite真实产品gate通过，55个配置/1583源文件，完整HEAD与工作树前后
  保持干净。18条诊断及范围见[validation-targets.md](superpowers/validation-targets.md)。
  新产物使用`vite-captured-tsconfig`标签；未重跑Flask或上游测试。

配置JSONC/相对extends及最近tsconfig.json归属均限于已捕获输入，workspace
package/exports、references图和CommonJS完整语义未实现。contentHash升级为带版本
的源码+配置摘要，首次升级刷新可能使基线过期；旧快照/批准保留，不需DB迁移。
缺省configurationFiles表示历史未记录。路径和源码原文不翻译，不执行目标代码。

全部命令日志、RED/GREEN与根检查结果在
`.superpowers/sdd/2026-10-03-captured-tsconfig/scratch/task-3/`；
`product-source-provenance.json`记录基线与实际产品源文件SHA-256。
Playwright runner有宿主NO_COLOR/FORCE_COLOR提示；产品console、SDK stderr为空。
原生Win/mac、远端CI、真实客户端注册、fresh-task恢复和发布仍未执行。

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
API 在 service 处理前拒绝非127.0.0.1/localhost/[::1]的 Host、非实际 listener
端口及外部/null Origin；Origin 若存在必须精确同 Host 的 http origin。无 Origin
的本地 MCP 保留。开发启动器只给 API 子进程设置 `CODEMAP_DEV_PROXY=1`，明确
放行本地5173及其同源 Origin，生产默认不放行该代理端口。无 CORS 放宽或 forwarded
header 信任；云端远程/自定义域名预览不是本轮支持的访问方式。

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

### 后续 Playwright 调用的颜色策略

若宿主同时传入 `NO_COLOR` 和 `FORCE_COLOR`，保留用户的 `NO_COLOR` 意图，
只在本次Node进程移除 `FORCE_COLOR`，再加载已安装的CLI。以下命令在仓库根目录
可用于Linux/macOS shell及Windows PowerShell，不改宿主或客户端全局变量：

```text
node -e "if(process.env.NO_COLOR!==undefined)delete process.env.FORCE_COLOR;process.argv.splice(1,0,'playwright');require('./node_modules/playwright/cli.js')" -- test --list --reporter=list tests/e2e/tsconfig.spec.ts tests/e2e/planning.spec.mjs
```

同一调用去掉 `--list --reporter=list` 即为后续真实浏览器检查命令：

```text
node -e "if(process.env.NO_COLOR!==undefined)delete process.env.FORCE_COLOR;process.argv.splice(1,0,'playwright');require('./node_modules/playwright/cli.js')" -- test tests/e2e/tsconfig.spec.ts tests/e2e/planning.spec.mjs
```

列表命令已在本Linux实例刻意传入 `NO_COLOR=1`、`FORCE_COLOR=1` 验证：原CLI
有冲突warning；上述调用退出0、列出3项/2文件，无冲突warning或ANSI颜色。
列表只发现测试，不执行测试或启动浏览器，约0.46s；第二条浏览器命令未在本波次执行。
Windows/macOS原生执行仍未验证。可选浏览器路径仍使用上节的变量。

**残余限制（WR-M1仅部分处理，代码层面未解决）：** 已安装Playwright1.63.0在
`node_modules/playwright/lib/runner/index.js:5453` 的 `WorkerHost` 无条件设置
`FORCE_COLOR: "1"`，worker会重新产生与保留的 `NO_COLOR` 的冲突。普通
`npm run test:e2e` / `npx playwright test` 未改动；上述调用仅清理CLI继承冲突，
不保证worker无warning。未移除 `NO_COLOR`、修改依赖、过滤stderr或抑制其他warning。
Task3原始ui/planning日志中的warning完整保留，不重标为干净输出；已通过的产品
浏览器/root/固定目标gate未仅为颜色噪声重跑。证据与自检在
`.superpowers/sdd/2026-10-03-captured-tsconfig/scratch/whole-fix/`，残余由controller
在唯一范围复审后裁决，不据此宣称产品或整轮gate关闭。

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

首轮运行输出完整归档在忽略产物 `artifacts/review-evidence/local-planning-mvp.tar.gz`；
独立任务及整体审查报告、ledger和摘要收据保存在
`docs/superpowers/reviews/local-planning-mvp/`。
浏览器结果/截图在 `artifacts/e2e/`，目标证据在 `artifacts/validation/`。
这些本地证据不随 Git 自动分发。准确目标 commit、范围、统计与复现命令见
[validation-targets.md](superpowers/validation-targets.md)，功能缺口见
[readme-coverage.md](superpowers/readme-coverage.md)。

`.github/workflows/ci.yml` 配置 Linux/Windows/macOS 的安装/构建/类型/lint/测试/smoke
和 Linux Chromium job；尚无远端 CI 执行、发布或新环境恢复验证。
本地工作树的成功运行、云端草稿保存、远端提交和快照发布是不同结果。
