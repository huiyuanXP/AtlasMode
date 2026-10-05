# Main into work integration — 2026-10-05 UTC

## Decision and scope

The human explicitly requested integrating main's VM2 results with the existing work branch, pushing work, and preferring work's technology stack and long-term plans. Merge inputs: work `69be14b`, main `b87644f`; common ancestor `944b48c`.

Both branches independently introduced incompatible product/schema/migration implementations. Conflict resolution retains work's reviewed application, package lock, pinned Node 24.19.0/npm 11.9.0, vendor skills, plans and constraints byte-for-byte. Main is preserved as a merge parent; its source is available in Git history. Main's GitHub issue bodies/manifest are retained under docs/issues, and superseded VM2 reports are explicitly archived under docs/history/vm2-first-release. No parallel legacy runtime is installed. Product facts, revision/hash/baseline approval rules, and the existing PARTIAL/Express limitations remain authoritative in work's state/coverage records.

## Independent review

Reviewer `/root/merge_review` inspected the pending merge independently and reported no Critical/Important defects. It verified unchanged tracked product/config/lock/vendor/tests, semantically unchanged existing directory policies, exact issue preservation, historical provenance labels, correct MERGE_HEAD, no conflicts, and no apparent credentials. One minor archived relative decision link was corrected; this review document was created as requested. The reviewer did not claim compatibility with main's deliberately excluded runtime contracts or independently execute runtime checks.

## Fresh local validation

On ssh-vm-2, restored work's exact Node 24.19.0 (official archive SHA256 checked) and npm 11.9.0. Initial native SQLite setup failed because make was missing; installed build-essential, then reran the frozen install successfully. No lockfile or product dependency changed.

- npm ci: passed (410 packages installed).
- Seven-workspace build and typecheck: passed.
- npm run lint: passed.
- npm test: 541 passed / 31 files, no failures.
- npm run smoke: passed production assets, TS/Python HTTP/official SDK browsing, no target execution, and persistence across restart.
- npm run test:e2e: 7 passed, including planning/approval/verification, guarded CommonJS/forwarding and configuration coverage in both languages. Desktop screenshot inspected.
- Vendor SHA256 check: passed. Git diff whitespace check: passed. Product/lock/vendor/workflow/README/AGENTS comparison against work input: unchanged.

Full local raw logs: `/home/agent/work/atlasmode/merge-validation/`; browser evidence: ignored `artifacts/e2e/`. These are current Linux checks; historical native Windows/macOS CI receipts remain historical. This merge has not rerun the full Express strict-entry gate or resolved its failure.

## Residual dependency notice

npm audit reports three inherited high-severity entries: braces, micromatch and fast-glob (no available fix reported). The established work lock is preserved per the human's stack preference; dependency remediation is separate planned work, not silently merged from main. No zero-vulnerability claim is made for this branch.

## Delivery

Commit as a two-parent merge and push only work without force. main remains untouched by this operation. No public deployment, target-repository execution, provider credential export, or global client configuration. The repository checkout remains on work for subsequent tasks.
