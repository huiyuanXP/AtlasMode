> 归档说明：本文保留实现者原始报告（含中间失败和当时限制）。其中相邻日志/截图路径指原 `.superpowers/sdd/2026-10-08-focus-navigation/` 或 `.superpowers/sdd/2026-10-08-agent-chat/`，并非本归档目录。当前最终结论以本目录 README 为准。

# AG-04 recovery report — 2026-10-08 UTC

Result: actual existing Mimo Profile → native Codex → scoped AtlasMode MCP → saved unapproved draft PASS. No Device authentication, global configuration changes, source execution, provider substitution or direct-HTTP adapter was used.

## Changes and causes

- Read trusted base TOML plus safe file Profile (inline fallback) with exact `smol-toml@1.9.0`; preserve chosen model/provider, reasoning options, model catalog, auth store and provider settings. Only selected inference/provider configuration crosses `--ignore-user-config`; native tools remain disabled and the run has an empty trusted temporary cwd.
- API environment providers use existing environment credentials without an account-login gate. Account providers still inspect existing account authentication. Inline bearer/header secrets move to private subprocess environment, never CLI arguments. Config parsing errors cannot quote secret source lines.
- The original failed log only retained `failed`, so its precise error could not be recovered. A startup reproduction found the omitted Mimo `model_catalog_json` produced a metadata-fallback `item.error`, which the parser classified as an unsafe tool. Preserve the catalog; recognize only that exact local notice privately, while other error items fail as `AGENT_FAILED`. Foreign MCP/native tool guards remain intact.
- Subsequent instrumented real model calls proved `search_functions` / `propose_plan` were blocked by CLI approval policy. Set only the bound AtlasMode MCP server's supported `default_tools_approval_mode="auto"`; global policy remains `never` and explicit tool allowlist remains unchanged. The installed native binary contains this field in `RawMcpServerConfig`.
- Auto mode still refused tools with absent annotations. Actual SDK metadata lacked `destructiveHint` and `openWorldHint`, whose default interpretation is more restrictive. Explicit truthful annotations now identify closed local, nondestructive operations; ordinary reads have `readOnlyHint=true`, draft/index/verification operations false. Draft/index operations retain historical data and never write target source. This change produced the successful real invocation.
- Opt-in native script now records selected profile/model/provider/auth metadata and, on failure, normalized activity, fixed error codes, saved-draft count and credential/endpoint-redacted public final answers. Provider stderr and raw tool payloads remain private.

## Verification

- Catalog regression: RED (`model_catalog_json` missing override) → GREEN.
- Scoped autoapproval regression: RED (mode absent) → GREEN, asserting global `never` plus the explicit tool allowlist.
- Metadata notice/fatal item regression: RED (`AGENT_UNSAFE_TOOL`) → GREEN; fatal errors still fail and disclose no error text.
- `npx vitest run apps/server/src/agent/profile.test.ts apps/server/src/agent/native.test.ts apps/server/src/agent/process.test.ts`: 20 tests / 3 files passed.
- SDK metadata regression: RED (annotations undefined) → GREEN. `npx vitest run apps/mcp/src/scope.test.ts`: 4 tests passed, including immutable project/tool scope.
- Server and MCP workspace builds passed. ESLint passed for the changed backend, MCP and native test script files. Root performs the single integrated final suite separately; this report does not claim it.

## Actual native result

Exact tested invocation:

```sh
CODEMAP_AGENT_COMMAND=/opt/infrastructure/managed/current/Runtime/bin/codex npm run test:agent -- codex mimo
```

Receipt: `native-mimo-annotations.log`, exit 0; `profile=mimo`, `model=mimo-v2.6-flash`, `modelProvider=mimo`, `authentication=api-environment`; `nativeModel=true`, `actualMcpProposal=true`, `revision=2`, `targetExecuted=false`. Acceptance reads the actual HTTP draft, checks no approval, verifies the `connectionExample` operation and checks the target sentinel. This is real model execution; lifecycle/parser fixtures remain explicitly simulated protocols.

The default `/home/agent/.local/bin/codex` is a managed wrapper that sources the existing two API credential variables and execs that same native binary. It does not inject MCP configuration. A credential-removal startup probe was not an offline authentication test because the wrapper restored those credentials; it was bounded at 10 seconds and its output informed the metadata diagnosis. Subsequent native diagnostics explicitly used the actual binary. No additional paid default-wrapper verification was run; exact receipt above is the functional claim.

Earlier recovery logs remain separate failures: `native-mimo-recovery.log` completed without proposal; `native-mimo-diagnostic.log` observed failed search/proposal and zero saved drafts; `native-mimo-final.log` observed approval-blocked search before annotations. They are not counted as PASS. No upstream authentication/provider blocker remains for this tested Mimo invocation. AG-05 independent direct HTTP model support remains separate and unimplemented here.
