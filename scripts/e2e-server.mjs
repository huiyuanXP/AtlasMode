import { cp, mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repository = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(repository, 'artifacts/e2e-workspace');
await mkdir(path.dirname(root), { recursive: true });
await rm(root, { recursive: true, force: true });
await rm(path.join(repository, 'artifacts/e2e-data'), {
  recursive: true,
  force: true,
});
await cp(path.join(repository, 'fixtures/approval-loop'), root, {
  recursive: true,
});
const child = spawn(
  process.execPath,
  [path.join(repository, 'apps/server/dist/index.js')],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CODEMAP_PORT: '4311',
      CODEMAP_WORKSPACE_ROOT: root,
      CODEMAP_DATA_DIR: path.join(repository, 'artifacts/e2e-data'),
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => child.kill(signal));
child.once('exit', (code) => {
  process.exitCode = code ?? 0;
});
