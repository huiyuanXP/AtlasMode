# AtlasMode contributor instructions

Read the complete README.md before changing this project. It is the product specification and phased acceptance plan.

- Current implementation includes real TS/JS indexing, SQLite, graph/knowledge/plan CRUD, human approval, baseline checks, verification, and stdio MCP. Consult docs/V1-VALIDATION.md for tested scope and limits; never claim runtime certainty or unimplemented advanced features.
- This initialization is authorized by the human. Product approval governs future modifications to the target repository; do not confuse the two.
- Future approvals bind plan ID, revision, semantic hash, and baseline. Semantic edits invalidate approval; layout edits do not. Use expectedRevision conflicts; never impersonate human approval or silently replace an approved design.
- Create workspaces only when their phase needs them. Package exports are the only cross-workspace entry points; never import another workspace's source files. Keep domain logic pure in core, transport in server, and presentation in web.
- Keep CodeSnapshot, Knowledge, PlanRevision, and ViewState distinct. Demo data is not a CodeSnapshot. Unknown evidence remains unknown; recursion is valid.
- Update .codemap/structure.json when adding directories or changing responsibilities. It also supplies internal dependency permissions to ESLint.
- Node/npm versions are pinned in .node-version and package.json. Use npm ci and the sole package-lock.json; pin direct dependencies exactly.
- Required checks: npm run typecheck, npm run lint, npm test, npm run build (or npm run check). Root commands build core before its consumers.
- npm run dev starts loopback-only web (5173) and API (4310); ports may be changed with CODEMAP_WEB_PORT/CODEMAP_PORT. Never expose the API publicly by default.
- Place unit tests beside their source. Add integration/browser suites when their phase requires them; assert real risks rather than repeating implementation.
- Keep README.md current while preserving its product specification and approval/revision semantics; preserve LICENSE. Do not commit secrets, databases, generated builds, target-repository copies, or node_modules. Do not push or publish without authorization.

See docs/environment.md for setup and docs/VM2-VALIDATION.md for initial verification. First-release work is tracked in docs/issues and GitHub issues #1–#7; retain open issues until reviewed. Advanced combinations and incremental indexing remain later work.
