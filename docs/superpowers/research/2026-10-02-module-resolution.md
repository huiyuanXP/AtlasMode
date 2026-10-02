# 模块解析后续 Ticket：准备证据

状态：研究记录，不是已实现能力，也不是正在执行的新任务。
记录时间：2026-10-02 UTC；先完成 T06–T08 和首轮验收再确定独立 spec/plan。

## 已确认缺口

当前 packages/indexer/src/typescript.ts 使用 ts-morph 的内存文件系统，
只注入扫描捕获的源码，固定 NodeNext 选项。这个选择保证编译器不在扫描之外
读取目标文件，但不读取 tsconfig paths/baseUrl 或 workspace 包名。
因此 @codemap/core 等本仓库内部包目前仍可能被当成外部依赖。
已完成的相对 import/alias/re-export 解析不能据此宣称支持 tsconfig 路径别名。

安装的 ts-morph27.0.2 公共类型提供 ProjectOptions.resolutionHost 和
ResolutionHostFactory，可通过受限的 moduleResolutionHost 调用 TypeScript
解析，而不必切换为无限制的磁盘编译器。后续必须以实际测试验证其能力。

## 三个候选方向

1. 保持一次捕获、内存编译：把需要的配置和包清单作为受限输入，按来源文件
   选择配置，使用 TypeScript 模块解析和可证明的 workspace 映射。
   默认推荐，保留扫描范围、字节一致性和无法判定的边界。
2. 让 ts-morph 直接加载磁盘项目：配置支持完整，但容易读到依赖/根目录之外，
   输入和摘要不同步；不适合直接替换当前受限索引器。
3. 自行按字符串映射 import 到路径：实现成本低，但很容易把相同名称、条件
   导出或构建文件错误地连接到源码，不能满足事实图的证据要求。

## 固定公开目标的实际配置

Vite8.3.2 根目录没有 tsconfig.json；各子项目有独立配置。
packages/vite/tsconfig.json extends ./tsconfig.base.json，主要 include 构建脚本；
src/node、src/client、src/module-runner、src/shared 又有各自配置。
不能只读取一个根 tsconfig 就声称支持这类 monorepo。

packages/vite/package.json 的 exports 指向 ./dist/node/index.js、module-runner.js
等构建产物，不是当前扫描源码。没有显式、可证明映射时，不应把它自动替换成
同名 src 文件。包清单 imports 中还有 #dep-types/*，需要清楚区分类型声明
和有实现体的函数。

## 最小验收建议

- 带 JSONC/相对 extends 的单项目 paths/baseUrl 调用有真实源码端点。
- 两个子项目拥有冲突 alias 时分别解析到自己的目标。
- 本仓库内受限 workspace 包引用解析；不存在的 dist 不猜源码映射。
- 同名外部包、动态 require、条件/多候选导出仍保留明确 external/unknown。
- extends 越界、符号链接、循环、无效配置不触发任意读取或执行。
- 配置/清单变化纳入索引输入及批准新鲜度；不同分析结果不能复用历史快照 ID。
- 稳定符号 ID 不因空行改变；旧相对 import、Python、安全扫描回归继续通过。
- 通过产品 HTTP/MCP 查询真实跨包关系并抽查来源位置；报告扫描范围及诊断。

开始实施前确定配置选择规则、支持的 exports 条件和输入摘要契约，记录限制，
写独立 spec/plan，并沿用 TDD、独立审查及实际运行。不要在 T06–T08 中夹带实现。
