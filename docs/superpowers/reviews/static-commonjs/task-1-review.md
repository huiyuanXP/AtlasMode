# Spec Compliance

❌ Issues found: Task1's visible callable-identity guard is incomplete for duplicate local function declarations (I1). The registry rejects their exported mapping, but checker fallback still resolves an ordinary local call to the first declaration. The rest of the inspected Task1 scope is implemented; Tasks2/3 remain separate gates.

Review range: `04b440b341107888d9bb49a4d9ae810fcb3377bd..23b60de9d5675130cdca27862e44ea19988cab0a`. Reviewed the controller's 55,654-byte `review-04b440b..23b60de.diff` once in four bounded chunks. All five brief-listed files appear in the package. Read the spec, formal plan, brief, context, worker report and recorded final check logs. No source edits, test-suite reruns, target execution, browser runs, helpers or commits.

## Strengths

- The phased registry collects rewrite/export/consumer rejection facts before exposing entries (`packages/indexer/src/commonjs.ts:281`, `:646`), including shared consumer mutation and property-isolation tests (`packages/indexer/src/commonjs.test.ts:248`). This avoids traversal-order-dependent positives.
- Lexical and mode validation precedes require-literal module lookup (`packages/indexer/src/commonjs.ts:432`). Direct user functions named `require` retain their actual ordinary callee identity, with a dedicated regression (`packages/indexer/src/commonjs.test.ts:210`).
- The integration uses the existing AST declaration IDs and only updates verified exported flags (`packages/indexer/src/typescript.ts:168`); handled CommonJS classifications cannot fall through into checker resolution (`:305`). The callable module value is distinct from a property named `default` (`packages/indexer/src/commonjs.test.ts:417`).
- Tests exercise actual captured compiler/graph behavior and public SourceIndexer fixtures. Recorded authentic public RED reproduces both old false positive calls and the missing entry flag. No target fixture is executed.
- The five planned files preserve the public API/storage boundary, add the optional internal mode provider, document explicit `.cjs` scope, and leave package capture to Task2 (`docs/superpowers/contracts.md:303`).

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

**I1 — Duplicate local callable declarations bypass the new identity guard.**

- **Location:** `packages/indexer/src/commonjs.ts:692` and `:706`; downstream `packages/indexer/src/typescript.ts:273`. Related coverage: `packages/indexer/src/commonjs.test.ts:359` and `:461`.
- **Evidence:** `callableSymbol` rejects multiple value declarations at `commonjs.ts:258`, so the exported `help` mapping is correctly unknown. However, `classifyCall` only rejects a local symbol when it occurs in `rewritten`; two function declarations do not enter that set. It returns `undefined`, and `targetFromSymbol` accepts the first declaration. The focused captured-AST probe below produced local `help()` → `resolved`, target `function:554f47b2a134e60bb6335d1bd23068db` (`help`, first implementation), while `mod.help()` → `unresolved`. The second implementation exists separately as `function:42e90e4634b834c414b216160debfae6` (`help#2`).
- **Reproducer source:** `function help() { first(); } function help() { second(); } exports.help = help; function caller() { help(); }` in `lib.cjs`. Duplicate top-level function declarations in a CommonJS script select the later implementation; the graph positively points at the earlier body.
- **Why it matters:** This contradicts Task1's visible callable-redeclaration/rewriting safety and the worker's claim that local CJS checker bypasses are guarded. The existing duplicate-declaration test only checks the imported call, so the 251-test run does not answer this case. This is Task1 callable identity, unrelated to future package metadata or runtime transport work.
- **Fix:** Ensure ambiguous executable declarations in a CJS candidate also produce an explicit unresolved local-call classification before checker fallback. Share the relevant uniqueness reasoning with export validation without blocking ordinary unique direct calls or valid single-implementation overload declarations. Add a local duplicate-body regression asserting no first-declaration target, retain the imported negative control, and perform the affected validation on the changed source.

### Minor (Nice to Have)

None.

## Verification evidence and focused probes

- `.superpowers/sdd/2026-10-03-static-commonjs/scratch/task-1/red-public.log`: actual initial public RED, 3 failed / 43 skipped. Both safety cases returned a resolved helper ID; stable export had `exported: false`.
- `scratch/task-1/final-tests.log`: final **251 passed / 6 files**, start 04:00:29, duration 2.52s, no warnings/errors in the recorded log. Worker reports 81 dedicated registry tests plus three public regressions; the net diff contains those focused cases. The earlier 247-test run is superseded.
- `scratch/task-1/final-build.log`, `final-typecheck.log`, `final-lint.log`: recorded core/indexer build, core/indexer typecheck and root lint output is clean; the worker reports exit 0. No repeat runs were performed.
- Named focused read: inspected the unchanged `targetFromSymbol` implementation at `packages/indexer/src/typescript.ts:262` to determine whether the new guard's `undefined` result can select an earlier duplicate declaration. This confirmed first-declaration acceptance at `:273`; no broader code crawl was needed. A line-number-only locator supplied precise references without another changed-file review pass.

**Probe 1 — unanswered duplicate-local-call fallback doubt (confirmed I1).** Executed once from `/workspace/AtlasMode`, using the worker's compiled modules and in-memory captured strings, without evaluating any fixture code. Exact command:

```bash
node --input-type=module <<'NODE'
import { indexTypeScript } from './packages/indexer/dist/typescript.js';
import { Graph } from './packages/indexer/dist/graph.js';
const graph = new Graph('review-duplicate');
const files = {'lib.cjs': 'function help() { first(); } function help() { second(); } exports.help = help; function caller() { help(); }', 'entry.cjs': "const mod = require('./lib.cjs'); mod.help();"};
indexTypeScript(Object.entries(files).map(([path,text]) => ({path,bytes:Buffer.from(text)})),graph);
console.log(JSON.stringify({calls:graph.relations.filter(r=>['help()','mod.help()'].includes(r.evidence.text)),implementations:[...graph.nodes.values()].filter(n=>n.name==='help')},null,2));
NODE
```

Output facts: exit 0; local `lib.cjs:1` `help()` resolved to the first implementation ID quoted in I1; imported `entry.cjs:1` `mod.help()` unresolved with `CommonJS export help has no unique stable captured implementation`; both `help` and `help#2` nodes exist and have `exported: false`. Full relevant result is retained here as explicit IDs and classifications; original tool output remains in the review transcript.

**Probe 2 — lexical `exports` name preservation doubt (cleared; no finding).** Executed once; the question was whether `exportReference` steals an ordinary local/imported callable named `exports`. Exact command:

```bash
node --input-type=module <<'NODE'
import { indexTypeScript } from './packages/indexer/dist/typescript.js';
import { Graph } from './packages/indexer/dist/graph.js';
const graph = new Graph('review-lexical-exports');
const files = {'lib.mjs': 'export function work() {}', 'entry.mjs': "import {work as exports} from './lib.mjs'; function caller() { exports(); }", 'local.cjs': 'function exports() {} function caller() { exports(); }'};
indexTypeScript(Object.entries(files).map(([path,text]) => ({path,bytes:Buffer.from(text)})),graph);
console.log(JSON.stringify(graph.relations.filter(r=>r.evidence.text==='exports()'),null,2));
NODE
```

Output: exit 0; `entry.mjs:1` `exports()` resolved to `function:4cbb3f2922ff0155cd3029fc33a255d6`; `local.cjs:1` `exports()` resolved to `function:c28eb8003c99e709ee4e4aef25657bde`. Identifier bindings return before the export-reference fallback (`commonjs.ts:578`), preserving these ordinary calls.

## Individually declined behaviors and owners

1. **Package manifest bounded capture/strict JSON/opaque nearest scope:** not implemented or accepted by this Task1 gate; Task2 owns it.
2. **Positive `.js` package-mode inference:** only the internal hook is reviewed here; Task2 owns captured package evidence and public `.js` acceptance.
3. **Exact independent package budgets and overlap-byte reuse:** Task2 owns reader/capture tests, including preservation of configuration depth/selected-chain rejection.
4. **Package metadata schema, source/config/package hash and metadata/source count separation:** Task2 owns implementation and affected core/indexer checks.
5. **Actual HTTP and SDK MCP CommonJS parity:** Task3 owns compiled transport validation; unit graphs are not transport proof.
6. **Package-only plan/route freshness and persisted approval/history immutability:** Task3 owns actual service/SQLite lifecycle evidence.
7. **Legacy absent package field versus recorded zero:** Task3 owns actual persistence and bilingual UI checks.
8. **Browser entry/source/unknown reason browsing, screenshots, console/protocol/external-request evidence:** Task3 owns execution and actual image viewing.
9. **Final all-workspace build/typecheck/lint/test on combined source:** Task3 owns the integrated gate. The affected Task1 checks are not that gate.
10. **Pinned Express product browsing and clean target HEAD before/after:** Task3 owns it; no mature target was re-run here.
11. **Vite/Flask current-revision acceptance:** outside this task; historical evidence remains historical, and the plan intentionally does not repeat these gates.
12. **Runtime load/build compatibility and arbitrary Node value flow:** explicitly unsupported by the static subset; no such acceptance is inferred from `.cjs` mode or resolved declaration IDs.
13. **Recursive forwarding/package exports/workspace source mapping:** deliberately excluded from Task1; controller owns future ticket scope, not a missing implementation in this gate.
14. **Native Windows/macOS, remote CI and actual client registration:** remain unrun; controller owns truthful cross-platform/client reporting.
15. **Fresh cloud restoration:** remains unrun; controller/onboarding owns that separate environment acceptance.
16. **Vendor checksum and clean Git state after commit:** worker reports them; the task reviewer did not regenerate Git/checksum evidence. Controller owns final repository-state acceptance; do not confuse 75 vendor entries with a skill count.
17. **Earlier Playwright host color warning:** outside this source/test run and already parked in the prior milestone; controller/Task3 owns accurate future browser-output reporting. The clean Task1 logs do not erase it.

## Assessment

**Task quality: Needs fixes — 0 Critical / 1 Important / 0 Minor.**

The registry establishes a coherent conservative boundary and meaningful regression coverage. I1 leaves a reproducible incorrect positive local call in the exact callable-identity area this task hardens; fix that fallback gap before accepting Task1 and moving to Task2.
