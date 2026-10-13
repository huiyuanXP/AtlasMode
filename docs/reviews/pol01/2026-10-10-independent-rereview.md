# POL-01 限定独立复审

2026-10-10 UTC；范围仅原 I1/I2/M1/M2 的设计修订，不重新审全票，不运行产品测试。结论：**APPROVED，原四项均在设计层关闭；本次 C0/I0/M0。** 可进入计划实施，仍须按主任务协调共享文件冻结窗口及产品 A1–A7 验收。

原结论仍为 Issues Found / C0/I2/M2；未修改历史报告。当地留存 `pol01-independent-review.md` 与 VM2 `docs/reviews/pol01/2026-10-10-independent-design-review.md` SHA-256 同为 `300b9a1310e46102fb10fc2154a4ac6f5b71f15668bf5163bb067ef63ee3195e`，复制内容一致。

| 原问题 | 限定复审结论及精确证据 |
| --- | --- |
| I1 DB-only 同 id 编辑造成遗留冲突 | 关闭。spec66/68明确迁移前受控编辑原 DB，检查结构状态及revision/digest，文件bytes不变，无同id extension/隐式迁移；显式迁移finalize仅移除对应DB清单，before失败保留，after恢复仅一次删除。spec105补齐等值extension迁移的无文件发布单事务来源切换，避免before==after恢复歧义。plan86/88–91及102/103/106/116给旧编辑→preview迁移→extension继续编辑→实际重启及failure分支测试。 |
| I2 等价迁移失效与完整文档摘要冲突 | 关闭。spec90/98统一semanticDigest只表示完整document；文件语义变化、DB-only编辑、非空实际迁移三触发取逻辑或，plan仅+1，历史不改；等值extension已存在也因来源迁移失效，零条migration no-op。spec105及plan91要求无file rewrite的等值迁移单同步finalize；plan88/89/91以history deepEqual、重试幂等和migration失效测试落实。没有新增去来源差异摘要。 |
| M1 批准/pending写交错 | 关闭。spec88/92/100增加readApprovedPlan用例，真实索引→结构恢复检查→approve提交/有效读取同一项目队列任务，禁止释放queue再approve/read。plan86/89/92/102/105规定内部lock-held helper、单用例HTTP/MCP入口与prepared、published-pre-finalize两个可控Promise barrier，assert尚未settled，最终旧revision409或未恢复pending503，不返回有效旧批准。 |
| M2 候选摘要与实际摘要混淆 | 关闭。spec114及A5/spec138明确beforeDigest、attemptedAfterDigest、observedAfterDigest、observedAfterKnown；A/B/C分别记录，无读取结果不冒充missing，failed/conflicted无committedAt；legacy_db带policy摘要且文件保持。plan84/89/91有A→B候选被外部C冲突的逐项确定性断言，terminal audit无全文。 |

`docs/reviews/pol01/2026-10-10-design-repair.md:5,9–16`如实保留原结论、区分设计者自审与独立复审，并映射上述四项和未来验证。scope保留unknown roundtrip、legacy保护、单服务写者、真实external TOCTOU、无await SQLite事务与POL-02边界（spec118–122/142）。

复审观察的 VM2 HEAD：`7528f78302275acb11cb9a23b49cb284d2a7fd9f`。文件快照SHA-256：

- spec：`07d3e2ab7428ef1c75e99520c725394706734e0eb8d827bbb02a02bfb9835c22`
- plan：`09770f489a00d2e440ce8ed2981dc42edf96183342c00da79f54e6c9b8ef7b7e`
- design-repair：`7507130644051bd0f833653bed2ae9a758cf7f40cd25ca34a6a61d283c852168`

仅做只读SSH读取、文档逐项核对、原报告摘要比对。未改产品或远端文档，未运行root gates/付费模型/构建，未碰共享dist，未commit/push/deploy/merge/权限/keys/sessions。产品实现与验收仍 pending，不能把本设计APPROVED称为产品已通过。
