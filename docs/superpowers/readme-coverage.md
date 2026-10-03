# README 要求覆盖与后续工作

2026-10-03 UTC T08 实施者逐项复核，独立任务复审通过；整体分支六项发现修复及独立复审通过。
PASS表示下述范围已有实际证据，PARTIAL表示部分功能或平台尚未覆盖，
UNIMPLEMENTED表示仍为后续需求。测试通过不等于原README所有目标完成。
问卷要求优先：首轮含Python、多个本地项目、三系统配置和英文，真实MCP为首轮要求。
无共享分支push或公开部署授权。

## 要求覆盖

| README / 问卷要求                                              | 状态          | 实际证据与边界                                                                                                                                                     |
| -------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Superpowers 可重新发现，Codex/Claude流程                       | PARTIAL       | 15技能/74文件vendor校验通过，AGENTS/CLAUDE引导存在；原生客户端技能目录自动发现未验证                                                                               |
| 单根锁、Node LTS、包边界、统一脚本（§7/8/14）                  | PASS          | 干净npmci410包；7包build/typecheck、eslint边界检查退出0；全套200/20文件，无失败或跳过                                                                              |
| 单用户本地服务、多项目隔离（§2）                               | PASS          | API/UI/SQLite；E2E TS→Python→TS切换；迟到请求隔离单元回归、显式项目MCP所有权验证                                                                                   |
| TS/JS/TSX/JSX、Python真实静态索引（§5/P1）                     | PASS          | indexer与跨包集成；固定Vite1583文件及Flask83文件；Python仅AST、恶意顶层代码未执行                                                                                  |
| 函数/方法、目录/文件、导入/调用、未知和源码（§5）              | PASS          | 源码与range、动态/external/unresolved样本；UI实际源代码与Chromium原生clipboard.readText                                                                            |
| 跨文件相对import、局部别名、re-export（§5）                    | PASS          | TS/Python fixtures、实际索引调用证据；限定为当前适配器支持的可证明解析                                                                                             |
| 受限tsconfig paths/baseUrl与配置可见性                     | PASS          | 捕获JSONC/相对extends、最近配置归属、checker声明解析；配置only生命周期HTTP/SDK与真实SQLite历史读取、双语UI回归通过                                                                                      |
| 受保护静态 CommonJS 与包配置 | PARTIAL | .cjs/有效包scope的.js、稳定const require和导出、覆盖/遮蔽guard、包only新鲜度/历史/双语已验；Express全仓canonical入口因forwarding escape仍未满足，完整值流/运行兼容性未实现 |
| workspace package/exports、references图 | UNIMPLEMENTED | 不展开references或猜测package源码 |
| 稳定ID、快照摘要、忽略规则和源码安全（§5）                     | PASS          | 插空行身份不变、文件内容hash/捕获字节、安全源码路径、symlink排除等回归；快照记录Git revision                                                                       |
| 重命名/移动迁移映射和候选（§5）                                | UNIMPLEMENTED | 没有以相似函数自动替换绑定；需要后续显式接受映射流程                                                                                                               |
| 成熟公开仓库实际浏览                                           | PASS          | 固定Vite/Flask真实HTTP/UI/SDK通过，截图已查看；范围/SHAs/未知/截断见validation-targets.md，上游测试未运行                                                          |
| 图查询分页/预算和诊断（§10）                                   | PASS          | MCP/HTTP实际budget1截断，UI80/240和上限300/900；入口/搜索分页与大图截断可见                                                                                        |
| 中文/英文、主题、局部画布和入口浏览（问卷/P1）                 | PASS          | E2E界面语言/主题实际重启保留；入口/展开/搜索/源码；M3 cached help与快照提示RED→GREEN                                                                               |
| 独立事实/规划层、新函数、已有箭头改接、移除helper（§3/P2/§12） | PASS          | 真实browser/MCP闭环：caller→A变为caller→requestWithRetry，事实remove+plan add；新函数复用同B，helper删除                                                           |
| 规划目标文件修改及布局不移动文件（§3）                         | PARTIAL       | 表单修改为services/notes.ts、只保存规划；真实拖动布局保持revision/hash；专用文件/目录框拖入与路径预览未实现                                                        |
| 功能集和多对多成员（§4/P4）                                    | PARTIAL       | Agent来源propose_group、UI勾选创建、共享成员、成员/说明查看与持久化已验证；画布圈选、成员编辑/折叠及外部端点保留未实现                                             |
| sequence/wrapper高级操作（§4/P4）                              | UNIMPLEMENTED | 当前优先capability；不把成员列表伪装成调用顺序，不自动生成wrapper                                                                                                  |
| 说明、约束、失联知识保留（§5/9）                               | PARTIAL       | 规划annotation、组说明、目录purpose持久化；失联组成员显示missing；独立通用annotation编辑/重新绑定工作流未实现                                                      |
| 目录职责/禁止依赖、知识修改需重新批准（§6/P4）                 | PARTIAL       | 真实policy save→revision+1，禁止requests.ts报错，purpose改变也撤销批准；自然语言职责人工判定，allowed/例外理由编辑未实现                                           |
| .codemap/structure.json校验、原子写回与审计（§8/9）            | UNIMPLEMENTED | 仓库存在静态约定；当前产品policy在SQLite中，没有structure.json双向同步                                                                                             |
| revision并发、确认hash/基线、过期与历史批准（§6/9）            | PASS          | service/HTTP/MCP回归及真实r16 UI/MCP一致；布局不失效，语义/知识/源码变化失效；拒绝过期批准                                                                         |
| Agent查询/提案/读取批准、没有MCP批准工具（§10/P3）             | PASS          | 官方SDK实际stdio16工具；propose_plan/group/route与同一HTTP服务共享SQLite；真实UI确认后MCP读取同revision/hash                                                       |
| Codex App/CLI、Claude Code实际接入                             | PARTIAL       | docs/mcp.md提供三系统直接Node入口配置，CLI语法帮助核对；SDK验证通过；客户端实际注册/会话未执行                                                                     |
| 路线和未来skill接口（问卷）                                    | PASS          | call_chain/source evidence及walkthrough实际SDK创建、UI逐步定位；源码变化后stale禁止下一步                                                                          |
| 语义undo/redo                                                  | PASS          | 实际browser新增→undo→redo；单元历史/项目冲突回归；每plan50步、20个plan，会话重载清空历史栈                                                                         |
| 持久化、实际服务重启和两种规划导出（§9/12）                    | PASS          | E2E实际重启r16批准/组/主题仍在；JSON3356B、Markdown3544B实际下载校验；smoke项目持久化                                                                              |
| 实现后核对、故意绕过和源码证据（§6/12）                        | PASS          | 真源码新增/改调用后4项satisfied；改成A()出现unmet；fn()得到unknown；annotation保持人工unknown，不能代替目标行为测试                                                |
| 调用方减少/引用消失/完整索引差异（P4）                         | PARTIAL       | 已批准操作核对能报告要求缺失/绕过；全面snapshot diff、死代码判定与身份迁移尚无，不把无入边当死代码                                                                 |
| 知识schemaVersion迁移导入/冲突预览/一致备份（§9）              | UNIMPLEMENTED | 已有规划导出不等同完整知识导出；不得删除唯一SQLite知识/审批                                                                                                        |
| 安装后核心离线                                                 | PASS          | E2E+目标浏览拒绝非loopback请求，实际external[]、console/page errors[]；限定浏览器与本地核心，不包含模型客户端                                                      |
| 三系统运行与CI、退出行为（问卷）                               | PARTIAL       | 当前Linux干净检查及生产启动通过；三OS job+Linux官方Chromium job已配置但远端未运行；Win/mac及Windows Ctrl+C未验证，测试专用IPC执行真实handler与Unix真实信号各自明确 |
| 视觉检查和窄窗口                                               | PASS          | 实际查看source/light/dark/narrow及Vite/Flask截图；目标选中卡片>200px，busy已结束；密图需缩放/平移，760px下编辑器在下方                                             |
| 云配置发布、远端恢复和分发                                     | PARTIAL       | controller负责草稿/最终交付；当前实例成功不代表已发布、已push或新任务可恢复                                                                                        |
| 增量索引、自动布局、运行时证据、多人/额外语言（P4/P5）         | UNIMPLEMENTED | 按README保留后续方向；当前手动刷新、局部展开，无动态真实性保证                                                                                                     |

## 整体审查修复补充

- WR-I1：coverage 可选 availability 保存范围内 unavailablePaths 与固定范围外
  excludedPaths；旧快照可读取，缺文件无扫描证据为 unknown。真实 file/directory
  ignore 的函数/关系删除、move、明确排除路径、真实删除及无关正面证据已有回归。
- WR-I2：敏感 reads/writes 前校验本地 Host/Origin；真实进程及注入测试覆盖拒绝
  source/approval 且 SQLite 无审批副作用、生产同源、显式5173开发代理、无Origin MCP。
- WR-I3：唯一同名跨文件替代不能满足 reuse；显式 move、稳定ID和保守删除候选仍可用。
- WR-I4：let/var与对象/类字段 initializer 保留 unresolved，TS/JS与下游 reuse 有回归；
  const/direct控制保留。没有加入 tsconfig 或运行时/流分析。
- WR-M1：固定目标捕获前/后验证干净 Git 与完整 HEAD，4项临时Git回归；没有重跑
  固定 Vite/Flask。上表的成熟目标数量、图片及旧性能只对应其此前T08修订/时间戳。
- WR-M2：planned calls/must_call/must_reuse 明确 COMPATIBILITY_UNKNOWN warning；
  core/service/API/SDK/UI共享结果，结构有效仍可批准，不推断类型兼容性。
- 本轮集成测试220/22文件：218首轮通过、2新增请求 harness 失败并经更正后2项
  定向通过；随后增强的真实authority测试1项通过。不是修正后全套220项重跑声明。
  build/typecheck/lint与生产smoke通过；生产UI/SDK联合1项通过（10.2s/总11.2s），
  warning可见且批准r16有效，warning/light/dark/narrow/source截图实际查看。
  本轮hash为dd3888680bb47dd48bcfd83153beaca0ad52c7d8e922fd642a48c5096670e1dc；
  该轮artifacts/e2e已作为历史证据保留。准确命令与修订范围见
  [环境记录](../environment.md)及忽略目录 whole-fix-report.md。

## 可复核证据

- `npm ci --cache /tmp/atlasmode-npm-cache`、`npm run build`、`npm run typecheck`、
  `npm run lint`、`npm test`、`npm run smoke`实际退出0；精确本地日志为
  `.superpowers/sdd/2026-10-03-local-planning-mvp/task-8-clean-*.log`。
- 此前T08的 `tests/e2e/planning.spec.mjs` 实际1项通过（0失败/跳过，11.307s）；
  当时的 `artifacts/e2e/results.json`及`joint-flow-evidence.json`，r16/hash
  `0e88b0efc9dc331316ff36d5795a53a675189eabb2a07e51510db7d2868bd3a8`。
- `scripts/validate-repository.mjs`两个固定目标均退出0；产物、范围、准确统计及命令
  见[validation-targets.md](validation-targets.md)。当前本地日志/artifacts默认忽略Git。
- 环境/客户端/平台限制和启动说明见[../environment.md](../environment.md)。
- Windows preload file URL 修复24a6d76：真实空格/#路径回归1项及生命周期10项通过，
  独立复审通过；200项完整套件仍指初始T08结果，没有声称修复后201项全套重跑。

## 首轮通过后继续的缺口

按可用性和数据保全排序；执行前写独立 spec/plan 与验收项，顺序实施并审查。
不把 README 的未来路线图当成已实现功能。

1. **目标项目模块解析的剩余边界**：受限 tsconfig paths/baseUrl 已实现。CommonJS 覆盖/遮蔽与稳定子集已实现，
   完整 Express 转发使 canonical 入口保守失效；剩余 workspace package/exports、
   references 图与更广的值流另票处理；条件导出/动态加载不作运行时保证。
2. **功能集的 Agent 闭环复核**：propose_group 已纳入 T06，固定 agent 来源并
   遵守 project/member 验证；首轮实际 stdio 与 HTTP 一致性验收后再检查高级组合缺口。
3. **独立持久化知识与失联绑定**：注释不只依附某个规划，保留作者来源与约束语义，
   刷新后明确显示待重新关联；不自动把相似函数认作同一身份。
4. **知识迁移及数据保全**：带 schemaVersion 的知识导出/导入、冲突预览与明确应用，
   SQLite 一致备份入口。不得用缓存清理删除唯一知识或审批历史。
5. **目录约定文件闭环**：structure.json 读取、校验、原子写回及审计；允许/禁止
   依赖与有理由例外。区分显式机器约束和需要人工判断的自然语言职责。
6. **完整分组交互和归属操作**：组成员编辑/折叠，保留具体外部函数端点；明确
   文件归属拖动与普通布局拖动的模式，移动到目录时补全文件名并展示路径预览。
7. **身份迁移和索引差异**：提出可审查的移动/重命名候选，保存明确接受的映射；
   报告调用方减少、引用消失和抽象绕过，避免把没有入边当成死代码。

后续再评估组合流程/实际 wrapper 高级操作、增量索引、自动布局、额外语言和运行时
证据。固定 Vite 的分阶段产品耗时见 validation-targets.md；不将历史耗时冒充当前结果。

## 验收记录约束

T08 已按实际通过/部分/未完成更新，截图已实际查看。后续票据继续维护状态，
不能只断言文件存在或以旧版本的测试冒充新行为证据。云环境配置草稿保存不等于发布；本地 commit 不代表远端可复现。
当前公开目标验证范围和准确统计在 validation-targets.md。


## Captured tsconfig 更新（2026-10-03 UTC）

最终源码一次root build/typecheck/lint通过，293项/25文件全部通过（无失败/跳过）；
此前200/220计数保持为相应历史阶段。新增真实HTTP/SDK集成1项、真实浏览器2项
（先RED后GREEN）证明配置only映射变化使基线过期，旧快照/批准及函数ID保留；
从真实SQLite读出的缺字段历史summary在中英文UI显示未记录。配置数量与相对
路径不计入源码覆盖，截图已实际查看。contentHash升级后首次刷新可使历史基线
过期，无DB迁移或删除历史数据。

现有生产规划E2E再次1项通过，UI实际确认r16与SDK一致；5张截图已查看。
新的固定Vite gate记录55配置/1583源文件、18诊断，调用分类及具体时间见
validation-targets.md，旧Flask不重跑。外部请求与console/page errors为空，
SDK stderr为空，目标sentinel未执行，临时进程/SQLite已清理。
Task3与整票独立review由controller继续；当前这些是实现者执行的验证证据。


## Static CommonJS Task3（独立审查待controller）

最终root build/typecheck/lint与436项/29文件通过；真实HTTP/SDK/SQLite的type-only
生命周期与历史缺packageFiles读取通过。UI3项真实RED→GREEN，包含双语captured/
legacy及recorded zero；6张截图已看。规划E2E首轮关闭超时失败，独立重试1项通过，
未修复或隐瞒间歇退出风险。固定Express泛用浏览通过，但canonical入口exported=false
未达到原验收；原因、准确行36及scope在validation-targets.md。12张当前图片已查看。
原始warning保留，无目标执行/上游测试/依赖变更；Win/mac/真实客户端/CI/云恢复未跑。
