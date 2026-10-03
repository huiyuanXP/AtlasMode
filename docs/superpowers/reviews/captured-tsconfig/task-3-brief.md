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
Task2 at952bffa passed independent review (no C/I/M); Task3 remains pending.
Controller's rejected-scope/selected-chain rulings are binding.
The user's autonomous authorization and AGENTS.md unattended exception apply;
execution method is sequential SDD.
