# AtlasMode

用可编辑的代码关系图替代传统文字 Plan Mode。Agent 在实际修改代码之前，把规划叠加到现有项目图上；用户理解、调整并确认后，Agent 才实施。人通过图形理解项目，Agent 通过 MCP 查询同一份结构化模型。

> 当前仓库已有本地 UI、真实 TS/JS/Python 索引、SQLite、stdio MCP、中文/英文、主题、功能集、目录约束及撤销重做。首轮 T01–T08 与整体审查通过，四项 Important 与两项 Minor 修复均独立复审通过；本轮精确检查结果见 [环境与验证](docs/environment.md)。固定目标的阶段、修订和统计见 [外部验证记录](docs/superpowers/validation-targets.md)，不将旧运行计数当作当前结果。基线86e6b12的原生 Linux/Windows/macOS CI及Linux Chromium已通过（[run37148507859](https://github.com/huiyuanXP/AtlasMode/actions/runs/37148507859)）；该历史阶段的实际 Codex/Claude 客户端连接尚未验证；本轮 Codex Profile 真实接入见下方更新。以下规格保留后续目标，完整组编辑/折叠、知识迁移/备份、workspace package/exports、完整 CommonJS 值流和 references 图等仍有缺口，详见 [要求覆盖表](docs/superpowers/readme-coverage.md)。


本轮已完成 UI-05～UI-10 图检查交互，实际未批准规划和精确验证见 [验收报告](docs/superpowers/reviews/graph-inspection-2026-10-09/README.md)。
已有自动聚焦、动画依赖漏斗、可点击路径、双侧Chat和既有Codex Profile复用。
实际Mimo/API Profile已跑通原生模型→MCP→未批准规划，无需重新Device登录。
此前 Focus/Chat 集成基线636项测试/12项Chromium通过，后续漏斗可读性修正有独立相关验证；
当前精确结果见 [交付记录](docs/superpowers/reviews/focus-chat-2026-10-08/README.md)。

历史已审查的Task2 PARTIAL检查点与待办见 [交接记录](docs/superpowers/reviews/static-forwarding-task2/README.md)。
Task2的七包构建、类型检查、lint和541项/31文件测试通过，独立task/whole检查点评审已记录；
唯一集中修复后根lint/541项31文件及forwarding browser1通过，限定复审已批准；
完整Express入口仍FAIL，整票目标未完成。

本机使用 Node24.19.0/npm11.9.0；分析 Python 项目需 Python3.10+。从仓库根目录运行：

```bash
npm ci
npm run build
npm start
```

在本机浏览器打开 `http://127.0.0.1:4310`，点击「打开项目」并选择要分析的本地目录。

当前交互使用左侧探索 Chat、中央图与可点击路径、右侧规划概述和规划 Chat。
右侧固定「待你审查 · N」，打开「查看改动」阅读目的、变更与校验结果，逐项选择可聚焦对应节点/关系；「确认此规划」单独绑定当前版本与基线。
悬停卡片预览一跳关联，单击保持高亮并打开引用详情，关系行按真实调用证据联动画布。函数详情显示调用方/目标与未知调用，文件详情提供分页声明、跨文件调用和导入。
双击函数或文件进入「依赖者在上、当前对象居中、依赖在下」的动画漏斗；普通图与漏斗均可拖动。漏斗手动位移按项目和根节点隔离，「重新排列」恢复当前根的自动布局；普通布局独立保存。
角落小地图可展开、定位、缩放和返回选择，表示当前已加载范围；空间受限时暂收详情，收起地图后恢复同一选择。Esc 依次收起地图、关闭详情、退出漏斗。点击路径中的项目、文件夹、文件可切换范围。
类型标识来自 AST 声明信息，区分函数、方法、类、目录与文件；本地 Nerd 图标字体随网页分发，字体不可用时保留通用图标与类型文字。旧快照可继续读取，刷新索引后补齐声明类型。
源码通过「查看源码」展开，精确参数表单集中在「高级编辑」。直接函数搜索在 Agent 未连接时也可使用。

网页 Chat 复用本机 Codex/Claude CLI。Codex 支持既有账户认证或本机 Profile 的 Provider API 环境，不要求有 API 配置的用户再次 Device 登录。例如使用已经配置好的 `mimo` Profile：

```bash
CODEMAP_AGENT_PROVIDER=codex CODEMAP_CODEX_PROFILE=mimo npm start
```

具体配置见 [本机 Agent Chat](docs/agent-chat.md)，真实接入测试见 [Test](docs/test/README.md)：

```bash
npm run test:mcp
npm run test:agent -- codex mimo
```

网页独立配置直接 API Call 的适配器另列 [AG-05](docs/tickets/AG-05.md)。当前待办及认领状态见 [Tickets](docs/tickets/README.md)。
首次浏览与规划操作见 [第一份规划](docs/first-plan.md)。开发模式使用
`npm run dev`，网页端口5173。API 校验实际本地 Host 及同源 Origin；开发启动器显式允许本地5173代理，MCP 无 Origin 的本地请求仍可使用。Codex App/CLI 与 Claude Code 的 MCP 连接说明见
[docs/mcp.md](docs/mcp.md)；外部客户端配置使用 Node 直接启动编译入口。

已支持从捕获的 JSONC 配置应用 `paths`/`baseUrl`，包括受限的相对 `.json`
`extends`。每个源码由最近的 `tsconfig.json` 及其 `files`/`include`/`exclude`/
`allowJs` 范围决定归属；无效或排除的最近配置不会回退到祖先配置，也不猜测
`tsconfig.app.json` 或展开 references。只连接 checker 证明的已捕获源码声明；
配置别名目标不可用时保持 unresolved。仍是静态证据，不保证运行时绑定。

导航诊断区的“配置输入 / Configuration inputs”显示成功捕获的配置数量与仓库
相对路径，独立于源码文件数。历史快照未记录此字段时显示“未记录”，不报告为零。
`contentHash` 现为带版本的源码、配置和包输入摘要；仅配置或包内容改变也会使规划/路线
基线过期。升级后首次刷新可使旧基线过期，历史快照和批准保留，无需清理 SQLite。

已支持受保护的静态 CommonJS 子集：`.cjs`，以及最近捕获的有效 `package.json`
允许 CommonJS 且无 ESM 语法的 `.js`。稳定的顶层导出可作为入口，未遮蔽的字面量
`require` 与 `const` 绑定可连接真实实现；捕获的 require 环中初始化不确定的绑定、
覆盖、遮蔽、可变绑定和命名空间逃逸保持
未知。已实现单次顶层 `module.exports = require(相对字面量)` 的受保护转发，
最多16边，调用保留实际叶函数身份与物理导入证据；旧局部 `exports` 的对象不会
被自动当成转发后的叶模块。转发Task1已独立复审通过；Task2实际HTTP/MCP/SQLite
证明仅改转发目标使规划/路线过期且保留叶声明ID和批准历史，双语源码/复制位置已验。
唯一新的完整Express严格入口gate仍FAIL：实际createApplication未导出、不在34/34入口中；
捕获的test/exports.js嵌套原型写入使共享身份保守失效。旧泛用PASS/入口FAIL保留，
Task2独立审查已记录为PARTIAL，整体审查要求的唯一集中修复已验证，限定复审已批准，仍为PARTIAL检查点。动态 mixin、workspace
exports、一般值流和运行时加载兼容性不作保证。

诊断区新增“包配置 / Package manifests”，独立显示捕获数量与相对路径。
历史缺字段显示未记录，已记录空数组显示零；仅 `package.type` 改变也会使规划和
路线过期，源码声明 ID、历史快照与批准保留。包元数据不计入源码文件数。

## 1. 产品目标

用户应当能够：

- 随时查看已有项目的函数、调用关系、外部依赖，以及文件和目录归属。
- 在代码修改前，看见 Agent 准备新增、修改、删除的函数和依赖关系。
- 拖动规划中的连线，使新功能复用自己指定的已有函数或抽象。
- 调整计划中的文件位置，理解新代码为什么放在这个目录。
- 圈选多个函数创建功能集，添加说明、要求和复用指引；Agent 也能提出功能集。
- 在实现后核对真实代码与已确认规划，发现遗漏、绕过既有抽象、引用断开等问题。

核心流程：读取现有代码 → Agent 提交图上规划 → 用户编辑和确认 → Agent 实现 → 重新索引并核对。

这里的“规划”必须发生在目标代码修改之前。浏览项目不需要先创建规划。规划不是一张独立、很快过时的架构图，而是基于一个明确代码快照的一组待实现变更。

## 2. 首版边界

### 必须实现

1. 单用户、单服务进程，网页输入目录管理多个本机项目，各项目数据隔离。
2. 首先支持 TypeScript / JavaScript 项目，包含 TSX / JSX，以及 Python 项目。
3. 函数和方法是主要原子节点；不做逐行代码节点。
4. 从真实代码提取函数、文件、目录、导入和可解析的调用关系。
5. React Flow 展示函数图、文件/目录框、功能集和注释。
6. 独立的规划变更层，允许新增节点、改接连线、调整目标文件和编辑说明。
7. 规划版本、用户确认、过期检测、实现后差异核对。
8. MCP 让外部 coding Agent 查询图、提出规划和读取已确认版本。
9. 数据持久化，重启后保留注释、功能集、布局和规划历史。

### 后续再做

- TS/JS/Python 之外的语言解析、运行时追踪、跨仓库关系、多人协作。
- 自由手绘、复杂富文本、完整 IDE、行级代码编辑器。
- 内置多模型聊天、账号管理、云端托管和自动部署平台。
- 全自动重复实现识别。首版只能报告结构证据和候选，不能把相似函数直接判定为重复。
- 通用代码图到代码的确定性编译器。Agent 负责实现，图定义意图和约束。

## 3. 用户操作语义

| 操作 | 必须产生的结果 |
| --- | --- |
| 移动卡片的画布位置 | 只改变布局，不移动源文件 |
| 将规划函数移动到文件框 | 明确产生目标文件变更，并展示路径预览 |
| 将规划函数移到目录框 | 要求补全目标文件名；不能只保存目录而遗漏文件 |
| 改接规划箭头 | 更新带类型的关系变更，重新执行校验 |
| 编辑已有事实箭头 | 转成规划中的删除/新增关系，不覆盖当前事实 |
| 圈选函数并分组 | 创建功能集及成员引用，不自动生成 wrapper 或搬动代码 |
| 将注释连到节点 | 创建说明/约束关系，不创建代码调用 |
| 用户确认规划 | 固定规划版本、内容摘要和基线快照 |
| 确认后再次编辑语义内容 | 创建新版本并使原确认失效 |
| 实现后刷新代码图 | 保存新事实快照，生成与已确认规划的核对结果 |

拖拽跨文件归属和普通布局拖动需要不同的交互状态，避免无意移动代码。颜色必须同时配文字或图标，不能只靠颜色区分状态。

## 4. 函数组合方式

| 类型 | 定义 | 连接到它的语义 |
| --- | --- | --- |
| 功能集 `capability` | 一组有关联的函数，可以跨文件和目录 | 请求复用集合中的能力；规划需进一步明确选用哪些函数 |
| 组合流程 `sequence` | 函数集合及明确的顺序、分支或数据传递约定 | 复用这套组合逻辑，不能把成员列表当作执行顺序 |
| 实际封装 `wrapper` | 源码里已有或计划新增的统一入口函数 | 通过入口函数调用；成员关系用于解释内部构造 |

三者共享组合节点的展示组件，但保留不同的数据类型。第一阶段实现功能集；之后增加组合流程与 wrapper 的高级操作。

- 函数的物理归属由文件决定；功能集成员关系是多对多。
- 一个函数可以属于多个功能集，功能集也可以跨目录。
- 不能用 React Flow 的单一父节点字段存储全部业务归属；画布父节点只是当前视图的投影。
- 折叠组合节点时保留对外边的具体函数端点，可在详情中展开查看。
- Agent 提出的功能集标记来源为 Agent，用户可以修改或确认。
- “必须复用”属于可校验要求；“建议参考”属于软性指引，两者应区分。

## 5. 数据模型与真实性

数据分为四类，不能混存成一份 React Flow JSON：

| 数据 | 内容 | 权威来源 |
| --- | --- | --- |
| `CodeSnapshot` | 函数、文件、目录、外部包及已解析关系 | 代码解析结果 |
| `Knowledge` | 功能集、说明、目录约定、设计决定 | 用户或 Agent 的持久化记录，标记来源 |
| `PlanRevision` | 基于某一快照的节点/关系/归属变更 | 版本化规划 |
| `ViewState` | 节点坐标、折叠状态、缩放、筛选 | 图形界面 |

### 主要实体

| 实体 | 关键字段 |
| --- | --- |
| Function | ID、名称、限定名、文件 ID、签名、源码范围、导出状态、符号类别 |
| File / Folder | ID、仓库相对路径、父目录 ID |
| ExternalPackage | 包名、可获得时记录版本和调用符号 |
| Relation | 起点、终点、类型、来源、解析状态、证据位置 |
| FunctionGroup | ID、名称、类型、成员 ID、入口函数、说明、创建来源 |
| Annotation | ID、目标 ID、文本、来源、是否为约束 |
| FolderPolicy | 路径范围、职责、允许/禁止的依赖、例外及理由 |
| PlanRevision | ID、revision、基线快照 ID、基线工作树摘要、变更列表、校验结果 |
| Approval | plan ID、revision、语义内容摘要、确认人、确认时间 |
| VerificationReport | 已满足、未满足、无法判定的项目，以及源码/测试证据 |

### 关系类型

- 代码事实：`calls`、`imports`、`contains`。
- 知识组织：`member_of`、`documents`。
- 规划要求：`must_reuse`、`must_call`、`must_reside_in`、`must_not_depend_on`。
- 数据流、执行顺序只在有明确证据或规划定义时加入，不能从普通连线推断。

### 索引要求

- 使用解析器和 TypeScript 类型/符号信息提取结构，不让 LLM 从零遍历仓库猜调用图。
- 解析函数声明、命名箭头函数、函数表达式、类方法；匿名回调使用所属函数和结构路径标识。
- 支持跨文件 import、别名、re-export；无法解析的动态调用保存为 `unresolved`，展示原因。
- Tree-sitter、ts-morph 等解析工具不是完整运行时真相。静态图不等同于真实执行轨迹。
- 行号用于跳转和证据，不作为唯一身份；插入空行不能导致全部节点身份变化。
- 首版以仓库 ID、相对路径、限定符号名及声明类别生成稳定标识，并保存迁移映射。重命名和跨文件移动仅提出匹配候选，低置信度需要确认。
- 为失去绑定的注释保留待重新关联状态，不能在重新索引时静默删除。
- 快照记录 Git revision（若存在）和纳入索引文件的内容摘要，以捕捉未提交修改。
- 忽略 `.git`、`node_modules`、构建产物、缓存及显式排除文件；记录扫描范围和被排除项。
- 没有入边不等于死代码：外部入口、框架注册和动态调用应提示未知，不能直接判错。

## 6. 规划确认与执行边界

建议状态：`draft` → `validated` → `approved` → `implementing` → `verifying` → `completed`；另有 `stale`、`needs_revision`、`cancelled`。

1. Agent 提交规划时必须指定基线快照，所有新增节点使用规划临时 ID。
2. 校验 ID、端点、关系类型、接口兼容性、文件归属和目录约定。调用图允许递归，不能一律禁止环。
3. 接口兼容性只在信息充分时自动判断；否则标记需要适配或无法判定。
4. 用户确认的是具体 revision 与语义内容摘要。布局改变不撤销确认；职责、依赖、成员、目标路径、约束改变会撤销确认。
5. Agent 开始实现前读取已确认规划，并核对目标工作树是否仍与基线一致；变化后需刷新和重新核对。
6. 实现期间发现需要改变已确认设计时，提出新 revision，不能自行替换确认内容。
7. 实现完成后重新索引，将规划临时 ID 映射到真实符号，并报告偏差。结构核对通过不代表功能行为正确，还需相应测试。

首版通过 MCP 协议和 Agent 工作指令约束执行时机。拥有独立 shell/文件写入权限的外部 Agent 不能仅靠这个界面被强制阻止；不要宣称已实现系统级写入隔离。未来可接入受控执行器，在应用补丁前验证确认版本。

## 7. 技术选择和依赖

采用 TypeScript、npm workspaces 和一个轻量 monorepo。初始化时选择经过实际安装和构建验证的稳定版本，提交 `package-lock.json`，不要把未经验证的版本范围写成已支持版本。

默认使用 Node.js 24 LTS；首次构建检查依赖的 engines 和原生扩展兼容性，记录最终使用的精确版本到 `.node-version` 和 `package.json`。使用 npm，不同时维护 pnpm/yarn 锁文件。

### 必需依赖：按阶段安装到所属 workspace

| 位置 | 库 | 用途 | 阶段 |
| --- | --- | --- | --- |
| `apps/web` | `react`、`react-dom` | 应用界面 | P0 |
| `apps/web` | `@xyflow/react` | 节点、连线、缩放和分组交互 | P0 |
| `apps/web` | `zustand` | 选中状态和未提交的界面状态 | P0 |
| `apps/web` dev | `vite`、`@vitejs/plugin-react`、`@types/react`、`@types/react-dom` | 开发和构建 | P0 |
| `apps/server` | `fastify` | 本地 HTTP API，作为业务操作入口 | P0 |
| `packages/core` | `zod` | 对图、规划和边界输入做 schema 校验 | P0 |
| `packages/indexer` | `typescript`、`ts-morph` | 解析 TS/JS、解析符号引用 | P1 |
| `packages/indexer` | `fast-glob`、`ignore` | 扫描和排除文件 | P1 |
| `packages/storage` | `better-sqlite3` | SQLite 持久化和事务 | P1 |
| `packages/storage` dev | `@types/better-sqlite3` | 数据库类型定义 | P1 |
| `apps/mcp` | 官方 MCP TypeScript SDK 的稳定 server 包、其要求的 schema 依赖 | stdio MCP 入口 | P3 |
| root dev | `typescript`、`tsx`、`@types/node`、`concurrently` | 类型检查、运行服务、启动多进程 | P0 |
| root dev | `vitest`、`eslint`、`typescript-eslint`、`prettier` | 测试与静态检查 | P0 |
| root dev | `@playwright/test` | 验证图编辑和确认闭环 | P2 |

MCP SDK 正在演进，初始化 P3 时读取官方文档再确定包名与版本。如果选用稳定 v1，通常使用 `@modelcontextprotocol/sdk`；不要混用不同 major 的示例、导入路径和 schema 依赖。把验证过的版本锁定，并记录到环境说明。

### 按需要再安装

| 库/工具 | 引入条件 |
| --- | --- |
| `elkjs` | P2 自动布局需要时；保留用户手动布局，不每次刷新都重排 |
| `chokidar` | P4 增量索引/文件监听时 |
| `dependency-cruiser` | P4 对本项目和目标 JS/TS 项目自动检查模块边界时 |
| GitNexus adapter | 需要多语言/更广泛图查询，并验证覆盖、版本和许可证之后 |
| Monaco、tldraw、向量数据库、Neo4j | 首版不安装；先证明需要，不能为潜在功能提前增加复杂度 |

首版不需要内置模型 API key。规划由已有 coding Agent 通过 MCP 提交，本项目承担索引、图形编辑、确认和核对。

## 8. File structure：代码放在哪里

下面是目标结构。只在对应阶段创建有实际内容的目录，不生成大量空壳。每个 workspace 有自己的 `package.json`、`tsconfig.json` 和唯一公共入口；内部模块不得被别的 workspace 深层导入。

| 路径 | 放什么 | 不放什么 |
| --- | --- | --- |
| `README.md` | 产品目标、启动方式、路线图、整体目录职责 | 每次运行的长日志 |
| `AGENTS.md` | 从本文提炼的短执行约束、检查命令、目录导航 | 再复制一份完整产品规格 |
| `package.json` | workspace 列表、统一检查和开发脚本 | 应用业务逻辑 |
| `package-lock.json` | 全仓统一依赖锁 | 多种包管理器锁文件 |
| `.node-version` | 已验证的 Node 精确版本 | 凭据 |
| `tsconfig.base.json` | 共享 TS 编译约定 | 应用专属选项 |
| `eslint.config.mjs` | 静态检查和导入边界 | 产品规则的另一份实现 |
| `.gitignore` | 依赖、构建、SQLite、缓存和 secrets 的排除 | 隐藏应提交的设计文件 |
| `apps/web/src/app/` | 应用入口、页面布局、依赖装配 | 代码解析、数据库访问 |
| `apps/web/src/features/graph/` | 画布、函数卡片、关系边、折叠和筛选 | 持久化业务规则 |
| `apps/web/src/features/planning/` | 规划编辑、变更清单、确认面板 | 独立于后端的确认状态机 |
| `apps/web/src/features/groups/` | 圈选组合、成员编辑和组详情 | 直接搬动源码 |
| `apps/web/src/features/structure/` | 文件/目录框、归属操作、目录约定面板 | 直接执行文件写入 |
| `apps/web/src/features/annotations/` | 注释编辑和约束说明 | 解析器推断逻辑 |
| `apps/web/src/features/verification/` | 实现后差异与证据展示 | 伪造已满足结果 |
| `apps/web/src/components/` | 被多个 feature 实际复用的纯 UI 组件 | 单个 feature 的业务组件 |
| `apps/web/src/api/` | HTTP client、请求状态、传输转换 | 领域模型的重复定义 |
| `apps/web/src/styles/` | 样式变量、基础样式 | 业务状态判断 |
| `apps/server/src/` | HTTP 入口、路由、错误转换、服务装配 | 图算法、SQL、TS AST 遍历 |
| `apps/mcp/src/` | stdio MCP server、工具注册、HTTP client | 独立数据库、另一套规划逻辑 |
| `packages/core/src/graph/` | 图 schema、关系语义、引用校验 | React Flow 专属字段、I/O |
| `packages/core/src/planning/` | 变更操作、revision 规则、纯状态转换 | HTTP、SQLite、进程执行 |
| `packages/core/src/groups/` | 功能集、流程、wrapper 模型 | 画布组件 |
| `packages/core/src/policies/` | 目录和复用约束模型、纯规则判断 | 自行扫描文件 |
| `packages/core/src/diff/` | 快照/规划差异和核对数据结构 | LLM 自动裁决 |
| `packages/core/src/ports/` | 存储、索引等抽象接口 | 具体数据库或解析器实现 |
| `packages/indexer/src/` | 扫描、TS/JS 解析、符号解析、稳定 ID、索引证据 | 图布局、规划确认、SQL |
| `packages/storage/src/` | 数据库连接、迁移执行、repository 实现、事务 | UI、代码解析、HTTP |
| `packages/storage/migrations/` | 编号 SQL migration | 启动时无记录地改变数据库结构 |
| `packages/service/src/` | 索引、规划、确认、分组、核对的用例编排 | 具体 SQL、React、MCP 传输代码 |
| `fixtures/` | 小型可解析示例仓库和预期关系 | 用户的完整真实仓库、敏感文件 |
| `tests/integration/` | 跨包索引、存储、API/MCP 一致性测试 | 纯函数的重复单元测试 |
| `tests/e2e/` | 浏览器操作与确认闭环 | 只断言截图文件存在的伪验证 |
| `scripts/` | 环境检查、demo 启动等薄入口 | 第二套业务实现 |
| `docs/architecture.md` | 数据流、包边界、实体设计，实施时建立 | 过时且无人维护的功能承诺 |
| `docs/environment.md` | 验证过的安装、启动、版本与云端限制 | 密钥或一次性令牌 |
| `docs/decisions/` | 重要技术决定及理由，每项独立记录 | 为每个小改动创建冗长文档 |
| `.codemap/structure.json` | 本项目目录职责与可检查依赖规则，提交 Git | 解析生成的索引缓存 |
| `.codemap/knowledge.json` | 用户维护的注释与功能集的可迁移导出 | 带 secrets 的源码副本 |
| `.codemap/cache/` | SQLite、生成索引和可重建缓存，忽略 Git | 唯一一份未导出的用户知识 |
| `artifacts/` | 测试截图、运行报告，默认忽略 Git | 源代码 |

### 包名与允许依赖

| 包 | 包名 | 可直接依赖的内部包 |
| --- | --- | --- |
| core | `@codemap/core` | 无 |
| indexer | `@codemap/indexer` | core |
| storage | `@codemap/storage` | core |
| service | `@codemap/service` | core；通过注入接口使用 indexer/storage |
| server | `@codemap/server` | core、service、indexer、storage，负责装配 |
| mcp | `@codemap/mcp` | core；通过 HTTP 使用 server |
| web | `@codemap/web` | core；通过 HTTP 使用 server |

`service` 不直接导入 indexer/storage 实现；接口定义在 core 的 ports 中，server 注入实现。MCP 与网页都经过同一个 service 层，不能分别实现确认规则。

### 文件放置判断

1. 先按职责找到上表对应目录，再创建文件。
2. 仅服务于一个 UI feature 的文件放该 feature 内；实际跨 feature 使用后才移到共享 components。
3. 模型和纯规则放 core；访问代码放 indexer；访问数据库放 storage；跨步骤流程放 service。
4. 单元测试放被测文件旁，使用 `*.test.ts`；跨包和浏览器测试才放根 tests。
5. 不新建没有明确职责的 `utils/`、`misc/`、`common/` 来堆业务逻辑。
6. 不因创建图形功能集而移动源文件；必须有明确的文件归属变更。
7. 新增目录或改变职责时更新 `.codemap/structure.json`；改变重要边界时记录到 docs/decisions。
8. 文件长度是拆分信号，职责混杂才是主要判断。不要为追求行数把紧密相关逻辑拆成大量碎片。

## 9. 持久化与目录约定

- 首版 SQLite 存储事实快照、规划 revision、审批、知识记录和视图状态。
- server 是业务写入入口；MCP 调用 server，不单独维护一份数据库。
- 规划更新使用 `expectedRevision` 乐观并发控制，版本冲突应返回明确错误。
- 审批与其对应 revision/hash 在同一事务中保存。
- `.codemap/structure.json` 是可提交的目录约定来源；UI 修改规则时通过 server 校验后原子写回，并保存审计信息。
- `.codemap/knowledge.json` 用于持久化知识的导出/导入。导出带 schemaVersion，导入必须预览冲突，不能静默覆盖更新的数据。
- SQLite 备份/知识导出应有明确入口；不要把删除缓存等同于允许删除注释和审批历史。
- 源码变动时重建事实层，知识层单独关联；重建索引不清空用户工作。

目录约定示例（未来初始化时创建，不要求用户现在手写）：

```json
{
  "schemaVersion": 1,
  "folders": [
    {
      "path": "packages/core/src",
      "purpose": "图模型、规划模型、纯业务规则与抽象接口",
      "allowed": ["纯 TypeScript 逻辑", "schema", "接口"],
      "forbidden": ["数据库访问", "HTTP", "React", "文件系统访问"]
    }
  ],
  "dependencyRules": [
    {
      "from": "apps/web/**",
      "mustNotImport": ["@codemap/storage", "@codemap/indexer"],
      "reason": "浏览器界面通过服务接口取得代码图"
    }
  ]
}
```

自然语言职责匹配由 Agent 给出带理由的建议；显式路径/导入约束由程序检查。无法自动判断的要求标记为待人工判断，不伪装成已验证。

## 10. MCP 设计

首版使用 stdio，外部 Agent 启动 MCP 进程；它连接同一环境内正在运行的 HTTP server。初始化时让 SDK 决定实际传输配置，记录可工作的示例。

| 工具 | 用途 |
| --- | --- |
| `get_project_summary` | 仓库、快照、目录职责和索引覆盖摘要 |
| `search_functions` | 按名称/路径查询函数，支持分页 |
| `get_function_context` | 函数签名、调用方、被调用方、位置与未知关系 |
| `get_subgraph` | 按节点、关系类型、深度和预算读取局部图 |
| `get_groups` | 查询功能集、wrapper 入口和复用说明 |
| `get_folder_policies` | 读取目录职责和约束 |
| `propose_plan` | 提交带基线和理由的 draft |
| `update_plan` | 基于 expectedRevision 修改 draft，不能静默覆盖 |
| `validate_plan` | 返回错误、警告及无法验证项 |
| `get_approved_plan` | 读取用户实际确认的版本和当前有效性 |
| `propose_group` | 提出功能集或组合变更，标明 Agent 来源 |
| `refresh_index` | 重新索引授权目标仓库 |
| `verify_implementation` | 比较实际结果与确认规划，输出证据 |

MCP 不提供“冒充用户确认”的工具，不接受客户端伪造的 `approved=true`。用户通过 UI 确认；server 负责保存可信确认记录。首版这是交互边界，不应宣称能抵御同机拥有完整文件访问权限的恶意进程。

所有图查询必须有分页或节点预算，默认读取局部图。结果带 snapshotId、数据来源和 unresolved 项；不把整个仓库图一次性塞进 Agent 上下文。

## 11. 分阶段实施计划与验收

### P0：初始化可运行骨架

- 建立 npm workspaces、TS 配置、最小 web/server/core。
- 写短 AGENTS.md，建立目录职责配置。
- React Flow 展示明确标为 demo 的函数、连线和文件框。
- server 提供健康检查；实现统一 dev/build/typecheck/test/lint 命令。

验收：干净安装后前后端可启动；浏览器能看见图；构建和类型检查通过。此时不能宣称完成真实仓库索引。

### P1：真实索引、持久化与现有项目浏览

- 实现 TS/JS 解析适配器、稳定符号标识和 unresolved 记录。
- 增加 SQLite、migration、知识与视图保存。
- 以 fixtures 中跨文件调用项目验证，再索引本仓库。
- 支持搜索函数、展开调用关系、查看代码位置和外部依赖。

验收：函数/调用关系来自真实源码；插入空行不丢注释；重启后数据存在；动态调用被标为未知。

### P2：图上规划与用户确认

- 实现 draft 变更覆盖层，与事实层有清晰视觉区分。
- 实现新增规划函数、改接箭头、目标文件调整、注释、撤销/重做。
- 实现 revision、校验、确认和过期检测。
- 用户操作只改变规划，不在确认前修改目标代码。

验收：用户把新函数的调用目标从 A 改成 B 后，确认内容准确保存 B；语义修改撤销旧确认；基线变化阻止使用过期规划；纯布局调整不撤销确认。

### P3：MCP 与 Agent 闭环

- 实现上述最小查询、规划提交、确认读取和实现核对工具。
- Agent 通过 MCP 提交规划；UI 展示并编辑同一份数据。
- 用户确认后，外部 Agent 根据确认结果实施，再触发索引核对。
- 增加规划临时节点与实际符号的绑定。

验收：完成一条真实端到端场景，证明 UI 与 MCP 读取同一个版本；故意绕过确认的调用目标时，核对报告能指出偏差。

### P4：功能集、目录约束和持续维护

- 圈选创建功能集、组注释、折叠、跨目录成员和复用约束。
- 增加实际 wrapper 入口和组合流程定义。
- 实现目录约定编辑和依赖边界检查，规划阶段给出放置理由。
- 实现索引差异：调用方减少、引用消失、已有抽象被绕过。
- 根据真实规模再增加增量索引与自动布局。

验收：同一函数可以属于两个功能集；跨目录功能集不改变真实文件归属；错误目录/禁止依赖能在规划阶段提示；重索引不丢功能集和注释。

### P5：按证据扩展

再评估 GitNexus、多语言、运行时证据、相似能力检索和远程多用户。每项先说明现有实现解决不了的具体问题，避免重新造画布、解析器和图数据库。

## 12. 核心验收场景

准备一个示例仓库：已有 `requestWithRetry()`，新需求是增加 `fetchNotes()`。

1. Agent 提交 `fetchNotes()` 和一个新请求辅助函数的规划。
2. 用户在图上把调用箭头改接到已有的 `requestWithRetry()`。
3. 用户删除不需要的新辅助函数，将新功能放进合适的 service 文件框，并添加目录说明。
4. 用户确认；Agent 从 MCP 读取最终版本，随后实现。
5. 刷新索引，确认调用关系、目标文件与规划一致。
6. 再故意让实现直接调用底层 HTTP SDK，验证报告指出绕过既有抽象。
7. 重启应用，验证功能集、目录说明和确认历史仍在。

重点测试真实风险：跨文件解析、符号身份、并发 revision、审批失效、目录归属、未知关系和实际差异。不要编写仅重复实现步骤的形式化测试。

## 13. 给 Codex Cloud 的首次构建任务

把此 README 放入新 GitHub 仓库根目录并提交，再把该仓库接入云端环境。首次任务可以直接使用下面这段：

> 阅读根目录 README.md，把它作为 Code Map Plan Mode 的产品规格与代码归属约束。当前可能只有 README，请从 P0 开始初始化 TypeScript/npm-workspaces 项目，创建必要配置、短 AGENTS.md 和目录约定，安装经过验证的稳定依赖并提交唯一 package-lock.json。完成可启动的 React Flow demo、server 健康检查，以及 dev/build/typecheck/test/lint 脚本。然后推进 P1 的最小真实 TS/JS 函数索引、跨文件调用和 SQLite 持久化。不得把 mock 数据描述为真实解析；无法静态解析的调用标记 unknown/unresolved。保持 core、indexer、storage、service 与 UI 的边界，不一次性铺满空模块。运行构建、类型检查与相关测试，实际启动服务并验证页面。把已完成和未完成项、验证命令、环境版本与限制写到 docs/environment.md，并给出下一阶段可直接接续的任务。不要自动部署公开服务，不要提交密钥、数据库或目标仓库副本。

这是开发本工具的启动授权。产品运行时的“用户确认后才能修改目标仓库”机制仍须按本文实现，两者不要混淆。

## 14. 环境安装与运行约定

workspace manifests、根锁文件和运行脚本已经生成。日常安装使用 `npm ci`；
以下首次初始化步骤保留作为架构依据，不需要重复生成项目。

首次初始化：

1. 检查 Node/npm、Git、目标仓库路径。
2. 生成各 workspace 的 package.json、TS 配置和根脚本。
3. 按阶段安装上表依赖；workspace 内依赖使用 npm 支持的本地 workspace 版本关联，禁止引用源文件相对路径绕过包边界。
4. 执行首次 `npm install` 生成统一锁文件。
5. SQLite 原生扩展优先使用匹配的预构建产物；若必须编译且环境允许，再安装 Python 3、make、C++ 工具链。记录失败原因，不擅自更换持久化设计。
6. 配置开发代理：web 默认 5173，API 默认 4310；允许通过环境变量调整。
7. 完成环境验证后提交配置和锁文件。

脚本生成后的预期使用方式：

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build
npm test
npm run smoke
```

根 `dev` 同时启动 web/server；根检查和构建脚本必须按内部依赖顺序执行，不可依赖偶然的 workspace 排序。P3 加入根 `mcp` 脚本，启动 stdio 适配器。

浏览器测试阶段安装：

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

若缺少系统依赖，按当前环境权限使用 Playwright 官方安装方式；不能安装时明确报告 E2E 未执行，不把它算作通过。

可选配置项：`CODEMAP_WORKSPACE_ROOT`、`CODEMAP_DATA_DIR`、`CODEMAP_PORT`、`CODEMAP_API_URL`、`CODEMAP_PYTHON`。默认目标可由环境配置指定，也可在网页输入路径切换；所有源码操作按所选项目根目录校验归属，拒绝路径穿越和越界符号链接。

本地服务默认绑定 loopback。云端预览若需要不同监听地址，使用环境明确提供的私有预览机制；不要为演示无意公开拥有仓库访问能力的 API。MCP server 的日志写 stderr，stdout 只输出协议消息。

## 15. 参考项目与官方资料

以下用于复用能力和查阅 API，不表示必须把全部项目作为依赖安装：

- React Flow：https://reactflow.dev/learn — 画布与可编辑节点；使用 `@xyflow/react`。
- ts-morph：https://ts-morph.com/ — TS/JS 符号和 AST 操作；首版仅做读取与索引。
- MCP TypeScript SDK：https://github.com/modelcontextprotocol/typescript-sdk — 根据选定稳定版本实现 MCP。
- Vite：https://vite.dev/guide/ — 前端开发与构建。
- GitNexus：https://github.com/abhigyanpatwari/GitNexus — 代码关系索引与 Agent 查询参考，未来通过 adapter 评估接入。
- dependency-cruiser：https://github.com/sverweij/dependency-cruiser — JS/TS 模块依赖与架构约束。
- tldraw：https://tldraw.dev/ — 画布交互参考；首版无需与 React Flow 同时引入。
- 项目动机：https://www.aymannadeem.com/artificial/intelligence,/developer/tools/2026/09/24/plan-mode-is-dead.html

本项目自己的明确选择：保留实现前用户理解与确认的步骤，用已有代码图上的可编辑规划替代长篇文字计划，并让图在后续开发中持续保持可用。

当前代码检查点 `0192730` 的 [GitHub CI](https://github.com/huiyuanXP/AtlasMode/actions/runs/37150560646)
已通过原生 Linux、Windows、macOS 和 Chromium 四项检查，阶段交付在 `work` 分支。
