# 外部仓库与 UI 验证准备

此文件记录验收目标，尚不代表 AtlasMode 已通过这些验证。实际结果由 T08 写入
环境/验收报告；目标仓库保留在 checkout 外，不提交其源码或数据库。

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
