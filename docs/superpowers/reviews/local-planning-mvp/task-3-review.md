### Spec Compliance

- ❌ Issues found: verification suppresses sufficient positive structural evidence whenever any file has a diagnostic; an approved move of a newly planned function can be falsely satisfied by a copy; rejected Promise-returning SQLite transactions can still write after rollback. See Important findings below.
- ✅ Required production files, migration, public service entry point, all contracted WorkspaceService methods, packaging declarations, actual-adapter tests, and the authorized indexer snapshot-identity change are present. The implementation keeps application dependencies behind core ports (`packages/service/src/workspace.ts:1`, `packages/storage/src/sqlite.ts:1`, `packages/indexer/src/index.ts:46`).
- ⚠️ Cannot verify from this diff: native Windows/macOS execution and subsequent HTTP/UI/MCP behavior. They are explicitly outside this task; no such completion claim is accepted. Controller-owned external-target documentation is authorized and is not treated as scope expansion.

### Strengths

- `packages/service/src/planning.ts:26` and `packages/service/src/planning.ts:30`: SHA-256 is computed over the core semantic representation; approved Plan copies are preserved separately, and latest-history selection checks revision, semantic hash, and both baseline fields. Draft edits cannot write approval fields.
- `packages/service/src/workspace.ts:40` and `packages/service/src/workspace.test.ts:63`: service assembly uses injected ports; the approval race test exercises an edit while actual refresh is pending and verifies no approval is produced. Per-project queue tests also cover independent projects and recovery from index failure.
- `packages/service/src/planning.ts:164` and `tests/integration/workspace-lifecycle.test.ts:1`: approval writes run in a single synchronous storage transaction; the actual SQLite integration tests inject approval-write failure and verify history and approval roll back together. Persistence, isolation, source containment, and history selection are exercised with real adapters.
- `packages/indexer/src/index.ts:46`: snapshot identity includes analysis facts while contentHash remains byte-only. Existing stored snapshots are preserved, and the capability-change integration case exercises the original unavailable-Python baseline remaining intact.

### Issues

#### Critical (Must Fix)

- None found.

#### Important (Should Fix)

1. `packages/service/src/verification.ts:40` — A diagnostic anywhere makes every symbol binding uncertain, before relation evidence is inspected. A focused actual SourceIndexer/SQLite/WorkspaceService probe used a valid `good.ts` containing `caller() { target(); }` and an unrelated syntactically invalid `broken.ts`. The snapshot contained the exact resolved `caller → target` relation and `good.ts:2 target()` evidence, but verification returned `unknown` with empty evidence. This violates the structural-verification requirement when information is sufficient and makes all structural operations unknown for repositories containing even one excluded symlink or unrelated invalid fixture. Distinguish ambiguous bindings and relevant incomplete analysis from unrelated diagnostics; allow an unambiguous, positively evidenced relation/function to satisfy the corresponding structural operation. Preserve unknown for absence checks whose relevant analysis is incomplete. Add the isolated unrelated-diagnostic regression.

2. `packages/service/src/verification.ts:40` — Temporary-function binding uses the move destination, but the move's copy check looks up its original only in `baseline.nodes`. Core validation permits moving an `add_function` tempId, which has no baseline node. A focused actual-adapter probe approved `[add_function(new, newFn, original.ts), move_function(new, moved.ts)]`, then created `newFn` in both `original.ts` and `moved.ts`; verification reported both operations satisfied. The retained original therefore escapes the very copy-versus-move guard applied to existing functions. Derive a temporary symbol's original identity/path from its add operation and check for a retained source definition before declaring its move satisfied; cover both a true move and this copy case.

3. `packages/storage/src/sqlite.ts:65` — Rejecting native AsyncFunctions before invocation does not cover an ordinary callback that returns a Promise. The post-call thenable check throws and rolls back synchronous writes, but the callback's scheduled continuation still has access to this storage. Focused probe: `db.transaction(() => Promise.resolve().then(() => db.put('settings', 'late', 'persisted after rejection')))` throws “SQLite transactions must be synchronous”; after one microtask `db.get('settings', 'late')` nevertheless returns the value. Thus a transaction reported as rejected can make an untransactional write, contrary to the asynchronous-callback containment the implementation attempts and reports. Ensure writes from a rejected asynchronous transaction context cannot execute later (for example, track the transaction context and reject its later storage operations), and include a Promise-returning non-async callback regression alongside the existing native-async tests.

#### Minor (Nice to Have)

- None additional; the blocking cases above are specific behavior defects rather than a request to broaden the suite.

### Focused Checks and Evidence

- Read the supplied review package once in three contiguous chunks. No repeat git diff, whole-repository traversal, source/index/HEAD/branch edits, or test-suite rerun.
- Named risk: `getPlan.valid` computes validity via delegated core issues rather than explicitly AND-ing `!stale`. Checked only `packages/core/src/validation.ts:200`: both snapshot ID and contentHash mismatches generate an error, so this does invalidate stale approval correctly.
- Named risk: route creation delegates endpoint and call-chain evidence enforcement. Checked only `packages/core/src/validation.ts:404`: project/snapshot ownership, node membership, relation-step association, resolved calls, preceding-step endpoints, and relation-schema evidence are enforced.
- Named risk: path and temporary move semantics delegated to core could invalidate the proposed cases. Checked `packages/core/src/validation.ts:24`, `packages/core/src/validation.ts:103`, and `packages/core/src/validation.ts:238`: normalized paths are enforced and additions enter the node map before move validation; the temporary move is an accepted public operation combination, confirmed by actual approval in the focused probe.
- Ran one inline Node ESM probe against the reported built public SourceIndexer/SqliteStorage/WorkspaceService artifacts, using a fresh temporary source directory and in-memory SQLite, with cleanup in finally. It confirmed exactly the three previously named, untested doubts above. Output: unrelated diagnostic ⇒ `unknown` despite a resolved evidenced call; temporary copy ⇒ `[satisfied, satisfied]`; Promise-returning callback ⇒ synchronous rejection followed by persisted `late` value. No existing suite was rerun.
- Implementer reports 112 passing tests, implemented-package builds/typechecks/lint, packaging smoke, and formatting checks. The report's failed SQL formatting invocation was a stated formatter limitation; its final application/test validation reports no warnings. These reported runs are acknowledged, not independently rerun or upgraded to cross-platform evidence.

### Assessment

**Task quality:** Needs fixes

**Reasoning:** The port boundaries, persistence lifecycle, immutable analysis identity, revision protection, and approval history are well structured and substantially covered with real adapters. The three focused counterexamples require targeted fixes before structural verification and rejected asynchronous transactions can be trusted.
