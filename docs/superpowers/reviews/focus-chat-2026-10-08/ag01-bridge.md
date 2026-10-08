> 归档说明：本文保留实现者原始报告（含中间失败和当时限制）。其中相邻日志/截图路径指原 `.superpowers/sdd/2026-10-08-focus-navigation/` 或 `.superpowers/sdd/2026-10-08-agent-chat/`，并非本归档目录。当前最终结论以本目录 README 为准。

# AG-01 bridge handoff — 2026-10-08 UTC

Status: implemented local real CLI I/O bridge; authenticated native model/MCP completion unavailable in this environment. No frontend, dependency, global configuration, tunnel or target source execution changes. Controller owns final review/integration gate.

## Contract and integration

- Exported transport contracts: apps/server/src/agent/types.ts. @codemap/server exports AgentRunnerFactory, AgentRunner, AgentContext, AgentStatus, ChatInput, ChatRun.
- Trusted construction only: createServer({service,webRoot?,developmentProxy?,agentRunnerFactory?:()=>AgentRunner}). No environment/HTTP selector exposes a fake provider. Default production runner is disabled until CODEMAP_AGENT_PROVIDER=codex|claude.
- GET /api/agent/status; POST /api/projects/:id/chat; GET /api/projects/:id/chat/:runId; POST /api/projects/:id/chat/:runId/cancel. ChatRun fields are runId/status/messages[{role:'assistant',text}]/activity[{tool,status}]/errors[{code,message}]/changedPlanIds/mayHaveSavedChanges. Busy409, global429, unavailable503; unknown or foreign run404. Existing Host/Origin enforcement remains. Added SNAPSHOT_CHANGED409 as controller requested.
- Context validates current snapshot and requested plan revision/project ownership, captured function/scope. Selected-plan add_function temporary IDs and add/move target paths/ancestor folders are accepted with explicit planned/indexed prompt metadata, not represented as indexed source. No source path becomes native cwd.
- Both Chat channels expose the same 18 existing safe project-scoped MCP tools per latest controller/user ruling, including refresh/get-approved/verify. Channel context/prompt and histories remain separate. No approval/open-project/native execution/source-writing tools.
- Generic MCP remains16 tools. Optional copied immutable project/tool scope plus entry CODEMAP_MCP_PROJECT_ID/channel; bound scope additionally registers list_plans/get_plan read tools. Owned loopback gateway repeats project/plan checks, restricts methods/paths, prevents approval/open forwarding, and journals successful writes before response delivery. Completed/failed/cancelled runs retain owned actual draft IDs even without native output.
- Arguments are arrays/shell=false; stdin is literal prompt. Codex isolation uses trusted empty temporary cwd, ignore-user-config/ignore-rules, read-only/ephemeral, required scoped MCP enabled_tools and disabled shell/snapshot/daemon/unified_exec/code-mode/browser/computer/apps/plugins/hooks/multi-agent/search. Native flags/features/login/build readiness checked separately; raw stderr never emitted. Claude strict MCP/no-builtins/isolated settings capability check and JSON normalization implemented; unsupported capabilities fail closed.
- Owned process group/tree cancellation, 2s production grace then force, exit/stdio awaited, temp cwd/gateway cleanup; Windows native launch is refused before spawn (see bounded-review correction below). Limits: 4096 input characters, 20 turns including current, 65536 history characters, combined1MiB stdout/stderr, 120s timeout, one active/session, four global, 10min TTL + hard retention caps.

## Evidence

- task-1-red.log: 9 expected initial missing bridge/scope assertions failed (placeholder process export used only for RED; removed in implementation).
- task-1-bridge-red.log: 3 expected missing bridge assertions failed; first real gateway test already passed, not claimed RED.
- task-1-parser-red.log: Claude null content reproduced TypeError plus missing completed tool state; runtime block validation and ID→tool completion mapping fixed at parser boundary. task-1-parser-green.log:12/2 files passed.
- task-1-context-red.log:2 expected failures for explore draft access and planned temporary context before latest requested behavior; task-1-context-green.log:6 passed.
- task-1-final-focused.log:26 tests/5 files passed (process, lifecycle/context, native invocation/status, HTTP transport, MCP scope/channel). One test-only native fixture starts the actual compiled production stdio MCP against its owned gateway, creates a real unapproved SQLite draft, and reports a real completed MCP tool event; no model was involved.
- Existing apps/mcp/src/client.test.ts was additionally covered in task-1-green.log initial22/6 files, before final context/channel additions. Its intentional30s timeout is not repeatedly run.
- task-1-integration-final.log:16/2 files passed: actual production SDK stdio12 and server shutdown4. New scoped list_plans/get_plan test verifies pagination, no refresh, own/foreign ID checks, valid foreign tuple refusal and filtered project discovery. Initial mcp exact16 discovery failure in task-1-integration.log was resolved by keeping the two new read tools scoped-only; no weakened discovery assertion.
- task-1-server-build.log and task-1-mcp-build.log: exit0 after latest production changes. task-1-server-typecheck.log/task-1-mcp-typecheck.log: exit0. task-1-lint.log: scoped eslint exit0. git diff --check passed.
- task-1-production-smoke.log: built real HTTP processes for disabled/Codex/Claude. All status.available=false and POST503/AGENT_UNAVAILABLE; precise disabled/not-logged-in/missing executable reasons; target sentinel absent and stderr empty. No model request attempted.

## Limits and self-review

Codex0.160.0 exists but login status is Not logged in; Claude absent. Authentication/model success remains unavailable, not PASS. Claude stream fixture and invocation checks are protocol/configuration verification only. Native macOS process cleanup and authenticated model execution were not run. Windows native Chat is unsupported pending owned process jobs; core HTTP/UI/MCP Windows support remains. Unix cleanup owns a separate invocation process group; this is not a malicious same-machine process isolation guarantee. Isolated default model differs from inherited user provider/model profiles; trusted CODEMAP_AGENT_MODEL override and unsupported custom-provider setup are documented.

Self-review caught and fixed malformed Claude block crash, missing Claude tool completion state, generic MCP discovery expansion, context gaps for planned functions/moved paths, and snapshot status mapping. Reviewed argument safety, service-owned project/plan validation, mutation-before-delivery recovery, cancellation during asynchronous startup, history/TTL/global limits, and no fake production fallback. Setup/API/boundary documentation is docs/agent-chat.md; docs/mcp.md links scoped variant; .codemap/structure.json records the Agent adapter responsibility. Controller review remains independent and controller-owned.

Commit: d240a25 — feat(agent): bridge local CLI chat through scoped MCP (21 bridge/MCP/test/doc/structure files only; no shared pushes).


## Bounded critical review correction — Windows fail closed

Controller independently verified one material Important: taskkill /T cannot retain descendant ownership after the native CLI root exits; the root-only groupAlive check could skip cleanup and await stdout close indefinitely. The agreed remedy is Windows native Chat refusal pending a separate owned-job lifecycle ticket, not an unverified Windows cleanup promise.

- createNativeRunner.status returns configured provider/unavailable plus a clear Windows reason before command lookup/probe; start explicitly throws AGENT_PLATFORM_UNSUPPORTED before temporary cwd/process creation.
- startProcess independently refuses win32 before spawn. The now-unreachable taskkill branch was removed; POSIX owned group behavior retained.
- One boundary test switches the platform branch to Windows, uses real executable probe/spawn sentinel paths, asserts status/start/process-start refusal and absent sentinel. task-1-windows-red.log proves previous behavior did not refuse before a probe. task-1-windows-green.log:18 tests/4 files passed, including unchanged POSIX parser/cancel/grandchild/MCP-gateway paths.
- Native process/invocation tests explicitly mark Windows unsupported; general production MCP stdio tests are unchanged. Platform refusal test remains executable on Windows. docs/agent-chat.md states only native Chat is unsupported; HTTP/UI/general MCP remain supported.
- task-1-windows-typecheck.log/task-1-windows-build.log/task-1-windows-lint.log exit0; scoped diff whitespace check passed. No root suite or new review gate requested/run.

Correction commit: b0915232d1f3901cd98548a5b2a0f033a1725997 — fix(agent): refuse Windows native chat without owned jobs. Seven scoped files only; commit lease released.
