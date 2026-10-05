import { createHash } from 'node:crypto';
import { readFile, realpath, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ignore from 'ignore';
export const defaultExcludes = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/artifacts/**',
  '.codemap/cache/**',
  '**/*.d.ts',
];
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export interface ScanResult {
  root: string;
  repositoryId: string;
  files: Map<string, string>;
  fileHashes: Record<string, string>;
  configuration: string[];
  baselineDigest: string;
  gitRevision: string | null;
  excluded: { path: string; reason: string }[];
  maxFiles: number;
  maxBytes: number;
}
export async function collect(rootInput: string): Promise<ScanResult> {
  const root = await realpath(rootInput),
    maxFiles = 20000,
    maxBytes = 40 * 1024 * 1024;
  const rules = ignore();
  for (const name of ['.gitignore', '.codemapignore']) {
    try {
      const filename = await realpath(path.join(root, name));
      if (!filename.startsWith(root + path.sep))
        throw new Error(`Ignore file escapes repository: ${name}`);
      rules.add(await readFile(filename, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const excluded = defaultExcludes.map((pattern) => ({
    path: pattern,
    reason: 'Automatic generated/dependency/cache exclusion',
  }));
  const candidates: string[] = [],
    configuration: string[] = [];
  const excludedFolders = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    'artifacts',
  ]);
  let visited = 0;
  async function walk(relative = ''): Promise<void> {
    const absolute = await realpath(path.join(root, relative));
    if (absolute !== root && !absolute.startsWith(root + path.sep))
      throw new Error(`Directory escapes repository: ${relative}`);
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      if (++visited > 100000)
        throw new Error(
          'Index directory-entry budget exceeded; add repository ignore rules',
        );
      const name = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) {
        excluded.push({
          path: name,
          reason: 'Symbolic links are not traversed',
        });
        continue;
      }
      if (entry.isDirectory()) {
        if (
          excludedFolders.has(entry.name) ||
          name === '.codemap/cache' ||
          rules.ignores(name + '/')
        ) {
          excluded.push({
            path: name + '/',
            reason:
              'Excluded dependency, generated, cache or ignored directory',
          });
          continue;
        }
        await walk(name);
      } else if (entry.isFile()) {
        if (
          /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|\.gitignore|\.codemapignore)$/.test(
            entry.name,
          )
        )
          configuration.push(name);
        if (
          /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/.test(entry.name) &&
          !entry.name.endsWith('.d.ts')
        )
          candidates.push(name);
      }
    }
  }
  await walk();
  const files = new Map<string, string>(),
    fileHashes: Record<string, string> = {};
  let bytes = 0;
  for (const relative of candidates.sort()) {
    if (rules.ignores(relative)) {
      excluded.push({ path: relative, reason: 'Repository ignore rule' });
      continue;
    }
    const absolute = await realpath(path.join(root, relative));
    if (!absolute.startsWith(root + path.sep))
      throw new Error(`Source path escapes repository: ${relative}`);
    const content = await readFile(absolute, 'utf8');
    bytes += Buffer.byteLength(content);
    if (files.size >= maxFiles || bytes > maxBytes)
      throw new Error(
        'Index scope exceeds configured file/byte safety budget; add .codemapignore exclusions',
      );
    files.set(relative, content);
    fileHashes[relative] = digest(content);
  }
  for (const relative of configuration.sort()) {
    const absolute = await realpath(path.join(root, relative));
    if (!absolute.startsWith(root + path.sep))
      throw new Error('Configuration path escapes repository');
    const content = await readFile(absolute, 'utf8');
    bytes += Buffer.byteLength(content);
    if (bytes > maxBytes)
      throw new Error('Source and configuration byte budget exceeded');
    fileHashes[relative] = digest(content);
  }
  let gitRevision: string | null = null;
  try {
    gitRevision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* Non-Git fixtures retain an explicit null revision. */
  }
  const repositoryId = 'repo:' + digest(root).slice(0, 24);
  return {
    root,
    repositoryId,
    files,
    fileHashes,
    configuration,
    gitRevision,
    baselineDigest: digest(
      JSON.stringify({ repositoryId, gitRevision, fileHashes }),
    ),
    excluded,
    maxFiles,
    maxBytes,
  };
}
