# AG-05 验收检查点（2026-10-10 UTC）

**PARTIAL：实现及本地fixture闭环通过，真实Provider gate未执行。** 本报告区分代码/fixture/实际模型，build不等于功能或整票DONE。主控负责最终clean全根门禁、commit/push；本子代理没有模型付费请求、登录、安装或真实凭据读取。

## 交付与验收

| 条款 | 当前证据与结论 |
|---|---|
| 不依赖Codex CLI | `CODEMAP_AGENT_PROVIDER=responses` 在server可信构造选择直接fetch runner，环境key仅服务端；配置测试7项通过。 |
| 真实流式协议 | SSE测试11项通过：UTF8/分片/CRLF/CR/公开text/完整response/错误/预算；网页等待取消时显示未完成stream文本。 |
| 实际工具循环 | HTTP fixture→生产direct runner→真实MCP SDK→项目gateway→HTTP service→SQLite；22项loop测试通过，actual草稿journal与源sentinel不执行。 |
| 项目/批准边界 | 仅18规划工具，外项目完整合法tuple拒绝且revision不变；shell/approve/open/hosted/重复与异常batch在派发前拒绝。 |
| 取消/错误/预算/并发 | in-flight MCP cancel与API_TIMEOUT测试确认等待首项journal、仅1provider/1mutation；后续工具不派发。8request/32tool/120s/字节预算及现有单频道/全局4轮均覆盖。 |
| 网页接入 | 实际Chromium点击Send，r2未批准草稿/规划节点出现；再Send hold→Stop→cancelled与partialdraft恢复。1/1通过，浏览器未请求provider endpoint，无console/external request错误。 |
| 独立审查 | [初审/限定复审](independent-review.md)：I1执行超时续轮缺陷RED→GREEN后APPROVE；依赖DAG extension接受。0未关闭Critical/Important/Minor。 |
| 真实Provider成功/错误/取消/并发/MCP闭环 | **未执行，pending**，fixture不能替代实际外部模型；仍PARTIAL。 |
| Windows/macOS直接模式 | 未运行；原生CLI平台限制保持。 |

## 精确检查

- 新direct三文件最终40/40（配置7/SSE11/工具loop22）：`npx vitest run apps/server/src/agent/direct-loop.test.ts apps/server/src/agent/responses-stream.test.ts apps/server/src/agent/direct.test.ts`，见 [最终针对性](receipts/review-green.txt)。
- I1最终修复后相称回归：`npx vitest run apps/server/src/agent apps/server/src/dev.test.ts apps/web/src/features/chat/direct-panel.test.tsx apps/web/src/features/chat/panels.test.tsx` →83/83、12文件（15:00 UTC），见 [最终回归](receipts/final-scoped.txt)。首轮Agent整体71/71只是阶段证据，保留 [阶段回归](receipts/agent-all.txt)。
- UI标签3/3（含原panel2项），dev supervisor7/7：TDD logs保存在receipts。server typecheck、最终scopedlint、mcp/server/web构建exit0。web仍有536 KiB既有分块建议。
- Browser：`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/agent/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome npx playwright test tests/e2e/direct-api.spec.ts --output=/tmp/ag05-browser-results --reporter=list` →1/1（8.7s），[日志](receipts/browser.txt)。README旧/usr/bin/chromium不存在的首次运行仅setup失败，未安装浏览器；改用已安装runtime。截图`/tmp/ag05-browser-results/direct-api-Responses-API-f-6be2f-d-streamed-draft-and-cancel/direct-{completed,cancelled}.png`已实际查看：provider准确、r2/Draft/无批准、planned节点与Stopped恢复清楚。
- root clean npmci/build/test跨平台由主控持有slot，本子代理未运行全根build，不能引用其他owner历史PASS为此最终gate。

## TDD / review repair

[配置与SSE RED](receipts/red1.txt) missing module→[GREEN16/16](receipts/green1.txt)；[工具循环RED](receipts/red2.txt)14失败→[GREEN30/30](receipts/green2.txt)。CR-only framing新增行为[RED](receipts/red3.txt)→后续GREEN；面板原Responses误标Claude与dev遗漏mcp均有RED→GREEN。

独立I1原真实31秒探针发现provider在首个mutation仍挂起时继续调用第二草稿。新增真实SDK/HTTP/gateway/SQLite held-mutation regression，仅将ApiClient30秒timer缩为测试100ms；[RED](receipts/review-red.txt) provider requests3vs1。修复对SDK异常及API_TIMEOUT/API_UNAVAILABLE/API_INVALID_RESPONSE/未知MCP错误fail closed；只保留明确输入/归属/冲突的已完成错误恢复。[GREEN40/40](receipts/review-green.txt)，独立限定in-flight/schema/foreign4/4通过，原初审失败证据保留。

## 架构与残余gate

server只经`@codemap/mcp`公共入口复用工具schemas/SDK handler；mcp仍编译仅core，运行HTTP回server无compilecycle。eslint.config.mjs只新增server→mcp方向，其余公共入口、core纯净与web限制保留。workspaces与dev均mcp-before-server；server显式MCP/SDK依赖，原锁版本保留。SEC协调统一lock-only SHA `f26ef3a7cf494becb903226ef01d86dfa7ca1e014c271e284bb0db1b9cee49c4`，仅授权concurrently10.0.6与移除孤立fast-glob链另见SEC证据，未删node_modules。

实际Provider gate必须由主控核实已有授权，采用指定服务端env、真实success/error/cancel/concurrency及MCP draft闭环，记录型号与安全结果；不得在报告输出真实key或误称fixture LIVE。官方依据：[Responses function calling](https://developers.openai.com/api/docs/guides/function-calling)、[SSE streaming](https://developers.openai.com/api/docs/guides/streaming-responses)，2026-10-10读取。

## neat-freak docs-only事实面

代码changed-and-verified；fixture运行态verified-current，真实Provider pending；接入文档/README changed-and-verified；AGENTS及规则链verified-current（保留主控现有修改）；generated memory只读/out-of-scope；共享工作区复核现场保留，未commit/push/删除。设计/计划、RG日志及截图仍有复审用途，不列自动删除项。

## 主控隔离集成检查点

以暂存树 `d63a61a4f8cf787fce5ba55756fa0f268482d78f`（原HEAD4071012加AG05/SEC冻结变更，不含用户AGENTS或IDX02/GRP02未完改动）执行 git archive 到 `/tmp/atlasmode-integration-20261010-1505`。clean npm ci 安装397、审计405、vulnerabilities0；全根build/typecheck/lint、737测试/64文件（15:08:37 UTC起63.23s）、生产smoke全部通过。整套18个真实Chromium场景16通过、2失败：agent-chat与planning仍使用GRP01之前的Group title入口。直接API场景、源码、真实拖动/地图及分组新场景通过；远端CI另有已复现地图遮挡修复待集成。保留[全部原始日志](integration/atlasmode-integration-e2e.log)，这次检查点不能称全套browser或SEC整票DONE。新真实Provider gate当前启动环境配置存在性仅布尔核查均false，无key读取；等待配置/最小调用授权，其他票继续。

主控已查看 [发送完成](screenshots/direct-completed.png)；实施者已查看 [取消恢复](screenshots/direct-cancelled.png)。证据显示 Responses API、r2 Draft、No valid current approval 与真实规划节点，不能冒充外部模型 LIVE。源码与依赖后续如变更，应按变更范围新增门禁，不借此阶段737证据称全工作区通过。
