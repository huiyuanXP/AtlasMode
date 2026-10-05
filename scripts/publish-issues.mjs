import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const manifest = JSON.parse(
  readFileSync(
    new URL('../docs/issues/manifest.json', import.meta.url),
    'utf8',
  ),
);
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
gh(['auth', 'status']);
const existing = JSON.parse(
  gh([
    'issue',
    'list',
    '--repo',
    manifest.repository,
    '--state',
    'all',
    '--limit',
    '1000',
    '--json',
    'title,body,url',
  ]),
);
for (const issue of manifest.issues) {
  const marker = `<!-- atlasmode-v1:${issue.key} -->`;
  const match = existing.find((item) => item.body?.includes(marker));
  issue.url =
    match?.url ??
    gh([
      'issue',
      'create',
      '--repo',
      manifest.repository,
      '--title',
      issue.title,
      '--body-file',
      issue.bodyFile,
    ]);
  console.log(`${issue.key}: ${issue.url}`);
  // Persist each result so interrupted publication can resume without duplicates.
  writeFileSync(
    new URL('../docs/issues/manifest.json', import.meta.url),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}
const release = manifest.issues.find((issue) => issue.key === 'release');
const body =
  readFileSync(release.bodyFile, 'utf8') +
  '\n## 子任务\n\n' +
  manifest.issues
    .filter((issue) => issue !== release)
    .map((issue) => `- [ ] ${issue.title}: ${issue.url}`)
    .join('\n') +
  '\n';
const path =
  '/home/agent/work/atlasmode/initial-validation/release-issue-body.md';
writeFileSync(path, body);
gh(['issue', 'edit', release.url, '--body-file', path]);
