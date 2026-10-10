# PERF-02 I1/I2 targeted documentation repair

Date: 2026-10-10 UTC. Author `/root/pol01_review`, explicitly assigned gpt-6.1-sol high. Status: **repair frozen; independent limited re-review pending**. This is an author repair receipt, not APPROVE or a product performance result.

Only the two exclusive PERF spec/plan and this dedicated review ledger/archive are written. No product source/DB/shared documentation, build, test, lint, stage, commit, push, dist or spawning. Original stage draft remains SHA256 `d950e91213cb08362a57cf9b5d7ed773f9b30dbd8582e2950962cae447403249`.

## Original evidence preserved

The complete original independent review was read and compared with current actual graph/group projection loops and `effectiveFunctionPath`. Its decision remains REQUEST_CHANGES, C0/I2/M0. The file is untouched.

| Original artifact | Archive / original review path in this directory | SHA256 |
| --- | --- | --- |
| Spec | `original-design.md` | `6a9fbbec9ea3eff885fb828896e78e6dd61bc60bb5f93ebfd07bf3a710bc85a8` |
| Plan | `original-plan.md` | `97653f4e6f39496ef8092ec36171314c16a0db0d27b11536d19dd6a3b340421c` |
| Independent original review | `independent-design-review.md` | `7d14fb6e4a070aa52a2e2b57cec22993c5c7c58c734c8a4854e9991fc676073e` |

Original spec/plan are copied as bytes before either target changes, with guards against an unexpected source SHA or overwriting a different archive. `original-documents.sha256` provides a directory-relative verification manifest. Local ROG `perf02-original-spec.md`, `perf02-original-plan.md`, `perf02-independent-design-review-original.md` contain the same exact bytes. Failed original findings are retained, not rewritten as closed by the author.

## I1 repair: pre-projection work and independent fallback

Actual `graph/projection.ts:67–193` scans uncapped Plan.operations, performs node×operations work and nested findLast, `effectiveFunctionPath` scans operations twice per addition, graph relation lookup/removal scans, and allocates endpoint-present planned edges. Node count alone cannot bound this.

Repaired contract has a length gate before map/filter/projection allocation: visible operations≤4096 (fact mode ignores operations without scanning), graph nodes/relations≤300/900, references≤500. It counts at most two bounded operation passes (8192 visits), two relation passes (1800), two node passes (600), one references pass (500), then exact emissions, base edge upper bounds, existing nested-loop conservative work and visual allocations. 501 emitted nodes / 2001 valid planned edges reject before projectGraph. Additional work upper bound≤2000000 and major projection entries≤10000 include node-neutral edits. Stored Plan/schema/editor data and operation meaning remain unchanged; no truncation.

Group preflight bounds groups/collapsed IDs≤4096 and member visits≤20000 before copies/aliases, plus existing group-loop conservative work≤2000000 and major entries≤10000. It retains 500-card/2000-route gates before projectGroups, including unknown-member temporary entries in allocation upper bounds. Ready counts are complete; rejected early-stop lower bounds use separate fields and cannot be called actual rendered totals or upper bounds.

Fallback cannot reuse a rejected expanded projection. It retains a previous accepted safe same-project graph with truthful old scope, or independently preflights and constructs `projectGraph(graph, [], fact, positions, locale, [])` with no groups and no references, at most300/900. If raw graph itself is over cap or unavailable, use an empty safe canvas and explicit failure. No filter/collapse/editor/position mutation, no automatic group success claim.

Future Task3/4 assertions cover two loaded endpoints+2001 distinct valid relations, projectGraph=0 for rejected layer, operation visits=0 at4097 visible operations, filter=fact on that same plan, node-neutral nested work, input caps, group/member/work caps, and independent bounded fallback/no writes. Original 501/2001 group/mirror, alias and evidence tests remain.

## I2 repair: real collision work and bounded diagnostics

Cell bucket count and candidate probes do not bound dense bucket traversal. The repaired GeometryWork records every bucket-entry visit even if dedup skips its comparison; separately records every actual rectangle predicate. Pins insertion, retained reconciliation, candidates and final validation consume the same job budget. No uncounted final pair scan or allocating bucket copies first.

Global/local hard proposal caps respectively: visits4000000/200000, comparisons1000000/50000, manual pair observations4096/256; probes160000/32000, cumulative cell entries200000/40000 (live200000/20000), at most64 cells/box and32 candidates/auto/pass. Fixed cell512. No edge point sampling or unbounded long-edge occupancy.

Local measurement passes carry `priorGeometry` and return cumulative stats without mutating input. Session cannot reset the second pass budget. Candidate positions are buffered; old projection dimensions can be measured before a single final apply. Exhaustion at either pass means no partial ready/apply/save.

Manual diagnostics output at most64 affected pin IDs and32 sample pairs. Final per-pass pair enumeration is stable-ID upper triangular with per-query bounded dedup, no unlimited pair Set. Full final validation gives exact per-pass pairsObserved and complete=true; output sample truncation is explicit. Exhaustion yields rejected/complete=false with observed lower bound and stage. Actual manualPairObservations count work across passes even when the same pair repeats. Saved pins/offscope keys remain unchanged on all failures.

Future Task2/3/4 include global/local dense co-located, same-cell nonintersecting, repeated cell visits, retained-auto/new-pin, high-degree/long-edge, final-validation cap+1 and diagnostic output size tests; local two-pass accumulated exhaustion must not persist or apply first-pass candidates. Smaller injected test caps may prove exact loop boundaries but production constants require their own fixtures. Numeric proposals remain subject to real target/DOM timing gates.

## Frozen repaired targets

| Target | SHA256 |
| --- | --- |
| `docs/superpowers/specs/2026-10-10-perf02-design.md` | `d8ab6c875b507b48fca202fde75a47117ac8218e5a0dbfcfea4b1a167c2965d3` |
| `docs/superpowers/plans/2026-10-10-perf02.md` | `1359a2d4ae3fb2659061b4904592f1528628500ac00ac332d22302fe61553ea3` |

`targeted-design-repair.sha256` contains repository-relative target/ledger/archive/original-report hashes. Full target capture5000/20000/8MiB, actual Express/Flask global-readiness targets, source/domain/visual identity, saved-view preservation, worker lifetime and FS/GRP mutual exclusion remain as drafted. No measured capability, future PASS or independent closure claimed. Main must send the frozen two-doc repair to the independent high reviewer; Window A needs an explicit subsequent authorization after review acceptance.
