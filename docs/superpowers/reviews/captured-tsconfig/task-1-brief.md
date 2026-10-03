### Task 1: Captured configuration inputs and freshness

**Files:**
- Create: `packages/indexer/src/configCapture.ts`, `packages/indexer/src/configCapture.test.ts`
- Modify: `packages/indexer/src/scan.ts`, `packages/indexer/src/index.ts`, `packages/core/src/model.ts`, `packages/core/src/validation.ts`
- Test: `packages/indexer/src/index.test.ts`, `packages/core/src/validation.test.ts`
- Document: `docs/superpowers/contracts.md`, `docs/superpowers/state.md`

**Interfaces:**
- Consumes: existing SourceFile `{path:string;bytes:Buffer}` and snapshot diagnostics; allowed candidate paths must already satisfy exclusions/ignore/symlink checks.
- Produces: `captureConfigurations(root: string, allowedPaths: readonly string[]): Promise<{files: SourceFile[]; diagnostics: CodeSnapshot["diagnostics"]}>`.
- scan returns additional `configurations: SourceFile[]`; SourceIndexer adds their paths to optional `coverage.configurationFiles`. Public IndexerPort signature is unchanged.
- contentHash uses deterministic type/path/length/byte framing with a version prefix for source and configuration; snapshot ID retains its existing fact fingerprint.

- [ ] **Step 1: Write failing capture and schema tests.** A JSONC seed extends `../shared.json`; capture both once, but only source `a.ts` appears in source coverage/nodes. Invalid JSONC bytes remain input. Assert old snapshotSchema.parse without configurationFiles succeeds and the new field validates repository-relative paths.
- [ ] **Step 2: Add boundary cases and run RED.** Exact limits from Global Constraints;512 vs513 files,16 vs17 levels, cycle, missing/package extends, outside/ignored/symlinked sentinel, oversized opened file, Windows backslashes in relative extends. Assert deterministic diagnostics and no sentinel content/side effects. Run `npx vitest run packages/indexer/src/configCapture.test.ts packages/core/src/validation.test.ts` and record the actual pre-implementation failures.
- [ ] **Step 3: Implement capture and composition.** Parse extends with installed TypeScript JSONC support, strictly confined to allowed paths. Reuse bytes and handle checks; do not turn config JSON into source. Add the optional type/schema field and input hashing to scan/index without a database migration.
- [ ] **Step 4: Verify input identity.** In index.test.ts assert changing only tsconfig bytes changes contentHash/snapshot ID, retains function IDs and the old snapshot object, and changing config whitespace conservatively invalidates input. No config preserves deterministic repeated indexing. Run affected core/indexer tests and their build/typecheck plus root lint, recording counts and status.
- [ ] **Step 5: Update the contract and commit.** Document expanded hash meaning, rejected-input diagnostics and optional field compatibility. Stage only this task's files and commit `feat: capture bounded tsconfig inputs in snapshots`; write the exact task report and await controller review.

