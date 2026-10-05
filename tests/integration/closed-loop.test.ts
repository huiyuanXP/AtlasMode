import { cp, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRuntime, createServer } from '@codemap/server';
import { PlanSchema, CodeNodeSchema } from '@codemap/core';
import type { FunctionNode, PlanRevision, PlanInput } from '@codemap/core';

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'atlasmode-loop-'));
  const root = path.join(directory, 'repo');
  await cp(
    fileURLToPath(new URL('../../fixtures/approval-loop/', import.meta.url)),
    root,
    { recursive: true },
  );
  return { directory, root, data: path.join(directory, 'data') };
}
function payload(plan: PlanRevision): PlanInput {
  return {
    baselineSnapshotId: plan.baselineSnapshotId,
    title: plan.title,
    reason: plan.reason,
    source: plan.source,
    changes: plan.changes,
    requirements: plan.requirements,
  };
}

describe('real API, SQLite and stdio MCP closed loop', () => {
  it('shares the exact approved revision, retains knowledge/layout/history, detects stale baselines and verifies bypassed calls', async () => {
    const location = await fixture();
    let app = createServer(await createRuntime(location.root, location.data));
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const client = new Client({
      name: 'atlasmode-validation',
      version: '1.0.0',
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        fileURLToPath(new URL('../../apps/mcp/dist/index.js', import.meta.url)),
      ],
      env: { CODEMAP_API_URL: address },
      stderr: 'pipe',
    });
    try {
      await client.connect(transport);
      const available = await client.listTools();
      expect(available.tools.map((tool) => tool.name)).toContain(
        'propose_plan',
      );
      expect(
        available.tools.some(
          (tool) =>
            tool.name.includes('approve') && !tool.name.startsWith('get_'),
        ),
      ).toBe(false);
      const tool = async (name: string, args: Record<string, unknown> = {}) => {
        const response = await client.callTool({ name, arguments: args });
        if (response.isError) throw new Error(JSON.stringify(response.content));
        const content = response.content as { type: string; text?: string }[];
        return JSON.parse(content[0]!.text!);
      };
      const summary = await tool('get_project_summary');
      expect(summary.source).toBe('code');
      expect(summary.counts.functions).toBe(2);
      const search = await tool('search_functions', {
        query: 'requestWithRetry',
        limit: 5,
      });
      const retry = CodeNodeSchema.parse(search.items[0]) as FunctionNode;
      const graph = await tool('get_subgraph', {
        seeds: [retry.id],
        budget: 5,
        depth: 1,
      });
      expect(graph.nodes.length).toBeLessThanOrEqual(5);
      expect(graph.source).toBe('code');
      const proposed = PlanSchema.parse(
        await tool('propose_plan', {
          baselineSnapshotId: summary.snapshotId,
          title: 'Fetch notes with approved retry abstraction',
          reason: 'Reuse the existing HTTP abstraction',
          changes: [
            {
              op: 'add_function',
              id: 'plan:fetch',
              name: 'fetchNotes',
              signature: '() => string',
              filePath: 'src/old-notes.ts',
            },
            {
              op: 'add_function',
              id: 'plan:helper',
              name: 'requestHelper',
              signature: '() => string',
              filePath: 'src/helper.ts',
            },
            {
              op: 'add_call',
              id: 'plan:call',
              source: 'plan:fetch',
              target: 'plan:helper',
            },
          ],
          requirements: [],
        }),
      );
      const changes: PlanInput['changes'] = [
        {
          op: 'add_function',
          id: 'plan:fetch',
          name: 'fetchNotes',
          signature: '() => string',
          filePath: 'src/services/notes.ts',
        },
        {
          op: 'add_call',
          id: 'plan:call',
          source: 'plan:fetch',
          target: retry.id,
        },
      ];
      const edited = PlanSchema.parse(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/plans/${encodeURIComponent(proposed.id)}`,
            payload: {
              expectedRevision: 1,
              data: {
                ...payload(proposed),
                changes,
                requirements: [
                  {
                    type: 'must_call',
                    nodeId: 'plan:fetch',
                    target: retry.id,
                    reason: 'Use requestWithRetry',
                  },
                ],
              },
            },
          })
        ).json(),
      );
      expect(edited.revision).toBe(2);
      expect(edited.approval).toBeNull();
      const conflict = await app.inject({
        method: 'PUT',
        url: `/api/plans/${encodeURIComponent(proposed.id)}`,
        payload: { expectedRevision: 1, data: payload(edited) },
      });
      expect(conflict.statusCode).toBe(409);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/plans/${encodeURIComponent(edited.id)}/approve`,
            payload: {
              expectedRevision: 2,
              semanticHash: edited.semanticHash,
              approved: true,
            },
          })
        ).statusCode,
      ).toBe(403);
      const token = (await app.inject({ url: '/api/ui/session' })).json()
        .approvalToken;
      const approve = async (plan: PlanRevision) =>
        app.inject({
          method: 'POST',
          url: `/api/plans/${encodeURIComponent(plan.id)}/approve`,
          headers: { 'x-atlasmode-ui-token': token },
          payload: {
            expectedRevision: plan.revision,
            semanticHash: plan.semanticHash,
          },
        });
      expect((await approve(edited)).statusCode).toBe(200);
      const approved = await tool('get_approved_plan', { id: edited.id });
      expect(approved.valid).toBe(true);
      expect(approved.plan.revision).toBe(2);
      expect(
        approved.plan.changes.find(
          (change: { op: string }) => change.op === 'add_call',
        ).target,
      ).toBe(retry.id);
      const annotation = await tool('create_annotation', {
        data: {
          targetId: retry.id,
          text: 'Always reuse this retry entry',
          constraint: true,
          source: 'user',
        },
      });
      expect(annotation.source).toBe('agent');
      const group = await tool('propose_group', {
        name: 'Networking',
        members: [retry.id],
        description: 'Reusable retry capability',
        type: 'capability',
        guidance: 'reference',
      });
      expect(group.source).toBe('agent');
      await tool('create_view', {
        data: {
          positions: { [retry.id]: { x: 70, y: 90 } },
          collapsed: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      });
      expect((await tool('get_approved_plan', { id: edited.id })).valid).toBe(
        true,
      );
      const semantics = PlanSchema.parse(
        await tool('update_plan', {
          id: edited.id,
          expectedRevision: 2,
          data: {
            ...payload(edited),
            source: undefined,
            title: 'Updated semantic title',
          },
        }),
      );
      expect(semantics.revision).toBe(3);
      expect(semantics.approval).toBeNull();
      expect((await tool('get_approved_plan', { id: edited.id })).valid).toBe(
        false,
      );
      expect((await approve(semantics)).statusCode).toBe(200);
      await tool('begin_implementation', {
        id: edited.id,
        expectedRevision: 3,
      });
      await mkdir(path.join(location.root, 'src/services'));
      await writeFile(
        path.join(location.root, 'src/services/notes.ts'),
        "import { requestWithRetry } from '../request.js';\nexport function fetchNotes(): string { return requestWithRetry('/notes'); }\n",
      );
      expect((await tool('get_approved_plan', { id: edited.id })).valid).toBe(
        false,
      );
      const good = await tool('verify_implementation', { id: edited.id });
      expect(
        good.items
          .filter((item: { description: string }) =>
            item.description.startsWith('Required call:'),
          )
          .every((item: { status: string }) => item.status === 'satisfied'),
      ).toBe(true);
      expect(good.behaviorVerified).toBe(false);
      await writeFile(
        path.join(location.root, 'src/services/notes.ts'),
        "import { lowLevelRequest } from '../request.js';\nexport function fetchNotes(): string { return lowLevelRequest('/notes'); }\n",
      );
      const bypass = await tool('verify_implementation', { id: edited.id });
      expect(
        bypass.items.some(
          (item: { description: string; status: string }) =>
            item.description.startsWith('must_call:') &&
            item.status === 'unsatisfied',
        ),
      ).toBe(true);
      const exported = await tool('export_knowledge');
      const preview = await tool('preview_knowledge_import', {
        data: exported,
      });
      expect(preview.conflicts.length).toBe(2);
      const rejected = await client.callTool({
        name: 'import_knowledge',
        arguments: {
          data: exported,
          previewToken: preview.previewToken,
          replaceConflicts: false,
        },
      });
      expect(rejected.isError).toBe(true);
      const policy = await tool('create_folder_policy', {
        data: {
          path: 'src/services',
          purpose: 'Service orchestration',
          allowedDependencies: [],
          forbiddenDependencies: ['src/forbidden'],
          exceptions: [],
        },
      });
      expect(policy.revision).toBe(1);
      expect(await tool('backup_storage')).toHaveProperty('filename');
      await client.close();
      await app.close();
      app = createServer(await createRuntime(location.root, location.data));
      expect(
        (await app.inject({ url: '/api/annotations' })).json().items[0].text,
      ).toBe(annotation.text);
      expect(
        (await app.inject({ url: '/api/groups' })).json().items[0].members,
      ).toEqual([retry.id]);
      expect(
        (await app.inject({ url: '/api/views/workspace' })).json().positions[
          retry.id
        ],
      ).toEqual({ x: 70, y: 90 });
      expect(
        (
          await app.inject({
            url: `/api/plans/${encodeURIComponent(edited.id)}/history`,
          })
        ).json().items,
      ).toHaveLength(3);
      expect(
        (await app.inject({ url: '/api/verifications' })).json().items,
      ).toHaveLength(2);
      await rm(path.join(location.root, 'src/request.ts'));
      await app.inject({ method: 'POST', url: '/api/index/refresh' });
      expect(
        (await app.inject({ url: '/api/annotations' })).json().items[0].binding,
      ).toBe('orphaned');
      expect(
        (await app.inject({ url: '/api/groups' })).json().items[0]
          .orphanedMembers,
      ).toContain(retry.id);
    } finally {
      await client.close();
      await app.close();
      await rm(location.directory, { recursive: true, force: true });
    }
  });
  it('keeps rename candidates unbound until a human confirms a persisted migration, and restores old snapshots when content reverts', async () => {
    const location = await fixture();
    let app = createServer(await createRuntime(location.root, location.data));
    try {
      const original = (await app.inject({ url: '/api/project' })).json();
      const fn = (
        await app.inject({ url: '/api/functions?query=requestWithRetry' })
      ).json().items[0];
      const annotation = (
        await app.inject({
          method: 'POST',
          url: '/api/annotations',
          payload: {
            targetId: fn.id,
            text: 'Preserve across identity migration',
            source: 'user',
            constraint: false,
          },
        })
      ).json();
      const group = (
        await app.inject({
          method: 'POST',
          url: '/api/groups',
          payload: {
            name: 'Retry',
            type: 'capability',
            members: [fn.id],
            description: 'Shared entry',
            source: 'user',
            guidance: 'reference',
          },
        })
      ).json();
      const filename = path.join(location.root, 'src/request.ts'),
        source = await import('node:fs/promises').then((fs) =>
          fs.readFile(filename, 'utf8'),
        );
      await writeFile(filename, source + '\n');
      await app.inject({ method: 'POST', url: '/api/index/refresh' });
      expect(
        (await app.inject({ url: '/api/project' })).json().snapshotId,
      ).not.toBe(original.snapshotId);
      await writeFile(filename, source);
      await app.inject({ method: 'POST', url: '/api/index/refresh' });
      expect(
        (await app.inject({ url: '/api/project' })).json().snapshotId,
      ).toBe(original.snapshotId);
      await writeFile(
        filename,
        source.replace('requestWithRetry', 'retryRequest'),
      );
      await app.inject({ method: 'POST', url: '/api/index/refresh' });
      expect(
        (await app.inject({ url: '/api/annotations' })).json().items[0].binding,
      ).toBe('orphaned');
      const identities = (await app.inject({ url: '/api/identity' })).json(),
        candidate = identities.candidates.find(
          (item: { previous: { id: string } }) => item.previous.id === fn.id,
        );
      expect(candidate).toBeDefined();
      const body = {
        previousId: fn.id,
        currentId: candidate.candidate.id,
        expectedRevision: identities.revision,
      };
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/identity/confirm',
            payload: body,
          })
        ).statusCode,
      ).toBe(403);
      const token = (await app.inject({ url: '/api/ui/session' })).json()
        .approvalToken;
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/identity/confirm',
            headers: { 'x-atlasmode-ui-token': token },
            payload: body,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            url: '/api/annotations/' + encodeURIComponent(annotation.id),
          })
        ).json().targetId,
      ).toBe(candidate.candidate.id);
      expect(
        (
          await app.inject({
            url: '/api/groups/' + encodeURIComponent(group.id),
          })
        ).json().members,
      ).toEqual([candidate.candidate.id]);
      await app.close();
      app = createServer(await createRuntime(location.root, location.data));
      expect(
        (await app.inject({ url: '/api/identity' })).json().confirmed[0]
          .currentId,
      ).toBe(candidate.candidate.id);
    } finally {
      await app.close();
      await rm(location.directory, { recursive: true, force: true });
    }
  });
});
