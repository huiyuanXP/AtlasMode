- **I1 — Older route response overwrites newer manual graph and selection** — **ADDRESSED**. `apps/web/src/app/workspace.ts:201` advances navigation generation; `apps/web/src/app/workspace.ts:202` invalidates the independent route request before manual expansion, clears route busy state, and accepts the newer graph under its own guarded key. `apps/web/src/app/workspace.test.ts:398` deliberately finishes the older route last and asserts both graph and selection remain `manual-target`, with route busy cleared.
- **I2 — Explicit focus must center remotely arriving targets and repeat for the same route step without replaying on layout saves** — **ADDRESSED**. `apps/web/src/app/workspace.ts:211` publishes focus after accepted graph arrival; `apps/web/src/app/workspace.ts:438` publishes a fresh sequence for each accepted route focus. `apps/web/src/features/graph/Canvas.tsx:62` subscribes to rendered nodes and initialization; `apps/web/src/features/graph/Canvas.tsx:86` waits for the current projection's data and measured dimensions. `apps/web/src/features/graph/Canvas.tsx:80` and `apps/web/src/features/graph/Canvas.tsx:91` consume each sequence once, so saved positions cannot replay it.

### New Breakage in the Fix Diff

- None. No new Critical/Important breakage found in the four-file fix diff.

### Out-of-Scope Observations

- Prior Minor M1, stale accepted temporary-node inspector metadata, remains explicitly deferred to T07; it is outside this fix loop. No additional observations.

### Checks

- Read the supplied fix diff once, task brief, full prior review, and appended fix report. No diff regeneration, suite rerun, source mutation, checkout/index/HEAD mutation, or subagents.
- Verified the report names the covering workspace/scope/projection tests and records `Test Files 3 passed (3); Tests 18 passed (18)`. The added transport/controller regression matches I1's reversed-completion defect. Web build, typecheck and lint are reported successful; no independent rerun claimed.
- Read `artifacts/t05/focus-browser.mjs:1`, `artifacts/t05/focus-browser-red.json:1`, and `artifacts/t05/focus-browser-evidence.json:1`. The actual-browser harness delays the remote subgraph until inspector selection renders, then requires distance below 35px; independently pans over 150px before repeating the same route-step focus. RED distances were 4979.888px and 250.343px; GREEN passes both, with repeated focus distance 0.0000153px and empty consoleErrors. It also checks the viewport transform remains exactly unchanged after ordinary drag and the debounce interval; GREEN's 72.402px remote-node distance is recorded after that deliberate drag, not at the focus assertion.
- No focused probe needed: diff and retained browser assertions answer graph readiness, repeated intent, and one-time consumption directly.

### Verdict

- **Fix round:** All findings addressed, no new Critical/Important breakage. I1 and I2 closed; no open findings in this fix loop.
