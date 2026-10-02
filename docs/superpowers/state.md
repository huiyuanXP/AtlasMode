# AtlasMode 持续构建状态

## Goal
本机可运行的真实代码浏览与图上规划工具：TS/JS/Node/Python，Windows/macOS/Linux，
本地浏览器 UI、SQLite、MCP，中文及英文。按用户问卷和 README 逐阶段推进。

## 最新授权
用户已回答全部大方向，并明确“睡觉了，开始执行”，允许对其余细节选择稳定方案。
用户要求分阶段 Ticket、设置 Goal，完成问卷后继续对照 README 推进，直到通知收尾。
不再等待逐阶段人工设计/计划审批，改为自检、独立审查和实际验证。无发布/共享分支
push 授权。使用当前 cloud checkout，分阶段本地 commit。

## 确认决策
- 客户端：Codex App/CLI、Claude Code；真实 stdio MCP 接同一个本地 HTTP 服务。
- 语言：TS/JS/TSX/JSX、Node、Python；Python AST parse 不执行目标代码。
- 网页输入本地目录切换项目；各项目快照/知识/规划/布局隔离。
- 默认从代码暴露的入口逐步展开，保留目录/文件上下文；Agent 可提交多条路线。
- 清晰紧凑开发工具 UI：左导航、中图、右详情；参考公开实际 demos，浅/深色切换。
- 事实/规划叠加并可筛选；新增函数、目标文件、改接关系、删除多余规划节点、说明。
- 功能分组、目录约束、undo/redo 和英文适配在核心通过后继续完成。
- 源码片段只读、可复制位置；手动刷新，明确规划/路线过期。
- Markdown/JSON 导出；安装后核心离线，外部模型联网归客户端。
- Node 24 LTS；当前环境24.19.0/npm11.9.0；Python最少3.10。

## 实施记录
设计：specs/2026-10-03-local-planning-mvp-design.md
计划：plans/2026-10-03-local-planning-mvp.md
接口：contracts.md
SDD ledger：.superpowers/sdd/2026-10-03-local-planning-mvp/progress.md（忽略Git）
当前：T01 已完成且复审通过（1b33c7f、415a054）；T02 真实源码索引及修复
已复审通过（56ccccf、2c016ec）。即将实施 T03 SQLite 与规划/核对服务。
T01–T08顺序执行，不并行派遣实现者；精确任务/修复轮次以 ledger 为准。
用户时区 Asia/Singapore；本轮开始 UTC 2026-10-02 19:55（本地2026-10-03 03:55）。

## 验证要求
真实启动/请求、build/typecheck/lint/tests、stdio MCP、Playwright 操作、截图实际查看、
固定公开中大型TS项目与Python项目索引。三OS CI矩阵，未实际跑的native runner
明确未执行。失败按 setup/应用缺陷/能力阻碍区分，禁止关闭TLS/校验或弱化测试。
已验证工作流安装校验、锁定依赖安装、core 51 项测试及其构建/类型检查/lint。
T02 原实现全套72项通过；复审修复后 indexer 31项回归通过，相关构建/类型/lint通过。
TS/Python 捕获字节索引、安全源码读取、打包后 Python helper 与目标代码不执行已验证。
已修复 Python 影子绑定/局部未初始化错误连边和匿名回调空行身份变化；独立复审通过。
本地 SQLite 原生模块、TS AST、Fastify/static、MCP SDK 导入已做依赖烟雾验证。
产品服务、UI、MCP 闭环仍未完成，不能把依赖导入当成功能验收。

## 环境注意
默认npm缓存路径曾不可写；当前命令用 /tmp/atlasmode-npm-cache，不把该路径写入
跨平台产品配置。不提交数据库、缓存、artifacts或外部验证仓库。
Superpowers15技能74文件已固定v6.4.2；start_skill草稿已保存，尚未发布。

## 后续验证准备
- 已在当前 Chromium 中运行官方 React Flow Overview demo 并实际查看截图。
  可复用参考证据：`/tmp/atlasmode-reference-demo/evidence.json`、`overview.png`。
- 系统 Chromium 可用：`/usr/bin/chromium`；Playwright 官方浏览器 CDN 被代理拒绝403。
  浏览器测试通过可选 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 使用系统浏览器，CI/本机仍走官方安装。
- 外部只读目标：`/tmp/atlasmode-validation-vite`（Vite8.3.2）及
  `/tmp/atlasmode-validation-flask`（Flask3.1.3）；版本与 commit 在
  `/tmp/atlasmode-validation-targets.json`。尚未用本产品索引，不能宣称规模验证通过。
- API 新鲜度约定：批准/核对先真实索引；MCP 读取批准也先刷新。service 源码读取委托
  indexer 的可选 readSource port。契约与 ledger 已同步；T02 实现者已收到接口补充。
