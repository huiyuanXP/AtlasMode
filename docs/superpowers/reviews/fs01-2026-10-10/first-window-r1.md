# FS-01 first-window targeted source repair R1

2026-10-10. Author `/root/ag05_impl`, GPT-6.1-sol high. **Implemented and author-verified; independent limited re-review pending. Full FS-01 remains PARTIAL.** This repair changes only FunctionForm, PlanEditor, and their owned browser fixture. PlanningPanel's identity key and all second-window product files remain unchanged.

## Original review and frozen evidence

Initial source review remains verbatim at `first-window-code-review.md`, REQUEST_CHANGES C0/I2/M1, SHA-256 `39d4ac45d36d716ae08b5ce25199f2d0ee4021448a662027da6cf9958cb6a5bd`.

The original 19-file snapshot `/tmp/atlas-fs01-first-window-snapshot`, manifest `/tmp/atlas-fs01-first-window.sha256` (`ac862e8aac6af8d6ddcf3d73096a759d7bf0b74e10275728d3f92859709f27ed`), and original patch `/tmp/atlas-fs01-first-window.patch` (`b7a831caed7b4a1a451d00b3c00d699557a387a7520c48c55478acb155587a03`) were not overwritten. All 19 original manifest checks returned OK after R1. Original 38 unit/integration passes and four initial form cases remain historical first-window evidence, not newly rerun R1 results.

## Targeted repair

- I1: each function/add form records a local edit generation on submit. A matching plan ACK consumes that submission and clears its draft only if no later edit/discard occurred. A newer draft retains its original basis and becomes stale against the accepted revision, preventing stale save and confirmation. PlanEditor matches pending ACKs against project, plan, baseline snapshot ID/hash, exactly next revision, operations, title, and description. A response failure at the old revision deliberately retains a recovery claim; an accepted advance or changed context retires the claim regardless of whether it matched. Identity remount/reload discards the local claim. No timeouts or automatic rebase are used.
- I2: add receives the same revision/context basis, an independent add-dirty state aggregated with selected-function and metadata dirty, and its own pending ACK. Reloading one function form cannot clear another form's dirty guard. Dirty add blocks confirmation and causes the actual existing agent-sync controller to retain the current editing revision until explicit discard. An unchanged recovered add ACK resets the same form without relying on a selected-node remount; a newer unsent add draft is retained/stale.
- M1: title/description submission records its own generation and exact pending plan tuple. Matching unchanged ACK updates metadataBasis; a later title/description edit remains visible and stale. Existing unrelated remote-title conflict handling remains intact.

## RED and GREEN

All fixtures use private Vite/cache/tmp storage, source PlanningPanel/PlanEditor/FunctionForm, and Chromium. The controller cases also import the actual source createWorkspace and HttpApi. Their injected fetch fixture controls a persisted plan response and simulates commit-before-response-loss; it is not an actual server/database/network test or a compiled full-application gate. This scope is sufficient to exercise the real frontend busy/failure/Validate/acceptPlan/agentSync call path rather than typing into a disabled fieldset.

Meaningful frozen-source RED: `/tmp/atlas-fs01-r1-controller-red2.log` and `/tmp/atlas-fs01-r1-controller-red2-results` show four failures. I1 first asserts busy=true and disabled input, then releases the committed-but-lost response, edits B at r1, uses actual Validate to retrieve A/r2, and observes B incorrectly replaced by A. I2 shows add input reporting dirty=false (both component and controller cases). M1 shows successful title ACK still reporting dirty=true.

Earlier `/tmp/atlas-fs01-r1-form-red.log` includes the separate busy=false component I1 contract failure plus an incorrect translated summary selector timeout. `/tmp/atlas-fs01-r1-controller-red.log` was stopped after a private Vite dependency-resolution failure; it is harness evidence only. The extra add-recovery test initially used another wrong summary label (`/tmp/atlas-fs01-r1-add-recovery.log`); its prior reset assertions passed, but that final selector failure is not a product RED. Those logs are retained and not counted as meaningful failures.

Final source-browser command:

```sh
npx playwright test tests/e2e/ownership-form.spec.ts --output=/tmp/atlas-fs01-r1-final-form-results --reporter=line
```

`/tmp/atlas-fs01-r1-final-form.log`: **14/14 PASS, 14.4s**. This preserves the original four cases and covers old-generation ACK, add revision staleness/approval, busy/response-loss/Validate recovery, actual agent-sync refusal/adoption after explicit reload, successful metadata ACK, changed-title recovery, successful add, changed-add recovery, independent dirty aggregation, and unchanged-add recovery without selection remount. Earlier 13/13 and the added 1/1 receipts remain separate.

`/tmp/atlas-fs01-r1-final-lint.log`: scoped ESLint exit 0 for the three R1 files. `/tmp/atlas-fs01-r1-web-typecheck.log`: web noEmit exit 0. No root tests/build/dist updates, Git index/commit/push, real target source move/write, real user DB, model requests, or credentials were involved.

## Exact R1 freeze

Three complete files: `/tmp/atlas-fs01-r1-snapshot`; original first-window comparison bytes: `/tmp/atlas-fs01-r1-before`.

`/tmp/atlas-fs01-r1.sha256`: SHA-256 `7fb13027a2253894d97e8a2aac3565318121af5b6bb0ca60ffd7c300d65aa5bd`.

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/features/planning/FunctionForm.tsx` | `f76830dad5f825f6ca76f50906e32a63cdd56a0a9027866b0c86bd88c29a9e5d` |
| `apps/web/src/features/planning/PlanEditor.tsx` | `3ff6c7fdeb66f4d815a5ef4d914192a497922a04463769f89e8196c8dfa00a44` |
| `tests/e2e/ownership-form.spec.ts` | `c730eeab1decba3f1a1a598c0b0ad41297c2de596ae5c8392a5dc65dc1abb9f0` |

Own three-file patch relative to the first freeze: `/tmp/atlas-fs01-r1.patch`, 31,100 bytes, SHA-256 `02b6471b519f68f1160c1075981970e9f9aef68cb1e989e46cf6e45bd1dbf59a`. No shared/other-agent changes are included.

Read-only supporting controller/API/scope/PlanningPanel complete bytes are retained separately at `/tmp/atlas-fs01-r1-support` with `/tmp/atlas-fs01-r1-support.sha256` (`d8a5f585076d29fdbb70790267946684258e325b49b95c80d681098397b4ed13`). They establish the actual fixture execution dependencies and are not R1 product changes.

## Remaining coordination

Request original high reviewer limited source re-review against these exact bytes. Second-window Canvas/projection/workspace/Navigation/i18n wiring is paused until main coordination. Whole-application native gesture, source physical-path/provenance and generation behavior, required snapshot wire use in every ownership/advanced call, and compiled browser gates remain pending. POL's upcoming mandatory StructureFilePort constructor requires a separately recorded fixture-only adjustment after its actual interface lands; original first freeze is preserved and no missing-interface import/property was fabricated. This author verification does not self-approve the source repair or claim FS-01 complete.
