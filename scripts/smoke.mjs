import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startProduction,
  createFixtures,
  http,
  connectMcp,
} from "../tests/support/production.mjs";
const root = await mkdtemp(join(tmpdir(), "atlas-smoke-"));
let server, mcp;
try {
  const fixture = await createFixtures(root);
  server = await startProduction(join(root, "data"));
  const html = await (await fetch(server.url)).text();
  assert.match(html, /<div id="root"><\/div>/);
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(server.url + asset)).ok, true);
  mcp = await connectMcp(server.url);
  for (const path of [fixture.ts, fixture.python]) {
    const project = await http(server.url, "/api/projects", "POST", { path });
    const summary = await mcp.call("get_project_summary", {
      projectId: project.id,
    });
    assert.ok(summary.counts.functions >= 3);
    assert.ok(summary.counts.calls.unresolved >= 1);
    const search = await mcp.call("search_functions", {
      projectId: project.id,
      q: path === fixture.ts ? "caller" : "entry",
      limit: 1,
    });
    assert.equal(search.items.length, 1);
    const graph = await mcp.call("get_subgraph", {
      projectId: project.id,
      nodeIds: [search.items[0].id],
      budget: 1,
      depth: 2,
    });
    assert.equal(graph.truncated, true);
    const source = await http(
      server.url,
      `/api/projects/${project.id}/source?filePath=${search.items[0].filePath}`,
    );
    assert.ok(
      source.content.includes(
        path === fixture.ts ? "return A()" : "return helper()",
      ),
    );
  }
  await fixture.assertNotExecuted();
  assert.equal(mcp.stderr(), "");
  await mcp.client.close();
  mcp = undefined;
  const port = server.port;
  await server.stop();
  server = await startProduction(join(root, "data"), port);
  assert.equal((await http(server.url, "/api/projects")).length, 2);
  console.log(
    "PASS production assets + TS/Python HTTP/SDK browsing + no target execution + persistent restart",
  );
} finally {
  await mcp?.client.close();
  await server?.stop();
  await rm(root, { recursive: true, force: true });
}
