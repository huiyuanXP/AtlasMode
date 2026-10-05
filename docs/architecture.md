# Implemented architecture

`@codemap/core` owns separate CodeSnapshot, Knowledge, PlanRevision and ViewState schemas, pure graph/plan validation, revision/approval transitions, identity candidates, verification data and ports. It has no filesystem, HTTP, React or SQLite dependency.

`@codemap/indexer` implements the injected read-only indexer port with bounded directory scanning and an in-memory TypeScript/ts-morph project. It resolves local aliases/re-exports and declared workspace public entries to included source. A callable type alone never proves a dynamic call target. Unresolved calls retain reasons and source evidence.

`@codemap/storage` implements SQLite persistence, checksum-verified migration 001, immutable snapshots, semantic revision history, audit records, optimistic writes, multi-record transactions and consistent backups. The active snapshot pointer is updated even when content returns to a previous snapshot.

`@codemap/service` orchestrates injected ports; it never imports indexer/storage implementations. Server assembles them. The API and MCP share the same state and approval rules. Knowledge and layouts survive index replacement; orphan references remain visible. Rename/move candidates require explicit human confirmation before knowledge rebinding, and confirmed mappings are persisted.

`@codemap/server` owns loopback HTTP, request schemas/error conversion, local UI confirmation flow, startup indexing and atomic knowledge/policy file mirrors. `@codemap/mcp` owns official SDK stdio transport and typed HTTP tool adapters; it has no approval tool or arbitrary HTTP tunnel. `@codemap/web` projects real facts, independent planning overlays, groups and notes into React Flow, with persisted layout and transient selection.

Approvals bind plan ID, revision, semantic hash and baseline. Semantic edits revoke approval; layout writes do not. Current working-tree/configuration fingerprints and directory constraints are checked before approved-version execution. Verification retains source evidence, unresolved conclusions and temporary-symbol bindings. Its `behaviorVerified` remains false: structural completion is not proof of functional correctness.

`.codemap/structure.json` supplies workspace import boundaries to ESLint. All cross-workspace imports use public package entries. Domain source ownership and group membership remain independent from React Flow parent IDs. Target source changes are performed by an external coding Agent after reading an effective human-approved version; this application is not a deterministic code generator or a system-level shell write sandbox.

Later work includes sequence/wrapper operations, richer per-project compiler-config adaptation, continuous/incremental indexing, auto layout and broader languages. Root-tsconfig/workspace mapping and unresolved diagnostics define the current static coverage; dynamic runtime dispatch is not guessed.
