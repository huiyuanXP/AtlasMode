# Binding global constraints

- Node 24.19.0、npm 11.9.0、Python >=3.10；现有 TypeScript 5.9.3、ts-morph 27.0.2；不新增依赖或改变 lockfile/vendor。
- 仅当前隔离 checkout 顺序 SDD；不 push/publish，不修改全局客户端配置。
- 只分析捕获字节和 AST；不执行目标代码、require、插件、脚本，不读取目标 node_modules、网络或真实 compiler filesystem。
- 包预算独立：262144 bytes/file、4194304 total bytes、512 files；配置原预算及16层边界保持。
- 相同 ignore/allowedPaths/root/symlink 边界；拒绝的最近配置/包 scope 不回退祖先；历史 SQLite、审批和函数 ID 不重写。
- 界面中文默认、英文适配；源码函数名、路径和用户文字保留；元数据不成为源码节点/计数。
- 动态或证据不足的调用明确 unresolved；静态 resolved 不等于运行时兼容或目标构建成功。
- 每任务独立审查；最后一次整体审查、唯一修复波次及唯一限定复审；已通过的检查只因改变/失败/具体疑点重跑。

