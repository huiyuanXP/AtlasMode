import { test, expect } from '@playwright/test';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PlanSchema } from '@codemap/core';
const repository = fileURLToPath(new URL('../../', import.meta.url));
const root = path.join(repository, 'artifacts/e2e-workspace');
const hash = async (filename: string) =>
  createHash('sha256')
    .update(await readFile(filename))
    .digest('hex');
test.describe.serial('first release real repository workflow', () => {
  test('MCP draft → UI retarget/delete/relocate → human approval → real implementation → deviation evidence', async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const client = new Client({
      name: 'atlasmode-browser-agent',
      version: '1.0.0',
    });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [path.join(repository, 'apps/mcp/dist/index.js')],
        env: { CODEMAP_API_URL: 'http://127.0.0.1:4311' },
        stderr: 'pipe',
      }),
    );
    const tool = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).not.toBe(true);
      return JSON.parse((result.content as { text: string }[])[0]!.text);
    };
    try {
      const summary = await tool('get_project_summary'),
        retry = (await tool('search_functions', { query: 'requestWithRetry' }))
          .items[0];
      const draft = PlanSchema.parse(
        await tool('propose_plan', {
          baselineSnapshotId: summary.snapshotId,
          title: 'Fetch notes with the approved retry abstraction',
          reason: 'Reuse the existing retry entry after user editing',
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
          requirements: [
            {
              type: 'must_call',
              nodeId: 'plan:fetch',
              target: 'plan:helper',
              reason: 'Reuse the chosen request abstraction',
            },
          ],
        }),
      );
      await page.goto('/');
      await expect(
        page.getByText('来源：真实源码', { exact: true }),
      ).toBeVisible();
      await page.getByLabel('选择规划').selectOption(draft.id);
      await expect(page.locator('.plan-status')).toContainText('v1');
      const fileInput = page.getByLabel('目标文件 plan:fetch', { exact: true });
      await fileInput.fill('src/services/notes.ts');
      await fileInput
        .locator('xpath=ancestor::form')
        .getByRole('button', { name: '保存函数更改' })
        .click();
      await expect(page.locator('.plan-status')).toContainText('v2');
      await page
        .getByLabel('调用目标 plan:call', { exact: true })
        .selectOption(retry.id);
      await expect(page.locator('.plan-status')).toContainText('v3');
      await page
        .getByLabel('目标文件 plan:helper', { exact: true })
        .locator('xpath=ancestor::form')
        .getByRole('button', { name: '删除此规划变更' })
        .click();
      await expect(page.locator('.plan-status')).toContainText('v4');
      expect(
        await access(path.join(root, 'src/services/notes.ts')).then(
          () => true,
          () => false,
        ),
      ).toBe(false);
      await page
        .getByRole('button', { name: '校验当前版本', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: '确认此规划版本', exact: true }),
      ).toBeEnabled();
      page.once('dialog', (dialog) => dialog.accept());
      await page
        .getByRole('button', { name: '确认此规划版本', exact: true })
        .click();
      await expect(page.locator('.plan-status')).toContainText('approved');
      const approved = await tool('get_approved_plan', { id: draft.id });
      expect(approved.valid).toBe(true);
      expect(approved.plan.revision).toBe(4);
      expect(
        approved.plan.changes.some(
          (change: { op: string; id: string }) =>
            change.op === 'add_function' && change.id === 'plan:helper',
        ),
      ).toBe(false);
      expect(
        approved.plan.changes.find(
          (change: { op: string }) => change.op === 'add_call',
        ).target,
      ).toBe(retry.id);
      expect(
        approved.plan.changes.find(
          (change: { op: string }) => change.op === 'add_function',
        ).filePath,
      ).toBe('src/services/notes.ts');
      const sourceBefore = await hash(path.join(root, 'src/request.ts'));
      const card = page.locator(`.react-flow__node[data-id="${retry.id}"]`);
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + 20);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width / 2 + 8, box!.y + 28, {
        steps: 6,
      });
      await page.mouse.up();
      await expect
        .poll(async () => {
          const response = await request.get('/api/views/workspace');
          return response.status();
        })
        .toBe(200);
      expect(await hash(path.join(root, 'src/request.ts'))).toBe(sourceBefore);
      expect((await tool('get_approved_plan', { id: draft.id })).valid).toBe(
        true,
      );
      await page.screenshot({
        path: path.join(repository, 'artifacts/first-release-approved.png'),
        fullPage: true,
      });
      await tool('begin_implementation', { id: draft.id, expectedRevision: 4 });
      await mkdir(path.join(root, 'src/services'), { recursive: true });
      await writeFile(
        path.join(root, 'src/services/notes.ts'),
        "import { requestWithRetry } from '../request.js';\nexport function fetchNotes(): string { return requestWithRetry('/notes'); }\n",
      );
      expect((await tool('get_approved_plan', { id: draft.id })).valid).toBe(
        false,
      );
      await page
        .getByRole('button', { name: '重新索引并核对', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: '实现核对', exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/已满足 · Required call:/)).toBeVisible();
      await writeFile(
        path.join(root, 'src/services/notes.ts'),
        "import { lowLevelRequest } from '../request.js';\nexport function fetchNotes(): string { return lowLevelRequest('/notes'); }\n",
      );
      await page.getByRole('button', { name: '规划', exact: true }).click();
      await page
        .getByRole('button', { name: '重新索引并核对', exact: true })
        .click();
      await expect(page.getByText(/未满足 · must_call:/)).toBeVisible();
      await page.screenshot({
        path: path.join(repository, 'artifacts/first-release-deviation.png'),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    } finally {
      await client.close();
    }
  });
  test('knowledge CRUD, multi-group membership, explicit directory policies and reload persistence', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(
      page.getByText('来源：真实源码', { exact: true }),
    ).toBeVisible();
    const retry = (
      await (await request.get('/api/functions?query=requestWithRetry')).json()
    ).items[0];
    await page.locator(`.react-flow__node[data-id="${retry.id}"]`).click();
    await page.getByRole('button', { name: '注释', exact: true }).click();
    await page.getByLabel('注释内容').fill('Keep the retry entry documented');
    await page.getByRole('button', { name: '添加注释', exact: true }).click();
    await expect(page.locator('.record-list')).toContainText(
      'Keep the retry entry documented',
    );
    await page.getByRole('button', { name: '编辑注释', exact: true }).click();
    await page.getByLabel('注释内容').fill('Updated retry documentation');
    await page.getByRole('button', { name: '保存注释', exact: true }).click();
    await expect(page.locator('.record-list')).toContainText(
      'Updated retry documentation',
    );
    await page.getByRole('button', { name: '功能集', exact: true }).click();
    await page.getByLabel('功能集名称').fill('Networking');
    await page.getByRole('button', { name: '创建功能集', exact: true }).click();
    await expect(page.locator('.record-list')).toContainText('Networking');
    await page.getByLabel('功能集名称').fill('Notes capability');
    await page.getByRole('button', { name: '创建功能集', exact: true }).click();
    await expect(page.locator('.record-list')).toContainText(
      'Notes capability',
    );
    const groups = (await (await request.get('/api/groups')).json()).items;
    expect(groups).toHaveLength(2);
    expect(
      groups.every((group: { members: string[] }) =>
        group.members.includes(retry.id),
      ),
    ).toBe(true);
    await page.getByRole('button', { name: '目录约束', exact: true }).click();
    await page.getByLabel('目录职责').fill('Application service orchestration');
    await page.getByLabel('禁止依赖').fill('src/forbidden');
    await page
      .getByRole('button', { name: '添加目录约束', exact: true })
      .click();
    await expect(page.locator('.record-list')).toContainText(
      'Application service orchestration',
    );
    await page.reload();
    await expect(
      page.getByText('来源：真实源码', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '注释', exact: true }).click();
    await expect(page.locator('.record-list')).toContainText(
      'Updated retry documentation',
    );
    await page.getByRole('button', { name: '删除注释', exact: true }).click();
    await expect(page.locator('.record-list')).not.toContainText(
      'Updated retry documentation',
    );
    await page.getByRole('button', { name: '功能集', exact: true }).click();
    await page
      .getByRole('button', { name: '删除功能集', exact: true })
      .first()
      .click();
    await expect(page.locator('.record-list li')).toHaveCount(1);
    await page.getByRole('button', { name: '目录约束', exact: true }).click();
    await page
      .getByRole('button', { name: '编辑目录约束', exact: true })
      .click();
    await page.getByLabel('目录职责').fill('Updated service convention');
    await page
      .getByRole('button', { name: '保存目录约束', exact: true })
      .click();
    await expect(page.locator('.record-list')).toContainText(
      'Updated service convention',
    );
    await page
      .getByRole('button', { name: '删除目录约束', exact: true })
      .click();
    await expect(page.locator('.record-list li')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'AtlasMode', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(repository, 'artifacts/first-release-mobile.png'),
      fullPage: true,
    });
  });
});
