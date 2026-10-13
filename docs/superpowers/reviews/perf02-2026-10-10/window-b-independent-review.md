# PERF02 Window B independent source review

2026-10-10 UTC. Reviewer `/root/ag05_impl`, explicit gpt-6.1-sol high; independent of Window B author. Verdict: **APPROVE for the frozen seven-file partial interface window**. Critical 0 / Important 0 / Minor 0. This is not PERF02 ticket completion, production UI acceptance, or authorization for another shared-source window.

## Exact scope and byte evidence

Read-only inspection of VM2 `.superpowers/sdd/2026-10-10-perf02-window-b/` and its local frozen copy at `perf02-window-b/freeze/`. I independently hashed the local exact frozen bytes, inspected the owned patch, seven after files, their relevant captured dependencies, author raw RED/GREEN output and source-alias configurations. No product source edits, source delta, builds, test execution, server processes, real databases, model calls or stage/commit/push in this review.

- manifest.json: `f927e2af010f05b3db59b19eb1e970cc79b8f6c4303d97710c85466bcfb965dc`
- source.sha256: `270b02acb3762ecba42664e650ea75a63fac739fd14c6fe4df400abda6887186`
- receipt.md: `1c435be4d76584e0e957b9766994f40686b078bfd69ac3e27726a2676fd32f98`
- owned.patch: `d4092e1f3881c81112f2ce479f8854409e9cd5c881de8d27da7ca8f1e9147747`

All 333 entries of evidence.sha256 matched, with no missing or mismatching files. There are 337 actual frozen files: the four additional files are the outer and three nested evidence.sha256 lists themselves. Seven source.sha256 entries were independently resolved relative to `after/` and matched. All seven manifest after hashes, all four existing before hashes, and their caller-source copies matched. Caller source 153/153, protected paths 10/10 and original A archive list 111/111 matched. Source list paths are after-root-relative, not outer-freeze-relative.

Frozen after hashes:

| Path | SHA256 |
| --- | --- |
| packages/core/src/index.ts | 5c32f683752f321504c3c3abd6cb557aa752399973c9384535ef73a29bbdc9c5 |
| apps/server/src/queries.ts | 6ca8563aa93c7b4a7f6a2384aba97b322a40bf3a831618902559b021959958b2 |
| apps/server/src/routes.ts | 9a906e8e637aeafacc2197e3959b27ac76636dd0fb0a62ad50549374d872cfdb |
| apps/web/src/api/layout-target.ts | 058839e79ff807800f1c7f3e34f5d9bc65d2b093f1f7668cf5b11a4db0ce9c17 |
| apps/server/src/layout-target.test.ts | 9eb6c0350f70759484e9bb56472e0282e7213a3696a9b0651aaff29f7cb7114f |
| apps/web/src/api/layout-target-client.ts | dade820730d12798a447803f13edc0879372859ddca14c274eb2a64125dc7ad0 |
| apps/web/src/api/layout-target-client.test.ts | bf42d917d5996527e6e9fbfd62f00b696afd7b475b0409e273b9746feb455f26 |

I mechanically removed only the B import/property from queries and only the B strict schema/route from routes; both restored their corresponding before bytes exactly. The core index after bytes equal its exact original prefix plus one public export. Validator changes are public imports and removal of temporary import exceptions; its validation behavior is unchanged. Workspace and server captured hashes match their protected baselines. client.ts is not an owned edit and is explicitly UNWIRED; concurrent KN changes are not claimed unchanged.

## Source review findings

No actionable C/I/M finding in this frozen scope.

1. **Read-only route, capture and ownership.** The added route at routes.ts:342 delegates through the existing strict write-registration parser; that parser checks project params, rejects extra query keys and parses the strict body before entering the query. The new body permits only a nonblank expectedSnapshotId. queries.ts:21 captures service.getSnapshot exactly once, then calls the approved helper on that object. Captured Workspace.getSnapshot checks project existence and snapshot.projectId ownership. The existing server onRequest Host/Origin guard executes before body/service work, and its error boundary maps SNAPSHOT_CHANGED to 409 and unexpected exceptions to generic 500. The B endpoint does not refresh, read source through the indexer, mutate plans/views/settings or call any writer.

2. **Truthful complete target and early refusal.** The protected approved core helper counts all raw actual node/relation lengths, including external nodes and null-target unresolved relations. It scans byKind without creating the DTO before count refusal; over-count responses omit node/relation arrays and use node-before-relation precedence. Within length caps, it checks IDs/endpoints and projects only permitted fields. UTF8 JSON counting stops as soon as its cap is exceeded, before serializing a full response; rejection omits a fabricated actualBytes total. No source/name/signature/path/evidence data is added by the B glue. This is an early DTO/serialization bound, not a bounded SQLite read: captured SqliteStorage.get loads and JSON.parses the full stored snapshot before this query sees it, and count refusal still scans every captured node for truthful byKind totals. Receipt correctly states these limits. No claim of bounded raw DB loading or constant-time refusal is accepted.

3. **Bounded body before parse.** layout-target-client.ts:48–83 obtains a real stream reader, allocates one fixed 8MiB byte buffer, checks actual chunk length against remaining capacity before copying, copies accepted bytes immediately and uses fatal UTF8 decode followed by JSON.parse only after the stream is complete. Content-Length is not trusted as the actual-size proof; success and HTTP-error bodies have the same cap. Over-limit data cannot become a partial ready result. The strict validator checks exact requested project/SID, field sets, enums, complete counts/IDs and bounded DTO size. The cap bounds retained byte input and JSON input size, not all transport queues, decoded strings, parsed-object overhead or total browser memory.

4. **Cancellation and cleanup.** Client caller abort propagates to its AbortController and cancels a pending body reader. The read loop checks the abort signal after read completion, including done, so cancellation cannot masquerade as a complete empty/partial response. finally removes the listener, aborts/cancels unfinished reading and releases the lock. It deliberately does not await an untrusted underlying cancel promise; the retained cancel-red/cancel-green evidence addresses that hang. Completed bodies detach late caller aborts. This contract assumes the supplied fetch implementation honors its AbortSignal while awaiting headers; no general termination guarantee is claimed for an arbitrary transport that ignores fetch cancellation. Cancellation cannot make a synchronous SQLite read or JSON.parse preemptible.

5. **Summary hash boundary remains explicit.** The standalone helper uses the response contentHash as the validator's expected hash, so it structurally validates the hash but does not authenticate it against the earlier separately captured summary. This is documented in code and receipt and safe as an UNWIRED partial helper; the future workspace caller must compare the returned hash against its captured summary before applying or caching a target. Project and requested SID are checked directly today. The later thin HttpApi import/wiring must also verify module initialization/import-cycle safety because this helper imports ApiError from client.ts.

## Receipt review and remaining gates

I read, but did not independently rerun, author raw receipts: initial exit1 for missing exports/query/route/helper; cancel-red exit1 with 29 pass/1 fail; cancel-green exit0; final regression-post-cancel exit0 with 104 tests across six files (unchanged A73 plus B31 = server13/client18). The tests retain exact 5000/20000 and count+1 cases, exact actual 8MiB/cap+1 HTTP payloads, complete raw ID coverage, foreign snapshot ownership, stale SID/extra query/body refusal, actual node:http Host and fetch Origin guard, real disposable SQLite row comparisons/no put-delete/source mutation, and real native chunked fetch decoding. Client tests cover success and error overflow, reused tiny buffers, invalid UTF8/JSON, no body, network/read failure, pending read abort, nonsettling cancellation and listener/lock cleanup.

The final lint-seven-path receipt and owned production/tests source-alias noEmit receipt both record exit0. Their aliases target the captured source graph rather than shared dist. The initially overwritten type-log limitation is explicitly disclosed in initial-type-observation.md; final raw output and exit are separately retained. Neither the overwritten observation nor source test success is presented as a production build.

**Still pending:** HttpApi.layoutTarget wiring; captured summary hash comparison and stale generation guards at the real caller; production Worker packaging/loading/termination; real Express/Flask complete targets and compute/roundtrip P95; Workspace/Canvas/default layout and pins integration; actual browser geometry/FS offviewport behavior; cross-platform and full integration gates. No UI or complete PERF02 claim follows from this APPROVE. Existing approved A and FS freezes remain outside modification scope.
