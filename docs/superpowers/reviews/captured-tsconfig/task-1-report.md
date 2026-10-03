# Task1 report — DONE

Base: `808fa43`; branch: `work`; workdir: `/workspace/AtlasMode`.
Commit: `f913eae87b4bb5a574775dac26fa8e9d4ead7b5b`
`feat: capture bounded tsconfig inputs in snapshots`.
Task1 only; no resolver/UI implementation. Independent task review is pending.

## Changes and contract

- Added `captureConfigurations(root, allowedPaths): Promise<{files: SourceFile[]; diagnostics: CodeSnapshot["diagnostics"]}>`; `SourceFile={path:string;bytes:Buffer}`. scan returns separate `configurations`; source file coverage/nodes/counts remain source-only.
- Seeds are eligible ordinary `tsconfig*.json` files. TypeScript's installed pure JSONC parser reads captured bytes; relative `.json` extends strings/arrays normalize Windows separators, deduplicate paths and traverse deterministically. Other eligible JSON files are captured only through extends. No package/node_modules/network lookup, compiler target disk host, target execution or new dependency.
- Exact inclusive limits:262144 bytes/file,4194304 total bytes,512 successful files,16 levels (seed=level1,level17 rejected). Checks use actual opened handle stat before read and bounded bytes after read. Directory/file symlinks are rechecked; NOFOLLOW applies where available; inode/location checks precede reading. Every file is opened/captured once, reused for parse/hash; bounded temporary read storage is copied to length-sized retained buffers. Shared DAG expansion is bounded by path/depth memoization.
- Invalid JSONC bytes remain captured/hash inputs; read/budget-rejected bytes do not. Diagnostics use normalized configuration filePath and sanitized reason; no config source text or raw exception echo. Unavailable relative targets are reported separately by normalized target path. Capture diagnostics sort by path/message; enumeration diagnostic order is deterministic.
- Added optional `coverage.configurationFiles` type/schema, repository-relative path validation and legacy schema compatibility. No SQLite migration or public IndexerPort change.
- Hash is SHA-256 over `codemap-index-inputs-v2\0`, then deterministic source/configuration groups containing type/path-length/path/byte-length/bytes. Existing immutable fact fingerprint still participates in snapshot ID. Configuration-only, inherited-invalid and whitespace edits change hash/ID while function IDs and the prior returned object remain intact. The hash upgrade conservatively invalidates old baselines on refresh; history is not rewritten.
- Preserved existing source exclusions, nested ignores, source symlink availability evidence, Python behavior, stable identities and const/mutable-call regressions. Configuration seed rejection does not add metadata to source availability/counts. Existing generic non-seed symlink evidence remains unchanged.

## Controller ruling and Task2 dependency

Controller explicitly ruled that an enumerated ignored/symlinked/unreadable/nonregular nearest config must remain an opaque rejected nearest scope, so ancestor alias fallback cannot occur. Task1 uses the stable existing diagnostic **message prefix** `CONFIGURATION_UNAVAILABLE:` plus normalized filePath (no new diagnostic field). scan emits it for rejected enumerated seeds; bounded capture emits it for read/budget failures. Three focused tests cover ignored/symlinked/unreadable config adjacent to included source; none exposes bytes, counts metadata as source, or adds a rejected seed to source availability.

Controller approved the optional internal Task2 argument:
`createConfigurationResolver(sources, configurations, captureDiagnostics=[])`, supplied from scan through indexTypeScript integration. Parent will update the Task2 plan/spec interface after this gate. This argument is not implemented in Task1. Task2 must independently validate each selected config's extends chain: a separate seed can capture bytes that another chain cannot use because of depth/cycle/budget rejection. Global capture presence is not proof that that chain can partially apply paths/baseUrl. Fixed excluded directories need not be traversed because they contribute no captured source.

## TDD evidence and diagnoses

All logs below are in this same ignored task workspace. No completed MVP scratch was accessed.

1. Wrote capture/schema/index identity tests before feature implementation. Initial command `npx vitest run packages/indexer/src/configCapture.test.ts packages/core/src/validation.test.ts` exited1: capture suite could not import the absent module; schema62 ran with1 failed/61 passed (`configurationFiles` unknown). `task-1-red-initial.log`.
2. Added only an empty interface scaffold returning empty arrays to permit behavioral RED. The same command initially exited1 with20 failed/61 passed (81 total), including native ESM open-spy harness errors. Root cause: native ESM exports cannot be reassigned; switched to a wrapper retaining real filesystem implementation. One intermediate wrapper run still failed because its saved open reference referred to the same mocked function; use the actual native open and reset the wrapper between tests. Intermediate evidence: `task-1-red.log`, `task-1-red-corrected.log`, `task-1-red-behavior.log`.
3. Corrected harness and missing-field assertion; reran the exact capture/schema command **before implementation**, exiting1 with20 behavioral failures/61 passes (81 total; no skipped). Missing capture, diagnostic and schema behavior: `task-1-red-final.log`.
4. `npx vitest run packages/indexer/src/index.test.ts -t 'configuration-only|invalid configuration bytes|source-only indexing'` exited1:3 failed/34 unselected. Existing hashes unchanged by config edits and missing metadata field: `task-1-identity-red.log`.
5. After capture/schema composition, capture/schema command exited1 with80 passed/1 failed. Generic unavailable-extends diagnostics had been deduplicated together; distinct normalized targets now remain visible: `task-1-green-initial.log`.
6. `npx vitest run packages/indexer/src/configCapture.test.ts packages/core/src/validation.test.ts packages/indexer/src/index.test.ts` exited1 with115 passed/3 failed. Root cause: indexer tests import the public **built** core package, still containing old schema. `npm run build --workspace @codemap/core` exited0; exact test rerun exited0 with118/118 passed,3 files. Logs: `task-1-green-focused.log`, `task-1-core-build.log`, `task-1-green-focused-built.log`.
7. Supplemental post-read boundary mutation check: two real file-growth fixtures grow after handle.stat (single-file and total budgets). Temporarily disabled only the post-read budget guard, then `npx vitest run packages/indexer/src/configCapture.test.ts -t 'grow past'` exited1:2 failed/19 unselected, because oversized inputs were accepted. Restored the exact original production file and reran: exit0,2 passed/19 unselected. Logs: `task-1-postread-red.log`, `task-1-postread-green.log`; pre-mutation source retained in `task-1-postread-before-mutation.ts`. This was a supplemental mutation RED, not the pre-implementation RED run.
8. New controller-ruling tests first: `npx vitest run packages/indexer/src/configCapture.test.ts -t 'nearest config'` exited1:3 failed/21 unselected (missing stable rejected-scope marker). Implemented marker; exact command exited0:3 passed/21 unselected. Logs: `task-1-unavailable-red.log`, `task-1-unavailable-green.log`.

## Final verification

On final product source after all fixes, the following commands completed:

| Command | Outcome | Log |
| --- | --- | --- |
| `npx vitest run packages/core/src packages/indexer/src` | exit0;130 passed/4 files;0 failures,0 skipped | task-1-packages-test.log |
| `npm run build --workspace @codemap/core` | exit0 | task-1-core-build-final.log |
| `npm run build --workspace @codemap/indexer` | exit0 | task-1-indexer-build-final.log |
| `npm run typecheck --workspace @codemap/core` | exit0 | task-1-core-typecheck-final.log |
| `npm run typecheck --workspace @codemap/indexer` | exit0 | task-1-indexer-typecheck-final.log |
| `npm run lint` | exit0;root ESLint | task-1-lint-final.log |
| `git diff --check`; `git diff --cached --check` | exit0;no whitespace errors | tool output |
| `sha256sum --check docs/superpowers/vendor.sha256` | exit0;all75 checksum entries verified (74 skill files plus license) | tool output |

130 tests comprise core validation62,core queries7,indexer37,configuration capture24. No test disabled or assertion weakened. Node24.19.0/npm11.9.0 verified. Final doc wording/verification counts were recorded after product checks; staged checks passed before commit. `git status --short` after commit emitted nothing.

## Self-review and limits

Self-reviewed all10 changed files and each Task1 step/global constraint. Captured bytes feed both diagnostics and hash; config never becomes a source CodeNode; rejected sentinel paths are not opened; opened oversized files are not read; exact file/count/depth/total boundaries and Windows separators are covered. Legacy snapshots omit the optional field successfully. Core remains pure; scan owns I/O; TypeScript resolver is unchanged. No Critical/Important concern found in self-review; this is not an independent review.

No source/HEAD race with controller, additional worktree/subagent/reviewer, remote push/publication, DB/service/port process, dependency/lockfile/vendor/global client config change or secret handling. Managed environment status was read via cloud runtime/setup guidance; the existing installed workflow was sufficient, so no setup/draft fields were changed. Current-instance checks are distinct from existing saved cloud drafts/publication.

Root full suite/build/typecheck, service/HTTP/MCP/UI/E2E and native Windows/macOS are intentionally not claimed; the brief assigns full integrated verification to Task3. Task2/Task3 remain outstanding by design, with Task1 gate awaiting controller's fresh independent reviewer. The existing documented limit against arbitrary concurrent filesystem races remains; handle/component checks do not claim a platform-independent race-proof directory descriptor traversal.
