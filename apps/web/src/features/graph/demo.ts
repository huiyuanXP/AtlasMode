import { DemoGraphSchema } from '@codemap/core';

export const demoGraph = DemoGraphSchema.parse({
  source: 'demo',
  nodes: [
    { id: 'demo:notes-file', kind: 'file', path: 'src/services/notes.ts' },
    { id: 'demo:http-file', kind: 'file', path: 'src/http/request.ts' },
    {
      id: 'demo:fetch-notes',
      kind: 'function',
      name: 'fetchNotes',
      fileId: 'demo:notes-file',
      signature: 'fetchNotes(): Promise<Note[]>',
    },
    {
      id: 'demo:request-retry',
      kind: 'function',
      name: 'requestWithRetry',
      fileId: 'demo:http-file',
      signature: 'requestWithRetry(url: string): Promise<Response>',
    },
  ],
  relations: [
    {
      id: 'demo:notes-call',
      source: 'demo:fetch-notes',
      target: 'demo:request-retry',
      type: 'calls',
    },
  ],
});
