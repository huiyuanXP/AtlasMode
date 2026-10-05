import { pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  PlanInputSchema,
  AnnotationInputSchema,
  GroupInputSchema,
  PolicyInputSchema,
  ViewInputSchema,
  KnowledgeExportSchema,
} from '@codemap/core';

export function apiAddress(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('CODEMAP_API_URL must be a plain loopback HTTP origin');
  return url.origin;
}
export function createMcpServer(apiUrl = 'http://127.0.0.1:4310') {
  const origin = apiAddress(apiUrl);
  const server = new Server(
    { name: 'atlasmode', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
  const registry = new Map<
    string,
    {
      name: string;
      description: string;
      inputSchema: { type: 'object'; [key: string]: unknown };
      annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        openWorldHint: boolean;
      };
      invoke: (args: unknown) => Promise<unknown>;
    }
  >();
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...registry.values()].map((item) => ({
      name: item.name,
      description: item.description,
      inputSchema: item.inputSchema,
      annotations: item.annotations,
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const registered = registry.get(request.params.name);
      if (!registered) throw new Error('Unknown tool');
      const result = await registered.invoke(request.params.arguments ?? {});
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text:
              error instanceof Error ? error.message : 'Tool operation failed',
          },
        ],
      };
    }
  });
  const http = async (method: string, pathname: string, body?: unknown) => {
    const response = await fetch(origin + pathname, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(120000),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const error = result as { message?: string; code?: string };
      throw new Error(
        `${response.status} ${error.code ?? 'API_ERROR'}: ${error.message ?? 'Request failed'}`,
      );
    }
    return result;
  };
  function tool<S extends z.ZodType>(
    name: string,
    description: string,
    schema: S,
    handler: (args: z.output<S>) => Promise<unknown>,
    readOnly = true,
  ) {
    registry.set(name, {
      name,
      description,
      inputSchema: z.toJSONSchema(schema) as {
        type: 'object';
        [key: string]: unknown;
      },
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: !readOnly,
        openWorldHint: false,
      },
      invoke: (args) => handler(schema.parse(args)),
    });
  }
  const empty = z.object({}).strict();
  const paging = z
    .object({
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict();
  const identify = z.object({ id: z.string().min(1).max(256) }).strict();
  const revision = identify
    .extend({ expectedRevision: z.number().int().positive() })
    .strict();
  const idPath = (id: string) => encodeURIComponent(id);
  tool(
    'get_project_summary',
    'Current real-code snapshot, coverage and unresolved counts',
    empty,
    () => http('GET', '/api/project'),
  );
  tool(
    'search_functions',
    'Paginated real function search by name or path',
    paging.extend({ query: z.string().max(500).default('') }),
    (args) =>
      http(
        'GET',
        `/api/functions?query=${encodeURIComponent(args.query)}&offset=${args.offset}&limit=${args.limit}`,
      ),
  );
  tool(
    'get_function_context',
    'Bounded caller/callee context with source evidence and unknowns',
    identify.extend({ limit: z.number().int().min(1).max(200).default(50) }),
    (args) =>
      http('GET', `/api/functions/${idPath(args.id)}?limit=${args.limit}`),
  );
  tool(
    'get_subgraph',
    'Budgeted code graph with snapshot/source/unresolved provenance',
    z
      .object({
        seeds: z.array(z.string()).max(50).default([]),
        depth: z.number().int().min(0).max(3).default(1),
        budget: z.number().int().min(5).max(200).default(100),
        types: z.array(z.enum(['calls', 'imports', 'contains'])).optional(),
      })
      .strict(),
    (args) => http('POST', '/api/graph', args),
  );
  tool(
    'refresh_index',
    'Rescan only the server-configured authorized repository; preserves knowledge',
    empty,
    () => http('POST', '/api/index/refresh', {}),
    false,
  );
  const propose = PlanInputSchema.omit({ source: true }).strict();
  tool(
    'propose_plan',
    'Create an Agent draft against an explicit snapshot; does not approve or edit source',
    propose,
    (args) => http('POST', '/api/plans', { ...args, source: 'agent' }),
    false,
  );
  tool(
    'update_plan',
    'Create a new semantic revision and invalidate old approval; expectedRevision is required',
    revision.extend({ data: propose }).strict(),
    (args) =>
      http('PUT', `/api/plans/${idPath(args.id)}`, {
        expectedRevision: args.expectedRevision,
        data: { ...args.data, source: 'agent' },
      }),
    false,
  );
  tool('get_plan', 'Read the exact current plan revision', identify, (args) =>
    http('GET', `/api/plans/${idPath(args.id)}`),
  );
  tool('list_plans', 'Paginated plan listing', paging, (args) =>
    http('GET', `/api/plans?offset=${args.offset}&limit=${args.limit}`),
  );
  tool(
    'delete_plan',
    'Cancel a plan while retaining immutable semantic revision history',
    revision,
    (args) =>
      http('DELETE', `/api/plans/${idPath(args.id)}`, {
        expectedRevision: args.expectedRevision,
      }),
    false,
  );
  tool(
    'get_plan_history',
    'Paginated plan history',
    identify.extend(paging.shape).strict(),
    (args) =>
      http(
        'GET',
        `/api/plans/${idPath(args.id)}/history?offset=${args.offset}&limit=${args.limit}`,
      ),
  );
  tool(
    'validate_plan',
    'Validate references, typed changes, explicit constraints and current baseline',
    revision,
    (args) =>
      http('POST', `/api/plans/${idPath(args.id)}/validate`, {
        expectedRevision: args.expectedRevision,
      }),
    false,
  );
  tool(
    'get_approved_plan',
    'Read human-approved revision/hash and current working-tree validity; no approval authority',
    identify,
    (args) => http('GET', `/api/plans/${idPath(args.id)}/approved`),
  );
  tool(
    'begin_implementation',
    'Mark implementing only when the exact human approval and baseline are valid',
    revision,
    (args) =>
      http('POST', `/api/plans/${idPath(args.id)}/implement`, {
        expectedRevision: args.expectedRevision,
      }),
    false,
  );
  tool(
    'verify_implementation',
    'Rescan real code and compare against the exact approved revision with evidence',
    identify,
    (args) => http('POST', `/api/plans/${idPath(args.id)}/verify`, {}),
    false,
  );
  tool(
    'get_verification',
    'Read evidence-based verification, retaining unknowns and behavior-test limits',
    identify,
    (args) => http('GET', `/api/verifications/${idPath(args.id)}`),
  );
  const resources = [
    ['annotation', 'annotations', AnnotationInputSchema],
    ['group', 'groups', GroupInputSchema],
    ['folder_policy', 'policies', PolicyInputSchema],
    ['view', 'views', ViewInputSchema],
  ] as const;
  for (const [name, plural, schema] of resources) {
    const agentData = (data: unknown) =>
      name === 'annotation' || name === 'group'
        ? { ...(data as Record<string, unknown>), source: 'agent' }
        : data;
    tool(
      `list_${plural}`,
      `Paginated ${plural} including orphan references`,
      paging,
      (args) =>
        http('GET', `/api/${plural}?offset=${args.offset}&limit=${args.limit}`),
    );
    tool(`get_${name}`, `Read a ${name}`, identify, (args) =>
      http('GET', `/api/${plural}/${idPath(args.id)}`),
    );
    tool(
      `create_${name}`,
      `Create ${name}; Agent provenance is enforced`,
      z.object({ data: schema }).strict(),
      (args) => http('POST', `/api/${plural}`, agentData(args.data)),
      false,
    );
    tool(
      `update_${name}`,
      `Update ${name} with optimistic concurrency`,
      revision.extend({ data: schema }).strict(),
      (args) =>
        http('PUT', `/api/${plural}/${idPath(args.id)}`, {
          expectedRevision: args.expectedRevision,
          data: agentData(args.data),
        }),
      false,
    );
    tool(
      `delete_${name}`,
      `Delete ${name} with optimistic concurrency; never edits code`,
      revision,
      (args) =>
        http('DELETE', `/api/${plural}/${idPath(args.id)}`, {
          expectedRevision: args.expectedRevision,
        }),
      false,
    );
  }
  tool(
    'get_identity_candidates',
    'Paginated rename/move candidates; never silently rebinds knowledge',
    paging,
    (args) =>
      http('GET', `/api/identity?offset=${args.offset}&limit=${args.limit}`),
  );
  tool(
    'get_groups',
    'Paginated capability groups; membership does not move files',
    paging,
    (args) =>
      http('GET', `/api/groups?offset=${args.offset}&limit=${args.limit}`),
  );
  tool(
    'get_folder_policies',
    'Paginated explicit directory dependency policies',
    paging,
    (args) =>
      http('GET', `/api/policies?offset=${args.offset}&limit=${args.limit}`),
  );
  tool(
    'propose_group',
    'Create an Agent capability group with explicit member IDs',
    GroupInputSchema.omit({ source: true }).strict(),
    (args) => http('POST', '/api/groups', { ...args, source: 'agent' }),
    false,
  );
  tool(
    'export_knowledge',
    'Export versioned knowledge without source copies or secrets',
    empty,
    () => http('GET', '/api/knowledge/export'),
    false,
  );
  tool(
    'preview_knowledge_import',
    'Preview all conflicting records before import',
    z.object({ data: KnowledgeExportSchema }).strict(),
    (args) => http('POST', '/api/knowledge/import/preview', args.data),
  );
  tool(
    'import_knowledge',
    'Apply a still-current preview; replacement of conflicts must be explicit',
    z
      .object({
        data: KnowledgeExportSchema,
        previewToken: z.string(),
        replaceConflicts: z.boolean().default(false),
      })
      .strict(),
    (args) => http('POST', '/api/knowledge/import', args),
    false,
  );
  tool(
    'backup_storage',
    'Create a consistent SQLite backup in the configured local data directory',
    empty,
    () => http('POST', '/api/storage/backup', {}),
    false,
  );
  return server;
}
async function main() {
  const url =
    process.env.CODEMAP_API_URL ??
    `http://127.0.0.1:${process.env.CODEMAP_PORT ?? '4310'}`;
  const server = createMcpServer(url);
  await server.connect(new StdioServerTransport());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'MCP startup failed',
    );
    process.exitCode = 1;
  });
