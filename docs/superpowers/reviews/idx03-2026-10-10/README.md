# IDX03 最终独立验收报告

本票委派范围已实现并通过最终定向门禁。原 gpt-6.1-sol high reviewer 限定复审 APPROVE，C=0 / I=0 / M=0。主控仍负责 clean 全仓集成 CI、ticket/state/README 与 commit/push；此报告没有把其他票的新模块或主控全仓 CI 计为本票成功。

## 交付行为

捕获静态 tsconfig references（目录或任意名字 .json），沿既有受限 MetadataReader 读取、参加既有 v3 contentHash。原始 path 在拼接前拒绝绝对、drive、UNC、URL、NUL；missing、ignored、symlink、循环、形状错误和预算边界保留可读诊断。引用不继承 compilerOptions/extends 的 references，不执行目标或 emit。

配置自身 closure、anchor 可达发现与独立 leaf 归属分开。缺失边使 solution root 自身授权失效；被观察到、有效且唯一拥有源码的 named leaf 保留独立归属。每个 owned scope checker 只注入自己的 roots，依赖模块只经证明的实际 import/require 按需加载。无 import 或仅 side-effect global import 的跨 scope symbol 始终 unknown。先分析全 capture 的物理 CommonJS namespace 写入/逃逸 veto，再决定导出与调用；没有把其他 scope globals 注入 checker。既有函数身份格式保持。

公共 coverage.configurationProjectGraph 可选以兼容历史 snapshot。图按 50 roots / 50 projects / 100 references / 50 scopes 返回稳定样本，保留 observed counts、状态、逐集合 truncated 与文本截断标记。counts 非负安全整数、scope 四类别总和、returned≤observed、truncated 一致性均严格验证。checker 不依赖公共样本。内部 capture 512配置/单文件256KiB/总4MiB、图2048边/16深度有界，超限不取得授权。

UI 在现有 Advanced → indexing diagnostics 中渐进披露只读配置图；显示历史未记录、partial、全观察计数、样本比例、遗漏与原始路径/诊断；en/zh 词条一致。没有新增服务 API、MCP tool、storage migration 或改首用外层。

## 冻结与最终门禁

source-freeze.json 冻结 40 文件（产品源码、定向测试、两个主要 gate helpers、锁）；compiled-input-before.json 冻结 79 编译输入（core/indexer dist、既有 server/MCP entry、web dist、运行 helpers、锁）。core → indexer → web 使用授权 scoped build。compiled-input-after.json 核对全部40/79一致，无源码或编译文件变化；source-freeze SHA：83e14e94024ce1a32d803e34e1ca5f7211b86d4c3197cb70b4e9fda8da2263fc。

Supplementary visual helper 在主要冻结后新增，只重索引同一最终 fixture 并断言相同 contentHash；其独立 SHA 写在 after receipt，没有修改冻结产品或主要 helper。lint-final.log 与 helper-lint-final.log 均成功。

| 门禁 | 最终结果 | 原始证据 |
| --- | --- | --- |
| 全 indexer + graph schema + panel/locale | 16 files / 483 PASS：indexer 441（原393全部保留，新增48）、schema30、panel7、locale5 | scoped-final.log |
| 既有 core validation + 新 graph schema | 101 PASS（旧71+新30，早期 schema 验证阶段） | schema-green-first.log |
| scoped core/indexer/web build | 均 PASS，web 保留已有 >500KB chunk warning | core-build-final.log / indexer-build-final.log / web-build-final.log |
| 真实 references HTTP/MCP/SQLite/restart/browser | PASS，随机端口独立临时DB，66 source bytes 完整比对 | product-final.log / references-product.json / fixture-source.json |
| 最终补充真实 panel + source/en/zh | PASS，同最终 contentHash，errors/external空 | visual-final.log / supplementary-visual.json |
| 完整固定 Express HTTP/SDK/browser | PASS：142 files、3070 functions、35/35严格入口，createApplication包含于未截断入口结果 | express-final.log / express-after-idx03-product.json |
| 独立 code review | APPROVE，C0/I0/M0，9复审文件SHA核对冻结记录 | implementation-review-rev1-raw.md |

可复跑命令（repo root，先按主控协调 scoped build）：

```sh
npx vitest run packages/indexer/src packages/core/src/projectReferenceSchema.test.ts apps/web/src/app/ConfigurationProjectGraphPanel.test.tsx apps/web/src/i18n/locale.test.tsx
npm run build --workspace @codemap/core
npm run build --workspace @codemap/indexer
npm run build --workspace @codemap/web
node tests/support/idx03-validate.mjs
node tests/support/idx03-visual-evidence.mjs
node tests/support/idx03-express-validate.mjs --path /tmp/atlasmode-idx01-express --commit dbac741a49a5a64336b70c06e85c2e2706e36336 --symbol createApplication --file lib/express.js --label express-after-idx03 --require-entry
```

main helper 创建新的 fixture 与独立运行环境；补充 helper 读取本目录最终 JSON 的留存 fixture。Express 目标为完整 upstream v5.2.1 checkout，验收前后 gitRevision 均 dbac741a49a5a64336b70c06e85c2e2706e36336 且 clean=true。目标源码与 upstream tests 均未执行。

## 实际 fixture / HTTP / SDK / 浏览器证据

最终 fixture 留存 /tmp/atlasmode-idx03-fixture-IZpWRj；跨项目副本 /tmp/atlasmode-idx03-isolated-MQ5dlC。输入由 fixture-source.json 完整留存，变化配置在 references-product.json.changedConfigurations。目标 execution marker 未创建。运行 server/SDK stdio/Chromium/DB 已 cleanup，fixture源码留存。

- root files:[] 引用有效 configs/app.json、bulk.json、mutator.json 与 missing；app 又引用 lib.json/cjslib.json。初始图1 root/6 projects/6 references，partial；5 named leaves 有效，root invalid。66 TS/JS source scopes中65 resolved、1 unconfigured、0 ambiguous/invalid；公开 scopes50/66，遗漏不被标成 unknown。
- 合法 named binding 的 app/entry.ts → lib/main.ts 为实际 resolved。noImport 与 sideEffect 的 helper()，以及其他 scope mutator 写入 cjslib 导出后的 cjsEntry 均 unknown；三个 HTTP/MCP 完整 context 保存于 negativeContexts，未制造跨 scope global/CJS连边。
- 仅 configs/app.json paths @leaf 从 main.ts 改 other.ts，产生新 hash / snapshot，resolved目标切换；66源文件字节与函数IDs保持。再仅 root references 添加 ../../outside，产生第三新 hash / snapshot、7 references、可读越界理由，合法 leaf继续独立有效。
- HTTPsummary/MCPsummary同图、计数、状态；HTTPsource逐一比对全部66源文件。MCP提供源码位置与call evidence，没有 read_source tool，未冒称MCP返回源码全文。
- 初始审批与作者路线保持原revision、baseline、semanticHash与中文原文；新 snapshot 下审批显示 stale/BASELINE_MISMATCH。SQLite全部旧/当前snapshots、approval、route保持原样，重启后再确认；第二项目ID/函数不同，cross-project HTTP404/MCPisError。
- browser真实点击 Advanced、diagnostics、配置图与references/scopes；missing理由、50/66与遗漏提示可读。搜索 noImport、打开source实际显示helper() unresolved。语言选择en→zh保留原始配置路径/诊断。
- errors、external requests、protocolErrors为空；MCP stderr空。readonly实际AtlasMode capture另存 atlasmode-readonly.json：现有 exports 指向被排除 dist，143 WORKSPACE_MAPPING_UNAVAILABLE 保持unknown。自身无 references，未把该盘点算作references positive。

三阶段 snapshot / contentHash：

| 阶段 | snapshot | hash |
| --- | --- | --- |
| 初始 | snapshot:bc56dc3e81212c684272d12aa0310bf2 | 295dce1b9cc4549b149e2f77f1bf57071462fdcd1f69fca3c2ce3a3336eab385 |
| 仅 options | snapshot:5b3690024703fea8e492400c5d512d85 | 7f6f42a07a2b9780b7e5f8cbbc373f1396f828017318d9b4f7f3f2fa1c10b3a1 |
| 仅 references | snapshot:e48b0e8051ae2ed9802c499c0662f65a | 1783d164396dc81f27f8b31e65700708e7ee95b04378b3e1e34292dbc10a9a44 |

最终截图实际打开检查：references-graph-overview.png 图partial/计数/有效named leaves与invalidroot可读；references-no-import-unknown.png source/helper unresolved可读；references-graph-zh.png 中文图及原始路径可读；express-after-idx03-product.png createApplication源码与resolved入边可读。earlier-product-stage 和 product-first.log 属复审修复前63source阶段，完整保留但不作为最终修复通过证据。

## TDD 与失败记录

capture-red.log（23fail/1pass）→capture-green-first.log；scope-red.log（13fail/2pass）→scope-green-first.log；schema-red.log（3fail/27pass）→schema-green-first.log；UI最初missing-module ui-red.log保留，真正null stub行为RED ui-behavior-red.log（7fail）→ui-green-first.log。命令错误 indexer-first.log 无测试文件、现有plural diagnostic兼容失败 indexer-green-first.log（431pass/1fail）均原样保留，后续 scoped-final483 PASS。

原独立实现审查 implementation-review-rev0-raw.md 为 C0/I3/M0：递归恢复后边预算、path/depth/anchor授权、跨scope物理namespace mutation。五个新增真实失败 review-red.log →review-green-first.log；额外forwarder canonical leaf负例 review-forward-red.log（1fail/5pass）→review-green.log（6pass）。严格边/深度/其他anchor已捕获节点都没有授权回落。原问题及所有RED未覆盖或改写。

原设计review rev0（2 Important/3Minor）与原spec/plan备份rev0/保留；rev1设计APPROVE保存。rev1-reviewed/留存当时审查文档字节，之后当前spec/plan仅追加已授权实施/交付阶段，不能将后阶段证据回填为原阶段执行。

Express首条遗漏必填 --path 的命令在开始gate前退出，express-cli-first-fail.log保留；补齐参数后的 express-final.log 才是最终通过记录。Vite现有chunk warning保留，不计为性能票验收。

## Ownership 与余项

IDX03 own：packages/indexer/src五个既有实现文件+七个新helper/test/types；core model/validation可选图字段+专属schema test；Navigation只读section、en/zh19词条、新Panel及test；三个IDX03验收helpers、专属spec/plan/report。owned-product.diff / owned-files.json 提供精确清单。

core/model.ts 唯独 RecordKind annotations 一行是主控要求代写 KN01 依赖（kn01-shared-dependency.md），不计为IDX03新功能。core/index.ts及KN/POL新模块未由本票编辑，scopedbuild依赖它们已存在但没有宣称其功能验收。没有改service/server/MCP接口、root/package-lock、IDX01/02冻结证据、共享state/tickets/README、用户AGENTS、GRP02其余UI；没有gitadd/commit/push。

Navigation/en/zh/Panel于最终输入冻结后不再修改，UI窗口已交回主控可移交FS01。由于共享工作区其他票仍有未提交变更，全仓clean隔离集成CI与提交必须由主控完成。自己的确定验收项无剩余失败；其余保守边界保持明确：只有捕获静态references/唯一owned TS/JS源码授权；无运行时/动态代码/目标build/declaration输出猜测；预算之外不宣称完整依赖总量；历史missing图为未记录；dist排除和无callable binding仍unknown；未承诺TypeScript solution build有效性或性能规模门禁。

## 限定提交补充：共享 hunks 与冻结 UI 原始字节

主控要求基于 HEAD 619c39a82a4a9d6d3d8c8dec2a8846f7f00d52f2 限定 IDX 提交，材料如下：

- idx03-shared-core-only.patch：仅 model 的 ConfigurationScopeStatus / ConfigurationProjectGraph / optional coverage 字段与 validation 的 graph schema。没有 RecordKind annotations、KN schema、POL字段、core/index.ts出口；无需新增 core export，HEAD barrel 已导出 model/validation。
- idx03-frozen-ui-only.patch：仅冻结 Navigation 两处调用/import 与 en/zh19词条。与后续 FS UI改动分开。
- idx03-submit-whitelist.json：18独占产品/tests/helpers文件、两个shared patch、专属spec/plan/report目录。旧 owned-product.diff 为共享验收状态全diff，含注明的 KN dependency，不应直接拿它代替新的限定提交patch。
- final-source-blobs/：source-freeze40全部原始字节按repo path留存，每个SHA重新核对一致。Nav/i18n冻结字节已可复现，不会将FS后续修改纳入本票原冻结收据。
- shared-patch-check.log：以独立临时 GIT_INDEX_FILE 的 read-tree(base) 做 git apply --cached --check，两patch通过；没有触碰实际index、gitadd或提交。

**独立构建边界**：本票最终 scoped core build 是共享worktree构建，core/src/index.ts 当时有另票未提交出口 ./structure-types.js、./structure.js、./annotations.js，完整对应 files 均存在；core tsconfig include src/**/*.ts，因此这些另票文件也被编译。这三出口与 RecordKind annotations 不是IDX03产品依赖，IDX新源码依赖的core符号仅graph model types、normalizeRepoPath及既有schema/模型通路；新panel只type-import ConfigurationProjectGraph。没有运行独立clean IDX-only candidate build，不能将共享scoped PASS称为隔离IDX-only PASS。

主控可从明确base仅取新core/UI patches与独占白名单（保留HEAD core/index.ts三个既有出口，不取KN/POL新文件/出口/RecordKind行）构建clean候选；它的build/CI结果由主控新阶段记录。现有40source/79compiled真实gate及SHA保持原样，不被重新解释为该未来候选门禁。


## 后续 clean integration E2E 修复阶段

主控clean npmci/build/typecheck/lint/882tests/smoke PASS 后，原完整E2E实际14/19 PASS、5FAIL：CommonJS3与tsconfig2因新nested graph details导致summary locator strictmode。保留原全套JSON/全部screens/traces；仅修授权两spec direct-child summary和诊断容器定位，原source/coverage/SDK/zh/en/unknown断言全部保留。相同clean candidate定向5/5 PASS+scopedlint PASS，122 product inputs/146compiled不变；没有重跑其余14或根882，不称全套重跑19PASS。精确SHA/patch与修复后冻结spec字节在 integration/e2e-locator-repair/README.md、after.json、selector-only.patch、revised-source/；原sourcefreeze40/compiled79与FS后续差异不改。
