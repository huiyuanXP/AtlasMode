# IDX-01 验收（2026-10-10 UTC）
结果：限定静态模型内修复完成，待主控集成/提交。完整固定 Express 严格入口从历史 FAIL 恢复为本轮 PASS；历史记录未改写。

修复：packages/indexer/src/commonjs.ts 新增深层/动态属性 provenance 和 namedExportsInvalid。已知首键的深层写入保留默认 callable，失效整个已证 forwarding 组全部命名导出；首层动态键、根 namespace 逃逸、循环/不合法转发仍保守整组失效。叶模块自身深层写入同样处理。未加入深层调用或值流解析。

独立设计/计划：../../specs/2026-10-10-idx01-design.md、../../plans/2026-10-10-idx01.md，已自审。独立审查见 independent-review.md：无新增 Critical/Important；设计正文冲突 Minor 已统一。

验收证据：
- 原始 red.log：17项中11行为失败/6通过，包含丢失根入口与原先 self 写入错误连边。
- green.log：17/17通过。indexer-tests.log：349/349，8文件，0失败/跳过。
- build.log、typecheck.log、lint.log、final-lint.log：定向 indexer build/typecheck 与源/测试/helper lint 退出0。主控统一执行全仓门禁，本报告不冒充根全量结果。
- express-gate-final.log、idx01-express-product.json、idx01-express-product.png：实际编译 API/web、SDK stdio MCP、Chromium UI 打开完整目标/搜索/源码/展开。PNG已在本机实际打开核对，createApplication卡片、lib/express.js:36路径与源码可读。
- express-safety-audit.json/log：公开 SourceIndexer 重新捕获完整目标；16条合法 incoming 均逐条对应真实 const express = require('../.'); 与 express() 源行；5条 outgoing 保持未知；test/exports.js 包含 .foo 的11条调用表达式全部未知且无target；叶模块唯一导出函数为createApplication。负例无新增错误连边。

完整目标：公开 origin https://github.com/expressjs/express.git；/tmp/atlasmode-idx01-express；完整 SHA dbac741a49a5a64336b70c06e85c2e2706e36336（5.2.1）。旧 /tmp/atlasmode-validation-express 缺失，本轮重新 clone/check out。捕获前后 HEAD固定且 staged/untracked均干净；未安装依赖、执行目标源码/scripts/测试；未排除test目录。
实际完整支持源142文件、42文件夹、3070函数、15216关系；35/35入口未截断，真实 createApplication ID含在返回列表且 exported=true。完整source正文与全部context分页保存在产品JSON：16 incoming、5 outgoing、truncated=false。budget1截断规则仍真；一跳26节点/99关系未截断。errors、external requests、protocolErrors为空。

重现：
    export PATH=/home/agent/.local/bin:$PATH
    npm run build -w @codemap/indexer
    node tests/support/idx01-validate.mjs --path /tmp/atlasmode-idx01-express --commit dbac741a49a5a64336b70c06e85c2e2706e36336 --symbol createApplication --file lib/express.js --label idx01-express --require-entry
    node tests/support/idx01-audit.mjs

本轮失败保留：
1. express-gate.log：历史 /usr/bin/chromium 不存在，启动失败，随后使用VM既有 Playwright Chromium，无软件安装。
2. express-gate-browser.log + idx01-ui-selector-failure-product.json/png：新UI候选入口折叠，旧泛用selector最后命中隐藏列表；独立helper限定compact-search后通过。没有改产品来弱化验收。
3. express-safety-audit-first.log：helper预期 '../'，真实fixed source为 '../.'；按真实literal校正后全16条通过。
2026-10-03历史FAIL/泛用PASS及当时缺PNG的说明仍保留在既有validation-targets与Task2报告；没有补造当时证据。

边界：深层写入使全部命名导出出现保守假阴性，未扩大mixin、prototype方法、任意值流、named-property escape或运行时兼容性保证。未运行上游测试、三OS新CI、外部客户端、部署或全仓根门禁。不是对完整项目动态执行语义的全程序证明。普通直接known-property write仍只拒绝触及属性。目标源码和DB不提交，凭证不含秘密。

neat-freak作用域交接：
- 代码：changed-and-verified（本票indexer、定向349、build/type/lint）。
- 运行态：changed-and-verified（独立DB/随机端口完整Express真实产品gate，结束已停止自己创建的服务）。
- 文档：changed-and-verified（本票独立设计/计划/报告）；README/state/ticket汇总pending由主控统一集成。
- 规则：verified-current（AGENTS/Superpowers已读，既有AGENTS修改保留）；不扩大规则文件写入。
- 记忆：out-of-scope/generated-read-only，未读写session或其他Agent记忆。
- 工作区：pending主控提交；目标/tmp checkout和复核PNG现场保留，未做破坏性清场。无新依赖、lockfile改动、生产部署、merge/forcepush。

阶段收据：receipt.json 固定本票source/dist/evidence SHA256。以上349/入口gate属于主控SEC清理 fast-glob/concurrently 与锁文件变更前阶段，未冒充锁变更后重跑；后阶段scoped/root/CI由主控协调。记录HEAD为交接观测，并非测试时所有产品代码的commit承诺。
