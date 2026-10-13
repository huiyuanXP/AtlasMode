# POL-01 shared callback window — frozen author report

此窄窗口已完成，状态为 READY FOR INDEPENDENT REVIEW；整票仍 PARTIAL，等待主控独立 high 代码复审及同候选更广最终门禁。原明确模型保持 gpt-6.1-sol high；没有 spawn、commit、push、stage、index 操作或共享 dist/root build。

精确候选 `/tmp/atlas-pol01-callback-20261011-40dxsb3i/workspace`。仅从只读 approvedbase `/tmp/atlas-integration-fs-kn-pol-20261010-c9d842hi/workspace` 复制，按冻结清单叠加 KN R2 exact23、POL UI/MCP R1 exact9、POL production3、授权本窗口5路径及独立批准 CSS 单文件 ab1c5b…；没有从在途 checkout 整树复制。候选父目录 overlay-manifest.json 保留 overlayHistory 和最后有效唯一映射。candidate-source.sha256 冻结312个输入文件，SHA523b06bd576c9a22a8f2b65d7e887e54ce291ac643c3943c694cb0e4c31adc20。

## 审查三输入

- `before/` + before.sha256：修改前43个原始文件/依赖/报告，清单 SHAd1bc97acf68e741c1cfbad655aa1ff534c25ba1fc556f6f254bbf5c0ddf14e10；原 workspace SHA4d5fc0…、planning 整文件 SHA5efae996…、新 nativefixture 原943049…均保存。
- `after/` + after.sha256 + window.patch：最终5路径；after manifest SHA17d85796c38849a8c13c40834aa1cb12b08663d3489e8a85c0da4a9ae23a4d72；patch SHAc002aa35f41e32ceef1be7e0d08955369e4a5606a1e17508b9881f9558361664。
- 本 author-report.md、root-rulings.md、byte-guard-final.log、完整 runtime-evidence/、source RED/GREEN/type/lint/format原日志、trace-409-proof.json。历史独立报告和旧 receipts 保留原文，不覆盖。

| 最终 owned path | SHA256 |
|---|---|
| apps/web/src/app/workspace.ts | 77bb9744d2b1e7b70f16679a887c6118a14128701e887a65f098b3e7b8a973c5 |
| apps/web/src/app/Navigation.tsx | e7e4623080c934f08a187188fb5cdbf631bdf47ea036a49c10bc2ed481b98d45 |
| apps/web/src/app/pol01-policy-sync.test.ts | f5e450a193a0ef197bacd635a46db609a3421d884cecaead4bf379e0c2eb89b3 |
| tests/e2e/planning.spec.mjs | 153a7087714a89983bb1af9ba23b285b7edc00a27695ffcf849fd1e883c1f0b8 |
| tests/e2e/pol01-structure.spec.ts | 7317521476fd698091977f728ac6ac13116f7caec973ff81c8581aa67822554b |

## 产品接线与保护

Workspace 新增 public acceptPolicyWrite/acceptPolicyRead，接到实际 Navigation 的 PoliciesPanel onAccepted/onReadAccepted。回调只发 GET policies/plans/summary/strong currentApproval；不重发任何已知 ACK 写请求，不自动获取 latest CAS 来重试。同步错误会 reject 到独立 controller，保存成功后共享同步失败仍保持 saved/imported notice、WORKSPACE_SYNC_REQUIRED、显式 reload，不能冒充 unknown write。

每次同步捕获当前 project、ownershipEpoch、sync generation、focus/plan ID/revision、source snapshot/hash；跨项目 A→B→A、同 epoch late failure、选择计划变化都不能发布旧状态或清掉新 owner busy。入口拒绝不会取得新 generation/lease。只允许真正 HTTP409/code NOT_APPROVED 作为强 currentApproval 的已未批准结果；context-invalid、503、foreign/mismatched v1 receipt都 reject。

历史 approval 对象保留。dirty plan 的原 body/revision/CAS、source 与 group draft保持；刷新列表显示服务真实 revision，不人为 +1 或 rebase。notes mutating/其他 knowledge owner busy时拒绝；finally仅清本 owner，保留 annotationBusyOwned/mutating。53个旧 Workspace函数体逐字节相同，client整文件857148…与 KN controller98c138…相同；其余 KN R2 22路径和 POL9全部按旧清单验证。Planning/service workspace/structure-sync整文件89fdba…/b3a9f0…/467dd4…及 FS update包含其中均不变。没有修改 annotations模型、KN刷新、服务/HTTP/MCP产品、SQLite、Web i18n/Panels、CSS或globaldocs。现役 mandatory StructureFilePort 未退回 optional。

## 授权 fixture delta（并非“仅四个 locator”）

planning 保留原整文件，最终差异按主控逐项授权：四种旧 locator名称在9个实际调用中换名；另一个真实 selector改为 Edit policy/legacy:${policy.id}；两处 knownACK后、下一编辑前增加可见 Read structure again +等待Save enabled，并额外断言读取本身不改变revision；旧 invalid-current MCP负例换为真实 SDK callTool并精确断言isError true/code NOT_APPROVED/status409，以符合已审准强guard，而非旧 valid:false 返回。后续 positive审批、历史、groups、forbidden、全部 +1/+2 断言保留。

原 planning 末尾只因3条浏览器网络409 console失败。root直接读zip独立核证，3条均本candidate origin同一 selected plan 的GET currentApproval、HTTP409和真实body NOT_APPROVED，console.location().url均存在且完全相同。最后 collector保留所有 rawConsoleErrors，捕获实际完整response URL/method/status/JSON，严格exact selected-plan URL、计数3、每条bodycode、每个唯一console index一对一关联后才归类expected。pageerror从未过滤；任何其他console、missing location、异常bodycode、计数不等仍FAIL；原 errors[]空断言继续约束未归类错误。raw和typed及对应列表均在joint-flow-evidence.json保存。byte-guard用 AST确认collector前82个授权领域/positive/history/revision/error断言全部原字节保留。

新 nativefixture原先UNRUN，首次实际执行暴露400完整viewshape缺失；仅补positions:{}、theme:'light'、locale:'en'，PUT method保留（最初口述POST为描述错误）。随后真实POST已200而fixture未编码URL导致等响应超时；仅4个响应谓词 encodeURIComponent(project.id)，并按Prettier格式化。所有HTTP method/status/body、unsent/import、原字节/unknown字段、409/reload/quarantine/restart断言原样保留。

## 实际验证与原失败

- 第一轮 source RED：13 FAIL（新callbacks不存在）。GREEN13；新确定性 lease negative：13PASS/1FAIL，拒绝的quarantine read夺旧generation；修 deferred generation 后14PASS。`source-red.txt`、`source-green-first.txt`、`source-red-lease.txt`、`source-green-final.txt`、private `runtime-evidence/source-final14.txt`原日志均保留。最终14测试对应当前f5e450…测试与77bb974…产品source；这是 source-alias unit，有HTTP transport mock，不称真实HTTP或mounted proof。
- private Web + MCP build PASS；只编译该私有两workspace。原大chunk警告保留。main shared dist和root全build未执行。
- compiled stdio3 PASS：`runtime-evidence/compiled-stdio3.txt`；实际 node apps/server/dist/index.js、node apps/mcp/dist/index.js 子进程，真实 SQLite/FileStore 与 SDK Stdio transport。Vitest source aliases仅用于 fixture seed/协调器控制器，未用于 compiled 子进程。
- 原生policy2最终同一单轮2PASS：`runtime-evidence/policy-browser2-final.txt`、policy-results-final.json；actual built assets/原生控件/真实HTTP，无HTTP mock或DOM注入。DB-only先编辑不迁移/原file bytes不变，显式preview/import保unsentB，实际409保草稿且只显式读取重新capture，unknown/purpose保留，invalid/quarantine写禁用与真实重启保malformed bytes。截图 native-policy-panel/native-quarantine-panel 已实际查看；quarantine截图视口仅露出invalid状态，禁写还由原生DOM断言证明，不夸称截图展示了所有below-fold内容。
- 原 planning完整flow最终1PASS：`runtime-evidence/planning-browser-typed.txt`与planning-results-typed.json；执行原 +2/groups、两次policy +1/+2、history保留、后续正向审批、JSON/Markdown、真实SDK、source不执行、源改变验证、restart/persistence、theme/locale/Python切换与无外部网络；expectedCurrentApproval3响应/3console单独精确入证。
- scoped noEmit4 TS输入 PASS（含callback3及nativefixture），`runtime-evidence/source-types-final4.txt`；main equivalent3先也PASS。owned5 ESLint PASS，四个TS/TSX Prettier检查PASS。planning保持原外围排版，未整文件重排。
- 第一类型检查失败为新fixture coverage属性误填included（不是core产品RED），修成现役excludedPatterns/unresolvedCount；原source-types-first保留。format-first失败及nativefixture格式整理记录保留。
- Browser原始400双FAIL、viewfix后1PASS/1FAIL encodedURL、planning旧name/旧option双FAIL、未批准MCP合同FAIL、末尾typed409 console FAIL所有txt/JSON/PNG/trace原件分别封存，没有覆盖成最终PASS。一次保护性patch脚本发现'fill internal'重复而拒绝写入，后续误复跑旧fixture亦保留；这是作者工具/fixture问题，不归为新产品缺陷。另一次旧Responsibility宽匹配安全拒绝，改为实际getByLabel调用。`author-tool-faults.md`明确原tool输出摘要与重建记录区别。

本窗口没有 pnpm 安装；旧37/106摘要命令纠正已在既存 production-acceptance/before/ui-mcp-window/historical-command-correction.md保留，本报告不将重建命令冒称旧shell原记录。

## 实际执行命令与复核

以下是本轮实际final命令核心，工作目录为上述privatecandidate（lint实际在live主checkout同SHA的5文件；其余private命令日志已保存）。NODE_OPTIONS指向自己的只观察子进程的runtime-observer，记录不改变HTTP业务。

```sh
npm run build --workspace @codemap/web
npm run build --workspace @codemap/mcp
node_modules/.bin/vitest run --config ../source-vitest.config.mjs apps/web/src/app/pol01-policy-sync.test.ts
POL01_ACCEPTANCE_MODE=compiled NODE_OPTIONS=--import=/tmp/atlas-pol01-callback-20261011-40dxsb3i/runtime-observer.mjs node_modules/.bin/vitest run --config ../source-vitest.config.mjs tests/integration/pol01-stdio-acceptance.test.ts
POL01_PRODUCTION_GATE=1 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/atlas-pol01-callback-20261011-40dxsb3i/policy-results-final.json NODE_OPTIONS=--import=/tmp/atlas-pol01-callback-20261011-40dxsb3i/runtime-observer.mjs node_modules/.bin/playwright test tests/e2e/pol01-structure.spec.ts --output ../policy-results-final --reporter list,json
PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/atlas-pol01-callback-20261011-40dxsb3i/planning-results-typed.json NODE_OPTIONS=--import=/tmp/atlas-pol01-callback-20261011-40dxsb3i/runtime-observer.mjs node_modules/.bin/playwright test tests/e2e/planning.spec.mjs --output ../planning-results-typed --reporter list,json
node_modules/.bin/tsc -p ../source-tsconfig-final4.json
```

## Runtime清理和剩余门禁

最终 runtime-final-check.json：72个observed自己Node/直接child PID均ESRCH，22个observed API ports均连接拒绝；没有kill他人进程或全局清理。17个owned roots中，11个POL fixture roots保留完整数据/源文件/SQLite/runtime-receipt，清单在owned-fixture-receipts/；6个原 planning roots由其未改finally按原行为rm，前三轮尚无退出前archive，但所有原trace/log/source generator保留；之后三root在API退出、原test删除前完整封存5个阶段source/SQLite快照到retained-planning-fixtures/，有明确before-cleanup观察记录。不能宣称17个原临时root都仍存在。所有源代码与本报告证据留存，无现役测试runtime/自己tunnel残留。

source5与privatecandidate至此冻结，不再写产品；Workspace/Navigation共享ownership释放。root可对同候选执行广泛npm build/typecheck/lint/smoke/fullunit/legacy19/FS9/Notes7，再安排原high正式窄复审。独立审查与这些root最终门禁未完成前，本窗口的source/compiled/nativePASS不等于POL整票DONE。
