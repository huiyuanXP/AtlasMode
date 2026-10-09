# Task 2 交接：UI-09 声明类型与本地图标

## 当前实现与接口

- `CodeNode.declarationKind?: "function" | "method" | "class"`，strict snapshot schema 同步接受可选字段。
- TypeScript/JavaScript 使用 AST 声明类型，覆盖函数、arrow、类、普通方法、constructor、accessor、类函数属性；Python class/function/直接类成员方法来自 AST scope，嵌套函数保持 function。
- 稳定 ID 继续使用原 Graph 参数。Python 方法用于 ID 的原 kind 仍为 function；新声明类型独立存入节点元数据。
- `nodeIdentity(node, locale = "zh")` 返回 `{ label, typeLabel, icon: string }`；icon 为实际 Nerd 字形。
- `NodeIdentity({ node, locale?: "zh" | "en", className?: string })` 自动导入 CSS，名称、类型文字始终可见；图标 `aria-hidden`，字体加载期间/不可用时采用通用 `◇`。
- function 展示 `name()`；method 优先展示 `qualifiedName()` 以保留所属类；class 展示 `class name`；folder 展示尾部 `/`；原始 CodeNode 的名称与引用 ID 保持原值。
- 旧快照明确 `class ...` 签名采用 class 回退；其他缺少声明元数据的 `kind=function` 节点保留原名与“声明 / Declaration”。规划 `add_function` 可由 projection 设置 `declarationKind: "function"`。

Task 3 接入 Canvas 和详情；已向主 Agent 发送精确接口。

## 文件范围

- `packages/core/src/model.ts`、`validation.ts`（主 Agent 明确同意补充 strict schema）。
- `packages/indexer/src/typescript.ts`、`python.ts`、`declarations.test.ts`、`packages/indexer/python/index.py`。
- `apps/web/src/features/graph/nodeIdentity.tsx`、`nodeIdentity.test.tsx`、`nodeIdentity.css`。
- `apps/web/public/fonts/`：1,144 字节 WOFF2、固定来源/可复现子集 README、三份完整上游许可证。

## 验证证据

- AST RED：`npx vitest run packages/indexer/src/declarations.test.ts`，2 项因缺失 declarationKind 按预期失败。
- UI RED：接口建立后同文件 3 项因 class/类型/目录名称派生尚未实现按预期失败；首次载入还记录过缺少新模块的 suite error，行为 RED 使用后续实际断言结果。
- GREEN：`npx vitest run packages/indexer/src/declarations.test.ts packages/indexer/src/index.test.ts apps/web/src/features/graph/nodeIdentity.test.tsx`，**59 项 / 3 文件通过**。
- 补充固定历史 class/method ID 字面量后：两个新增文件 **5 项通过**；TS/Python 同时覆盖旧快照 schema 与空行变化后稳定 ID。
- 相关七个 TS/TSX 文件 ESLint 退出 0；`npm run typecheck -w @codemap/indexer` 退出 0；core build 退出 0。全产品构建与整体验收由主 Agent 集中执行。
- fonttools 读取 WOFF2：六个预期 cmap，六个可用图形与 `.notdef`；README 复现步骤输出与产品文件逐字节一致。
- 本地 Chromium 字体解码尝试属于 setup failure：当前环境 `/usr/bin/chromium` 路径不存在；浏览器字体加载由统一验收使用实际浏览器路径覆盖。

## 来源、许可与限制

Nerd Fonts v3.4.0 固定 commit `fa7b859994228a9c8759f99c55a8d31ee92a1b5e`，
SymbolsNerdFont-Regular.ttf 最小子集使用六个 Font Awesome 字形。
Symbols Only MIT、Font Awesome 字体 SIL OFL 1.1 和上游综合授权完整保存。
派生字体家族改为 `AtlasMode Nerd Icons`，保留上游许可元数据。
固定 URL、字符映射、原文件/产物 SHA-256 与生成工具版本见字体目录 README。

fonttools 生成时对 `PfEd` 编辑器附加信息表报告丢弃提示，网页轮廓与字符映射已检查。
历史数据的未知声明通过明确类型文字表达；重新索引后获得 AST 类型。
当前实现补充既有索引器生成节点的元数据；索引器既有声明覆盖范围继续沿用。

## neat-freak 收尾

- 代码：changed-and-verified，定向行为/ID/schema/类型检查已有证据。
- 运行态：pending，字体真实 HTTP 加载与 Canvas 接入归统一浏览器验收。
- 文档：changed-and-verified，字体目录 README 是来源/许可/复现的权威入口；整体 state/Ticket/README 由主 Agent 更新。
- 规则：verified-current，遵守任务文件边界与相称验证；AGENTS.md 保留现有修改。
- 记忆：not-applicable。
- 工作区：本任务的下载字体、字体工具 venv 与查询/复现临时文件已清理；产品资产和交接证据保留。

额外门禁预算为零；定向测试、元数据验证与字体复现分别对应实际行为、稳定 ID 和可交付离线字体判据。
