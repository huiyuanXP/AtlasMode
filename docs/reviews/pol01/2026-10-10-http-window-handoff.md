# POL-01 service / HTTP 窗口交接

状态：本窗口代码已冻结，待父代理安排独立实际代码审查。KN current/history guard 已实际 freeze 并完成两个 callback 接线与 409 error mapping。本窗口不是整票 DONE。VM2 `/home/agent/projects/AtlasMode`；没有 root build/dist、真实用户 structure/DB、stage/commit/push、全局 docs、Web/Canvas/Nav/i18n 或 MCP 写入。

## 授权路径与方法边界

精确 18 个产品/夹具路径见 `http-window-owned-paths.json`，获授权 tracked 窄补丁见 `http-window-shared.patch`；新增 HTTP tests 与两个 fixture helpers 另由文件 SHA 和原源码交付。Workspace 独占 ctor、openProject、refreshIndex queue 外层、POL structure/readPolicies/legacyPreview/savePolicy wrappers、fresh HTTP plan wrappers、approve/verify/current-read scope。Knowledge 只移除绕过同步的新 policy 写入口，保留原 DB-only read。HTTP 独占 index startup port/recovery、routes 契约、server error mapping/diagnostics。没有更改 SEC authority/origin gate。

`Planning.update` 原字节保存 `fs-update-method-before-http.txt`，SHA `f4b11da3a6354f7646e656ef49ce4110c148ee4873d7a7e942f5311ce47b0613`；`Workspace.updatePlan` 原字节保存 `workspace-update-method-before-format.txt`，SHA `39dbfb5232894947f53cd8549f48700dfd12f67f6e7e071fecc68e6a6b59f794`。expectedSnapshotId/coalescing 均保留；不能用整个 Planning 文件 hash 推断 FS 方法变更，因为 KN 授权 owned 方法会改变该文件。storeSnapshot/refresh 原事务和 source 语义保留；notes reconcile/source snapshot 合并的一次 invalidate 属于 KN 后续独占窗口，当前未调用 reconcile。

新增 public exports：本窗口无。此前已批准 POL core/storage/service exports 保留，其他 annotations 出口不覆盖。

## 可供下游使用的合同

- Workspace ctor 明确要求 `structureFiles: StructureFilePort`；生产注入 `new StructureFileStore()`。无默认缺失文件 port。owned pure scheduling fixtures 用 `MemoryStructureFiles`，真实 SQLite/FileStore/HTTP 验证单独提供。
- 一个 StructureSync project queue 包住 source index→recovery/read→同步业务动作。approve/verify/current approval 不能从 refreshIndex 返回后释放队列再读取。
- GET `/api/projects/:id/structure` 返回实际 raw-document 状态和 revision/digest/verifiedAt；可选 `acceptExternalConflict=1` 是显式接受有效外部版本，无 force write。
- PUT 同路径只允许 `{mutationId, expectedStructureRevision, expectedFileDigest, operation}`；operation 为 upsertFolder/upsertLegacyPolicy/importLegacy。客户端 source/projectId/时间/audit 字段拒绝。无自动 latest-CAS 生产重试。
- GET policies 默认保留原数组；`?includeStructure=1` 在同一次锁内提供 `{policies,structureRevision,fileDigest,verifiedAt,status}`。invalid/conflict/pending 返回错误，不能无标记回用 cached projection。
- POST policies 保留旧字段，必须显式提供同一读观察的 CAS 和 mutationId，否则 428。DB-only 同 id 仍编辑旧 DB 来源且文件 bytes 不变；新建/已迁移绑定写命名 extension。folder projections 明确按已审设计禁止旧 POST 编辑，需 upsertFolder；不把自然语言 forbidden 变成 forbiddenDependencies。
- GET `/structure/legacy-preview` 同次 guard 返回实际 DB-only policies 与 CAS/verifiedAt；PUT importLegacy 是显式迁移动作，在 finalize 同步事务中只删对应 DB ids。没有自动迁移真实工程。
- GET `/structure/audit?offset=0&limit=50`，limit 1–100；来源 server 指定，before/candidate/observed digest 分别记录。失败不宣称文件回滚，不宣称文件与 SQLite 跨事务原子性。
- startup `await service.recoverStructureWrites()` 在 open optional workspace 和 listen 之前。unknown read 保持 quarantine/pending，读恢复后再判断 digest；external C 保留原 bytes。
- KN 确定合同：current `getCurrentApproval` 必须 v1/current；draft、旧 revision、stale baseline/knowledge 为 NOT_APPROVED409；legacy/缺失或篡改 review context 为 APPROVAL_CONTEXT_INVALID409。普通 readPlan 仍展示历史/valid:false；verify 使用 strict `approvedForVerification` 历史 guard，允许明确 legacy 历史且不 fallback 到更旧历史。legacy 可读不代表 current 可执行。

## 最终冻结版本与真实验证

最终版本18文件 SHA 清单 `http-window-freeze.sha256`；精确 tracked 共享补丁 `http-window-shared.patch`；public exports 当前diff/sha `http-window-public-exports.*`（本窗口无新增行，可能含其他owner未提交出口）；共享只读依赖 `http-window-dependencies.sha256`（KN frozen Planning `89fdba1f...` / AnnotationReviewService `8a3b350e...`，记录实际源码，不冒称自己的owned文件）；两个 FS 方法 exact bytes 检查 `http-window-fs-method-check.txt`。

最终接线版本 **4文件65 PASS**：Workspace7 + server15 + 新HTTP12 + lifecycle31，原始回执 `http-window-kn-guard-green.txt`；其中12项包含 strict current/history 与malformed context HTTP拒绝、可信audit来源和candidate/observed实际digest。最终 noEmit（生产接线/新HTTP/helpers）与18文件lint退出0，回执 `http-window-types-final.txt` / `http-window-lint-final.txt`。没有重复把旧10/9/模块版本计数当当前12版本。

完整原始回执在 `receipts/`，没有删除 RED、setup failure、raw malformed fixture、oversize 现场或旧类型失败。首次 HTTP 接线 RED 为缺失 Workspace methods；原 `http-window-red.txt` 保留。

- 当前 pre-KN strict-current 接线版本新增 HTTP 10 PASS (`http-window-entrypoint-green.txt`)；其中真实文件往返/CAS/非法 schema、DB-only edit→preview→显式迁移→file edit、prepared/published 两个真实队列屏障、before/after/third/unknown 四个真实 SIGKILL durable-intent 分支、publish 后 DB finalize failure/recovery、实际 TSX source entrypoint before-listen recovery。
- 屏障实际断言 approve/current read 不 settled 且索引调用计数不增加；release 后旧 expected revision 拒绝、plan 仅 +1、历史审批仍一条。
- source entrypoint 测试直接 `node --import tsx apps/server/src/index.ts`，只用 owned 临时 root/data 和数据库；监听后的第一个结构/plan/audit 请求已反映恢复，SIGTERM exit0。未知读取分支真实 durable intent 搭配明确 fault port；复读成功后 finalize 一次。
- 修改后的旧 Workspace 7 与新增 HTTP 9 在 `http-window-recovery-green.txt` 共16 PASS；这里不是最终新版计数。实际 file publish 后 DB finalize fault，保留原 storage policy/plan rollback 断言，service读 pending/不可 approve；恢复后 bytes、projection、audit 和一次 invalidate 都验证。
- 旧 lifecycle 审批回滚原 settings[] 断言 FAIL 保留 `http-window-existing-wide.txt`；按父代理明确裁决，先 fresh structural read 建完整 baseline，再 exact settings equality，审批和 DB/Plan rollback 原断言不删、不过滤历史；该31项 PASS `http-window-lifecycle-baseline-green.txt`。
- 旧 bridge6/direct-loop22/agent routes5/group-view1/integration group-view1 在原 wide 回执 PASS，ports/await/CAS 夹具调整保留原行为断言。
- 原 server-shutdown 3 compiled subprocess 仅跑已有 dist，不能用于当前源码结论。窄 source alias 下 slow-complete shutdown 原测试另行1 PASS (`http-window-source-shutdown-green.txt`)，3 compiled case 明确 skipped。
- 18 个授权文件 lint PASS (`http-window-lint1.txt`)；生产接线、新 HTTP tests 和 helpers noEmit PASS (`http-window-types-production2.txt`)。扩大 noEmit 到旧 server/agent/e2e/integration夹具 FAIL 保留 `http-window-types-fixtures1.txt`，这些原 helper type errors 未修改。原字节/SHA 与 port-only patch 在 `legacy-fixture-types-original*`，说明 `http-window-legacy-fixture-types-note.md`。无全仓类型成功声明。
- KN strict current 接线新增12项测试，其中4项定向 RED保留 `http-window-kn-guard-red.txt`；原旧 assertion 字节/SHA 在 `http-test-before-kn-current-guard.*`。它证明 wrapper 仍返回普通 PlanDetail 而未调用 current guard，实际两callback接线与409映射后已 GREEN，最终65回执为准。

复现配置复制在本目录 `atlasmode-pol01-*.json/mjs`，实际运行在 `/tmp`；aliases 对 core/service/storage/indexer/server 指向 source，SIGKILL helper 使用 TSX source aliases。所有 TS检查 noEmit，无共享 root build。

## 设计修订与剩余窗口

spec 只修改原 line114固定 key清单新增 no-op第四 key，明确实现修订r2；原字节/SHA `spec-before-no-op-key-original.*`，唯一段落 diff `spec-no-op-key-only.diff`。原设计/模块 independent review 原文不改。

独立实际代码审查待父代理安排；KN自身窗口也待其独立审查，不把作者freeze当独立APPROVE。Web 原 policy form 尚未携 CAS，必须后续本票 UI 窗口完成 source/status/metadata capture、folder专用编辑、有效preview迁移、409保留输入与显式 reread、实际 reload 往返；428目前仅说明尚未提交的服务窗口，不能据此宣布旧UI可用或整票DONE。MCP仍需接单一 approved endpoint 和同一次 policy metadata envelope，本窗口未写。Windows/macOS未实跑，外部编辑器最后 digest check→rename 的真实 TOCTOU仍存在，未宣称跨进程 CAS。

冻结记录：2026-10-10T17:31:17.173639+00:00。未 stage/commit/push，未rootbuild；从此只读等待审查。
