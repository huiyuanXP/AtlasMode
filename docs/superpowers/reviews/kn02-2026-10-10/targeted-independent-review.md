# KN-02 R1 原 I1/I2/I3/M1 定向独立设计复审

日期：2026-10-10 UTC。Reviewer：`/root/ci_repair`，沿用明确指定的 `gpt-6.1-sol high`，独立于两份设计及定向修复作者。

结论：**APPROVE，Critical 0 / Important 0 / Minor 0**。原 I1/I2/I3/M1 在冻结设计合同与未来验收步骤中关闭。这是限定设计复审，不是产品源码审查或测试 PASS，也不将 KN-02 标为 DONE。

## 范围、冻结 SHA 与原始失败保留

VM2 repository：`/home/agent/projects/AtlasMode`。仅复审指定 spec/plan 的四项修复及必要测试 resolution 合同；没有重新审查未冻结的 sibling 产品实现。

| 目标 | 读前 SHA256 | 读后 SHA256 |
| --- | --- | --- |
| `docs/superpowers/specs/2026-10-10-kn02-design.md` | `f9b8c05681b13356777b2e03a452e9126b2832f2b24f2df74c335af554871e61` | 相同 |
| `docs/superpowers/plans/2026-10-10-kn02.md` | `5f3867aaf27c29563303af6792fc1c44657cf2264ba8ecdce6e8c863ad6a5c7a` | 相同 |

读取当前修复 ledger，并实际用 `rev0-frozen/sha256.json` 的四个条目核对原始 raw bytes，全部 OK：

- 原 spec：`a0b4c376b24dce41afbe1c4d0e51310067c4993e3d39278d46f9e383bbe4d991`。
- 原 plan：`fbd83045d2d3fd559d373117bc1f9e32c5247c1e8860a90760109336766d5813`。
- 原 ledger：`7e75f5abdbd81cecf4a4721f10245839a386919bc438ec447e250a4a9e8bdbe6`。
- 原完整 REQUEST_CHANGES C0/I3/M1 报告：`f3369ea0f3bc46b3274f53fbfdaf6430a0d592bd769e83aebaa3fd5de7f27239`；同目录非 archive 原报告及本机原报告也仍实际同 SHA。

`rev0-frozen/sha256.json` 实际 SHA 为 `78184d966156739a70463ee2db810819ce4d6e99cf60bf01c8aa2027db3cc940`。当前 `design-ledger.md` 实际 SHA 为 `a54016124bf8cc7da61ccfeaebffe939feae7a99256a1f5f43b40122921e12bc`。原失败原文未被改写为通过。

## I1：terminal / pending / absent 优先级——设计层关闭

Spec 129–135/169 与 plan Task 4 接口及负例明确：scope/access、strict request 与稳定 requestHash 先检查，然后进入现有同项目 POL queue。**可信 terminal → trusted matching pending → absent** 分派在新 token 验证之前；也不能先 assertUsable/readStructure 把恢复中的 pending 挡住。

Terminal 精确匹配 project/domain/mutationId/requestHash，只返回不可变原 outcome；过期或重启旧 token 不妨碍 lost-ACK replay。已终结 failed/aborted/conflicted 不能当 absent 重放；receipt 损坏或 audit 不一致 fail closed。

Matching pending 必须是本项目可信 knowledge-directory batch，所有 request identity 匹配；过期 token、重启密钥、初次未知 I/O 不妨碍以后恢复。只读取本地 intent 的原 patches、生成 ID、before/candidate bytes、actual guards，调用锁内原恢复分支，不能用这次 payload/token 新造 candidate、再 publish或更换 intent。Unknown 暂不可读继续 pending；after 证明与 guard 校验通过才 finalize一次；before/third 按既有 abort/conflict 规则处理。异 hash/来源/项目、损坏 intent 明确拒绝；其它 mutation pending 阻断新工作。

只有 absent/new 分支才需要新的有效签名 preview、fresh guards 与明确确认。对应未来 tests 已补：pending 无 terminal + expired token、重启 HMAC + unknown 后 readable after、原 intent 不变/零 newpublish、同 ID 异 payload、terminal failure 不复活、absent expired 拒绝。原先恢复被 token 验证提前挡住的矛盾不再存在。

## I2：no-op 后服务端强制重预览——设计层关闭

Spec 127/137–145/151 与 plan Tasks 2–6 加入严格 project-scoped `settings/knowledge-import-generation:<projectId>`。缺记录读0，损坏/跨项目/非法 safe integer fail closed；签名 token 捕获 importGeneration。每个首次 terminal success 或 no_op 在与不可变 receipt **同一个同步 transaction/finalize** 中 generation+1。

这个代次不冒用知识、Plan、annotation revision 或 approval/context/registry 变化来使 token 过时。它保守使该项目此前所有迁移 preview 失效，明确允许同域或另一包也需重新确认；其它项目与 view-only修改隔离。Rollback、pending、failed/aborted/conflicted、取消不推进；已有终态 replay 不再推进；pending 的首次成功 recovery 才推进一次。容量先在 prepare 前检查，intent 捕获 expectedGeneration/expectedNextGeneration，finalize再次检查，不强制覆盖变化后的代次。

所以原 counterexample“预览两域 → 第一域 equal/no_op → raw HTTP 旧第二 token”现在有真实服务 guard 可返回409，即使其它 knowledge/plan/file/snapshot guards完全相同。两种应用顺序、fresh repreview、lost ACK/restart replay、rollback与project/view隔离都列入未来 raw HTTP和真实浏览器测试，不依赖 UI仅丢弃 token。无法恢复的 pending阻断另一域新导入，避免发布期间另一个导入推进代次使原 finalize绕过 guards。

## I3：等值 extension 的非空来源迁移——设计层关闭

Spec 161–169 与 plan Task 4明确失效条件为 **文件语义变化 OR DB-only实质编辑 OR 非空实际来源迁移**。混合批只一次 invalidate；不是只检查文档摘要变化。

Extension 已覆盖选中 legacy 记录且文件/语义 digest不变时，实际删除非空 DB来源仍走既有无发布同步 finalize：复读并验证 selected IDs/owners/完整 before-values，只删明确选中的旧来源；同事务保存 source-transition audit/import receipt/generation+1，structureRevision/current plans各+1，历史批准/context不动。原 bytes/digest完全不变，publish=0，没有 before==after 的含糊 publication intent；serializer差异不能强迫重写文件。

零迁移且所有数据等值才 no_op，不改 structure/plan revision，但按 I2 提交收据及迁移代次一次。真实 file change + DB edit + migration 的组合只在一次 publication finalize中应用 captured patches/deletes，三触发 OR失效一次。Future fixtures明确覆盖 equal-extension非空迁移、exact selected deletion、fileSHA不变/no publish/no ambiguous intent、零迁移及三者混合；原 POL 来源变更合同没有被批量接口隐藏。

## M1：新源码 resolution 与 compiled gate——设计层关闭

Plan 42–62给出主控隔离冻结 source archive、clean npmci、完整 tree/source/lockfile/config SHA、exact公共包 alias配置和 Tasks1–5 的 `--config .kn02-source-vitest.config.ts`命令。Alias仅公共package名，不开放深层 import；新 fixture exports必须可解析后才能记录行为 RED，不把 missing export/setupFAIL或 sibling旧dist当业务失败/通过。

必要只读核对了实际 `vitest.config.ts`、core及MCP package exports：root config确实无 source aliases，包出口指 dist；拟 MCP alias 的 `apps/mcp/src/index.ts`确实存在并导出 createMcpServer，CLI main 有 argv/import.meta guard，因此普通 source import不是盲目启动 stdio。此核对只是测试入口可行性，不构成对 MCP产品实现的新审查。

早期 harness仅 source/public ports、真实 SQLite/HTTP及in-process SDK；任何 stdio child、production server/browser/restart case移到 Task6 的另一个新 clean compiled archive，无aliases build/typecheck后运行，另存 compiled entry/source hashes。允许主控替代为同freeze拓扑的隔离 scoped compile，但需先给正确产物manifest。Source helper/SDK测试不能代替 compiled产品门，也不借 skip隐藏缺产物。

## 保留合同与执行边界

修复未改变两个分别确认、分别收据的应用域：DB notes/groups一次事务/一次失效；目录通过 POL队列/intent/finalize；第二域失败/取消不回滚已成功第一域，不承诺整包 atomic。没有新增跨票恢复平台、数据库 schema、客户可写任意 settings或批量自动 sourcewriter。

原已通过的 strict v1/未知版本与预算、真实 domain IDs及显式映射、orphan latch/墓碑、组完整成员与 unsupported composition、用户新source与replace保留source、不可导入approval/context/legacyregistry/history、directory未知字段和selectedsource、MCP只读工具及真实 UI/SDK/SQLite/source/history验收边界仍在；本限定复审不扩写权或重审这些未失败条款。

本轮只读取目标文档、原始归档和必要现有 resolution合同并写本报告；没有改产品/目标文档、打开DB、测试、build、stage或spawn。所有新增 fixtures、UI与compiled SDK/SQLite restart收据仍是未来要求，当前没有执行结果可借称 PASS。下一步由主控协调 KN/POL/GRP实际冻结接口与owner窗口后，另授权实施；KN-02仍 DESIGN ONLY，不能标 DONE。
