# SEC-01 依赖审计与最小整改 — 2026-10-10

## 当前结论

SEC-01 已 DONE：2026-10-10 最终提交7528f78远端四job全部SUCCESS，精确收据见文末。下列基线/隔离检查点保留当时PARTIAL状态，不能代替最终收据。

## 初始基线结论

基线锁文件仍有 SEC-01 所列的高危链：`@codemap/indexer` → `fast-glob@3.3.3` → `micromatch@4.0.8` → `braces@3.0.3`。截至官方 GitHub Advisory 查询，braces 受影响版本为 `<=3.0.3`，patched version 为 None；npm registry 在兼容主版本中也只列到 `fast-glob@3.3.3`、`micromatch@4.0.8`、`braces@3.0.3`。`npm audit.fixAvailable` 对三项均为 `false`。这表示当前锁图没有 npm 可应用的自动修复，不等于已排除安全 override 或其他处置路径。

审计还发现之前历史报告未记录的 `concurrently@10.0.5` → `shell-quote@1.9.0` Critical 链。官方 `concurrently@10.0.6` 发布说明将 shell-quote 更新到 `1.12.0`；npm audit 给出该同主版本更新为可用修复，Node 要求为 `>=22`，兼容仓库 Node `24.19.0`。

这次锁图计数为 **5 个受影响包项：2 Critical、3 High**；它们沿两条 advisory 链出现，并非五个互不相关的 CVE。SEC-01 原有三项仍在。原审计输入是 HEAD `078fa84238a5126729429fe1e2d2c7f094f103e9`，锁文件 SHA-256 `aebc7da3e443ce005ed6c2af8272104f27e84a0966d862f819dc37c287af8119`。完整原始 JSON 和命令元数据见 `receipts/npm-audit-baseline.*`。

## 基线结果与依赖路径

审计于 `2026-10-10 14:30:58–14:30:59 UTC` 在 VM2 Linux 上运行，Node `v24.19.0`、npm `11.9.0`，查询官方 npm registry。命令退出码 `1` 是因为存在审计结果；锁文件审计前后哈希完全相同。

| 包项 | 锁定版本与路径 | 严重性 | `fixAvailable` | 说明 |
| --- | --- | --- | --- | --- |
| `fast-glob` | `packages/indexer` 直接依赖 `3.3.3` | High | `false` | 受 `micromatch` 与 `braces` 影响 |
| `micromatch` | `fast-glob` 的 `^4.0.8` → `4.0.8` | High | `false` | 锁依赖 `braces: ^3.0.3` |
| `braces` | `micromatch` 的 `^3.0.3` → `3.0.3` | High | `false` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，深层嵌套模式可触发递归栈耗尽；官方 advisory 当前没有 patched version |
| `concurrently` | 根开发依赖精确 pin `10.0.5` | Critical | `10.0.6`，`isSemVerMajor=false` | 由下游 `shell-quote` advisory 传播 |
| `shell-quote` | `concurrently` 的 `1.9.0` | Critical | 随 `concurrently@10.0.6` 修复 | [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)，受影响 `<1.11.0`，官方修复版本 `1.11.0`；10.0.6 发布版依赖 `1.12.0` |

全仓引用扫描（排除 `node_modules`、锁文件与本报告）发现 `fast-glob` 只在 indexer manifest、README 依赖表、原始计划和历史报告出现，没有当前应用或测试源码调用。主控随后已把现役 README 依赖行改为 Node `fs` 与 `ignore`，并标注 SEC-01 后续门禁待验收；当前说明与源码及依赖删除一致。原始计划和历史报告里的 fast-glob 表述保留为历史，不改写为当前事实。

braces 的 [上游 issue #70](https://github.com/micromatch/braces/issues/70) 中，报告者称字符长度上限未阻止深层递归；维护者对漏洞成立及 `maxDepth` 方案提出异议。此争议已记录，但不会由本审计自行推翻 GitHub Reviewed GHSA 的 High 标记。上游当前没有官方修复版本。

## 获准的最小 manifest 变更

主控随后授权并已完成以下 manifest-only 变更；AG-05 owner 已按同一轮 workspace 元数据需求更新唯一锁文件。初次审计基线仍按原哈希保留，变更后结果见下一节：

- `packages/indexer/package.json` 删除未被当前源码使用的直接依赖 `fast-glob@3.3.3`。这是移除无用顶层包及整条 braces/micromatch/fast-glob 树的最小候选，不需要引入替代 glob 包。
- 根 `package.json` 将 `concurrently` 精确 pin 从 `10.0.5` 调到 `10.0.6`。官方发布说明仅列文档、无存活进程时跳过 force-kill 日志，以及 shell-quote 更新；npm registry 元数据列出 `engines.node >=22`，符合项目 Node 24 约束。
- 这两个 manifest edit 前后，SEC 初始审计锁 SHA 均为 `aebc7da3e443ce005ed6c2af8272104f27e84a0966d862f819dc37c287af8119`。我没有写锁文件。AG-05 之后统一加入 `@codemap/mcp` 和 `@modelcontextprotocol/sdk@1.32.0` workspace 元数据，并吸收上述两个 manifest 差异。新锁 SHA 为 `f26ef3a7cf494becb903226ef01d86dfa7ca1e014c271e284bb0db1b9cee49c4`；diff 增加 12 行、删除 194 行，复核确认旧 fast-glob/micromatch/braces 节点已消失，concurrently 与 shell-quote 切到修复版本。

候选风险较低：全仓扫描未发现 `fast-glob` 的运行引用；更新后的 lock 图通过隔离 `npm ci` 与根 build，相关产品 smoke 也通过 Linux 候选验证。`npm audit fixAvailable=false` 仍不能推导出所有安全 override 均不存在；本轮选择了删除未用依赖路径与同主版本升级，不引入未审查 fork 或强制不兼容 override。`npm run dev` 的并发进程启动和最新 AG-05 dev launcher 尚未在此候选中验证，仍需主控集成后验收；原生 Windows/macOS 与对应 CI 收据仍是 SEC-01 完成条件。

## 锁更新后的独立复审计

2026-10-10 `14:40:24–14:40:25 UTC`，在 lock SHA `f26ef3a7cf494becb903226ef01d86dfa7ca1e014c271e284bb0db1b9cee49c4` 上重新运行官方 registry 的 `npm audit --json`。该命令独立退出 `0`，结果 **0 info / 0 low / 0 moderate / 0 high / 0 critical，0 个受影响包项**；审计前后锁文件 SHA 未变。post-change raw JSON、stderr 和命令元数据见 `receipts/npm-audit-post-change.*`。

这证明当前 lock 所对应的软件包图没有被本次 registry audit 标记的已知 advisory。它不构成全面安全证明；后续隔离 Linux `npm ci`、build、indexer tests 与 smoke 结果见下文，最新并行集成树和原生 Windows/macOS CI 仍待验收。

## 冻结锁、验证与平台状态

仓库规定单一根 `package-lock.json`，安装使用 `npm ci`。`.github/workflows/ci.yml` 的 native matrix 要在 Ubuntu、Windows、macOS 分别执行 Node `24.19.0` / npm `11.9.0` 的 `npm ci`、`npm run build`、`npm run typecheck`、`npm run lint`、`npm test` 与 `npm run smoke`；独立 Ubuntu browser job 还执行 clean install/build、官方 Chromium 安装与 `npm run test:e2e`。

本轮随后按主控指定方式建立 Linux 隔离候选 `/tmp/atlasmode-sec-check-20261010/candidate`：完整源码来自提交 `68876cd69823f973dd58be72f26b8ad320ac57e6` 的 `git archive`，只叠加根 `package.json`、`packages/indexer/package.json`、`apps/server/package.json`、`package-lock.json`、`scripts/workspaces.mjs` 五个已授权文件。五个输入 SHA-256 记录在 `receipts/isolated-input-and-runtime.txt`。测试没有使用或替换共享 `node_modules`，并使用隔离 npm 配置和缓存；该候选不是 IDX/GRP/AG-05 当前未提交集成树，也不包含 AG-05 后续改动的 `scripts/dev.mjs` / `apps/server/src/dev.test.ts`。因此下列结果只验证所列依赖/构建候选及归档源码，不作为并行源码集成或最新 dev launcher 的验收。

隔离候选结果：`npm ci` 成功，增加 397 个包、审计 405 个包并报告 0 vulnerabilities，安装前后锁 SHA 均为 `f26ef3a7cf494becb903226ef01d86dfa7ca1e014c271e284bb0db1b9cee49c4`；独立 `npm audit --json` 退出 0，0 项。根 `npm run build` 退出 0，按根脚本构建 core、indexer、storage、service、web、mcp、server；web 产物提示一个 530.58 kB chunk 超过 500 kB 建议阈值，但构建成功。indexer typecheck 通过，根 Vitest 过滤 `packages/indexer` 后 8 个测试文件、349/349 测试通过。归档版本的 `apps/server/src/dev.test.ts` 7/7 通过；这不是 AG-05 新版 dev launcher 的证据。`npm run smoke` 通过，验证生产静态资源、TS/Python HTTP 与 SDK 浏览、目标代码不执行及服务重启持久性。最初在 indexer workspace cwd 执行其 test 脚本因根 Vitest glob 找不到文件而失败；改从根目录过滤后通过，两次原始日志均保留。

隔离命令收据在 `receipts/isolated-*.log`、`receipts/isolated-input-and-runtime.txt` 与 `receipts/isolated-npm-audit.*`。本轮未运行完整根单元套件、lint、browser e2e，也未运行 Windows/macOS。环境文档旧 CI run 属于旧 SHA，不能作为现候选跨平台证明。SEC-01 仍为 **PARTIAL / 等待主控集成提交的 fresh CI 验收**：主控需以最终集成提交运行 workflow 中 Ubuntu/Windows/macOS 的 `npm ci`、build、typecheck、lint、test、smoke，并单独验收 Ubuntu browser job；只有相同提交的实际收据才可标相应平台 PASS。

## neat-freak 事实面（限本票）

| 事实面 | 状态 | 证据或遗留 |
| --- | --- | --- |
| 代码 / 依赖声明 | `changed-and-verified` | 全仓扫描、manifest + lock 图复核、官方更新后 audit 与隔离安装均为 0 findings；五个候选输入 SHA 和收据已保存 |
| 运行态 | `changed-and-verified` | 隔离 Linux 候选 build、indexer 349 项、归档版 launcher 7 项及 smoke 通过；当前集成树与最新版 launcher 仍待验收 |
| 文档 | `changed-and-verified` | 主控已把 README 现役依赖行同步为 Node fs/ignore；历史计划与报告保留其时代语境 |
| 规则 | `verified-current` | 阅读了当前 AGENTS、SEC-01 和本票所用审计说明；并行改动未覆盖 |
| 记忆 | `out-of-scope` | 未读取或写入生成记忆 |
| 工作区 | `pending` | IDX/GRP/AG-05 有并行更改；未清理、未提交 |

第一次审计命令曾因 npm 将同一个 `/dev/null` 同时作为 user/global 配置而在请求前退出。此失败的空 stdout、stderr 和元数据被保存在 `receipts/npm-audit-attempt-1-config-error.*`；官方 registry 的第二次调用是 pre-change 基线，第三次调用是 lock 更新后的独立 post-change 审计。

## 远端完整门禁收尾

2026-10-10 最终验收：提交7528f78302275acb11cb9a23b49cb284d2a7fd9f的远端CI [38064184377](https://github.com/huiyuanXP/AtlasMode/actions/runs/38064184377) 四个job全部SUCCESS：Linux、Windows、macOS native及Chromium。冻结锁SHA256 f26ef3a7cf494becb903226ef01d86dfa7ca1e014c271e284bb0db1b9cee49c4；对应clean隔离快照全根build/typecheck/lint、781/65测试、smoke及18/18浏览器通过，npm ci审计0。原始远端收据：[JSON](../ci-repair-2026-10-10/remote-ci-38064184377.json)。此门禁不包含尚未提交的GRP02、IDX03等候选。
