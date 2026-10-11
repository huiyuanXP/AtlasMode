# POL01 integration negative-contract window — independent review

2026-10-11 UTC；reviewer `/root/pol01_review`，沿用明确 gpt-6.1-sol / high，非本窗口作者，没有 spawn。

**SOURCE APPROVE：Critical 0 / Important 0 / Minor 0。** 七个旧负例的限定适配符合既已批准的 current-approval 强校验契约，没有发现削弱原测试语义的修改。定向实际运行仍为 **UNRUN**；本结论不是 15 个测试 PASS，不闭合原全 unit 的六个失败，也不宣布 POL01/全部 gates 完成。

## 冻结与范围

VM2 freeze：`/tmp/atlas-final-fs-kn-pol-20261011-luyk2kob/evidence/pol01-unit-contract-repair-20261011`。完整阅读原报告、patch、四文件 before/after、原 unit 失败和实际 SDK/helper 调用方。未执行 build/test/产品源码/服务，未改源码或 DB，未 stage/commit/push。唯一新增产物是本报告；本机证据副本为 `pol01-unit-contract-review-inputs/`。

开始与结束独立计算下列 SHA 一致；全部 before 4 / after 4 实际文件均逐字节通过清单验证。

| 冻结输入 | 开始及结束 SHA-256 |
|---|---|
| after.sha256 | `13b95a3b4772f25e83efff7bc4b1cb2a8ac111557057720d5a12985cc4bc5923` |
| before.sha256 | `bdcb6753817c40c95ec767f1e8b586f9911750f75f2271a41d00c99476ace28f` |
| window.patch | `d217930f9480f6bc1ae63f220c00683334113df9b824f0684233d0b598f39d12` |
| author-report.md | `61597f567e50568a3e233cbe94c378f07ee62331d3a4542afcbdb5068dc6e7fd` |

| after 路径 | SHA-256 |
|---|---|
| tests/integration/commonjs-resolution.test.ts | `736272c8eda52fe2c2a16bf5959e616c8de5b8e939ce507a5abe620b902f0347` |
| tests/integration/forwarding-resolution.test.ts | `961a8dbbfc244a3094b9a3ec8c2e5d05a0dd4f842c05d65389761ecc12ecb56e` |
| tests/integration/tsconfig-resolution.test.ts | `d043222550c14a29a141d6ddd4ed80f215df30c49d35a39b678feaaf9b5b1f9c` |
| tests/integration/mcp-stdio.test.ts | `a3f2b7dbcf5c66653aae3f94cb024c059f2f0d006bebaecd154327d026c6bf1e` |

## 原问题与契约

原 `original-unit.log` SHA `69b0cb8b3aefc15be91e697fb6b515bfadbdb7494502fdaf623fdc6276d551fe` 已独立核对。其真实结果是 1336 PASS / 6 FAIL，112 文件；六个失败均显示实际 SDK `isError:true`、JSON `code:NOT_APPROVED,status:409` 与旧成功返回要求相冲突。forwarding 的第二个 restart 负例被第一个失败阻断，所以这是六个原失败、七个需要适配的调用，并非七个已经实际执行的失败。

实际、未改的 `apps/mcp/src/server.ts:305–312` 先验证 ownedPlan，再调用 `/api/plans/:id/approved`；`:115–117` 把用例异常包装成 SDK isError。它拒绝 draft/stale/historical-only current approval，与 POL01 spec 的 readApprovedPlan/current-approval freshness 要求相符。普通 `/api/plans/:id` 仍可读取历史 detail。把两类读取分别验证是正确的 contract 修复，无需退回旧 MCP 成功结果。

## 七处变更核对

- **commonjs after:172–193、tsconfig after:141–161：** 用真实 `mcp.client.callTool` 取代只允许成功的 `mcp.call`。逐项断言 isError 严格 true、第一项 content.type 为 text、解析 JSON 的 code/status 精确为 NOT_APPROVED/409；原普通 HTTP stale detail 的 valid/status/revision/operations/approval，以及 commonjs baseline snapshot 断言原样保留。包/config 刷新、函数身份、源码字节、路由和 SQLite 历史断言未改。
- **forwarding after:157–190、210–233：** alias-only refresh 及实际 server/SDK restart 后两处都执行同样的真实 SDK 精确负例。第一次完整 stale detail 断言保持；restart 后补普通 HTTP detail 精确等于此前 stale，使原历史对象全值比较继续成立。真实 leaf 身份、snapshots、审批历史 settings、routes、stderr/protocol、PID 与根目录清理断言保持。
- **mcp-stdio after:365–372、396–410、601–615：** 三处调用改为原有 `call`，严格要求 `{error:true,value:{code:NOT_APPROVED,status:409}}`。实际未改的 `call:133–144` 校验 text、解析 JSON，并用 `result.isError === true` 生成 error；没有靠 catch 或泛化 toThrow 允许任意错误。原 draft revision3、source-change stale、restart 后 draft revision2 与历史 approval 均通过新增普通 HTTP 读取保留。原 explicit baseline 冲突仍要求 BASELINE_CONFLICT/409。
- **正向与历史语义：** `mcp-stdio:353–357` 的真实 HTTP approve → SDK success → 完整 detail 等值、valid:true、issues 与 semanticHash 仍在；后续历史 revision2 的 verify_implementation 断言未变。其余工具列表/所有权/预算、source-resolution、组与路由持久化、cleanup 均未改。没有 skip、retry、timeout 增加、通用 error allowance 或生产 helper 调整。

## 独立字节保护与验证边界

除阅读作者 byte-guard.log 外，我另以 Python 对实际候选文件重算三个 captured 清单：`product-before.sha256` 全部 123 路径、`protected-original5.sha256` 全部五个先前已审 callback 路径、`support-before.sha256` 的 production.mjs，均与捕获值相同。共享 helper 的 SHA 是 `4a2228e53a47c0f1731faa89c1ffdea7f4241b6916cb525202d2a62fe084af42`；其 success-only `call:123–126` 未放宽，只有七个明确负例绕过该成功包装读取真实 SDK response。

四文件 ESLint/Prettier 成功收据已阅；首 lint PATH 缺 node 的真实失败仍保留，不被称为产品失败。本审查未复跑静态命令。mcp-stdio 的 beforeAll:155 起会编译真实 package/server/MCP，因此待 root browser 释放共享候选产物后再运行的安排有实际依据，不能与现行浏览器 gate 并行重建。

允许进入后续定向真实运行并追加原始收据；运行通过前，原 6 FAIL 只完成源码适配，运行结论保持未验证。结束 SHA 全部与开始一致；原报告、原失败日志、原五路径 APPROVE 和冻结源码均未被本审查修改。
