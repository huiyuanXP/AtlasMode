# AtlasMode MCP

Build AtlasMode with Node 24 LTS and start its shared local HTTP service:

```text
npm ci
npm run build
npm start
```

The service defaults to `http://127.0.0.1:4310`. Open a repository in the web UI
(or configure `CODEMAP_WORKSPACE_ROOT` on the HTTP service). The MCP process does
not guess a project from its working directory. It uses the same HTTP service,
SQLite records, indexed facts, plans, approval history, routes and groups as the UI.
No account or API key is needed for AtlasMode. External model access belongs to
your chosen client.

Use the **absolute Node executable** and **absolute compiled MCP entry**
`AtlasMode/apps/mcp/dist/index.js`. Check that your Node executable is Node 24 LTS.
Invoke Node directly: an npm startup banner would corrupt stdio protocol output.
MCP stdout contains protocol messages; errors go to stderr. `CODEMAP_API_URL`
defaults to the origin above and accepts an HTTP(S) service origin without a path,
query, credentials or fragment. Start the HTTP service separately before tools run.

## Codex CLI and App

Example for Linux (replace both absolute paths with your installation):

```sh
codex mcp add atlasmode --env CODEMAP_API_URL=http://127.0.0.1:4310 -- "/usr/bin/node" "/home/me/AtlasMode/apps/mcp/dist/index.js"
```

Example for macOS:

```sh
codex mcp add atlasmode --env CODEMAP_API_URL=http://127.0.0.1:4310 -- "/opt/homebrew/bin/node" "/Users/me/AtlasMode/apps/mcp/dist/index.js"
```

Example for Windows PowerShell:

```powershell
codex mcp add atlasmode --env CODEMAP_API_URL=http://127.0.0.1:4310 -- "C:\Program Files\nodejs\node.exe" "C:\Users\me\AtlasMode\apps\mcp\dist\index.js"
```

Codex CLI and App share MCP settings in `~/.codex/config.toml` (Windows:
`%USERPROFILE%\.codex\config.toml`; a configured `CODEX_HOME` changes the location).
In the App, open Settings → MCP servers and use the configuration editor. You can
also configure a trusted client workspace in `.codex/config.toml`. Paths refer to
the AtlasMode installation, even when the client workspace is another repository.
Do not duplicate the same server in user and project configuration. Restart or
reconnect the client after editing its configuration.

Equivalent TOML for Linux/macOS:

```toml
[mcp_servers.atlasmode]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/AtlasMode/apps/mcp/dist/index.js"]
env = { CODEMAP_API_URL = "http://127.0.0.1:4310" }
```

On Windows, TOML literal strings preserve backslashes:

```toml
[mcp_servers.atlasmode]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\Users\me\AtlasMode\apps\mcp\dist\index.js']
env = { CODEMAP_API_URL = "http://127.0.0.1:4310" }
```

The installed Codex CLI's `mcp add --help` was checked for the `--env` and
`-- COMMAND ARGS` syntax. Configuration examples were not applied to any global
client configuration. Native Codex App connections remain untested.
See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Claude Code

Run from the client project directory for project-scoped configuration:

```sh
claude mcp add --transport stdio --scope project --env CODEMAP_API_URL=http://127.0.0.1:4310 atlasmode -- "/absolute/path/to/node" "/absolute/path/to/AtlasMode/apps/mcp/dist/index.js"
```

The same syntax works with quoted macOS installation paths. Windows PowerShell:

```powershell
claude mcp add --transport stdio --scope project --env CODEMAP_API_URL=http://127.0.0.1:4310 atlasmode -- "C:\Program Files\nodejs\node.exe" "C:\Users\me\AtlasMode\apps\mcp\dist\index.js"
```

Equivalent project `.mcp.json` (merge with your existing servers):

```json
{
  "mcpServers": {
    "atlasmode": {
      "type": "stdio",
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/AtlasMode/apps/mcp/dist/index.js"],
      "env": { "CODEMAP_API_URL": "http://127.0.0.1:4310" }
    }
  }
}
```

In Windows JSON, escape backslashes, for example
`"C:\\Program Files\\nodejs\\node.exe"`. Claude Code is not installed in the
validation environment, so these native client examples remain unrun. Consult
the [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
and use your client's normal project trust prompts.

## Tools and workflow

There are exactly 16 tools. All project tools require an explicit `projectId`;
plan reads/edits also require `planId` and reject a plan owned by another project.

| Tool                    | Behavior                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `list_projects`         | Discover opened projects with `offset`/`limit`.                                           |
| `get_project_summary`   | Current snapshot/hash, counts, coverage and static entrypoint candidates.                 |
| `search_functions`      | Search indexed functions/classes with `q`, `offset`, `limit`.                             |
| `get_function_context`  | Paged incoming/outgoing calls with source evidence and unresolved/external reasons.       |
| `get_subgraph`          | Bounded graph with `nodeIds`, `depth`, `budget`, `relationTypes`, and `truncated`.        |
| `propose_route`         | Validate and create a new agent route against an explicit `snapshotId`.                   |
| `get_routes`            | Paged routes with current `snapshotId` and per-route `stale`.                             |
| `propose_plan`          | Create a draft against required `baselineSnapshotId`, then apply supplied `operations`.   |
| `update_plan`           | Apply operations/optional title/description with required `expectedRevision`.             |
| `validate_plan`         | Current indexed validation issues; does not refresh disk or approve.                      |
| `get_approved_plan`     | Refresh actual disk sources, then return the current plan, approval, validity and issues. |
| `refresh_index`         | Reindex actual sources, then return summary metadata rather than the entire snapshot.     |
| `verify_implementation` | Refresh and verify the latest actually approved historical revision with evidence.        |
| `propose_group`         | Validate and create a new agent group; cannot supply an existing id or forge source.      |
| `get_groups`            | Paged shared groups and current snapshot identity.                                        |
| `get_folder_policies`   | Paged shared directory policies and current snapshot identity.                            |

Start with `list_projects`, select the repository explicitly, and query its summary
and functions. Keep the returned snapshot identity for proposals. Submit the
draft, let the user inspect/edit/approve it in the UI, then call
`get_approved_plan`. Implement only when `valid: true` and the approval's revision
and semantic hash match the current plan. A historical approval attached to a
newer draft does not approve the draft. Semantic edits invalidate approval;
layout edits do not. Source changes detected by refresh make old baselines stale.
There is no approve tool and MCP never writes target repository source files.

`propose_plan` uses the existing HTTP create/update sequence. Empty operations
leave revision 1; nonempty operations normally return revision 2. The two requests
are **not atomic**. If update fails after create, the tool returns `isError: true`
with the original error plus `createdPlanId` and `createdRevision` (the creation
revision). Read that id over the UI/API or `get_approved_plan` before recovery;
another client may already have edited it. Do not retry by creating duplicate plans
or blindly overwrite a concurrent revision.

Pagination defaults to 50, with limits 1–200; offsets are nonnegative integers.
Project/route/group/policy lists are sliced by the bridge after retrieving the
existing HTTP array, with `items`, `total`, `offset`, `limit`, `truncated`.
Function search and context use HTTP pagination; context pages each direction
separately. Subgraph defaults are depth 1 and budget 80; maxima are depth 5 and
budget 300, with at most `budget * 3` relations. Truncation and unresolved facts
must not be interpreted as absence or proof of implementation.

Successful results are JSON in MCP text content, preserving API snapshot,
revision, validity and evidence fields. HTTP domain errors preserve `code`,
`message`, `status` and optional validation `issues`, with MCP `isError: true`.
Schema-invalid tool arguments are rejected by the SDK before HTTP access.
`API_UNAVAILABLE` means start/check the service and `CODEMAP_API_URL`;
`API_TIMEOUT` means the request exceeded 30 seconds. Unknown/foreign nodes and
revision/baseline conflicts are errors, not empty fabricated results.

## Verification and limitations

`npm test -- tests/integration/mcp-stdio.test.ts` compiles and starts the real HTTP
service with SQLite/indexing, then connects the installed MCP SDK 1.32.0 client to
the compiled stdio entry. It covers tool discovery, schemas, bounded queries,
HTTP approval revision/hash, draft invalidation, fresh disk checks, route/group
visibility, a concurrent partial proposal, service restart/persistence and process
cleanup. The subprocess tests use Node APIs and portable path construction.
Windows/macOS native runs and real Codex App/Claude Code connections are unrun.
On Windows, Node `child.kill("SIGTERM")` force-terminates a child; it does not
demonstrate Unix-style graceful signal handling. Stdin EOF and malformed transport
input are exercised independently of signal behavior.

### Knowledge changes and confirmation

Create groups and directory policies before confirming a plan. A meaningful group
(title, design description or membership) or directory policy (scope,
responsibility or forbidden dependencies) save creates a new revision for every
current plan in that project and requires renewed user confirmation. This also
applies to `propose_group`; Agents must re-read current plan validity after a
knowledge change. Normalized no-op saves, provenance-only changes, browse routes,
layout, theme and language do not invalidate approval.

Historical approval records and approved plan content remain available for
verification. The MVP does not reconstruct historical group/policy context;
revision invalidation protects current approval without changing the public
Plan/Approval schema or semantic hash format.
