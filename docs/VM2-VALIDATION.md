# VM2 initial validation

Historical P0 report. Current implementation and checks are documented in [V1-VALIDATION.md](V1-VALIDATION.md).

**Outcome: P0 ready for local review and P1 implementation.** Validated on ssh-vm-2 on 2026-10-04 UTC, in `/home/agent/projects/AtlasMode`, starting from Git commit `944b48c` (README/specification and LICENSE only). No prerequisite blocks P0.

The complete README and all applicable ancestor AGENTS.md locations were checked before initialization; none existed. A short root AGENTS.md now records the execution and product constraints. The README introduction now accurately states P0 readiness; its full specification and approval/revision semantics are retained. LICENSE is unchanged.

## Implemented

- Node **24.21.0**, npm **11.19.0**, TypeScript **6.0.3**; exact runtime pins, npm workspaces, one `package-lock.json`, exact direct dependency versions, and strict engine checking.
- Three workspaces: `@codemap/core`, `@codemap/server`, `@codemap/web`; public package entry points and explicit core-before-consumer build/check order.
- A clearly labeled hand-authored React Flow demo: two file frames, two functions, a typed call, selection, zoom, and transient layout dragging. No source-file movement.
- Fastify health API at `/api/health`, explicit false capability flags for unimplemented phases, loopback listeners, configurable ports, and Vite's loopback API proxy.
- Pure Zod demo-graph reference/ownership validation, typechecked tests, import-boundary linting sourced from `.codemap/structure.json`, formatting, and documented setup/architecture.

## Executed validation

| Check                                                   | Result                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                | Passed; locked installation, 0 reported vulnerabilities                                                                                                                   |
| `npm run typecheck`                                     | Passed, including test/config source checks                                                                                                                               |
| `npm run lint`                                          | Passed, zero ESLint warnings and formatting clean                                                                                                                         |
| `npm test`                                              | **23 passed**, across 2 files                                                                                                                                             |
| `npm run build`                                         | Passed for core, server, and production web                                                                                                                               |
| `npm run dev` + live API/proxy HTTP                     | Passed on 127.0.0.1:4310 / 5173                                                                                                                                           |
| Chromium 153.0.8010.12 smoke                            | Passed: disclaimer, visible graph/files/call, selection, layout dragging without source changes, narrow viewport, unavailable API, no unexpected errors/external requests |
| Five import-boundary probes                             | Passed: allowed core import; rejected storage, deep imports, cross-workspace relative imports, and core filesystem import                                                 |
| Compiled API + production preview                       | Passed on custom loopback ports 14310 / 15173, including API proxy and browser-rendered built assets                                                                      |
| Final diff, generated-file exclusions, listener cleanup | Passed; validation servers stopped                                                                                                                                        |

Tests exercise dangling endpoints, ownership conflicts, duplicate IDs, invalid typed relationships/paths, recursive calls, honest API capabilities, absent approval endpoint, and invalid port inputs. Browser evidence includes desktop/mobile screenshots and source-hash preservation during dragging.

## Setup issues resolved and limits

Node/npm were initially absent. Installed the official Node 24 LTS archive after SHA256 verification into user-owned `/home/agent/.node`; binaries are linked on the existing PATH. The root-owned `.local` parent prevented a library-directory install, so its ownership was preserved. TypeScript 7 was outside typescript-eslint's supported peer range, so 6.0.3 was selected and verified. npm's install-script warning was resolved by permitting pinned `esbuild@0.28.2`. Chromium initially lacked shared libraries; Playwright's official `install-deps chromium` completed successfully using available sudo permissions. Production preview was observed to inherit Vite's API proxy, and documentation was corrected accordingly.

Real indexing, stable code-symbol identities, SQLite durability, planning/revision/approval state machines, implementation verification, MCP, and the README's end-to-end approval scenario **remain unimplemented**. SQLite's native compatibility is not validated at P0. Playwright 1.63.0 is an isolated VM validation dependency, not a P2 repository test suite. No product plan approval was fabricated: initialization authorization and future target-repository approval are distinct.

Requested execution model: **gpt-6.1-sol**. The executing-model identifier/selection is not exposed by this session's VM tools, so this report cannot independently attest to that requirement.

## Next work and handoff

1. P1: add real CodeSnapshot/Knowledge/ViewState models and indexer/storage ports; implement TS/JS/TSX/JSX indexing with stable IDs, exclusions, bounded scope, content baselines, and explicit unresolved evidence. Validate cross-file aliases/re-exports and identity after blank-line insertion with fixtures.
2. P1: install/validate better-sqlite3, introduce numbered migrations and transactional repositories, preserve orphan knowledge and layouts across reindex/restart, and add injected service orchestration. Server assembles implementations; web stays on HTTP/core boundaries.
3. P2: implement revision conflicts and human approvals binding revision/hash/baseline; semantic changes invalidate approval, layout changes do not, and stale baselines block implementation. Add the actual Playwright approval suite then. P3 MCP follows using the same service state.

Run `npm run dev` to resume local development; see [environment.md](environment.md) and [architecture.md](architecture.md). Review with `git diff`. Changes remain local and uncommitted (new files are marked intent-to-add for a complete diff); nothing was pushed or published. Existing Git SSH configuration was preserved; no private key or provider credential was read or exported.

External evidence and final summary: `/home/agent/work/atlasmode/initial-validation/` (`SUMMARY.md`, install/check logs, dependency/boundary JSON, browser scripts/results/screenshots, runtime/listener evidence). Reports contain no credentials.
