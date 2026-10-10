# Dev fixture readiness and cleanup — independent limited review

Reviewer: `/root/grp01_design/grp01_implement`, explicit `gpt-6.1-sol high`. Date: 2026-10-10 UTC.

**APPROVE — Critical 0 / Important 0 / Minor 0.**

This review covers only the frozen change to `apps/server/src/dev.test.ts`, its unchanged `scripts/dev.mjs` runtime baseline, the existing test-only IPC preload, and the raw dev-readiness receipts. I am not the author. GRP product work, other source changes, global root gates and AG-03 implementation are outside this review.

## Frozen inputs

- VM2 checkout: `/home/agent/projects/AtlasMode`; comparison HEAD `6566717ee81981358e36caacb23f80157b0ee61d`.
- Test SHA-256: `3876549f0064a121a655e0a9b9a0d7bcda8b50632799143378f1e5b2a713b469`, independently checked against the current file and receipt.
- Runtime SHA-256: `056a5e1ee7900760a1935c1e39f9a8d30687d75d9578a1b57e29f962ae9d8585`. Current `scripts/dev.mjs` and `git show HEAD:scripts/dev.mjs` independently match. This patch does not change the runtime.
- Evidence: `docs/superpowers/reviews/ci-repair-2026-10-10/dev-readiness/`. I read the exact current diff, stored `fixture.patch`, historical Windows log/job result, original-helper RED, final GREEN, report, receipt and empty scoped lint/typecheck logs.
- I independently compared the original-case section after its supervision comment against HEAD: all original cases, assertions, platform conditional and time limits are byte-identical. The stored patch matches the current diff exactly.

## Readiness and ownership checks

The old ready helper accepted PID-file existence before the fixture had finished its cwd/proxy writes or installed handlers. The controlled original-helper RED records `readiness=ready`, `heldProxy=""`, required proxy `"1"`, then fails the new barrier assertion. The final GREEN records `readiness=blocked` while the descriptor is held, then verifies proxy `"1"` after explicit release. This is direct process/barrier evidence for the fixture handshake race rather than an assumption based on timing.

The new server/web fixtures write started JSON with their own PID, fixed fixture name and unique canonical root. Signal handlers are installed before readiness. Proxy writes finish and their descriptor is closed before ready JSON is emitted. The active compiler similarly emits ready only after its handler and live interval are installed. Readiness parses both complete ready records and validates exact name/root plus a positive safe-integer PID. Partial/empty records do not signal readiness. PID zero or invalid ownership data cannot reach cleanup signalling.

Cleanup uses only the known fixture names `server`, `web`, `compiler`, reads their validated started records, and signals positive self-recorded fixture PIDs; the separately spawned supervisor is identified by its owned ChildProcess handle. Missing records are handled only as ENOENT; malformed or mismatched ownership is rejected. There is no taskkill, broad process scan, process-group signalling or arbitrary supplied PID fallback.

## Bounded cleanup and preserved behavior

The fixture first sends the existing IPC bridge a SIGTERM request. I read `tests/support/graceful-preload.mjs`: it requires an installed signal listener and invokes that actual production handler with `process.emit`, then disconnects. Thus the Windows handler path is exercised without pretending that Windows `child.kill()` provides graceful POSIX signalling.

The fixture gives this handler path a bounded 1-second opportunity, then force-kills only its owned supervisor if needed. It checks and, when necessary, kills only strictly validated owned started PIDs. A shared 2-second deadline bounds polling for actual PID disappearance and supervisor `close`. Close is awaited in addition to exit so inherited fixture pipes are drained. Only after successful disposal does reversed afterEach cleanup reach root removal; invalid records or failed drainage throw before removing that directory. Repeated successful disposal is idempotent. The held-proxy cleanup regression checks both real children were alive, invokes this cleanup, proves both PIDs gone, then removes only its fixture and verifies ENOENT.

All original build-order, canonical cwd, exact proxy, child failure, prerequisite failure, live compiler, lifecycle rejection, exit status and child disappearance assertions remain unchanged. The original 10-second readiness and 15-second test limits were not increased. The two new real-process regressions also use 15 seconds. The existing Windows exclusion of the direct POSIX signal variant is unchanged; handler and aliased-parent variants and new regressions remain available on Windows. No new Windows skip or deleted case was introduced.

## Evidence and limits

The original CI record for HEAD `fe4b52c191640913d192ca514164d972275531d1`, run `38065405991`, reports browser/Linux/macOS success and Windows failure. The raw Windows log shows server.proxy expected `"1"` but received `""`, followed by EBUSY removing the fixture directory. This historical FAIL is preserved. I do not claim that these logs establish the cause of a different historical SIGKILL failure.

The exact original-helper RED has 1 failed selected regression and 8 unselected/skipped cases; that targeted diagnostic does not introduce committed skips. Final Linux GREEN reports **9/9 PASS, 6.41s**, including the barrier and held-descriptor cleanup regressions. The author report records scoped lint and test-file no-emit typecheck exit 0; their raw logs are empty. I read those records but did not rerun tests, lint or compilation. Final GREEN raw log SHA-256 is `f8e45d721e0cf04b854df0a0fadb077e83f52ab7a9e571cd1db972f4abb795a9`; original-helper RED is `cfc86d748c2500b3a67454a92072636ebc9bd68ef74be57c08f3db75e539ede1`.

The repaired Windows/macOS behavior still requires the new real CI. Linux evidence and this code review do not establish Windows success. This test-fixture repair does not implement or certify AG-03 Windows Job Objects or arbitrary descendant supervision.

I did not edit source/runtime/tests, change the Git index, start/stop any fixture or other process, rebuild shared products, run root gates, commit/push, inspect credentials/sessions or spawn an agent. The only file I wrote is this explicitly requested local review artifact.

## Conclusion

APPROVE for the frozen test-only readiness/cleanup patch above, Critical 0 / Important 0 / Minor 0. No repair remains within this limited review scope. Main owns staging/integration and the genuine post-repair platform CI follow-up.
