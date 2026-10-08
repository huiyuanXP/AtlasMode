import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startProduction, createFixtures, http } from '../tests/support/production.mjs';

// Connection acceptance uses the real compiled product and disposable source/data.
// No model, user client configuration, or target repository execution is involved.
const root = await mkdtemp(join(tmpdir(), 'atlas-mcp-connection-'));
let server;
const connections = [];
async function connect(env = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('apps/mcp/dist/index.js')],
    env: { CODEMAP_API_URL: server.url, ...env },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk; });
  const client = new Client({ name: 'atlasmode-connection-test', version: '1.0.0' });
  connections.push({ client, transport });
  await client.connect(transport);
  return {
    client, stderr: () => stderr,
    call: async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse(result.content[0].text);
    },
  };
}
try {
  const fixture = await createFixtures(root);
  server = await startProduction(join(root, 'data'));
  const a = await http(server.url, '/api/projects', 'POST', { path: fixture.ts });
  const b = await http(server.url, '/api/projects', 'POST', { path: fixture.python });
  const generic = await connect();
  const tools = await generic.client.listTools();
  assert.equal(tools.tools.length, 16);
  assert(!tools.tools.some(t => /approve/.test(t.name) && t.name !== 'get_approved_plan'));
  const summary = await generic.call('get_project_summary', { projectId: a.id });
  const found = await generic.call('search_functions', { projectId: a.id, q: 'caller' });
  const caller = found.items.find(n => n.name === 'caller');
  assert(caller);
  const context = await generic.call('get_function_context', { projectId: a.id, nodeId: caller.id });
  assert.equal(context.node.id, caller.id);
  const scoped = await connect({ CODEMAP_MCP_PROJECT_ID: a.id, CODEMAP_MCP_CHANNEL: 'plan' });
  assert.equal((await scoped.client.listTools()).tools.length, 18);
  const projects = await scoped.call('list_projects', {});
  assert.deepEqual(projects.items.map(p => p.id), [a.id]);
  const plan = await scoped.call('propose_plan', {
    projectId: a.id, title: 'MCP connection test', baselineSnapshotId: summary.snapshotId,
    operations: [{ kind: 'add_function', tempId: 'connection:new', name: 'connectionExample', filePath: 'connection.ts', language: 'typescript', signature: 'export function connectionExample()', description: 'Disposable connection test; no source implementation.' }],
  });
  assert.equal(plan.plan.status, 'draft');
  assert.equal(plan.valid, false);
  const updated = await scoped.call('update_plan', {
    projectId: a.id, planId: plan.plan.id, expectedRevision: plan.plan.revision,
    operations: plan.plan.operations, title: 'Updated connection test',
  });
  const web = await http(server.url, `/api/plans/${plan.plan.id}`);
  assert.equal(web.plan.revision, updated.plan.revision);
  assert.deepEqual(web.plan.operations, updated.plan.operations);
  const conflict = await scoped.client.callTool({ name: 'update_plan', arguments: {
    projectId: a.id, planId: plan.plan.id, expectedRevision: plan.plan.revision,
    operations: [],
  } });
  assert.equal(conflict.isError, true);
  assert.equal(JSON.parse(conflict.content[0].text).code, 'REVISION_CONFLICT');
  const foreign = await scoped.client.callTool({ name: 'get_project_summary', arguments: { projectId: b.id } });
  assert.equal(foreign.isError, true);
  assert.equal((await http(server.url, `/api/projects/${b.id}/plans`)).length, 0);
  await fixture.assertNotExecuted();
  assert.equal(generic.stderr(), '');
  assert.equal(scoped.stderr(), '');
  console.log(JSON.stringify({ result: 'PASS', transport: 'real SDK stdio → compiled HTTP → SQLite', genericTools: 16, scopedTools: 18, revision: updated.plan.revision, draftOnly: true, targetExecuted: false }));
} catch (error) {
  console.error(`MCP connection test FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const { client, transport } of connections.reverse()) {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
  try { await server?.stop(); } finally { await rm(root, { recursive: true, force: true }); }
}
