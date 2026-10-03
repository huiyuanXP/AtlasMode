# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tsconfig.spec.ts >> production browser displays unrecorded legacy configuration coverage truthfully in Chinese and English
- Location: tests/e2e/tsconfig.spec.ts:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).getByRole('region', { name: '配置输入', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).getByRole('region', { name: '配置输入', exact: true }) with timeout 10000ms
  - waiting for locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).getByRole('region', { name: '配置输入', exact: true })

```

```yaml
- banner:
  - link "◈ AtlasMode 代码事实 · 图上规划":
    - /url: "#"
  - textbox "本地项目路径":
    - /placeholder: 输入绝对路径，例如 C:\work\project 或 /home/me/project
  - button "打开并索引"
  - combobox "切换项目":
    - option "选择已打开的项目"
    - option "typescript · /tmp/atlas-config-ui-fdeQca/typescript" [selected]
  - button "刷新代码"
  - button "切换浅色/深色": ☾ 深色
  - combobox "界面语言":
    - option "中文" [selected]
    - option "English"
- main:
  - complementary "项目事实":
    - text: 项目事实
    - heading "typescript" [level=1]
    - code: /tmp/atlas-config-ui-fdeQca/typescript
    - strong: "7"
    - text: 函数/类
    - strong: "6"
    - text: 文件
    - paragraph: "调用: 2 已解析 · 2 未解析 · 1 外部依赖"
    - heading "入口候选 7/7" [level=2]
    - paragraph: TS/JS：显式导出；Python：顶层公开命名约定。均非运行时确认入口。
    - button "ƒ A requests.ts":
      - strong: ƒ A
      - text: requests.ts
    - button "ƒ caller main.ts":
      - strong: ƒ caller
      - text: main.ts
    - button "ƒ dynamic main.ts":
      - strong: ƒ dynamic
      - text: main.ts
    - button "ƒ entry entry.ts":
      - strong: ƒ entry
      - text: entry.ts
    - button "ƒ requestWithRetry requests.ts":
      - strong: ƒ requestWithRetry
      - text: requests.ts
    - button "ƒ target targetA.ts":
      - strong: ƒ target
      - text: targetA.ts
    - button "ƒ target targetB.ts":
      - strong: ƒ target
      - text: targetB.ts
    - heading "搜索函数" [level=2]
    - textbox "搜索函数":
      - /placeholder: 名称、限定名或路径
    - button "搜索"
    - heading "浏览路线" [level=2]
    - combobox "浏览路线":
      - option "不使用路线" [selected]
    - paragraph: 路线是讲解顺序，不表示真实调用关系。
    - heading "功能分组" [level=2]
    - paragraph: 勾选下面的事实函数；一个函数可属于多个分组，不移动源码。
    - paragraph: 修改分组或目录规则将为此项目的全部规划创建新版本，并要求重新确认。
    - group:
      - text: 分组标题
      - textbox "分组标题"
      - text: 分组设计 / 说明
      - textbox "分组设计 / 说明"
      - group: 已选成员 (0)
      - button "创建分组" [disabled]
    - paragraph: 暂无分组
    - heading "目录职责" [level=2]
    - paragraph: 自然语言职责需由用户/Agent 审核；明确依赖规则会检查已有和规划关系。
    - paragraph: 修改分组或目录规则将为此项目的全部规划创建新版本，并要求重新确认。
    - combobox "目录职责":
      - option "新建规则" [selected]
    - group:
      - text: 目录范围
      - textbox "目录范围":
        - /placeholder: src/
      - text: 职责说明
      - textbox "职责说明"
      - text: 禁止依赖（每行一个目录）
      - textbox "禁止依赖（每行一个目录）":
        - /placeholder: src/internal
      - button "保存目录规则"
    - paragraph: 暂无目录规则
    - group:
      - text: 静态分析诊断 (0)
      - paragraph: "已索引文件: 6"
      - paragraph: "排除规则: **/.git/**, **/node_modules/**, **/dist/**, **/build/**, **/coverage/**, **/__pycache__/**, **/.venv/**, **/venv/**, **/.agents/**, **/.superpowers/**, **/.next/**, **/.cache/**, **/vendor/**"
  - text: 显示层
  - combobox "显示层":
    - option "事实 + 规划" [selected]
    - option "事实"
    - option "规划"
  - text: 新增/改接关系类型
  - combobox "新增/改接关系类型" [disabled]:
    - option "调用" [selected]
    - option "必须调用"
    - option "必须复用"
  - text: 点击节点查看源码；双击展开一层。拖动只保存布局。
  - application:
    - img:
      - group "Edge from fact:function:e069e9baa209d927e9947dc7895bfabd to fact:function:a36b5befa7798c3a3d9da711f78f731c": 事实 · 调用
    - group:
      - text: ● 代码事实 目录
      - strong: .
      - code: .
    - group:
      - text: ● 代码事实 函数
      - strong: entry
      - code: entry.ts
      - text: export function entry()
    - group:
      - text: ● 代码事实 文件
      - strong: entry.ts
      - code: entry.ts
    - group:
      - text: ● 代码事实 函数
      - strong: target
      - code: targetA.ts
      - text: export function target()
    - group:
      - text: ● 代码事实 文件
      - strong: targetA.ts
      - code: targetA.ts
    - img
    - button "放大":
      - img
    - button "缩小":
      - img
    - button "适应画布":
      - img
    - button "切换交互":
      - img
    - img "图概览"
    - link "React Flow attribution":
      - /url: https://reactflow.dev?utm_source=attribution
      - text: React Flow
  - text: 每次展开最多 80 个节点 / 240 条关系；按需可增至 300 / 900。 布局与主题自动保存
  - complementary "详情面板":
    - navigation:
      - button "节点 / 源码" [pressed]
      - button "规划编辑"
      - button "实现核对"
    - heading "target" [level=2]
    - code: targetA.ts:2
    - paragraph: 函数 typescript
    - text: export function target()
    - button "展开一层"
    - button "扩大到 300 节点"
    - button "复制文件与行号"
    - heading "只读源码" [level=3]
    - text: "2–2 2 export function target() { return \"A 原文\"; }"
    - heading "调用者 (1) / 调用目标 (0)" [level=3]
    - paragraph: 静态调用证据；未解析不等于不存在。
    - article:
      - strong: 调用者 · 已解析
      - code: entry.ts:2
      - paragraph: target()
    - button "上一页调用" [disabled]
    - button "下一页调用" [disabled]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
  3   | import { tmpdir } from "node:os";
  4   | import { join, resolve } from "node:path";
  5   | import { startProduction, connectMcp, http } from "../support/production.mjs";
  6   | import {
  7   |   createTsconfigFixture,
  8   |   seedLegacySnapshot,
  9   | } from "../support/tsconfig.mjs";
  10  | 
  11  | for (const legacy of [false, true]) {
  12  |   test(`production browser displays ${legacy ? "unrecorded legacy" : "captured"} configuration coverage truthfully in Chinese and English`, async ({
  13  |     page,
  14  |     context,
  15  |   }, testInfo) => {
  16  |     const root = await mkdtemp(join(tmpdir(), "atlas-config-ui-"));
  17  |     const data = join(root, "data");
  18  |     const out = resolve("artifacts/e2e/tsconfig");
  19  |     await mkdir(out, { recursive: true });
  20  |     const errors: string[] = [],
  21  |       external: string[] = [];
  22  |     page.on("pageerror", (error) => errors.push(error.message));
  23  |     page.on("console", (message) => {
  24  |       if (message.type() === "error") errors.push(message.text());
  25  |     });
  26  |     await context.route("**/*", (route) => {
  27  |       if (
  28  |         !["127.0.0.1", "localhost", "[::1]"].includes(
  29  |           new URL(route.request().url()).hostname,
  30  |         )
  31  |       ) {
  32  |         external.push(route.request().url());
  33  |         return route.abort("blockedbyclient");
  34  |       }
  35  |       return route.continue();
  36  |     });
  37  |     let server, mcp;
  38  |     try {
  39  |       const f = await createTsconfigFixture(root);
  40  |       server = await startProduction(data);
  41  |       const api = (path: string) => http(server.url, path);
  42  |       const project = await http(server.url, "/api/projects", "POST", {
  43  |         path: f.ts,
  44  |       });
  45  |       const base = `/api/projects/${project.id}`;
  46  |       const snapshot = await api(`${base}/snapshot`);
  47  |       if (legacy) {
  48  |         await server.stop();
  49  |         seedLegacySnapshot(data, snapshot);
  50  |         server = await startProduction(data);
  51  |       }
  52  |       mcp = await connectMcp(server.url);
  53  |       const protocolErrors: unknown[] = [];
  54  |       mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
  55  |       await page.goto(server.url);
  56  |       await page
  57  |         .getByRole("combobox", { name: "切换项目", exact: true })
  58  |         .selectOption(project.id);
  59  |       await expect(page.locator(".project-heading h1")).toHaveText(
  60  |         "typescript",
  61  |       );
  62  |       await page.getByRole("button", { name: /ƒ entry/ }).click();
  63  |       await expect(page.getByTestId("source-snippet")).toContainText(
  64  |         "return target()",
  65  |       );
  66  |       await page.getByRole("button", { name: "展开一层", exact: true }).click();
  67  |       const a = snapshot.nodes.find(
  68  |         (n: { kind: string; filePath: string }) =>
  69  |           n.kind === "function" && n.filePath === "targetA.ts",
  70  |       );
  71  |       const targetCard = page.locator(
  72  |         `.react-flow__node[data-id="fact:${a.id}"]`,
  73  |       );
  74  |       await expect(targetCard).toBeVisible();
  75  |       await targetCard.click();
  76  |       await expect(page.getByTestId("source-snippet")).toContainText(
  77  |         'return "A 原文"',
  78  |       );
  79  |       await expect(page.locator(".inspector code.path")).toHaveText(
  80  |         "targetA.ts:2",
  81  |       );
  82  |       await expect(page.getByTestId("source-snippet")).not.toHaveAttribute(
  83  |         "contenteditable",
  84  |         "true",
  85  |       );
  86  |       const diagnostics = page
  87  |         .locator(".navigation details")
  88  |         .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) });
  89  |       await diagnostics.locator("summary").click();
  90  |       const coverage = diagnostics.getByRole("region", {
  91  |         name: "配置输入",
  92  |         exact: true,
  93  |       });
> 94  |       await expect(coverage).toBeVisible();
      |                              ^ Error: expect(locator).toBeVisible() failed
  95  |       if (legacy) {
  96  |         await expect(coverage).toContainText("此快照未记录配置输入");
  97  |         await expect(coverage).not.toContainText("配置输入: 0");
  98  |       } else {
  99  |         await expect(coverage).toContainText("配置输入: 2");
  100 |         await expect(coverage.getByRole("listitem")).toHaveText([
  101 |           "config/shared.json",
  102 |           "tsconfig.json",
  103 |         ]);
  104 |       }
  105 |       await expect(diagnostics).toContainText("已索引文件: 6");
  106 |       await coverage.scrollIntoViewIfNeeded();
  107 |       await page.screenshot({
  108 |         path: join(out, `${legacy ? "legacy" : "captured"}-zh.png`),
  109 |         fullPage: true,
  110 |       });
  111 |       await page
  112 |         .getByRole("combobox", { name: "界面语言", exact: true })
  113 |         .selectOption("en");
  114 |       const english = page.getByRole("region", {
  115 |         name: "Configuration inputs",
  116 |         exact: true,
  117 |       });
  118 |       if (legacy) {
  119 |         await expect(english).toContainText(
  120 |           "Configuration inputs were not recorded for this snapshot",
  121 |         );
  122 |         await expect(english).not.toContainText("Configuration inputs: 0");
  123 |       } else {
  124 |         await expect(english).toContainText("Configuration inputs: 2");
  125 |         await expect(english.getByRole("listitem")).toHaveText([
  126 |           "config/shared.json",
  127 |           "tsconfig.json",
  128 |         ]);
  129 |       }
  130 |       await expect(page.getByTestId("source-snippet")).toContainText(
  131 |         'return "A 原文"',
  132 |       );
  133 |       await expect(page.locator(".navigation details").last()).toContainText(
  134 |         "Indexed files: 6",
  135 |       );
  136 |       await english.scrollIntoViewIfNeeded();
  137 |       await page.screenshot({
  138 |         path: join(out, `${legacy ? "legacy" : "captured"}-en.png`),
  139 |         fullPage: true,
  140 |       });
  141 |       // Real function search and transport agreement on the selected source location.
  142 |       await page
  143 |         .getByRole("textbox", { name: "Search functions", exact: true })
  144 |         .fill("entry");
  145 |       await page.getByRole("button", { name: "Search", exact: true }).click();
  146 |       await expect(page.getByRole("button", { name: /ƒ entry/ })).toHaveCount(
  147 |         2,
  148 |       );
  149 |       const summary = await api(`${base}/summary`);
  150 |       expect(
  151 |         await mcp.call("get_project_summary", { projectId: project.id }),
  152 |       ).toEqual(summary);
  153 |       expect(
  154 |         await mcp.call("get_function_context", {
  155 |           projectId: project.id,
  156 |           nodeId: a.id,
  157 |         }),
  158 |       ).toEqual(await api(`${base}/functions/${a.id}`));
  159 |       await f.assertNotExecuted();
  160 |       expect(errors).toEqual([]);
  161 |       expect(external).toEqual([]);
  162 |       expect(protocolErrors).toEqual([]);
  163 |       expect(mcp.stderr()).toBe("");
  164 |       const evidence = {
  165 |         legacy,
  166 |         snapshotId: summary.snapshotId,
  167 |         coverage: summary.coverage,
  168 |         errors,
  169 |         external,
  170 |         protocolErrors,
  171 |         targetNotExecuted: true,
  172 |       };
  173 |       await writeFile(
  174 |         join(out, `${legacy ? "legacy" : "captured"}-evidence.json`),
  175 |         JSON.stringify(evidence, null, 2),
  176 |       );
  177 |       await testInfo.attach("configuration-evidence", {
  178 |         body: JSON.stringify(evidence),
  179 |         contentType: "application/json",
  180 |       });
  181 |     } finally {
  182 |       await mcp?.client.close();
  183 |       if (mcp) expect(mcp.transport.pid).toBeNull();
  184 |       await server?.stop();
  185 |       await rm(root, { recursive: true, force: true });
  186 |       await expect(access(root)).rejects.toThrow();
  187 |     }
  188 |   });
  189 | }
  190 | 
```