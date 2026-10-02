# 外部仓库与 UI 验证准备

此文件记录固定目标及阶段证据，索引通过尚不代表完整程序验收通过。最终结果由
T08 写入环境/验收报告；目标仓库保留在 checkout 外，不提交其源码或数据库。

## 已执行的索引阶段验证

已调用真实编译后的公共 `SourceIndexer`，分析整个固定 checkout 的受支持源码，
并通过 core snapshot schema；尚未验证这些目标的 HTTP/UI/MCP 浏览体验。
本次运行包含 T03 正在实施、等待独立审查的快照身份修复，具体模块摘要保存在证据文件。

| 目标 | 纳入文件 | function-kind 节点 | 关系 | 调用 resolved / external / unresolved | 用时 | 峰值 RSS |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Flask3.1.3 | 83 Python | 1574 | 6281 | 714 / 1026 / 2176 | 1.665s | 175MiB |
| Vite8.3.2 | 1583 TS/JS系列 | 8117 | 44263 | 5373 / 10443 / 14435 | 4.465s | 537MiB |

function-kind 包含函数、方法和作为构造目标的类容器，不等同于全部运行时函数。
未知关系保留原因，当前范围不模拟动态派发、完整依赖类型环境或 tsconfig 路径别名。
Flask 无诊断；Vite 的7条诊断是5个被排除的 symlink 和2个故意语法错误的测试 fixture。
上文准备阶段的1550 JS/TS预数未包含全部支持的 mjs/cjs/mts/cts 等扩展及最终排除差异，
以本次实际 coverage 清单为准。

5条抽样调用全部核对到真实源码证据（下方列出的检查点），没有执行目标代码或
Vite/Flask 自身测试。运行证据在 ignored `artifacts/validation/{python,typescript}-indexer-evidence.json`，
包括 Git revision、实际模块 SHA-256、文件清单、统计、调用证据和未知样本。

| 目标 | 固定版本 / commit | 本次准备路径 | 源码检查点 |
| --- | --- | --- | --- |
| [Vite](https://github.com/vitejs/vite) | v8.3.2 / `10033218d239c927cdc375970b5741cce408e81b` | `/tmp/atlasmode-validation-vite` | 全仓 2841 tracked files，其中1550个JS/TS；源码范围须在结果中明确 |
| [Flask](https://github.com/pallets/flask) | 3.1.3 / `22d924701a6ae2e4cd01e9a15bbaf3946094af65` | `/tmp/atlasmode-validation-flask` | 全仓235 tracked files，其中83个Python；框架代理/动态调用应如实标未知 |
| [React Flow 官方 Overview](https://github.com/xyflow/xyflow) | `3d35b57317576b0916c0bfeaaedd573aaacc2839` | `/tmp/atlasmode-ui-reference-xyflow` | `examples/react/src/examples/Overview/index.tsx` |

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
设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`。官方浏览器CDN以及在线示例页面被当前代理403
阻断；没有关闭 TLS、跳过签名校验或削弱浏览器断言。三OS CI和普通本机安装仍应使用
官方 Playwright 安装步骤；此处系统路径只是当前环境的可选覆盖。
