# POL-01 独立验收候选冻结（尚非整票 DONE）

作者模型沿用明确授权 gpt-6.1-sol / high。只新增三份 test/helper；未修改产品源码、旧测试断言、shared Workspace/Navigation/client/Panels/i18n；未 build、stage/commit、访问真实用户文件/DB、spawn agent 或创建 tunnel。

## 已执行及版本边界

- `source-run-3.txt`：真实源代码 API entrypoint 子进程 + 实际 SQLite/FileStore + 实际 SDK stdio MCP entrypoint，3 PASS，Vitest 原日志 Start 19:06:42、耗时 11.68s。不是 HTTP mock、InMemoryTransport 或 mounted UI。
- 覆盖真实 v1 中文 purpose / root、folder、rule 未知字段、allowed/forbidden 保留；DB-only 同 id 编辑 A 不改文件，显式 preview/import 只发送 A，local B 仍 dirty；旧 DB-only row 消失，文件/API projection 保留 A；import 当前批准 HTTP409、Plan revision 仅 +1、历史 approval 逐值保持。
- 真实 HTTP409：原 CAS 被拒绝、输入和 capture 保留、重复 save 没有第二次 HTTP 写；显式 read 后原草稿仍在，用户再次保存成功。未偷偷获取 latest CAS 重发。
- 真实 SDK stdio：18 个原工具不变，外部合法文件编辑后的 direct get_approved_plan 拒绝 NOT_APPROVED；get_folder_policies 返回新 metadata 和新 purpose。非法 schema 被 quarantine，关闭/重启实际 API 后仍 invalid、原 malformed bytes 不变、SQLite 历史 approval 保持；显式修复 owned 文件后 read ready。
- 所有实际执行的 source fixture 验证目标源文件 SHA 不变、TARGET_EXECUTED 不存在。source API 启动消息显示已有 web assets，但测试没有访问或执行那些 assets，不能因此称 production UI PASS。
- PASS 后只做两个明确的测试层调整：helper 的 env 类型声明修正（擦除后运行行为不变）；主控授权 integration fixture() 增加 POL01_ACCEPTANCE_MODE=compiled 单行选择（默认 source 行为不变）。此前 test bytes 已保留在 pre-mode-selector/。compiled 分支 **UNRUN**，未将历史 PASS 冒称当前完整 compiled 冻结通过。浏览器文件最后仅 Prettier 格式化，其旧 bytes 与格式失败日志仍在。

## 历史和失败原件

before/ 完整保存原 UI window + UI repair evidence 及两个独立审查报告，共136文件。原 37 + 新14 = 51 证明仍仅 controller/SSR/transport/SDK owned mock HTTP。APPROVE report SHA：36a9bdb043441662c47bd4abc69360172d35d2938efea5b341308a34fde15a69。原九源与既有 manifest 均核相同。

first-source-run.txt：3 setup FAIL，夹具误用不存在的 storage.save；实际 public put 修复。source-run-2.txt：2 PASS / 1 FAIL，测试误期望迁移后仍有 DB-only row；改成更严格的 exact row 缺失 + file/API projection 保留 + 历史批准/单次 invalidation 断言后3 PASS。这两个是新夹具/测试期望错误，不能作为产品 RED 宣传。types-first.txt 保留 env property 类型 FAIL；types-final.txt、types-mode-final.txt exit0。lint-first/final.txt exit0。format-final.txt 首次 FAIL 和 format-write.txt 保留，format-second.txt PASS。runtime-initial-empty-parser.json 保留首次 ANSI 前缀解析错误的空数组；最终解析要求 exact 6 receipts/12 PIDs，不用空集合冒充清理成功。

## 在途依赖与未运行 UI

backend-baseline.sha256 在新测试前捕获58个源依赖；backend-baseline-check.json 显示55/58相同，PERF B 获授权改变 queries.ts / routes.ts / core/index.ts。主控要求不追在途代码重复测试。因此本次3 PASS是上述执行时 source 阶段结果，不是稳定全仓最终候选。本 agent 没有改这3依赖。

current-dist-baseline.sha256 只读记录181个当前 compiled 文件。默认 Playwright --list 实际 FAIL：旧 compiled @codemap/storage 无 StructureFileStore export（browser-discovery.txt）。使用 source aliases --tsconfig --list 只发现2个定义（browser-source-discovery.txt），没有 launch browser / API / MCP。这不能作为 compiled PASS。

两个真实原生浏览器候选有显式 POL01_PRODUCTION_GATE=1 gate，当前全部 **UNRUN**：native policy edit/preview/import 保 unsent input、实际 HTTP409 与 explicit read/save、unknown 字段保留、可见 native commands、截图；native quarantine 写禁用/诊断和 owned 实际 restart 保 invalid bytes。无 page.route HTTP mock、DOM injection 或假 mounted callback。实际挂载在 Navigation.tsx，不是 WorkspacePanels；全局 accepted callbacks 尚待主控串行共享窗口。

## 实际命令与未来受控执行

本轮 source 实际执行命令：

```sh
./node_modules/.bin/vitest run --config /tmp/atlasmode-pol01-ui-vitest.config.mjs tests/integration/pol01-stdio-acceptance.test.ts
./node_modules/.bin/tsc -p docs/reviews/pol01/production-acceptance/source-tsconfig.json
./node_modules/.bin/eslint tests/support/pol01-acceptance.ts tests/integration/pol01-stdio-acceptance.test.ts tests/e2e/pol01-structure.spec.ts
./node_modules/.bin/playwright test tests/e2e/pol01-structure.spec.ts --list
./node_modules/.bin/playwright test tests/e2e/pol01-structure.spec.ts --tsconfig docs/reviews/pol01/production-acceptance/source-tsconfig.json --list
```

前一次37/106摘要误写 pnpm 命令的纠正原文已在 before/ui-mcp-window/historical-command-correction.md 封存；本轮直接使用现役 node_modules CLI，没有安装 pnpm/biome，也不把重建摘要当历史 shell 逐字记录。

source-vitest.config.mjs 保存本次实际 /tmp config 原字节；未来可复现而无需依赖临时配置。

由 root 在 mounted callbacks/源审查/compiled 候选冻结后执行（以下 **未执行**）：

```sh
POL01_ACCEPTANCE_MODE=compiled ./node_modules/.bin/vitest run --config docs/reviews/pol01/production-acceptance/source-vitest.config.mjs tests/integration/pol01-stdio-acceptance.test.ts
POL01_PRODUCTION_GATE=1 ./node_modules/.bin/playwright test tests/e2e/pol01-structure.spec.ts
```

第一条 Vitest source aliases 用于 owned fixture seed 和控制器测试，实际 HTTP API 与 SDK stdio 子进程由 mode 选择直接 node apps/server/dist/index.js / apps/mcp/dist/index.js；没有 tsx 加载 compiled 子进程。第二条由真实 built assets 原生 UI 执行。当前旧 dist baseline不能冒充未来候选；root须记录实际稳定 candidate 来源。

## Runtime 收口及交付

source-run-2 + source-run-3 合计10个 owned API子进程 exit[0,null]，10端口关闭；2个 owned MCP SDKstdio子进程 client.close 后 PID absent。runtime-final-check.json 二次实测12 PID全部 ESRCH、10端口全部 ECONNREFUSED（111）。没有 tunnel。9个新 synthetic root/source/SQLite/logs保留，并完整复制到 owned-fixtures/；前3 seed失败没有启动 API child，seed连接在 finally关闭，Vitest CLI已退出。没有删除 frozen source / 原日志 / 他人实例。

freeze.sha256 + frozen-source/ 包含仅3新路径的 exact bytes。不修改旧 planning E2E / 428 断言；主控旧候选遗漏新9 UI造成的已证失败由主控原日志保存，不在本 agent 窗口弱化。POL-01 仍 PARTIAL，阻塞为全局 callbacks、稳定 compiled source/stdin/browser 实际一次性门禁。
