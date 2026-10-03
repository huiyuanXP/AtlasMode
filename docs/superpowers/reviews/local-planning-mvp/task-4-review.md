### Spec Compliance

- ❌ Issues found: prerequisite-build descendants survive development-supervisor shutdown, violating T04's child-process shutdown requirement (`scripts/dev.mjs:14`, `scripts/dev.mjs:43`). The other observable T04 interfaces match the brief and HTTP contracts.
- ⚠️ Cannot verify from this diff: native Windows/macOS runtime and signals, UI/MCP behavior, full root build/typecheck, and offline installation/runtime acceptance. These remain explicitly unverified in the implementation report; platform-specific defaults are implemented at `apps/server/src/index.ts:15`, and UI/MCP are later tasks.

### Strengths

- Pure query implementation and public exports stay in core; HTTP query glue reads only service snapshots (`packages/core/src/index.ts:3`, `apps/server/src/queries.ts:12`).
- HTTP validation uses strict objects and bounded pagination/graph inputs, and plan approval/verification call the asynchronous service methods (`apps/server/src/routes.ts:12`, `apps/server/src/routes.ts:22`, `apps/server/src/routes.ts:181`).
- The factory leaves listening and concrete resource ownership to the CLI; error handling sanitizes unexpected failures and the SPA fallback preserves API/missing-asset 404s (`apps/server/src/server.ts:20`, `apps/server/src/server.ts:41`, `apps/server/src/server.ts:64`, `apps/server/src/index.ts:30`).
- Integration and subprocess tests exercise real indexing, SQLite persistence, source isolation, plan lifecycle, API fallback, and runtime-child termination (`apps/server/src/server.test.ts:26`, `apps/server/src/index.test.ts:75`, `apps/server/src/dev.test.ts:101`). Reported RED/GREEN evidence and final Linux validation are consistent with the supplied tests; no suite was rerun.

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

- `scripts/dev.mjs:14`, `scripts/dev.mjs:43`: `stop()` signals only directly tracked processes. During prerequisite builds, that process is npm, which spawns the build script/compiler. Stopping the supervisor kills npm but leaves its build descendants running; the supervisor can exit successfully while those descendants still execute and modify build output. Existing build fixtures immediately exit and never create descendants (`apps/server/src/dev.test.ts:31`), so the reported runtime-child shutdown tests do not answer this case. Supervise and reap the build process tree across supported platforms, or launch the required build executables directly under supervisor ownership, and add a failing subprocess regression for a signal during an active build.

#### Minor (Nice to Have)

- None found.

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** Query boundaries, HTTP contracts, validation, resource ownership, and meaningful integration tests are otherwise sound. The reproducible orphaned build process blocks the required graceful development shutdown behavior.

- **Focused probe run:** named risk: prerequisite-build subprocesses escaping supervisor ownership. Ran the actual `scripts/dev.mjs` with a temporary Node npm fixture that spawned a long-lived build child, sent SIGTERM during that build, and checked the child PID. Result: `{"supervisorExit":[0,null],"buildGrandchildSurvived":true}`. The probe killed its remaining child and removed its temporary files; no test suites or native-platform runs were performed.
- **Review scope:** the supplied 2,141-line package was read once in contiguous chunks; the complete HTTP/interface requirements were checked in `docs/superpowers/contracts.md:134`. No implementation outside the diff was inspected, and no checkout/index/HEAD changes were made beyond this allowed ignored review report.
