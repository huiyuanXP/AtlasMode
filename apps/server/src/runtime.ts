import {
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
  rm,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { TypeScriptIndexer } from '@codemap/indexer';
import { SqliteStorage } from '@codemap/storage';
import { ProjectService } from '@codemap/service';
import type { KnowledgeFilePort } from '@codemap/core';
export async function createRuntime(
  rootInput: string,
  dataDirectory?: string,
): Promise<ProjectService> {
  const root = await realpath(rootInput);
  const storage = new SqliteStorage(
    path.join(
      dataDirectory ?? path.join(root, '.codemap/cache'),
      'atlasmode.sqlite',
    ),
  );
  const writeJson = async (name: string, value: unknown) => {
    const directory = path.join(root, '.codemap');
    await mkdir(directory, { recursive: true });
    const realDirectory = await realpath(directory);
    if (!realDirectory.startsWith(root + path.sep))
      throw new Error('.codemap directory escapes authorized repository');
    const destination = path.join(realDirectory, name);
    try {
      const actual = await realpath(destination);
      if (!actual.startsWith(root + path.sep))
        throw new Error('Knowledge file symlink escapes authorized repository');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const temporary = destination + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {
        mode: 0o600,
        flag: 'wx',
      });
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  };
  const files: KnowledgeFilePort = {
    writeKnowledge: (value) => writeJson('knowledge.json', value),
    writePolicies: async (value) => {
      let original: Record<string, unknown> = {};
      try {
        const filename = await realpath(
          path.join(root, '.codemap/structure.json'),
        );
        if (!filename.startsWith(root + path.sep))
          throw new Error('Structure file escapes repository');
        original = JSON.parse(await readFile(filename, 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await writeJson('structure.json', {
        ...original,
        ...(value as Record<string, unknown>),
      });
    },
  };
  const service = new ProjectService(
    new TypeScriptIndexer(root),
    storage,
    files,
  );
  try {
    await service.initialize();
    return service;
  } catch (error) {
    storage.close();
    throw error;
  }
}
