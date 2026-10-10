# AG05 independent security/correctness review

Date: 2026-10-10 UTC. Reviewer: independently delegated AG05 review agent; this is not implementer self-review.
Latest decision: **APPROVE for the reviewed adapter/dependency checkpoint** after the limited independent re-review appended below. Real-provider acceptance remains PARTIAL.

Initial decision: **REQUEST_CHANGES** (1 Important, 0 Critical, 0 Minor), preserved as review history.

## Reviewed scope and identity

VM2 repository: `/home/agent/projects/AtlasMode`, branch `fix/first-use-20261010`; HEAD during review: `68876cd69823f973dd58be72f26b8ad320ac57e6`. AG05 is an uncommitted working-tree change; line references below describe the initial implementation read before its owner began the accepted repair.

Read: root AGENTS.md, using-superpowers/Codex adaptation (including the subagent exemption), requesting-code-review and reviewer template, README/state context, AG05 design/plan; owned direct.ts, configured.ts, responses-stream.ts, their tests, and the bridge/process/types/server/manifests/workspace-order integration. Traced existing apps/mcp/src/server.ts/client.ts/scope.ts and agent/gateway.ts as dependencies, without modifying them.

Product files, index, HEAD and branch were not edited. Only this requested review report was saved. Independent fixture scripts and temporary SQLite/projects were under /tmp.

## Strengths

- Credentials and endpoint are captured from trusted server environment, absent from status and JSON model inputs. HTTPS is required except explicit loopback fixtures; userinfo/query/hash are rejected; redirect:error prevents bearer forwarding (direct.ts:47–74, 176–190).
- Tool schemas come from a real SDK Client/InMemoryTransport and project-bound MCP server. The fixed planning allowlist, exact catalog membership check, strict Zod schemas and scoped HTTP gateway jointly enforce project/tool boundaries (direct.ts:114–153, 212–247; apps/mcp/src/server.ts:81–117).
- The adapter waits for a completed response before any dispatch, rejects duplicate IDs/unknown or hosted items, preserves reasoning output for continuation and bounds cumulative requests/output/tool results.
- Actual in-flight cancellation waits for an already-dispatched write; the gateway drains and records committed plan IDs before the public terminal state.

## Issues

### Critical

None found.

### Important — I1: ambiguous MCP execution timeout continues the model/tool loop before the pending mutation settles

**Location:** apps/server/src/agent/direct.ts:265–299, particularly 270–283 and 294–299.

**Trigger:** A permitted mutation has reached the real scoped gateway, but its app.inject/service response takes longer than the existing MCP ApiClient's 30-second timeout (apps/mcp/src/client.ts:34–36). The gateway does not cancel the dispatched work, by design. MCP returns isError with API_TIMEOUT while the write can still commit.

**Problem:** The adapter treats this result as a recoverable function_call_output, sends another provider request, and can dispatch another mutation while the first forwarded write is still in flight. SDK transport failures caught at 270 also become a generic “Reread and retry” result with the same unsafe continuation. Serial awaiting of callTool is insufficient because timeout is not evidence that the underlying mutation stopped.

**Independent evidence:** `/tmp/ag05-independent-probe.mjs slow` ran the real Responses HTTP fixture → SDK → scoped gateway → Fastify/WorkspaceService/SQLite chain. Only the first POST /api/plans app.inject delivery was held by the test harness; product source was unchanged. Observations:

- 30,167 ms: provider request 2 received API_TIMEOUT for the first propose_plan, while its service call remained held.
- 30,187 ms: the second propose_plan had committed and provider request 3 was sent; the first mutation remained held.
- At 30.5 seconds: the run remained running but already showed first tool failed / second tool completed and a public final answer.
- Releasing the first call produced status completed and **two changedPlanIds**, one for each committed draft.

This permits duplicate draft creation on model retry and out-of-order mutations. Journal draining correctly preserves both eventual commits, but it does not prevent the overlap.

**Required repair:** Treat ambiguous execution/transport failures (e.g. API_TIMEOUT/API_UNAVAILABLE/API_INVALID_RESPONSE/unexpected internal or SDK connection failure) as terminal for this adapter: stop further provider/tool dispatch and let existing gateway.close drain retain the real journal. Preserve recoverability for deterministic schema/project/validation errors. Do not expose raw errors. Add a real SDK/HTTP/SQLite regression that holds an in-flight mutation through its timeout and proves no second provider/tool dispatch, then releases it and asserts a failed terminal run with the actual committed plan ID.

The implementer accepted I1 and began TDD repair during this review. This report records the initial decision; repair approval requires a separate verification entry.

### Minor

None found.

## Independent verification

1. `PATH=/home/agent/.local/bin:$PATH npx vitest run apps/server/src/agent/direct.test.ts apps/server/src/agent/direct-loop.test.ts apps/server/src/agent/responses-stream.test.ts --reporter=dot`
   - **38/38 PASS**, 3 files, 2026-10-10 14:48 UTC; includes fragmented UTF8/CRLF/lone-CR, missing completed, unknown/hosted calls, legal foreign project/plan tuple, budgets, redirect isolation and HTTP-error secret isolation.
   - This is an independent rerun of these three files only; it does not claim all root tests or the previously reported 71 agent tests were independently rerun.

2. `PATH=/home/agent/.local/bin:$PATH node --import tsx /tmp/ag05-independent-probe.mjs cancel`
   - **PASS**: while first POST /api/plans was held, cancellation stayed pending and public status stayed running; provider/tool dispatch counts stayed 1.
   - After release, cancellation returned cancelled with one real changedPlanId and mayHaveSavedChanges:true; the second tool in the provider batch was not dispatched.

3. Same temporary probe with `slow`
   - **FAIL / I1 reproduced**: timeout continued provider and second mutation before first write settled, followed by two saved drafts.

4. Official protocol check:
   - [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) requires reasoning items accompanying tool calls to be returned with tool outputs.
   - [OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) supports encrypted reasoning continuation with store:false (the explicit legacy include remains accepted).
   - The adapter's complete-output replay and function_call_output ordering match those requirements; fixture verifies preservation, not successful paid inference.
   - [WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream) confirms UTF8 and LF/CRLF/CR framing and discarding undelimited events. The tested required framing passes.

## Declined to judge

- Real paid provider success/error/cancel/concurrency/MCP loop: not authorized, no real key read or paid model call; whole AG05 remains PARTIAL.
- Web three-state labels and new browser fixture: separate owner and still being implemented; outside this adapter review.
- SEC-01/root/indexer dependency cleanup visible in shared package-lock diff: separate owned changes; this review checks only AG05's two server dependency entries and MCP-before-server order.
- Complete root build/lint and unrelated suites: coordination-controlled checks belong to the parent; their earlier evidence is not re-labelled as independent review execution.
- General third-party Responses dialects: the design explicitly requires separate validation. This review checks the official protocol and named fixture gates.

## Assessment

**REQUEST_CHANGES.** The credential/tool/project boundaries and normal cancellation/journal behavior are sound in the inspected paths. I1 must be repaired and independently verified before approving this adapter checkpoint. No claim is made that AG05's real-provider acceptance gate is complete.

## Limited independent re-review after I1 repair

Date/time: 2026-10-10 14:56 UTC. **Latest decision: APPROVE for the AG05 adapter checkpoint and the explicitly authorized minimal dependency extension.** I1 is resolved; 0 open Critical/Important/Minor findings within this reviewed scope. The initial REQUEST_CHANGES and failing evidence above are preserved.

### Repair assessment

- direct.ts:270–275 now terminates the adapter on a thrown SDK/transport failure with a fixed AGENT_FAILED code; it cannot send another provider request or dispatch the next tool.
- direct.ts:286–287 stops on error results whose completion cannot be trusted. recoverableToolError at 337–366 uses an explicit deterministic error whitelist and the installed SDK's input-validation error prefix; ambiguous timeout/unavailability/invalid response/internal errors fail closed.
- Existing AgentBridge.execute awaits gateway.close before deriving changedPlanIds and publishing the terminal status. Thus the held actual write still reaches its journal, while the adapter is prevented from attempting a second write.
- direct-loop.test.ts:471–563 covers both in-flight cancellation and the reproduced timeout. Only the real ApiClient timer is reduced from 30 seconds to 100 ms in the timeout fixture; SDK/InMemoryTransport/HTTP/gateway/service/SQLite paths remain real. The test holds first app.inject delivery, verifies running plus one provider/one mutation before release, and then verifies the correct terminal state and one committed journal entry.
- Read the implementer's /tmp/ag05-review-red.log (original implementation: expected one provider request, got three) and /tmp/ag05-review-green.log (40/40). These are implementer evidence, distinct from the independent checks below.

### Independent limited verification

Command:
```bash
PATH=/home/agent/.local/bin:$PATH npx vitest run apps/server/src/agent/direct-loop.test.ts -t "in-flight MCP|invalid schema|foreign project" --reporter=dot
```

Result: **4/4 PASS**, 18 skipped, 2026-10-10 14:56:00 UTC, duration 3.98 seconds. Independently verified both new held-mutation regressions plus existing recoverable invalid-schema and foreign-project behavior. No whole-suite rerun was claimed. The initially failing slow condition is now represented by and passes the precise real-path timeout regression; repeating the 30-second probe was unnecessary.

`git diff --check -- apps/server/src/agent/direct.ts apps/server/src/agent/direct-loop.test.ts eslint.config.mjs scripts/workspaces.mjs scripts/dev.mjs apps/server/package.json README.md` exited 0.

### Authorized dependency extension assessment

**ACCEPTED.** The parent explicitly extended scope to eslint.config.mjs, scripts/dev.mjs and the matching README/design rationale.

- apps/server/package.json adds @codemap/mcp and its explicitly used MCP SDK version. direct.ts:1 uses the public @codemap/mcp export, preserving package entry-point restrictions.
- apps/mcp package/source depends on core (plus external SDK/Zod), with no import of server/service/indexer/storage. Its HTTP gateway callback to the assembled service is a runtime interaction, not a compile dependency. The stdio main guard in apps/mcp/src/index.ts prevents importing its public entry from starting stdio.
- eslint.config.mjs only adds mcp to allowed.server; mcp remains allowed only core, and all existing internal-path and other package restrictions remain.
- scripts/workspaces.mjs places mcp before server for build/typecheck; web's existing core-only dependency permits its current position.
- scripts/dev.mjs adds mcp to direct tsc prerequisites before server, resolves mcp under apps, and retains the same owned-process/lifecycle checks.
- README package-boundary table and AG05 design explicitly document this extension and the unchanged shared service/schema authority.

Reviewed file SHA-256 snapshot:
```text
67d105edc27d76c54a1f51f0a6d0376f017594ae17bc9b1329ffae827f57e8b4  apps/server/src/agent/direct.ts
e0aa2b2cb7aa24f3f6e57b129ed9ffd004ac789c790b08e008fba1edc24e894f  apps/server/src/agent/direct-loop.test.ts
23425fb24ba0de7bf5e3e19cbdf83567b2f8bebfcf99cfd39cbf368ab737cf92  eslint.config.mjs
2c9dc62e7ee5ceab1bede0a1b5e97b0eae20208a8e3d363c1b9738ee93a7181f  scripts/workspaces.mjs
056a5e1ee7900760a1935c1e39f9a8d30687d75d9578a1b57e29f962ae9d8585  scripts/dev.mjs
aa83873de5cfde8f78fedeefb106eaa3249ba1cc02dc7b5415b77b422a02f540  apps/server/package.json
```

### Remaining acceptance limits

Real provider success/error/cancel/concurrency/MCP acceptance remains **PARTIAL**, with no paid inference or real credential read performed by this reviewer. Web/browser integration and parent-controlled whole-root checks remain outside this limited re-review. Approval here is for the inspected adapter/dependency checkpoint; it does not close the whole AG05 ticket.
