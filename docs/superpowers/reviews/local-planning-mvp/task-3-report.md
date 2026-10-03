# T03 implementation report

Status: DONE. Implementation base: a930fadfb131764edaa88b66cf09c8d6c475354f.
Controller separately committed the capability-identity contract update (4dc20d6) during this task.
Implementation commit: f2d1b11ce851c8b517e3f6ed780846b8281e3a14 — feat: persist workspace planning and approval lifecycle.
Post-commit git status is clean.

## Implemented

- Actual better-sqlite3 StoragePort: parent directory creation, WAL, recorded/repeatable SQL migration, kind/id JSON records, overwrite/delete/list, synchronous nested transactions and rollback, safe repeated close. Native async transaction callbacks are rejected before invocation; returned thenables also reject/roll back.
- Every contracted WorkspaceService method implemented. Internal production imports use only the core public entry point; filesystem reads remain in SourceIndexer. Project paths use Node path resolution. Project creation is persisted only after successful indexing.
- Refresh queues serialize each project's index writes while allowing other projects to progress. Failed indexing retains the prior snapshot and does not poison the queue. Existing snapshots are never overwritten or removed; routes/groups/policies/layout and approved history survive refresh.
- Strict plan input fields prevent draft-input approval forgery. expectedRevision protects updates and approvals. approvePlan refreshes before a fresh plan read and synchronous transaction. SHA-256 semantic content, revision, baseline and user approval are saved atomically. Approved Plan copies are stored under `settings` keys `approved-plan:<approval-id>`; Approval records remain the exact public entity. Current draft changes retain historical approvals.
- getPlan derives validity from current snapshot ID/hash, current revision/hash, approval history and current policy validation. Layout writes are independent. createPlan rejects an explicitly supplied obsolete baseline. JSON/Markdown exports include current validity and approved revision/hash/full approved Plan.
- verifyPlan refreshes and uses the latest actually approved historical revision, even if a later draft exists. Structural checks bind temporary functions by path/name/language/optional signature, bind existing symbols by stable ID or qualified identity, handle moves/removals/direct calls, report ambiguous/dynamic/diagnostic evidence as unknown, and always keep annotation semantics unknown. Removal relations map current factual endpoints independently of unfulfilled planned moves.
- Routes require current snapshot/valid node and call-chain evidence. Groups check project ownership/function members; policies normalize and reject unsafe paths; views validate finite coordinates. Safe source reads delegate to the injected port and reject unavailable support.
- Controller-authorized indexer change: snapshot identity now incorporates a deterministic SHA-256 fingerprint of nodes/relations/diagnostics/coverage. createdAt/gitRevision are excluded; root paths in diagnostic messages are normalized for the fingerprint. contentHash remains source-byte-only. Python unavailable → available with identical bytes produces a different immutable snapshot; repeated identical analysis retains its ID.
- Storage/service package `files` declarations include compiled runtime files and storage migration SQL, without version/dependency/lockfile edits.

## TDD evidence (actual commands and outputs)

1. Storage initial test import first reported missing `./index.js` (no implementation existed). After adding a throwing interface skeleton, the feature-level RED was:
   - `npx vitest run packages/storage/src/sqlite.test.ts`
   - `Tests 3 failed (3)`, each `Error: SQLite persistence not implemented` at constructor.
   - Implemented SQLite/migration/transaction methods, then identical command: `Test Files 1 passed (1); Tests 3 passed (3)`.
2. Capability identity RED:
   - `npx vitest run packages/indexer/src/index.test.ts -t 'changes snapshot identity'`
   - `Tests 1 failed | 31 skipped (32)`; `expected 'snapshot:00aa3fa85f929c19458af958a86f…' not to be 'snapshot:00aa3fa85f929c19458af958a86f…'`.
   - After fingerprint implementation: identical command `Tests 1 passed | 31 skipped (32)`; `npm run build -w @codemap/indexer` exit 0. Controller notified `indexer dist ready`.
3. Workspace lifecycle RED:
   - `npx vitest run tests/integration/workspace-lifecycle.test.ts`
   - `Tests 16 failed (16)`; all hit the temporary `Workspace lifecycle not implemented` constructor.
   - After full service implementation: identical command `Test Files 1 passed (1); Tests 16 passed (16)`.
4. Supplemental async race/rollback/latest-history tests (existing implementation already passed):
   - `npx vitest run packages/service/src/workspace.test.ts tests/integration/workspace-lifecycle.test.ts`
   - `Test Files 2 passed (2); Tests 22 passed (22)`.
   - These are regression coverage, not claimed as separate observed RED cycles.
5. Self-review regression RED:
   - `npx vitest run packages/storage/src/sqlite.test.ts tests/integration/workspace-lifecycle.test.ts -t 'unimplemented move|ambiguous candidates|runtime null|async callbacks'`
   - Async callback: expected undefined, received `invalid` after callback's await.
   - Unimplemented move/removal: expected `['unmet','unmet']`, received `['unmet','satisfied']`.
   - Null edit: `expected [Function] to throw an error`.
   - A fourth failure was a bad test premise: duplicate same-name function declarations in one file are one indexer symbol, so they cannot prove multiple candidates. Replaced this fixture with actual distinct same-qualified functions in two files; no indexer expansion was made.
   - Individual fixes and GREEN commands:
     - `npx vitest run tests/integration/workspace-lifecycle.test.ts -t 'unimplemented move'`: `Tests 1 passed | 20 skipped (21)`.
     - `npx vitest run packages/storage/src/sqlite.test.ts`: `Tests 4 passed (4)`.
     - `npx vitest run tests/integration/workspace-lifecycle.test.ts -t 'runtime null|multiple candidates'`: `Tests 2 passed | 19 skipped (21)`.

## Final verification

- Full current repository suite run once after implementation/fixes/formatting:
  - `npm test`
  - `Test Files 5 passed (5); Tests 112 passed (112)`; duration 1.90s, exit 0, no warnings/errors.
  - Breakdown: core 51, indexer 32, storage 4, service scheduling 4, actual-adapter lifecycle integration 21.
- Dependency-ordered implemented-package validation command, exit 0:
  ```sh
  npm run build -w @codemap/core && npm run build -w @codemap/indexer && npm run build -w @codemap/storage && npm run build -w @codemap/service && npm run typecheck -w @codemap/core && npm run typecheck -w @codemap/indexer && npm run typecheck -w @codemap/storage && npm run typecheck -w @codemap/service && npx eslint packages/core/src packages/indexer/src packages/storage/src packages/service/src tests/integration/workspace-lifecycle.test.ts
  ```
- Packaged-artifact smoke: a Node ESM script ran `npm pack --json --pack-destination <temporary-dir> -w @codemap/storage -w @codemap/service`, extracted both archives, imported their actual dist entry points, created SQLite via packaged SQL, indexed temporary TS using actual SourceIndexer, and approved a plan. Output:
  ```text
  @codemap/storage: 8 packaged files
  @codemap/service: 16 packaged files
  Packaged SQLite migration + service index/approve smoke passed
  ```
  Temporary archives/database/source removed in finally. No target source or database committed.
- `npx prettier --check packages/storage/src packages/storage/package.json packages/service/src packages/service/package.json tests/integration/workspace-lifecycle.test.ts packages/indexer/src/index.ts packages/indexer/src/index.test.ts`: all matched files use Prettier code style, exit 0.
- `git diff --check`: exit 0.
- One formatting invocation initially included SQL; Prettier returned `No parser could be inferred` for the migration. SQL was left formatted manually; final TS/JSON check above passed. This was a formatter capability issue, not an application/test failure.

## Changed files

- packages/storage/src/index.ts, sqlite.ts, sqlite.test.ts
- packages/storage/migrations/001-records.sql
- packages/storage/package.json (packaging files only)
- packages/service/src/index.ts, workspace.ts, planning.ts, verification.ts, knowledge.ts, workspace.test.ts
- packages/service/package.json (packaging files only)
- tests/integration/workspace-lifecycle.test.ts
- packages/indexer/src/index.ts, index.test.ts (authorized snapshot identity fix only)

## Self-review, limits, and not run

- Reviewed all production additions and the focused indexer diff against contracts and boundaries. Fixed removal false positives, async transaction continuation behavior, null coercion, and Windows rooted policy path handling before final verification.
- No server/web/MCP implementation changes, no vendored skill edits, no dependency/lockfile edits, no push. No controller-owned state/contracts changes included in this implementation commit.
- Verification is deliberately conservative: any analysis diagnostic makes symbol-dependent structural conclusions unknown. Annotation semantics and unresolved dynamic calls require human/runtime evidence. Rename inference and richer declaration categories are outside the current public model; ambiguous relocation remains unknown.
- Project refresh serialization is within the WorkspaceService instance (the intended single service/server writer), not a distributed lock for multiple server processes.
- Only approved revisions are preserved as immutable history; draft undo/redo is outside this task.
- No server/web/MCP root build claim: those product workspaces are not implemented yet. No native Windows/macOS, browser/E2E, external-target scale tests or CI remote runs performed in T03. Controller is separately running external-target validation.
- Independent review belongs to controller; no subagents/reviewers dispatched by this implementer.

## Fix round 1 — scoped Important findings

FIX_BASE: f2d1b11ce851c8b517e3f6ed780846b8281e3a14.
Read the complete task-3-review.md. Addressed its three Important findings only.
Fix commit: 5608f100a6d24dd73176015a8b6dd927a90280bd — fix: scope verification evidence and contain async transactions.
Post-commit working tree clean.

### Changes

1. Verification diagnostics now follow the evidence's analysis scope instead of globally poisoning every binding. Exact symbol IDs and planned target paths depend on diagnostics for that file/ancestor subtree. When stable identity is missing and verification searches for relocated symbols or proves removal, incomplete files in the same language family remain relevant (TS/JS together, Python separately, unknown diagnostic paths conservatively relevant). Healthy unambiguous functions and resolved calls retain their positive source evidence despite unrelated broken files; call absence in an otherwise fully analyzed bound source remains unmet. Broken relevant source still yields unknown.
2. Temporary-function move checks derive the original path and symbol match from the add_function operation. A definition retained at that original path makes the move unmet; deleting it with a definition at the destination satisfies the move. An incompletely analyzed original path makes source-removal proof unknown. Existing-function copy protection remains intact.
3. SqliteStorage now scopes each synchronous transaction with instance-local AsyncLocalStorage. The scope closes in finally after commit or rollback; async continuations inherit the closed context, so put/delete/new transaction/close cannot later mutate that storage. Native async callbacks still reject before execution; ordinary Promise-returning callbacks roll back their synchronous writes and their returned promise rejection is observed to prevent unhandled errors from an API that cannot return that promise. Independent callers and nested synchronous transaction scopes retain normal behavior.

### New regression tests and observed RED

Command:
```sh
npx vitest run packages/storage/src/sqlite.test.ts tests/integration/workspace-lifecycle.test.ts -t 'Promise-returning|rejected nested|unrelated diagnostics|temporary function moves'
```
Actual output: `Test Files 2 failed (2); Tests 4 failed | 25 skipped (29)`.

- `Promise-returning callbacks cannot write after rejection while outside and nested writers still work`: expected undefined, received `persisted after rejection`.
- `rejected nested asynchronous contexts cannot delete records or start later transactions`: retained record expected true, received undefined.
- `unrelated diagnostics do not suppress positive structural evidence or complete call absence`: expected `[satisfied, satisfied, unmet]`, received `[unknown, unknown, unknown]`.
- `temporary function moves reject copies and accept a true move`: expected `[satisfied, unmet]`, received `[satisfied, satisfied]`.

These tests were added and run before production fixes. They retain controls for outside writes, synchronous nested transactions, true moves, relevant broken-source unknown, and real source evidence.

### Focused GREEN and final scoped verification

- After storage scope fix: `npx vitest run packages/storage/src/sqlite.test.ts` → `Test Files 1 passed (1); Tests 6 passed (6)`.
- After scope-aware verification/move fix: `npx vitest run tests/integration/workspace-lifecycle.test.ts -t 'unrelated diagnostics|temporary function moves|parse diagnostics|relocated symbols'` → `Tests 4 passed | 19 skipped (23)`.
- Added control `removal absence depends on incomplete files in the symbol's language search scope`: unrelated invalid Python permits a TS removal conclusion; an invalid TS file in its relocation search scope keeps absence unknown. This supplemental test was already GREEN under the scoped fix.
- Final requested covering suites, after formatting:
  ```sh
  npx vitest run packages/storage/src/sqlite.test.ts packages/service/src/workspace.test.ts tests/integration/workspace-lifecycle.test.ts
  ```
  Output: `Test Files 3 passed (3); Tests 34 passed (34)`; duration 1.42s, exit 0, no warnings/unhandled rejections. Breakdown: storage 6, service scheduling 4, actual-adapter lifecycle 24.
- Final implemented-scope checks:
  ```sh
  npm run build -w @codemap/storage && npm run build -w @codemap/service && npm run typecheck -w @codemap/storage && npm run typecheck -w @codemap/service && npx eslint packages/storage/src packages/service/src tests/integration/workspace-lifecycle.test.ts && git diff --check
  ```
  Exit 0 for all commands; lint/diff checks emitted no errors.
- Formatted only the four changed TS files with Prettier. Root suite, core/indexer suites/builds, packaging/scale checks, and other workspaces were not rerun in this scoped fix round, as instructed.

### Self-review and remaining limits

Reviewed both changed production files and the new tests. Only packages/service/src/verification.ts, packages/storage/src/sqlite.ts, packages/storage/src/sqlite.test.ts and tests/integration/workspace-lifecycle.test.ts changed. No dependency, contract, indexer, controller document, other task source, or vendored skill modifications. No subagents or push.

Diagnostic granularity remains conservative at file/subtree level: a syntax problem in the same file can keep its facts unknown even if another portion is well formed. Relocation/removal searches remain conservative over incomplete same-language files. Positive evidence in independent healthy files is no longer suppressed. These are explicit remaining limits, not the previous global-diagnostic behavior.

Transaction containment covers continuations originating inside a transaction on that SqliteStorage instance. It does not block unrelated external writers, which the regression explicitly preserves, and does not provide process-level access isolation. Returning/scheduling asynchronous writes is outside the synchronous transaction contract; those writes now fail instead of persisting after rejection.
