# Atlas CI runtime R2 — native acceptance pending

2026-10-11 UTC. Scope: finish fixed-SHA cross-platform CI only; no next ticket.

Baseline local and remote fix/pol01-ci-runtime-20261011 matched 734567b37bcf2c733e62415624e8974ffb67e40f; worktree clean before edits. Original checkout/publisher/PERF02 paused work preserved. No merge/deploy or credential reads.

Run38109973171: Ubuntu/macOS build/types/lint/1377 tests/smoke SUCCESS; browser53 SUCCESS. Windows build/types/lint SUCCESS; tests1338 PASS/8 FAIL/18 SKIP, 1 unhandled worker error; smoke skipped. Full raw logs retained, failure not erased.

Root causes and targeted test-only repair:
1. Node24.19 libuv Windows self-kill terminates with code1; only parent uv_process_kill records exit_signal. Rather than accepting exit1, child writes unchanged durable publish checkpoint, registers a normal-exit sentinel, sends PID/boundary/SIGKILL IPC receipt then holds at that exact boundary. Parent validates ownership and kills through its child handle. Original strict [null,SIGKILL], empty stderr, PID absence, compiled resolution, plan/approval/freshDB recovery and no target mutation remain. Exit handler sentinel must be absent. No production changes.
2. Raw Windows log native assertion src/win/fs-event.c:72 occurred immediately after controlled preflight-to-write annotation test start (PID3612). CI temp directory has RUNNER~1 short spelling. Native callback expands event paths to long names before comparing supplied watched path. Both directory watchers now use realpathSync.native(dirname(path)); all original watcher, raw identity, SQLite-open and synchronous mutation observers remain. dirname alone is insufficient because join(path,'..') already normalizes.

Primary references: https://raw.githubusercontent.com/nodejs/node/v24.19.0/deps/uv/src/win/process.c (TerminateProcess(...,1); uv_process_kill exit_signal) and fs-event.c (GetLongPathNameW, directory prefix assertion). Runtime confirmation still requires new Windows CI.

Validation: compiled five-file78 PASS (../targeted-r2.log), separate real-process guard4 PASS (../guard-r2.log): early exit0/1 rejected, forgedPID rejected, valid parent hardkill strict tuple. Fixture tsc passed. Initial lint caught unused once import; removed and final lint recorded separately. Source/runtime evidence and original failures preserved. No full local matrix repeated; new pushed SHA CI is authoritative native gate.

Independent read-only complex review: gpt-6.1-sol high, C0/I0/M0 provisional, final receipt separate. No model settings changed. Scope6 source/test files; workflow/product code unchanged.

neat-freak: code changed-and-verified locally; native runtime pending; docs changed-and-verified; rules verified-current/unmodified; memory generated-read-only/out-of-scope; workspaces retained, no cleanup. Native FS01/KN01/POL01 remain REVIEW until all platforms green. No next ticket started.

## R2 native green, browser retained failure; R3 pointer readiness

FixedSHA d8ec5c4 run38110644618: Ubuntu/mac113files1381PASS; Windows112PASSfiles/1SKIPfile,1361PASS/18SKIPtests (1379total), build/types/lint/smokeSUCCESS and zero worker error. Browser52PASS/1FAIL:ownership.spec.ts702 positions0 after layout mouse drag. Three tickets remain REVIEW until full current run succeeds.

CI failure screenshot+trace preserved in owner/browser-r2 and ROG. Trace shows gesture146442–146770ms during250ms fitView focus; raw mouse used one visible-card box atx1099.86/y550.378, lacked stable/actionable target or dragging witness. Local unchanged case threePASS does not erase CI failure; timing-specific. R3 only fixes this fixture: actionable hover on selected outer node, fresh proportional point, actual threshold and dragging witness, measured55/30 screen displacement<2, exact selected-node persisted position. Original unchanged plan, no ownership native event, real native folderdrop/save/reload, source hashes remain. No sleeps, retries, production changes or weakened assertion.

R3 amended three targeted browser executions PASS, original three targeted PASS retained distinctly. Final lint and independent narrow review separately recorded. Full new fixedSHA CI remains required.

## R3 native timeout failure; R4 bounded Windows workers

Fixed SHA eba72916dc4c0c2131b7d2da67ccc7d8cab4f7d8, run38111183282: browser53PASS and Linux/mac1381PASS. Windows1356PASS/5FAIL/18SKIP, all five failures at existing5000ms timeouts; no termination-tuple/watcher/worker-exit recurrence. Raw run-specific logs preserved in owner/evidence-r3.

Identical native test sources passed on R2. R2/R3 Windows root durations104.28/186.19s; annotation23.06/66.08s, structure-sync5.84/23.52s, POL01 HTTP9.33/39.17s. Contention is supported inference, not proved without OS telemetry. R4 limits independent Windows test-file workers to1; isolation, inclusion, deadlines, assertions and explicit internal concurrent operations remain. Linux/mac scheduling unchanged. Pinned Vitest4.1.11 installed cli-api.CnMVyzaz.js3832–3837 defaults to max(availableParallelism()-1,1), isolated worker1 serializes files at3884.

Eight targeted files166PASS in51.36s with --maxWorkers=1; root lint and diff check PASS. Fresh native matrix pending. Tickets remain REVIEW. No unrelated ticket, merge or deploy.
