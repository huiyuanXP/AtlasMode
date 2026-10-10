# IDX03 isolated staged-tree integration

Input tree d034dcd5062e49a591825ba1afe59e572fe815c7, base619c39a, independent workspace `/tmp/atlas-idx03-clean-20261010-wn3h_oyv/workspace`. [Input receipt](../clean-integration-input.json) records the whitelist isolation: no unfinished KN/POL/FS source or exports, no user AGENTS modification, frozen IDX navigation/core patches. Fresh npm ci: audit0; root build/typecheck/lint/**882 tests in78files**/smoke PASS. [Commands, durations and exit codes](results.json); [source before](source-before.json) and [after](source-after.json) are identical.

Initial full Chromium run: **14/19 PASS,5 FAIL**, retained in [raw log](e2e.log). All failures were old diagnostics summary locators matching six nested summaries. Two test-only selector repairs retain all assertions and passed the five affected complete browser scenarios on this same candidate; [precise repair, complete original artifacts, revised tests and results](e2e-locator-repair/README.md). This is a separate5/5 retest, not a local single19/19 PASS.122 product-source and146 compiled-input hashes remain unchanged; no root checks repeated after this test-only repair.

Primary viewed final references overview/no-import/Chinese/Express screenshots from the delegated runtime gate; that scoped build included unrelated complete modules, so it is explicitly separate from this clean independent integration. Delegated483/16 and source40/compiled79 receipts remain immutable. New remote CI after the restricted commit is still pending. No deployment/merge or source target execution.

## Committed native and full browser CI

Exact commit `f01c1cbdcea58e9d932ce5fb5c945d321852b443` [CI38069639172](https://github.com/huiyuanXP/AtlasMode/actions/runs/38069639172) completed SUCCESS in all four native Linux/macOS/Windows and browser jobs. [Original head/jobs/steps](remote-ci-38069639172.json), [raw browser log](remote-browser-38069639172.log) show a separate single complete19/19 browser PASS. The initial local14/19 FAIL and targeted5/5 PASS above remain unchanged. This meets IDX03 closure; no KN/POL/FS pending source was included.
