# POL-01 HTTP repair r1 handoff — 2026-10-10

Scope: repair only I1/I2 of `../http-window-independent-review.md` (REQUEST_CHANGES C0/I2/M0; SHA256 `84b6c1ce9514a4c6f2bb57abf24d41501134f167b34db7f55cc2ad4f2da8f2e5`). Independent actual-code rereview remains pending. This window does not complete POL-01: old FolderPolicies UI/CAS/preview/reload and MCP integration require later authorization. No staging, commit, build/dist, schema change, real user structure, or real user DB operations occurred.

## Concrete changes

I1: HTTP JSON/Markdown exports call asynchronous Workspace.exportPlanFresh, holding the existing project queue and reading/reconciling actual structure before Planning.export. External semantic edits invalidate current approval and advance the plan once; approved historical records remain byte-identical. Invalid bytes reject export, deletion produces a non-current plan, and exports wait behind prepared/published writes instead of returning cached current approval. The existing synchronous export method remains for internal compatibility; the HTTP handler uses the fresh boundary.

I2: StructureSync has two small optional hooks: identityMutation(projectId,input,work) runs inside the executing project queue; validateOwnership(projectId,document) runs before durable intent/publication and recovery finalization. Workspace coordinates identity-mutating legacy upsert/import work through one per-service Promise lane from executing owner check through read/CAS/prepare/publish/finalize. Reads and folder edits do not acquire that lane. The hook does not rewrite the reviewed journal algorithm.

Existing DB/state owners plus all other projects' durable pending intent candidates prevent another project claiming the same legacy ID. Unknown I/O and conflicted pending retain the claim; malformed pending candidate fails closed. Observed-before recovery abort releases the candidate claim; observed-after recovery finalizes and retains the committed owner. No reservation namespace/table or overall transaction was invented. The lane is per WorkspaceService, under the existing single-service ownership contract. External editors still have the documented CAS/check-to-rename limits; no cross-file or filesystem/SQLite atomicity is claimed.

Exactly six files differ from the sealed original: workspace.ts, routes.ts, pol01-workspace-http.test.ts, pol01-crash.ts, new pol01-http-repair.test.ts, and structure-sync.ts. `repair.patch` is the exact increment against `before/source`, not a broad HEAD diff. `changed.sha256` lists their precise hashes. `freeze.sha256` contains the original 18 owned paths plus the new test and authorized hook file (20); `dependencies.sha256` contains the other 13 previously frozen dependencies. Public exports have no change.

## Verification and fault evidence

- `red.txt`: the initial six real HTTP/SQLite/file tests all failed against the original frozen source (external export wrongly current, queued same-ID publication wrongly accepted, invalid/missing/pending cases stale). The original frozen bytes and review/logs were copied to `before/` first; the originals were not overwritten.
- `green1.txt`: those same six tests passed after the narrow repair. `green-claims.txt`: eleven tests passed after additional recovery/barrier proof. Additional coverage was added after the first GREEN; it is not misrepresented as original RED.
- `green-final.txt`: final source-alias run, six files / 106 tests PASS, tool exit 0: Workspace 7, Server 15, Lifecycle 31, existing POL HTTP 12, repair HTTP 12, StructureSync 29. Reproduction: `pnpm exec vitest run --config /tmp/atlasmode-pol01-v2-vitest.config.mjs packages/service/src/workspace.test.ts apps/server/src/server.test.ts tests/integration/workspace-lifecycle.test.ts apps/server/src/pol01-workspace-http.test.ts apps/server/src/pol01-http-repair.test.ts apps/server/src/structure-sync.test.ts`.
- Real barrier tests cover B queued before A claims/commits, and both claims initially unowned before any intent exists. The losing project has no file publication (publisher count zero), unchanged original bytes/plan/approval history, and no committed audit. JSON/Markdown direct exports are the first operation after disk edit. Both prepared and published export barriers retain historical approvals unchanged.
- Three real owned child SIGKILL/restart tests cover before/after/unknown pending identity candidates through actual SQLite/FileStore and HTTP. Unknown reads retain the claim until readable; before abort allows the formerly rejected B request; after recovery retains A ownership. Existing source entrypoint crash recovery proof also passes.
- `types.txt`: narrow source `pnpm exec tsc --project /tmp/atlasmode-pol01-repair-tsconfig.json --noEmit`, tool exit 0. Config and source-alias Vitest configuration are copied here. This is not a claim that pre-existing broad fixture typecheck failures were repaired; those prior receipts remain unchanged.
- `lint.txt`: biome check on the six changed files, tool exit 0. Empty no-error output is preserved. Formatting outputs and the non-writing shell patch setup fault are also retained.
- `fs-method-check.txt`: Planning.update original bytes SHA `f4b11da3a6354f7646e656ef49ce4110c148ee4873d7a7e942f5311ce47b0613`; Workspace.updatePlan original bytes SHA `39dbfb5232894947f53cd8549f48700dfd12f67f6e7e071fecc68e6a6b59f794`. Both remain exact. KN Planning, annotations/review/model/schema and all nonhook dependency hashes remain frozen.

## Owned runtime closure

`runtime-verification.json` records every final-run PID/exit/root/database/port and a later read-only process/port probe. Nine child processes exited (eight SIGKILL fault children and the actual TSX source entrypoint exit 0), all nine PID probes are ESRCH. The two test worker PIDs are also ESRCH. The only real listener, port 38847, returns ECONNREFUSED after exit; inject-only apps never opened listeners. Twenty-four fixture roots report all apps and SQLite connections closed. Root bytes and closed DB files are copied under `fixture-evidence/` and hashed in the runtime JSON. Roots are retained for evidence; no runtime remains. No tunnel was created and no unrelated process, server, file or evidence directory was removed.

## Freeze

`freeze.sha256`: `cab49d7709a3e3de3ce1c06fab6c00464cb7282cc98614ed551ebe19d02366e8`.

`repair.patch`: `aaeb68b6025ac78b399c247a4e211f466804c9c60e17b3f67cc9ba87f58051e6`.

Original C0/I2/M0 report and original window's manifests/receipts remain unchanged. Current source is frozen for the original independent high reviewer; no next integration window begins here.
