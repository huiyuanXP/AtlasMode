# T01 implementation report

Status: DONE_WITH_CONCERNS (optional signature-metadata access limitation; application modules intentionally belong to subsequent tickets).

## Scope and contract compliance

Implemented the root npm workspace toolchain and pure `@codemap/core` contract. Created manifests and tsconfigs for the seven required workspaces; installed actual README-required dependencies in their owning workspaces. All workspaces are private, ESM, version 0.1.0; internal dependencies use exact local 0.1.0 links and one root package-lock.json. No fake app/indexer/storage/service/MCP modules were created. Updated .codemap/structure.json with explicit responsibilities and forbidden imports. Core tsconfig has no Node or browser ambient types; ESLint enforces public workspace imports and dependency boundaries.

Re-read current docs/superpowers/contracts.md immediately before completion. No entity names, fields, ports or function signatures deviate. The controller accepted and added the clarified route convention: every call_chain step after the first carries its incoming resolved calls relationId and valid source evidence; optional walkthrough relationIds must touch that step. The controller owns the contracts documentation changes and they are excluded from this commit.

## Public interfaces

Public entry: packages/core/src/index.ts; built import: @codemap/core.

Types: Language, CodeNode, Relation, CodeSnapshot, Project, Operation, Plan, Approval, ValidationIssue, PlanDetail, BrowseRoute, FunctionGroup, DirectoryPolicy, ViewState, VerificationReport, RecordKind.

Ports: IndexerPort.index(rootPath, projectId); StoragePort.get/list/put/delete/transaction/close with generic record values and all contract record kinds.

Runtime exports: DomainError(code, message), makeId(kind,...parts), normalizeRepoPath(path), validatePlan(plan,snapshot,policies?), validateRoute(route,snapshot), semanticPlanContent(plan), operationSchema, snapshotSchema, planSchema, routeSchema. Concrete public Zod schema types retain object composition APIs (.omit/.shape for object schemas) while satisfying their domain types.

makeId is a pure deterministic 128-bit FNV-style digest of JSON-encoded semantic parts; it never reads time, layout, randomness or source lines. It is an identity helper, not a security hash. Callers must supply semantic symbol parts rather than line numbers.

normalizeRepoPath unifies Windows/POSIX separators and collapses internal dot segments; rejects empty/root/directory-only paths, Unix/Windows absolute paths, drive-relative paths, control characters and parent traversal outside the repository. It performs lexical validation only; actual filesystem/symlink confinement belongs to I/O packages.

Boundary schemas are strict at every object level. They reject client approval fields, unknown operation variants, malformed revisions/timestamps/paths and unknown nested data. validatePlan checks project/baseline identity, operation shape, unique IDs, surviving endpoints, function ownership, annotations and literal directory dependency prefixes, including surviving fact edges after moves. Recursion and order-independent added-function references are permitted. Literal prefix matching respects slash boundaries; policies for other projects are ignored. Interface type compatibility cannot be inferred from signature text alone and is not claimed.

semanticPlanContent canonicalizes object key ordering and excludes revision, status, times and outer layout metadata; preserves operation ordering and includes the plan identity/project, title, description and baseline fields. Approval/revision/history semantics remain service responsibility.

## TDD evidence

All runs from /workspace/AtlasMode; no tests mocked production core behavior.

1. Initial RED: `npm test -- packages/core` exit 1. Missing ./index.js implementation caused collection failure (0 tests); expected initial missing-implementation evidence.
2. Behavior RED with throw-only exports and rejecting schema stubs: same command exit 1; 38 failed, 2 passed, 40 total. Positives and pure behavior failed for missing implementation. Temporary rejecting schemas were never committed.
3. Schema RED with permissive schema stubs: same command exit 1; 39 failed, 1 passed, 40 total. This additionally proved strict boundary rejection tests failed without implementation. Log: /tmp/atlasmode-t01-red.log. Temporary stubs were replaced with real implementation.
4. Initial GREEN: `npm test -- packages/core` exit 0; 40 passed, 0 skipped. Core build and affected-file ESLint exit 0.
5. Targeted RED: added existing-edge policy test, same command exit 1; 1 failed, 40 passed, 41 total. Assertion expected a policy violation after moving a surviving dependency source into the policy directory. Log: /tmp/atlasmode-t01-red-policy.log.
6. Additional RED: added directory-only dot-segment cases, same command exit 1; 3 failed, 40 passed, 43 total. Log: /tmp/atlasmode-t01-red-policy-path.log.
7. Final GREEN after fixes and compatible dependency upgrades: `npm test -- packages/core` exit 0; 43 passed, 0 failed/skipped, 1 file, Vitest 4.1.11.
8. Required repository-suite run: bare `npm test` exit 0; all currently existing 43 tests passed, 0 skipped. This is the complete current suite, not a claim about later unimplemented packages.

## Verification and installation

- `npm install --cache /tmp/atlasmode-npm-cache`: exit 0, initial installation. Two corrective installs also exited 0 after concrete deprecation/audit evidence; no forced audit fix or weakened verification used.
- `npm ci --cache /tmp/atlasmode-npm-cache`: exit 0, final frozen lockfile installation, 410 packages added. The writable cache is only a runtime flag, never committed in .npmrc or product scripts.
- `npm run build -w @codemap/core`: exit 0, compiled declarations and ESM.
- `npm run typecheck -w @codemap/core`: exit 0.
- `npm run lint`: exit 0 across currently existing source/config/helper code.
- `git diff --check`: exit 0.
- `sha256sum --check docs/superpowers/vendor.sha256`: exit 0; vendored skills unchanged.
- `npm ls --depth=0`: exit 0; seven workspace links and exact direct dependencies resolved without peer/engine errors.
- Node dependency readiness program: exit 0. Exercised an in-memory native better-sqlite3 transaction/read, real ts-morph source parse, MCP SDK construction/close, actual Fastify/static inject GET of a temporary file, and compiled core exports. Temporary static files were deleted.
- Final native/public-schema check after frozen reinstall: exit 0; SQLite native load/query, compiled schemas .omit APIs, makeId.
- Workspace-helper behavioral check with a disposable npm-command recorder: exit 0. Confirmed actual spawn order core/indexer/storage/service/web/server/mcp and child exit 7 propagation with no later packages executed. No fake product modules or permanent test fixtures added.
- Initial production audit detected known @fastify/static 9.1.0 traversal advisories; corrected to compatible stable 10.1.5 using the official Fastify compatibility table. Initial ESLint9.39.5 emitted its unsupported-version deprecation; corrected to stable10.11.0 supported by typescript-eslint8.71.0. Full audit then detected vulnerable Vitest4.0.18 mocker; corrected to stable4.1.11 with compatible Node/Vite engines.
- Final `npm audit --cache /tmp/atlasmode-npm-cache`: exit 0, 0 vulnerabilities. Production-only audit also exit 0, 0 vulnerabilities.
- Optional `npm audit signatures --cache /tmp/atlasmode-npm-cache`: exit 1. npm TUF metadata loadTimestamp refresh failed to download, HTTP403; log /tmp/atlasmode-npm-cache/_logs/2026-10-02T20_08_40_466Z-debug-0.log. This additional signature audit was not completed. Package-lock integrity and HTTPS/TLS were retained throughout; no signature/checksum/TLS setting was disabled or bypassed. No suspect artifact verification result was ignored.

## Root workflow and remaining limits

Root scripts: dev, build, start, typecheck, lint, test, test:e2e, mcp. Node helper runs npm via the inherited npm_execpath using process.execPath, avoiding platform-specific npm.cmd spawning. Dev delegates to concurrently; start and MCP directly invoke built Node entrypoints. Build order is explicit and independent of workspace alphabetical order. Typecheck builds each package's dependency artifacts and then performs its --noEmit check in the same explicit order.

Full product build/typecheck/start/dev/e2e/MCP behavior has deliberately not been run because downstream source/entrypoints and browser tests do not exist yet. npm test and lint currently validate the implemented core/configuration only. No Linux product, Windows/macOS, browser, or MCP integration success is claimed. Installed dependencies support the current Node engine; native SQLite executed successfully on this Linux machine. Windows/macOS native installation belongs to the later CI ticket. No browser binary was installed.

Existing environment runtime is Node24.19.0/npm11.9.0 and Python3.12.14. Python minimum remains 3.10 as recorded in docs/superpowers/state.md; no Python dependency or executable change was needed. Runtime network-policy observation was unknown; npm registry operations demonstrably succeeded with inherited proxy/trust. Optional TUF signature-metadata access remains limited by HTTP403. Reusable environment configuration is controller-owned; the concrete reproducible installation command is `npm ci --cache /tmp/atlasmode-npm-cache` in /workspace/AtlasMode after Node activation. No cloud draft was overwritten by this worker.

## Exact pinned versions

### atlasmode

- `typescript`: `5.9.3`
- `tsx`: `4.23.15`
- `@types/node`: `24.19.1`
- `concurrently`: `10.0.5`
- `vitest`: `4.1.11`
- `eslint`: `10.11.0`
- `typescript-eslint`: `8.71.0`
- `prettier`: `3.9.9`
- `@playwright/test`: `1.63.0`

### @codemap/service

- `@codemap/core`: `0.1.0`

### @codemap/core

- `zod`: `4.6.5`

### @codemap/storage

- `@codemap/core`: `0.1.0`
- `better-sqlite3`: `13.0.3`
- `@types/better-sqlite3`: `9.6.0`

### @codemap/indexer

- `@codemap/core`: `0.1.0`
- `typescript`: `5.9.3`
- `ts-morph`: `27.0.2`
- `fast-glob`: `3.3.3`
- `ignore`: `7.0.12`

### @codemap/server

- `@codemap/core`: `0.1.0`
- `@codemap/service`: `0.1.0`
- `@codemap/indexer`: `0.1.0`
- `@codemap/storage`: `0.1.0`
- `fastify`: `5.12.5`
- `@fastify/static`: `10.1.5`

### @codemap/mcp

- `@codemap/core`: `0.1.0`
- `@modelcontextprotocol/sdk`: `1.32.0`
- `zod`: `4.6.5`

### @codemap/web

- `@codemap/core`: `0.1.0`
- `react`: `19.3.0`
- `react-dom`: `19.3.0`
- `@xyflow/react`: `12.12.0`
- `zustand`: `5.0.15`
- `vite`: `7.3.6`
- `@vitejs/plugin-react`: `5.2.0`
- `@types/react`: `19.3.0`
- `@types/react-dom`: `19.3.0`

## Commit

Local owned-path commit: `1b33c7f` (`feat: establish workspace toolchain and pure domain contracts`). No push. Controller-owned docs/superpowers/contracts.md remains outside this commit.

## T01 fix round 1 — disguised Windows drive paths

Independent review identified a lexical normalization defect: the original drive-prefix rejection ran before dot-segment collapse. `./C:/outside.ts` and `src/../C:outside.ts` consequently became Windows absolute/drive-relative outputs; schema refinement accepted those unsafe inputs. The corresponding Windows-separator variants reproduced the same issue.

Added four table-driven direct normalizer regression tests and four independent boundary-schema rejection tests. The schema tests exercise both add_function and move_function operation inputs. RED command: `npm test -- packages/core`, exit 1, 8 failed / 43 passed / 51 total, one failing test file. Expected failures: direct normalization did not throw, and operationSchema.safeParse returned success. RED log: /tmp/atlasmode-t01-fix1-red.log.

Smallest implementation correction: after joining collapsed path segments, reject a leading `[A-Za-z]:` drive prefix with DomainError INVALID_PATH before returning the path. The existing schema refinement inherits this rejection without duplicate schema logic. No contracts, dependencies, toolchain settings, or other task implementations changed.

GREEN checks:

- `npm test -- packages/core`: exit 0; 51 passed, 0 failed/skipped, one file, Vitest4.1.11.
- `npm run build -w @codemap/core`: exit 0.
- `npm run typecheck -w @codemap/core`: exit 0.
- `./node_modules/.bin/eslint packages/core/src/validation.ts packages/core/src/validation.test.ts`: exit 0.
- Bare `npm test`: exit 0; complete current repository suite has 51 passed, 0 failed/skipped, one file.
- `git diff --check`: exit 0.

No reinstall, network request, audit or unrelated check was run during this fix round. Original optional signature-metadata HTTP403 concern remains unchanged. Fix commit recorded after commit below.

Fix round 1 local commit: `415a054`. No push.
