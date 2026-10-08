# Local Agent chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace default engineering forms with real local Agent Chat and compact planning overview, with reproducible MCP connection tests.
**Architecture:** Server-owned CLI I/O adapter runs process-local AtlasMode MCP. Web has two project-scoped conversations and synchronizes resulting plans via unified view focus.
**Tech Stack:** Existing Node24, child_process, Fastify, TypeScript, React, Vitest, Playwright and MCP SDK.
**Spec:** docs/superpowers/specs/2026-10-08-agent-chat-design.md

## Global Constraints

- Node24/npm frozen lock and existing package boundaries; no dependencies unless concrete need approved by controller.
- Current cloud work checkout; no Tunnel restart, global client config changes, secrets, invented model replies or target execution.
- Agent configured explicitly via CODEMAP_AGENT_PROVIDER=codex|claude and optional trusted CODEMAP_AGENT_COMMAND and CODEMAP_AGENT_MODEL. Disabled default.
- Browser cannot choose executable/args/model credentials. All source access project-root bounded; MCP cannot approve.
- Separate project/channel sessions; 20-turn/65536-character history, 4096-character messages, 1MiB output/run, 10-minute terminal TTL; one active run per session/four globally; owned process-tree cancellation with 2s grace.
- Existing Codex not authenticated, Claude absent: report real model tests unavailable unless existing auth becomes available.

## Review Focus

- Injection-like chat text is data, never a shell command (Task1).
- Missing CLI/auth, failure/partial MCP change must not become fake success (Tasks1–3).
- User switches project during a run: old completion must not change view/conversation (Task2).
- New MCP plan has multiple changed nodes: sync must focus current changed projection (Task2).
- Real stdio handshake/cleanup and target sentinel: test uses installed SDK and compiled production (Task3).

### Task 1: AG-01 Local CLI Agent bridge

**Files:** Create apps/server/src/agent/ adapter, lifecycle, protocol and route modules/tests; modify server.ts/index.ts and apps/mcp/src/server.ts/index.ts for opt-in immutable project/tool scope; package documentation/environment and .codemap/structure.json if new responsibility needs recording. May share transport types via core only if genuinely needed; browser client type stays transport local.
**Interfaces:** Produce HTTP GET /api/agent/status; POST /api/projects/:id/chat with {channel:'explore'|'plan', message:string, planId?:string, nodeId?:string, scope?:{kind:'folder'|'file'|'function',path:string,nodeId?:string}, snapshotId?:string, expectedRevision?:number}; GET /api/projects/:id/chat/:runId; POST /api/projects/:id/chat/:runId/cancel. Responses contain runId/status ('running'|'completed'|'failed'|'cancelled'), messages (public assistant text), activity (concise tool status), errors and changedPlanIds when parsed/verified; status exposes provider/available/configured plus safe reason. Inject backend runner factory only via server construction for meaningful process protocol tests. Produce exported transport contract and clear setup documentation.

- [ ] RED process protocol tests using test-only executable fixture: spawn-array text safety, JSONL incremental parsing, final text, MCP tool call summary/plan IDs, partial failure preserving actual mutation information, missing command/auth errors, invalid/oversize output, timeout, cancellation/cleanup, cross-project/run access including full valid foreign project+plan tuples, target command tool disabled, per-channel allowlist, project listing filtered, mutation committed without tool-completed then cancel, owned grandchild cleanup, busy/global limit/TTL; no production fake answer.
- [ ] Run focused tests/save RED.
- [ ] Implement spawn CLI adapter (Codex JSONL and Claude JSON stream) with per-invocation MCP config and prompt carrying actual selected project/scope/plan IDs, bounded conversation history and read-only planning instructions. For Codex verify installed flags and use empty trusted temporary cwd, --ignore-user-config, isolated required=true MCP config and enabled_tools; disable shell_tool/unified_exec/code-mode/browser/computer/apps/plugins/hooks/multi-agent and web_search. Claude verify --tools ''/--strict-mcp-config support or fail closed. Do not silently claim inherited model/provider settings; support trusted CODEMAP_AGENT_MODEL and document isolated default model. Add immutable project and tool allowlist options to createMcpServer, opt-in CODEMAP_MCP_PROJECT_ID/channel options in MCP entry. Use run-owned scoped loopback HTTP gateway with successful mutation journal, ownership validation and no approval/open-project forwarding; propagate as MCP API URL. General native MCP behavior unchanged. Validate context against current project and plan ownership; service query not arbitrary path. Maintain configured/offline state truthfully. Shell=false, stdin prompt, trusted executable only, owned process trees stopped and awaited on server close/cancel (2s grace then owned-tree termination); retain partial mutation journal even if native JSONL output absent. Do not leak stderr containing credentials; normalize errors safely. Provider default disabled and existing tests not spawn native Agents.
- [ ] Run root tests/build/typecheck/lint and production API unconfigured/error smoke. Document official source https://developers.openai.com/codex/noninteractive and actual CLI/version/login observations. Commit, self-review and independent task review.

### Task 2: UI-04 Conversation-led shell

**Files:** Create apps/web/src/features/chat/ ChatPanel/controller/transport/tests and planning/PlanOverview.tsx; modify app/App.tsx, WorkspacePanels.tsx, Navigation.tsx, workspace.ts, api/client.ts, styles and i18n. Preserve legacy covered forms in opt-in details/drawer. Add tests/e2e/agent-chat.spec.ts; update older browser actions to open advanced controls where required.
**Interfaces:** Consume Task1 exact HTTP chat contracts and graph plan/navigation state from prior UI tickets. Produce `workspace.syncAgentChanges(planIds?: string[])` with sequence guard/current projection focus, two independently scoped conversations and concise plan selection/overview. Do not change approval trust.

- [ ] RED component/controller/browser tests: default left/right Chat instead of form lists, explicit disconnected state, conversation/project isolation and cancellation, completion refresh selects new/changed plan and focuses multiple affected nodes, late run vs manual navigation, errors retain input and partial change notice, start acknowledgement after unmount/project switch immediately cancelled, failure/cancel rereads journaled actual state without attributing concurrent edits.
- [ ] Run focused tests/new browser case/save RED.
- [ ] Implement compact left exploration chat plus navigation affordances; right plan overview/change count/change list plus planning chat. User facing actions use normal language, no JSON schema or raw tools. Source in accessible contextual drawer; path breadcrumbs central; all existing plan approval/undo/redo/validation/export and knowledge functions remain reachable via actions or explicitly opened advanced drawer. Add project-open modal instead of always-visible technical path form. Page responsive and theme/locales supported. Chat polling cancels on project change/unmount, no unconditional entire-canvas refresh.
- [ ] Run root tests/build/typecheck/lint and actual browser default disconnected path plus labeled test-adapter streaming/multi-change focus/cancel/scoping. Run existing relevant browser workflows updated for opt-in advanced controls without weakening assertions; screenshot light/dark/narrow and inspect.
- [ ] Self-review, commit and independent review.

### Task 3: QA-01 Real MCP Test section and final acceptance

**Files:** Create docs/test/README.md, scripts/test-mcp-connection.mjs, scripts/test-agent-connection.mjs if useful; modify root package.json scripts only (do not change lock deps), tests/integration MCP/agent integration and actual UI acceptance test; docs/mcp.md/README.md.
**Interfaces:** Consume real built service and MCP SDK through existing tests/support/production.mjs; no deep workspace imports or duplicate business logic. Produce npm run test:mcp and separate opt-in npm run test:agent command with declared credential requirement and honest exit state.

- [ ] Define meaningful handshake/behavior checks before adding launcher; reuse actual fixture/lifecycle tests when possible, do not create tests that merely mirror scripts.
- [ ] Implement direct SDK connection smoke against disposable public-sized fixture/data: tool discovery/context/propose/update/revision/hash/concurrent conflict/cross-project isolation/source sentinel/cleanup. The browser shares same service data. Agent native smoke must require actual local provider config/auth and verify actual MCP tool events and resulting draft; unavailable/auth failure exits nonzero, distinct from MCP PASS.
- [ ] Run new commands: report actual MCP result and native Agent availability honestly. Run root build/typecheck/lint/tests plus all Chromium E2E after final product source. Demonstrate real public Flask indexed focus/funnel/breadcrumb/chat configured state, inspect light/dark/narrow screenshots. No target execution or Tunnel.
- [ ] Commit, self-review, independent task review. Controller broad final review, one combined repair wave and scoped re-review; update ticket statuses/evidence/state with remaining real-agent auth limitations if any.
