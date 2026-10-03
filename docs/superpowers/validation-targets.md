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
此早期阶段未知关系保留原因，当时不模拟动态派发、完整依赖类型环境或 tsconfig 路径别名。
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


## Captured tsconfig 固定 Vite 产品验收

2026-10-03T03:02:18.513Z，使用基线`10eea272940a5c60f5136418ec46c9fabab1efb5`
加Task3界面变更的实际编译产物；源码SHA-256清单记录在本任务scratch的
`product-source-provenance.json`。此次只运行一次Vite gate；Flask保留上面的T08
证据，前述旧计数/截图不代表这次解析器结果。

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run validate:repository -- --path /tmp/atlasmode-validation-vite --commit 10033218d239c927cdc375970b5741cce408e81b --symbol createServer --file packages/vite/src/node/server/index.ts --label vite-captured-tsconfig
```

固定Vite8.3.2的完整HEAD、staged/working tree/全部未跟踪状态在03:02:07.459Z和
03:02:18.513Z分别检查，均clean。真实生产HTTP/网页/SQLite/SDK stdio通过打开、
搜索、只读源码、调用上下文、预算截断和展开；createServer位于server/index.ts:507，
搜索143项；入口762/首批50，budget1截断，depth1展开80节点/240关系且截断。
实际查看`artifacts/validation/vite-captured-tsconfig-product.png`：选中卡片可读，
右侧真实源码和调用证据可读，footer无busy。详情JSON保存同名路径。

| 源文件 | 配置输入 | function-kind节点 | 关系 | calls resolved / external / unresolved | 打开/索引用时 |
| ---: | ---: | ---: | ---: | --- | ---: |
| 1583 | 55 | 8117 | 44263 | 6223 / 8302 / 15726 | 5.796s |

18条诊断：5个排除symlink、2个故意源码语法错误、2个不支持的package extends、
7个未展开references提示，以及同一无效JSONC分别在capture/resolution阶段的2条
诊断。55个配置独立于源文件计数；无法支持的配置没有伪装成完整项目解析。
调用分类变化反映本轮配置解析及前轮可变绑定修复，不等于运行时调用覆盖率。
非loopback请求全拒绝，actual external与console/page errors均空，SDK stderr为空；
只运行AtlasMode，未安装目标依赖、执行目标代码或上游测试。临时服务/数据库已清理。


## Static CommonJS：Express5.2.1 实际产品浏览与未满足项

2026-10-03T04:48:13.152Z，AtlasMode基线96db708加Task3最终源码。
目标 `/tmp/atlasmode-validation-express`，完整SHA
`dbac741a49a5a64336b70c06e85c2e2706e36336`；捕获前04:48:08.193Z与捕获后
04:48:13.152Z都校验完整HEAD和含全部untracked的干净Git。未安装目标依赖、
执行目标代码、npm scripts或上游测试；包含test目录只是静态源码扫描。

实际编译HTTP/浏览器/SDK stdio完成打开、搜索、源码与预算展开；generic validator
命令退出0，图片已查看，console/page errors及external为空，SDK stderr为空。
共142源文件、1包配置、0配置输入、3070函数类节点、15216关系；calls为
304 resolved /22 external /11234 unresolved，0诊断。打开耗时1844ms；
34/34入口候选未截断。budget1返回1节点且truncated=true；budget80/depth1
返回4节点/13关系、truncated=false。不是目标运行兼容性证明。

**未满足 canonical 入口验收：** createApplication实际在`lib/express.js:36`
（原brief的37行是内部app函数），搜索/源码可读，但当前exported=false。
`index.js:11`的`module.exports = require('./lib/express')`是不支持的转发；
其namespace escape使原模块也保守失效。精确源副本诊断：只保留原package.json/
lib/express.js时为true，加入原index.js后相同声明ID为false。该诊断不是缩减目标
验收，也没有改目标或分析器。完整canonical-entry验收不能据generic命令退出0报PASS。
五个createApplication调用均unknown：两个mixin调用因var导入可变，两个Object.create
与app.init缺少唯一实现；未扩大值流/动态mixin/forwarding能力。

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/validate-repository.mjs --path /tmp/atlasmode-validation-express --commit dbac741a49a5a64336b70c06e85c2e2706e36336 --symbol createApplication --file lib/express.js --label express-commonjs
```

唯一新产物`artifacts/validation/express-commonjs-product.{json,png}`；源SHA与日志
在`.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-3/`。
本票据未重跑Vite/Flask，旧计数/图片/时间保持历史含义；原生Win/mac、实际客户端、
远端CI/fresh-cloud restore未执行。实现者已将canonical-entry失配交controller裁决。

Controller裁决：保留上述原canonical-entry未满足证据，接受本轮保守escape限制；
后续独立static-forwarding安全票据在whole-plan关闭后再规划，Task3不扩大分析器范围。


## Static forwarding：唯一完整 Express 严格入口 gate（FAIL）

2026-10-03T19:43:42.119Z–19:43:48.132Z，AtlasMode基线86e6b12及Task2 harness候选。
完整Express5.2.1仍为`dbac741a49a5a64336b70c06e85c2e2706e36336`，未排除test目录、
未安装依赖、执行源码/scripts/upstream测试。实际捕获前19:43:42.707Z与后
19:43:47.951Z均校验完整HEAD、staged/untracked干净。只运行这一新gate。

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/validate-repository.mjs --path /tmp/atlasmode-validation-express --commit dbac741a49a5a64336b70c06e85c2e2706e36336 --symbol createApplication --file lib/express.js --label express-static-forwarding --require-entry
```

`--require-entry`是opt-in boolean，旧泛用命令仍可使用。它明确要求实际sample exported=true、
实际summary返回的entry IDs含sample ID，并核对50节点上限、total与truncated一致；截断不
豁免缺少sample。唯一gate退出1：`Required sample must be an exported entry`，实际
`function:09847e8be9b19d446c677876b5516a3c`为exported=false，34/34实际entry IDs无它、
truncated=false；源码实际声明在`lib/express.js:36`。`express-static-forwarding-product.json`
逐项保存criterion=failed、两次provenance及空errors/external/protocolErrors。
该次assert在截图前失败，**没有新Express PNG**；不复制旧图片或重跑冒充新失败截图。
后来validator将严格断言移至取证后并保证capture错误不掩盖原错误；最终一次临时非入口
fixture于19:48:22.729Z–19:48:26.410Z退出1，保存真实sample/context/source/PNG并已查看。

bounded exact-source AST诊断使用原`index.js`、`lib/express.js`、`test/exports.js`的捕获字节，
在内存中记录三个consumer-write：`test/exports.js:53,58,71`分别写
`express.application.foo`、`express.request.foo`、`express.response.foo`，reason为
`CommonJS property selection is dynamic or nested`。这些嵌套写入使index namespace invalid，
共享转发组将拒绝传播给真实leaf。此三文件诊断用于定位，**不是缩减目标的验收**，没有
改变产品、目标或guard；不得将静态转发fixture通过说成完整Express入口通过。

原2026-10-03T04:48:13.152Z的Express泛用浏览PASS与canonical-entry FAIL保持其修订和
时间；Vite/Flask历史运行未重跑。当前严格入口仍未满足。Git历史报告保留；本恢复环境
没有此前忽略Git的成熟目标PNG/tar。新失败JSON/rawlog、fixture图片及诊断收据保存至
[Task2报告](reviews/static-forwarding-task2/task-2-report.md)。不作运行时加载/构建兼容性声明。
