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
  coverage: {
    files: string[]; excludedPatterns: string[]; unresolvedCount: number;
    configurationFiles?: string[];
    packageFiles?: string[];
    availability?: { complete: boolean; unavailablePaths: string[]; excludedPaths?: string[] };
  };
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
  `contentHash` 从 static-commonjs Task2 起使用 v3 索引输入摘要：捕获源码、配置和包
  的路径/bytes 均参与 SHA-256，以 `codemap-index-inputs-v3\0` 开头，按 source、
  configuration、package 类型分组，再按路径确定排序；每条含类型、UTF-8路径长度、路径、
  byte长度和原始bytes边界。无效 JSON/JSONC 和仅空白变化也改变输入摘要。
  旧快照和历史批准不重写；升级后再次刷新会保守地产生新基线。
  snapshot ID 同时纳入确定性分析结果
  （nodes/relations/diagnostics/coverage），排除观察时间、Git revision 和实际 root。
  同输入/同分析结果保持 ID；解析能力变化不得让不同事实共用 ID 或覆盖历史。
- `coverage.configurationFiles?: string[]` 列出成功捕获的repo-relative配置路径，
  与源码 `coverage.files`、文件/函数 CodeNode 和计数分离。缺字段的旧快照schema
  仍可读取，不新增SQLite migration；IndexerPort、HTTP和MCP接口保持原样。
- `captureConfigurations(root, allowedPaths)` 返回 `{files: SourceFile[], diagnostics}`；
  `SourceFile={path:string;bytes:Buffer}`；scan额外返回 `configurations: SourceFile[]`。
  仅已通过初次枚举、固定排除、Git ignore和symlink检查的JSON路径可成为输入，
  种子basename为`tsconfig*.json`。以已安装TypeScript解析JSONC，捕获相对`.json`
  extends（字符串/数组、Windows分隔符）；不读包/node_modules/网络，也不执行目标。
  确定性排序并共享一次捕获，限制262144 bytes/文件、4194304 bytes总量、512文件、
  16层（种子为第1层，第17层拒绝）。在实际打开handle的stat和有界读取后检查预算。
  保留无效JSONC bytes用于hash；预算/读取拒绝的bytes不作为推断输入。
  诊断只含配置路径和脱敏原因，不回显配置原文。extends拒绝诊断归属引用它的配置，
  文件读取/预算拒绝归属被拒绝路径，路径/原因确定排序。
- 已枚举但ignored/symlinked/不可读/非普通文件的配置种子，以及capture读取或预算
  拒绝的配置，通过原diagnostic结构的稳定message前缀`CONFIGURATION_UNAVAILABLE:`
  和规范化filePath保留配置不可用证据；不新增diagnostic字段，不把配置种子加入
  源码availability或数量。固定排除目录不额外遍历；其中没有捕获源码可继承配置。
  Task2内部resolver可增加可选第三参数`captureDiagnostics=[]`，由TypeScript集成
  传递scan诊断，以不可用最近`tsconfig.json`阻止ancestor fallback。
  即使其它独立种子已捕获某条extends链的bytes，resolver仍须逐个归属配置验证
  深度/循环/预算/拒绝链；全局捕获成功不证明该链可部分应用paths/baseUrl。
  此Task1仅提供输入与证据，路径解析和UI展示分别由Task2/Task3实现。
- `coverage.availability` 是可选、向后兼容的扫描证据，参与 snapshot ID，不计入源码文件/函数数量。
  `complete` 表示固定分析范围的目录枚举是否完成，不代表解析成功或运行时完整。
  `unavailablePaths` 是该范围内因 Git ignore、symlink、读取/枚举失败而无法取得的
  repo-relative 文件/子树；`excludedPaths` 是实际遇到的固定范围外根（如 .git、
  node_modules、dist，包括同名 symlink）。固定范围外根不参与全语言迁移/缺失搜索，
  但明确指向其内部的目标不可判定。诊断继续表达解析失败。
  已有文件被 ignore、原路径/父目录不可用时，删除函数/关系和移动的负面证据为 unknown；
  完整枚举下真实删除仍可 satisfied。缺 availability 的旧快照仍可读取，但文件缺失
  不能证明删除；已捕获文件中的确定事实保持可用。不声称防御任意并发文件系统竞态。
- 核对中的同名跨文件候选不能正向证明 must_reuse/calls；需要稳定 ID 或批准的 move。
  唯一候选可保守阻止删除成功，多候选/不完整证据保持 unknown。
- TS/JS 仅 const 变量的直接 callable initializer 可作为稳定初始化绑定；let/var、
  对象/类字段 initializer 保留 unresolved，不做执行或流分析。直接声明和 const 控制仍可解析。
- `validatePlan` 对有效端点的每条 planned calls/must_call/must_reuse 返回
  `severity:'warning', code:'COMPATIBILITY_UNKNOWN'`，提示参数/返回值及可能适配需要人工审阅。
  警告不阻止结构有效的批准；service、HTTP、MCP 原样传递，UI 展示 warning。
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
- T04 的查询类型/纯函数由 core 公共入口导出。搜索、函数上下文和子图算法不放在
  server；server 只读取 service 快照、验证请求并调用纯函数。
  公共函数名：`searchFunctions(snapshot,{q?,offset?,limit?})`、
  `getFunctionContext(snapshot,nodeId,{offset?,limit?})`、
  `getSubgraph(snapshot,{nodeIds,depth?,budget?,relationTypes?})`、
  `getProjectSummary(project,snapshot)`。
  结果类型名：`FunctionSearchResult`、`FunctionContextResult`、`SubgraphResult`、
  `ProjectSummary`；输入类型名：`Pagination`、`FunctionSearchInput`、`SubgraphInput`。

## 实现入口

- indexer：`class SourceIndexer implements IndexerPort`，无参数构造；允许配置 Python 可执行文件。
- storage：`class SqliteStorage implements StoragePort`，构造 `(databasePath: string)`，创建父目录并迁移。
- service：`class WorkspaceService`，构造 `({ storage, indexer }: {storage:StoragePort; indexer:IndexerPort})`。
- server：`async createServer({ service, webRoot?, developmentProxy? }): Promise<FastifyInstance>`，工厂不自行 listen。
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
T07 起，功能分组或目录约束的实质变化与该项目全部当前规划的 revision+1、
status=draft 在同一同步事务保存；包括职责文本和组成员变化。历史批准及对应的
approvedPlan 保持原样，核对继续使用历史批准 revision。此规则保守地要求整个
项目重新确认，无需增加公共 Plan/Approval 字段；语义 hash 仍摘要 Plan 内容，
revision 区分外部知识变化。历史目录/分组上下文完整重建另属后续知识版本任务。
规范化后的成员/禁止依赖集合、路径及文本没有变化时不增加 revision；仅修改来源
标记也不增加。新增记录算实质变化。其他项目、浏览路线和 ViewState 不受影响。
createPlan 若传入 baselineSnapshotId，必须匹配当前快照，否则 409；MCP propose_plan
要求调用者显式给出该字段，防止 Agent 把基于旧查询的规划绑定到另一个新快照。
approvePlan/verifyPlan 在执行前刷新真实索引，approvePlan 不改变语义 revision；批准表保留历史。
verifyPlan 使用最近一个确有批准的历史
revision（更新后的未批准 draft 不能冒充已批准内容），新快照允许与批准基线不同。
createRoute 拒绝无效端点；读取路线的过期状态由其 snapshotId 对比当前快照。
call_chain 从第二步起，每一步 relationId 指向上一节点到当前节点的 resolved calls
关系并携带源码证据。walkthrough 不需要调用边；若提供 relationId，必须与该步骤节点相关。

## HTTP（统一 JSON；默认成功返回实体，无额外包裹）

所有请求在读取敏感数据、解析 body 或调用 service 前校验原始 Host/Origin。Host 仅接受
127.0.0.1、localhost 或 [::1] 及实际 listener 端口；Origin 若存在必须精确为该
Host 的 http origin。拒绝 foreign/null Origin、foreign Host，403
`UNTRUSTED_REQUEST`；不信任 forwarded headers，不使用 CORS 放行。
无 Origin 的本地 MCP/HTTP 可用。生产默认严格；dev launcher 显式给 API 设置
`CODEMAP_DEV_PROXY=1`，工厂 `developmentProxy:true` 额外允许 loopback:5173
及相同 origin，使保留 Host 的 Vite 代理可用。它不授予其他来源或远端部署能力。

错误响应固定为 `{code:string,message:string}`；请求 schema 校验失败额外带
`issues:[{path:(string|number)[],message:string}]`。非预期服务错误返回脱敏的
`{code:'INTERNAL_ERROR',message:'Internal server error.'}`，客户端显示具体可操作的
领域错误，但不能把内部异常堆栈作为产品错误说明。

| 方法与路径 | 参数/响应 |
| --- | --- |
| GET /api/health | `{status:'ok'}` |
| GET /api/projects | Project[] |
| POST /api/projects | `{path}` → 已索引 Project |
| GET /api/projects/:id/snapshot | CodeSnapshot |
| POST /api/projects/:id/refresh | CodeSnapshot |
| GET /api/projects/:id/summary | `{project,snapshotId,contentHash,counts,entrypoints,entrypointTotal,entrypointsTruncated,diagnostics,coverage,dataSource:'code'}` |
| GET /api/projects/:id/functions?q=&offset=&limit= | `{items:CodeNode[],total,offset,limit,snapshotId,dataSource:'code'}` |
| GET /api/projects/:id/functions/:nodeId?offset=&limit= | `{node,incoming:Relation[],outgoing:Relation[],relatedNodes?:CodeNode[],totalIncoming,totalOutgoing,truncated,offset,limit,snapshotId,dataSource:'code'}` |
| GET /api/projects/:id/files/:nodeId/context?offset=&limit= | `FileContextResult`：文件声明、跨文件 calls、imports、unknown 与分页总数 |
| POST /api/projects/:id/subgraph | `{nodeIds,depth?,budget?,relationTypes?}` → `{nodes,relations,truncated,snapshotId,dataSource:'code'}` |
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
函数上下文只分页 calls 关系，incoming/outgoing 分别按同一 offset/limit 截取并给出
各自总数；outgoing 保留 unresolved/external 关系及 reason，不能丢失不确定调用。
函数上下文的可选 `relatedNodes` 提供当前页调用端点，旧消费者可继续省略该字段。
文件上下文 `getFileContext(snapshot,nodeId,Pagination)` 返回 `node,members,incoming,outgoing,imports,unknown,relatedNodes`，
及 `totalMembers,totalIncoming,totalOutgoing,totalImports,totalUnknown,offset,limit,truncated,snapshotId,dataSource`。
各组按同一 offset/limit 独立分页（默认50、最大200）；incoming/outgoing 是跨文件已解析调用，
imports 保留双向原始导入证据，unknown 是本文件外部/未解析调用；relatedNodes 仅返回本页成员与关系端点。
`CodeNode.declarationKind` 为可选 `function|method|class` AST 元信息，旧快照继续可读；稳定 ID 保持原算法。
summary counts 固定为 `{files,folders,functions,relations,calls:{resolved,unresolved,external}}`；
entrypoints 为带 exported 事实的函数候选 CodeNode[]，最多50项，提供总数/截断提示，
不把无入边函数说成确认入口。TS/JS 依据源码 export；Python 当前 exported 字段
依据公开命名约定，summary 只取 parent 为 file 的顶层函数/class，不把公开命名的
局部嵌套定义当成模块 API，客户端应明确这是候选而非运行时确认。
functions 数含当前模型中的 class 容器。
subgraph relationTypes 默认 `['calls']`，允许 calls/imports/contains，按确定性顺序展开。
budget 限制返回节点数（包括可容纳的文件/目录上下文），返回关系数上限为 budget*3；
任一预算导致结果裁剪均设 truncated=true。未知/异项目节点拒绝，不能静默忽略。
无效输入 400，找不到 404，revision/基线冲突 409，Python 缺失给出可操作错误/诊断。
对每次预算裁剪明确 truncated；规划、路线不能引用另一个 project 的节点。

## T06 MCP 适配约定

实际工具和客户端示例见 `docs/mcp.md`。MCP 使用同一 HTTP 服务，不创建数据库；
工具成功结果是 text content 中的 JSON，领域失败为 `isError:true`，保留
`code/message/status` 和可用的 `issues`。单请求超时30秒，关闭 transport 会取消
尚未完成的 HTTP 请求。stdout 仅协议，诊断写 stderr。

- `list_projects` 发现已由网页/API 打开的项目。后续项目工具显式传 `projectId`；
  规划工具还传 `planId` 并检查归属，不从浏览器当前选择或 cwd 猜测。
- 项目/路线/分组/目录约束列表在适配层分页：`items/total/offset/limit/truncated`，
  默认50、最大200。现有 HTTP 内部仍返回数组，不能宣称后端游标或内存已分页。
- `propose_plan` 显式要求 `baselineSnapshotId` 和 `operations`。空操作保留创建的
  revision1，非空通常经第二个 HTTP 更新成为 revision2；两步不原子。
  更新失败返回实际错误和 `createdPlanId/createdRevision`，保留可找回的草稿。
- `get_approved_plan` 先检查归属，再真实刷新、读取当前 PlanDetail；历史批准不能
  代替当前 draft 的确认。`verify_implementation` 核对真实已批准的历史 revision。
- 新路线/分组固定 `source:'agent'`，分组提议不接受已有 id。读取路线增加 `stale`
  标识但不改写记录。`refresh_index` 返回摘要，不向 Agent 输出全仓图。
- 不提供批准工具，不写目标源码；原生客户端与平台验证结果必须单独记录。

## Captured tsconfig resolution (Task2)

- Internal `createConfigurationResolver(sources, configurations, captureDiagnostics=[])`
  returns `resolutionHost`, configuration diagnostics and
  `configuredAlias(sourcePath,specifier)`. `indexTypeScript` takes configuration
  captures as argument3 and scanner diagnostics as optional argument4; public
  IndexerPort/HTTP/MCP contracts are unchanged.
- Each TS/JS source selects its nearest captured or `CONFIGURATION_UNAVAILABLE:`
  `tsconfig.json`. Only TypeScript-parsed root-file membership (`files`,
  `include`, `exclude`, `allowJs`, including inherited declarations) applies that
  configuration. An excluded, invalid or opaque nearest config blocks ancestor
  fallback. All captured sources are still extracted. Named `tsconfig.app.json`
  is only an extends input; project references are diagnosed, never expanded.
- JSONC and ordered relative `.json` extends arrays use the installed TypeScript
  parser through public ts-morph APIs on an in-memory captured filesystem.
  Each selected seed validates the whole chain independently (seed1, max16;
  cycle, missing, rejected or unsupported parent invalidates the entire chain).
  Captured membership from another seed never overrides a rejection. Invalid
  parser options are diagnosed by TS error code without configuration contents.
- Module resolution applies only paths/baseUrl/module/moduleResolution/
  resolveJsonModule/customConditions, preserving inherited declaration locations.
  Configuration-specific caches and checker declaration identity select targets;
  only captured source implementations can produce resolved calls. A synthetic
  virtual repository directory keeps escaping paths outside the captured set.
  No compiler host reads target disk, packages, plugins or runtime code.
- Matching paths aliases with unavailable targets yield unresolved imports and
  calls, with evidence and a configuration-scoped boundary diagnostic. Bare
  imports without an applicable paths match remain external if unresolved;
  baseUrl can resolve captured modules without declaring an alias. Relative
  missing imports and calls without implementation bodies remain unresolved.
  Existing const initializer support and mutable-initializer unknowns remain.
- This does not implement workspace package/exports/imports, project-reference
  graphs, build-output-to-source mapping or dynamic imports. CommonJS uses the
  separate guarded subset below; no runtime execution/type-correctness or full
  build-environment equivalence is claimed. Python and source availability/
  exclusion contracts remain unchanged.


## Static CommonJS registry (Task1)

- `indexTypeScript` has an optional internal fifth `ModuleModeProvider` argument.
  Default mode is explicit `.cjs` CommonJS, `.mjs` ESM, all other paths unknown;
  source ESM syntax prevents Node-global inference. SourceIndexer now supplies
  captured package evidence through the Task2 provider below. The fifth argument
  remains internal; public ports are unchanged.
- The registry consumes only captured TypeScript ASTs, public checker symbols and
  existing implementation IDs. It never loads target code or dependencies.
  Literal `require` module symbols are consulted only after lexical/mode checks;
  callable type signatures cannot establish implementation identity.
- Supported exports are one unconditional top-level `exports.name` or
  `module.exports.name` assignment to an inline function/arrow, unique function
  declaration or const callable; one `module.exports` static object with literal
  properties/shorthand; or one callable module value, including canonical
  `exports = module.exports = callable`. Callable module values and properties
  named `default` have distinct identities. Existing declaration names,
  qualified names, IDs and source lines are preserved; verified implementations
  gain `exported: true` without renaming anonymous functions.
- Consumers support unshadowed literal require, const namespace/direct-callable/
  destructured bindings, literal property selection and direct require-property
  calls. Import relations preserve the real require path, line and expression.
  Missing relative/configured targets stay unresolved; missing bare dependencies
  retain external classification under existing configuration ownership rules.
- Repeated, compound, conditional, delete and other writes reject the affected
  known property. Unsupported known values reject only that property. Unknown
  computed writes, root replacement/mixed namespace identity, lexical shadowing
  and namespace escape reject the module. Captured consumer member writes and
  escapes invalidate shared export facts before any consumer is classified,
  independent of file traversal order. Visible callable rewrites/redeclarations
  cannot establish the original implementation.
- Single top-level `module.exports = require('./captured-relative-target')`
  forwarding (also static `module['exports']`) is supported only with unshadowed,
  unrewritten Node globals, valid captured CJS source/target modes and no other
  exports/root writes in the forwarding source. Directed chains are bounded to
  16 forwarding edges; 17 edges, cycles/self-cycles and any forwarding require
  edge in a captured require SCC stay unresolved. Validation uses only captured
  checker module declarations, never loader execution or name matching.
- Validated forwarders and their actual leaf form a private identity group.
  Before exposing entries or resolving calls, the registry unions all known
  property rejections and whole-namespace invalidations from the leaf, aliases
  and captured CJS/ESM consumers. Other stable properties survive known-property
  writes, including the empty-string property; callable module identity remains
  distinct from a property named `default`. Invalid/unsupported forwarding gets
  no namespace-escape exemption; unsupported imported roots cannot gain stable
  local overlay exports. Conservative rejection can hide otherwise safe runtime
  aliases, including a shorter chain used by a rejected over-budget forwarder.
  Calls retain actual leaf declaration IDs/names/locations; import evidence and
  private cycle flags retain their physical source/target identities. A
  forwarder's local `exports` stays detached from its replaced `module.exports`;
  calls through that local object cannot acquire the forwarded leaf identity.
  Existing unsupported const/destructured alias forms remain unknown.
- Mutable importer bindings, ambient/type-only/dynamic values, recursive aliases,
  conditional/repeated/chained/property/nonrelative forwarding, namespace-variable
  forwarding, package exports and unverified ESM re-export chains remain unresolved.
  Direct ESM imports of CJS exports use the same guards; rejected values cannot
  fall through to checker-only
  resolution. A real user function named `require` retains its ordinary direct
  callee identity but its return value supplies no Node namespace.
- Captured, lexically unshadowed literal require dependencies are checked for
  initialization cycles before accepting imported callable identities. Bindings
  on cycle edges (including self-requires, destructuring, callable defaults and
  direct/property selections) stay unresolved; import path/line evidence and
  independently stable export declaration IDs remain available. The iterative
  component check is bounded by captured modules and require edges, independent
  of source order, and preserves shared property-write/namespace-escape guards.
  It conservatively includes nested or conditional require calls and does not
  prove safe initialization order, even when an export precedes a cyclic require.
  Acyclic edges into/out of a component and ordinary local function recursion
  keep their existing guards; no loader execution or initialization-order proof
  is introduced.
- This is a conservative static subset, not runtime load/build compatibility or
  complete value-flow analysis. The v3 captured-input content hash and public
  data shapes are unchanged. For identical captured bytes/project identity, new
  verified facts change the existing facts fingerprint and snapshot ID while
  declaration IDs remain stable. Historical snapshots and approvals are unchanged.


## Captured package scopes (Task2)

- `scan.manifests: SourceFile[]` holds ordinary eligible `package.json` captures.
  `coverage.packageFiles?: string[]` lists their normalized repository-relative
  paths separately from source/configuration paths, nodes and source counts.
  Legacy omission remains readable and means unrecorded; `[]` means recorded zero.
  No database migration or historical snapshot/approval rewrite occurs.
- `createMetadataReader(root, allowedPaths)` extracts the existing confined reader:
  every path component is checked with lstat, realpath must match its allowed
  location, open uses NOFOLLOW, opened-handle type/budgets and inode/dev/location
  are checked, allocation/read is bounded to remaining budget plus one, and
  post-read overflow is rejected. Successful path bytes are reused across
  categories. Partial/failing reads never enter that shared cache.
- Configuration and package categories independently accept at most 262144 bytes
  per file, 4194304 total bytes and 512 files; reused bytes count fully toward
  each category. A category's rejection does not poison the other category.
  Existing configuration depth16, selected-chain rejection and
  `CONFIGURATION_UNAVAILABLE:` evidence remain unchanged.
- `capturePackages(allowedPaths, rejectedPaths, reader)` consumes scanner-owned
  package seeds, returning `{files, diagnostics}` in deterministic order. Fixed
  exclusions, Git ignores, root confinement and symlink rules apply. Enumerated
  rejected seeds use `PACKAGE_MANIFEST_UNAVAILABLE:` plus normalized filePath;
  their bytes are never read for diagnosis and do not become source availability.
  Strict JSON objects with absent type, `commonjs` or `module` are recognized.
  Invalid JSON/type bytes remain captured hash inputs with redacted diagnostics.
- `createPackageModeProvider(manifests, captureDiagnostics=[])` uses the nearest
  root-contained package scope. For `.js`, valid absent/commonjs type selects
  CommonJS, module selects ESM, and invalid/opaque/no captured scope selects
  unknown. A blocked nearest scope never falls back to an ancestor. The analyzer
  additionally rejects import/export syntax, import.meta and top-level await
  (including for-await); await within a function/method remains ordinary syntax.
  `.cjs`/`.mjs` explicitly select format independent of package availability;
  `.jsx` and TypeScript require remain unknown. Format never proves runtime load
  success. No ancestor-root reads, workspace/exports lookup or target execution.
- New captures use `codemap-index-inputs-v3` source/configuration/package framing.
  Package-only edits change contentHash while declaration IDs remain stable.
  Rejected-byte evidence enters snapshot facts/identity rather than captured-byte
  hashing. Existing snapshots and approvals remain immutable; their older hashes
  are not migrated. Task1 identity, stability and no-checker-fallback guards apply
  equally to newly eligible `.js` modules.
