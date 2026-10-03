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
已复审通过（56ccccf、2c016ec）。T03 SQLite 与规划/核对服务及三个审查问题的
修复已复审通过（f2d1b11、5608f10）。T04 HTTP、本地 CLI 和启动器退出修复
已复审通过（ebfa409、6daac82）。T05 真实代码画布与规划界面已实现
（2dc95d7），导航结果竞争和节点聚焦的修复（a9d27a0）已独立复审通过。
T06 实际 stdio MCP 已实现并独立审查通过（7f7bd95）。T07 英文、分组、
目录约束和撤销重做已实现并独立审查通过（88c1096），少量客户端错误提示的
语言切换问题已在 T08 修复。T08 实施验收及独立任务复审已通过；整体分支六项修复及独立复审通过（56e7f6f）。
T01–T08顺序执行，不并行派遣实现者；精确任务/修复轮次以 ledger 为准。
本轮开始 UTC 2026-10-02 19:55；文档沿用最初 Asia/Singapore 的2026-10-03日期。
当前环境报告时区 Etc/UTC，后续时间证据以 UTC 为准。

## 验证要求
真实启动/请求、build/typecheck/lint/tests、stdio MCP、Playwright 操作、截图实际查看、
固定公开中大型TS项目与Python项目索引。三OS CI矩阵，未实际跑的native runner
明确未执行。失败按 setup/应用缺陷/能力阻碍区分，禁止关闭TLS/校验或弱化测试。
已验证工作流安装校验、锁定依赖安装、core 51 项测试及其构建/类型检查/lint。
T02 原实现全套72项通过；复审修复后 indexer 31项回归通过，相关构建/类型/lint通过。
TS/Python 捕获字节索引、安全源码读取、打包后 Python helper 与目标代码不执行已验证。
已修复 Python 影子绑定/局部未初始化错误连边和匿名回调空行身份变化；独立复审通过。
本地 SQLite 原生模块、TS AST、Fastify/static、MCP SDK 导入已做依赖烟雾验证。
T03 原实现全套112项通过；修复后 storage/service/实际生命周期相关34项通过，
相关构建/类型/lint通过。T04 全套141项通过，退出修复范围5项通过；已实际运行
编译后的 API 进程、读取源码、重启持久化和退出。T05 首次全套165项通过，
修复范围18项通过；实际浏览器已操作真实源码、规划、批准、导出与核对，
并查看浅/深色及窄窗口截图。T06 全产品构建、类型检查和 lint 首次全部通过，
全套177项通过，其中11项实际 SDK stdio/共享 API/重启持久化测试通过。
该 T06 阶段尚未做的 UI/MCP 联合验收及浏览器离线检查现已由 T08 完成；原生 Win/mac 未执行。
T07 最终192项测试通过，七个 workspace 构建/类型检查和 lint 通过。实际浏览器
验证了双语/主题重载、共享分组成员、语义撤销重做、知识修改重新确认、禁止依赖、
临时节点详情/复制位置及失联内容保留，并实际查看截图。会话撤销最多每规划50项、
控制器20个规划；页面重载清空撤销栈，SQLite 的规划与历史批准不受影响。

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
  `/tmp/atlasmode-validation-targets.json`。已通过公开 SourceIndexer 实际索引：
  Vite1583文件/11218节点，Flask83文件/1989节点，并抽查源码调用证据。
  阶段及 T08 产品 HTTP/UI/MCP 浏览通过的统计见 validation-targets.md。
- API 新鲜度约定：批准/核对先真实索引；MCP 读取批准也先刷新。service 源码读取委托
  indexer 的可选 readSource port。契约与 ledger 已同步；T02 实现者已收到接口补充。

## T08 初始验收（2026-10-03 UTC）

当前 Linux：`npm ci --cache /tmp/atlasmode-npm-cache` 安装410包；七包 build、
typecheck、lint 均退出0；`npm test` 200/20文件通过，无失败/跳过（40.01s）。
生产 smoke 验证静态资源、TS/Python HTTP/SDK、目标不执行和实际重启。
真实 Playwright 联合闭环1项通过（11.3s）：最终批准revision16，UI/MCP同hash，
改接B/移除helper/目标文件/导出/知识使批准失效/布局保持批准/重启/源码核对三状态
与实际剪贴板均验证；没有外部浏览器请求或console/page errors。
固定 Vite/Flask 的产品打开/搜索/源码/有预算展开/MCP 通过；修正截图等待条件后
实际查看可读选中节点和空闲footer；未执行目标代码或上游测试。
M2 MCP消费JSON正文超时、M3提示语切换语言和快照变化提示已修复并有RED/GREEN；
浏览器发现的改接候选缺失已用当前快照已加载入口/搜索事实及可读reference节点修复。
CI三系统配置已创建，但原生Win/mac、远端CI、客户端连接、fresh-task恢复未执行。
环境与可复现命令见 ../environment.md；README精确PASS/PARTIAL/UNIMPLEMENTED见
readme-coverage.md。独立任务审查发现的 Windows preload 路径问题已用 file URL
修复（24a6d76），真实 space/# 路径回归及相关10项生命周期检查通过，独立复审通过。
200项全套结果来自初始 T08 commit5b22868；修复后未声称重跑201项全套。
固定目标 validator 的 dirty-tree 防护为 Minor，交整体分支审查裁定；实际两个目标
工作树已确认干净。全分支审查由controller继续，未来票据尚未实施。


## 整体审查唯一修复波次（2026-10-03 UTC）

基线be10c8418398f4c6262218bddf137dbba1ec6963，现已实施WR-I1–I4及WR-M1–M2，
唯一范围复审已通过（0新增Critical/Important/Minor）。新contract经controller确认：可选
coverage.availability={complete,unavailablePaths,excludedPaths?}；固定范围外
目录不影响范围内真实删除，但明确指向其内部的目标为unknown。旧快照可读取，
无扫描证据的文件缺失为unknown。未实施后续captured-tsconfig票据。

修复内容：被ignore/不可读的源不能证明删除；同名跨文件候选不能满足正向reuse；
可变TS/JS callable initializer不再肯定指向旧值；HTTP提前验证本地Host/Origin，
显式dev5173代理与无Origin本地MCP保留；固定目标validator前后检查干净Git与HEAD；
规划call/reuse共享COMPATIBILITY_UNKNOWN warning，结构有效仍可批准。

七包build/typecheck、lint通过。唯一完整套件执行220项/22文件，218首轮通过，
2项新增请求harness失败（fetch忽略Host、空JSON body）；修正测试请求后2项定向
通过/14未选，增强node:http实际source/approval拒绝及SQLite无审批副作用后1项
通过/4未选。没有宣称修正后全量220项再跑。生产smoke通过；实际生产UI/SDK联合
1项通过（测试10.2s，总11.2s），r16/hash一致；兼容性warning可见、批准成功，
external[]及console/page errors[]。截图warning/light/dark/narrow/source已查看。
精确日志在 .superpowers/sdd/2026-10-03-local-planning-mvp/scratch/whole-fix/，
交付报告whole-fix-report.md含最终commit与RED/GREEN记录。

固定Vite/Flask未重跑，旧指标/截图保持原T08修订及时间；本轮可变callable的调用
确定性变化不能用旧目标计数冒充当前结果。Win/mac、远端CI、实际客户端注册、
fresh-task恢复及发布仍未执行。依赖/lock/vendor、全局配置及目标仓库均未改动。

## 首轮归档与继续

T01–T08及整体审查gate已完成；25项Ruling与代价见
rulings/2026-10-03-local-planning-mvp.md。任务/修复/整体报告和ledger归档到
reviews/local-planning-mvp/；原始diff/log完整压缩在忽略产物
artifacts/review-evidence/local-planning-mvp.tar.gz。当前work分支继续，本轮不merge/push/publish。
用户尚未通知收尾；captured-tsconfig 的顺序SDD三任务均已实现并独立审查通过：
配置输入/新鲜度 → 按来源checker解析 → HTTP/MCP/UI真实验证。当前ledger在
.superpowers/sdd/2026-10-03-captured-tsconfig/progress.md，已归档任务不得重新派遣。
操作指南：../first-plan.md。云草稿保存不等于发布，fresh-task恢复仍未验证。

## Captured tsconfig Task1（2026-10-03 UTC）

Task1已实现受限JSONC配置输入捕获和版本化source/configuration hash：
262144 bytes/文件、4194304 bytes总量、512文件、16层（种子第1层）。
支持相对`.json` extends及Windows分隔符，捕获bytes只读一次；拒绝缺失、package、
越界、ignored、symlink、循环及预算超限，诊断不回显原配置。
可选coverage.configurationFiles与源码计数/CodeNode分离，旧schema仍可读取，
无DB migration/新依赖/公共port变化。配置-only及空白变更改变hash/snapshot ID，
函数ID及已返回历史对象保留。既有source availability/ignore/const-call回归保留。
本任务core/indexer共130项/4文件通过；两包build/typecheck及root lint均退出0。
RED为capture/schema20失败、identity3失败；补充不可用最近配置3项和post-read
预算guard mutation2项均有RED/GREEN。未运行root全套、服务或浏览器验收。

controller补充规则：已枚举但不可用配置以`CONFIGURATION_UNAVAILABLE:` message
前缀+repo-relative filePath保留拒绝scope，不作为源码availability。Task2内部resolver
接收可选captureDiagnostics，拒绝不可用最近配置的ancestor fallback；独立种子捕获
成功不能取消另一extends链的深度/循环/预算拒绝，需逐个归属配置验证。
Task1 f913eae已独立审查通过（0 Critical/Important/Minor），原始报告见新plan ledger。
Task2 952bffa已实现按来源文件的配置checker解析并独立审查通过（0C/I/M）：160项相关测试、core/indexer build/typecheck和root lint通过。
最近配置归属、拒绝scope、不跨项目cache、配置alias不可用unknown及捕获-only host均有回归。Task3实际HTTP/MCP/UI历史兼容和最终root suite已通过，详细证据见下节；整轮Minor修复的范围复审待完成。

后续调研已实际复现CommonJS两类旧误判（导出覆盖、require遮蔽）及暴露入口缺口；下一独立Ticket先处理这些安全/语义边界，再处理workspace源码映射。当前不宣称完整CommonJS支持或运行时值证明。


## Captured tsconfig Task3 实现与验证（2026-10-03 UTC）

已实现导航“配置输入 / Configuration inputs”及独立配置数/相对路径；旧SQLite
缺字段明确显示未记录，保留源码/作者文本。真实编译HTTP+SDK验证配置A→B时
源码不变、目标/行号更新、函数ID保留、规划及路线stale、原快照/批准不变；
旧数据经新进程读取与刷新后历史保留。新增共享fixture复用已有生产harness/sentinel。
浏览器2项真实RED（配置区域缺失）→GREEN，4张双语/legacy截图已实际查看。
Task1/2已满足后端生命周期，因此后端是新增GREEN基线，不制造产品RED。
最初两次后端失败是测试缺少call_chain relationId和错误依赖节点遍历顺序，
更正harness后通过；没有为此修改产品后端。

最终源码后一次root build/typecheck/lint均退出0，293项/25文件全通过（30.25s），
无失败/跳过。现有规划UI/SDK E2E1项通过（12.3s/总13.3s），r16/hash同源；
5张截图已查看。一次固定Vite gate通过（03:02:18.513Z）：1583源文件/55配置，
8117 function-kind节点、44263关系，调用6223 resolved/8302 external/15726 unresolved，
18诊断、5.796s；完整SHA和clean Git前后相同。新标签vite-captured-tsconfig图片
已查看，不覆盖历史Vite/Flask证据；本票据未重跑Flask。

外部浏览器请求拒绝，实际external/console/page errors/SDK stderr均空；sentinel
未执行，owned进程及临时SQLite/目录已清理。详细命令/时间/指纹与报告在当前
`.superpowers/sdd/2026-10-03-captured-tsconfig/scratch/task-3/`。
Task3 ab9f8c1独立任务审查通过（0C/0I/1M）；全计划审查在091687b完成（0C/0I/2M）。
唯一修复波次更正spec任务状态，并记录保留NO_COLOR的可移植后续命令；WR-M1仅部分处理，
Playwright1.63.0 worker仍强制FORCE_COLOR=1，不能声称旧日志或未来worker输出无warning。
WR-M2状态已更正；一次新范围复审及controller对残余warning的裁决待完成，未宣布整轮关闭。
CommonJS旧缺陷仍归下一独立Ticket；workspace package/exports/references未实施。
原生Win/mac、远端CI、实际客户端注册、fresh-task恢复/发布仍未执行。

## Captured tsconfig 整轮闭环

三个任务均独立通过；whole091687b为0C/0I/2M，集中docs修正f860e19经一次限定复审：WR-M2状态已修正，WR-M1环境颜色警告保留为非阻断Minor。51个产品源码指纹及46个历史文件未变；293项完整测试与真实接口/浏览器/Vite结果保持Task3原证据，不重跑或宣称所有命令无warning。所有33项审查范围外行为均逐项裁决，CommonJS已复现缺陷优先下一票。
归档和Ruling日志将保存于reviews/captured-tsconfig与rulings/2026-10-03-captured-tsconfig.md；原始证据完整压缩后再移除当前scratch。用户尚未通知收尾，本地work分支继续，不merge/push/publish。

## Static CommonJS 安全：当前活动计划

配置一轮归档提交 ec1e375；23 报告、10 rulings、原始证据 receipt 已保存，原 scratch 已删除。
配置恢复 bundle 782275 bytes 已实际克隆并验证75 vendor项与23报告；fresh-cloud restore 未验证。
新的设计 specs/2026-10-03-static-commonjs-design.md，计划 plans/2026-10-03-static-commonjs.md；
当前 ledger .superpowers/sdd/2026-10-03-static-commonjs/progress.md。
Task1：先修复实际复现的 shadowed require/overwritten export 错误连边及.cjs入口；
Task2：捕获 package.json scope、.js模式、输入新鲜度；Task3：真实HTTP/MCP/UI/固定Express验收。
所有任务尚待实施/独立审查；准备或目标clone不是产品验收。用户仍未要求收尾。

### CommonJS Task1 已验收

23b60de 的捕获AST注册表及 b0b2a2b 的重复声明修复均完成独立审查。
首次审查0C/1I/0M，限定复审确认I1已解决、0新C/I/M；最终253/6相关测试、
core/indexer build/typecheck/rootlint全部通过；83 registry用例及3公开回归。
Task2包捕获/.js正向模式、Task3公共产品/Express仍待实施；本阶段没有新的全根目录/浏览器验收。
默认.cjs正向范围，其他模式保守；不执行目标代码、不做值流/转发/workspace映射。

### CommonJS Task2 已验收

d217e1d 已独立批准，0C/0I/0M；309/8相关测试、core/indexer构建/类型及rootlint通过。
包配置受限捕获、strictJSON/最近opaque scope、.js模式、v3输入hash与可选packageFiles已实现。
原83身份用例保留，新9语法用例含import.meta/顶层await/计算名称；15源指纹已核对。
Task3真实HTTP/MCP/SQLite/UI/Express及最终全根目录验收仍待执行，未据单元测试推断通过。


### CommonJS Task3 实现者验证（独立gate待完成）

包配置双语导航、真实HTTP/SDK/SQLite package-only新鲜度和历史省略字段回归已完成。
后端已有GREEN基线；UI3项真实缺区域RED→GREEN。最终根build/typecheck/lint与
436项/29文件通过（30.32s），原源码字节/FnID/历史批准保留。6张包UI图片已查看。
既有规划E2E首次重启前10秒关闭超时/SIGKILL，单独重试1项通过（总12.0s），
未修改退出实现，间歇风险尚未定因；5张规划图片已查看。原始颜色warning保留。
Express固定SHA全仓真实HTTP/browser/SDK/source已浏览（142文件/1包/3070函数类节点）；
canonical createApplication实际line36，exported=false：index.js转发触发整模块escape。
精确源副本诊断证实此因；不改分析器、不缩减目标验收，canonical-entry未达成交controller。
新Express图已看；当前源SHA/前轮artifact保存检查无差异或遗失，owned进程/临时store清理。
任务报告和原始证据在当前SDD task-3目录；Task3和whole-plan审查尚未通过。
原生Win/mac、实际用户客户端、远端CI和fresh-cloud restore仍未执行；无push/publish。

Controller裁决：保留上述原canonical-entry未满足证据，接受本轮保守escape限制；
后续独立static-forwarding安全票据在whole-plan关闭后再规划，Task3不扩大分析器范围。

Task3源码提交888386e；正式spec/plan已在独立审查前明确保留Express入口失败并接受本轮保守限制，下一票优先静态转发安全。实际声明line36；文档路径更正，不修改产品或重跑已通过检查。Task3独立gate与whole仍待完成；退出超时仍是未定因风险。

Task3独立审查0C/2I/1M；aad35db修复重复浏览器拦截，经限定复审I2已解决。I1退出超时在两轮定因后仍为Important，Task3尚未批准。独立、共享worker及根套件并行三种带观测条件均正常退出，原失败仍未定因；不延长10秒超时、不称已修复。根测试内部重建共享dist，常规根检查与浏览器验证须顺序执行。第三轮仅限定静态调查，不重复已完成运行。

第四轮140a3aa已修复真实复现的空/未完成HTTP连接关闭卡住问题，定向17项通过；延迟6.1秒完整请求与部分流水请求保留HTTP200及重开SQLite快照。最终七包build/typecheck、lint及440项/30文件通过，再顺序运行规划E2E1项通过。限定复审确认新类别修复和数据保留、无新缺陷，但原未观测超时仍有Important因果证据缺口；第五轮为最后限定记录复核，无重复测试授权。Task3尚未关闭。

### CommonJS Task3 五轮上限裁决（整体审查待完成）

第五轮只查保留记录，未找到原始信号/连接/关闭阶段观测，也没有新源码修改或重复运行。
限定复审仍判 I1 为未解决 Important；controller 按五轮上限保留为真实历史证据缺口，
不宣称已定因或独立干净批准。Task3 以1项 parked Important 完成，I2已解决，
宿主颜色警告仍为 Minor；原始失败及双方观点进入整体审查。
当前修复类别及最终440/30和顺序规划验证均保留有效，整票尚未关闭。


### Static CommonJS 整体唯一修复波次候选（限定复审待完成）

整体审查5badf24为With fixes：WR-I1新阻塞require环初始化错误肯定、WR-M2环境页
过时状态；WR-I2原关闭故障因果缺口为真实Important、五轮上限后独立接受非阻塞保留，
WR-M1宿主颜色warning为未解决的非阻塞Minor。当前修复仅commonjs.ts/test和相关文档：
对有效捕获require依赖做迭代强连通分量检查，环内绑定未知，导入证据/稳定导出ID和
普通本地递归保留，mutation/escape guard不放松。嵌套/条件require保守拒绝，未实现转发。
真实RED11失败/7控制通过；110项registry及327项/8文件affected通过。最终源码上一次
顺序根build/typecheck/lint/test全部退出0：七包、**458项/30文件**，06:54:30 UTC启动、
30.24s。此计数取代历史440/30作为当前源码验证；历史436/29、440/30、UI3/规划/目标
证据仍按原阶段保留。本波次无UI/成熟目标/安装重跑。WR-I2仍NOT ADDRESSED，
原SIGKILL、五轮verdict及类别修复/保留证据不变；WR-M1仍NOT ADDRESSED。
唯一限定复审由controller派遣，尚未独立批准或整票关闭，无push/publish。
