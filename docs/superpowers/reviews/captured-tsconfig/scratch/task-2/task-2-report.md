# Task2 implementation report

Status: DONE; awaiting controller-owned independent review.
Base: 27702f71cd7b152e5df5b497591fd8df8868c112.
Commit: 952bffa (feat: resolve captured tsconfig aliases by source scope).
Scope: captured-tsconfig Task2 only. No helpers/reviewers spawned.

## Implemented

- New internal createConfigurationResolver(sources, configurations,
  captureDiagnostics=[]) with the exact resolutionHost/diagnostics/
  configuredAlias interface. TypeScript integration takes captures third and
  scanner diagnostics fourth; SourceIndexer forwards both.
- Captured-only InMemoryFileSystemHost, public ts-morph configuration APIs
  backed by installed TypeScript JSONC/config parsing and include/exclude
  enumeration. Nearest tsconfig.json plus opaque scanner rejection scopes;
  parsed root-file ownership, no ancestor fallback, no named-config guessing
  or references expansion. Config parsing projects skip dependencies/noLib.
- Selected seed independently validates relative JSON extends (arrays and
  Windows separators), depth1..16, missing/rejected parent, cycle, malformed
  JSONC and unsupported/outside extends. Validation memoizes successful
  path/depth subtrees within each seed; no rejected chain contributes partial
  options. Config parser diagnostics expose TS error codes, not raw contents.
- Per-scope module-resolution caches and supported option subset; inherited
  paths/baseUrl declaration locations preserved. A synthetic virtual repository
  directory prevents escaping ../ paths clamping back into captured sources.
  Only captured source resolutions enter the checker; declaration extraction
  and stable IDs are unchanged.
- Configured unavailable aliases yield unresolved import/call edges and scoped
  configuration diagnostics. Unconfigured bare externals, relative imports,
  default/namespace/re-export declaration identity and ambient unknowns retain
  their classifications. No runtime execution or real disk compiler host.
- Added 31 focused resolver tests and 6 scanner/SourceIndexer integration tests;
  documented exact supported semantics and limits in contracts.md.

## TDD and debugging evidence

All logs under scratch/task-2/ in this active plan workspace.

1. `npx vitest run packages/indexer/src/configResolution.test.ts packages/indexer/src/index.test.ts`
   before implementation: 21 failed /46 passed (67 total). Expected alias
   resolution/unknown classification/config diagnostic failures. `red.log`.
2. First resolver GREEN: 30/30. `green-first.log`.
3. Self-review found the virtual filesystem root could clamp `baseUrl: ../`
   back onto captured lib/helper.ts. Added regression before correction;
   RED1 failed/30 skipped (`red-root-escape.log`). Synthetic child-root
   translation fixed the actual cause; GREEN31/31 (`green-root-escape.log`).
4. SourceIndexer forwarding regression with third/fourth integration arguments
   removed: RED3 failed/3 passed/37 skipped (`red-integration.log`), restored
   integration GREEN6 passed/37 skipped (`green-integration.log`).
5. Opaque-nearest scanner-diagnostic forwarding mutation (fourth argument only
   removed): RED3 failed/40 skipped (`red-scope-diagnostics-mutation.log`).
   The final affected suite below restores both arguments and covers all three.
6. Initial typecheck found two API-shape mistakes: public ts-morph Diagnostic
   uses getCode(), RuntimeDirEntry uses name. Inspected installed declarations,
   fixed the accesses, subsequent build/typecheck passed. `typecheck-first.log`
   retains the initial errors; no failing check is omitted.

## Final affected verification

- `npx vitest run packages/indexer/src packages/core/src/validation.test.ts`:
  PASS160/160,4 files, no skips/failures,2.33s. `affected-tests.log`.
  Includes source/Python/symlink/ignore/stable-ID/const-vs-mutable regressions,
  configuration capture limits and optional core snapshot-schema validation.
- `npm run build -w @codemap/core -w @codemap/indexer`: both PASS (`build.log`).
- `npm run typecheck -w @codemap/core -w @codemap/indexer`: both PASS
  (`typecheck.log`).
- `npm run lint`: PASS (`lint.log`).
- `git diff --check`: PASS before commit; working tree clean after commit.
- Test title wording alone was corrected after final checks (the array test
  checks last-parent precedence, not a separate child override fixture).

## Self-review / bounds

Reviewed the complete new resolver, tests and integration diff against Task2
ownership, chain rejection, captured input, cache and identity requirements.
No declarations, mutable-call handling, Python or public schema/port changed.
Only six planned Task2 files changed. Dependencies/lock/vendor/global settings,
real target repos and worktree layout unchanged. No push/publication.

Root full suite, HTTP/MCP/UI lifecycle, browser screenshots and mature-target
benchmarks were deliberately not run: Task3 owns final integrated verification.
Native Windows/macOS not run. Windows-relative extends are covered on Linux.
Unreadable opaque scope is exercised via supplied capture diagnostic; actual
scanner integrations cover ignored, symlink and oversized rejected nearest
configs without requiring root-user filesystem permission assumptions.

No workspace/package-exports/imports, project-reference graph, build-output
mapping, dynamic-import or new CommonJS analysis. Existing CommonJS binding
limitations reported by the controller remain future-ticket scope; this task
makes no claim to prove runtime values. Config projects perform membership
parsing per selected scope; no new large-target performance claim is made.
Historical completed MVP archives/scratch tasks were not reopened.
