# Python compatibility I1 修复作者报告

2026-10-11 UTC。实现者 `/root/python_compat_r1`，本报告是作者验证与冻结交接，不是独立复审批准。

结果：I1 的共享后缀兼容修复已实现并完成本窗定向验证。等待主控独立窄复审及决定完整集成门禁。未 stage、commit、push、merge、deploy，未同步 publisher/main，未改共享 checkout/dist 或文档状态。

## 冻结输入与输出

- 原报告 `whole-publish-independent-review.md` SHA-256：`89ba0c8a78d6c6512bbfbb76c2a59b2291bac63f9ff4d22747671f82dab03a96`。保留原 REQUEST_CHANGES 文本、原 patch/日志，没有覆写。
- VM2 私有 detached worktree：`/tmp/atlas-python-compat-r1-20261011/workspace`，从 `0991dbc962981c4aa1b1a13473fce66abd6b8502` 建立。
- 精确复制 publisher manifest 的 **312 路径**；起点全部匹配，未复制共享 checkout 的 unrelated dirty changes。仅补入 publisher 的现有 spec/plan 上下文。私有 `npm ci --offline --cache /home/agent/.npm`，Node 24.19.0 / npm 11.9.0。
- VM 证据：`/tmp/atlas-python-compat-r1-20261011/evidence`。本机证据：本报告所在 `python-compat-r1/`；完整本机源码快照在 `candidate-tree/`，冻结证据在 `frozen/`。

| 项目 | SHA-256 |
| --- | --- |
| 原 312-path before manifest | `1a7e353da7104e95fef793ba1838785b824647a57fb9bafb3df3e10ad93ae28e` |
| 新 312-path after manifest | `f29252b6d0a948fffffb54c6e2ba26e2dcf12f298e55d9255f4b2889f0852830` |
| 五变更文件 manifest | `0759faa73a95815493f713aa15bade9447ea8799ddad96c7a3a9f8c6cb076881` |
| 相对 publisher 的精确 repair.patch | `36ebf4585e918d3fd1e52d5371efd5082254cf888a04d34e0161ecd0e5110af6` |

VM 冻结检查 publisher 仍 **312/312** 匹配原 manifest；仅五个授权文件改变。本机独立重建 before 与 after **各 312/312** 匹配，并从本机源码重算 unified diff，与冻结 patch 字节完全相同。见 `frozen/freeze.json`、`local-copy-check.json`。

## 产品变更

`planning/function-target.ts` 导出既有 TS/JS 后缀加 `.py` 的 `supportedSourceSuffix`；原高级路径验证继续使用原 core normalizer，再使用此规则。`structure/ownership.ts` 复用该规则，保留原 canonical 路径检查及 folder filename 的目录、冒号、drive、控制字符拒绝逻辑。

没有新产品文件。没有修改 FunctionForm、operations、领域模型、CAS、approval 或 source writer。高级保存和 retarget 都通过原调用链自然恢复 Python；没有表单旁路。物理 `filePath/parentId` 与真实身份不改，目标变化仅进入 Plan。

其余三文件仅新增相称回归覆盖：`function-target.test.ts`、`ownership.test.ts`、现有真实生产 `ownership.spec.ts`。已有 TS/JS 与旧安全断言保留。新增 **31 个 unit**、**2 个生产 browser** 场景。

## RED → GREEN 与限制

| 验证 | 结果 |
| --- | --- |
| 未改产品的有效 unit RED | 5 failed / 53 passed；Python metadata、move/no-op、temp metadata/relations、suffix、完整 ownership target 均在预期路径校验处失败 |
| 未改产品的真实生产 Chromium RED | 2 failed；indexed Save 与 planned Add 都 disabled；保留截图、trace、server receipts |
| 初次修复定向 units | 5 files / 86 passed |
| 最终 planning + structure units | **11 files / 142 passed**；exit 0，2.16s Vitest duration |
| 最终受影响 Chromium 集 | **25 passed / 0 skipped / 0 unexpected / 0 flaky**；51.946s |
| web typecheck / changed-file lint | exit 0；最终独立命令 receipts 在 `frozen/final-checks.json` |
| 私有根 production build | exit 0；保留 zod 注释及 bundle size 的既有构建 warnings |
| whitespace check | exit 0 |

浏览器保留 `POL01_PRODUCTION_GATE=1`、`POL01_ACCEPTANCE_MODE=compiled` 和指定真实 Chromium executable。25 个用例包括 **11 个 compiled production ownership**（含新增 Python 两个）及 **14 个既有 Vite 表单/控制器**；后者明确是组件契约场景，不冒充生产场景。Python 用例复用现有 `setup` / `tests/support/production.mjs`，没有新造测试组件。

初始 setup 尾部读取不存在的 `playwright.config.mjs` 导致 exit 1，实际 worktree/312-copy/npm ci 已成功；随后的首次 unit 由于 private core 尚未 build 而 suite import 失败、0 tests，该记录不算有效 RED。私有 baseline build 后才取得上表有效 RED。第一次 Python GREEN browser indexed 已通过，temp 在补入公开 API language/relation fixture 后实际到了 r4，而测试 literal 仍期望 r3；该失败保留于 `browser-green/`，仅修正新测试 literal/保留断言，最终 25 用例通过。

新写测试时曾把 `https:main.py` 放入高级路径 invalid 清单；原 normalizer 对非 drive 的冒号相对字符串本来没有这一拒绝规则，旧 TS 同形也没有。此新增错误预期在 GREEN 前移除，未改原测试或生产安全规则；ownership 单 filename 的冒号拒绝测试仍保留。本窗没有扩为路径规则重构。

所有作者执行脚本的完整 SSH args、完整远程命令文本、开始时间、总耗时、exit 和 raw log 分别在同名 `*.receipt.json` / `*.log`；最终 units/types/lint 另有逐命令时间与 exit。初始失败历史未替换。

## 真实 Python 行为证据

Indexed 场景：索引返回 Python `src/original.py`；高级只改 description，r1→r2，公开 Plan 仅新增 annotate、没有 move，请求携带 S0/r1。原生鼠标拖到真实 `dest/index.py` 文件并 Apply → r3；回高级显示同一完整路径，点 Save 无新增写入或 revision。真实 Undo → r4 恢复 metadata-only，Redo → r5 恢复 move。再次原生拖入真实 dest 文件夹，非法 `../escape.py` 禁止 Apply，`completed.py` 精确预览/Apply → r6，唯一 move coalesced 到 `dest/completed.py`。回高级修改 description → r7，旧 annotation 保留。整个场景 public physical function context 完全相等，完整 source SHA map 与 layout positions 完全相等。

Temp 场景：真实高级 Add `new/planned.py` → r2。公开 API fixture 基于 S0/r2 补入已有 `language=python` 与 temp→indexed calls 关系 → r3，UI Validate 读取实际 r3。高级同路径 metadata Save → r4；原生 folder ownership Apply `dest/planned.py` → r5。公开 Plan 精确保留 tempId、name、signature、description、language、calls relation，仅 add_function.filePath 改变，没有覆盖 move。完整 source SHA map 相等，没有创建目标源码文件。

上述完整公开 API 数据及 before/after source maps 在两个 `python-*-receipt.json`。已实际查看 RED metadata/Add 截图及最终 file preview、folder preview、temp final 截图；可见原 `.py → …` / disabled 与修复后完整 `.py` 路径、Apply、temp calls/description。原生鼠标输入使用已有 pointerDrop，未以 store 注入/人工 DOM drag 替代。

## 资源与待办

`freeze.json` 记录并新鲜核验本窗注册的 **16 个 server PIDs 均已消失、对应端口均已关闭、exit 0 / signal null**；15 个 owned production fixture roots 已删除。Playwright 正常结束，现有 beforeAll form server 按 afterAll 关闭；未全局 kill 或关闭其他标签。私有源码工作区保留给独立复审，作者后续不再写源码。

**UNRUN / 不作新通过宣称**：全仓 unit、全量 browser、根 typecheck/lint/smoke、远程 CI、Windows/macOS native。本轮全量旧基线 1342 unit / 51 browser 仍仅是旧 candidate 的历史结果；主控按新五文件变化决定完整 gate。没有源文件执行/迁移或新语言支持完成宣称，FS/KN/POL 状态由主控收尾。

交接：请对冻结 patch 与新证据做一次独立窄复审；本轮没有执行 blocker。独立复审、主控决定的完整门禁以及 publisher 同步仍待主控。
