# 首轮实现接口约定

本文件是实现 Ticket 之间的接口；变更需在 SDD ledger 记录，通知后续实现者。
代码的最终公共类型以 packages/core/src/index.ts 为准。所有 ID 是 string，时间是 ISO string。

## 核心实体（字段名固定）

```ts
type Language = 'typescript' | 'javascript' | 'python' | 'unknown';
type CodeNode = {
  id: string; kind: 'function' | 'file' | 'folder' | 'external'; name: string;
  qualifiedName?: string; filePath?: string; parentId?: string; language?: Language;
  signature?: string; startLine?: number; endLine?: number; exported?: boolean;
};
type Relation = {
  id: string; type: 'calls' | 'imports' | 'contains'; sourceId: string;
  targetId: string | null; resolution: 'resolved' | 'unresolved' | 'external';
  evidence: { filePath: string; line: number; text?: string }; reason?: string;
};
type CodeSnapshot = {
  id: string; projectId: string; createdAt: string; gitRevision: string | null;
  contentHash: string; nodes: CodeNode[]; relations: Relation[];
  diagnostics: { filePath: string; line?: number; message: string }[];
  coverage: { files: string[]; excludedPatterns: string[]; unresolvedCount: number };
};
type Project = { id: string; path: string; name: string; snapshotId?: string };
type Operation =
  | { kind: 'add_function'; tempId: string; name: string; filePath: string; signature?: string; description?: string; language?: Language }
  | { kind: 'remove_function'; nodeId: string }
  | { kind: 'add_relation'; id: string; sourceId: string; targetId: string; type: 'calls' | 'must_call' | 'must_reuse' }
  | { kind: 'remove_relation'; relationId: string }
  | { kind: 'move_function'; nodeId: string; filePath: string }
  | { kind: 'annotate'; targetId: string; text: string };
type Plan = {
  id: string; projectId: string; title: string; description: string;
  baselineSnapshotId: string; baselineContentHash: string; revision: number;
  operations: Operation[]; status: 'draft' | 'approved' | 'stale';
  createdAt: string; updatedAt: string;
};
type Approval = {
  id: string; planId: string; revision: number; semanticHash: string;
  baselineSnapshotId: string; baselineContentHash: string; approvedAt: string; actor: 'user';
};
type ValidationIssue = { severity: 'error' | 'warning'; code: string; message: string; operationIndex?: number };
type PlanDetail = { plan: Plan; approval?: Approval; valid: boolean; issues: ValidationIssue[] };
type BrowseRoute = {
  id: string; projectId: string; snapshotId: string; revision: number; title: string;
  description: string; source: 'agent' | 'user'; kind: 'walkthrough' | 'call_chain';
  steps: { nodeId: string; note: string; relationId?: string }[]; createdAt: string;
};
type FunctionGroup = { id: string; projectId: string; title: string; description: string; source: 'agent' | 'user'; memberIds: string[] };
type DirectoryPolicy = { id: string; projectId: string; pathPrefix: string; purpose: string; forbiddenDependencies: string[] };
type ViewState = { positions: Record<string, { x: number; y: number }>; theme: 'light' | 'dark'; locale: 'zh' | 'en' };
type VerificationReport = {
  planId: string; revision: number; snapshotId: string;
  items: { operationIndex: number; status: 'satisfied' | 'unmet' | 'unknown'; message: string; evidence: string[] }[];
};
```

## Ports 与纯函数

- `IndexerPort.index(rootPath: string, projectId: string): Promise<CodeSnapshot>`。
- `IndexerPort.readSource?(rootPath:string,filePath:string):Promise<{filePath:string;content:string}>`：
  由 indexer 执行实际文件读取与 realpath 范围检查；service 委托此 port，不自行实现代码 I/O。
- `StoragePort.get<T>(kind: RecordKind, id: string): T | undefined`、`list<T>(kind): T[]`、
  `put<T>(kind,id,value): void`、`delete(kind,id): void`、`transaction<T>(fn:()=>T):T`、`close():void`。
- `RecordKind = 'projects'|'snapshots'|'plans'|'approvals'|'routes'|'views'|'groups'|'policies'|'settings'`。
- `makeId(kind: string, ...parts: string[]): string`：纯、确定性，不能用行号做符号 ID。
- `normalizeRepoPath(path: string): string`：统一分隔符；拒绝绝对路径、空文件路径、父目录越界。
- `validatePlan(plan: Plan, snapshot: CodeSnapshot, policies?: DirectoryPolicy[]): ValidationIssue[]`。
- `validateRoute(route: BrowseRoute, snapshot: CodeSnapshot): ValidationIssue[]`。
- `semanticPlanContent(plan: Plan): string`：确定性语义序列化，不含布局、时间或状态。
- schema 公共导出：`operationSchema`、`snapshotSchema`、`planSchema`、`routeSchema`。
- `DomainError(code: string, message: string)`：服务错误；HTTP 状态由 server 映射。

## 实现入口

- indexer：`class SourceIndexer implements IndexerPort`，无参数构造；允许配置 Python 可执行文件。
- storage：`class SqliteStorage implements StoragePort`，构造 `(databasePath: string)`，创建父目录并迁移。
- service：`class WorkspaceService`，构造 `({ storage, indexer }: {storage:StoragePort; indexer:IndexerPort})`。
- server：`async createServer({ service, webRoot? }): Promise<FastifyInstance>`，工厂不自行 listen。
- server CLI：环境路径与端口，构造实现、打开默认项目（如存在）、再 listen。
- MCP：`createMcpServer(apiUrl: string)` 返回 SDK server；CLI 连接 stdio，日志 stderr。

WorkspaceService 公共方法：

```ts
listProjects(): Project[];
openProject(path: string): Promise<Project>;
getProject(id: string): Project;
getSnapshot(projectId: string): CodeSnapshot;
refreshIndex(projectId: string): Promise<CodeSnapshot>;
createPlan(input: {projectId:string;title:string;description?:string;baselineSnapshotId?:string}): PlanDetail;
listPlans(projectId: string): PlanDetail[];
getPlan(id: string): PlanDetail;
updatePlan(id: string, input: {expectedRevision:number;operations:Operation[];title?:string;description?:string}): PlanDetail;
approvePlan(id: string, expectedRevision:number): Promise<PlanDetail>;
verifyPlan(id: string): Promise<VerificationReport>;
exportPlan(id: string, format:'json'|'markdown'): string;
listRoutes(projectId: string): BrowseRoute[];
createRoute(input: Omit<BrowseRoute,'id'|'revision'|'createdAt'>): BrowseRoute;
getView(projectId: string): ViewState;
saveView(projectId: string, view:ViewState): ViewState;
listGroups(projectId:string):FunctionGroup[];
saveGroup(input:Omit<FunctionGroup,'id'> & {id?:string}):FunctionGroup;
listPolicies(projectId:string):DirectoryPolicy[];
savePolicy(input:Omit<DirectoryPolicy,'id'> & {id?:string}):DirectoryPolicy;
readSource(projectId:string,filePath:string):Promise<{filePath:string;content:string}>;
```

getPlan.valid 基于最近索引状态：仅在确有匹配 revision/hash 的批准、当前快照内容基线
未变且校验无错误时为 true。手动刷新更新 UI 状态；MCP get_approved_plan 在读取前
必须刷新真实索引，不能向即将实施的 Agent 声称尚未扫描的工作树仍有效。
createPlan 若传入 baselineSnapshotId，必须匹配当前快照，否则 409；MCP propose_plan
要求调用者显式给出该字段，防止 Agent 把基于旧查询的规划绑定到另一个新快照。
approvePlan/verifyPlan 在执行前刷新真实索引，approvePlan 不改变语义 revision；批准表保留历史。
verifyPlan 使用最近一个确有批准的历史
revision（更新后的未批准 draft 不能冒充已批准内容），新快照允许与批准基线不同。
createRoute 拒绝无效端点；读取路线的过期状态由其 snapshotId 对比当前快照。
call_chain 从第二步起，每一步 relationId 指向上一节点到当前节点的 resolved calls
关系并携带源码证据。walkthrough 不需要调用边；若提供 relationId，必须与该步骤节点相关。

## HTTP（统一 JSON；默认成功返回实体，无额外包裹）

| 方法与路径 | 参数/响应 |
| --- | --- |
| GET /api/health | `{status:'ok'}` |
| GET /api/projects | Project[] |
| POST /api/projects | `{path}` → 已索引 Project |
| GET /api/projects/:id/snapshot | CodeSnapshot |
| POST /api/projects/:id/refresh | CodeSnapshot |
| GET /api/projects/:id/summary | `{project,snapshotId,contentHash,counts,entrypoints,diagnostics,coverage}` |
| GET /api/projects/:id/functions?q=&offset=&limit= | `{items:CodeNode[],total,offset,limit}` |
| GET /api/projects/:id/functions/:nodeId | `{node,incoming:Relation[],outgoing:Relation[]}` |
| POST /api/projects/:id/subgraph | `{nodeIds,depth?,budget?}` → `{nodes,relations,truncated,snapshotId}` |
| GET /api/projects/:id/source?filePath= | `{filePath,content}` |
| GET /api/projects/:id/plans | PlanDetail[] |
| POST /api/plans | createPlan input → PlanDetail |
| GET /api/plans/:id | PlanDetail |
| PUT /api/plans/:id | updatePlan input → PlanDetail |
| POST /api/plans/:id/validate | ValidationIssue[] |
| POST /api/plans/:id/approve | `{expectedRevision}` → PlanDetail（不提供对应 MCP 工具） |
| POST /api/plans/:id/verify | VerificationReport |
| GET /api/plans/:id/export?format=json\|markdown | 指定 Content-Type 的导出字符串 |
| GET/POST /api/projects/:id/routes | BrowseRoute[] / createRoute input（projectId 由路径确定） |
| GET/PUT /api/projects/:id/view | ViewState |
| GET/POST /api/projects/:id/groups | FunctionGroup[] / saveGroup input |
| GET/POST /api/projects/:id/policies | DirectoryPolicy[] / savePolicy input |

默认 function limit=50，最大 200；subgraph 默认 depth=1、budget=80，最大 depth=5、budget=300。
无效输入 400，找不到 404，revision/基线冲突 409，Python 缺失给出可操作错误/诊断。
对每次预算裁剪明确 truncated；规划、路线不能引用另一个 project 的节点。
