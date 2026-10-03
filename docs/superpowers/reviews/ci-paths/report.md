# CI temporary-root path repair

Baseline: `62012d3`; GitHub Actions run `37141517790`. Local verification: Linux, Node 24.19.0, npm 11.9.0, 2026-10-03 UTC.

The configuration/package fixtures returned raw `mkdtemp(tmpdir())` paths while production metadata capture resolves its root with `realpath`. Windows short user-directory names and macOS `/var` aliases therefore caused exact-path `fs.open` fault injection and read-count assertions to miss production paths; the symlink no-read assertion also expected a noncanonical root. The development fixture compared a raw root with the child's canonical `process.cwd()`.

All three fixture helpers now resolve newly created roots with `realpath`. Production security logic, budget limits, unreadable/growth injection, no-read/read-count assertions, and shutdown assertions remain unchanged. Added real directory alias parents using `symlink(..., "junction")`, supported on Windows and POSIX, to exercise this condition on Linux. Each indexer regression requires an unreadable input to remain uncaptured with a redacted diagnostic; the development regression reuses the full prerequisite-build/cwd/shutdown/child-reaping checks. Alias containers are removed by fixture cleanup.

## RED evidence

Before adding fixture `realpath`, ran:

```sh
npx vitest run packages/indexer/src/configCapture.test.ts packages/indexer/src/packageCapture.test.ts apps/server/src/dev.test.ts -t 'aliased'
```

Vitest: **3 failed, 53 deselected**, 3 failing files, 1.14s. Both metadata regressions captured `{}` bytes because canonical open paths missed raw-root fault injection. The development regression received `.../actual/.../apps/web` while expecting `.../alias/.../apps/web`. Raw output: `/tmp/atlas-ci-paths-red.log` (local ephemeral evidence).

## GREEN evidence

- `npx vitest run packages/indexer/src/configCapture.test.ts packages/indexer/src/packageCapture.test.ts apps/server/src/dev.test.ts`: exit 0, **56 passed / 3 files**, 3.00s, no failures or skipped tests.
- `npx eslint packages/indexer/src/configCapture.test.ts packages/indexer/src/packageCapture.test.ts apps/server/src/dev.test.ts`: exit 0, no diagnostics.
- `npm run typecheck --workspace @codemap/indexer --workspace @codemap/server`: exit 0 for both workspaces. These standard package checks exclude test files according to their tsconfig; Vitest transforms and executes the tests.
- `git diff --check`: exit 0.

No dependencies, lockfiles, vendored skills, or production files changed. No commit or push performed. Root suite/build/review are delegated to the controller and are not claimed here. Native Windows/macOS reruns remain pending remote CI; Linux aliases reproduce the path mismatch but do not replace native-platform evidence.

## Controller checks on the repaired tree

Clean `npm ci --cache /tmp/atlasmode-npm-cache`: 410 packages installed.
Root `npm run build`, `npm run typecheck`, `npm run lint`, and `npm run smoke`
all exited 0. Smoke exercised actual compiled assets, TS/Python HTTP/SDK,
nonexecution and persistent restart. `npm test`: **540 passed / 30 files**, 58.37s,
no failures/skips. Vendored workflow checksum check passed. Root raw logs are
`/tmp/atlasmode-ci-{build,typecheck,lint,smoke,tests}.log` in this workspace.
