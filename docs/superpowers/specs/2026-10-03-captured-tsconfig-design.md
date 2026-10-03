# 受限 tsconfig 路径解析设计

状态：首轮 T08 验收期间准备；通过首轮独立验收和整体审查后实施。
日期：2026-10-03 UTC。属于 README 的模块解析缺口，不改变用户问卷范围。

## 目标与选择

用户需要从真实暴露接口逐层浏览 TS/JS 项目，并用同一事实图规划修改。
当前解析相对 import、alias 和 re-export，但没有读取 tsconfig paths/baseUrl。
本轮让配置明确映射的调用连接到捕获源码，并使配置变化撤销旧基线的新鲜度。
支持仍限于静态证据；不能因此宣称复现了目标项目的构建或运行环境。

三个方向已对照当前实现评估：

1. 推荐：一次捕获配置字节，在受限内存文件系统中使用 TypeScript 解析。
   保留现有扫描边界和 checker 声明身份，增加按来源文件选择配置的解析 host。
2. 直接让编译器读取目标磁盘项目：实现方便，但读取范围和输入摘要难以保持一致。
3. 字符串替换 import 后猜文件：较快，但错误目标会被当成代码事实。

采用第一项。workspace package exports、构建产物到源码映射、CommonJS、项目
references 图、package imports 和其他语言各自另立 Ticket。本轮不安装新依赖。

## 输入捕获与预算

- 源码捕获、默认排除、嵌套 .gitignore 和拒绝符号链接规则继续生效。
- 配置种子为扫描范围内 basename 匹配 `tsconfig*.json` 的普通文件；它们不变成
  CodeNode，也不加入源码 `coverage.files`。
- 支持 JSONC。相对 `extends` 可递归引入种子以外的 `.json` 配置；先验证文件在
  初次扫描的允许路径集合中，拒绝越界、符号链接、已排除或 gitignored 文件。
  不为依赖包形式的 extends 访问 node_modules 或网络。
- 配置单文件最多 262144 bytes、总捕获最多 4194304 bytes、最多 512 个文件、
  extends 最深 16 层。种子和后继处理顺序确定，重复路径只捕获一次。
- 在读取前使用实际打开的 handle 的 stat 检查预算，读取后再检查长度；超限、
  循环、缺失、无效 JSONC、越界或不支持的 extends 都生成带配置路径的诊断。
  拒绝输入不部分应用该配置的 paths/baseUrl，也不静默采用更远的父配置。
- 源码和配置都只以捕获字节供解析和摘要使用；TypeScript host 不访问真实磁盘。
  不执行配置、脚本、插件或目标模块。不在诊断中回显配置原文。

## 配置归属及解析语义

对每个 TS/JS 来源文件，沿目录向上找最近的 `tsconfig.json`。这个规则是工具的
目录归属约定，不宣称等同于编辑器自动项目发现。单独的 tsconfig.app.json 等
只可作为 extends 输入，不根据名字推测适用范围。

最近配置的 TypeScript 解析结果必须包含该来源文件，才为它应用 paths/baseUrl。
使用捕获源码列表作为配置 parser 的 readDirectory 输入，不让 include 加入额外
磁盘文件。配置的 files/include/exclude/allowJs 参与归属判定；扫描仍索引范围内
所有源码，包括不属于该编译项目的源码。没有归属时继续原来的相对解析，不偷用
祖先配置；可看到配置和诊断范围。references 仅诊断为本轮未展开，不推断其它
命名配置的别名；叶目录自己的 tsconfig.json 不受上层 references 限制。

支持 TypeScript 解析的相对 extends（字符串或字符串数组），按 TS 的覆盖规则和
声明位置解析继承的 paths/baseUrl。仅为模块解析使用这些设置：paths、baseUrl、
module、moduleResolution、resolveJsonModule、customConditions。
运行时 import 与类型入口不能混作有函数实现的端点；没有实现体时保持未知调用。
已有 allowJs/checkJs/noLib 和语法提取保持当前行为，不做类型正确性承诺。

通过 ts-morph 的 resolutionHost 为每个来源文件提供相应选项，并调用其内置
TypeScript resolver。解析结果必须指向同一捕获集合中的实际源码；只能由 checker
选中的声明身份产生 resolved 调用。不同子项目可使用同名 alias 而互不污染。
缓存键必须包括来源配置/有效选项，不能仅按 import 字符串全局缓存。

匹配已声明 paths 但目标缺失/被排除/越界的 import 是 unresolved，原因指向配置
和边界，不能伪装成外部包。没有配置匹配的 bare import 保留 external；相对缺失
仍 unresolved。未知与外部绑定传播到调用的分类要一致。原有 namespace/default/
alias/re-export、Python 和稳定符号 ID 不退化。

## 快照、批准及公开可见性

`CodeSnapshot.coverage` 新增可选 `configurationFiles: string[]`，列出成功捕获的
配置路径；旧 SQLite 快照没有该字段仍能读取。配置不计入源码文件数量。
HTTP/MCP 项目 summary 沿用 coverage，不建立另一套事实或批准规则。
导航诊断区以中文/英文分别显示“配置输入”/“Configuration inputs”及数量和路径。

`contentHash` 从本轮起是版本化索引输入摘要：源码路径/字节与所有成功捕获的配置
路径/字节，包括无效 JSONC 输入，均确定排序并带类型和长度边界参与 SHA-256。
旧名称保留以兼容 Plan/Approval API，文档明确其语义扩大；原快照不重写。
只改配置也产生新输入摘要和新快照，并使旧 Plan/Route 基线过期；保留历史批准和
规划内容。符号 ID 不依赖配置字节或源码行号。分析能力/诊断仍纳入 snapshot ID。

预算拒绝的内容未作为推断输入；诊断变化纳入事实指纹。读取不到的配置不产生
猜测关系。手动刷新保持现有生命周期，不增加 watcher 或增量索引。

## 验收与回退

1. JSONC + 相对继承的 paths/baseUrl，实际 import 和调用均连到捕获函数及源码行。
2. 两个子项目同名 alias 连到各自目标；default/namespace/re-export 保留声明身份。
3. 显式 files/include/exclude、未归属源码、references-only 根和最近无效配置均
   遵循上面的规则，不静默跨配置；继承设置按声明位置计算。
4. 排除、symlink、越界、循环、多 extends、预算失败可见；外部 sentinel 永不读取
   或执行；source-only/Python 的现有安全回归通过。
5. 单独配置改动使真实 service 的旧批准/路线过期；历史快照保留，符号 ID 稳定；
   旧 schema 数据可读取，配置不是源码覆盖或函数节点。
6. 真实 HTTP 与 stdio MCP 查询同一 alias 调用/配置 coverage，网页实际浏览源码并
   看到双语配置范围；必要的截图实际查看，记录 stdout/console 和进程清理。
7. 构建、类型、lint 和受影响回归通过；完整 suite 在最终集成变更后运行一次。

独立审查报告 Critical/Important 时按 SDD 修复；发现 resolver 必须访问磁盘才能
得到结果时停止扩展该方式，保持 unresolved 并记录证据，不改读盘边界。回退为
移除此轮解析 host，历史数据保留；不得清库或删除用户知识来消除不一致。

## 自检与执行约定

本 spec 选择了具体配置归属、预算、摘要兼容及未知分类，不含待选实现方向。
三个实现任务分别负责输入/新鲜度、checker 解析、产品验证，可各自审查。
用户睡前已授权自行选择稳定方案；AGENTS.md 的无人值守例外取代阶段人工暂停。
继续 writing-plans，使用顺序 SDD，每个任务独立实现、独立审查；T08 gate 完成前
只准备文档，不开始本轮产品实现。
