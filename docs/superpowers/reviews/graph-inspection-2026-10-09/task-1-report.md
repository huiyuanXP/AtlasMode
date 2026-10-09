# Task 1：UI-07 后端引用证据

状态：实现完成，定向测试通过；整体产品构建、前端集成与独立审查由主 Agent 统一推进。

## 当前接口

- `FunctionContextResult.relatedNodes?: CodeNode[]`：实际查询返回本页 incoming/outgoing 的真实端点，按稳定 ID 去重并确定性排序；可选类型兼容已有 fixture。
- core 公共入口导出 `FileContextResult` 与 `getFileContext(snapshot, nodeId, Pagination)`。
- HTTP：`GET /api/projects/:id/files/:nodeId/context?offset=0&limit=50`，复用现役严格分页 schema。`limit` 范围 1–200；非法、重复、额外 query 字段返回 400；未知、错误类型和跨项目文件 ID 返回 404。
- web：`HttpApi.fileContext(id, nodeId, offset=0, limit=50)`，项目与节点 ID 按现役编码方式发送。
- 文件结果字段：`node, members, incoming, outgoing, imports, unknown, totalMembers, totalIncoming, totalOutgoing, totalImports, totalUnknown, relatedNodes, offset, limit, truncated, snapshotId, dataSource`。
- 每组独立应用同一 offset/limit。members 包含本文件内函数/类/方法声明，以 filePath 或真实 parentId 链确认归属。incoming/outgoing 仅跨文件 resolved calls；同端点多次调用各保留原始 relationId 和 evidence。imports 保留与本文件有关的双向真实 imports，包括未解析 imports；unknown 包含本文件发出的 external/unresolved calls。
- `relatedNodes` 只包含当前页成员和五组当前页证据的真实端点。空页返回空数组；不会追加整个项目或按名称猜测节点。`truncated` 遵循已有函数 context 语义，表达结果经过分页裁剪。

## 文件

- `packages/core/src/queries.ts`：函数本页端点及文件聚合查询、结果类型。
- `packages/core/src/queries.test.ts`：稳定 ID、独立调用证据、内部调用分组、imports/unknown、成员归属、确定性分页、空页及边界验证。
- `apps/server/src/queries.ts`：项目当前快照绑定。
- `apps/server/src/routes.ts`：严格验证后的文件 context 路由。主 Agent 已确认该文件归属；server.ts 沿用现役 registerRoutes 结构。
- `apps/server/src/server.test.ts`：真实 SourceIndexer/SQLite/WorkspaceService/HTTP 的文件证据与边界验证。
- `apps/web/src/api/client.ts`：文件查询调用入口。

## RED → GREEN 证据

1. RED：`npx vitest run packages/core/src/queries.test.ts apps/server/src/server.test.ts`，2026-10-09 09:15 UTC，5 项失败 / 21 项通过。函数本页端点为 undefined；文件 core API 尚未提供；HTTP 路由返回 404，预期 200。
2. core GREEN：`npx vitest run packages/core/src/queries.test.ts`，11 项通过，499ms。
3. 主 Agent 顺序构建 core 退出 0，使依赖 dist 的 HTTP 测试读取当前公共查询实现。
4. 最终定向 GREEN：`npx vitest run packages/core/src/queries.test.ts apps/server/src/server.test.ts apps/web/src/api/client.test.ts apps/server/src/funnel-query.test.ts`，2026-10-09 09:18 UTC，4 文件 / 29 项通过，4.49s。覆盖既有函数查询、子图、文件依赖汇总和 client receiver 回归。
5. `npx eslint packages/core/src/queries.ts packages/core/src/queries.test.ts apps/server/src/queries.ts apps/server/src/routes.ts apps/server/src/server.test.ts apps/web/src/api/client.ts` 退出 0。改动文件已用现役 Prettier 格式化。

## neat-freak 范围与交接

- 代码：`changed-and-verified`；所有修改限于委派文件及主 Agent 确认的 routes.ts。
- 运行态：HTTP inject 的真实组件链为 `changed-and-verified`；当前预览发布与产品浏览器行为由主 Agent 跟踪，`out-of-scope`。
- 文档：本子任务报告 `changed-and-verified`。`docs/superpowers/contracts.md` 查询列表需补文件查询/结果类型、路由与有界端点语义；UI-07、README/state 的整体状态由主 Agent 同步，`pending`。同步点已通过消息交接。
- 规则：`verified-current`；保留用户 AGENTS.md 修改，定向验证预算执行，主 Agent 负责统一构建。
- 记忆：`not-applicable`。
- 工作区：`verified-current`；本任务未产生独立临时文件、数据库或提交，测试 cleanup 清理自有临时目录。子任务报告保留给集成与审查。

## 实质限制

- 查询使用当前静态索引快照；外部/未解析调用保持原始原因和证据。文件聚合保留现有索引能力边界。
- 类与方法使用现役 kind=function，并保留完整 CodeNode；声明类型补充由并行索引任务提供。
- 全产品构建、前端详情的异步隔离及浏览器验收留在主 Agent 的集成范围。
