当前阶段 **暂不 APPROVE：C=0，I=3，M=0**。已通知 main 与 IDX03 实施者。

1. **递归突破 2048 引用边预算** — `projectReferenceGraph.ts:62–83`
   父配置按剩余预算预取 entries，子递归消耗预算后，父循环仍继续追加。最小负例：root 有 2048 条引用，第一条指向 shared，shared 也有 2048 条引用；当前控制流可累计 4095 条边。应在递归前统一预留预算，或每次追加前重新检查，并验证图计数始终 ≤2048。

2. **共享缓存与 reachable 绕过深度限制** — `projectReferenceGraph.ts:31–34、142–148`
   浅 root 先展开 `shared→leaf` 后，深 root 在第 16 层复用 shared 时直接返回，漏掉第 17 层限制；reachable 还会跨 budget 边进入其他 root 已捕获的节点，进而授予 named scope。应按 anchor/path-depth 验证发现与授权，禁止预算失败路径授予归属，同时保留浅路径和 I2 合法 leaf 的独立有效性。需覆盖两个 root 互换排序的负例。

3. **scope 隔离丢失 CommonJS 全捕获写入 veto** — `typescript.ts:247–253`
   analyzer 只看到当前 Program 的 sources，独立 scope 的 mutator 不在其中，违背 `commonjs.ts:780–824` 的共享 namespace 稳定性要求。最小负例：app 调用 `require(lib).helper()`，另一 scope 的 mutator 修改同一 `mod.helper`；app 应 unknown。应跨 scope 汇总物理目标的 mutation/escape veto，保持 checker 的 owned-only roots。

已确认 I1 的 no-import/side-effect 隔离与 named binding 正例、I2 的 missing root/有效 named leaf 分离、可选 legacy schema、公开样本界限及 v3 捕获字节哈希已落实。已读取日志：462 tests、12 files PASS；本轮未执行代码、测试或 build，以上发现来自静态控制流分析。

Navigation/i18n 尚未授权，真实 HTTP/MCP/browser gates 尚未完成；修复上述 Important 后仍需限定复审，整票不能 DONE。
