# Whole-review single fix wave report

Status: DONE_WITH_CONCERNS — all six assigned outcomes implemented and covering checks green; exact integrated test provenance and unrun platforms are below. Independent scoped re-review remains the controller's next step.

- Owner: `/root/mvp_whole_fix`, sole implementer, no child agents/reviewers.
- BASE: `be10c8418398f4c6262218bddf137dbba1ec6963`.
- Branch/workspace: `work`, `/workspace/AtlasMode`, existing isolated checkout; `.git` and common dir are identical.
- Final local commit: `56e7f6f6be10072d5dc65e8035bd9add6d1aeddf` (`fix: preserve structural evidence and local service trust`).
- Date: 2026-10-03 UTC. Parent explicitly authorized all four Important and two Minor findings as one complete wave.
- Skills used: Superpowers TDD, systematic-debugging, receiving-code-review, verification-before-completion; using-superpowers/cloud skills loaded. Finishing-a-development-branch and requesting-code-review read for handoff. Existing branch retained by explicit assignment; controller dispatches the sole independent re-review, no integration menu or user wait.

## Outcomes

### WR-I1 — Exclusion/unavailability is not deletion

Added optional, legacy-readable `coverage.availability: { complete, unavailablePaths, excludedPaths? }` to shared model/schema and real indexer output. This exact small extension was proposed to and approved by controller before implementation. No port method, DB migration, source/function count, or future configuration contract was added.

`complete` means enumeration of the eligible analysis universe completed, not that parsing/runtime knowledge is complete. `unavailablePaths` records otherwise eligible source/subtrees omitted by Git ignores, symlinks, read failures or enumeration failures. `excludedPaths` records encountered fixed out-of-scope roots such as `.git`, `node_modules`, `dist` (including same-name links). Direct planned/old path checks consult both; global language candidate/absence searches consult in-scope unavailability and completeness, not fixed excluded dependencies. Enumeration records these roots without descending into them; source reads still use captured bytes and confinement checks. Availability participates in deterministic snapshot fingerprint, outside source counts.

Verification now returns unknown when a required original/target path or parent is unavailable, including approved move source absence. Real tests ignore an unchanged file and a directory, proving both function and relation removals become unknown while source bytes remain unchanged. Removing actual source restores satisfied even with `.git`/`node_modules` present. A fixed dependency symlink also does not poison genuine deletion. Exact positive facts unaffected by an unrelated ignored file remain satisfied; an explicit target under node_modules is unknown. Old snapshots without availability remain readable/approvable; omitted-file deletion cannot be established and is unknown. Existing parse diagnostic handling remains.

### WR-I2 — Local HTTP authority/origin boundary

An `onRequest` hook runs before body parsing and every route/service read/write. Raw Host must be a literal supported loopback authority (`127.0.0.1`, `localhost`, `[::1]`), valid port, and actual listener port on real sockets. A present Origin must exactly equal the HTTP origin of that authority. Foreign Host, foreign/null Origin and unrelated local ports get 403 `UNTRUSTED_REQUEST`; forwarded headers confer no trust. Origin-less local HTTP/MCP works. This is a server boundary, with no blanket CORS or global configuration.

Production remains strict. `developmentProxy:true` explicitly permits loopback:5173 with its own matching Origin; CLI binds it only from `CODEMAP_DEV_PROXY=1`, and the dev launcher gives that variable only to its server child. Existing Vite changeOrigin:false remains appropriate.

Fastify integration covers project/source denial, approval denial with no stored approval, and legitimate local approval. The real CLI process regression uses node:http (Node24 fetch silently substitutes Host), covers both production/dev modes, foreign Host/Origin discovery/source/approval requests, correct local Origin, and reopens real SQLite after shutdown to prove zero approval rows. Dev supervisor regression verifies its server child's opt-in. Current production smoke, actual browser UI approval and real SDK traffic pass. This is not an end-to-end DNS-rebinding exploit audit or a remote preview feature.

### WR-I3 — Cross-file same-name candidate is not a reuse identity

Stable ID or an approved move remains required for positive relation binding. A unique cross-file same-language/qualified-name candidate is uncertain for a call/reuse requirement. The real lifecycle regression replaces B with a differently implemented B in another file and receives unknown, not satisfied. Existing approved moves, stable-ID calls, temporary target binding and conservative removal candidates pass. A sole candidate can conservatively block removal; it does not prove positive identity. No identity migration system added.

### WR-I4 — Mutable callable initializer is not a definite call target

`targetFromSymbol` resolves callable initializers only for const variable declarations. let/var and object/class field initializers are conservatively unresolved; named direct declarations and const controls remain supported. TS and JS reassignment regressions include let, var and mutable object-property calls, while direct/const controls remain resolved. The downstream service regression keeps the obsolete handler node present but proves the overwritten call cannot satisfy approved must_reuse: unknown. Target programs are not executed; no flow engine or tsconfig work.

### WR-M1 — Fixed-target clean provenance

`repositoryProvenance` checks full expected HEAD, `git status --porcelain=v1 -z --untracked-files=all --ignore-submodules=none`, and stable HEAD across the checkpoint. The validator calls it before any capture/startup and at capture completion, storing both results under `evidence.provenance`. Dirty staged, modified, or untracked files are rejected, as is an intervening HEAD change. Four disposable Git regressions pass. The policy deliberately rejects any nonignored dirty file, including supported source.

The first test attempt exposed only missing system-browser override, not a valid behavior RED. It was corrected: one disposable fixture with valid modified TS and system Chromium demonstrated the old validator returned exit 0 on dirty bytes. That is the meaningful RED. Its temporary misleading artifact was removed. No fixed Vite/Flask target was reindexed or browsed. Earlier successful clean-target evidence remains credited at its actual T08 revision/time; I4 can change current call certainty, so old metrics are not relabeled as this code's results. Checkpoints are not a filesystem lock and cannot detect an edit fully reverted between them.

### WR-M2 — Compatibility uncertainty as nonblocking shared warning

Every planned calls/must_call/must_reuse with structurally valid endpoints gets `severity: warning`, `code: COMPATIBILITY_UNKNOWN`, operationIndex, and text explaining unknown interface compatibility / arguments / returns / possible adaptation requiring human review. Structural approval remains allowed. Existing service/API/MCP/UI issue adapters preserve the same issue; no UI-only masking and no type inference added.

Three core cases pass. Real HTTP validation equals SDK validate_plan; proposed/approved PlanDetail preserves warnings and valid approval. Production browser explicitly sees the warning, SDK sees the same warning code/severity, and user approval succeeds at revision16. A dedicated warning screenshot and light/dark post-approval screenshots were actually viewed.

## Exact verification ledger

All commands below ran in `/workspace/AtlasMode`. Logs are under `.superpowers/sdd/2026-10-03-local-planning-mvp/scratch/whole-fix/` (abbreviated `logs/` below). Shell capture preserved exit codes (`result=$?; ...; exit $result`). Filtered tests marked skipped are unselected cases, not disabled tests.

| Command | Actual result | Log |
| --- | --- | --- |
| `npm test -- apps/server/src/server.test.ts -t 'authorities\|development proxy'` | RED exit1; 2 failed/11 unselected, expected403 got200 | i2-red.log |
| `npm test -- apps/server/src/server.test.ts` | GREEN exit0; 13 passed | i2-green.log |
| `npm test -- tests/integration/workspace-lifecycle.test.ts -t 'unique differently'` | RED exit1; 1 failed/24 unselected, expected unknown got satisfied | i3-red.log |
| `npm test -- tests/integration/workspace-lifecycle.test.ts -t 'unique differently\|maps moved\|removing a function\|new temporary'` | GREEN exit0; 4 passed/21 unselected | i3-green.log |
| `npm test -- packages/indexer/src/index.test.ts tests/integration/workspace-lifecycle.test.ts -t reassigned` | RED exit1; 3 failed/57 unselected, TS/JS obsolete resolved edges and reuse satisfied | i4-red.log |
| `npm test -- packages/indexer/src/index.test.ts -t reassigned` (expanded var/property fixture) | RED exit1; 2 failed/32 unselected | i4-expanded-red.log |
| `npm test -- packages/indexer/src/index.test.ts tests/integration/workspace-lifecycle.test.ts -t 'reassigned\|resolves TS\|indexes JS\|getter\|dynamic calls'` | GREEN exit0; 8 passed/52 unselected | i4-green.log |
| `npm test -- tests/integration/workspace-lifecycle.test.ts -t 'ignoring unchanged\|unavailable source cannot'` | RED exit1; 3 failed/26 unselected: file/directory deletion false success and excluded target unmet | i1-red.log |
| `npm run build -w @codemap/core` | exit0, required refreshed shared declaration/schema output | i1-core-build.log |
| `npm test -- tests/integration/workspace-lifecycle.test.ts packages/indexer/src/index.test.ts` | First GREEN attempt exit1: 61 passed/2 existing nested-ignore failures; directory-only input sliced to empty under its own nested rule | i1-green.log |
| same command after skipping directory's own nested rule | GREEN exit0; 63 passed/2 files | i1-green-corrected.log |
| `npm test -- tests/integration/workspace-lifecycle.test.ts -t 'fixed excluded dependency\|legacy snapshots'` | RED exit1; 1 failed/1 passed/29 unselected: node_modules symlink incorrectly poisoned scope | i1-scope-red.log |
| same command after fixed-name scope handling | GREEN exit0; 2 passed/29 unselected | i1-scope-green.log |
| `npm test -- packages/core/src/validation.test.ts -t 'compatibility is unknown'` | RED exit1; 3 failed/51 unselected, issues[] lacked warning | m2-red.log |
| `npm test -- packages/core/src/validation.test.ts` | GREEN exit0; 54 passed | m2-green.log |
| `npm test -- tests/integration/repository-provenance.test.ts` before guard | Exit1, 3 failed; browser executable unavailable after old code reached capture. This is setup/harness failure, not credited behavior RED | m1-red.log |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test -- tests/integration/repository-provenance.test.ts -t 'rejects modified'` | Meaningful RED exit1; 1 failed/2 unselected because old dirty validator returned0; disposable fixture only | m1-behavior-red.log |
| `npm test -- tests/integration/repository-provenance.test.ts` | GREEN exit0; 4 passed, no browser startup needed | m1-green.log |
| `npm run build` | Exit0, all seven workspaces | build.log |
| `npm run typecheck` | Exit0, all seven; root script also rebuilds dependency outputs by design | typecheck.log |
| `npm run lint` | Exit0 | lint.log |
| `npm test` | **Only full integrated run**: 220 executed/22 files; 218 passed, 2 new harness cases failed; 30.24s | full-test.log |
| `npm test -- apps/server/src/index.test.ts tests/integration/mcp-stdio.test.ts -t 'CLI enforces listener\|HTTP user approval'` | GREEN exit0; corrected 2 failed cases pass/14 unselected; 7.35s | integrated-harness-corrected.log |
| `npm test -- apps/server/src/index.test.ts -t 'CLI enforces listener'` after adding actual source/approval/no-side-effect checks | GREEN exit0; 1 passed/4 unselected; 1.91s | i2-real-authority-green.log |
| `npm run smoke` | Exit0: production assets, TS/Python HTTP/SDK browsing, no target execution, persistent restart | smoke.log |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` | Exit0: 1 passed, no failed/skipped; 10.2s test/11.2s runner | e2e.log |
| `npx eslint apps/server/src/index.test.ts tests/integration/mcp-stdio.test.ts tests/e2e/planning.spec.mjs` | Exit0 after final test-only request/assertion edits | final-test-lint.log |
| `node --check scripts/repository-provenance.mjs`, `node --check scripts/validate-repository.mjs`, `node --check scripts/dev.mjs` | All exit0 | tool transcript |
| `sha256sum --check docs/superpowers/vendor.sha256` | Exit0, vendored workflow unchanged | vendor.log |
| `git diff --check` | Exit0 | tool transcript |

Full-run failures were explicitly diagnosed and corrected only in new harness requests:
1. `CLI enforces listener authority...`: Node24 fetch ignored custom Host. Minimal local HTTP probe showed actual emitted Host remained the listener address for both requested foreign ports. Replaced with node:http, retaining actual production port enforcement and adding real source/approval denial plus persisted no-side-effect checks.
2. `HTTP user approval and SDK share...`: new validate POST had JSON Content-Type but no body, so Fastify correctly returned400 INVALID_INPUT. Added `{}` to that test request.

No product code changed after the integrated run. Controller explicitly accepted focused-only reruns. This report does **not** claim a new full220 GREEN run; 218 passed in the integrated run and the two failed harness checks passed when corrected, with the one enhanced real-authority case passing afterwards. Build/typecheck correspond to final product code; later changes are tests/docs only. Expected terminal NO_COLOR/FORCE_COLOR warning in Playwright was not an application console/page error.

## Browser evidence actually inspected

Current outputs under `artifacts/e2e/`:
- `compatibility-warning.png`: readable orange COMPATIBILITY_UNKNOWN warnings, normal confirmation action remains enabled.
- `desktop-light.png`, `desktop-dark.png`: approved revision16 with valid approval and warnings displayed together; graph/plan layers remain readable at desktop viewport.
- `narrow.png`: editor moves below graph; full graph is small and zoom/pan remains necessary, as already documented. No new responsive layout work claimed.
- `source.png`: source/call location and copy controls visible.
- `joint-flow-evidence.json`: errors[], external[], actual navigator.clipboard.readText, approval timestamp `2026-10-03T01:46:13.750Z`, revision16/hash `dd3888680bb47dd48bcfd83153beaca0ad52c7d8e922fd642a48c5096670e1dc`, JSON3828B/Markdown4016B; real restart and satisfied/unmet/unknown flows preserved.

These current artifacts are ignored and local. Fixed-target screenshots/metrics were not regenerated or claimed as current implementation evidence.

## Changed files and self-review

- Shared contracts: `packages/core/src/model.ts`, `validation.ts`, `validation.test.ts`; `docs/superpowers/contracts.md`.
- Source evidence: `packages/indexer/src/scan.ts`, `index.ts`, `typescript.ts`, `index.test.ts`.
- Verification: `packages/service/src/verification.ts`; `tests/integration/workspace-lifecycle.test.ts`.
- Local HTTP boundary/dev launch: `apps/server/src/server.ts`, `index.ts`, `server.test.ts`, `index.test.ts`, `dev.test.ts`; `scripts/dev.mjs`.
- Validator provenance: new `scripts/repository-provenance.mjs`, updated `scripts/validate-repository.mjs`; new `tests/integration/repository-provenance.test.ts`.
- Shared adapter/visual evidence: `tests/integration/mcp-stdio.test.ts`, `tests/e2e/planning.spec.mjs`.
- Honest user/state evidence: `README.md`, `docs/environment.md`, `docs/superpowers/readme-coverage.md`, `docs/superpowers/state.md`.

Self-review examined complete changed production paths, schema legacy optionality/fingerprinting, fixed scope versus missing evidence, supported move/candidate distinctions, mutable binding controls, actual Host handling and early rejection, no approval side effect, warning transport/approval semantics, Git checkpoint ordering, and exact revision/test claims. Package boundaries remain intact: pure core, indexer capture/parsing, service business logic, HTTP/MCP/UI adapters; no target execution or direct service filesystem reads. Existing named skills/dependencies/lockfile/vendor unchanged. No databases, caches, public target copies or credentials staged. A rejected `rm -f` cleanup command was not executed; generated disposable artifacts were subsequently removed by exact-path unlink only. No push/publication/global client change/worktree or subagent occurred.

## Remaining concerns / limits for scoped reviewer

- Sole independent re-review is pending; this is implementer self-review, not independent approval.
- Legacy omitted-file evidence is intentionally unknown; broad in-scope read/exclusion ambiguity may conservatively withhold a deletion result. Fixed excluded dependencies do not imply unknown for genuine source deletion.
- Mutable initializers are conservative unresolved; no full runtime/rebinding/flow proof or future tsconfig resolver is claimed.
- Provenance checkpoints cannot detect edits reverted between checks; no hostile filesystem race-proof snapshot mechanism is claimed.
- Full-suite provenance is mixed as explicitly reported (218 initial passes + 2 corrected focused passes), not a fresh complete all220 GREEN run.
- Native Windows/macOS, remote CI, actual Codex/Claude registration/sessions, fresh-task recovery and publication remain unrun. Earlier fixed Vite/Flask evidence remains tied to T08 revision/time.

Final delivery check: local commit above contains exactly25 wave files; `git status --short` empty after commit. Ignored report/logs/screenshots remain local and are not falsely claimed as Git-persisted evidence.
