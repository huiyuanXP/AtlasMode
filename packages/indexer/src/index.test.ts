import {
  mkdtemp,
  cp,
  readFile,
  writeFile,
  mkdir,
  symlink,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { TypeScriptIndexer } from './index.js';
const temporary: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'atlasmode-index-'));
  temporary.push(root);
  await cp(
    fileURLToPath(new URL('../../../fixtures/cross-file/', import.meta.url)),
    root,
    { recursive: true },
  );
  return root;
}
afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});
describe('real TypeScript indexer', () => {
  it('resolves re-exports, aliases, JS/TSX, methods and recursion while retaining dynamic unknowns', async () => {
    const root = await fixture(),
      snapshot = await new TypeScriptIndexer(root).scan();
    const functions = snapshot.nodes.filter((node) => node.kind === 'function');
    const fn = (name: string) =>
      functions.find((node) => node.qualifiedName === name)!;
    const calls = (source: string, target: string) =>
      snapshot.relations.some(
        (relation) =>
          relation.type === 'calls' &&
          relation.source === fn(source).id &&
          relation.target === fn(target).id,
      );
    expect(calls('fetchNotes', 'requestWithRetry')).toBe(true);
    expect(calls('jsFetch', 'requestWithRetry')).toBe(true);
    expect(calls('NotesView', 'fetchNotes')).toBe(true);
    expect(calls('NotesService.fetch', 'lowLevelRequest')).toBe(true);
    expect(calls('recursive', 'recursive')).toBe(true);
    expect(calls('aliasCaller', 'requestWithRetry')).toBe(true);
    expect(calls('constructorCaller', 'WithConstructor.constructor')).toBe(
      true,
    );
    expect(calls('constructorCaller', 'WithConstructor.handler')).toBe(true);
    expect(
      snapshot.relations.some(
        (relation) =>
          relation.source === fn('dynamicTyped').id &&
          relation.expression === 'target' &&
          relation.resolution === 'unresolved',
      ),
    ).toBe(true);
    expect(
      snapshot.relations.some(
        (relation) =>
          relation.source === fn('dynamicCall').id &&
          relation.expression === 'target' &&
          relation.resolution === 'unresolved' &&
          relation.reason,
      ),
    ).toBe(true);
    expect(functions.some((node) => node.symbolKind === 'callback')).toBe(true);
    expect(snapshot.source).toBe('code');
    expect(snapshot.scope.included).toContain('view.tsx');
  });
  it('keeps IDs stable across blank lines but changes the baseline and captures file deletion', async () => {
    const root = await fixture(),
      indexer = new TypeScriptIndexer(root),
      before = await indexer.scan();
    await writeFile(
      path.join(root, 'notes.ts'),
      '\n\n' + (await readFile(path.join(root, 'notes.ts'), 'utf8')),
    );
    const after = await indexer.scan();
    expect(
      after.nodes
        .filter((node) => node.kind === 'function')
        .map((node) => node.id)
        .sort(),
    ).toEqual(
      before.nodes
        .filter((node) => node.kind === 'function')
        .map((node) => node.id)
        .sort(),
    );
    expect(after.baselineDigest).not.toBe(before.baselineDigest);
    expect(await indexer.fingerprint()).toBe(after.baselineDigest);
    const priorConfig = await readFile(
      path.join(root, 'tsconfig.json'),
      'utf8',
    );
    await writeFile(path.join(root, 'tsconfig.json'), priorConfig + '\n');
    expect(await indexer.fingerprint()).not.toBe(after.baselineDigest);
    await writeFile(path.join(root, 'tsconfig.json'), priorConfig);
    await rm(path.join(root, 'js-client.js'));
    expect((await indexer.scan()).scope.included).not.toContain('js-client.js');
  });
  it('excludes generated/ignored code and never follows an out-of-root symlink', async () => {
    const root = await fixture();
    await mkdir(path.join(root, 'dist'));
    await writeFile(
      path.join(root, 'dist/generated.ts'),
      'export function forbiddenGenerated() {}',
    );
    await writeFile(path.join(root, '.codemapignore'), 'ignored.ts\n');
    await writeFile(
      path.join(root, 'ignored.ts'),
      'export function forbiddenIgnored() {}',
    );
    const outside = await mkdtemp(path.join(tmpdir(), 'atlasmode-outside-'));
    temporary.push(outside);
    await writeFile(
      path.join(outside, 'secret.ts'),
      'export function forbiddenOutside() {}',
    );
    await symlink(
      path.join(outside, 'secret.ts'),
      path.join(root, 'escape.ts'),
    );
    const snapshot = await new TypeScriptIndexer(root).scan();
    expect(
      snapshot.nodes
        .filter((node) => node.kind === 'function')
        .some((node) => node.name.startsWith('forbidden')),
    ).toBe(false);
    expect(
      snapshot.scope.excluded.some((item) => item.path === 'ignored.ts'),
    ).toBe(true);
  });
  it('resolves workspace public exports to indexed source rather than calling internal workspaces external', async () => {
    const root = await fixture();
    await mkdir(path.join(root, 'packages/library/src'), { recursive: true });
    await mkdir(path.join(root, 'apps/consumer/src'), { recursive: true });
    await writeFile(
      path.join(root, 'packages/library/package.json'),
      JSON.stringify({
        name: '@fixture/library',
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        },
      }),
    );
    await writeFile(
      path.join(root, 'packages/library/tsconfig.json'),
      JSON.stringify({ compilerOptions: { rootDir: 'src', outDir: 'dist' } }),
    );
    await writeFile(
      path.join(root, 'packages/library/src/index.ts'),
      'export function sharedEntry(value:string):string{return value;}',
    );
    await writeFile(
      path.join(root, 'apps/consumer/src/main.ts'),
      "import { sharedEntry } from '@fixture/library'; export function consume(){return sharedEntry('value');}",
    );
    const snapshot = await new TypeScriptIndexer(root).scan(),
      functions = snapshot.nodes.filter((node) => node.kind === 'function');
    const shared = functions.find((node) => node.name === 'sharedEntry')!,
      consumer = functions.find((node) => node.name === 'consume')!;
    expect(
      snapshot.relations.some(
        (relation) =>
          relation.type === 'calls' &&
          relation.source === consumer.id &&
          relation.target === shared.id,
      ),
    ).toBe(true);
    expect(
      snapshot.nodes.some(
        (node) =>
          node.kind === 'external' && node.packageName === '@fixture/library',
      ),
    ).toBe(false);
  });
});
