# PERF02 Window A independent source review

Reviewer: existing independent `gpt-6.1-sol high`, `/root/ci_repair`. Date: 2026-10-10.

**Conclusion: REQUEST_CHANGES. Critical 0 / Important 1 / Minor 0.** Scope is the frozen nine new Window A files, not the approved design alone and not later HTTP/UI/Worker/performance integration.

## Frozen scope and verification

VM2 repository `/home/agent/projects/AtlasMode`; freeze `.superpowers/sdd/2026-10-10-perf02-window-a/`. Complete local mirror: `perf02-window-a-freeze/` beside this report. Read the frozen `after/` blobs, all four test files, receipt and raw final checks; checked necessary approved spec/plan and core model dependency. All nine frozen/local/check-out source hashes match the manifest. `git ls-tree` against the exact base `8c305ae5fd68118f53d16e544e8b5f5dc81bfab5` confirms all nine paths were absent in that baseline.

| Artifact | Verified SHA256, unchanged during review |
| --- | --- |
| `manifest.json` | `59c7be4a5b13a4540fd2d7154af7fd0a06b14083195c8e72aa53530a8f38d421` |
| `source.sha256` | `42fdba1022b172c2f04b0eafd0c46605f9c9c164e53b08a261a5886be84ffd2e` |
| `receipt.md` | `41ec72ffb0143f2d309709aa582512796a6019f00d6c64e14b4dcf6fcc76e3f4` |
| `owned.patch` | `3107309bbee3f7dcee179918864d47d4f3e2d33964275ee8dcd8e5fc8667c575` |

The local `evidence.sha256` verifies **41/41 artifacts**, including the nine exact sources and retained historical failure outputs. The model dependency is `a61d1e3fa7fa33b4c50e3416c8c0e82e0f28fb82d8649f30774cdba219ab8abf`; approved spec/plan remain `d8ab6c875b507b48fca202fde75a47117ac8218e5a0dbfcfea4b1a167c2965d3` / `1359a2d4ae3fb2659061b4904592f1528628500ac00ac332d22302fe61553ea3`.

Reviewed source paths:

- `packages/core/src/layout-target.ts` and `.test.ts`.
- `apps/web/src/api/layout-target.ts` and `.test.ts`.
- `apps/web/src/features/graph/overview-layout.ts` and `.test.ts`.
- `apps/web/src/features/graph/overview-layout-controller.ts` and `.test.ts`.
- `apps/web/src/features/graph/overview-layout.worker.ts`.

No source/document/DB/index changes; no tests, builds, lint, instances, staging or spawning. Only this local independent report was written.

## I1 — a reply can become completed after its hard wall deadline

**Important.** `apps/web/src/features/graph/overview-layout-controller.ts:255–282`, particularly the deadline check at 257 and `result(...)` / successful `finish(...)` at 273–282. Contract: approved spec 115 and the controller's 1000ms wall budget.

The message callback checks elapsed monotonic time only on entry. It then validates the complete returned result: up to 5000 order entries, position/rank properties, key inventories and captured target membership. After this synchronous validation it unconditionally calls `finish({status:"completed", ...})`, without another elapsed-time check. A response entering at 999ms can cross 1000ms during validation and still be delivered as completed. The timer cannot execute while that same callback is running; `finish` clears it before the queued timeout gets a chance to run. The entry guard correctly rejects replies already late on arrival, but does not cover this final acceptance boundary.

**Required narrow repair:** retain the current early rejection, then check the same monotonic elapsed deadline again after result validation and immediately before successful delivery. If the deadline has been reached, deliver `failed/timeout` and run the existing owned listener/timer/worker cleanup exactly once. Do not raise the deadline, skip result validation, permit partial success or add synchronous layout fallback.

Add a behavioral RED/GREEN fixture with a valid bounded ready reply received just below the deadline and a controlled monotonic clock beyond the deadline at the post-validation acceptance boundary. Assert timeout, no completed delivery, timer/listener removal, one termination, and no effect from a retained late callback. Keep the existing on-time ready-result and entry-already-expired cases. The current fake-worker suite does not cover this interleaving. This finding is established by static control flow; no reviewer test or native Worker reproduction was run.

## Passed source areas to preserve

### Full target and byte boundary

The core helper binds the captured snapshot ID, uses complete snapshot lengths for raw totals, includes actual external kinds, validates unique node/relation IDs and actual parent/endpoints, and preserves all raw unresolved/external/null relation identities. Ready arrays contain only the minimal permitted fields. It does not copy source, names, evidence, signatures or annotations, and does not mutate the input.

5001/20001 length rejection happens before ID validation and minimal node/relation array allocation. The allocation-free byKind scan still traverses all already-captured nodes even when a length cap is exceeded. That is consistent with this frozen DTO's requirement to return exact byKind counts; it is **O(captured node count)**, not an O(5000) CPU ceiling and not evidence of bounded snapshot loading. No oversized relation entries are read. The receipt explicitly discloses this cost; future Window B must preserve the distinction between already-captured counting and transport/layout limits.

The UTF8 JSON counter handles escapes, paired/unpaired surrogates and the whole minimal response envelope, and stops immediately on an over-cap byte count. It does not allocate an unbounded serialized string/buffer. `actualBytes` is omitted on early stop, which is truthful for this optional field; the code does not label a lower bound as an exact total. Minimal DTO object allocation is already bounded by the node/raw-relation caps. The client validator rejects mixed snapshot/project/hash, forged counts, missing/partial arrays, extras, bad enums/endpoints, duplicate IDs and contradictory rejected envelopes. Its input is an already parsed response; the separately required bounded stream reader is **not implemented in this window**.

### Topology and bounded geometry

Topology uses sorted true domain IDs, resolved calls/imports with real non-external endpoints, deduplication only for ranking, iterative Kosaraju and a stable heap for condensed DAG processing. Its loops and allocations remain bounded by 5000 nodes/20000 raw relations. SCC component numbers are private; member minima, ranks, public order, pin insertion, structural traversal and both neighborhood sweeps use stable ordering. Integer ordinal sums remain safely bounded. The inspected shuffled-input fixture compares the complete result and input immutability. No target or pin input sort/mutation occurs.

One Geometry instance covers pin insertion, retained-auto reconciliation, candidate search and final validation. Entry insertion is preflighted against cumulative and live caps. Each bucket entry is charged before reading it, including self/repeated entries; per-query ID dedup prevents duplicate comparisons without hiding visits. The helper does not flatten/copy occupancy buckets or introduce unmetered all-pairs validation. Visited sets and topology/position structures are bounded by the accepted target. Global layout is one geometry pass; the future local helper's two-pass cumulative contract is not claimed to be implemented here.

Automatic candidates consume at most 32 probes per node and job-wide counters; exhausted candidates reject as `work_budget/candidate_limit`. Unsafe coordinates/cell ranges reject as geometry failure. Default 300×220 rectangles use the total gap48 constraint. Manual coordinates are copied exactly, offscope keys are ignored without deletion, and a colliding retained automatic position is released before bounded replacement. Final validation occurs before ready; reject branches expose no partial positions. Manual diagnostics use stable upper-triangle pairs, independently capped samples/affected IDs and a hard observation cap. Rejected diagnostics mark `complete:false`; successful truncated samples retain exact observed totals. Existing production comparison/pair-cap, repeated multi-cell, exact-cap/cap+1 and independent rectangle-gap fixtures are meaningful boundary evidence.

### Worker/controller ownership

The wall timer is armed before input preparation or Worker construction. Payload preparation validates the complete target and clones only target-known IDs and numeric XY fields, detaching captured arrays/counts from mutable caller state and leaving opaque saved keys untouched. No source/view blobs are posted. Native Worker structural typing is checked, but it is only a source type check.

Every job owns its timer/listeners/Worker. Cancel/replacement/dispose retire the closure even if a caller reuses an identical four-field token; mismatched replies leave the timeout active. Malformed current replies fail, and cleanup attempts both listener removals, timer clear and termination independently. Unsupported construction has no synchronous global-layout fallback. The worker entry invokes the pure helper and returns explicit rejected results or a measured result; this is not evidence that Vite has emitted or a browser has loaded the real module Worker. Preserve these paths while fixing I1.

## Evidence and remaining gates

Author evidence was read and hash-checked, not independently rerun: final `green-final.txt` records **71 tests / 4 files PASS** (12 core, 16 validator, 27 helper, 16 controller); scoped nine-file lint and source+tests noEmit exit0; pure core ES2023/types[] noEmit exit0. The receipt distinguishes initial missing-module setup RED from later behavioral timer-start, bounded-clone and candidate-classification failures and retains all intervening lint/type failures. Unit duration is not a compute p95 measurement.

The three narrowly authorized direct-core-source import exceptions are temporary Window A boundaries. Window B must add approved public exports, switch to the public package entry and remove the exceptions; no current public package integration or HTTP route exists here. HTTP 409/body-stream/abort/SQLite read-only invariance, visual aliases and two-pass measured geometry, FS-compatible live UI/save lifecycle, real compiled module Worker/browser, and fixed Express/Flask compute p95/wall-time gates remain unimplemented or unrun. Pure tests and native Worker type compatibility cannot close those gates. PERF02 remains PARTIAL.

Repair only I1 and its controller test, freeze the precise delta and retain this original report, then request targeted independent rereview. No repeat full-root gate is requested by this review.
