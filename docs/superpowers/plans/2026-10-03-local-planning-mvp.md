# AtlasMode Local Planning MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a locally runnable code browsing/planning tool for TS/JS/Python, with persistence and an actual stdio MCP bridge, and validate it on real projects.

**Architecture:** npm workspaces with core contracts, indexer/storage ports, one service layer, Fastify HTTP/static server, React Flow web app and stdio MCP HTTP adapter. Per-project state and immutable fact snapshots remain distinct from revisions, knowledge and layout.

**Tech Stack:** Node 24 LTS, TypeScript, npm, React Flow, Fastify, Zod, ts-morph, Python AST, SQLite, Vitest, Playwright, stable MCP SDK.

**Spec:** `docs/superpowers/specs/2026-10-03-local-planning-mvp-design.md`
**Interfaces:** `docs/superpowers/contracts.md` (read as the common contract, not the rest of the plan).

## Global Constraints

- Windows、macOS、Linux 均需适配，其中 Windows/macOS 优先。
- 交付形式已选定本地浏览器应用。
- MCP 连接示例覆盖 Codex App/CLI 与 Claude Code。安装后核心可离线使用。
- 默认从代码实际暴露的入口逐步浏览，保留目录/文件上下文。
- 核心实体、纯函数、ports、service 方法与 HTTP 路径遵守 contracts.md；变更通知 controller。
- core 无 I/O；service 仅依赖 core ports；MCP/UI 不访问 SQLite/indexer 实现。
- 拥有明确开始执行授权，选未答细节的稳定方案；不用逐阶段等待人工审批。
- 用户未授权远端共享分支 push、发布或删除本地工作；正常本地阶段 commit 已授权。
- 使用当前 checkout，不创建 Git worktree；不得更改 vendored Superpowers 技能。
- 有行为变化必须 TDD，实际记录失败/通过；未运行的平台不能宣称通过。

## Review Focus

- 项目切换时旧请求/布局/规划写到新项目：T3/T5 添加隔离测试。
- 文件路径、编码、符号链接及 Windows 分隔符：T1/T2/T3/T4 覆盖读取与索引范围。
- Python 解析目标程序顶层有副作用：T2 确保只 AST parse，目标代码永不执行。
- 刷新索引、语义编辑与批准历史相互覆盖：T3 验证 stale 与历史核对。
- 浏览预算/动态调用丢失数据但 UI 报完整：T2/T4/T5 返回诊断、unknown、truncated 并展示。

## Task 1: Toolchain and pure domain contracts (T01)

**Files:** root package.json/package-lock.json/.node-version/.gitignore/tsconfig.base.json/eslint.config.mjs/vitest.config.ts;
`scripts/workspaces.mjs`; workspace package manifests/tsconfig; `packages/core/src/{index,model,validation}.ts` and colocated tests; `.codemap/structure.json`.

**Interfaces:** Produce ALL core types/ports, DomainError, schemas and pure functions named in contracts.md. Core public entry is index.ts. Workspace names @codemap/core,indexer,storage,service,server,web,mcp with version 0.1.0 and local version links.

- [ ] Write tests first for stable makeId, normalizeRepoPath, plan endpoint/path validation, recursion allowed, semanticContent layout/time independent, route invalid endpoint/call_chain evidence.
- [ ] Run core Vitest suite and record expected missing-implementation failure.
- [ ] Install exact compatible stable dependencies once, root frozen-compatible lockfile, npm cache under writable cloud path without committing a /tmp npm config. Use Node 24.19.0/npm 11.9.0 pins; Python minimum 3.10 in docs.
- [ ] Implement model/schema/validation without Node/browser/framework I/O. Reject unexpected approved fields in boundary schemas.
- [ ] Root scripts: dev, build, start, typecheck, lint, test, test:e2e, mcp; build packages in dependency order, never depend on alphabetical workspace order. Product launch scripts cross-platform. Target core checks now; full build only after later tasks provide modules.
- [ ] Run `npm test -- packages/core` and `npm run build -w @codemap/core`, lint affected code. Commit coherent T01.

## Task 2: Real TS/JS/Python source indexer (T02)

**Files:** `packages/indexer/src/{index,scan,typescript,python}.ts`, `packages/indexer/python/index.py`, colocated tests; `fixtures/typescript/`, `fixtures/python/`.
**Interfaces:** Consume core. Produce `SourceIndexer.index(rootPath,projectId):Promise<CodeSnapshot>`; Python script stays packaged and locatable from built dist.

- [ ] Write fixtures/tests: renamed import, re-export, named arrows/classes, JS/JSX/TSX, relative Python package imports/self method, unknown dynamic call; stable IDs after blank line; files outside root excluded; Python file with side-effect sentinel never executes.
- [ ] Run indexer tests and observe missing implementation failures.
- [ ] Implement scanning with fast-glob/ignore, explicit file exclusions and symlink containment, deterministic contentHash. Use TypeScript symbol/declaration identities, not function-name matching across unrelated scopes.
- [ ] Python subprocess detection accepts CODEMAP_PYTHON, python3/python/Windows py; parse AST without importing target. Missing Python produces honest actionable behavior. Python and TS calls never fabricated across languages.
- [ ] Record coverage paths, diagnostics, external dependencies and unknown calls, stable qualified IDs without line numbers. Detect Git revision read-only where present.
- [ ] Run targeted tests/build, ensure declared methods/ports match; commit T02.

## Task 3: SQLite and service lifecycle (T03)

**Files:** `packages/storage/src/{index,sqlite}.ts`, `packages/storage/migrations/001-records.sql`;
`packages/service/src/{index,workspace,planning,verification,knowledge}.ts`; colocated tests.
Real-adapter lifecycle tests may live in `tests/integration/workspace-lifecycle.test.ts`,
so service production imports stay limited to core while integration tests assemble indexer/storage.
Necessary shared dependency fix: `packages/indexer/src/index.ts` and `index.test.ts` snapshot identity.
**Interfaces:** Implement SqliteStorage and WorkspaceService ALL methods in contracts.md. SQLite records by kind/id, migrations tracked, sync transactions. Service must only import @codemap/core.

- [ ] Failing tests with actual temporary SQLite/indexer: open two projects, isolate records; plan revision conflict; approve/revise/layout; refresh changed content invalidates approval; historic approval remains available for verification.
- [ ] Include no approval forgery, repeatable migration, reopen DB retains routes/plans/views, target source read traversal and symlink refusal; group members/project IDs and directory policy checks.
- [ ] Prove unchanged bytes with changed Python capability cannot share a snapshot ID or overwrite immutable baseline facts; source contentHash stays byte-only, snapshot ID includes deterministic analysis output, normal identical refresh remains stable.
- [ ] Implement transactional approval semantic SHA-256 and approved revision history; use immutable snapshot baseline, no approval write through draft input.
- [ ] Implement route validation, views, groups and policies; verify exact add/move/remove/call/annotation operations, unresolved and ambiguous evidence as unknown. Do not mark annotation semantics satisfied merely for existing target.
- [ ] Test actual fixture update from A call to B call: expected B satisfied, deliberate bypass unmet; file source readonly. Test exports JSON/Markdown include approved revision/hash and clear current validity.
- [ ] Run storage/service suites and builds; commit T03.

## Task 4: HTTP and runnable local server (T04)

**Files:** `apps/server/src/{index,server,routes,queries}.ts`, colocated integration tests;
`packages/core/src/queries.ts` and colocated pure query tests/public exports; `scripts/dev.mjs`.
Necessary startup hooks/manifests: root package.json, server package.json, root package-lock.json.
**Interfaces:** createServer service factory and every HTTP endpoint in contracts.md; root start production entry. Entry overview and graph response independent from UI. Pure search/context/subgraph algorithms and response types belong in core; server queries are transport/service glue only.

- [ ] Failing Fastify inject tests with real service: project open/switch, search pagination, budget capped subgraph, bad input, path traversal, source, conflicts, plan lifecycle and unknown API 404.
- [ ] Implement Zod validation, error mapping, loopback-only default, project context and pure core query helpers, static build assets plus SPA fallback without swallowing /api errors. Paginate context edges and bound both subgraph nodes and relations; expose clipping explicitly.
- [ ] Handle absolute project path in UI/API with per-project roots. Overview prioritizes evidenced exported function candidates; don't call arbitrary zero-indegree functions confirmed public entrypoints.
- [ ] Real process smoke: GET health, open/index fixture, fetch snapshot/function/source. Graceful stop SQLite/child processes. Cross-platform dev launcher supervises web/server and exits on failures.
- [ ] Run server suite, dependency-ordered build; commit T04.

## Task 5: Real code canvas and planning UI (T05)

**Files:** `apps/web/{index.html,vite.config.ts,src/app/,src/api/,src/features/graph/,src/features/planning/,src/features/routes/,src/styles/}`; web behavior tests.
**Interfaces:** Only core + HTTP endpoints; React Flow state is ViewState projection, not domain authority. Chinese UI initially, symbols/paths verbatim.

- [ ] Study actual public React Flow/tldraw demos through available browser/screenshots; record source inspiration. Use compact left navigation, middle canvas and right inspector, light/dark controls and system fonts offline.
- [ ] Failing behavior tests for safe graph projection: facts cannot be overwritten; new planned IDs and edges render separately; switch clears old project selections and late responses cannot clobber new project.
- [ ] Implement project path input/switch, persisted selection, clear errors/loading, entrypoint navigation, search, file/folder context, limited expansion and unresolved/truncated indicators; function source readonly inspector and copy location.
- [ ] Implement draft create/edit/add function/file, add/reconnect/remove planning edges, delete temporary node, annotations, validate, confirm revision, export, stale refresh and structure report. Persist layout independently; support fact/plan/both filters.
- [ ] Implement routes choice, ordered steps, focus/prev/next and stale indication. Never fabricate route data as code facts. Controls must be reachable with names for browser tests.
- [ ] Build web, run projection/UI tests and actual startup functional request; commit T05.

## Task 6: Actual stdio MCP bridge (T06)

**Files:** `apps/mcp/src/{index,server,client}.ts`; real SDK client integration tests; `docs/mcp.md`.
**Interfaces:** createMcpServer(apiUrl), only HTTP + core. Tools: list_projects, get_project_summary, search_functions, get_function_context, get_subgraph, propose_route/get_routes, propose_plan/update_plan/validate_plan/get_approved_plan, refresh_index, verify_implementation, propose_group/get_groups/get_folder_policies.

- [ ] Read stable official SDK API/examples from installed package; pin one major. Write failing real stdio client test against spawned local HTTP server, not a mocked MCP facade.
- [ ] Implement schema-validated tools with pagination/budgets and honest errors; return snapshot/revision/validity. No approve tool, logs stderr only; async transport failures terminate cleanly.
- [ ] Let a newly connected client discover opened projects with paged list_projects instead of guessing the browser's active project. Explicit projectId binds subsequent queries. propose_group creates a validated new group with server-bound source:'agent', reusing existing HTTP group service; no new database path.
- [ ] Test UI/API approval yields same revision/hash via MCP; updates invalid approval; submitted routes visible via HTTP; reconnect after service restart reads retained data.
- [ ] Document absolute Node entry and CODEMAP_API_URL examples for Codex CLI/App and Claude Code; use no npm banner in stdout; no API key needed.
- [ ] Run actual SDK integration and build; commit T06.

## Task 7: Remaining questionnaire features (T07)

**Files:** `apps/web/src/i18n/`, `features/groups/`, `features/structure/`, `features/planning/history.ts`; related service/core fixes and tests where necessary.
**Interfaces:** Existing group/policy/view HTTP; schema-language-neutral source nodes. Pure layout/history client projection.

- [ ] Write tests for undo/redo committed revision handling, project-isolated history, two groups with shared members (no source movement), directory forbidden dependency validation, Chinese/English translation coverage.
- [ ] Implement locale switch (zh/en), theme persistence, functional groups multi-selection/create/list, directory responsibility and forbidden-dependency UI.
- [ ] Undo/redo updates semantic revision via expectedRevision, disallows editing a protected fact in place; layout remains separate. Persist annotations without deleting on lost binding.
- [ ] Accepted edits and undo/redo refresh selected temporary-node name/path/signature in the inspector and copied location (T05 deferred M1); retain missing-target annotations with a visible lost-binding state.
- [ ] Changing directory responsibility or constraints requires renewed confirmation, even if no forbidden edge currently exists. Preserve historical approval for verification; discuss any narrow shared-contract extension with controller before implementation.
- [ ] Run affected UI/core/service tests and build; commit T07.

## Task 8: Browser, visual, CI and real repository validation (T08)

**Files:** `tests/e2e/`, `tests/integration/`, `playwright.config.ts`, `scripts/{smoke,validate-repository}.mjs`, `.github/workflows/ci.yml`, `docs/environment.md`.
**Interfaces:** Product scripts/server/MCP/HTTP already work; use writable temp data and actual fixtures/public checkout outside source. Linux current environment, three-OS CI config; never claim unexecuted native runners.

- [ ] Browser failing tests pin real flow: open fixture → entry/expand/search → create plan → connect requested B → remove spare helper → change file → validate/approve → layout still approved → semantic edit invalidates → approve/export → persisted after actual service restart.
- [ ] Include Python browsing, routes, groups/policies, undo/redo, locale/theme and project switch. Capture desktop/dark/narrow screenshots, console errors and actually inspect images; repair observed failures through implementation agent and scoped review.
- [ ] Set up Linux/Windows/macOS CI npm ci/typecheck/lint/test/build/production smoke; Linux browser job installs official Chromium/deps. Preserve underlying exit codes and report test counts/skips.
- [ ] Select fixed stable mature public TS repo (Vite candidate) and Python repo (e.g. Flask), index real source range, save statistics, sampling evidence, unknown limitations and runtime; do not copy targets into Git or claim upstream test suites ran.
- [ ] Execute full local CI-equivalent commands, real production process smoke, real MCP client and browser checks; repeat only covering checks after fixes.
- [ ] Update environment versions/limits/client config, review README requirement coverage in an explicit report, commit T08. Then continue subsequent missing README items as new tickets until user signals wrap-up.
