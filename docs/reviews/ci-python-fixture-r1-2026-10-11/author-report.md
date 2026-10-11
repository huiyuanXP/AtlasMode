# CI Windows R1 mechanical integration — author report

2026-10-11 UTC. Status: mechanical candidate ready for parent independent three-file review and parent-controlled publication/remote CI. This author report is not an independent approval. Windows remains UNRUN.

VM2 worktree: `/tmp/atlas-ci-windows-r1-integration-20261011/workspace`; branch `ci/python-fixture-r1-20261011`; HEAD `0991dbc962981c4aa1b1a13473fce66abd6b8502`. Freeze: `/tmp/atlas-ci-windows-r1-integration-20261011/freeze`. Local evidence mirror: `ci-windows-r1-integration/freeze`.

## Scope and provenance

Read AtlasMode AGENTS and local using-superpowers/Codex adaptation, SDD, TDD, verification, using-git-worktrees, README and state; read the original I1 freeze README and independent limited rereview. No subagent, production parser change, semantic timeout change, domain assertion change, shared build/source edit, stage, commit or push. Parent alone publishes.

Copied all 312 entries from `/tmp/atlas-final-fs-kn-pol-20261011-luyk2kob/evidence/candidate-source-final.sha256` into the new worktree with source and destination SHA validation. The dispatch's initial `parent/evidence` path did not exist; the above actual evidence path was found and reported. Receipt `candidate-copy-receipt.json` records all 312. Final receipt checks those same entries again: only `packages/indexer/src/index.test.ts` differs, with the separately authorized new fixture helper and workflow. Production Python SHA stays `898f792acaff8b691122ef58818534590de63d837ee5126fb817feb33e5a2dca`.

Original two-file I1 R1 source was copied byte-for-byte from `/tmp/atlas-ci-python-r1-20261011/freeze/source`, independently SOURCE REVIEW APPROVE only within I1 scope. Its original freeze manifest was freshly verified (all entries OK), its README/review/source hashes are copied additively. Original Windows run 38077305771 two 5s failures and six controlled 19s lifecycle fault runs remain historical evidence; they were not rerun or relabelled. No Linux result or SOURCE APPROVE establishes Windows success.

## Exact three-file before/after

| Path | Before SHA256 | After SHA256 |
| --- | --- | --- |
| packages/indexer/src/index.test.ts | f7f67c73b70d68fbc1f2a8b590d2bb8e0830c3f5c540139526a04deb9189c4c3 | e429a1c8a82789e4ab015cdb90226370eebc1d77ca907a32bd801378d49727eb |
| packages/indexer/test/python-fixture.ts | absent at HEAD0991 and 312 candidate | 5514f23f2f6b04c446eb22b483e39874d191b651ac7b44c1533a3c17462486d9 |
| .github/workflows/ci.yml | a982c07858397e4a55881503748fea499ee34a00d7fa8102a33c6b5844722095 | b34caf035c70ed25130db6ed2a3f2e53db9379c949198c1fb3d038f160a5ecbe |

Exact before and after copies are under `freeze/before` and `freeze/after`. `fixture-from-HEAD0991.patch` is the original frozen complete two-file patch; `index-test-git.patch` is a fresh Git diff. `workflow.patch` is separate and contains only five added lines: native job `POL01_ACCEPTANCE_MODE: "compiled"`; browser job `POL01_PRODUCTION_GATE: "1"` and `POL01_ACCEPTANCE_MODE: "compiled"` with job-level `env` keys. Existing browser spec skips its two cases unless production gate is 1; its fixtures use compiled mode. Native integration selects compiled mode through the acceptance environment variable. Original two-file source freeze was not changed by the workflow addition.

## Fresh executed validation

Runtime Node v24.19.0, npm 11.9.0. Private node_modules initially copied from the accepted candidate while retaining relative workspace links. First private build failed with TS2349 at indexer scan.ts:230 (`ignore` not callable); original `private-build.log` and exit2 remain. No source diagnosis/change was made. A private `npm ci --offline --cache /home/agent/.npm --no-audit` installed 397 packages, exit0. The clean build then passed all seven workspaces, exit0 (20.222s). The retained build chunk-size warning is present. This does not establish the cause of the initial reused-dependency type failure.

| Command / environment | Result |
| --- | --- |
| npm run build after clean private install | exit0, seven workspaces |
| node node_modules/vitest/vitest.mjs run packages/indexer/src/index.test.ts --reporter=default --reporter=json --outputFile=…/fixture55-results.json; CODEMAP_TEST_PYTHON_DIAGNOSTICS=1, POL01_ACCEPTANCE_MODE=compiled | 55 PASS / 0 FAIL / 0 pending / 0 todo, exit0, 10.223s |
| node node_modules/eslint/bin/eslint.js packages/indexer/src/index.test.ts packages/indexer/test/python-fixture.ts | exit0, 2.838s |
| node node_modules/typescript/bin/tsc --noEmit --target es2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --esModuleInterop --types node packages/indexer/test/python-fixture.ts | exit0, 1.869s; helper-only scoped check |
| node node_modules/vitest/vitest.mjs run tests/integration/pol01-stdio-acceptance.test.ts --reporter=default --reporter=json --outputFile=…/compiled-stdio3-results.json; POL01_ACCEPTANCE_MODE=compiled | 3 PASS / 0 FAIL / 0 pending / 0 todo, exit0, 7.465s |
| git diff --check | exit0 |

Raw logs, machine JSON and exact arguments/env are in freeze. The diagnostic summarizer initially expected an explicit `blocked` key and raised KeyError because undefined is omitted from JSON. The corrected passive summarizer checks its absence/value; no fixture rerun or source modification followed that derived-processing error.

## Ownership / shutdown receipt

`fixture55-resource-summary.json`: 46 native starts / 46 closes; every observed close reports aliveAfterClose=false; fresh PID checks all absent. No pending fixtures, no active owned PID, no omitted events, no blocked value reported. Fixed-owner admission and teardown are the accepted original source, unchanged.

`owned-service-shutdown-receipt.json` and three `compiled-runtime-N.json`: five API child records all mode=compiled, exit=[0,null], portClosed=true, fresh connection checks refused; one SDK stdio MCP child mode=compiled, pidAbsent=true. Fresh checks find all six PIDs absent. Only these three run-owned synthetic roots were removed after copying their runtime receipts; root absence is recorded. No persistent development/preview service was started.

## Remaining gates

Native whole suite with POL01_ACCEPTANCE_MODE=compiled was not run in this window; the parent's previous 1342 whole-unit result is its own prior evidence. Browser was not repeated; parent reported its prior gate-enabled 51-case PASS. This author executed only the requested 55+3 and scoped checks plus the private prerequisite build. Root/source-wide typecheck and root lint were not claimed. The new workflow still requires parent independent three-file review and actual remote Linux/Windows/macOS/browser CI against the published exact candidate. Do not mark Windows repaired or product complete from this report.
