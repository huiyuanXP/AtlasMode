# 原 PERF02 Task4 Window C — UI 接线交付

本轮完成原 Task4 源码接线，基于 accepted `130a64ad6380493dd1f4bb0fdbc8e4480a54876f`（产品字节同5ccf），隔离分支 `task/perf02-window-c-20261011`。已审 Task1/2/3 的14份源码/测试按SHA组装，core出口、server只读查询/路由、client transport只合当前薄hunks，未替换旧共享文件。

最终源级门禁：**19文件221/221PASS，无skip**；web生产源码+本轮3个owned测试、core/server生产源码noEmit、16修改文件lint均exit0。首次独审 [REQUEST_CHANGES C0/I3/M1](task4-independent-review.md) 保留；定向修复与R2漏斗加载门补齐后 [最终限项独立复审](task4-independent-final-review.md) APPROVE C0/I0/M0。R2中busy.funnel未闭的REQUEST_CHANGES C0/I1/M0也保留于 task4-independent-rereview.md；最终只补齐该剩余实时门，不改已通过项。

完整snapshot-bound全局target交真实moduleWorker构造路径；默认auto仅derived状态，不保存或写规划。当前已加载图保持有界，projectGraph/projectGroups前预检，拒绝后的fact-only fallback独立预算。两次局部布局共用累计几何计数，第一候选私有，只有当前投影的完整尺寸可完成；旧frame/token不能apply/save。当前ownership、dirty/group draft、loading、funnel、group-selection实时保护，两次完成门检查authoritative capture；保护interval和显式全局重算使旧代次失效。

同项目同导航范围跨snapshot保留幸存compact auto，内存最多两项目、每项目一个500node范围；旧snapshot缓存不冒充当前ready。显式重排忽略当前范围auto，保存当前view位置patch并保留hidden canonical/offscope/opaque keys；普通拖动保存单visual key。250ms串行保存捕获独立payload与project/snapshot epoch，失败保留本地未保存提示，过期ACK不采用serverview。漏斗偏移、原地图与source/domain/归属身份保持。App卸载释放Worker/订阅/cache。

221项包括store24/session37/CanvasSSR5及相邻ownership/navigation/funnel/graph/groups/SQLiteHTTP等回归。WorkerPort仍为受控double，CanvasSSR/纯helper/调用门探针没有真实DOM；SQLiteHTTP13验证真实只读查询及数据库不变性。测试运行时间不是布局性能收据。

**Task5 Window D NOT RUN**：compiled生产Worker asset/真实DOM矩形与pointer、reload/restart保存坐标、固定Express/Flask冷热10次与p95/Vite预算拒绝。固定目标durable路径/provenance尚待父侧/用户提供，不能猜临时路径或探索runtime sessions。这仅阻未来Task5，不回填成Task4实测。本轮不启动Task5。

PERF02仍TODO；FS01/KN01/POL01 DONE，36票22DONE/13TODO/1PARTIAL保持。新分支commit/push只发布源码交接，不merge/deploy。原dirty/checkpoints保留，五checkout7984既有非敏感路径、Git状态和HEAD复核未变；敏感名字路径在初始manifest即排除且不读。历史CI130a64ad/run38114356100成功仅为旧Task3记录，不作Task4门禁。新远端CI以新HEAD记录，不继承旧green。

## 证据与恢复

- `task4-source-evidence.tar.gz` 收录R1/R2/R3冻结源码、baseline/shared diff、原始失败与最终收据、复现配置、owner progress及保护审计；`task4-source-evidence.sha256` 验证归档，解包后 `MANIFEST.sha256` 验证每个文件。
- owner `/home/agent/projects/AtlasMode-checkpoints/2026-10-11-perf02-task4` 保留全部现场。源代码worktree为owner/workspace；原失败/R1不删除。commit/push精确SHA及新CI状态保存owner/evidence/git-publication.json和owner最终handoff，不在commit内部自指未产生SHA。
- [下一线程恢复入口](next-thread-handoff-20261011.md) 指向owner最终双份与原Task5边界。当前用户任务到此停止。

neat-freak：代码source-level verified-current；运行态pending Task5/未部署；文档changed-and-verified；规则verified-current/未改；生成记忆out-of-scope/read-only。按用户保存现场指令保留隔离worktree/全部历史成果，覆盖默认cleanup建议；成本为占用明确owner目录，无长驻新测试服务或资源变更。owner progress记录其余裁决与成本。

模型契约：简单短程gpt-6.1-sol low、简单长程gpt-6-luna xhigh、其它简单luna high/xhigh、复杂solhigh；实现和fresh独审solhigh。用户要求Fast与低reasoning不同；当前工具无current-turn/service-tier字段，未启用/无法核验、额度不可见、未改全局配置。
