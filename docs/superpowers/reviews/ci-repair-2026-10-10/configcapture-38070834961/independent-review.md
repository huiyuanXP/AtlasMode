# Configuration capture fixture independent review and isolated verification

Main controller independent review: APPROVE, C0 / I0 / M0 for the single test fixture change. Reviewed the exact frozen diff, before/after bytes, failure-worker negative control and native failure log; this reviewer did not author the fixture change.

Base c9b9206cb83f8bc440aa386140247b08a0eaa734, sole source modification packages/indexer/src/configCapture.test.ts SHA256 d7a97f244028f7529ca3d87c0cb3944b3bdc53a94d30070572862d2fb2fab7ad. No production code, native skips, timeout configuration or original 512/513 capture assertion changed.

The helper deduplicates directories and bounds setup writers to four, waits every owned worker before propagating its failure, and drains complete fixture promises before removing owned roots. Explicit count closures prepare real boundary files before the original five-second test body. The real filesystem/barrier regression proves peak four, all eight writes settled and root deletion only after settlement; the fail-fast negative control remains preserved.

Independent clean archive contains only committed base plus this frozen test. Fresh npm ci passed. Initial test invocation failed before running tests because core compiled package entry was absent; results.json and scoped-tests.log retain this setup failure. Building only committed @codemap/core supplied that entry. Then 26/26 tests, scoped ESLint, indexer noEmit and test-inclusive noEmit passed. No shared dist, user database, unrelated process or other authors source was used. Exact logs and own config are adjacent.

Original Windows CI 38070834961 failed the 512 case after 5088 ms and reported ENOTEMPTY cleanup; original logs lack separate setup/capture timings, so no claim is made that all 5088 ms was setup. Linux evidence is not a Windows rerun. Actual native Windows CI remains pending after this commit; no QA02 client, interactive Ctrl+C or AG03 Job guarantee follows from this fixture repair.
