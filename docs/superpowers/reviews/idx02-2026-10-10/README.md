# IDX-02 验收报告

结论：DONE 候选，可由主控集成。独立 gpt-6.1-sol high 复审 APPROVE，Critical/Important 清零。本报告只声明 indexer 定向检查与实际产品 gate；根 CI、共享票据/state 更新和 commit/push 由主控完成。

## 实际功能与验收对应

| 票据要求 | 已实现/实际结果 | 证据 |
| --- | --- | --- |
| 捕获 package workspaces/exports 并映射授权源码 | 复用 scanner 精确 manifest bytes、既有捕获预算和 v3 hash；nearest workspace/package 注册表，仅映射唯一注册包与自身 exports，保留实际叶函数和物理文件身份 | workspaceResolution.ts；fixture-source.json；workspace-product.json |
| 条件/动态不确定项 unknown | 支持有序 import/require/default 选择、同源未知条件收敛、root/exact/single-star exports；分歧、null/数组、无匹配/无授权目标、非法路径/manifest、超限均 unknown。有明确 paths 的 scope 优先，失败不回退 workspace | 44 项新测试；原始 RED/GREEN；workspace-product.json 中 uncertain/blocked/type-only 实际 context |
| 配置新鲜度 | 仅改 lib exports，entry 的叶目标 main.ts→other.ts；再仅改 root workspaces 移除 consumer，entry→unknown。三份 contentHash/snapshotId 不同，源码字节及函数 ID 保持稳定 | product-final.log；完整三快照与 contexts 存于 workspace-product.json |
| 历史 | 旧审批内容/approval 原样、路线作者内容原样、旧快照完整深比较原样，当前审批与路线 stale；关闭数据库/服务后重启仍成立 | workspace-product.json 的 approved/stale/route/history；实际 SQLite 检查断言在 helper |
| 跨包/跨项目隔离 | duplicate names、nested/unregistered/opaque package、nearest independent workspace 均覆盖。第二个真实项目相同包名/路径拥有独立 node ID 和叶目标，跨项目 node 请求 HTTP404/MCP isError | 新测试；workspace-product.json isolated |
| 实际 HTTP/MCP/浏览器/source | 实际编译服务、SDK stdio、Chromium 开项目/搜索/关系/源码；10/10支持源码HTTP原字节一致；页面与协议错误/外部请求均空；sentinel 未执行 | product-final.log、workspace-product.json、fixture-source.json、workspace-before.png、workspace-after-exports.png |
| 保留 IDX-01 | 349 原测试加44新测试=393/9 PASS；固定完整 Express 严格入口仍35/35完整返回，createApplication exported=true且真实返回包含其ID | indexer-final.log；express-final.log；express-after-idx02-product.json/PNG |

## 最终阶段收据

代码冻结后仅 build indexer，使用已有编译 server/MCP/web；19 项源码/测试/helper/编译入口/web assets/lock hashes 在两个最终真实 gate 前后完全相同。见 input-final-before.json 与 input-final-after.json。源码冻结时 Git HEAD 仅作背景；工作区含并行 AG05/GRP02 等未提交改动，不能称整仓固定发布构建。SEC lock 保持 f26ef3a7cf494becb903226ef01d86dfa7ca1e014c271e284bb0db1b9cee49c4。

最终命令与结果：

- npx vitest run packages/indexer：393 tests / 9 files PASS，含 IDX01 的17项、CommonJS183项与44项IDX02。
- npm run build -w @codemap/indexer：PASS（build-final.log）。
- npm run typecheck -w @codemap/indexer：PASS（typecheck-final.log）。
- owned indexer/helper 定向 eslint：PASS（lint-final.log）。
- node tests/support/idx02-validate.mjs：PASS（product-final.log）。实际 fixture 10 files / 9 functions /39 relations，已解决3次调用，其余不确定项保持 unknown。
- node tests/support/idx02-express-validate.mjs --path /tmp/atlasmode-idx01-express --commit dbac741a49a5a64336b70c06e85c2e2706e36336 --symbol createApplication --file lib/express.js --label express-after-idx02 --require-entry：PASS（express-final.log）。142files、42folders、3070functions、15216relations；35/35 entrypoints、未截断；实际 root 完整context16incoming/5outgoing及完整source保留。

浏览器最终 PNG 已复制至主机任务目录并实际视觉核对：main.ts 原叶目标、other.ts 更新后真实 caller 与 return "other" 源码，Express createApplication 实际节点/源码/16调用方均可读。完整 JSON 证据承载截图中未展开的全部关系与源码。

## 原始失败及修复轨迹

历史 IDX01 FAIL 记录未编辑。此次所有有价值的失败证据保留：

- red.log：初版24测试23fail/1pass；red-amended.log：设计审查补齐后26测试25fail/1pass。
- green-first.log：26pass。review-red.log：独立审查4类边界新增后8fail/27pass；review-green.log：42pass。
- review2-red.log：own __proto__ 条件丢失与 NODE_MODULES 大小写禁止段2fail/42pass，修复为 Object.create(null) 保留自有键、大小写无关拒绝。
- build-first-fail.log：TS target/subpath narrowing，已修复。
- indexer-regression-fail.log：TS 合成 CommonJS Alias 调 getImmediateAliasedSymbol 导致 DebugFailure；仅真实 import/export alias 声明可跳转，最终393全部通过。
- product-first-fail.log / workspace-product-first-fail.json：helper HTTP50与MCP200分页元数据不等；统一limit50，实际小fixture context完整。旧失败未冒充通过。
- earlier-product-stage/ 保存早阶段成功产品 JSON/PNG/log。它们发生于最后 alias/__proto__ 修订之前，不能作为最终代码 gate；最终代码重新完成两 gate，并独立哈希确认。

## 支持范围与剩余不确定项

支持 workspaces 字符串目录/单目录段 *（也支持 object.packages 数组）；exports root/exact/single-star；import/require/default 与所有可选分支同源的保守条件求值。未知条件会尝试启用/禁用两种可能；嵌套 NO_MATCH 才继续父级，BLOCKED/INVALID/缺失目标不得 fallback。条件/替换限16层与2048工作单位。

完整 Node loader、任意 workspace glob、main/index/扩展名补全、运行时 flags/custom loader、dist→src 推断、project references 不支持。数组/动态/不收敛条件、被排除/忽略/符号链接/捕获预算失效的目标、无效manifest和越包路径 unknown，并有 WORKSPACE_MAPPING_UNAVAILABLE 诊断。类型专用 import/namespace/re-export 可提供源码 import 边，但不能变成 runtime callable identity。

真实 AtlasMode 整个支持源码 readonly capture：8份 package manifests，122项 @codemap 映射仍unknown，原因是 exports 指向排除的 dist 实现；不猜 src。见 atlasmode-readonly.json 与 atlasmode-package-inputs.json。后者精确manifest bytes在最终真实源码capture之后独立读取，明确阶段，不称为同一次原子capture。此合理限制已独立review确认不构成本票未完成。

没有剩余 Critical/Important 或票内阻断。主控还需集成共享文档并进行其根 CI。目标源码/上游脚本/上游测试未执行，无新依赖/安装，无生产部署、commit或push。

## 范围、清理及移交

Owned diff：packages/indexer/src/{workspaceResolution.ts,workspaceResolution.test.ts,configResolution.ts,typescript.ts,index.ts}；tests/support/{idx02-validate.mjs,idx02-express-validate.mjs}；独立 IDX02 spec/plan/review目录。未改 core/service/server/web、共享 state/ticket/README；保留用户 AGENTS dirty 与 SEC dependency/lock 修改。

独立服务用随机端口与临时SQLite数据目录；helper finally关闭browser/MCP/server并删除runtime目录。固定 fixture 与隔离项目目录为可复核源码证据而有意保留，实际路径记录于 fixture-source.json/workspace-product.json（/tmp/atlasmode-idx02-fixture-*、/tmp/atlasmode-idx02-isolated-*）。固定 Express target /tmp/atlasmode-idx01-express 原有checkout保持clean。docs与generated memory保留；neat-freak本票事实面已核对，主控负责全仓closeout。
