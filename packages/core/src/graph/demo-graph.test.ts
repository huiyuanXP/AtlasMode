import { describe, expect, it } from 'vitest';
import { DemoGraphSchema } from './demo-graph.js';

function graph() {
  return {
    source: 'demo',
    nodes: [
      { id: 'demo:file', kind: 'file', path: 'src/service.ts' },
      {
        id: 'demo:fn',
        kind: 'function',
        name: 'run',
        fileId: 'demo:file',
        signature: 'run(): void',
      },
    ],
    relations: [
      { id: 'demo:call', source: 'demo:fn', target: 'demo:fn', type: 'calls' },
    ],
  };
}

describe('demo graph integrity', () => {
  it('permits recursive calls rather than treating every cycle as invalid', () => {
    expect(DemoGraphSchema.safeParse(graph()).success).toBe(true);
  });
  it('rejects a dangling call endpoint', () => {
    const input = graph();
    input.relations[0]!.target = 'demo:missing';
    expect(DemoGraphSchema.safeParse(input).success).toBe(false);
  });
  it('rejects a function without file ownership', () => {
    const input = graph();
    input.nodes[1]!.fileId = 'demo:missing';
    expect(DemoGraphSchema.safeParse(input).success).toBe(false);
  });
  it('rejects calls to a file frame', () => {
    const input = graph();
    input.relations[0]!.target = 'demo:file';
    expect(DemoGraphSchema.safeParse(input).success).toBe(false);
  });
  it('rejects duplicate node and relation IDs', () => {
    const input = graph();
    input.nodes.push(input.nodes[0]!);
    input.relations.push(input.relations[0]!);
    const result = DemoGraphSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toHaveLength(2);
  });
  it('rejects contains relationships that contradict file ownership', () => {
    const input = graph();
    input.nodes.push({
      id: 'demo:other-file',
      kind: 'file',
      path: 'src/other.ts',
    });
    input.relations = [
      {
        id: 'demo:contains',
        source: 'demo:other-file',
        target: 'demo:fn',
        type: 'contains',
      },
    ];
    expect(DemoGraphSchema.safeParse(input).success).toBe(false);
  });
  it.each([
    '/etc/passwd',
    '../escape.ts',
    'src/../escape.ts',
    'C:\\escape.ts',
    'src//file.ts',
  ])('rejects invalid repository-relative path %s', (path) => {
    const input = graph();
    input.nodes[0]!.path = path;
    expect(DemoGraphSchema.safeParse(input).success).toBe(false);
  });
  it('rejects data claiming real code provenance or approval', () => {
    expect(
      DemoGraphSchema.safeParse({ ...graph(), source: 'code' }).success,
    ).toBe(false);
    expect(
      DemoGraphSchema.safeParse({ ...graph(), approved: true }).success,
    ).toBe(false);
  });
});
