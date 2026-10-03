# T04 implementation report

Status: DONE, pending controller's independent review. Review base: ba964dede2e8df736c59edd68076ff33a4c35655. Controller-only documentation commits through 22b30a2 are context; no controller files were staged by this implementation.

## Delivered

- `apps/server/src/index.ts`: public `createServer` export plus direct-execution CLI. Real SourceIndexer/SqliteStorage/WorkspaceService assembly; validated CODEMAP_PORT (default4310), loopback bind, optional explicit CODEMAP_WORKSPACE_ROOT, persistent data directory override/default, automatic built-web detection, launch failure cleanup, and HTTP-before-SQLite shutdown on SIGINT/SIGTERM. No implicit cwd project.
- `server.ts`, `routes.ts`, `queries.ts`: all HTTP contracts; strict Zod request shapes/unknown fields and query validation; domain mapping; factory doesn't listen or close injected storage; project-scoped service/query glue; static assets/SPA fallback preserves API404 and missing-asset404.
- `packages/core/src/queries.ts`, its tests/public index export: deterministic pure search, context pagination, bounded subgraph, honest entrypoint overview. Graph algorithms remain in core; no I/O or concrete storage/indexer access there.
- `scripts/dev.mjs` and root dev hook: dependency-ordered ready builds, direct Node server/Vite subprocesses, web working directory apps/web, signal/failure supervision and bounded forced shutdown; no shell/npm.cmd/bash orchestration or server watch descendants.
- Server declares exact direct zod4.6.5. Root lock changed only this workspace dependency entry; no upgrades. Existing root npm start already points at the implemented compiled CLI and was preserved.
- Colocated tests: queries7, HTTP integration11, CLI subprocess3, dev supervisor subprocess3. Real SQLite/indexer/service used for HTTP and CLI; error-path ports control only failures. Dev fixtures run the actual supervisor against controlled executable subprocesses.

## Public query handoff

Exports: `Pagination`, `FunctionSearchInput`, `FunctionSearchResult`, `FunctionContextResult`, `SubgraphInput`, `SubgraphResult`, `ProjectSummary`, plus:

- `searchFunctions(snapshot,input={})`: case-insensitive substring over function name/qualifiedName/filePath; deterministic name/path/id order; `items,total,offset,limit,snapshotId,dataSource:'code'`. Defaults offset0/limit50; max limit200. Current class containers count as function nodes.
- `getFunctionContext(snapshot,nodeId,input={})`: function-only lookup; independently paginated calls `incoming,outgoing`, retaining unresolved/external evidence and reasons; `node,totalIncoming,totalOutgoing,truncated,offset,limit,snapshotId,dataSource:'code'`. Same pagination defaults/bounds; `truncated` also reflects omitted earlier pages.
- `getSubgraph(snapshot,input)`: all seeds validated before clipping; bidirectional deterministic breadth-first expansion over selected relation types; physical parent context appended when budget permits; induced evidenced relations of selected types and unresolved calls retained. Defaults depth1/budget80/types['calls']; max depth5/budget300; depth0 allowed. Result `nodes,relations,truncated,snapshotId,dataSource:'code'`; relations max budget*3. Any node/context/relationship budget clipping sets truncated. Unknown/foreign IDs are NOT_FOUND404, never silently dropped.
- `getProjectSummary(project,snapshot)`: `project,snapshotId,contentHash,counts,entrypoints,entrypointTotal,entrypointsTruncated,diagnostics,coverage,dataSource:'code'`. Exact counts `{files,folders,functions,relations,calls:{resolved,unresolved,external}}`. Exported candidates capped50. Python public-name candidates additionally require file parent (no nested public helper/method candidates). These remain conventions/candidates, not proven runtime entrypoints.

## HTTP error handoff

Success returns the documented entity directly. Error JSON is `{code:string,message:string}`; Zod400 additionally includes `issues:[{path:(string|number)[],message:string}]`, with message `Invalid request.` and code `INVALID_INPUT`.

- NOT_FOUND →404; INVALID_INPUT/INVALID_PATH/PROJECT_MISMATCH/VALIDATION_FAILED →400.
- REVISION_CONFLICT/BASELINE_CONFLICT/NOT_APPROVED →409; SOURCE_UNAVAILABLE →503 (original actionable domain message).
- INVALID_SNAPSHOT/unknown domain codes/unexpected exceptions →500 `{code:'INTERNAL_ERROR',message:'Internal server error.'}` with private details omitted.
- Malformed JSON/framework client errors →400 (or the framework's client status), generic `INVALID_INPUT`/`Invalid request.`. Unknown routes →404 `{code:'NOT_FOUND',message:'Route not found.'}`.
- Plan validate/verify/refresh accept absent body or strict empty object. Export requires explicit format json or markdown with matching Content-Type. Path projectId is authoritative for routes/groups/policies; body cannot override it.

## Observed RED/GREEN evidence

Actual commands run in /workspace/AtlasMode:

1. `npm test -- packages/core/src/queries.test.ts`: RED exit1,6/6 missing exports assertions; implementation GREEN exit0,6/6. Python top-level regression later RED exit1,1 failed/6 passed (pymethod/pynested incorrectly returned), then GREEN exit0,7/7 after parent filter.
2. `npm test -- apps/server/src/server.test.ts`: RED exit1,11/11 missing createServer; GREEN exit0,11/11 with real sources/SQLite, including stale baseline409, revision409, verify fresh actual code, invalid/mixed project references, strict requests, safe source traversal/symlink rejection, export, knowledge/view isolation, assets/API404, and sanitized errors.
3. `npm test -- apps/server/src/index.test.ts`: RED exit1,3/3 (CLI never listened; invalid port exited0). First implementation exposed Fastify prohibition on post-listen addHook (2 failed/1 passed). Root cause traced to adding lifecycle hook after factory ready/listen; moved listener cleanup into CLI-owned shutdown. GREEN exit0,3/3, real process API/source/indexing, persisted SQLite reopening, configured workspace, clean failures and signals.
4. `npm test -- apps/server/src/dev.test.ts`: RED exit1,3/3 (no children/build failure swallowed); GREEN exit0,3/3. Added web-cwd check RED exit1,1/3 (monorepo root instead of apps/web); corrected child cwd; GREEN exit0,3/3. Actual subprocess death asserted after supervisor signal and child failure.

## Final validation

- `npm run build -w @codemap/<package>` and `npm run typecheck -w @codemap/<package>` in order core,indexer,storage,service,server: all ten commands exit0. Existing Python helper remains packaged by indexer build.
- `node node_modules/eslint/bin/eslint.js packages/core/src apps/server/src scripts/dev.mjs`: first exit1 identified one unused test import; after removing that import final exit0, no warnings.
- `node /tmp/atlasmode-t04-smoke.mjs`: exit0. This spawned `node apps/server/dist/index.js` with temp data/real TS fixture: health ok; POST project open200; snapshot4 nodes; function outgoing1; source actual fixture bytes; SIGTERM process exit0; SQLite reopen persisted project count1. Startup log explicitly `(web build unavailable)`.
- Full root `npm test`, run once before initial commit: exit0,9 test files/141 tests passed,3.74s. No skipped or failed tests reported.
- `git diff --check`: exit0. `sha256sum --check docs/superpowers/vendor.sha256`: exit0, vendored workflow unchanged.
- Dependency-only lock update: `npm install --workspace @codemap/server --save-exact zod@4.6.5 --package-lock-only --ignore-scripts --cache /tmp/atlasmode-npm-cache`: exit0; no TLS/checksum bypass or secret files.

## Self-review and limits

All planned HTTP endpoints are registered. Async approve/verify use the service's actual refresh and existing state machine. Core owns traversal; server uses public service and core entries. Source bytes only read/indexed, never executed. IDs validated before graph clipping, both graph budgets disclosed, no fabricated edges or zero-indegree entrypoint claims. The factory leaves storage ownership with its caller; CLI owns concrete resources. Only authorized scope files are committed; no databases, caches, target fixture copies, or vendored skills.

Runtime verification was Linux only. Windows/macOS path defaults use platform Node APIs but native runners/signals/symlink permissions were not executed and are not claimed passing. Real compiled process is API-only; fake built assets test validates transport fallback, not application UI readiness. Web/MCP implementation, full root build/typecheck, browser/UI and MCP clients remain subsequent tasks. Root npm dev starts source server via tsx directly; it does not provide automatic backend restart/watch. No remote push or worktree created. Independent review is controller-owned, not represented by this self-review.

Commit: ebfa409 (feat: add local HTTP server and bounded browsing queries).

## Fix round 1 — active prerequisite build shutdown

Review base: ebfa409. Controller-only documentation at effcf13 preserved. Independent review correctly found that initial tests covered directly launched runtime children, but npm prerequisite wrappers could leave live compiler descendants after shutdown. The earlier supervisor shutdown statement did not establish active-build descendant termination.

Changes are confined to `scripts/dev.mjs` and `apps/server/src/dev.test.ts`:

- All five current prerequisite manifests declare exactly `tsc -p tsconfig.json`. The supervisor now resolves the installed/pinned TypeScript CLI and launches each compiler directly via `process.execPath`, in the correct workspace cwd, in core/indexer/storage/service/server order. No npm/shell process sits between supervisor and compiler, so existing signal/timeout handling owns and reaps the active build process directly.
- A small manifest guard rejects any differing build script or any prebuild/postbuild lifecycle step with `Unsupported prerequisite build for <name>; update the development supervisor to handle its build/lifecycle steps.` It exits1 rather than silently bypassing custom build behavior. Future prerequisite changes require an explicit supervisor update. Root npm run dev remains the usual invocation; production supervisor no longer needs npm_execpath.
- Test compiler fixture is a real long-lived Node process. The old npm fixture spawns that compiler as a grandchild; the repaired supervisor launches the same executable directly. Regression asserts the compiler is live before SIGTERM, supervisor exit0, compiler PID absent after supervisor exit, and runtime children not launched. Cleanup kills any surviving compiler from a failed RED run. Existing runtime-child signal/failure and failed-build exit-code checks remain intact.

Observed commands/output, all from /workspace/AtlasMode:

1. Before production edits, `npm test -- apps/server/src/dev.test.ts -t "shutdown during an active prerequisite build"`: RED exit1;1 failed/3 intentionally filtered skipped. Failure `expected [Function] to throw an error` on `process.kill(compiler,0)` after supervisor exit[0,null]: the actual compiler descendant survived. It was cleaned by the test.
2. Before guard implementation, `npm test -- apps/server/src/dev.test.ts -t "custom prerequisite"`: RED exit1;1 failed/4 intentionally filtered skipped. Expected exit[1,null], received `still running`, demonstrating unsupported custom build behavior was not rejected.
3. After direct compiler ownership/guard, `npm test -- apps/server/src/dev.test.ts`: GREEN exit0;5/5 passed,1.13s. After formatting, final covering run exit0;1 test file/5 tests passed,1.17s. Includes active-build termination, ordered workspace compile, runtime-server/web termination, child failure7, compiler failure9, and build/prebuild/postbuild rejection.
4. `node node_modules/prettier/bin/prettier.cjs --write scripts/dev.mjs apps/server/src/dev.test.ts`: exit0 (format only).
5. `node node_modules/eslint/bin/eslint.js scripts/dev.mjs apps/server/src/dev.test.ts`: exit0, no warnings. `node --check scripts/dev.mjs`: exit0. `git diff --check`: exit0.
6. Read-only Node manifest/CLI check (`node --input-type=module` heredoc): verified all five actual prerequisite manifests fit the guard, resolved `typescript/bin/tsc`, and executed the installed CLI with `--version`. Exit0, output `{"compilerVersion":"Version 5.9.3","supportedBuilds":["core","indexer","storage","service","server"]}`. No package builds were rerun.

Limits: Linux subprocess termination verified. Direct Node ownership/cwd/CLI resolution uses cross-platform APIs; no Bash, POSIX process-group assumptions, or Windows-native tree-kill utility added. Native Windows/macOS signal behavior remains unrun and not claimed. No full suite/server API/core/indexer suite or scale checks rerun for this focused fix. No shared startup dependency changes, agents, remote push, or worktree.

Fix commit: 6daac82 (fix: own prerequisite compiler shutdown directly).
