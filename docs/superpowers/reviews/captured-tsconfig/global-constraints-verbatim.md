# Verbatim Global Constraints

- Start only after the local-planning MVP's T08 and whole-branch review gates.
- Source/configuration parsing uses captured bytes only; never execute target code or read additional compiler files from disk.
- Preserve default exclusions, nested .gitignore, refusal of source/config symlinks, Windows/macOS/Linux path behavior, Python parsing and stable symbol IDs.
- Configuration seeds are `tsconfig*.json`; relative `.json` extends only. Single-file limit262144 bytes, total4194304 bytes,512 files, depth16; no node_modules/package extends or network.
- Nearest `tsconfig.json` owns only files in its parsed fileNames; no ancestor fallback after nearest exclusion/invalid config, no guessed tsconfig.app ownership, no references expansion.
- Nearest configuration selection includes opaque rejected seeds identified by scan diagnostics with `CONFIGURATION_UNAVAILABLE:` and normalized filePath. Independently validate each selected extends chain (seed1/depth16; reject17), even if another seed captured its files; never partially apply a rejected chain.
- `coverage.configurationFiles?: string[]` is additive; metadata is never `coverage.files` or CodeNode. contentHash becomes versioned source+configuration input hash; historical snapshots remain immutable.
- Configured but unavailable alias targets are unresolved, unconfigured bare imports external; only checker declaration identity yields resolved calls.
- UI defaults Chinese with English support; preserve authored text/technical identifiers. Keep core/indexer/storage/service/server/web/MCP boundaries.
- Sequential implementers and fresh independent reviewers; local commits only, no remote push/publication or destructive cleanup.

