# CI Windows R1 mechanical integration independent review

2026-10-11 UTC. Reviewer /root/grp01_design, existing gpt-6.1-sol low, independent of /root/ci_windows_integrate. **APPROVE: specification PASS; quality C0 / I0 / M0 within the mechanical three-path window.** This is not Windows runtime approval or whole compiled acceptance.

## Exact inputs and provenance

Local freeze ci-windows-r1-integration/freeze and VM /tmp/atlas-ci-windows-r1-integration-20261011/freeze match the supplied digests:

- manifest.sha256: dcf5413c1e1661cdb1f531234df54b1218ef9c50f75d8d2fe8ce1380d8b3c673
- source.sha256: 429f258af4da6cfd8adae0e308de289640ddd62f821f6eb9b635a7f9961ae05d
- workflow.patch: 2beaeb899426d0c5fa144f462b8bff5e3127b7c9256152cb644b944fbc12285a
- author-report.md: a478c1d49c813d61074ced9edae5fbe530522faf0ab02335b13cdd2ab034bc9b

All 36 local manifest entries pass. All three remote source-manifest entries pass. I used byte comparisons against the original local I1 R1 freeze/source: both fixtures are identical, not a fresh concurrent lifecycle redesign. index.test.ts=e429a1c8a82789e4ab015cdb90226370eebc1d77ca907a32bd801378d49727eb; python-fixture.ts=5514f23f2f6b04c446eb22b483e39874d191b651ac7b44c1533a3c17462486d9. Original high independent rereview SHA befcf749657a6ad74b320f6a75e8f6445738753c3208f9a9ebf5cf6677554c1f closes original I1 with SOURCE REVIEW APPROVE and expressly retains Windows UNRUN. This review does not repeat that logic review.

## New workflow logic

Reconstructed exact before/after workflow unified diff equals workflow.patch. The only five added lines are native job-level env POL01_ACCEPTANCE_MODE=compiled, and browser job-level env POL01_PRODUCTION_GATE=1 plus POL01_ACCEPTANCE_MODE=compiled. Existing matrix, permissions, runtime pins, commands, ordering and artifact capture are retained. Both jobs clean npm ci and build before consumers. Native integration's actual fixture branch selects compiled when that env equals compiled. Browser spec skips exactly when gate is not 1; the new job env therefore enables its two cases rather than claiming skipped discovery as acceptance. No continue-on-error, timeout weakening or domain assertion removal was added.

## Executed evidence and limits

I passively checked machine results: Linux fixture55 JSON=55 total/55 pass/0 failed/0 pending/0 todo/success true; compiled-stdio3 JSON=3 total/3 pass/0 failed/0 pending/0 todo/success true. gate-results records the compiled env for both, clean seven-workspace build exit0, scoped lint and helper-only noEmit exit0. Original reused-dependency build exit2/TS2349 remains saved; its cause is not established by subsequent clean success. Final delta receipt records 312 captured entries, only index.test.ts differs, with authorized new helper/workflow; production Python remains unchanged.

No new native Windows/macOS execution or whole compiled suite/browser run occurred in this integration window. Parent prior gate-enabled 51 browser result is separate evidence; 49+two skips cannot be counted as 51. Actual published candidate remote CI must still run all enabled cases and native platforms before Windows repair or entire integration success is claimed.

No must-fix in the supplied mechanical three-path integration. I read records, compared bytes and inspected only necessary env consumers; no tests, services, source edits, Git/index changes or subagents. Only this independent report was written and copied to the designated VM freeze.
