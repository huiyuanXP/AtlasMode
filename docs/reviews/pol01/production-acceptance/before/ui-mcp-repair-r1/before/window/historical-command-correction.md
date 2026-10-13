# Historical R1 reproduction wording correction

The frozen R1 handoff `../http-window-repair-r1/repair-handoff.md` incorrectly named `pnpm exec` for its reproduction command and `biome` for lint. Those were author-reconstructed summary command names, not copied command headers from the original stdout. VM2 has npm workspaces, npm/node/npx and installed Vitest/ESLint/Prettier; it has no pnpm or biome. This UI window's two failed setup attempts are preserved as `setup-pnpm-failure.txt` and `format.txt`; they are not product RED.

The original R1 real test result remains `../http-window-repair-r1/green-final.txt`: Vitest 4.1.11, actual source-alias run, 6 files / 106 PASS, start 17:53:41, duration 16.07s; the executing tool returned exit 0. Its six files are Workspace7, server15, lifecycle31, originalPOLHTTP12, repairHTTP12, StructureSync29. Original type and lint no-error outputs are `../http-window-repair-r1/types.txt` / `lint.txt`, and the corresponding tool completions were exit 0. Originals and their hashes are unchanged.

The persisted original stdout receipts do not contain a shell-command header. After context compression, the exact original shell invocation cannot be reliably recovered from those artifacts, so this note does not invent or retroactively write one. The erroneous summary commands must not be treated as a raw execution record. The following is the currently available equivalent reproduction command, explicitly reconstructed from recorded scope/config rather than asserted to be the original shell string:

```sh
export PATH=/home/agent/.local/bin:$PATH
./node_modules/.bin/vitest run --config /tmp/atlasmode-pol01-v2-vitest.config.mjs packages/service/src/workspace.test.ts apps/server/src/server.test.ts tests/integration/workspace-lifecycle.test.ts apps/server/src/pol01-workspace-http.test.ts apps/server/src/pol01-http-repair.test.ts apps/server/src/structure-sync.test.ts
./node_modules/.bin/tsc -p /tmp/atlasmode-pol01-repair-tsconfig.json --noEmit
./node_modules/.bin/eslint packages/service/src/workspace.ts apps/server/src/routes.ts apps/server/src/pol01-workspace-http.test.ts tests/support/pol01-crash.ts apps/server/src/pol01-http-repair.test.ts packages/service/src/structure-sync.ts
```

This note is a documentation correction, not a new execution of the frozen historical 106 tests. Workspace/routes now belong to KN's authorized next window, so replaying against today's shared checkout would test a later dependency version. The original frozen source, config and raw receipts remain sealed under R1 `before/` / manifests. Current UI/MCP execution strings are explicitly saved in `commands-used.md` and should not inherit the old summary wording.
