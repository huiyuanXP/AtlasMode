# Round4 causal repair proposal — recorded before product mutation

Baseline fc1407b. First focused real compiled-server run: three cases, three
failures at tests/support/production.mjs:57, actual [null,SIGKILL] after
10008–10014ms. A raw TCP socket, unfinished headers, and an unfinished JSON
body each remained open. IPC disconnected 1–3ms after stop, establishing that
the preload emitted the installed shutdown handler. Native Fastify shutdown
waits server.close; these unfinished sockets are not removed by its idle-close
behavior. No application operation was submitted by these connections. Their
presence is a demonstrated shutdown fault class, not proof of the original
browser failure's unrecorded connection state or stalled phase.

Minimal proposal: apps/server/src/server.ts owns a native socket map with
pending request/response lifetimes. At Fastify preClose (routes have entered
closing state), terminate only sockets lacking any fully received request
with a pending response. Preserve sockets carrying such work, including a
completed first pipelined request followed by incomplete bytes. Reassess when
a pending response finishes/closes so incomplete trailing bytes cannot keep
shutdown alive after accepted work drains. Handle late connection events in
closing state. No request timeout, global forced-close option, route/service
change, dependency or indexer change. Keep index.ts await app.close before
storage.close unchanged.

Verification additions stay in the one focused lifecycle test file: use real
createServer + WorkspaceService + SqliteStorage + SourceIndexer with an indexer
port wrapper that defers the real operation behind an explicit gate (no target
execution). Submit complete HTTP request then partial pipelined bytes on the
same socket, enter close, assert no response/close while the work is held,
release the gate and assert HTTP200 plus persisted project/snapshot after
closing/reopening SQLite. Include full parsed-body semantics and a delay beyond
6s for the legitimate operation if controller scope allows. These guard against
blind close-all/short timeout or closing SQLite before accepted work finishes.
Run focused build/type/lint/lifecycle after product change; request controller
scope before any root/planning rerun. Original I1 remains OPEN pending review.
