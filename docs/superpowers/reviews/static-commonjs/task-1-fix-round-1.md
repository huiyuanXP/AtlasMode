# Task1 fix round1

Fix BASE23b60de9d5675130cdca27862e44ea19988cab0a. OriginalTask1 implementer only.
Read originalbrief/spec/plan and fulltask-1-review.md, then exactfindingbelow.
Fix I1 only with authenticRED/localduplicatebody regression, preserve importednegative,
ordinaryunique/directuserrequire/ESM and singleimplementationoverload controls. Share
executabledeclarationuniqueness reasoning as needed; no packagecapture/valueflow/forwarding.
Run meaningfulfocusedGREEN then affectedcore/indexer checks/build/types/rootlint because
source changed; rootall/browser/targets stillTask3. Scope onlyfindings+necessarytests/docs.
Selfreview, coherentlocalcommit, APPENDfixreport/logcommands/results to task-1-report.md;
logsinsideplan scratch/task-1/fix-round-1; nohelpers/reviewerdispatch/parentfix/push.
Shortreport status/commit/counts/concerns/reportpath. Escalate architecturaluncertainty.

## Exact Important finding from reviewer

**I1 — Duplicate local callable declarations bypass the new identity guard.**

- **Location:** `packages/indexer/src/commonjs.ts:692` and `:706`; downstream `packages/indexer/src/typescript.ts:273`. Related coverage: `packages/indexer/src/commonjs.test.ts:359` and `:461`.
- **Evidence:** `callableSymbol` rejects multiple value declarations at `commonjs.ts:258`, so the exported `help` mapping is correctly unknown. However, `classifyCall` only rejects a local symbol when it occurs in `rewritten`; two function declarations do not enter that set. It returns `undefined`, and `targetFromSymbol` accepts the first declaration. The focused captured-AST probe below produced local `help()` → `resolved`, target `function:554f47b2a134e60bb6335d1bd23068db` (`help`, first implementation), while `mod.help()` → `unresolved`. The second implementation exists separately as `function:42e90e4634b834c414b216160debfae6` (`help#2`).
- **Reproducer source:** `function help() { first(); } function help() { second(); } exports.help = help; function caller() { help(); }` in `lib.cjs`. Duplicate top-level function declarations in a CommonJS script select the later implementation; the graph positively points at the earlier body.
- **Why it matters:** This contradicts Task1's visible callable-redeclaration/rewriting safety and the worker's claim that local CJS checker bypasses are guarded. The existing duplicate-declaration test only checks the imported call, so the 251-test run does not answer this case. This is Task1 callable identity, unrelated to future package metadata or runtime transport work.
- **Fix:** Ensure ambiguous executable declarations in a CJS candidate also produce an explicit unresolved local-call classification before checker fallback. Share the relevant uniqueness reasoning with export validation without blocking ordinary unique direct calls or valid single-implementation overload declarations. Add a local duplicate-body regression asserting no first-declaration target, retain the imported negative control, and perform the affected validation on the changed source.

