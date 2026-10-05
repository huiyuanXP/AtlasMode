# First functional version validation

**Local implementation validated on ssh-vm-2.** This supersedes the P0-only feature status, while preserving [VM2-VALIDATION.md](VM2-VALIDATION.md) as historical evidence. Work is tracked in [issue #1](https://github.com/huiyuanXP/AtlasMode/issues/1) and linked issues #2–#7. Code remains local, uncommitted and unpushed; issues are open for review.

## Implemented and tested

- Automatic startup scanning of the configured TS/JS/TSX/JSX repository; real functions/methods/constructors/callbacks, files/folders, imports, external references and resolvable calls. Dynamic calls remain unresolved. Stable IDs survive blank lines; content/configuration changes alter the baseline. Workspace public entries, aliases/re-exports, symlink exclusion and scope budgets are tested.
- Real React Flow browsing/search/context/evidence, fact-versus-plan labels, persisted layout, annotations, many-to-many capability groups and directory policy CRUD.
- SQLite migrations, snapshots, knowledge/layout retention, optimistic revision conflicts, atomic multi-writes, approval/revision history, export/import conflict preview and backups.
- Function/call/file-placement plan CRUD, graph connection editing, undo/redo, human confirmation, revision/hash/baseline binding and stale-plan blocking. Facts are parser-owned; edits become plans, and source files are not changed by the UI/MCP before confirmation.
- Official stdio MCP with shared-service queries and CRUD, bounded graph reads, forced Agent provenance, approved-version reads and implementation verification; no approval tool.
- Human-confirmed rename/move knowledge rebinding and persisted mappings. Temporary planning-symbol bindings are stored in verification reports. Structural checks report satisfied/unsatisfied/unknown and do not claim behavior verification.

## Final checks

| Check                                                 | Result                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Typecheck of seven workspaces and test/config sources | Passed                                                                        |
| ESLint/import boundaries and Prettier                 | Passed                                                                        |
| Unit/integration tests                                | **42 passed, 7 files**                                                        |
| Production builds                                     | Passed for all workspaces                                                     |
| Browser E2E                                           | **2 passed**                                                                  |
| Dependency audit after scanner replacement            | 0 known vulnerabilities reported                                              |
| Indexing this repository itself                       | Passed: 690 functions, 55 files, 4098 relations; unresolved evidence retained |

The actual E2E follows MCP draft → UI relocation/retarget/deletion → human approval → external fixture implementation → reindex/verification. It detects a deliberate bypass of requestWithRetry, checks unchanged approval during layout editing, and exercises knowledge CRUD, multiple group membership and reload persistence. Integration tests also cover actual stdio process transport, SQLite restart, stale baselines, semantic approval invalidation, import conflicts, orphan retention, rename confirmation and content reversion to an earlier snapshot.

## Limits and remaining review

This is a static TS/JS graph, not runtime tracing. Complex multi-config/project-reference/CommonJS/dynamic behavior can remain unresolved; coverage/diagnostics are shown. Continuous watching, sequence/wrapper operations, broader languages and automatic layout are not implemented. Annotations currently target indexed nodes/groups; descriptions/requirements of temporary planning nodes live in the plan. Policy JSON is an atomic mirror of service-managed rules; automatic reconciliation of arbitrary manual edits to that JSON is not provided. Verification reports structural outcomes only (`behaviorVerified=false`); target behavior still requires the external Agent's corresponding tests.

The production frontend currently emits a non-fatal bundle-size warning (about 538 kB minified); code splitting remains optimization work. Local UI confirmation is a protocol boundary, not protection against a malicious process with full shell/filesystem access. Nothing has been pushed or deployed publicly.

Run `npm run dev` to use the implementation; see [environment.md](environment.md) for fixed-root configuration and MCP launch. Evidence is under `/home/agent/work/atlasmode/first-release/` and ignored `artifacts/`. No private key or full provider credential is included.
