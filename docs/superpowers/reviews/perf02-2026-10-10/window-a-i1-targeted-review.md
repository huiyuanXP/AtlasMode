# PERF02 Window A I1 targeted independent rereview

Reviewer: original independent `gpt-6.1-sol high`, `/root/ci_repair`. Date: 2026-10-10.

**APPROVE — Critical 0 / Important 0 / Minor 0. Original I1 resolved.** Approval is limited to the two-file I1 delta and its regressions; whole PERF02 remains PARTIAL.

## Exact scope and integrity

VM2 `.superpowers/sdd/2026-10-10-perf02-window-a-i1-repair/`; local mirror `perf02-window-a-i1-repair/freeze/`. Reviewed `repair.patch`, frozen before/after controller and controller test, retained behavioral RED, targeted GREEN, four-suite regression, checks/receipt and original archive integrity. No product edits, test execution, build, lint execution, DB access, staging or spawning. Only this review report was written.

| Artifact | SHA256, verified unchanged |
| --- | --- |
| manifest | `94c979f5ed579adcef54272e413e08468125bbc0af78c8d357e0a52e89eaad40` |
| source manifest | `cb8b5935c40a9575d2ff306d444b8cb9f0feaed091656d2be900dec6d8113cbf` |
| receipt | `414051ea5cc78edae5c92d5edf86ae9793afbe68c10388ba2f4d0a79a97af571` |
| repair patch | `cf15174e12dd2a38829fe6a65820fcefae1bccf1c687acbab3241e50f8cb872e` |
| repaired controller | `8c1c6265fcb0566f83b3612798067e6721967f356515a4298040572727eea539` |
| repaired controller test | `780baa42b1d5b2f0e6f7a585aad288913a399d78f27013458a50f3840af72572` |

All nine final source hashes match the local frozen files, VM2 frozen files and VM2 current source; exactly the controller and its test differ from the original freeze, with the other seven unchanged. Local evidence manifest **68/68** and original archive manifest **43/43** match. Original Window A manifest remains `59c7be4a5b13a4540fd2d7154af7fd0a06b14083195c8e72aa53530a8f38d421`; original REQUEST_CHANGES report remains byte-preserved with SHA `88cfca88bae633abb1954a85f77c62b204bdb4c5bc2a1187a63d28f5e03cefef`. Neither was replaced by this approval.

## I1 resolution

The repaired controller retains its existing callback-entry deadline check and complete token/result validation. At lines 278–283 it now checks the same `performance.now() - start >= 1000` **after validation and immediately before completed delivery**. A valid result that crosses the deadline uses the existing `failed/timeout` finish path. No deadline increase, validation bypass, partial ready delivery, token/interface change, cleanup rewrite or synchronous fallback was introduced.

The two new threshold cases use the real pure helper's valid one-node ready result, enter at 999ms and advance controlled monotonic time during result validation to exactly 1000ms or 1001ms. Both assert only timeout, validation reached, cleared timer, removed message/error listeners and one termination; retained late message/timer callbacks cannot deliver or terminate again. This is a deliberate fake-clock/fake-port boundary fixture: the numeric getter is instrumentation for elapsed validation time, not a claim that native structured cloning transports a getter. The receipt accurately labels it as such. Existing sixteen controller tests remain intact.

Read-only evidence confirms the original 1001ms behavior produced **1 FAIL / 16 PASS** with completed instead of timeout. The repaired targeted suite records **18/1 PASS**; the fresh Window A regression records **73 tests / 4 files PASS** (12 core, 16 validator, 27 helper, 18 controller). Exact two-file lint and all nine source/test noEmit receipts exit0. Reviewer did not independently rerun these commands. Pure-core noEmit was not rerun; its original evidence and unchanged core source are preserved.

## Remaining boundaries

Original passed Window A contracts remain unchanged. Public package exports/import replacement, HTTP bounded stream/abort and SQLite invariance, visual/local two-pass geometry and FS-compatible UI/save integration, actual compiled module Worker/browser, and Express/Flask p95/wall gates remain pending. This scoped approval does not claim native Worker observation, measured performance, complete integration or ticket DONE.
