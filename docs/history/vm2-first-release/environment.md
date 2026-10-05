> Historical report from main b87644f. Superseded by the active work implementation and docs/superpowers/state.md. Its API, counts and runtime pins are not current.

# Runtime and usage

Validated on ssh-vm-2 with Node **24.21.0**, npm **11.19.0**, and TypeScript **6.0.3**. Node is installed under `/home/agent/.node/node-v24.21.0-linux-x64`; executable links in `/home/agent/.local/bin` are already on PATH. The archive SHA256 was verified during initialization. Runtime versions and exact direct dependencies are pinned; `package-lock.json` is the sole lock.

```sh
cd /home/agent/projects/AtlasMode
npm ci
npm run check
npm run dev
```

Default web/API: `http://127.0.0.1:5173` / `http://127.0.0.1:4310`. Startup automatically indexes this repository. Vite development and local production preview proxy `/api` to loopback. All service listeners remain on `127.0.0.1`.

```sh
CODEMAP_WORKSPACE_ROOT=/absolute/path/to/authorized/repository \
CODEMAP_DATA_DIR=/absolute/path/to/its/private-data \
CODEMAP_PORT=14310 CODEMAP_WEB_PORT=15173 npm run dev
```

The target root is fixed at startup and cannot be replaced through an API/MCP request. Data defaults to `<target>/.codemap/cache/atlasmode.sqlite`; a data directory cannot silently be reused for another root. `.env.example` is descriptive: export variables in the shell, as no dotenv loader is installed. Index refresh is explicit after startup; continuous watching is not implemented.

`npm run check` covers typechecking (including tests), lint/format, unit/integration tests, and production builds. Internal packages build before consumers. `npm run dev` supervises backend compiler watchers, API, and web. The compiled API can run with `npm run start --workspace @codemap/server`; built web assets use `npm run preview --workspace @codemap/web` for local preview.

## MCP

Official SDK **1.32.0** and Zod **4.6.5** are locked. The stable v1 official server/stdio documentation was consulted; the implementation uses the SDK Server/stdio APIs and real official Client integration tests. MCP only accesses the same loopback HTTP service. No database is duplicated and no approval tool is exposed.

Build first, start the API, then configure an external Agent to launch:

```json
{
  "mcpServers": {
    "atlasmode": {
      "command": "/home/agent/.local/bin/node",
      "args": ["/home/agent/projects/AtlasMode/apps/mcp/dist/index.js"],
      "env": { "CODEMAP_API_URL": "http://127.0.0.1:4310" }
    }
  }
}
```

For manual launch: `npm run --silent mcp`. Use direct `node` in protocol client configuration: ordinary npm banners would contaminate stdout. MCP stdout is protocol only; errors go to stderr. Remote or credential-bearing API URLs are rejected. No model/provider API key is required.

Tools cover bounded project/function/graph/group/policy queries, plan create/read/update/cancel/history/validate/approved-version reads, implementation start/verification, annotation/group/policy/view CRUD, identity candidates, knowledge export/import preview/apply, and SQLite backup. Agent-created annotations/groups/plans enforce Agent provenance. User approval and identity confirmation require the local UI flow.

## Storage, scanning and validation

SQLite uses better-sqlite3 **13.0.3**, verified with native installation, transactions, restart and backup tests. Numbered migration 001 is checksum checked. Backups remain in the configured data directory. Knowledge export writes `<target>/.codemap/knowledge.json`; policy CRUD atomically mirrors policies into `<target>/.codemap/structure.json` while preserving its other fields. Import requires a still-current preview and explicit conflict replacement.

The indexer uses ts-morph **28.0.0**, TypeScript symbols, and bounded native directory traversal with ignore **7.0.12**. fast-glob was removed after an unpatched dependency advisory; see [decision 001](001-native-scanning.md). It does not traverse symlinks, excludes dependency/build/cache directories and repository ignore rules, and records scope/diagnostics. Budgets: 100,000 visited entries, 20,000 source files, 40 MiB of source/configuration data. Exceeding a budget fails explicitly. Git revision and content/configuration hashes capture uncommitted changes within the indexed scope.

```sh
npx playwright install chromium
# If a fresh VM needs system libraries:
npx playwright install-deps chromium
npm run test:e2e
```

The E2E harness creates a small disposable fixture under ignored `artifacts/`, starts loopback services on 4311/5174, and cleans up the processes. It tests actual edits/approval/API/MCP/evidence rather than screenshot existence. Browser screenshots, traces and HTML reports are under `artifacts/`.

See [V1-VALIDATION.md](V1-VALIDATION.md). The original [VM2 report](VM2-VALIDATION.md) is historical P0 evidence, not the current feature description.
