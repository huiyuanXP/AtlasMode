# CI group-edge hit fixture independent review

Date: 2026-10-10. Reviewer: existing delegated gpt-6.1-sol high, not the patch author. Scope: the frozen single-file groups-collapse fixture change, retained original CI failure trace, and author clean-run evidence. Read-only VM2 inspection; no source/test edits, test execution, builds, DB access, staging, or delegation.

**Decision: APPROVE — C0 / I0 / M0.** This approves the narrow fixture patch. It does not claim a new remote CI pass, a deterministic local reproduction of the old failure, or completion of FS/KN/POL product gates.

## Frozen inputs and scope

Root: `/tmp/atlas-integration-fs-kn-pol-20261010-c9d842hi`.

| Input | SHA256, checked before and after review |
| --- | --- |
| `groups-collapse-before.ts` | `a78f6f07f17ea28e04cad82d2955eed3635b72ddd2aeb40a66b5758f4c96646f` |
| `groups-collapse-after.ts` | `ef3552c971251c17cb1795f0f2267795d02ee1c1608ef04472db95724dd903dd` |

The complete before/after diff changes only the edge-path evaluate callback near lines 156–187: it becomes async and observes geometry before sampling the click point. Current isolated-workspace `tests/e2e/groups-collapse.spec.ts` bytes equal the frozen after file. Everything following coordinate sampling is unchanged; no product patch is present in this diff.

## Diagnosis and retained real interaction

Read original CI `38075266862` run metadata and failed log under `docs/superpowers/reviews/ci-repair-2026-10-10/ci-38075266862`. Browser run: 18 passed, 1 failed; failure is absence of the exact `调用证据` region after the group-edge click. Linux/macOS/Windows native jobs succeeded in that historical run; that does not certify the patched browser job.

Independently parsed the retained `trace.zip` (SHA256 `de121014a35d472522844768b65d070e22a24d6cb0290ba221c46d03a6e95586`) without launching a browser. Trace records Fit control click completing at 47920.453; requested edge evaluate spans 47923.015–47929.53, including its 47928.139 snapshot; native mouse click uses `(719.3897094726562,643.9149169921875)` and spans 47929.932–47945.072, with snapshot 47931.087. Before this sequence the recorded viewport is `translate(115px,-307.6px) scale(0.8)`; snapshot 47946.854 records `translate(264.443px,35px) scale(0.458415)`. This supports the reported camera/coordinate race. It does not prove every possible missed click has this cause.

The patch observes the actual attached SVG path's six `getScreenCTM()` coefficients and `d` string on consecutive requestAnimationFrame callbacks. Four consecutive equality comparisons are required (five identical observations from an initially empty previous value). A changing path resets the stable count. Missing matrix or detached element throws; elapsed time exceeding five seconds throws on a frame. The existing Playwright evaluate timeout still bounds a suspended RAF; the patch does not increase any test/action/assertion timeout.

After settling, the original real-path sampling remains: `getPointAtLength`, matrixTransform, `document.elementFromPoint`, and exact closest edge `data-id` equality. The first projected route remains tied to the API-discovered actual alpha→outside relation ID, with the existing count of two projected routes. If no unobstructed point exists the helper throws. There is one `page.mouse.click` after the evaluate, no click retry/catch, no dispatchEvent, no store/API replacement for the click, and no product-state injection.

The original exact evidence visibility, alpha/outside names, evidence file/line and relation ID assertions remain. Subsequent caller inspection/source viewing, group drag and saved positions, approval validity after view changes, circle-mode transitions, reload and owned-server restart, shared-function mirror counts, true-domain planning handle drag, add_relation source/target/type API assertion, original source byte and path invariants, and no page errors/external requests are unchanged. No historical approval/history assertion was deleted; this particular fixture itself has no separate history-list assertion, so review does not claim history-list coverage.

## Evidence limits and raw receipts

Read author logs; reviewer did not run them:

| Evidence | Observed result | SHA256 |
| --- | --- | --- |
| `head-groups-browser.log` | Three prelaunch failures: `/usr/bin/chromium` does not exist. Environment setup error, not regression RED. | `72db5cf0a1fa04fe91b092599cd0f487a363bfb0a28aa3208457a490e3938a17` |
| `head-groups-browser-actual.log` | Correct browser path, old fixture: 3 passed, 28.5s. | `04baaa29fb6defcf9d91f34ea2889e258d85a2f55402f5d90650ccf4fbe17e07` |
| `groups-fixture-green.log` | Patched fixture: 3 passed, 31.6s. | `7a3eee51200569f2ece58177910066e3e2a77759fdaed48b8c3a1341759080e9` |
| `groups-fixture-lint.log` | Empty retained log; author reports exit 0. Empty bytes alone do not independently establish exit status. | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Retained `workspace/artifacts/e2e-groups-fixture-three-pass/results.json`: expected 3, unexpected 0, skipped 0, flaky 0; repeatEach 3, retries 0, one worker. Original remote CI failure plus local old-fixture 3 PASS and patched-fixture 3 PASS are separate evidence, not a fabricated local RED→GREEN.

One read-only inspection initially looked for the results file at its former `artifacts/e2e/results.json` path and got FileNotFoundError; locating the retained `e2e-groups-fixture-three-pass/results.json` corrected this reviewer path error. No fixture or execution failure is inferred from that command.

## Remaining gates

No blocking findings in this patch. Root owns fresh remote CI and compiled real-pointer FS/KN/POL acceptance. Four-frame quiet geometry is an observation of this path, not a universal proof against a later unrelated layout mutation; unchanged exact evidence assertions still fail if the resulting click misses. Retain original trace/failure and all clean-run receipts. Frozen before/after SHA remained exact at the end of review.
