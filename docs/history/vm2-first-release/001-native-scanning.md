> Historical report from main b87644f. Superseded by the active work implementation and docs/superpowers/state.md. Its API, counts and runtime pins are not current.

# 001: Bounded native directory scanning on Node 24

The README originally selected fast-glob for scanning. Installing fast-glob 3.3.3 introduced three high-severity npm audit findings through micromatch/braces (GHSA-vfj7-8cjw-p6xm), with no available patched release reported by npm.

Use Node 24's stable filesystem directory iteration instead, retaining `ignore` for repository ignore rules. This removes that dependency chain without changing the data model or persistence design. The scanner accepts a fixed server-configured root rather than caller-provided glob patterns, excludes dependency/generated/cache directories, does not traverse symbolic links, checks real-path containment, and enforces 100,000 visited directory entries, 20,000 source files, and 40 MiB of source input. Exceeding a budget fails explicitly rather than presenting partial coverage as complete.

Tests retain cross-file symbols, source-file additions/deletions, blank-line identity, ignored/generated files, and out-of-root symlink checks. Build and audit validation must confirm the replacement before first-release acceptance.
