### Task 2: Per-source checker resolution

**Files:**
- Create: `packages/indexer/src/configResolution.ts`, `packages/indexer/src/configResolution.test.ts`
- Modify: `packages/indexer/src/typescript.ts`, `packages/indexer/src/index.ts`
- Test: `packages/indexer/src/index.test.ts`
- Document: `docs/superpowers/contracts.md`

**Interfaces:**
- Consumes: scan's SourceFile[] source/configuration captures from Task1; ts-morph27.0.2 `ResolutionHostFactory`/`ts.ModuleResolutionHost` and existing graph declarations.
- Produces: `createConfigurationResolver(sources: readonly SourceFile[], configurations: readonly SourceFile[], captureDiagnostics: readonly CodeSnapshot["diagnostics"][number][] = []): {resolutionHost: ResolutionHostFactory; diagnostics: CodeSnapshot["diagnostics"]; configuredAlias(sourcePath:string,specifier:string): boolean}`.
- indexTypeScript accepts configuration captures as its third parameter and optional captureDiagnostics as its fourth; SourceIndexer supplies scanner diagnostics. Honor opaque rejected nearest config scopes without ancestor fallback or source availability pollution. These are internal arguments, not public port/schema changes. All compiler hosts use the virtual captured filesystem; parser readDirectory filters captured sources, never disk.

- [ ] **Step 1: Write RED for real alias calls.** JSONC inherited baseUrl/paths resolves `entry -> helper` with the expected target function/path/line; two nested tsconfig.json projects bind the same `@lib/*` to different helpers. Also cover default, namespace and re-export chains with declaration identity assertions. Run only configResolution/index tests and record RED before implementation.
- [ ] **Step 2: Pin ownership and failure cases.** Explicit files/include/exclude and allowJs, inherited paths declaration location, arrays of extends, invalid nearest configuration under a valid parent, ignored/symlinked/unreadable nearest config adjacent to included source, references-only root, absent tsconfig.json with tsconfig.app.json, alias target outside/ignored/symlinked/missing. Validate selected extends chains independently: a level17 target or cycle member also captured through another seed still rejects the owning chain, with no partial options or ancestor fallback. Assert missing configured alias imports AND calls are unresolved; unrelated bare package remains external, no cross-project cache target leakage. Dynamic imports/requires remain outside this ticket.
- [ ] **Step 3: Implement config parser and resolution host.** Use TypeScript JSONC/config APIs with the captured host, nearest-container selection and parsed-fileNames ownership. Apply supported resolution options per containing source and segregate caches. Only return captured source resolutions; expose parser/boundary diagnostics. Feed the host into the existing ts-morph Project, keeping declaration extraction unchanged.
- [ ] **Step 4: Integrate classification and verify.** Propagate configured-but-unavailable alias binding as unknown instead of an external function; retain evidence and configuration diagnostic. Run all indexer tests, core validation tests and core/indexer build/typecheck/root lint. Confirm Python, stable IDs, namespace/re-export and source escape regressions pass; avoid an unchanged public-target benchmark.
- [ ] **Step 5: Document supported semantics and commit.** Record exact ownership/no-reference/workspace limits and evidence classifications. Commit `feat: resolve captured tsconfig aliases by source scope`; write task report and await independent review.

