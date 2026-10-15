# DIFF-01 只读设计依据与交付边界

2026-10-10；作者 `/root/grp01_design/grp01_implement`，明确 `gpt-6.1-sol high`。VM2 `/home/agent/projects/AtlasMode`，参考 HEAD `8c305ae5fd68118f53d16e544e8b5f5dc81bfab5`。这是 source 参考点而非已冻结 DIFF 产品；checkout 可含其它 owner 的候选。下面18个产品文件在初次 SHA 记录与文档自审结束时记录一致。本作者只读它们；未运行目标源码、test/build/数据库、index/stage/commit/spawn。

## 授权与 workflow

主控授权既有 DIFF-01 的 spec/plan/专属readonly SHA依据。读实际 AGENTS、using-superpowers/codex-tools、brainstorming、writing-plans、当前 README/state 有关产品/包边界/unknown 与未完成范围；在既有自主执行例外下写设计/计划，不重复要求用户授权例行选择。当前授权仍不含任何产品实施，独立 high 设计审查由另一作者随后做，本自审不替代它。

只新增：

- `docs/superpowers/specs/2026-10-10-diff01-design.md`
- `docs/superpowers/plans/2026-10-10-diff01.md`
- `docs/superpowers/reviews/diff01-2026-10-10/readonly-design-basis.md`

本地同字节副本在 ROG task-3。没有改全局 docs/ticket/state/README、已有 IDX04 spec/plan/report、shared source 或 DB。文档 hash在交付消息给出；本依据不把自身 hash嵌入自身。

## 实际源码读到的限制

- model保存 immutable snapshot事实/coverage/整体hash，没有历史完整source bytes/单文件configdigests；storage.generic get/list无boundedreader，不能承诺用了它们就实现早期预算拒绝。
- Graph node身份含path/qualifiedName/declarationKind，relation身份含line/顺序；getFunctionContext只当前direct calls分页。DIFF统计site/caller不能机械用relationID变动判断调用方减少。
- SourceIndexer以scanner captured bytes与facts fingerprint构造snapshot；scan现source/configuration/package输入hash保持captured-v3。新manifest仅需已有buffers rawdigest，不增加读取/执行目标。
- Workspace storeSnapshot不覆写已有snapshot；verifyPlan通过structure队列刷新当前，再读取服务端历史approved plan/baseline做verify。DIFF必须是独立readonly query，禁止借其refresh或改变authorization。
- VerificationPanel现只展示历史批准revision核对items。新diff独立no-plan入口/状态，不将结果塞现有verification report，不覆盖FS/KN/GRP的受控草稿。
- IDX04仅设计APPROVE，normalizer/ledger/publicexports/boundedbaseline metadata尚待实施。本设计列出明确依赖接口，不假定src已有它们。

## Ticket / IDX04 依据 SHA256

```text
3bbff5db6580647ea16d2befb0c62af0e14dcff7247011ef03a787e426c989f2  docs/tickets/DIFF-01.md
439750c81287069a7c48b0f61d03f1275fec365780a59a5149389239ed86ba32  docs/superpowers/specs/2026-10-10-idx04-design.md
d6f058cad14305ac7b6568c3cba45c08c2ba86fd1e926fa950fa78d813bb6794  docs/superpowers/plans/2026-10-10-idx04.md
d5169d67045ce1721b8cfba30b63a08b765030f4f86d81ca44f62256c936d435  docs/superpowers/reviews/idx04-2026-10-10/independent-design-review.md
5b271717880838a5c9507a952413461222db6807439ff12dfb4fa8af4ee80205  docs/superpowers/reviews/idx04-2026-10-10/M1-repair-receipt.md
```

IDX04原review APPROVE C0/I0/M1；M1仅server计划test路径修复且原bytes/report保留。本轮不复审IDX04产品、不宣称已有candidate/accept成功。

## 产品参考 SHA256（两次读取一致）

```text
a61d1e3fa7fa33b4c50e3416c8c0e82e0f28fb82d8649f30774cdba219ab8abf  packages/core/src/model.ts
b31bc79d37d2fd0cc7ffaff8f5ae2fb3fb6adf5e7caa98e2d8913ca6a7374874  packages/core/src/validation.ts
4de37d4b8a217a97e507c605237803e87eb7a5a51925895fe9506ba9e8c5525e  packages/core/src/queries.ts
b3b67aefdec1569375deda0fa21b72ac060b2bad21330bd32d983e450efb7a36  packages/indexer/src/index.ts
e5f1526e10c88fb8ae6c69ca69cf86ddfbd902d60185d53e31a59d9778aa2a6f  packages/indexer/src/scan.ts
2705b340bbb9cec95a60bf88f0abaece0bd89a92b8e32691353c5c10e8c4bd4a  packages/indexer/src/graph.ts
b3a9f0da90de2b99fc9bdab3c086a3eab08c27081f3b2260b1aed7afd702cc3b  packages/service/src/workspace.ts
715538ce543856e26ed27532cb71c9316dc19024d5a68d460405dd8d691c9a55  packages/service/src/verification.ts
3aef48bfd53d62cfe93fe576d7d46b7bb9e4c84ce5a95d30ce6cc399284f44db  packages/storage/src/sqlite.ts
3d02ef217ca51eb9a4b0072a8e24ff89ff70a1337e856af45c916f62266f19a1  apps/server/src/routes.ts
8f6ef62561d355bfcb7df9838a9a52de0108096c0c352efd830d0d604fe2e70e  apps/server/src/queries.ts
2039168ec634179df6350c3f083adf4bd6640338ba09b8c78799004317f59b04  apps/mcp/src/server.ts
2cd1ab609c38c8e10099191be4a78a478016739d988da1b45f7b100f941752ea  apps/mcp/src/client.ts
d5bbe93903474b85cb70e314fbbe610f8c04071095dc0e1ff0c0740fef66bd29  apps/web/src/api/client.ts
5aa35e02cba84d67afb7d3e455226c35887a218c2722981ed047108966fbc871  apps/web/src/app/WorkspacePanels.tsx
af89d4f826340b12cf383c6593832be1102e6bec85cb61fb58df1b6be374d75e  apps/web/src/app/Navigation.tsx
63130c58c958c4e557feea65d0118018db49a8d04d3fd37e865b0e96e715fd39  apps/web/src/app/workspace.ts
1811a55b169052352f1134ab93a6702c4983d654c4b30f90302fa5b119a527e2  apps/web/src/features/verification/VerificationPanel.tsx
```

未声称源码清单覆盖整个repo，未把其他候选状态作为DIFF freeze。

## 自审与 remaining

Spec A1–A8映射Plan Task1–6，五个ReviewFocus负例各有任务；strictmapping/legacyunknown/caller-site/配置manifest/current-history/no-writes/预算与真实gate均已明确。需要主控确认两个最小接点（optionalmanifest和boundedpairreader），与IDX04协调acceptedprojection/boundedbaselinemetadata，再独立high审查完整spec/plan。所有产品任务未执行。新HTTP/MCP/UI真实可见动作、源字节/批准历史不变性、restart/scopedtests/compiledroot门为future requirements，不是本轮PASS。
