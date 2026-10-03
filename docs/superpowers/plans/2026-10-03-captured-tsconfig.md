# Captured tsconfig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve evidenced TS/JS paths/baseUrl calls from captured configuration and invalidate old baselines when configuration changes.

**Architecture:** Extend the bounded source capture with configuration inputs, retaining an in-memory compiler. A per-source resolution host applies only the selected configuration; service, HTTP, MCP and UI continue sharing one immutable snapshot and approval mechanism.

**Tech Stack:** Node24.19.0/npm11.9.0, TypeScript5.9.3, ts-morph27.0.2, existing Vitest/Playwright/MCP SDK; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-03-captured-tsconfig-design.md`

## Global Constraints

- Start only after the local-planning MVP's T08 and whole-branch review gates.
- Source/configuration parsing uses captured bytes only; never execute target code or read additional compiler files from disk.
- Preserve default exclusions, nested .gitignore, refusal of source/config symlinks, Windows/macOS/Linux path behavior, Python parsing and stable symbol IDs.
- Configuration seeds are `tsconfig*.json`; relative `.json` extends only. Single-file limit262144 bytes, total4194304 bytes,512 files, depth16; no node_modules/package extends or network.
- Nearest `tsconfig.json` owns only files in its parsed fileNames; no ancestor fallback after nearest exclusion/invalid config, no guessed tsconfig.app ownership, no references expansion.
- Nearest configuration selection includes opaque rejected seeds identified by scan diagnostics with `CONFIGURATION_UNAVAILABLE:` and normalized filePath. Independently validate each selected extends chain (seed1/depth16; reject17), even if another seed captured its files; never partially apply a rejected chain.
- `coverage.configurationFiles?: string[]` is additive; metadata is never `coverage.files` or CodeNode. contentHash becomes versioned source+configuration input hash; historical snapshots remain immutable.
- Configured but unavailable alias targets are unresolved, unconfigured bare imports external; only checker declaration identity yields resolved calls.
- UI defaults Chinese with English support; preserve authored text/technical identifiers. Keep core/indexer/storage/service/server/web/MCP boundaries.
- Sequential implementers and fresh independent reviewers; local commits only, no remote push/publication or destructive cleanup.

## Review Focus

- Alias targets outside the scan or ignored/symlinked: visible unknown evidence, no filesystem escape (Tasks1/2).
- Nested projects with identical aliases: per-source options/cache keys cannot cross-bind functions (Task2).
- Invalid or excluded nearest configuration: do not fall back to an unrelated ancestor alias (Task2).
- Configuration-only edits: current approval/routes become stale while historical snapshots and symbol IDs survive (Tasks1/3).
- Existing SQLite snapshots without the optional field and offline client consumers: read/render safely without migrations or network (Tasks1/3).

## File Structure

`packages/indexer/src/configCapture.ts` owns bounded metadata discovery/extends capture;
`configResolution.ts` owns virtual config parsing/selection and compiler resolution.
`scan.ts` retains source/ignore responsibility and composes metadata capture.
`typescript.ts` retains declaration/call extraction, consuming the resolver rather than
implementing config parsing. Core changes are the additive coverage contract/schema only.
Navigation displays input coverage; integration tests exercise the existing public product.

---

### Task 1: Captured configuration inputs and freshness

**Files:**
- Create: `packages/indexer/src/configCapture.ts`, `packages/indexer/src/configCapture.test.ts`
- Modify: `packages/indexer/src/scan.ts`, `packages/indexer/src/index.ts`, `packages/core/src/model.ts`, `packages/core/src/validation.ts`
- Test: `packages/indexer/src/index.test.ts`, `packages/core/src/validation.test.ts`
- Document: `docs/superpowers/contracts.md`, `docs/superpowers/state.md`

**Interfaces:**
- Consumes: existing SourceFile `{path:string;bytes:Buffer}` and snapshot diagnostics; allowed candidate paths must already satisfy exclusions/ignore/symlink checks.
- Produces: `captureConfigurations(root: string, allowedPaths: readonly string[]): Promise<{files: SourceFile[]; diagnostics: CodeSnapshot["diagnostics"]}>`.
- scan returns additional `configurations: SourceFile[]`; SourceIndexer adds their paths to optional `coverage.configurationFiles`. Public IndexerPort signature is unchanged.
- contentHash uses deterministic type/path/length/byte framing with a version prefix for source and configuration; snapshot ID retains its existing fact fingerprint.

- [ ] **Step 1: Write failing capture and schema tests.** A JSONC seed extends `../shared.json`; capture both once, but only source `a.ts` appears in source coverage/nodes. Invalid JSONC bytes remain input. Assert old snapshotSchema.parse without configurationFiles succeeds and the new field validates repository-relative paths.
- [ ] **Step 2: Add boundary cases and run RED.** Exact limits from Global Constraints;512 vs513 files,16 vs17 levels, cycle, missing/package extends, outside/ignored/symlinked sentinel, oversized opened file, Windows backslashes in relative extends. Assert deterministic diagnostics and no sentinel content/side effects. Run `npx vitest run packages/indexer/src/configCapture.test.ts packages/core/src/validation.test.ts` and record the actual pre-implementation failures.
- [ ] **Step 3: Implement capture and composition.** Parse extends with installed TypeScript JSONC support, strictly confined to allowed paths. Reuse bytes and handle checks; do not turn config JSON into source. Add the optional type/schema field and input hashing to scan/index without a database migration.
- [ ] **Step 4: Verify input identity.** In index.test.ts assert changing only tsconfig bytes changes contentHash/snapshot ID, retains function IDs and the old snapshot object, and changing config whitespace conservatively invalidates input. No config preserves deterministic repeated indexing. Run affected core/indexer tests and their build/typecheck plus root lint, recording counts and status.
- [ ] **Step 5: Update the contract and commit.** Document expanded hash meaning, rejected-input diagnostics and optional field compatibility. Stage only this task's files and commit `feat: capture bounded tsconfig inputs in snapshots`; write the exact task report and await controller review.

### Task 2: Per-source checker resolution

**Files:**
- Create: `packages/indexer/src/configResolution.ts`, `packages/indexer/src/configResolution.test.ts`
- Modify: `packages/indexer/src/typescript.ts`, `packages/indexer/src/index.ts`
- Test: `packages/indexer/src/index.test.ts`
- Document: `docs/superpowers/contracts.md`

**Interfaces:**
- Consumes: scan's SourceFile[] source/configuration captures from Task1; ts-morph27.0.2 `ResolutionHostFactory`/`ts.ModuleResolutionHost` and existing graph declarations.
- Produces: `createConfigurationResolver(sources: readonly SourceFile[], configurations: readonly SourceFile[], captureDiagnostics: readonly CodeSnapshot["diagnostics"][number][] = []): {resolutionHost: ResolutionHostFactory; diagnostics: CodeSnapshot["diagnostics"]; configuredAlias(sourcePath:string,specifier:string): boolean}`.
- indexTypeScript accepts configuration captures as its third parameter and optional captureDiagnostics as its fourth; SourceIndexer supplies scanner diagnostics. Honor opaque rejected nearest config scopes without ancestor fallback or source availability pollution. These are internal arguments, not public port/schema changes. All compiler hosts use the virtual captured filesystem; parser readDirectory filters captured sources, never disk.

- [ ] **Step 1: Write RED for real alias calls.** JSONC inherited baseUrl/paths resolves `entry -> helper` with the expected target function/path/line; two nested tsconfig.json projects bind the same `@lib/*` to different helpers. Also cover default, namespace and re-export chains with declaration identity assertions. Run only configResolution/index tests and record RED before implementation.
- [ ] **Step 2: Pin ownership and failure cases.** Explicit files/include/exclude and allowJs, inherited paths declaration location, arrays of extends, invalid nearest configuration under a valid parent, ignored/symlinked/unreadable nearest config adjacent to included source, references-only root, absent tsconfig.json with tsconfig.app.json, alias target outside/ignored/symlinked/missing. Validate selected extends chains independently: a level17 target or cycle member also captured through another seed still rejects the owning chain, with no partial options or ancestor fallback. Assert missing configured alias imports AND calls are unresolved; unrelated bare package remains external, no cross-project cache target leakage. Dynamic imports/requires remain outside this ticket.
- [ ] **Step 3: Implement config parser and resolution host.** Use TypeScript JSONC/config APIs with the captured host, nearest-container selection and parsed-fileNames ownership. Apply supported resolution options per containing source and segregate caches. Only return captured source resolutions; expose parser/boundary diagnostics. Feed the host into the existing ts-morph Project, keeping declaration extraction unchanged.
- [ ] **Step 4: Integrate classification and verify.** Propagate configured-but-unavailable alias binding as unknown instead of an external function; retain evidence and configuration diagnostic. Run all indexer tests, core validation tests and core/indexer build/typecheck/root lint. Confirm Python, stable IDs, namespace/re-export and source escape regressions pass; avoid an unchanged public-target benchmark.
- [ ] **Step 5: Document supported semantics and commit.** Record exact ownership/no-reference/workspace limits and evidence classifications. Commit `feat: resolve captured tsconfig aliases by source scope`; write task report and await independent review.

### Task 3: Public product freshness and configuration visibility

**Files:**
- Create: `tests/integration/tsconfig-resolution.test.ts`, `tests/e2e/tsconfig.spec.ts`
- Modify: `apps/web/src/app/Navigation.tsx`, `apps/web/src/i18n/zh.ts`, `apps/web/src/i18n/en.ts`
- Document: `README.md`, `docs/environment.md`, `docs/superpowers/readme-coverage.md`, `docs/superpowers/state.md`

**Interfaces:**
- Consumes: existing project open/refresh/summary/function-context/approval/routes HTTP endpoints and MCP tools; Task1 coverage.configurationFiles optional, Task2 checker facts.
- Produces: bilingual navigation copy exactly “配置输入”/“Configuration inputs”, count and repository-relative paths; existing summary transports remain shared, without new endpoints/tools.

- [ ] **Step 1: Write a real-product RED regression.** Spawn compiled HTTP and actual SDK stdio against one isolated fixture/store; create and approve a plan and route on alias targetA. Change only config mapping to targetB, refresh, assert old plan/route stale, old approval/snapshot intact and unchanged function IDs. HTTP and MCP function contexts must agree on the new target. Assert config paths are exposed separately from source file counts.
- [ ] **Step 2: Add browser coverage and rendering.** Use T08's existing production Playwright setup. Search actual entry, browse alias call/source, expand diagnostics, show Chinese/English config paths/counts, and render a legacy summary without the optional field. All external browser requests blocked; inspect console/page errors and view saved screenshots.
- [ ] **Step 3: Run meaningful GREEN and final integration checks.** Build changed packages/web and run the new HTTP/MCP integration test and E2E once. Then root build/typecheck/lint/test once on this final integrated change; rerun only affected checks if a failure/change justifies it. Verify own processes/database cleanup and stdout remains protocol-clean.
- [ ] **Step 4: Update current claims and commit.** README and coverage distinguish implemented paths/baseUrl from still missing workspace package/exports/CommonJS/references. Document hash upgrade/legacy compatibility and observed evidence. Commit `feat: expose and verify captured configuration scope`; write exact report and await task and whole-plan review.

## Self-review and execution

Task1 supplies the exact capture/hash/schema interface to Task2; Task2 supplies facts to
Task3's unchanged HTTP/MCP consumers. Every Review Focus line has an owning regression.
No task installs dependencies, changes SQLite tables or implements another README gap.
MVP gates are complete. Task1 at f913eae passed independent review (no C/I/M);
Task2/3 remain pending. Controller's rejected-scope/selected-chain rulings are binding.
The user's autonomous authorization and AGENTS.md unattended exception apply;
execution method is sequential SDD.
