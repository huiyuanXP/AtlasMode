# Temporary public UI demonstration — 2026-10-08 UTC

The user explicitly requested a Cloudflare-accessible example using a public medium-size repository to review the current UI. This authorizes this temporary demonstration; it does not close the existing PARTIAL gates or authorize merging main.

Product checkout: `4f04918`. Fresh seven-workspace `npm run build` passed. No product code, dependency, lockfile or vendor skill changes were needed. Earlier 541-test/7-browser and native CI results remain historical evidence, not reruns today.

Example: Flask 3.1.2, public upstream `pallets/flask`, commit `2c1b30d0503cfb064f1cb252e6614a06915a362a`, clean after demonstration. Real indexing returned 83 files, 1575 function/class nodes, 6283 relations; calls: 714 resolved, 2176 unresolved, 1029 external. No target code or upstream tests were executed.

Temporary URL: https://rating-collectible-participating-villa.trycloudflare.com

Runtime stays outside Git in `/tmp/atlasmode-public-demo`: Flask checkout, independent SQLite data, gateway, Cloudflare log and evidence. Backend loopback port 44310, gateway 44311. Cloudflare forwards only to the gateway. The gateway permits opening only the exact demo repository and rejects foreign origins. A banner labels real public source, shared demo planning data and the fact that source is not modified. The demo is unauthenticated and visitors share its state. The URL lasts only while the workspace and processes remain active; it is not a durable deployment.

Independent reviewer `/root/demo_review` identified a raw-versus-decoded route restriction bypass before the link was delivered. Fixed the temporary gateway by validating decoded canonical paths. Scoped independent re-review passed: literal/encoded project-opening requests with foreign paths denied, double encoding/backslash denied; only Flask remains registered. Public regression requests returned 403/403/403/400 for the recorded variants, and foreign Origin returned 403.

Public Chromium checks passed: automatic demo project selection, search for `full_dispatch_request`, 11-node call/context graph, actual source lines 904–920, create demo plan and add `record_request_timing` targeting `src/flask/observability.py`, verify server revision 2 and operation, light/dark switching. Page errors were empty. Source, planning and dark screenshots were opened and visually inspected in `artifacts/public-demo/`. Fresh public `/api/health` returned `{"status":"ok"}`.

The demo plan is intentionally unimplemented and unapproved. To review it, choose the existing plan in the planning tab. To inspect a meaningful existing flow, search `full_dispatch_request` or `wsgi_app`, choose the result, then expand one level. Static unknown calls stay visibly unresolved.

Existing work can continue under the standing autonomous authorization. Human feedback is most useful now for graph density/initial zoom, entry navigation and the long right-hand planning form. Remaining product scope includes the strict Express canonical entry failure, workspace/exports/references mapping, group selection/editing/collapse, file/directory drag targets, general annotation rebinding, knowledge import/backup, structure.json synchronization and incremental indexing. Actual user MCP sessions, interactive Windows Ctrl+C and fresh cloud recovery remain separate validation gaps.
