# POL-01 独占模块冻结与共享窗口申请

2026-10-10，VM2 `/home/agent/projects/AtlasMode`。仅新模块与专属测试已实现；产品接入未实现，POL-01 不可标 DONE。本轮不 commit/push，不写共享 dist/root build，不更改 generated memory 或清理失败现场。

## 冻结范围

- core：`structure-types.ts`、`structure.ts`、`structure.test.ts`。
- storage：`structure-file.ts`、`structure-file.test.ts`。
- service：`structure-state.ts`、`structure-sync.ts`。
- server：新 `structure-sync.test.ts`，真实 SQLite/文件集成测试；原 service 路径测试移出以遵守依赖 DAG。
- 已获授权的公共出口仅：core `export * from "./structure-types.js"`、`export * from "./structure.js"`；storage `export { StructureFileStore } from "./structure-file.js"`；service `export { StructureSync } from "./structure-sync.js"`。保留他票所有出口，含 KN01 annotations。完整当前出口差异见 `public-exports.patch`，他票 annotations 不属于本票修改。
- 精确 SHA256 见 `module-freeze-sha256.txt`；本报告之后独占源文件不再修改，等待独立 high 代码审查。

## 实际验证

`receipts/modules-freeze.txt`：3 文件、48 PASS（core17/file11/sync20）。`receipts/types-freeze.txt` 与 `receipts/types-tests-freeze.txt`：生产模块及三个测试源码隔离 noEmit 检查，exit 0。`receipts/lint-freeze.txt`：8 独占文件 lint，exit 0。临时配置原文保存在本目录；它们只切换公共包的源码解析，不关闭任何 lint/DAG 规则，不产生 dist。

RED 与首次失败均保留于 receipts：core missing behavior、file open/write/fsync/close/rename 故障、首次异步门未捕获、oversize 断言超时、main premature annotations export 导致 missing-module、sync missing behavior、invalid→deletion 修复、zero-record migration/equivalent legacy edit/unrecoverable finalize、同 id 来源冲突/等值迁移磁盘重检、projection id shadow、旧 src test DAG lint FAIL。最终 oversize 验证用真实 Buffer.compare 比较原字节，未增加测试 timeout；真实 I/O 测试夹具目录与 SQLite 留在 `/tmp/atlas-pol01-*`，不删除。

验证覆盖：完整 JSON 未知值保留；严格 v1、重复 key/path、类型、UTF-8/1MiB；before/after/third digest 恢复；prepare 与 publish 后待 finalize 的确定性 Promise barrier；migration 原子回滚与仅删除本次 id；当前 plan 一次失效、其他项目与历史 approval 不变；候选 B 与实际 C 摘要分离；等价旧策略 no-op；文件同 id 冲突与 folder projection id 隔离。

实际 UI、HTTP/MCP 接入、WorkspaceService 批准/核对互斥、startup-before-listen recovery、Windows/macOS adapter 验证尚未运行。模块 barrier 只证明 StructureSync 队列能力，不等于现役 WorkspaceService 已修复。任意外部编辑器仍存在 digest 重检到 rename 之间的真实 TOCTOU；没有宣称跨进程文件 CAS。

## 已实现接口

`new StructureFileStore()` 实现 core `StructureFilePort.read(root)` / `publish(root,{mutationId,expectedDigest,bytes})`，同目录 temp→sync→close→重检→rename，明确返回 published/not_published/uncertain。

`new StructureSync({storage,files,project:(id)=>Project,legacyPolicies:(id)=>DirectoryPolicy[]})`：

- `getStructure(projectId,{acceptExternalConflict?:boolean}={}) -> Promise<StructureState>`，普通读取只报告冲突，显式 accept 可接纳有效外部版本，不覆盖文件。
- `updateStructure(projectId,StructureWriteInput) -> Promise<StructureState>`，UUID + structureRevision + 实际 fileDigest，受控 DB-only 编辑/显式迁移/文件编辑共用项目队列。
- `withProject(projectId,async(session)=>T) -> Promise<T>`；`session.readStructure()` 在当前队列内检查恢复与有效状态，invalid/conflict/pending 会拒绝。调用方必须持有该 scope 到同步批准提交或有效批准读取结束；不要嵌套调用会重新入队的 get/update/refresh。
- `policies(projectId) -> DirectoryPolicy[]` 是已同步 state 的同步投影，pending/invalid/conflict 会拒绝；只能由持有队列并刚 read 的业务边界调用，不是外部新鲜度 API。
- `listStructureAudit(projectId,{offset,limit})`，limit 1–100、服务器来源、无 terminal 全文；`recoverStructureWrites()` 供 listen 前启动与定向恢复。

## 精确共享窗口申请（尚未授权）

第一窗口建议限定以下文件，先实现业务/HTTP，再单独授权 UI/MCP：

1. `packages/service/src/workspace.ts`：注入必需 `StructureFilePort` 并组装 StructureSync；新增 get/updateStructure、audit、recover 方法与新鲜 readPolicies。Planning 的同步 policies provider 用已同步投影；外部 policies/旧 POST 都通过新鲜受控边界。approvePlan、verifyPlan、新增 readApprovedPlan 必须在同一个 StructureSync.withProject 中完成 index 实际刷新→session.readStructure→同步业务读取/批准提交；抽取 refreshIndexLocked 避免嵌套队列死锁。open/select/显式 refresh 同步结构。现役方法的同步/异步调用迁移需同窗口审查。
2. `packages/service/src/knowledge.ts`：仅去掉现役政策写入旁路、保留其他 groups/routes/view；旧 DB 读取用于 legacyPolicies，旧策略编辑由 StructureSync 完成，不独立二次 invalidation。`planning.ts` 原则上不改批准 hash/历史契约；若为了传入同步投影需小修改，另列 exact diff 请求，不擅改。
3. `apps/server/src/index.ts`：注入真实 `new StructureFileStore()`，startup recover 在 listen 前运行，单项目冲突不挡其他项目启动。对应新构造器调用的既有测试/独占新 Workspace 测试，需主代理给准确窗口。
4. `apps/server/src/routes.ts`：GET/PUT `/api/projects/:id/structure`、GET `/structure/audit`；旧 GET policies 保留数组形状但 awaited 新鲜度，旧 POST 加 mutationId/两项前置条件，缺失返回 428；新增 GET `/api/plans/:id/approved` 单一 readApprovedPlan 用例。必须保留现有 strict schema 与安全写 gate。
5. `apps/server/src/server.ts`：仅在 existing error mapping 中补 INVALID_STRUCTURE/STRUCTURE_CONFLICT/STRUCTURE_RECOVERY_PENDING/STRUCTURE_PRECONDITION_REQUIRED 的诊断及 422/409/503/428（实际已有映射优先复用）；不动 SEC socket/origin/body gate。

第二窗口：`apps/mcp/src/server.ts` 的 get_approved_plan 调用单一 approved endpoint；get_folder_policies 要同一次政策新鲜读取附 structureRevision/fileDigest/verifiedAt/status，不能两次无锁 HTTP 拼接元数据。建议首窗口政策 GET 增可选 metadata envelope query 或另有专用 context endpoint，默认数组兼容；该具体 HTTP 形状由 main 协调后定。MCP 工具描述保持说明自然语言职责/未执行 import rule。

第三窗口：实际文件路径须在授权后读取当前 tree 确认，候选 `apps/web/src/app/Workspace.tsx`、`apps/web/src/api/client.ts`、`apps/web/src/i18n/{zh,en}.ts`、Navigation 的现有工程入口。只接入 spec 的 folder 编辑、legacy 来源/迁移 preview、同步状态/audit、409 draft 保留与晚到响应隔离；不实现 POL-02 engine。KN/IDX 的 Navigation/i18n 待其共享窗口释放再做，不抢写。

最终需要 main 集成 root checks、独立代码 review、真实浏览器 A7 闭环才可完成产品票。
