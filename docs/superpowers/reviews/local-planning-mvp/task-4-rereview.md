- **Prerequisite-build descendants survive development-supervisor shutdown** — **ADDRESSED**. `scripts/dev.mjs:41` resolves the installed TypeScript CLI; `scripts/dev.mjs:44` and `scripts/dev.mjs:59` launch each compiler directly with Node in its workspace cwd. The compiler is therefore the tracked child signalled at `scripts/dev.mjs:15` and awaited through its close event at `scripts/dev.mjs:29`, removing the npm/shell intermediary responsible for the reproduced orphan. `scripts/dev.mjs:50` rejects different build scripts and prebuild/postbuild hooks rather than silently bypassing their behavior. The new active-build regression at `apps/server/src/dev.test.ts:165` confirms the compiler is live before SIGTERM, supervisor exit is successful, the compiler PID is absent afterward, and runtime startup never occurs.

### New Breakage in the Fix Diff

- **None.** No new Critical/Important/Minor issue found in the two source changes or controller-owned documentation additions. Build order, failure propagation, runtime supervision, and the signal check before spawning remain consistent with the original behavior and scoped requirements.

### Out-of-Scope Observations

- **None.** Native Windows/macOS runtime and signals remain unrun; Linux evidence does not establish native-platform acceptance.

### Checks

- **Read-only inspection:** read the supplied review package once, original finding, task brief, and appended fix report; inspected the amended supervisor and regression with line numbers. No checkout, index, HEAD, or branch changes; only this permitted ignored report was written.
- **Reported covering evidence checked against the diff:** the appended report identifies the active-build RED orphan assertion, custom-build guard RED, final `npm test -- apps/server/src/dev.test.ts` GREEN with 5/5 tests, scoped ESLint, syntax check, and actual-manifest/CLI resolution check. The assertions and exercised code match those claims. These are implementer-reported executions; no test suite was rerun in this re-review.
- **Independent read-only compatibility check:** Node manifest inspection exited 0; all five actual prerequisite scripts are exactly `tsc -p tsconfig.json`, with no prebuild/postbuild steps. `require.resolve('typescript/bin/tsc')` resolves the installed CLI, whose entry directly requires `../lib/tsc.js`; no npm wrapper is introduced. No focused runtime probe was needed because the supplied regression answers the original active-build risk.

### Verdict

- **Fix round: All findings addressed, no new Critical/Important breakage.** No open findings.
