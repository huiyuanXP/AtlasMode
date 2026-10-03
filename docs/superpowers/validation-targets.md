# 外部仓库与 UI 验证准备

此文件记录固定目标及阶段证据。T08 已通过实际产品 HTTP/UI/MCP 浏览；
目标仓库保留在 checkout 外，不提交其源码或数据库，也未执行它们的测试套件。

## 已执行的索引阶段验证

已调用真实编译后的公共 `SourceIndexer`，分析整个固定 checkout 的受支持源码，
并通过 core snapshot schema；后续产品验证见下方 T08 记录。
本次运行包含已通过 T03 独立审查的快照身份修复，具体执行时的模块摘要保存在证据文件。

| 目标       |       纳入文件 | function-kind 节点 |  关系 | 调用 resolved / external / unresolved |   用时 | 峰值 RSS |
| ---------- | -------------: | -----------------: | ----: | ------------------------------------- | -----: | -------: |
| Flask3.1.3 |      83 Python |               1574 |  6281 | 714 / 1026 / 2176                     | 1.665s |   175MiB |
| Vite8.3.2  | 1583 TS/JS系列 |               8117 | 44263 | 5373 / 10443 / 14435                  | 4.465s |   537MiB |

function-kind 包含函数、方法和作为构造目标的类容器，不等同于全部运行时函数。
未知关系保留原因，当前范围不模拟动态派发、完整依赖类型环境或 tsconfig 路径别名。
Flask 无诊断；Vite 的7条诊断是5个被排除的 symlink 和2个故意语法错误的测试 fixture。
上文准备阶段的1550 JS/TS预数未包含全部支持的 mjs/cjs/mts/cts 等扩展及最终排除差异，
以本次实际 coverage 清单为准。

5条抽样调用全部核对到真实源码证据（下方列出的检查点），没有执行目标代码或
Vite/Flask 自身测试。运行证据在 ignored `artifacts/validation/{python,typescript}-indexer-evidence.json`，
包括 Git revision、实际模块 SHA-256、文件清单、统计、调用证据和未知样本。

| 目标                                                         | 固定版本 / commit                                   | 本次准备路径                         | 源码检查点                                                           |
| ------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| [Vite](https://github.com/vitejs/vite)                       | v8.3.2 / `10033218d239c927cdc375970b5741cce408e81b` | `/tmp/atlasmode-validation-vite`     | 全仓 2841 tracked files，其中1550个JS/TS；源码范围须在结果中明确     |
| [Flask](https://github.com/pallets/flask)                    | 3.1.3 / `22d924701a6ae2e4cd01e9a15bbaf3946094af65`  | `/tmp/atlasmode-validation-flask`    | 全仓235 tracked files，其中83个Python；框架代理/动态调用应如实标未知 |
| [React Flow 官方 Overview](https://github.com/xyflow/xyflow) | `3d35b57317576b0916c0bfeaaedd573aaacc2839`          | `/tmp/atlasmode-ui-reference-xyflow` | `examples/react/src/examples/Overview/index.tsx`                     |

静态抽样已直接查看目标源码，后续索引结果应核对：

- Vite `packages/vite/src/node/server/index.ts:507`：导出的 `createServer` 调用
  同文件 `_createServer`；后者在529行调用跨文件导入的 `resolveConfig`。
- Vite `packages/vite/src/node/utils.ts:234`：导出的 `normalizePath`；
  `fsPathFromId` 调用它。`path.posix.normalize` 是外部 Node 能力。
- Flask `src/flask/templating.py:139`：`render_template` 在151行调用同文件 `_render`；
  `render_template_string` 也调用 `_render`。`current_app` 等代理不应靠名称猜实例类型。
- 刷新同一源码内容应保持内容摘要/快照标识；增加空行后函数身份应保持，行号变化。
- 记录用时、纳入文件/节点/关系数量、resolved/external/unresolved、诊断与抽样证据；
  不把成功产出一个JSON文件当作完整验收，不声称运行了 Vite/Flask 自身的测试套件。

UI 参考已经实际运行：从官方源码创建独立临时 Vite demo，在系统 Chromium 中加载，
看到7个节点、6条边，无 page error，并实际查看 `overview.png`。
证据在 `/tmp/atlasmode-reference-demo/evidence.json` 和同目录截图。
观察到的样式：细边框、点阵画布、明显连接端点、边标签、左下缩放控件、右下缩略图。
AtlasMode 使用这些交互线索，并加左右面板；状态同时用文字/图标表达。

当前浏览器执行路径为 `/usr/bin/chromium`（Debian Chromium151），可给 Playwright
设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`；已确认 Noto Sans CJK SC 等中文字体存在。
官方浏览器CDN以及在线示例页面被当前代理403
阻断；没有关闭 TLS、跳过签名校验或削弱浏览器断言。三OS CI和普通本机安装仍应使用
官方 Playwright 安装步骤；此处系统路径只是当前环境的可选覆盖。

## T08 产品 HTTP/UI/MCP 验收

2026-10-03 UTC 实际启动编译后的服务、网页、SQLite 和 SDK stdio client。
两个固定目标均通过浏览器打开、搜索、读取源码及展开，以及 MCP summary 与 HTTP
一致性、搜索、调用上下文和预算查询。原截图捕获到聚焦动画之前的80节点全景，
因此增加选中节点可见/宽度>200px及footer空闲断言，并按同一固定目标重跑此产品
脚本获取已稳定截图；未重跑独立 SourceIndexer 基准。最终截图均已实际查看。

| 目标       | 产品打开/索引用时 | 入口总数 / 首批 | depth1图节点/关系 | 限制与诊断                                                                       |
| ---------- | ----------------: | --------------- | ----------------- | -------------------------------------------------------------------------------- |
| Vite8.3.2  |            4.651s | 762 / 50，截断  | 80 / 240，截断    | 5个symlink排除+2个故意语法错误fixture；createServer搜索143项，UI翻页选中真实源码 |
| Flask3.1.3 |            1.740s | 556 / 50，截断  | 80 / 136，截断    | 无诊断；render_template搜索5项，代理/动态调用保留未知                            |

两个目标文件/函数/关系/调用统计与前述索引表一致；budget1/depth2探测均实际截断。
Vite抽样 `packages/vite/src/node/server/index.ts:507` 的 `createServer`；Flask抽样
`src/flask/templating.py:139` 的 `render_template`，调用上下文源码证据逐行检查。
上下文每方向读取5项，不把分页/图截断解读为关系不存在。所有非loopback浏览器
请求均被拒绝；实际 external、console/page errors为空，MCP stderr为空。

复现需先 `npm ci`、`npm run build`，安装 Chromium，并把下面路径替换成已准备的
固定checkout。脚本核对完整commit，不clone、不执行目标代码：

```bash
npm run validate:repository -- --path /tmp/atlasmode-validation-vite --commit 10033218d239c927cdc375970b5741cce408e81b --symbol createServer --file packages/vite/src/node/server/index.ts --label vite
npm run validate:repository -- --path /tmp/atlasmode-validation-flask --commit 22d924701a6ae2e4cd01e9a15bbaf3946094af65 --symbol render_template --file src/flask/templating.py --label flask
```

当前实例在以上命令前设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`。
结果为忽略目录 `artifacts/validation/{vite,flask}-product.json` 和对应PNG，含精确
commit、时间、完整coverage、未知诊断、样本源码、预算和错误数组。旧捕获另存
`artifacts/validation/prior-captures/`；当前图不是旧截图的缩放或编辑结果。
Linux实例通过不代表原生Windows/macOS、全部公开项目或上游功能测试通过。
