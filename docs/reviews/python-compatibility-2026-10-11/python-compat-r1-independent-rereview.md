# Python compatibility I1 — independent narrow rereview

2026-10-11 UTC. Independent reviewer `/root/pol01_review`, continuing the explicitly selected gpt-6.1-sol / high. Scope: the sole I1 in the original whole-integration review and breakage introduced by its five-file repair. No tests/builds/services/source/Git mutations or subagents were used. Original unrelated integration boundaries are not re-reviewed here.

**Verdict: APPROVE — original I1 ADDRESSED. Critical 0 / Important 0 / Minor 0.**

**Specification compliance: PASS for this repair. Code quality: PASS for this repair.** Existing Python fact/temporary planning paths now use the same supported-source suffix rule as the ownership file/folder entry points. The fix preserves path validation and the existing form, operation, identity, CAS and approval logic rather than adding an alternate save path. The source change and retained actual compiled-browser evidence satisfy every closure requirement in the original I1.

This is approval of the frozen narrow repair, not a claim that the mechanically combined publication candidate has passed new full gates, remote CI, or Windows. The original `whole-publish-independent-review.md` remains an immutable **REQUEST_CHANGES** record, SHA `89ba0c8a78d6c6512bbfbb76c2a59b2291bac63f9ff4d22747671f82dab03a96`; this new report records its I1 closure.

## Frozen scope and independent byte verification

VM candidate: `/tmp/atlas-python-compat-r1-20261011/workspace`; evidence: its sibling `/evidence`. Local source: `python-compat-r1/candidate-tree`; retained evidence: `python-compat-r1/frozen`; author handoff: `python-compat-r1/author-report.md` SHA `4c9c88c23fee153e948089af6f01325e41ab35e4b3e93fe038ed4403978495d3`.

| Frozen input | SHA-256 |
| --- | --- |
| before.sha256, 312 paths | `1a7e353da7104e95fef793ba1838785b824647a57fb9bafb3df3e10ad93ae28e` |
| after.sha256, 312 paths | `f29252b6d0a948fffffb54c6e2ba26e2dcf12f298e55d9255f4b2889f0852830` |
| repair.patch | `36ebf4585e918d3fd1e52d5371efd5082254cf888a04d34e0161ecd0e5110af6` |
| changed.sha256, five paths | `0759faa73a95815493f713aa15bade9447ea8799ddad96c7a3a9f8c6cb076881` |
| freeze.json | `4d8150a472d4b264c98d35491bfc38e8d6285f782f6141627cbcc64f470eff2b` |

Entry verification at `2026-10-11T02:59:05.717102+00:00` found all **312 after paths matching**. Independently matched all 312 original before paths to the original whole-review source copies, compared before/after keys, and rebuilt the complete unified diff: it matched the frozen patch **byte for byte**. Exactly five paths changed, consisting of two product files and three tests:

- `apps/web/src/features/planning/function-target.ts`
- `apps/web/src/features/structure/ownership.ts`
- `apps/web/src/features/planning/function-target.test.ts`
- `apps/web/src/features/structure/ownership.test.ts`
- `tests/e2e/ownership.spec.ts`

Ending live-VM verification at `2026-10-11T03:00:04.252194+00:00` found **312 paths / zero mismatches**, unchanged after-manifest/repair-patch hashes, and the unchanged original independent report hash. The source checks establish that Form/operations/PlanEditor/workspace/client/routes/service CAS and approval code were not altered. In particular, unchanged `FunctionForm.tsx` is `f76830dad5f825f6ca76f50906e32a63cdd56a0a9027866b0c86bd88c29a9e5d`, `operations.ts` is `f4ad503d3043ac62107b5bafff1e0e034db954a4da4df26d1fcadc25f8e7d8fc`, and `packages/service/src/planning.ts` is `89fdba1f61a4ba2ba9917133f99974ea7fb42a89b20bfff69975a12cd5fbc86f`.

## I1 closure against the original requirements

| Required behavior | Source and concrete evidence | Result |
| --- | --- | --- |
| Preserve indexed Python metadata edits without fake movement or `.ts` rename | `function-target.ts:7–18` adds `py` to the existing suffix rule while still running `normalizeRepoPath`. Existing `editFunction` remains unchanged. New unit scenario `function-target.test.ts:137–155` expects only annotate at `src/main.py` and unchanged physical node. Actual compiled-browser `ownership.spec.ts:1573–1611` saves description at `src/original.py`, obtains r2 with exactly one annotate, and captures S0/r1 in the PUT. Final `python-indexed-receipt.json` contains that exact public response. | PASS |
| Same effective Python target is a no-op; coalescing and baseline return preserve unrelated operations | `retargetFunction:38–70` is behaviorally unchanged except the accepted suffix; new tests check same-array no-op, one selected move, unrelated move/annotation preservation, baseline return and physical parent identity. Actual browser lines 1643–1655 click Save at unchanged effective `dest/index.py` and assert no additional PUT and unchanged r3. | PASS |
| Python temporary addition remains editable with metadata/language/relations intact | New unit lines 183–238 cover metadata and a legacy temp move coalesced into the addition, retaining language, signature, description and relation. Actual browser lines 1787–1889 Add `new/planned.py` via compiled controls at r2; the public-API fixture explicitly seeds language/calls at r3, then real metadata Save reaches r4 and native folder Apply reaches r5. Complete operations retain temp ID/name/signature/description/`language:python` and the calls relation; only the addition's target path changes, with no move operation. | PASS |
| Complete `.py` file/folder targets, full path preview, no directory/traversal escape | `ownership.ts:6–9,29–57` imports the shared suffix and preserves the original canonical-path equality and single-filename checks. New tests cover nested/root Python paths and reject slash/backslash, drive/colon, control characters and trailing separators. Browser lines 1613–1642 drop onto actual `dest/index.py`; lines 1677–1712 reject `../escape.py` then preview/apply exact `dest/completed.py` with one coalesced move. | PASS |
| Keep captured snapshot/revision CAS, history, real identity, manual positions and source bytes | No product CAS/form/controller/history code changed. Recorded indexed PUTs carry the same baseline snapshot and consecutive expected revisions 1–6; Undo r4 restores metadata-only operations and Redo r5 restores the move (lines 1656–1676). Lines 1733–1741 assert the full physical function context and layout positions equal their captured values. Both final Python receipt before/after SHA maps are exactly equal, including all fixture source files and absence of newly created planned files. Setup's source assertion also checks the execution marker remains absent. | PASS |

The shared regex has only the `i` flag, so successive `.test` calls do not introduce stateful global/sticky matching. Previous TS/JS extensions remain present; canonicalization, empty/root/directory/trailing-separator checks and the ownership filename colon/control/path-separator checks are unchanged. The repair does not execute or relocate Python source or claim compatibility conversion between languages.

The advanced normalizer's pre-existing acceptance of some non-drive colon-containing relative strings was not broadened by this repair. The author removed a newly invented `https:main.py` rejection expectation from the advanced test before final GREEN; the original production normalizer was not changed, and the ownership single-filename colon rejection remains. This is not a weakened existing assertion or a new safety finding in this narrow window.

## Actual evidence and test-quality assessment

Read the actual raw logs, command receipts, final JSON results, both complete Python public-API receipts, and the new tests. Valid unit RED is in `build-red.log`: **5 failed / 53 passed**, all five failures at the existing path checks. The earlier `tests.log` import failure with zero tests is retained and is not counted as a behavioral RED. `browser-red.log` records two real compiled-product failures at disabled indexed Save and disabled planned Add, matching the original I1; the original metadata screenshot visibly shows `src/original.py → …` with disabled Save.

The first repaired browser run retains **1 passed / 1 failed**: the temporary test expected r3 after explicitly seeding an additional r3 API write and performing a further metadata save, so the observed r4 was correct. The final new-test literal was corrected to reflect the actual revision sequence; no old source/history/group assertion was removed, no timeout was raised, and no skip/retry or broad console-error suppression was added.

Final `final-checks.log` plus individual receipts record **11 files / 142 unit tests passed**, web noEmit typecheck exit 0 and changed-five-file lint exit 0. `green.log` and its receipt retain the private root production build exit 0 with ordinary Zod/bundle warnings. Final `browser-final-results.json` and `browser-final.log` record **25 passed / zero skipped, unexpected, or flaky**, one result attempt per test, 51.946s. This consists of **11 compiled production ownership tests, including the two new Python scenarios, plus 14 existing Vite form/controller component scenarios**; those 14 are not relabeled as production coverage.

The compiled tests use the existing production setup/HTTP interface and `pointerDrop` native mouse implementation (`ownership.spec.ts:85–104`: mouse down/move/up, no synthetic drag or DataTransfer creation). Python mode is an optional fixture parameter defaulting to false; existing TS setup behavior and assertions are preserved. The language/relation seed is explicitly a public-API fixture at lines 1813–1827, not a product UI claim or store injection; preservation is then exercised through actual compiled forms and native ownership controls. Source snapshots cover complete fixture file SHA maps, so byte preservation also detects an accidentally created target file rather than merely checking the original file.

Independently viewed retained RED metadata, final Python folder-preview and final temporary screenshots. They show the original blocked `.py` edit, the corrected full `dest/completed.py` preview with Apply enabled, and the final `dest/planned.py` temporary node with edited responsibility and calls relation. These are observations of the author's captured images; this reviewer did not launch a browser. Actual request/API assertions and SHA maps establish behavior beyond what the screenshots alone show.

For traceability, independently calculated these retained raw-log hashes:

| Raw log | SHA-256 |
| --- | --- |
| build-red.log | `60109089a1f590b051008307b455a944b75f6c2e3bf46bd9393bbe371b28b2ba` |
| browser-red.log | `a153b90dc3d40b34d526f7b310fa7448c06007804f07fc3b062d0175cb8f0849` |
| browser-green.log, retained intermediate failure | `3e14c338c9eaa3ce7da0a1c3aae1e97960cc01381dbbbb68e0584d83bbfe9b98` |
| browser-final.log | `297350dfa40bf6ba34da780f48f71b50fd4caf0d74026d07c1e73d5174cad589` |
| final-checks.log | `ffee73f523e15588a1b972bd3a7e1f57c306d8e2eb28886d7337d9a13e425407` |
| green.log | `57a78052728ad7a5fff55840b7a627fe50f228f03f442dc20ce838a1fe3e90ba` |

Author freeze records 16 registered server PIDs no longer alive, corresponding ports closed, exit 0/signal null, and 15 removed fixture roots. Those records are consistent with the retained owned shutdown receipts; this reviewer did not signal any process or perform a new runtime probe.

## Remaining boundaries

No C/I/M issue remains within this frozen repair scope. The coordinator still needs the mechanically combined candidate's new full-gate receipts and publication/remote-CI checks. The original 1342/51 full passes remain evidence for the pre-repair candidate, not newly executed passes for this five-file candidate. The separate CI repair window is not incorporated into this rereview. Windows/macOS native behavior, provider/native-client support, merge/deploy, PERF and IDX04 are not certified here. FS/KN/POL ticket closeout remains the coordinator's responsibility after those applicable gates; this narrow APPROVE only closes the original Python compatibility I1.
