# Independent whole-branch review

Reviewed original base `944b48c` through `be10c8418398f4c6262218bddf137dbba1ec6963` on branch `work`, 2026-10-03 UTC. Reviewer: fresh independent `/root/mvp_whole_review`.

## Scope and method

Used `.agents/skills/requesting-code-review/code-reviewer.md`, the repository instructions, MVP design/plan/contracts, README and coverage report, controller whole-review context, exact progress/deferred/ruling ledger, T08 report and pertinent T07/T08 regression evidence. Examined the supplied original-base review package in bounded passes by subsystem; did not regenerate the Git diff. Product implementation and cross-module contracts were the primary review; test cases, integration harnesses, documentation, manifests, CI and vendored-workflow integration/provenance were also assessed. This is not a new independent security audit of every upstream vendored skill or transitive package.

No source, index, HEAD or branch changes; no subagents and no rerun of the reported passing suites/browser/target gates. The only checkout write is this report. Four named focused doubts were probed using current compiled modules, in-memory SQLite/Fastify injection and disposable `/tmp/atlas-whole-*` source fixtures. These fixtures were removed in `finally`; target programs were never executed. Probe outcomes and limitations are below.

## Strengths

- Package boundaries are substantive: core owns pure contracts/query/validation, indexer owns captured source and parsing, SQLite implements storage, service owns business decisions, and HTTP/UI/stdio MCP share those decisions. The UI does not write facts or target source.
- Approval has good transactional foundations. Expected revision is checked again after asynchronous refresh; semantic hash and immutable approved-plan history are saved together. Meaningful knowledge changes advance project plan revisions atomically, while layout stays separate. Existing rollback, refresh race and actual restart evidence exercise these boundaries.
- Snapshot identity includes analysis/coverage as well as captured source bytes. Python runs isolated AST parsing over supplied bytes, not target imports. Budgets, unresolved calls, parse diagnostics and exported-entry candidates are exposed rather than presented as a complete runtime graph.
- Project epochs and request generations address real A→B→A and focus races. Off-graph planning references remain readable; accepted temporary metadata, undo/redo and lost annotations received focused regressions. UI forms and graph operations preserve the fact/planning distinction.
- Actual SDK stdio, HTTP/SQLite, browser clipboard, persisted approval/export and satisfied/unmet/unknown workflows have meaningful recorded evidence. The documents distinguish Linux execution from configured native CI, real SDK from unrun native clients, and the original 200-test full run from later focused loader checks.
- Superpowers integration preserves the MIT license, v6.4.2/full commit pin, 15 skills/74 skill files, checksum evidence and explicit AGENTS/CLAUDE fallback. It does not claim that checksum success proves native catalog discovery.

## Issues

### Critical

None identified. The following Important issues affect trust in local API access and structural evidence, but this review did not establish unconditional remote compromise, target-source modification or data loss.

### Important

#### WR-I1 — Exclusion is treated as proof that approved source was removed

- **Files:** `packages/service/src/verification.ts:46`, `packages/service/src/verification.ts:112`, `packages/service/src/verification.ts:123`, `packages/service/src/verification.ts:216`; relevant producer `packages/indexer/src/scan.ts:172`.
- **Trigger:** Approve removal of an indexed function/call, then add its unchanged source file to `.gitignore` and verify. The scanner legitimately excludes it without a parse diagnostic. Verification checks diagnostics but does not distinguish exclusion from actual absence.
- **Observed probe:** An approved plan removed `keep` and `caller→keep` in `main.ts`. Only `.gitignore` was changed to `main.ts`; the source still contained both functions and the call. Current coverage became `files: []`, diagnostics stayed `[]`, and **both operations returned `satisfied`** with empty evidence.
- **Impact:** The core implementation check can claim success when no requested removal occurred. This also affects negative relation evidence when an endpoint drops out of the scan and can misclassify other checks against excluded targets. The displayed phrase “absent from indexed source” does not make a `satisfied` implementation result sound.
- **Fix outcome:** Preserve enough scan eligibility/exclusion evidence to distinguish unavailable/excluded source from proven deletion, and return `unknown` where negative evidence is incomplete. Preserve genuine deletion success and unaffected positive matches. Add a focused real-indexer lifecycle regression for unchanged ignored source and its relation; do not solve it merely by hiding the result in the UI.
- **Basis:** MVP structural verification must distinguish satisfied/unmet/unknown and never mistake missing evidence for completed implementation. Existing parse-failure coverage handles the same principle but misses ordinary exclusion.

#### WR-I2 — The local HTTP service accepts untrusted authorities/origins on sensitive routes

- **Files:** `apps/server/src/server.ts:27`, `apps/server/src/server.ts:61`; sensitive routes `apps/server/src/routes.ts:115`, `apps/server/src/routes.ts:157`, `apps/server/src/routes.ts:187`.
- **Trigger:** A request reaches the loopback listener with an attacker-controlled Host (for example through DNS rebinding) and an untrusted Origin. There is no authority/origin boundary before project discovery, source reads, plan writes or human approval.
- **Observed probe:** Fastify injection with `Host: attacker.example:4310` and `Origin: http://attacker.example:4310` returned **200** for project discovery and a real source read. A JSON POST to a draft's approval route returned **200, valid: true**, recording user approval. No credentials or trusted-origin token were needed.
- **Impact:** Binding to `127.0.0.1` restricts the network interface, not the HTTP authority. In a browser environment permitting the rebinding request, the malicious page can interact with the sensitive API as its own origin, disclose local project content and manufacture the approval records the product presents as human confirmation. Ordinary cross-origin reads may be blocked by browser CORS; the issue is the missing server boundary, not a claim that all browsers permit all attacks.
- **Fix outcome:** Enforce the intended local service authority and reject untrusted browser origins on sensitive requests (or provide an equivalent local authentication boundary), while keeping intended production UI, explicit development proxy and origin-less local MCP traffic working. Cover accepted local requests and denied foreign Host/Origin requests including approval and source. A loopback bind or response-only CORS setting alone is not an authority check.
- **Probe limit / calibration:** The probe establishes request acceptance and actual read/approval side effects in the server, not an end-to-end browser DNS-rebinding exploit against every supported browser. This is Important rather than Critical under those limits.

#### WR-I3 — A single same-name function in another file silently substitutes for an approved reuse target

- **Files:** `packages/service/src/verification.ts:89`, `packages/service/src/verification.ts:103`, `packages/service/src/verification.ts:112`, `packages/service/src/verification.ts:139`.
- **Trigger:** An approved `must_reuse` target disappears from its original file, and one function with the same qualified name and language exists elsewhere. With no approved move, `bind` falls back to all files and treats a unique candidate as certain. It does not establish the planned path/identity or an accepted migration.
- **Observed probe:** Approved `caller → approved.ts:B`. Then removed `approved.ts`, created `different.ts:B` with a different implementation, and changed the caller to import that replacement. The plan contained only `must_reuse`, no move. Verification returned **`satisfied`, “The required relation exists.”**, with `main.ts:2 B()` as evidence.
- **Impact:** A different abstraction can satisfy an explicit reuse requirement. This is exactly the kind of bypass the product promises to help the human detect. The known future absence of identity migration does not justify silently accepting a migration now.
- **Fix outcome:** Keep missing-identity cross-file matches as uncertain candidates unless an approved move or another supported, explicit binding establishes the target. Do not use a uniqueness-by-name heuristic as positive proof for reuse. Existing move operations must still work; conservative removal detection may retain candidates without letting them prove a positive call requirement. Cover one candidate as well as the already-covered multiple-candidate case.
- **Basis:** README stable identities include path and declaration category; the MVP spec requires path/qualified-symbol evidence, with insufficient information reported as unknown. This finding does not request implementation of the future migration feature.

#### WR-I4 — Reassigned TS/JS callable variables resolve to their obsolete initializer

- **Files:** `packages/indexer/src/typescript.ts:209`, `packages/indexer/src/typescript.ts:226`, `packages/indexer/src/typescript.ts:249`, `packages/indexer/src/typescript.ts:266`.
- **Trigger:** A mutable callable is initialized with one function and overwritten before a call. The checker symbol still identifies the variable declaration, and `targetFromSymbol` always maps its initializer to the target without establishing that the initializer remains the callable value.
- **Observed probe:** Indexed, without executing, the following source:

  ```ts
  export let handler = () => "original";
  handler = () => "replacement";
  export function caller() { return handler(); }
  ```

  Both arrows were indexed. The sole `caller` call nevertheless had **`resolution: "resolved"` and the line-1 initializer's node ID**, not an unresolved target or the line-2 implementation.
- **Impact:** A definite overwrite produces an incorrect code fact, which flows into UI/MCP, evidenced call-chain validation and positive reuse verification. This is not simply an omitted dynamic edge or the documented future tsconfig/module-resolution work.
- **Fix outcome:** Only assert initializer identity where it is supported; conservatively retain unresolved evidence for mutable/rebound callables that the current analysis cannot prove. A full runtime/flow engine is unnecessary. Add TS/JS reassignment regressions with a stable direct/immutable-call control and a downstream check that obsolete initializer identity cannot satisfy a reuse requirement.
- **Basis:** The current scope promises known static targets and explicit unknowns for dynamic/shadowed calls. Existing Python rebinding and TS callback/getter tests demonstrate the intended conservatism but do not cover this case.

### Minor

#### WR-M1 — Fixed-target validator still does not bind evidence to a clean working tree (ledger T08 M4)

- **File:** `scripts/validate-repository.mjs:25`.
- **Trigger:** Run the validator in a target checkout with the requested HEAD but modified, staged or untracked supported source. The only pin check is `rev-parse HEAD`, while the product indexes working-tree bytes.
- **Impact:** A future report can label modified source as validation of the fixed public commit. This weakens reproducibility, not present product runtime correctness.
- **Evidence/calibration:** The controller's exact ledger entry at `progress.md:242` records both actual Vite/Flask targets clean including untracked files and matching their full SHAs. There is no contrary evidence; I do **not** invalidate their saved successful runs or require unchanged target/browser reruns. The missing guard remains real.
- **Fix outcome:** Reject a dirty target before capture (include staged and untracked source), and ensure the reported provenance remains valid at capture completion or explicitly detect intervening changes. Save the relevant provenance in the evidence. A focused dirty-target preflight regression suffices; keep the old clean-target evidence with its honest bounds.
- **Triage:** Retain as Minor, nonblocking by itself, and include in the controller's complete fix wave. It is neither silently discarded nor inflated into a failed fixed-target acceptance run.

#### WR-M2 — Planned-call validation omits the required compatibility uncertainty

- **File:** `packages/core/src/validation.ts:361` (through return at `:401`); UI presentation `apps/web/src/features/planning/PlanEditor.tsx:115`.
- **Trigger:** A structurally valid proposed call/reuse edge is validated even though the model supplies no arguments/type-adaptation evidence. Validation checks identity, endpoint category and policies, then emits no compatibility warning at all.
- **Impact:** The user/Agent gets “No validation issues reported” without the spec-promised indication that interface compatibility remains unassessed. This is an information gap, not proof that the tool explicitly claims type compatibility or that every such plan is invalid.
- **Fix outcome:** Emit a clear warning/unknown-compatibility indication for planned connections where compatibility cannot be established, preserving approval for structurally valid plans. No full type-inference feature is requested. Cover a normal planned connection and verify the shared API/UI/MCP result exposes the limitation.
- **Basis/calibration:** MVP design `:115` explicitly says insufficient compatibility evidence produces “无法判定/需要适配”; README `:142` says the same. Minor because current validation does not expressly return a positive compatibility verdict and structural checks remain useful. This behavior was not listed among the declared scope exclusions.

## Deferred-fix and evidence triage

| Prior item | Current conclusion | Evidence inspected |
| --- | --- | --- |
| T05 M1 temporary inspector/copy metadata | Addressed, do not reopen | `apps/web/src/app/workspace.ts:150` replaces selected temporary metadata from accepted operations; `Inspector.tsx:26` derives copied location from current node. `workspace.test.ts:473` covers edit/undo/redo, and T07 report records real clipboard checks without reselection. |
| T06 M2 stalled JSON body timeout | Addressed, do not reopen | `apps/mcp/src/client.ts:58` checks aborted signal/reason while consuming JSON; `client.test.ts:6` uses a real stalled server and 30-second deadline. T08 reports meaningful RED/GREEN and full-suite inclusion. |
| T07 M3 retained localized error text | Addressed, do not reopen | Workspace stores `errorHelp`/`errorMessageKey`; `App.tsx:101` renders with the current dictionary. Member lookup stores `messageKey`; `locale.test.tsx:65`, `:99`, `:139` cover retained help and snapshot mismatches. Backend diagnostics remain deliberately verbatim. |
| T08 Important preload file URLs | Addressed, do not reopen | All three preload specifiers use `pathToFileURL`; real space/# path regression and scoped re-review demonstrate the actual loader failure/fix. This does not prove native Windows acceptance. |
| T08 M4 dirty target guard | Still open Minor | WR-M1 above; actual clean target provenance was checked by controller, no evidence contradicts it. |

Recorded checks remain credited at their actual revisions: clean install/build/typecheck/lint/smoke and 200 tests/20 files at initial T08 `5b22868`; later `24a6d76` has 10 existing process checks plus the repaired loader regression, smoke and covering type/lint/syntax evidence. `task-8-clean-tests.log:9`/`:10` and `task-8-i1-loader-final.log:9`/`:10` agree with those counts. There is no claim here of a 201-test full suite on final HEAD.

The current mature-target screenshots were already actually viewed by the controller and T08 worker; I assessed their recorded focused-width/viewport/idle assertions and documented limits rather than running another browser gate. Visual acceptance remains credited to those observers, not falsely claimed as my own new screenshot inspection.

## Focused probes performed

Each was selected because a concrete code-path doubt had no equivalent case in the existing test/report evidence. All ran through `node --input-type=module` from this checkout and exited 0 because they were observational probes, not passing regression assertions.

1. **Excluded unchanged source:** Real `SourceIndexer` + `WorkspaceService` + in-memory `SqliteStorage`; approve removal, change only `.gitignore`, verify and read the unchanged fixture. Confirmed WR-I1. No target source execution.
2. **Untrusted Host/Origin:** Actual `createServer` factory with Fastify injection over the same service; foreign-authority project/source GETs and approval POST. Confirmed acceptance, real source disclosure and persisted valid approval for WR-I2. Did not simulate DNS infrastructure or claim browser exploitation.
3. **Single cross-file substitute:** Fresh real-adapter fixture; approve one `must_reuse`, remove its target, create a differently implemented same-name function elsewhere, update the caller import, verify. Confirmed WR-I3 without any move operation.
4. **Mutable callable reassignment:** Fresh source fixture, actual `SourceIndexer`, inspect function IDs and call fact. Confirmed WR-I4; no fixture program was executed.

No broad suite, browser, dependency installation, public-repository indexing or platform rerun was performed. HEAD remained `be10c8418398f4c6262218bddf137dbba1ec6963`, and tracked working-tree status was clean before writing this report.

## Behaviors considered and declined to judge

These are explicit review boundaries for controller adjudication, not silent passes:

- Native Windows/macOS installation, Ctrl+C behavior and remote CI execution: configured/adapted but unrun; Linux and the portable-handler/URL-loader checks cannot establish native acceptance.
- Actual Codex App/CLI and Claude Code registration, full client sessions and automatic skill catalog discovery: documentation/SDK evidence exists; actual client execution is explicitly unverified.
- Public deployment, remote push, publishing the cloud draft and restoration in a fresh task: outside this review's authorization/evidence; local commits and saved drafts do not prove remote durability.
- Captured tsconfig paths/baseUrl, workspace package exports and CommonJS resolution: explicit future ticket, prepared spec/plan only. Current uncertainty is allowed; incorrect definite facts in current supported syntax are still judged (WR-I4).
- Complete runtime call graphs, virtual dispatch resolution, framework-confirmed entrypoints and target behavior tests: static analysis is the agreed boundary; Vite/Flask source browsing does not prove their applications/tests run.
- Advanced grouping (member editing/collapse, circle selection, concrete external endpoint preservation during collapse), sequence/wrapper operations and semantic directory drag: declared partial/future scope; current shared membership/create/read behavior was reviewed.
- Independent annotations, authored-knowledge import/export/migration/backups and accepted identity migration: declared future work. Current lost-binding retention and historical approvals were reviewed; WR-I3 does not excuse unsafe positive rebinding under this exclusion.
- `.codemap/structure.json` bidirectional validation/writeback/audit and allowed-dependency/exception editors: documented unimplemented scope; current SQLite forbidden policies and responsibility invalidation were reviewed.
- Automatic plan rebasing after source changes, full snapshot-diff/dead-code analysis and sophisticated rename matching: no such endpoint/workflow is promised in the milestone contracts; stale blocking and historical verification are implemented. This does not excuse false verification evidence.
- Complete reconstruction of historical knowledge context: the explicit T07 ruling accepts transactional current-plan revision invalidation while preserving approved records. This limitation is documented and not secretly treated as a versioned knowledge archive.
- Persisting the UI undo stack across reloads or every intermediate unapproved draft as a separately browsable history: the accepted session history is bounded to 50 steps/plan and 20 plans; current plan and approved history persist. No broader archival guarantee is credited.
- Full offscreen graph rendering, automatic layout, incremental indexing and large-project performance beyond the recorded supported snapshots: explicit budgeted/manual MVP. Truncation and source scope are disclosed; no new unbounded benchmark was justified.
- Backend parser/domain diagnostic translation and authored symbols/text: deliberately preserved verbatim; locale judgments apply to product controls and retained client help. M3 is fixed on that basis.
- System-level prevention of external shell writes or an external Agent directly invoking local APIs: explicitly disclaimed; approval is a workflow boundary. This does not excuse the unrelated malicious-browser authority issue WR-I2.
- Exhaustive hostile-filesystem races, a general third-party dependency audit and re-auditing all upstream Superpowers internals: beyond this bounded code review; normal repository confinement, captured parsing, pinned vendor integration and reported integrity evidence were assessed.
- Repeating prior screenshots/full suites solely to attach a new reviewer timestamp: unnecessary duplication under the review instructions; existing evidence is credited with its stated versions and limits.

## Recommendations and assessment

Apply one focused fix wave for WR-I1–WR-I4 and adjudicate both Minors explicitly. Keep repairs conservative: protect evidence trust without introducing the deferred module-resolution, migration or runtime-analysis projects. Add tests at the shared producer/service boundaries so HTTP, UI and MCP inherit the correction; run covering checks and one scoped independent re-review of the fixes.

**Ready to merge / declare this milestone complete: With fixes — not yet.** The milestone has a credible shared architecture and substantial real acceptance evidence, but four Important issues remain: two ways to report unsupported structural success, one incorrect definite call fact, and an unguarded local HTTP authority boundary. No Critical finding; two Minors require explicit triage, including the previously deferred T08 M4.
