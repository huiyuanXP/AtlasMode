# ONE whole-plan Minor fix wave — captured-tsconfig

Status: DONE implementation/documentation self-review; one fresh scoped re-review and controller residual disposition **PENDING**. No whole-plan closure claimed.

Base: `091687bff3f70e2f94245e758705ac87874a6285`. Same checkout/work branch; sole implementer. Parent confirmed the documentation-only WR-M1 disposition after root-cause evidence. No helper/reviewer, worktree, dependency/lockfile change, global environment/client setting, push or publication.

## Finding outcomes

- **WR-M1: PARTIAL; NOT ADDRESSED codewise.** Documented exact portable future invocations in `docs/environment.md`. Only the invocation's Node process removes inherited `FORCE_COLOR` when `NO_COLOR` exists; it preserves `NO_COLOR` and normal warning/stderr handling. Real conflicting-environment listing RED→GREEN demonstrates CLI cleanup. Installed Playwright1.63.0 `node_modules/playwright/lib/runner/index.js:5447–5455` (`WorkerHost`) unconditionally adds `FORCE_COLOR: "1"`, so real browser workers can recreate the conflict. No shared npm command/support source was changed; no warning-free worker claim. Removing NO_COLOR would disregard user intent; dependency/preload/global patches and warning filtering are outside this wave. Residual host warning is explicit for controller adjudication after the one scoped re-review.
- **WR-M2: ADDRESSED; scoped review PENDING.** Spec opening now says Task1 f913eae, Task2 952bffa, Task3 ab9f8c1 independently approved and whole review0C/0I/2M, with fix-wave scoped review pending. Links authoritative state and prohibits duplicate task dispatch. Plan/state/environment's contradictory current pending-task/whole-review wording is updated to the same stage. Historical task reports/receipts stay untouched.

## Root cause and focused RED/GREEN

Original Task3 `ui-green.log` and `planning-e2e.log` have the exact warning:
`The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.`
App console/page errors and SDK stderr were empty in those product receipts, which is a separate claim.
Existing `tests/support/production.mjs:11–16` already removes FORCE_COLOR for owned product children; it cannot normalize the earlier Playwright worker startup. Installed WorkerHost forces color after inheriting the CLI environment. Its internal webServer defaults also force color (`runner/index.js:827`), but this project does not configure webServer.

Both probes ran in repository root under a Python subprocess with command-only env override `{NO_COLOR: "1", FORCE_COLOR: "1"}`; no host/global variables were changed. Full argument arrays and timestamps/exit codes are in `color-{red,green}-command.json`; merged unfiltered stdout/stderr is in `color-{red,green}-list.log`.

RED command:

```text
node node_modules/playwright/cli.js test --list --reporter=list tests/e2e/tsconfig.spec.ts tests/e2e/planning.spec.mjs
```

Exit0; one authentic color-conflict warning; listed3 tests/2 files. This is a diagnostic expectation failure, **not** a failed product test. No tests executed or browser started.

GREEN/documented future listing command:

```text
node -e "if(process.env.NO_COLOR!==undefined)delete process.env.FORCE_COLOR;process.argv.splice(1,0,'playwright');require('./node_modules/playwright/cli.js')" -- test --list --reporter=list tests/e2e/tsconfig.spec.ts tests/e2e/planning.spec.mjs
```

Exit0; listed the same3 tests/2 files; zero color-conflict warnings and zero ANSI escapes. Each probe took about0.46s (tool wall time). Listing proves CLI startup/discovery only, not browser worker behavior. The documented real-browser variant removes `--list --reporter=list`; it was **UNRUN** in this wave and does not promise clean worker output. Shell-neutral Node/npm syntax is portable; native Windows/macOS are **UNRUN**.

## Relevant verification and preservation

- `git diff --check`: exit0; no output. `verification-commands.json` records exact command/result.
- `git diff --name-only`: exactly four documentation files: `docs/environment.md`, `docs/superpowers/plans/2026-10-03-captured-tsconfig.md`, `docs/superpowers/specs/2026-10-03-captured-tsconfig-design.md`, `docs/superpowers/state.md`. No product/test/support/runner/manifest/lockfile changes.
- Python SHA-256 comparison against actual Task3 `product-source-provenance.json`: **51/51 product source files match**, zero mismatches. `scope-and-fingerprints.json` records observed results and unchanged base HEAD.
- SHA-256 before/after comparison of every Task3 scratch file: **46/46 match**, zero added/changed/deleted files. Baseline manifest `historical-task3-before.json` includes original report/logs/receipt/screenshot bytes. No raw historical warning receipt was rewritten or presented as pristine.
- Status checks reject obsolete `Task2/3 待实施`, `whole-plan review remains pending` and `全计划审查仍待完成` in their formerly current locations. Spec/plan state links resolve to the existing authoritative `docs/superpowers/state.md`. Documented launcher text matches the exact GREEN launcher.
- **Zero** product browser/root/build/typecheck/lint/target gates rerun solely for noise. No full-suite success is newly claimed. Original293/293 and browser/target passes remain receipt-bound Task3 evidence.

## Self-review and limits

Read the binding brief, complete whole-review findings/declined behaviors, current design/plan/state/environment, Task3 report, actual warning logs, installed worker/CLI implementation and existing child normalization. Reviewed complete four-file diff. Documentation states three task approvals, the actual whole review, pending scoped review, NO_COLOR preservation, exact invocation and worker residual consistently. CLI listing sees the same real tests and does not touch historical browser artifacts (`--reporter=list` overrides JSON reporter). No unrelated diagnostic filtering was introduced.

The source fingerprints establish unchanged checked product bytes, not a new runtime/native/CI/client/cloud-restore pass. CommonJS existing defects and all33 whole-review declined capabilities remain with their separate controller dispositions. No installation, Flask/upstream test, target execution, clean smoke, nativeOS/client, remoteCI, fresh restoration or publication claim added. Final whole-plan acceptance is controller-owned; await **ONE** fresh scoped re-review.

Commit: `f860e198a59e848b8de7840a530a7ec4892782b9` — `docs: correct captured-tsconfig status and runner guidance`.
`git status --short` after commit: exit0, no output; tracked working tree clean. Scratch evidence/report is intentionally ignored and retained locally. Await the single fresh scoped re-review; no further fix wave is authorized here.
