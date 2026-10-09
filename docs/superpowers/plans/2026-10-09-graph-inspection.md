# Graph inspection 实施计划

> **For agentic workers:** 使用 `subagent-driven-development`，独立任务并行，共享文件顺序集成；步骤以复选框跟踪。

**Goal:** 完成 UI-05～UI-10，让用户自由移动图、查看真实引用、辨认类型，并直接审查实际规划。
**Architecture:** 复用单一 React Flow 图、Workspace 项目/快照请求边界与现有规划批准服务；core 提供分页证据，Canvas 统一手势、选中与浮层。
**Tech Stack:** TypeScript、React、React Flow、Zustand、Fastify、Vitest、Playwright。
**Spec:** `docs/superpowers/specs/2026-10-09-graph-inspection-design.md`（用户于 2026-10-09 明确批准并授权实施）。

## Global Constraints

- 当前 `work` 分支；保留已有 AGENTS.md 修改。左右双 Chat 保持现有结构，认证沿用现有 Codex Profile/API。
- 全部入口使用同一项目和快照上下文；稳定 ID 与旧快照兼容。
- 普通图继续保存现有手动布局；漏斗位移按项目+当前漏斗根+节点保存临时偏移。
- Hover/键盘 focus 约90ms，不移动镜头；单击持久选择；真实 relationId 唯一定位。
- 拖动不改源文件、规划 revision 或批准。批准只绑定当前 revision/baseline，由用户单独触发。
- 本地图标字体随网页分发并保留许可证，提供文字回退。
- 相称行为测试及必要构建/类型检查；额外门禁预算零。独立审查合并为一次针对本轮修改的必要代码审查，沿用验证证据。
- archify 调研已完成；Tunnel 保持当前关闭状态。文档收尾使用 neat-freak。

## Review Focus

1. 动画中拖动、分页与异步响应竞争：保留手动位置，旧响应无法恢复已关闭选择。
2. 同名函数及相同端点多条调用：以稳定节点/关系 ID 展示和高亮。
3. 文件跨界调用与 imports 分组、未知及截断：保留原始证据与精确总数。
4. 类/方法/旧快照：AST 元信息优先，明确 class 签名兼容，不凭大小写猜测。
5. 新规划提醒与用户导航竞争：提示待审，打开与批准分离，过期或新 revision 明确显示。

### Task 1: UI-07 后端引用证据（backend agent）

**Files:** `packages/core/src/queries.ts`、`queries.test.ts`；`apps/server/src/queries.ts`、`routes.ts`、相关测试；`apps/web/src/api/client.ts`。
**Interfaces:** `FunctionContextResult` 新增可选 `relatedNodes?: CodeNode[]`（兼容既有 fixture）；新增 `FileContextResult`、`getFileContext(snapshot, nodeId, Pagination)`；HTTP `GET /projects/:id/files/:nodeId/context`；client `fileContext(id,nodeId,offset=0,limit=50)`。
文件结果字段：`node, members, incoming, outgoing, imports, unknown, totalMembers, totalIncoming, totalOutgoing, totalImports, totalUnknown, relatedNodes, offset, limit, truncated, snapshotId, dataSource`。各分组独立按同一 offset/limit 分页；incoming/outgoing 仅跨文件 resolved calls；imports 保留实际 imports；unknown 保留本文件外部/未解析调用。relatedNodes 仅本页真实端点与成员，保持有界。
- [x] 写行为测试：同名隔离、多调用证据、内部调用排除、imports 与 unknown 分组、分页与非法/跨项目 ID。
- [x] 运行定向测试确认缺功能失败。
- [x] 实现 core 聚合、HTTP 边界与 client 方法；函数查询补充本页端点。
- [x] 定向测试通过并报告接口/命令/结果；构建由主 Agent 顺序统一执行。

### Task 2: UI-09 声明与图标（types agent）

**Files:** `packages/core/src/model.ts`；`packages/indexer/src/typescript.ts`、`python.ts`及 Python AST helper；相关 indexer 测试；新 `apps/web/src/features/graph/nodeIdentity.tsx`、`nodeIdentity.test.tsx`、`nodeIdentity.css`、`apps/web/public/fonts/`。
**Interfaces:** `CodeNode.declarationKind?: "function" | "method" | "class"`；导出 `nodeIdentity(node, locale)` 返回 `{label,typeLabel,icon}`、`NodeIdentity` React 组件。Canvas/详情由 Task 3 引入；本任务保持 Canvas、WorkspacePanels、app.css 原文件由其他负责人集成。
- [x] 写 TS/Python class/method/function、稳定 ID 及旧 class 签名回退的行为测试，运行观察缺字段失败。
- [x] 从 AST 填充可选元信息；保留 schema 与历史兼容。
- [x] 取得最小 Nerd Fonts 本地字体子集和许可证，记录固定来源；独立 CSS 和组件提供类型文字与通用回退。
- [x] 定向测试通过，报告字体来源/体积/许可及接入方式。

### Task 3: UI-05/06/07/08 画布与详情（canvas agent）

**Files:** `apps/web/src/features/graph/Canvas.tsx`、新增高亮/详情/小地图模块与行为测试；`apps/web/src/app/workspace.ts`、Workspace 相关测试；`WorkspacePanels.tsx`；专属 `graph-inspection.css`；`tests/e2e/graph-inspection.spec.ts`。
**Interfaces:** 使用 Task 1 的 fileContext/relatedNodes 和 Task 2 的 NodeIdentity。Workspace 管理详情打开/关闭与关系预览，提供节点选择、引用分页、按 ID 跳转；关闭使 inspect 请求失效。Canvas 通过选中 ID 与真实 relationId 共享高亮状态。UI-10 集成点留给主 Agent，完成本文件后移交。
- [x] 新增先失败测试，覆盖拖动动画取消、漏斗根隔离/翻页保存、唯一关系高亮、关闭/切项目/切快照响应丢弃。
- [x] 统一点击/双击/拖动：始终可拖、取消布局与相机动画、普通保存与漏斗临时偏移分离、显式重新排列。
- [x] 实现90ms hover/键盘预览、点击固定、方向图例、关系行/边双向高亮；空白清理，Esc 小地图→详情→漏斗。
- [x] 实现函数/文件/规划详情卡：320–400px 桌面可避让、窄屏底部；引用分组与分页；源码显式按钮；引用跳转用有预算查询并更新路径。
- [x] 引入类型组件；扩展小地图到约420×280，视口框、点击/拖动导航、滚轮/按钮缩放、返回选择/适配当前范围/收起；标明加载范围。
- [x] 运行单元定向验证；浏览器行为测试交主 Agent 在编译完成后顺序运行，覆盖真实坐标/视口/唯一关系与浮层避让。

### Task 4: UI-10 待审入口及最终验收（主 Agent）

**Files:** `apps/web/src/features/planning/PlanOverview.tsx`、新增 `PendingPlans.tsx`/测试；Task 3 移交后修改 `WorkspacePanels.tsx`/必要 workspace 集成；`tests/e2e/graph-inspection.spec.ts`；本轮报告与票据文档。
**Interfaces:** 固定按钮「待你审查 · N」展开各草稿标题、目的、数量、状态；调用现有 choosePlan 聚焦。选中变更用现有 FocusRequest 与 Canvas 选中状态，批准沿用 app.approve 的 revision/baseline 校验。
- [x] 先测试 pending 分类、新 revision 及打开/批准分离；实现待审组件与逐项变更选择。
- [x] 顺序接入 WorkspacePanels；保持新草稿提示与导航 generation 保护。
- [x] 按变更包依赖顺序构建/类型检查、定向 lint；汇总相关行为测试，顺序运行新浏览器场景。
- [x] 在固定 Flask 示例创建实际未批准规划，打开查看改动；检查浅/深色、窄屏、拖动、高亮、引用、小地图；保存可查验规划 ID/revision/baseline 与截图。
- [x] 一次必要独立代码审查，针对发现修正与定向复验；以 verification-before-completion 核对实际证据。
- [x] neat-freak 同步 README/state/UI-05～10/票据索引及验收报告，清理本轮临时产物，保留实际待审演示入口与必要证据。完成后在 work 交付。
