# Task 6 — actual stdio MCP bridge

Status: DONE. Implementation self-review complete; independent review belongs to controller.
Commit: `7f7bd95e108c3616aaef78e804154bc45510af09` — `feat(mcp): bridge planning tools over actual stdio`.
Assigned base: `3b67ab872e43b9d411af73778d005903cafa0f8e`.
Parent added documentation-only commits `af56778` and `726fd64` during implementation;
controller confirmed this was expected and no implementation ownership overlapped.
Working directory: `/workspace/AtlasMode`; actual checks below ran 2026-10-02 UTC.
Runtime observed: Node `v24.19.0`, npm `11.9.0`, Python `3.12.14`, Linux.
Installed MCP SDK is the existing pinned `1.32.0`; no dependency/lock changes.

## Instructions and decisions

Read task-6-brief.md FIRST, then task-6-context.md, actual contracts.md,
implementer-prompt.md, AGENTS.md, using-superpowers/Codex adaptation, state/README,
TDD/writing-good-tests, verification-before-completion, and systematic-debugging
when transport cleanup failed. Read the relevant spec architecture/global
constraints, not the whole plan or a crawl of prior source changes. Cloud setup
and runtime skills were consulted; this is explicitly authorized product coding,
so onboarding's prohibition on unsolicited code changes does not apply. No new
setup configuration/install/network access was required. No subagents dispatched.
`sha256sum --check docs/superpowers/vendor.sha256`: all vendored files OK.

Official installed SDK references inspected:
`dist/esm/server/mcp.d.ts` (`registerTool` generics),
`examples/server/simpleStreamableHttp.js` (Zod/schema registration),
`server/stdio.js`, `client/stdio.{js,d.ts}`, `shared/protocol.{js,d.ts}`
(transport error/close lifecycle and actual client spawn behavior).

Controller confirmed these existing-API decisions before implementation:

- Every plan tool requires `projectId` plus `planId`, verifies ownership via HTTP,
  and rejects a foreign project's plan with `NOT_FOUND` before writes/refresh.
- `propose_plan` requires an explicit prior-query `baselineSnapshotId` and
  operations. Existing service supports create, then update; empty operations
  keep revision 1, nonempty normally return revision 2. No new API endpoint.
  A failed second step returns the real domain/network error plus
  `createdPlanId` and `createdRevision` so the retained draft is recoverable.
- `get_approved_plan` verifies ownership, really POSTs refresh, then reads current
  detail. It does not substitute an approved historical plan for a newer draft.
- Projects/routes/groups/policies use bridge pagination over existing HTTP arrays;
  HTTP already handles function/context pagination and graph budgets.
- Route read `stale` fields are additive, derived from snapshot identity, and
  never written back into stored route records. New routes/groups always bind
  source to agent. No existing group id is accepted by group proposals.

## Files and implementation

Exactly five assigned files were added:

1. `apps/mcp/src/client.ts`: shared-service HTTP client, origin validation,
   30-second request deadline, lifecycle cancellation, domain/status/issues
   preservation, actionable API_UNAVAILABLE/TIMEOUT/INVALID_RESPONSE errors,
   partial-proposal recovery metadata and sanitized unexpected errors.
2. `apps/mcp/src/server.ts`: `createMcpServer(apiUrl:string)` returning actual SDK
   McpServer, exactly the 16 requested schema-validated tools, no approval tool,
   project ownership guards, explicit baseline, refresh-before-approval-read,
   historical verification, agent-bound proposals, paged discovery/knowledge.
   Production imports core, SDK/Zod and the HTTP client only; no service/indexer/
   SQLite path. Successful JSON is MCP text content; errors set `isError:true`.
3. `apps/mcp/src/index.ts`: direct compiled Node stdio entry, safe library export,
   stderr-only failures, EOF/signal/error shutdown, closes server and releases
   stdin instead of retaining an open parent pipe.
4. `tests/integration/mcp-stdio.test.ts`: eleven actual subprocess SDK tests
   compiling the real executables, spawning real HTTP/SQLite/indexer service,
   connecting installed Client + StdioClientTransport from unrelated cwd,
   using hand-checked source fixtures and real HTTP user approval/edit endpoints.
5. `docs/mcp.md`: absolute Node/entry + CODEMAP_API_URL configuration examples for
   Codex CLI/App and Claude Code across Linux/macOS/Windows; all 16 tools,
   pagination/limits, approval workflow, honest non-atomic behavior, errors and
   native verification limitations. No npm wrapper/banner for MCP startup.

No manifest/lock/API/service/UI changes, no global client configuration writes,
no remote push, no credential/database/target fixture committed.

## TDD RED — before production code

Command (exit 1):

```text
npm test -- tests/integration/mcp-stdio.test.ts -t 'actual SDK discovers' > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-red.log 2>&1
```

Actual compiled HTTP API started and served a real indexed fixture; SDK Client
spawned the absolute compiled MCP entry, which did not exist yet. The test caught
the failed real handshake as an assertion failure, not a mocked protocol result:

```text
AssertionError: Compiled MCP handshake failed; stderr: node:internal/modules/cjs/loader:1520
Error: Cannot find module '/workspace/AtlasMode/apps/mcp/dist/index.js'
code: 'MODULE_NOT_FOUND'
expected McpError: MCP error -32000: Connection closed to be undefined
Test Files  1 failed (1)
Tests  1 failed | 8 skipped (9)
Duration  6.23s
```

The initial test-only harness tolerated the expected MCP TS18003/no-input build
solely so the real SDK could demonstrate missing entry behavior. That allowance
was removed after production code existed; final harness strictly asserts all
six dependency/executable compilations exit zero.

Before production code, all ten then-written behavior scenarios were also RED:

```text
npm test -- tests/integration/mcp-stdio.test.ts > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-red-all.log 2>&1
Test Files  1 failed (1)
Tests  10 failed (10)
Duration  6.39s
```

Those tests already covered discovery/schema, queries/budgets/unknowns, approval
hash/revision, semantic draft invalidation/historical verification, disk refresh,
explicit stale baseline, agent routes/groups, cross-project nodes/plans, actual
service restart, HTTP errors, partial creation conflict and transport cleanup.

## Iteration evidence — all failures disclosed

First attempted GREEN (exit 1), same focused command, log `task-6-green-1.log`:

```text
apps/mcp/src/server.ts(36,46): error TS2322:
Type 'ZodObject<...>' is not assignable to type '{ ... }'.
Test Files  1 failed (1)
Tests  10 skipped (10)
```

Cause: SDK registerTool generic inference selected a raw shape instead of the
strict Zod object in the generic registration helper. Fixed by supplying the
official registerTool output/input generics explicitly; no type suppression.

Second focused run (exit 1), log `task-6-green-2.log`:

```text
Tests  1 failed | 9 passed (10)
malformed stdio input and stdin EOF terminate cleanly with protocol-only stdout
Error: Test timed out in 10000ms.
Duration  20.08s
```

Root-cause reproduction used an actual Node child, wrote malformed JSON while
keeping its stdin pipe open, then ended stdin after 300ms:

```text
node --input-type=module - <<'JS'
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['apps/mcp/dist/index.js'],{stdio:['pipe','pipe','pipe']});
child.stderr.on('data',data=>process.stderr.write(data));
child.on('exit',(code,signal)=>console.log('EXIT',code,signal));
child.stdin.write('not json\n');
setTimeout(()=>{console.log('ALIVE',child.exitCode===null); child.stdin.end();},300);
setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},600).unref();
JS

AtlasMode MCP stdio transport failed; closing the connection.
ALIVE true
EXIT 1 null
```

The SDK transport.close removes data listeners and pauses stdin but does not
release the still-open parent pipe. Fixed shutdown to destroy stdin after SDK
server.close. Actual focused regression GREEN (exit 0):

```text
npm test -- tests/integration/mcp-stdio.test.ts -t 'malformed stdio' > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-cleanup-green.log 2>&1
Test Files  1 passed (1)
Tests  1 passed | 9 skipped (10)
Duration  7.37s
```

Added an eleventh pre-fix regression for async transport failure while an actual
HTTP request remained pending. The SDK sends a malformed wire message through
its public transport API; a real local HTTP server intentionally holds the
request. This focused transport harness is not an indexer substitute; the other
scenarios use the actual spawned product service. RED (exit 1):

```text
npm test -- tests/integration/mcp-stdio.test.ts -t 'transport failure cancels' > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-active-transport-red.log 2>&1
Error: Test timed out in 5000ms.
Tests  1 failed | 10 skipped (11)
Duration  13.79s
```

Cause: pending fetch retained a socket until its deadline after SDK close.
Added an HTTP lifecycle AbortController and bound SDK onclose to cancel it.
GREEN (exit 0):

```text
npm test -- tests/integration/mcp-stdio.test.ts -t 'transport failure cancels' > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-active-transport-green.log 2>&1
Test Files  1 passed (1)
Tests  1 passed | 10 skipped (11)
Duration  7.27s
```

`npx prettier --write apps/mcp/src/index.ts apps/mcp/src/server.ts apps/mcp/src/client.ts tests/integration/mcp-stdio.test.ts docs/mcp.md`: exit 0, formatted all five files.

## Final GREEN and root verification

All final checks completed, exit code 0; logs contain no unexplained warnings or
errors. No final disabled/skipped tests. Full current root npm test ran ONCE.

```text
npm test -- tests/integration/mcp-stdio.test.ts > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-green-final.log 2>&1
Test Files  1 passed (1)
Tests  11 passed (11)
Start at  23:15:23
Duration  10.79s (transform 40ms, setup 0ms, import 193ms, tests 10.49s, environment 0ms)

npm run build > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-build.log 2>&1
core/indexer/storage/service/web/server/mcp all built successfully
vite v7.3.6 building client environment for production...
209 modules transformed.
dist/index.html                   0.50 kB | gzip:   0.34 kB
dist/assets/index-jl40f3KN.css   27.31 kB | gzip:   5.48 kB
dist/assets/index-DpHhAcgm.js   445.56 kB | gzip: 143.08 kB
built in 2.16s

npm run typecheck > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-typecheck.log 2>&1
all seven workspaces build/typecheck steps completed, including @codemap/mcp tsc --noEmit

npm run lint > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-lint.log 2>&1
> atlasmode@0.1.0 lint
> eslint .

npm test > .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-full-test.log 2>&1
Test Files  15 passed (15)
Tests  177 passed (177)
Start at  23:17:20
Duration  11.57s (transform 808ms, setup 0ms, import 2.42s, tests 20.37s, environment 1ms)

git diff --cached --check
no output, exit 0
```

Raw exact full outputs remain in the ignored logs above (build summary shown
compactly here). Fresh `node --version; npm --version; python3 --version` produced
`v24.19.0`, `11.9.0`, `Python 3.12.14`.

## Actual process and persistence evidence

- Tests use process.execPath and absolute compiled entries for both product API
  and MCP; MCP cwd is tmpdir, so no accidental repository cwd/project guessing.
- Health readiness is an actual HTTP functional request. POST open invokes real
  SourceIndexer and SQLite. Queries discover four fixture functions; dynamic
  invocation remains unresolved. Graph budget 1 reports truncation.
- API user approval and MCP refresh/read compare the entire PlanDetail exactly,
  including approval semantic SHA-256 and revision. Current draft revision 3
  is invalid after revision 2 approval; implementation verification returns the
  actual historic approved revision 2 and satisfied structural evidence.
- A direct file write without refresh before get_approved_plan is detected by
  that tool's real refresh; it returns stale/invalid. Reusing the old explicit
  baseline returns BASELINE_CONFLICT status 409.
- Agent route/group proposals are reread over real HTTP unchanged; unknown and
  other-project endpoints fail, source/id forgery is rejected. A refreshed source
  change marks the earlier route stale in MCP without rewriting stored records.
- Actual HTTP service is stopped and newly spawned over the SAME SQLite path;
  the old SDK client is closed, a new SDK client connects and reads identical
  retained approval, route and group. It does not recreate those records.
- Partial-proposal test uses a transparent HTTP relay to make an actual user
  revision-2 edit after real service create but before the MCP update. Real
  service returns REVISION_CONFLICT; MCP returns creation id/revision and HTTP
  proves exactly one retained plan exists with the user's title and operations.
- SDK client.close is awaited, transport.pid becomes null, and process.kill(pid,0)
  throws for the owned process. Raw malformed stdin exits 1 and writes stderr
  only; plain EOF exits 0 with empty stdout/stderr. Pending HTTP transport
  failure exits promptly rather than awaiting the 30-second deadline.
- afterAll closes all SDK clients, stops only tracked own API/raw children,
  removes own temporary fixture/database directories. Relay servers close in
  finally. No browser process or benchmark started.
- Final `ps -eo pid,ppid,args | rg 'node .*apps/(mcp|server)/dist/index\.js'`
  found no MCP/API compiled smoke child (no output, rg exit 1 as expected).
  Existing ignored artifacts/evidence are preserved. The minimal one-off
  reproduction child also exited with code 1, without needing its kill fallback.

## Self-review and limits

Read the complete staged diff for all five files, including the scenario harness,
after verification. Exactly 16 tools; no approval, source modification, independent
storage or service/indexer import. All plan read/write paths enforce ownership.
Explicit baselines/revision conflicts remain actionable. Refresh-before-approved
read and service-owned historic verification preserve the approval boundary.
Recovery fields report the creation revision honestly, not an assumed current
revision after another client's edit. Pagination and stale flags are additive;
unknown calls and truncation are retained. Transport callback ordering and
outstanding fetch cancellation were inspected against actual SDK internals.
No unplanned split or architecture change; the 293-line registration file has
one responsibility and the longer scenario test keeps actual process utilities
out of production. No remaining correctness concerns from self-review.

Known boundaries (do not overclaim):

- This is Linux Node24 actual SDK stdio evidence, not a native macOS/Windows run
  or real Codex App/Claude Code connection. Windows child.kill(SIGTERM) forcibly
  terminates rather than demonstrating Unix graceful signal delivery. EOF and
  protocol failures are separately covered with portable Node APIs.
- Controller preflight established Codex CLI add --help syntax. Claude CLI was
  absent. Official Codex/Claude documentation fetches were denied with proxy 403
  (controller evidence); no TLS workaround, install, account/login or global
  client configuration was attempted. Docs link official references and label
  those client examples unrun.
- Approval exercised actual shared HTTP API; T05 already owns browser approval
  evidence. No T05 browser repetition, indexer benchmark or T08 extensive/native
  validation was performed here.
- HTTP list endpoints currently return full arrays before bridge paging. The
  bridge bounds MCP list output, not HTTP/storage memory or backend cursors.
  Refresh summaries avoid exposing a whole graph over MCP, but the existing HTTP
  refresh still transfers its snapshot internally. Summary diagnostics/coverage
  are the existing API contract. Requests have an honest 30-second deadline;
  very large indexing may return API_TIMEOUT while the service continues work.
- Creation+update is deliberately non-atomic due existing service API; no false
  transaction guarantee and no recovery blind overwrite. This behavior is
  documented and tested against a real revision conflict.

## Local commit

`git commit -m "feat(mcp): bridge planning tools over actual stdio"` exited 0:

```text
[work 7f7bd95] feat(mcp): bridge planning tools over actual stdio
5 files changed, 1346 insertions(+)
```

`git rev-parse HEAD`: `7f7bd95e108c3616aaef78e804154bc45510af09`.
Post-commit `git status --short`: empty output (clean tracked/untracked worktree).
Post-commit `git diff --check`: exit 0, empty output.
`git check-ignore .superpowers/sdd/2026-10-03-local-planning-mvp/task-6-report.md`
confirms the report is ignored; logs and existing artifacts were retained.
No remote push. Ready for the controller's independent review.
