# MVP whole-branch single fix wave

BASE: be10c8418398f4c6262218bddf137dbba1ec6963
Workdir: /workspace/AtlasMode; local branch work. No other active implementer.

Read AGENTS.md and relevant installed Superpowers skills. Use TDD and systematic
debugging, preserve package boundaries and target nonexecution. Read the complete
independent findings in whole-review.md; this brief assigns ALL six findings to one
implementation owner. Do not spawn implementers or reviewers. Parent dispatches
the one scoped independent re-review when your final report is ready.

## Required outcomes

1. WR-I1: Excluded or unavailable unchanged source cannot prove approved function
   or relation removal, or other negative structural claims. Provide enough bounded
   scan evidence through shared snapshot/ports to return unknown where evidence is
   missing. Preserve genuine deletion success, unaffected positive facts and old
   snapshot readability. Real indexer/service lifecycle regression for ignoring an
   unchanged source and its relation; include directory exclusion where appropriate.
2. WR-I2: Enforce local service authority and reject untrusted browser origins before
   sensitive API reads/writes, including project/source/approval. Preserve actual
   production UI, intended development proxy and origin-less local MCP requests.
   Tests must show denied requests have no approval side effect and intended local
   traffic works. No global configuration, public endpoints or blanket CORS workaround.
3. WR-I3: A unique same-name function in another file cannot silently become the
   approved reuse target. Only supported explicit binding/approved move may establish
   a new target. Preserve moves, stable-ID matches and conservative candidate evidence.
   Real regression for one differently implemented substitute and no approved move.
4. WR-I4: Mutable/reassigned TS/JS callables cannot be resolved to an obsolete
   initializer. Conservative unresolved evidence is sufficient; do not add runtime
   execution or a flow engine. TS and JS reassignment regression, immutable/direct
   controls, and downstream check that the obsolete edge cannot satisfy required reuse.
5. WR-M1 (prior T08 M4): Reject dirty fixed-target inputs including staged/untracked
   supported source. Establish clean provenance before capture and detect intervening
   changes at completion; record it in the evidence. Focused disposable-Git preflight
   regression suffices. Existing clean Vite/Flask evidence remains credited: DO NOT
   repeat unchanged public-target indexing/browser gates just to add a guard timestamp.
6. WR-M2: Structurally valid planned call/reuse validation must explicitly expose
   compatibility uncertainty/possible adaptation as a warning, not an approval-blocking
   error. Shared core/service/API/MCP/UI result should preserve it. Cover normal planned
   connection and the shared adapter behavior; no type inference feature requested.

Read all finding triggers/evidence/limits in whole-review.md rather than relying only
on these summaries. If a repair requires a new structural contract, propose the small
contract to parent before implementing it; do not silently reorganize or expand scope.
The next captured-tsconfig spec/plan is preparation only. Do not implement it here.

## Verification and delivery

Run focused RED before each behavior repair, save logs in this plan's scratch workspace.
Run affected GREEN checks while iterating. Build changed workspaces and check types/lint;
run the full integrated suite ONCE before commit because this wave spans core/indexer/
service/server and shared adapters. Actual smoke and the existing browser+SDK joint flow
are justified once after the final changes to verify the new HTTP boundary/validation
warnings preserve real UI/MCP operation. Use available system Chromium via the existing
Playwright override; view screenshots if UI output changes. Do not rerun fixed public
targets or repeat passed suites without another failure/change. Native Win/mac remain
unrun; keep all claims at their actual revision.

Update contracts/README/environment/state/coverage only for the final changed behavior
and observed verification. No dependency/lock/vendor changes, databases or target repos
committed. Stage only this wave's changes and make one or more local coherent commits.
Self-review and write whole-fix-report.md with exact RED/GREEN commands/output, all six
finding outcomes, files, checks/counts, commit SHA and remaining concerns. Reply under
15 lines using DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT. Parent then performs the
single scoped re-review; no second final fix wave is automatically authorized by SDD.
