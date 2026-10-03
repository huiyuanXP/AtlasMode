### Spec Compliance

- ❌ Issues found: forwarding canonicalization does not distinguish a forwarder's detached local `exports` object from its replaced `module.exports` object. Consequently, a call through `exports.help()` can incorrectly resolve to the forwarded leaf. This violates the required guarded namespace identity; see I1 at `packages/indexer/src/commonjs.ts:697` and `packages/indexer/src/commonjs.ts:844`.
- ✅ The four required task files are changed; the additional plan hunk records the controller-authorized single historical-test migration. The migrated test asserts the actual `forward.cjs` leaf through the existing exact-ID helper, rather than merely accepting any resolved result (`packages/indexer/src/commonjs.test.ts:522`, `packages/indexer/src/commonjs.test.ts:38`, `docs/superpowers/plans/2026-10-03-static-forwarding.md:61`). The other historical test expectations are unchanged in the supplied diff.
- ✅ The implementation retains the analyzer's public interface, physical Binding modules and import evidence; it adds private forwarding/group state and canonicalizes only guarded export lookup (`packages/indexer/src/commonjs.ts:126`, `packages/indexer/src/commonjs.ts:144`, `packages/indexer/src/commonjs.ts:718`, `packages/indexer/src/commonjs.ts:844`). No dependency, lockfile, vendor, core/service/storage/server, mode-provider or hash implementation hunk is present.
- ⚠️ Cannot verify from this diff alone: unchanged filesystem confinement, full configuration/package budgets, all historical records, and cross-process plan/route/approval behavior. The controller should retain the existing confinement evidence and complete the assigned Task2 transport/history gates; source-only evidence is not those gates (`docs/superpowers/contracts.md:369`, `.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:75`, `.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:99`).

### Strengths

- ✅ Chain validation occurs after require-SCC marking and before escape collection. It checks captured relative targets, valid modes, invalid modules, cycles and the 16-edge boundary, then applies failed-chain rejection only after all walks, avoiding order-dependent proof (`packages/indexer/src/commonjs.ts:722`).
- ✅ Physical `cyclicInitialization` survives canonical lookup: classification checks the original binding before reading the canonical leaf. The new incoming-cycle fixture also requires the stable leaf to remain exported while the cyclic consumer stays unresolved (`packages/indexer/src/commonjs.ts:820`, `packages/indexer/src/commonjs.test.ts:788`).
- ✅ All consumer mutation/escape collection finishes before group rejection is unioned and exported IDs are exposed. Known-property rejection remains separate from whole-module rejection, and the empty-string fix uses `!== undefined` (`packages/indexer/src/commonjs.ts:765`, `packages/indexer/src/commonjs.ts:803`).
- ✅ Callable module identity remains a Symbol distinct from the string `default`; the imported-root overlay guard rejects unsupported direct/bound/property roots without introducing broader value flow (`packages/indexer/src/commonjs.ts:19`, `packages/indexer/src/commonjs.ts:715`, `packages/indexer/src/commonjs.test.ts:788`).
- ✅ The new tests exercise actual captured AST/indexer behavior, exact declaration IDs, exposure flags, physical imports, mutation propagation, source-order reversal, depth/cycle controls and captured package boundaries. They do not execute fixture modules (`packages/indexer/src/commonjs.test.ts:6`, `packages/indexer/src/commonjs.test.ts:38`, `packages/indexer/src/commonjs.test.ts:788`, `packages/indexer/src/index.test.ts:819`).
- ✅ The production change adds a bounded identity phase within the existing analyzer and introduces no new large file or duplicate registry implementation. The substantial test growth corresponds to distinct safety and identity cases (`packages/indexer/src/commonjs.ts:712`, `packages/indexer/src/commonjs.ts:803`, `packages/indexer/src/commonjs.test.ts:788`).

### Issues

#### Critical (Must Fix)

- None identified in this task-scoped review.

#### Important (Should Fix)

- **I1 — Detached local `exports` incorrectly acquires the forwarded leaf identity.** `packages/indexer/src/commonjs.ts:697` constructs the same module reference for both local `exports` and `module.exports`; the new canonical lookup at `packages/indexer/src/commonjs.ts:844` then resolves both against the forwarded leaf. With `module.exports = require('./leaf.cjs'); function read() { exports.help(); module.exports.help(); }`, the former `exports` binding still denotes the original object. The permitted pure-AST probe below returned the leaf function ID for both calls. This is a deterministic namespace-identity error, independent of loader timing. Before this change the forwarder had no leaf map to produce that affirmative call. Distinguish detached local `exports` references during guarded classification, or conservatively reject the uncertain reference/source, and add a regression requiring `exports.help()` to stay unknown while the supported `module.exports.help()` and external consumer retain their correct leaf identity. Do not broaden alias/value-flow support to fix it.

#### Minor (Nice to Have)

- None identified in the changed task. The retained final affected/build/typecheck/lint logs contain no warnings or diagnostics (`.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/affected.log:1`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/build.log:1`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/typecheck.log:1`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/lint.log:1`).

### Checks and Evidence

- ✅ Read the supplied 1,010-line review package once in three bounded passes. Its analyzer hunks cut off the enclosing function; inspected the omitted root-write, require/SCC, reference and classification context to evaluate namespace/cycle identity. Inspected the omitted existing test helper solely to verify that the historical-test migration asserts the actual leaf ID (`packages/indexer/src/commonjs.ts:126`, `packages/indexer/src/commonjs.ts:326`, `packages/indexer/src/commonjs.ts:480`, `packages/indexer/src/commonjs.ts:684`, `packages/indexer/src/commonjs.test.ts:38`). No unrelated codebase inspection, git command, helper agent or duplicate review occurred.
- ✅ Read retained corrected RED output: the 16 failures include unresolved actual-leaf calls and the real SourceIndexer leaf's `exported: false`, with 25 controls passing (`.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/red-corrected.log:25`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/red-corrected.log:226`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/red-corrected.log:250`).
- ✅ Read final command receipts and raw logs: affected tests **397/397 across 8 files**, core/indexer builds and typechecks, and root lint all exited zero. These passing checks were not rerun (`.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/checks.json:1`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/affected.log:5`).
- ✅ Read the baseline script and same-byte comparison receipt: the script invokes the actual SourceIndexer on retained fixture bytes; the receipt records equal v3 content hashes, changed snapshot IDs, the same actual leaf ID, and unchanged declaration locations/physical imports. This is source-only evidence; this review did not recreate old execution or rerun the comparison (`.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/baseline.ts:4`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/samebytes-comparison.json:1`).
- ✅ Read final preservation/commit receipts: 203 prior artifacts reported unchanged, all five final file hashes recorded, and candidate commit `d0cab481dbc64756c04c2a16a8b9ac661cdbc776` reported to match verified bytes. No source, index or HEAD mutation was performed by this review (`.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/verification.json:1`, `.superpowers/sdd/2026-10-03-static-forwarding/scratch/task-1/commit.json:1`).
- ❌ One focused pure captured-AST probe, triggered by the detached-`exports` doubt, confirmed I1. Command executed from `/workspace/AtlasMode`, exit 0; only analyzer code executed. Exact command and fixture:

```bash
TSX_DISABLE_CACHE=1 node --import tsx --input-type=module <<'JS'
import { Graph } from './packages/indexer/src/graph.ts';
import { indexTypeScript } from './packages/indexer/src/typescript.ts';
const graph = new Graph('review-local-exports');
const files = {
  'barrel.cjs': "module.exports = require('./leaf.cjs'); function read() { exports.help(); module.exports.help(); }",
  'leaf.cjs': "function help() {} exports.help = help;",
  'entry.cjs': "const mod = require('./barrel.cjs'); function entry() { mod.help(); }",
};
indexTypeScript(Object.entries(files).map(([path, text]) => ({path, bytes: Buffer.from(text)})), graph);
console.log(JSON.stringify(graph.relations.filter(r => r.type === 'calls').map(r => ({text:r.evidence.text,file:r.evidence.filePath,resolution:r.resolution,target:r.targetId,reason:r.reason})), null, 2));
JS
```

- ❌ Exact probe result; the `exports.help()` record is the false affirmative:

```json
[
  {
    "text": "require('./leaf.cjs')",
    "file": "barrel.cjs",
    "resolution": "unresolved",
    "target": null,
    "reason": "CommonJS loader is not an indexed implementation"
  },
  {
    "text": "exports.help()",
    "file": "barrel.cjs",
    "resolution": "resolved",
    "target": "function:d5f552addf3088751547b32d8f501382"
  },
  {
    "text": "module.exports.help()",
    "file": "barrel.cjs",
    "resolution": "resolved",
    "target": "function:d5f552addf3088751547b32d8f501382"
  },
  {
    "text": "require('./barrel.cjs')",
    "file": "entry.cjs",
    "resolution": "unresolved",
    "target": null,
    "reason": "CommonJS loader is not an indexed implementation"
  },
  {
    "text": "mod.help()",
    "file": "entry.cjs",
    "resolution": "resolved",
    "target": "function:d5f552addf3088751547b32d8f501382"
  }
]
```

### Declined Behavior and Coverage Costs

- ⚠️ Conservative shared invalidation is retained: a captured escape or unknown write can suppress otherwise safe aliases and leaf entries; the cost is reduced navigation/entry coverage (`packages/indexer/src/commonjs.ts:803`, `docs/superpowers/contracts.md:347`).
- ⚠️ More than 16 forwarding edges are rejected: long valid runtime chains remain unknown, and a rejected upstream forwarder's ordinary escape can also invalidate a shorter chain and its leaf (`packages/indexer/src/commonjs.ts:733`, `docs/superpowers/contracts.md:347`).
- ⚠️ Self/directed forwarding cycles remain unresolved: no cyclic alias identity is promised (`packages/indexer/src/commonjs.ts:732`, `docs/superpowers/contracts.md:337`).
- ⚠️ Ordinary require-SCC uncertainty remains unresolved: even potentially safe initialization order cannot recover a cyclic forwarding binding (`packages/indexer/src/commonjs.ts:737`, `docs/superpowers/contracts.md:337`).
- ⚠️ Loader timing is not analyzed: stable captured declarations do not prove initialization availability at every runtime call (`docs/superpowers/contracts.md:365`). This limitation does not excuse I1's statically distinct local object.
- ⚠️ General value flow is declined: namespace-variable forwarding and intermediate aliases remain unknown, losing common barrel patterns (`docs/superpowers/contracts.md:352`).
- ⚠️ Conditional forwarding is declined: branch-dependent exports remain unknown (`docs/superpowers/contracts.md:352`).
- ⚠️ Repeated/root-replacement forwarding is declined: even repeated identical assignments receive no proof (`docs/superpowers/contracts.md:352`).
- ⚠️ Chained `exports = module.exports = require(...)` forwarding is declined: synchronized alias assignments remain outside the supported subset (`docs/superpowers/contracts.md:352`).
- ⚠️ Property forwarding is declined: forwarding one imported member does not gain module identity (`docs/superpowers/contracts.md:352`).
- ⚠️ External/nonrelative/configured-alias forwarding is declined: packages and configured module aliases cannot establish this forwarding identity (`packages/indexer/src/commonjs.ts:740`, `docs/superpowers/contracts.md:352`).
- ⚠️ Dynamic forwarding is declined: nonliteral or ambiguous requires retain unknown facts (`packages/indexer/src/commonjs.ts:496`, `docs/superpowers/contracts.md:333`).
- ⚠️ Unsupported imported-root overlays are rejected: local added exports may be hidden rather than attributed through unproved mutable identity (`packages/indexer/src/commonjs.ts:715`, `docs/superpowers/contracts.md:346`).
- ⚠️ Unverified ESM re-export chains remain declined: direct guarded CJS imports do not establish transitive ESM barrel identity (`docs/superpowers/contracts.md:353`).
- ⚠️ Existing capture/root/ignore/symlink/package/configuration limits remain authoritative: excluded, opaque or uncaptured leaves cannot become resolved simply because a forwarder names them (`packages/indexer/src/index.test.ts:819`, `.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:103`).
- ⚠️ Runtime/build compatibility is not established: a resolved static relation is not evidence that a target application loads or builds (`docs/superpowers/contracts.md:369`).
- ⚠️ Full root tests are unrun for Task1: cross-package regression acceptance remains assigned to Task2 (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Seven-workspace builds/typechecks are unrun for Task1: this gate covers only the affected core/indexer build boundary (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ HTTP transport proof is deferred: source relations have not yet been accepted through the public HTTP workflow (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Official SDK/stdio proof is deferred: protocol parity, stderr cleanliness and process closure remain unproved for the new fixture (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ SQLite reopen/plan/route/approval lifecycle proof is deferred: source snapshots cannot establish persisted history or stale-state behavior (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:75`, `.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Browser/source/copy behavior is deferred: Chinese/English source presentation and location copying have no new browser acceptance here (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Host checks are deferred: this task supplies no new host-access or console/page-error evidence (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Strict full pinned Express acceptance is deferred: original entry FAIL and generic browse PASS do not prove the new required entry criterion (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Vite validation is not rerun: only its historical evidence remains applicable (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Flask validation is not rerun: only its historical evidence remains applicable (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Fresh installs are unrun: existing dependency availability is not clean-install proof (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Native Windows execution is unrun: platform-specific paths and process behavior remain unverified (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Native macOS execution is unrun: platform-specific filesystem/process behavior remains unverified (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Actual Codex client execution is unrun: client interoperability is not established by these indexer tests (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Actual Claude client execution is unrun: client interoperability is not established by these indexer tests (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Remote CI is unrun: local checks do not prove the remote runner configuration (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Fresh environment restore is unrun: reproducible restored-toolchain readiness is not demonstrated (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Publication is unperformed: no deployed or published artifact is accepted by this task (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Historical shutdown causal gap **Important WR-I2** remains unresolved in the prior closed archive: this task provides no new causal diagnosis or lifecycle retry and must not be credited with fixing it (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).
- ⚠️ Historical host warning **Minor WR-M1** remains in the prior closed archive: pristine Task1 logs do not erase that separate warning (`.superpowers/sdd/2026-10-03-static-forwarding/task-1-report.md:105`).

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** The bounded chain/group design and retained cycle/physical-import guards are soundly structured, but canonicalization currently creates a demonstrated false leaf binding for a detached local `exports` reference. Repair I1 and add the focused identity regression before accepting Task1; the deferred public/lifecycle/target gates remain separate obligations.
