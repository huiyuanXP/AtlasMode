# Static CommonJS Safety and Captured Package Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Correct demonstrated CommonJS false bindings, expose verified stable Node module entries and preserve truthful local browsing/planning freshness.

**Architecture:** A pure AST registry validates Node-global identity, export stability and captured consumer mutations before accepting compiler declaration identity. A shared bounded metadata reader captures package scopes separately from source and tsconfig inputs; HTTP, MCP and UI consume the same immutable snapshot.

**Tech Stack:** Node24.19.0/npm11.9.0, TypeScript5.9.3, ts-morph27.0.2, current React/Fastify/SQLite/MCP/Playwright; no new dependencies.

**Spec:** docs/superpowers/specs/2026-10-03-static-commonjs-design.md

## Global Constraints

- Node 24.19.0、npm 11.9.0、Python >=3.10；现有 TypeScript 5.9.3、ts-morph 27.0.2；不新增依赖或改变 lockfile/vendor。
- 仅当前隔离 checkout 顺序 SDD；不 push/publish，不修改全局客户端配置。
- 只分析捕获字节和 AST；不执行目标代码、require、插件、脚本，不读取目标 node_modules、网络或真实 compiler filesystem。
- 包预算独立：262144 bytes/file、4194304 total bytes、512 files；配置原预算及16层边界保持。
- 相同 ignore/allowedPaths/root/symlink 边界；拒绝的最近配置/包 scope 不回退祖先；历史 SQLite、审批和函数 ID 不重写。
- 界面中文默认、英文适配；源码函数名、路径和用户文字保留；元数据不成为源码节点/计数。
- 动态或证据不足的调用明确 unresolved；静态 resolved 不等于运行时兼容或目标构建成功。
- 每任务独立审查；最后一次整体审查、唯一修复波次及唯一限定复审；已通过的检查只因改变/失败/具体疑点重跑。

## Review Focus

1. Lexically shadowed require/exports/module and overwritten exports must never acquire a checker-only resolved binding, including through ESM import; Task1 negative controls own this.
2. Captured namespace mutation/escape in one consumer must invalidate an affected property for another consumer, while one unsupported known property must preserve a different stable export; Task1 cross-consumer and property-isolation tests own this.
3. A rejected/invalid nearest package must block ancestor fallback; .mjs/type:module/no captured root scope must not fabricate Node globals; Task2 mode/sentinel tests own this.
4. Shared metadata reader refactoring must retain exact config budgets, selected-chain rejection, ignored/source availability and captured-byte input identity; Task2 existing capture/resolution regressions and new overlapping manifest tests own this.
5. Package-only refresh must stale plans/routes without rewriting IDs, history or approval; optional legacy metadata must render unrecorded in both languages, with HTTP/MCP parity; Task3 actual transport/SQLite/browser regressions own this.

---

### Task 1: Guard CommonJS bindings and expose the explicit .cjs stable subset

**Files:**
- Create: packages/indexer/src/commonjs.ts, packages/indexer/src/commonjs.test.ts
- Modify: packages/indexer/src/typescript.ts, packages/indexer/src/index.test.ts, docs/superpowers/contracts.md

**Interfaces:**
- Consumes: actual ts.TypeChecker, captured ts.SourceFile[] and existing ReadonlyMap<ts.Node,string> implementation IDs after declaration collection; configuration.configuredAlias(sourcePath,specifier).
- Produces: internal CommonJsMode = 'commonjs' | 'esm' | 'unknown'; ModuleModeProvider = (sourcePath:string)=>CommonJsMode.
- Internal createCommonJsAnalyzer(checker,sources,declarations,modeForPath?,configuredAlias?) returns {exportedDeclarationIds:ReadonlySet<string>, classifyCall(expression:ts.Expression):CommonJsCallClassification|undefined, moduleImports:readonly CommonJsModuleImport[]}.
- CommonJsCallClassification = {targetId?:string; externalName?:string; reason?:string}; undefined means ordinary existing call handling. Returned object means handled and must not fall through to checker-only targetFromSymbol. CommonJsModuleImport = {sourcePath:string; line:number; text:string; specifier:string; targetPath?:string; external:boolean; reason?:string}.
- indexTypeScript(files,graph,configurations=[],captureDiagnostics=[],modeForPath?) adds only an optional fifth INTERNAL parameter; no public IndexerPort/service/DB change. Default .cjs commonjs, .mjs esm, all other paths unknown. Task2 supplies provider.
- Verification updates existing graph.nodes exported flags using declaration IDs, without modifying names, qualifiedName or ID algorithms. Existing evidence path/line/text remains real source.

- [ ] **Step 1: Write and run meaningful RED.** Actual SourceIndexer fixtures for overwritten exports.help and shadowed require parameter must fail by falsely resolving the old helper before the change. Stable .cjs exports.help control must fail exported-entry expectation. Record command/output; author fixtures are never executed.
- [ ] **Step 2: Implement the registry.** Support unshadowed literal require with const namespace/destructured/direct-callable bindings and literal property selection, or direct require(...).name() calls. Support single top-level exports.name assignment to function/arrow/actual declaration or const callable, module.exports static object/function, and initial canonical exports=module.exports=function. Resolve only actual captured implementation AST IDs. Reject function/const callable identity after visible rewriting. Do not support var/let importer bindings, module.exports=require forwarding, recursive value propagation or package exports. No guessed name matching.
- [ ] **Step 3: Pin conservative negative controls.** Verify require/module/exports parameters/local/import shadowing; repeated/compound/delete/conditional property writes; computed unknown key/root replacement/mixed ambiguity/namespace escape; importer mutable/member mutations and a second consumer; absent/ESM modes; ambient/type-only/dynamic functions. Known unsupported property only rejects that property; whole identity uncertainty rejects the module. A real user function named require retains its ordinary direct callee identity, but its return supplies no Node namespace. ESM import of rejected CJS exports cannot bypass guards. Check literals' public checker SourceFile symbol only after lexical/mode checks. Relative/configured missing targets unresolved, unsupported bare dependencies external only under existing rules.
- [ ] **Step 4: Verify GREEN and integration.** Focused CommonJS tests, all affected indexer tests plus core graph/schema tests as warranted, indexer/core build/typecheck and root lint. Cover imports, exact path/line/ID/entry flags and existing ESM/TS config/Python/const identity regressions. No root full suite, browser or mature-target rerun in this task. If a scoped code unit must split, request controller decision first.
- [ ] **Step 5: Document and commit.** Record exact .cjs positive scope and other-mode uncertainty in contracts. Self-review diff, commit coherent safety change, report RED/GREEN, commands/counts, limitations and commit; await independent task review before Task2.

### Task 2: Capture package scopes and apply .js Node mode

**Files:**
- Create: packages/indexer/src/metadataRead.ts, packages/indexer/src/packageCapture.ts, packages/indexer/src/packageMode.ts, packages/indexer/src/packageCapture.test.ts, packages/indexer/src/packageMode.test.ts
- Modify: packages/indexer/src/configCapture.ts, packages/indexer/src/scan.ts, packages/indexer/src/index.ts, packages/core/src/model.ts, packages/core/src/validation.ts, packages/core/src/validation.test.ts, packages/indexer/src/index.test.ts, docs/superpowers/contracts.md

**Interfaces:**
- Consumes: Task1 ModuleModeProvider and fifth indexTypeScript argument; existing SourceFile={path:string;bytes:Buffer}, scanner eligible/opaque paths and config capture safety/budget rules.
- Produces: scan.manifests:SourceFile[] and optional coverage.packageFiles?:string[]; strict zod normalized repo paths, historical field omission accepted. Source files/count/nodes/availability remain separate.
- capturePackages consumes scanner-owned eligible/rejected package seeds and a shared cached bounded metadata reader; returns {files:SourceFile[]; diagnostics:CodeSnapshot['diagnostics']}. PACKAGE_MANIFEST_UNAVAILABLE: prefix + normalized diagnostic.filePath denotes opaque enumerated rejected package seed; no rejected bytes read. Internal exact reader option names may follow existing configCapture context, with unchanged security semantics and one path byte capture reused if already config extends input.
- createPackageModeProvider(manifests:readonly SourceFile[],captureDiagnostics=[]) returns ModuleModeProvider using nearest root-contained captured/opaque/invalid package; strict JSON and recognized type only. .cjs commonjs/.mjs esm independent of package availability, without a runtime load-success claim; .js known valid package type commonjs or absent type plus no source ESM syntax commonjs, type module esm, invalid/opaque/no root-contained scope unknown. JSX/TS require remain unknown. Provider can classify path/package only; analyzer additionally rejects .js ESM syntax. No ancestor root reads/workspace exports.
- source/config/package captured inputs use deterministic codemap-index-inputs-v3 typed path/byte length hash framing. Invalid captured package bytes affect hash; rejected-byte evidence influences facts/snapshot identity; old snapshots/approvals remain unchanged, declaration IDs unchanged.

- [ ] **Step 1: Write/run RED.** Package-only type edit must change capture contentHash and mode; packageFiles optional legacy parsing must work. Test strict JSON/type errors, valid nested scopes, no scope, ignored/rejected nearest with included source+valid ancestor, .cjs/.mjs overrides and .js ESM syntax. Existing product has no package capture, so record authentic failures.
- [ ] **Step 2: Implement shared bounded capture.** Extract config's existing read/stat/confinement handling to metadataRead without duplicating or weakening it. Capture ordinary allowed package.json seeds once, independent 262144/file,4194304total,512files budgets, deterministic ordering. Reuse bytes from configuration capture for overlapping package path; retained config16-depth and chain rejection do not change. Diagnose strict package parse without exposing outside bytes.
- [ ] **Step 3: Wire optional coverage/hash/mode.** Add internal capture.manifests and core optional schema; preserve package metadata/source separation and availability. Supply package mode to Task1 analyzer, support stable .js only with valid evidence and no ESM syntax; forbid checker fallback for rejected modes/exports. Add exact stable source ID checks across package edits.
- [ ] **Step 4: Run GREEN and affected checks.** Boundary tests include exact limit/overlimit, unreadable/nonregular/symlink/root escape sentinels, unchanged ignores, overlapping capture, invalid nearest no fallback and nearest recognized/unknown type. Run all configuration capture/resolution regressions plus affected indexer/core build/typecheck/root lint once on coherent final bytes; no browser/full root suite/mature target here.
- [ ] **Step 5: Commit/report.** Document captured package scope/hash upgrade/legacy limits, self-review, commit and report truthful evidence; await independent task gate before Task3.

### Task 3: Verify real product freshness, bilingual UI and pinned Express browsing

**Files:**
- Create: tests/integration/commonjs-resolution.test.ts, tests/e2e/commonjs.spec.ts, tests/support/commonjs.mjs
- Modify: apps/web/src/app/Navigation.tsx, apps/web/src/i18n/zh.ts, apps/web/src/i18n/en.ts, README.md, docs/environment.md, docs/validation-targets.md, docs/superpowers/readme-coverage.md, docs/superpowers/state.md

**Interfaces:**
- Consumes: existing actual compiled HTTP/MCP tools/store, Task1 guarded facts and Task2 coverage.packageFiles optional; no new endpoint/tool/approval channel.
- Produces: bilingual accessible navigation region exactly 包配置 / Package manifests with separate count/relative paths; missing field says unrecorded, recorded [] says zero. Source/authored names preserved. Existing snapshots and planning remain shared between transports.

- [ ] **Step 1: Write/run real lifecycle regression.** Compiled HTTP + actual SDK stdio with isolated fixture/store: open commonjs .js package, locate exported entry/helper and guarded unknowns, create/approve plan+route, change package.type only to module, refresh. Assert source bytes and declaration IDs stable, plan/route stale, history/approval immutable and HTTP/MCP function contexts agree. Actual persisted legacy snapshot omits packageFiles and remains readable. Record baseline GREEN if Task1/2 already implement backend rather than manufacture RED.
- [ ] **Step 2: Browser RED/GREEN.** Actual production browser entry→helper/source line, overwritten/shadowed unknown reason, Chinese/English captured and legacy package rendering. Deny nonloopback requests, check console/page errors and protocol stderr; capture and actually view screenshots. Add only missing rendering after genuine UI RED.
- [ ] **Step 3: Final integrated verification.** Run root build/typecheck/lint/test once on final combined source bytes. Run new integration/E2E once and existing planning E2E only because Navigation changed. Any focused repeats require changed source, failure or explicit unanswered risk. Record host Playwright color warning honestly; preserve NO_COLOR, no library/preload patch or filtering warnings.
- [ ] **Step 4: One pinned mature Node gate.** Express5.2.1 at dbac741a49a5a64336b70c06e85c2e2706e36336, /tmp/atlasmode-validation-express. Check full clean HEAD including untracked before/after. Actual product HTTP/browser/SDK/source browse canonical createApplication lib/express.js:37; explicit unsupported var/dynamic mixins remain unknown. Save unique express-commonjs-product artifact, not overwrite historical Vite/Flask. Never install target deps or execute scripts/upstream tests. Record truncation/unknowns/performance, not runtime compatibility.
- [ ] **Step 5: Freeze evidence/cleanup/commit.** View screenshots, source SHA manifest, target sentinel/nonexecution, owned-process/store cleanup. Update current claims and unrun native/client/CI/cloud restore limits, self-review, commit report, independent task gate; then controller whole-plan review with one combined fix wave/one scoped re-review only.

## Design and plan self-review

Whole plan starts at closed ec1e375. Task1 independently repairs known false facts before optional metadata expansion. Task2 consumes its exact provider/interface and preserves all config safety. Task3 consumes only shared snapshot fields/facts and owns actual public/legacy/offline evidence. Five Review Focus cases have explicit owning regressions. Default mode conservative; static forwarding unsupported, no recursive value-flow subsystem. Shared reader refactor has bounded file scope; no public Port/table changes. Sequential source ownership avoids overlap. User unattended exception applies; design/plan self-review completed, independent task and final code reviews still mandatory. No additional spec reviewer dispatched.
