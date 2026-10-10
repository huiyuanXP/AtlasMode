# PERF-02 原 I1/I2 定向独立设计复审

日期：2026-10-10 UTC。Reviewer：`/root/ci_repair`，沿用明确指定的 `gpt-6.1-sol high`。独立于修复作者 `/root/pol01_review`。

结论：**APPROVE，Critical 0 / Important 0 / Minor 0**，仅针对原 I1/I2 的冻结设计修复。原两项已在设计合同及未来验收步骤中解决。本结论不是源代码实施审查、性能测试 PASS、PERF-02 DONE，亦不直接授予共享源码实施窗口。

## 精确范围及冻结核验

VM2 repository：`/home/agent/projects/AtlasMode`。

| 复审目标 | 读前 SHA256 | 读后 SHA256 |
| --- | --- | --- |
| `docs/superpowers/specs/2026-10-10-perf02-design.md` | `d8ab6c875b507b48fca202fde75a47117ac8218e5a0dbfcfea4b1a167c2965d3` | 相同 |
| `docs/superpowers/plans/2026-10-10-perf02.md` | `1359a2d4ae3fb2659061b4904592f1528628500ac00ac332d22302fe61553ea3` | 相同 |

`docs/superpowers/reviews/perf02-2026-10-10/targeted-design-repair.sha256` 的七项在复审前及复审后实际 `sha256sum -c` 均全部 OK。该 manifest 最后实际 SHA256 为 `6555c5282c48645aa8508d1cd1742c6d2069963cc5207c359654d0b03e5eac48`。读取了作者 ledger、原始 spec/plan 的定向差异，以及必要现役代码的循环与分配语义。

原始字节与失败报告保留：

- `original-design.md`：`6a9fbbec9ea3eff885fb828896e78e6dd61bc60bb5f93ebfd07bf3a710bc85a8`。
- `original-plan.md`：`97653f4e6f39496ef8092ec36171314c16a0db0d27b11536d19dd6a3b340421c`。
- 原 `independent-design-review.md`：`7d14fb6e4a070aa52a2e2b57cec22993c5c7c58c734c8a4854e9991fc676073e`，原 REQUEST_CHANGES C0/I2/M0 不改写。本机原报告也实际核得同 SHA。

必要只读 caller context 为 graph `projection.ts`、groups `projection.ts`、planning `function-target.ts`；最后实际 SHA 分别为 `464155e6b8831a8057e013b31997e98a48d5b56e45d0ab37811386c545e5b303`、`027249184becc3af2187519ac55c5700302202f16ee89ad7d57e4d94dea60f67`、`5018603331e0b9b984ff68ea3b8fc65dc873fff5fe919e5efb70ad4ca7b8fe27`。它们仅用来核对预算合同，没有更改或执行。

## I1：投影前实际工作及安全降级——设计层关闭

Spec 150–162、plan Task 3 steps 1/3 及 Task 4/5 明确在 `projectGraph` 前检查 source arrays length；不先 filter/map/复制完整大计划，也不改变 uncapped Plan.operations schema。Plan/both 的 4097 operations 仅凭 length 拒绝，operationVisits=0；fact 模式传空 operations，不扫描同一大计划。图 300/900、references 500、visible operations 4096 是独立前置门槛。

现役代码确实包含每 emitted node 的 `changes` 全 operations 扫描、matching move 的 `findLast`、每 addition 的 `effectiveFunctionPath` 两次扫描、remove_relation 的 graph lookup，以及每 fact edge 的 removal `some`。修复的保守工作式显式计入 `N*P + C*P + 2*A*P + D*R + F*P`，有饱和安全整数、2,000,000-step 与 10,000-major-entry 拒绝。预检自身只走受限索引及至多两次 operation/relation/node pass、一次 references pass；不可把这些现役嵌套扫描搬进预检来证明预算。

Emitted 数按分配次数计，非法 visual ID 冲突拒绝；有效计划关系在完整 endpoint 集合上计数。两个 loaded endpoints 加 2001 个不同且合法 add_relation 现在有独立必需 fixture：第 2001 条有效边处拒绝、projectGraph 调用 0、GraphEdge array 分配 0。早停下界与完整 exact count / 保守 upper bound 分开，不能写成 rendered count。

Group 投影也在 `projectGroups` 前限制 groups/collapsed lengths、累计 member visits、扩大 cards/routes、nested work 与主要临时分配。实现必须遵守 spec 156/162 的 list/map/set 分配上界，计入现役 membership list 反复复制、unknown member Set/ids、loaded arrays、affected/routes/internal IDs/ports；不能只数最终 cards/edges。该条款配合未来 accepted-bound 不小于真实访问/分配的测试，形成实施与后续源码审查要求。

拒绝后的新安全画布明确重新独立预检并调用 `projectGraph(graph, [], fact, positions, locale, [])`，无 references、无 groups、不调用 projectGroups；不会复用 rejected expanded base 或仅改 filter 标签。raw graph 自身超限则空安全画布并显示未完成。同项目先前 accepted 图可保留，但必须标旧 snapshot/scope。本次拒绝不更改 editor、Plan、filter、collapsed 状态或 positions。原 I1 的危险路径因而在设计合同中被关闭。

## I2：几何全过程计数与有界诊断——设计层关闭

Spec 81–106、148/166，以及 plan Task 2/3/4 对同一个 job 的 pin 插入、retained 复核、候选、最终 validation 均要求实际 bucket-entry visits 与 rectangle predicates 分别计数；读取/比较前检查 cap。去重、自身条目、重复 cell visits 仍收费，禁止先复制大桶或另做未计数全 pairs 扫描。

Global/local 的 visits 为 4,000,000/200,000，comparisons 为 1,000,000/50,000，manual pair observations 为 4096/256，另有 probes、每 box cells、累计/驻留 entries 约束。输出至多 64 pin IDs 与 32 sample pairs。最终验证采用 stable ID 上三角与有界 per-query dedup；诊断输出截断继续有预算的验证，不产生无限 pair Set。成功 complete 的每 pass observed count 是 exact；耗尽则 rejected、complete=false、只标已观察下界及 stage，不伪报总数。

第二次局部测量通过 immutable `priorGeometry` 接续计数，Session 不得归零；同 pair 在第二 pass 再验证仍消耗累计 job work。候选坐标暂存，旧 projection 可供测量；全部校正与最终验证完成后才一次 apply，显式保存也在此之后。第二 pass 耗尽不能 apply/save 第一 pass 的候选。

未来测试明确包含 global/local dense co-located、same-cell nonintersecting、pins/retained/new-pin、重复 cell visits、final-validation cap/cap+1、diagnostic output bound、长边及高入度，并要求两 pass 累计超限无 partial ready/apply/save。长边不通过无界 point sampling 进入碰撞索引；其关系/路由成本仍在输入及投影门槛内。原 I2 所指 bucket caps 掩盖二次工作与无界提示的漏洞已有可执行设计约束。

## 证据边界与下一步

本轮没有运行测试、build、lint、浏览器或 worker；没有改产品、目标文档、DB、index、dist 或 stage；没有 spawn。上述新数值仍是成本提案，不是实测能力。冻结核验与静态复审不能替代未来 RED/GREEN。

原 G1–G6 与真实规模门槛保持：同 snapshot 完整 target、5000/20000/8MiB、Express/Flask exact counts 与每事实 position 覆盖、冷/热各五次全部 ready、compute p95≤250ms、每次 roundtrip<1000ms、局部两 pass 合计≤120ms、1600/1900 当前 DOM 几何及真实关系点击、saved pins/mirrors/reload、worker cancellation/CAS、source/Plan/approval/history 不变、FS/funnel/map 回归均仍待实施实证。仅超限拒绝通过不能替代已知中型项目 ready；任一必需门槛失败保持 PERF-02 未完成。

可接受下一步为主控明确授权 Window A 的纯 helper/TDD，再冻结做独立源码审查。共享 query/UI 接线须按既有授权窗口与 FS/GRP/POL/KN 协调；本限定 APPROVE 不扩展该范围。
