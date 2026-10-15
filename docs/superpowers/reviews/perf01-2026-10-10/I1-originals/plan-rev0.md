# PERF-01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 当前仅 DESIGN；没有产品窗口，也不 dispatch/spawn。

**Goal:** 以完整捕获和现有快照 authority 为基础，交付与 full 等价、知识保留、可停止且可见的自动更新，并测真实中型性能。

**Architecture:** 同 context 独占 TypeScript oldProgram 只复用解析结构；每轮重建 resolver/checker/语义图，完整 builder 为独立 oracle 和回退。owned watcher 只触发现有项目 joint refresh 队列，状态和 stop 复用既有诊断区与 HTTP 授权，closing 后 drain 再关 storage。

**Tech Stack:** Node 24.19.0 / npm 11.9.0 / TypeScript 5.9.3 / ts-morph 27.0.2、现有 fs.watch、Vitest、Playwright、SQLite 与 MCP SDK；无新依赖。

**Spec:** `docs/superpowers/specs/2026-10-10-perf01-design.md`。

## Global Constraints

- 本轮仅两 docs + own ledger，未运行性能/产品 tests；独立高审查与主控共享窗口后才执行。
- 保留完整 capture/hash/排序/source evidence、captured配置授权和 root containment；不执行目标代码、不 sourcewrite、不 fuzzy rebind。
- full 强制使用无缓存既有 builder；auto 每轮重算所有语义图；Python 全量。配置/refs/rename/overflow/未知等 full fallback。
- 缓存两个项目，每项目 4096 TS 文件/64 contexts/64 MiB 原始 TS bytes，全局128 MiB原始 TS bytes；不是 AST heap 上限；10分钟懒淘汰。
- watcher 默认 off，CODEMAP_WATCH=1 trusted 启用；250ms debounce/1000ms最大等待/1024hints/30s reconciliation/每项目一个auto票据加一个pending标志。
- close timeoutMs=5000 是有限等待，不是同步 AST 可抢占保证；owned work 未settle storage 不提前关闭。
- 对接 KN/POL 最终 joint one-invalidate 及 AG03 close owner；不得另写重复事务/关闭 registry。
- 主控协调 build/test slots、共享 dist、提交/push；保留所有 FAIL/原始 artifact。

## Review Focus

1. 未变 importer 目标删除/新添/exports变更不得继承旧 binding：任务1/2的 full-vs-auto 精确 oracle。
2. 相同 bytes 在不同 project/reference scope 环境不得共享 mutable SourceFile：任务1 scope隔离及并发测试。
3. rename/null filename/watch loss/root inode替换不证明身份或删除：任务3真实 watcher与完整字节 fallback。
4. burst/approve/stop/close 竞态不后发旧快照、不重复 invalidate、不早关 DB：任务4 barrier与 joint事务用例。
5. 后台新快照/旧UI/切项目返回不能悄改用户规划：任务5真实browser与MCP/source/current context证据。

## 文件与接口窗口

新增（建议实际文件名在实施开始固定，不创建通用框架）：

- `packages/indexer/src/capturedPrograms.ts`、`incremental.test.ts`：私有 Program 复用和完整 oracle 等价。
- `packages/service/src/index-watch.ts`、`index-watch.test.ts`：owned WatchSession、有限 hints/票据、stop/close。
- `packages/core/src/index-watch.ts`、`index-watch.test.ts`：strict status DTO；core/model.ts 仅 IndexerPort 可选第三参数，core/index.ts 仅专属出口。
- `apps/web/src/app/IndexWatchStatus.tsx`、专属 `.test.tsx`；`tests/e2e/index-watch.spec.ts`。
- `scripts/benchmark-indexer.mjs` 与独立 PERF01 evidence目录：只对 owned 源码副本施加可还原输入变化，不运行上游代码。

修改窗口：`packages/indexer/src/index.ts/typescript.ts/python.ts`（仅cache接入/abort）、`packages/service/src/workspace.ts/structure-sync.ts`（仅 joint authority 接入/drain）、`apps/server/src/routes.ts/index.ts/server.ts`（status/stop/env/preClose）、`apps/web/src/api/client.ts/app/workspace.ts/app/Navigation.tsx/i18n/en.ts/zh.ts`。这些缩写各文件均相对对应 src 目录；实际 en/zh 已确认 `apps/web/src/i18n/en.ts` 与 `apps/web/src/i18n/zh.ts`，Navigation 为 `apps/web/src/app/Navigation.tsx`。storage schema、MCP tools、身份算法不改。任何 KN/POL/AG03 同文件未冻结变更先协调主控，不覆盖其他 owner。

拟定 public contracts（实施需主控先批准精确字段 diff）：

```ts
// core/model.ts；现有两参数 IndexerPort 实现仍兼容
index(rootPath: string, projectId: string,
  options?: { mode?: "auto" | "full"; signal?: AbortSignal }): Promise<CodeSnapshot>;
releaseProject?(projectId: string): void; // 仅清cache并使旧generation失效

// core/index-watch.ts；strict schema，无 runtime对象/绝对路径
type IndexWatchStatus = {
  projectId: string;
  mode: "disabled" | "events" | "polling" | "stopped" | "error";
  phase: "idle" | "queued" | "indexing" | "pending";
  dirty: boolean;
  latestSnapshotId?: string;
  lastAttemptAt?: string;
  reason?: "root_changed" | "watch_unavailable" | "capture_changed"
    | "index_failed" | "stopping" | "cache_fallback";
};
// service facade；stop不是取消手工刷新
getIndexWatchStatus(projectId: string): IndexWatchStatus;
stopWatching(projectId: string): Promise<IndexWatchStatus>;
beginClose(): void;
close(options?: { timeoutMs?: number }): Promise<{
  settled: boolean; whenIdle: Promise<void>;
}>;
```

`CapturedPrograms` 只给 indexer 内部 `build(capture, context, {full,signal})` 提供 Program；context 定义来自现有 configurationResolver 授权分组，不从缓存反推授权。返回完整 oracle 与增量路径都需要的普通 Program，不跨层暴露 ts类型。`WatchSession` 通过 callbacks `refresh(mode,epoch)` 调现有 lock-held joint authority，无存储能力。现有 public refreshIndex 继续 full；内部自动入口使用 auto且在同queue/session检查 epoch，不能队列外先算快照。

## Task 1：独立完整 oracle 与 mutable Program 协议

**Files:** Create capturedPrograms.ts/incremental.test.ts；Modify typescript.ts/index.ts、core/model.ts（授权后）。

**Consumes:** scan captured bytes/config/manifests/availability、configurationResolver 分组和 resolutionHost。**Produces:** 独立 full 与 auto Program builder，index options，私有 bounded cache统计供 owned evidence。

- [ ] Step 1 写 `fullOracleMatchesCurrentSnapshot`、`sameBytesDifferentScopeNeverSharesSourceFile`、`unchangedImporterDeletedTargetHasNoOldCall`、`unchangedImporterAddedTargetResolvesNow`、`anotherScopePrototypeWriteRevokesCall` 测试。固定 clock/git，比较完整 snapshot 除createdAt；数组/IDs不排序、不剔coverage/diagnostics。断言不同scope/extractionProgram对象不共享SF。
- [ ] Step 2 `npx vitest run packages/indexer/src/incremental.test.ts` 留真实 RED；预期当前不存在 auto复用/参数，不能把 setup缺包当行为RED。
- [ ] Step 3 实现 captured-only CompilerHost 普通 createProgram/oldProgram。host honors shouldCreateNewSourceFile；比较CreateSourceFileOptions/scriptKind/bytes/context；全文件hasInvalidatedResolutions=true、新resolver缓存、新Programchecker。full保留原ts-morph路径。busy/generation拒并发借同AST，scope/extraction分别保留，不手工清binder字段。Graph/analyzer完整遍历顺序保持。
- [ ] Step 4 运行任务测试 GREEN；记录未改文件可实际复用、改文件新SF、删除不可从旧Program恢复、解析resolver调用本轮captured目标；覆盖直接 concurrent index同项目与两个项目。
- [ ] Step 5 定向 typecheck/lint（依赖 dist slot先协调），导出精确公共 diff供主控审阅，不自行stage/commit。

## Task 2：字节 freshness、回退与回归

**Files:** Modify index.ts/scan.ts（仅witness必要封装，不改采集授权）/python.ts；Extend incremental.test.ts。

**Consumes:** 任务1的full/auto；**Produces:** bounded二次采集、abort/exception回退、完整输出等价与旧索引回归证据。

- [ ] Step 1 写 `mtimeIsNotAuthority`（mtime变化bytes同、bytes变化mtime同两例）；`configReferencesExportsIgnoreForceFull`；`capturedInputsChangedTwiceRetainsOldSnapshot`；`cacheFailureRetriesFullOnce`；`pythonMixedProjectStillFull`；缓存两项目/4096/64contexts/64MiB及全局128MiB/10min懒淘汰/stop释放测试。边界测试用实际可控 inputs，内存压力用小配置注入同生产budget逻辑，不重复512/513大fixture串行IO历史问题。
- [ ] Step 2 运行 `npx vitest run packages/indexer/src/incremental.test.ts` 保存 RED，真实barrier改变第一次分析后源字节；缺 filename/rename等forceFull原因由任务3补。
- [ ] Step 3 实现 policywitness完整比较、full原因、两次尝试上限与失败 INDEX_INPUTS_CHANGED。稳定partial遵循现有诊断；异常清cache→同capture full一次。abort各阶段不publish；Pythonhelperowned kill后等close，无法及时结束保留pending。
- [ ] Step 4 GREEN 并运行 `npx vitest run packages/indexer/src`（先协调slot），保存实际PASS数，继承IDX01/02/03负例。恢复/删除target、reexports、global新增删除、type-only、UTF16、解析错误unknown与旧scope不串edge均 exactfull比对。
- [ ] Step 5 固定完整Express真实index/source gate，AtlasMode captureddist排除unknown、workspaceexports/references fixture同步source证据；不运行目标代码、不把旧PASS日志冒本轮回归。

## Task 3：bounded owned watcher 与 visible状态

**Files:** Create service/index-watch.ts/test、core/index-watch.ts/test；Modify workspace.ts、core出口（仅批准hunks）。

**Consumes:** index auto/full、当前StructureSync项目队列/jointrefresh。**Produces:** status/stop facade，watch defaultoff/envon，自动票据。

- [ ] Step 1 写 default disabled/nohandles、attach后reconcile、真实临时root edit/delete/config、pollingfallback、missingfilename/overflow→full、根替换stop、再次open不恢复stopped tests；用 barrier记录10000events最多1024hints、一个queued/running加一个pending，事件不直接storage.put。
- [ ] Step 2 `npx vitest run packages/service/src/index-watch.test.ts packages/core/src/index-watch.test.ts` RED；真实fswatch用观察事件与最终状态，不按平台调大睡眠假证机制。fixture cleanup等待owned任务settle。
- [ ] Step 3 实现 sessionepoch/rootownership/fswatch+30sreconcile、250ms/1000msdebounce、trusted envoption/defaultfalse；unsafe/nullhintfull，不读取hint源码。statusstrict/reasonenum、no absolute paths，watch unsupported→polling。`.codemap/structure.json`也调joint刷新，不因sourcehash同跳过；stop/close 调 indexer.releaseProject 可选hook，cache晚返回不能复活。
- [ ] Step 4 GREEN：auto刷新排现有队列，结束再安排pending，手工full/approve不饿死，Stop先fence闭watch/timers而非close unrelated手工请求。
- [ ] Step 5 记录Native Linux/macOS/Windows scoped场景，缺平台未验证单列；parent审阅此组接口后才交server/web窗口。

## Task 4：jointpublication 与关闭/失败事务

**Files:** Modify workspace.ts/structure-sync.ts；server index.ts/server.ts；Extend index-watch.test.ts；不改其他owner未冻结jointmodule。

**Consumes:** 最终KN/POL共同事务和AG03 ownerclosing契约、任务3epoch。**Produces:** 唯一publication接入、beginClose/close/whenIdle和storage安全收口。

- [ ] Step 1 写真实SQLite `sourceAndStructureChangeInvalidatesOnce`、`noOpNeitherRevisionNorHistory`、`deletedSourcePreservesAnnotationOrphanHistory`、`unknownCaptureDoesNotOrphan`、`snapshotCommitFailureRollsBackJointKnowledge`；barrier `stopAfterDispatchPreventsPublication`、`closePendingKeepsStorageOpenUntilIdle`、`lateEventCannotStartAfterClosing`。
- [ ] Step 2 scopedservice/server测试RED，保存原joint基线用例，不改期待来掩盖重复invalidations。批准/审批context/revision历史保留。
- [ ] Step 3 仅在现有lock-heldjoint刷新接auto/full和epoch；同步transaction内部不await，不再分步invalidate。close先fence/abort/timerclose，StructureSync 禁新admission，既有工作后续mutation/commit查globalepoch；等待queue/helper/dispatchownedpromise；5000ms超时truthfulpending+whenIdle，serverstorageclose只能在idle后。与AG03公共关闭registry合并，别建竞争secondregistry。
- [ ] Step 4 GREEN；实际进程owneddb/randomports验证activeparse/HTTP刷新shutdown无事后发布、storage未早close、正常close无watcher/timer/Pythonhelper。同步Compiler不可硬deadline行为记录限制，不宣称5000ms强抢占。
- [ ] Step 5 主控独立审查共享hunks；冻源码与编译SHA再开始下一项真实gate。

## Task 5：HTTP/SDK/browser实际状态和停止

**Files:** Modify server/routes.ts、web/api/client.ts/app/workspace.ts/app/Navigation.tsx/en.ts/zh.ts；Create IndexWatchStatus组件测试及 tests/e2e/index-watch.spec.ts。

**Consumes:** task3 strictDTO/stop、task4 closing；**Produces:** GETstatus/POSTstop、渐进诊断status与真实点击证据。MCP既有tools不变。

- [ ] Step 1 测GET归属/strictDTO/无路径stack；stop空body复用既有写授权；trustedoff不允许启用。组件defaultdisabled/enabledpolling/error/stop、newSnapshot提示、切项目和collapsedispose取消2s单请求poll；stale-response不能覆盖新项目。
- [ ] Step 2 scopedVitest及 `npx playwright test tests/e2e/index-watch.spec.ts` 留RED（ownedinstance，依赖build需slot）。保持现有E2E直接子summary定位，新增details不能破坏commonjs/tsconfig严格定位。
- [ ] Step 3 实现诊断内小statussection/stop按钮，active展开2s单请求；关闭default不后台poll。新快照提示沿现有workspace.refresh full→load；不静默覆盖graph或selectedplanbaseline。
- [ ] Step 4 GREEN +真实HTTP/MCP SDK：打开相同root、源改动观察auto新snapshot、source/context一致、批准old plan变stale、停止后source改动不会auto发布、手工refresh仍能更新。SDK正常shutdown；不冒真实Codex/Claude交互PASS。
- [ ] Step 5 真浏览器点击advanced/diagnostics/stop/fullrefresh，en/zh截图至少disabled、active/new-index、stopped/manual、error/polling；页面当前snapshot与服务器latest区别可辨；日志记录路径/源hash，不向截图暴露秘密。

## Task 6：真实中型性能和最终验收

**Files:** Create scripts/benchmark-indexer.mjs（不targetexecute）；独立PERF01 evidence/report；主控更新票据/state。

**Consumes:** 已冻结baseline源与final源、固定完整Expresscommit；**Produces:** 原始配对计时/heap/full-equivalence/matrix及DONE或PARTIAL结论。

- [ ] Step 1 写benchmark helper的pathownership/禁止originaltargetwrite/固定snapshotclock/完整oracle比较验证；baseline在实现前只读源freeze→主控ownedcandidate构建（slot），本轮不执行。
- [ ] Step 2 准备Express完整owned副本，确认origin/HEAD `dbac741a49a5a64336b70c06e85c2e2706e36336`/全源码/inventorySHA，保持originalclean；测量不启动目标server或npm scripts。保存机器OS/CPU/RAM/Node/lock/源码/distsha。
- [ ] Step 3 baselinecold/warmfull及finalfull/auto各5warmup、至少20交错paired真实single-fileedit。记录totalwall/capture/recheck/TS/Python/semantic/store/queue、p50/p95/RSS/heap、每次byteshash/equality、异常不删；add/delete/config等fallback另测真实性和完整结果。
- [ ] Step 4 必须满足finalauto single-edit p50比finalforcedfull≥20%改善，p95、coldtotal、peakRSS对originalfullbaseline退化≤10%；否则PARTIAL，不能改样本/略成本宣称提升。强制full没有Programcache，结果完整IDs/数组/source/unknown等价。
- [ ] Step 5 后续变更理由充分才扩大test；独立high review、主控cleanbuild/typecheck/lint全仓/现有回归与原生平台gate统筹，保存任何FAIL/修复/未验证；禁止用schema/scopedPASS取代真实性能、nativewatch/HTTP/SDK/browser联合门。
- [ ] Step 6 将sourcefreeze清单、review原文、rawbaseline/final、所有截图、精确commands/DBports/ownedcleanup证明交主控限定stage/commit/push。无产品授权时停止在docs；遇未通过分类为目标修复/外部证据/PARTIAL，不自动扩大范围。

## 作者自审与当前状态

spec每项对应任务：captured输入/cache语义→1/2，监听/状态→3/5，jointknowledge/close→4，真实性能→6；Review Focus五类各有具名测试。全局数字/interface名一致，完整数组IDoracle不藏顺序差异，fallback/unknown不变成假已全覆盖。没有实际测试/性能/native监听/浏览器结果；本次是待独立高审查设计，后续共享窗口需主控明确授予。
