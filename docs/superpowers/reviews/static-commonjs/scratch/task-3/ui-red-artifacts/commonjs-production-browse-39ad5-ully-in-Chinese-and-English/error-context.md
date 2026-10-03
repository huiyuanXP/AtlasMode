# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commonjs.spec.ts >> production browser displays captured package coverage truthfully in Chinese and English
- Location: tests/e2e/commonjs.spec.ts:12:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).getByRole('region', { name: '包配置', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).getByRole('region', { name: '包配置', exact: true }) with timeout 10000ms
  - waiting for locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).getByRole('region', { name: '包配置', exact: true })

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
    - option "commonjs · /tmp/atlas-commonjs-ui-BlngPp/commonjs" [selected]
  - button "刷新代码"
  - button "切换浅色/深色": ☾ 深色
  - combobox "界面语言":
    - option "中文" [selected]
    - option "English"
- main:
  - complementary "项目事实":
    - text: 项目事实
    - heading "commonjs" [level=1]
    - code: /tmp/atlas-commonjs-ui-BlngPp/commonjs
    - strong: "6"
    - text: 函数/类
    - strong: "5"
    - text: 文件
    - paragraph: "调用: 1 已解析 · 7 未解析 · 1 外部依赖"
    - heading "入口候选 4/4" [level=2]
    - paragraph: TS/JS：显式导出；Python：顶层公开命名约定。均非运行时确认入口。
    - button "ƒ entry entry.js":
      - strong: ƒ entry
      - text: entry.js
    - button "ƒ helper helper.js":
      - strong: ƒ helper
      - text: helper.js
    - button "ƒ overwritten unknown.js":
      - strong: ƒ overwritten
      - text: unknown.js
    - button "ƒ shadowed unknown.js":
      - strong: ƒ shadowed
      - text: unknown.js
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
      - paragraph: "已索引文件: 5"
      - region "配置输入":
        - 'heading "配置输入: 0" [level=3]'
        - list
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
      - group "Edge from fact:function:e3e33a2cdea9514c18ad9fd3bc1688ee to fact:function:50fad8e9f5c700b8a8a5183cec9baa7c": 事实 · 调用
    - group:
      - text: ● 代码事实 目录
      - strong: .
      - code: .
    - group:
      - text: ● 代码事实 函数
      - strong: entry
      - code: entry.js
      - text: function entry()
    - group:
      - text: ● 代码事实 文件
      - strong: entry.js
      - code: entry.js
    - group:
      - text: ● 代码事实 函数
      - strong: helper
      - code: helper.js
      - text: function helper()
    - group:
      - text: ● 代码事实 文件
      - strong: helper.js
      - code: helper.js
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
  - group: ⚠ 范围与不确定性 (1)
  - text: 每次展开最多 80 个节点 / 240 条关系；按需可增至 300 / 900。 布局与主题自动保存
  - complementary "详情面板":
    - navigation:
      - button "节点 / 源码" [pressed]
      - button "规划编辑"
      - button "实现核对"
    - heading "helper" [level=2]
    - code: helper.js:2
    - paragraph: 函数 javascript
    - text: function helper()
    - button "展开一层"
    - button "扩大到 300 节点"
    - button "复制文件与行号"
    - heading "只读源码" [level=3]
    - text: "2–2 2 function helper() { return \"中文 helper\"; }"
    - heading "调用者 (1) / 调用目标 (0)" [level=3]
    - paragraph: 静态调用证据；未解析不等于不存在。
    - article:
      - strong: 调用者 · 已解析
      - code: entry.js:2
      - paragraph: mod.helper()
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
  7   |   createCommonjsFixture,
  8   |   seedLegacyPackageSnapshot,
  9   | } from "../support/commonjs.mjs";
  10  | 
  11  | for (const legacy of [false, true]) {
  12  |   test(`production browser displays ${legacy ? "unrecorded legacy" : "captured"} package coverage truthfully in Chinese and English`, async ({
  13  |     page,
  14  |     context,
  15  |   }, testInfo) => {
  16  |     const root = await mkdtemp(join(tmpdir(), "atlas-commonjs-ui-"));
  17  |     const data = join(root, "data");
  18  |     const out = resolve("artifacts/e2e/commonjs");
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
  39  |       const f = await createCommonjsFixture(root);
  40  |       server = await startProduction(data);
  41  |       const api = (path: string) => http(server.url, path);
  42  |       const project = await http(server.url, "/api/projects", "POST", {
  43  |         path: f.path,
  44  |       });
  45  |       const base = `/api/projects/${project.id}`;
  46  |       const snapshot = await api(`${base}/snapshot`);
  47  |       if (legacy) {
  48  |         await server.stop();
  49  |         seedLegacyPackageSnapshot(data, snapshot);
  50  |         server = await startProduction(data);
  51  |       }
  52  |       mcp = await connectMcp(server.url);
  53  |       const protocolErrors: unknown[] = [];
  54  |       mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
  55  |       await page.goto(server.url);
  56  |       await page
  57  |         .getByRole("combobox", { name: "切换项目", exact: true })
  58  |         .selectOption(project.id);
  59  |       await expect(page.locator(".project-heading h1")).toHaveText("commonjs");
  60  |       await page.getByRole("button", { name: /ƒ entry/ }).click();
  61  |       await expect(page.getByTestId("source-snippet")).toContainText(
  62  |         "return mod.helper()",
  63  |       );
  64  |       await page.getByRole("button", { name: "展开一层", exact: true }).click();
  65  |       const a = snapshot.nodes.find(
  66  |         (n: { kind: string; filePath: string }) =>
  67  |           n.kind === "function" && n.filePath === "helper.js",
  68  |       );
  69  |       const targetCard = page.locator(
  70  |         `.react-flow__node[data-id="fact:${a.id}"]`,
  71  |       );
  72  |       await expect(targetCard).toBeVisible();
  73  |       await targetCard.click();
  74  |       await expect(page.getByTestId("source-snippet")).toContainText(
  75  |         'return "中文 helper"',
  76  |       );
  77  |       await expect(page.locator(".inspector code.path")).toHaveText(
  78  |         "helper.js:2",
  79  |       );
  80  |       await expect(page.getByTestId("source-snippet")).not.toHaveAttribute(
  81  |         "contenteditable",
  82  |         "true",
  83  |       );
  84  |       const diagnostics = page
  85  |         .locator(".navigation details")
  86  |         .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) });
  87  |       await diagnostics.locator("summary").click();
  88  |       const coverage = diagnostics.getByRole("region", {
  89  |         name: "包配置",
  90  |         exact: true,
  91  |       });
> 92  |       await expect(coverage).toBeVisible();
      |                              ^ Error: expect(locator).toBeVisible() failed
  93  |       if (legacy) {
  94  |         await expect(coverage).toContainText("此快照未记录包配置");
  95  |         await expect(coverage).not.toContainText("包配置: 0");
  96  |       } else {
  97  |         await expect(coverage).toContainText("包配置: 1");
  98  |         await expect(coverage.getByRole("listitem")).toHaveText([
  99  |           "package.json",
  100 |         ]);
  101 |       }
  102 |       await expect(diagnostics).toContainText("已索引文件: 5");
  103 |       await coverage.scrollIntoViewIfNeeded();
  104 |       await page.screenshot({
  105 |         path: join(out, `${legacy ? "legacy" : "captured"}-zh.png`),
  106 |         fullPage: true,
  107 |       });
  108 |       await page
  109 |         .getByRole("combobox", { name: "界面语言", exact: true })
  110 |         .selectOption("en");
  111 |       const english = page.getByRole("region", {
  112 |         name: "Package manifests",
  113 |         exact: true,
  114 |       });
  115 |       if (legacy) {
  116 |         await expect(english).toContainText(
  117 |           "Package manifests were not recorded for this snapshot",
  118 |         );
  119 |         await expect(english).not.toContainText("Package manifests: 0");
  120 |       } else {
  121 |         await expect(english).toContainText("Package manifests: 1");
  122 |         await expect(english.getByRole("listitem")).toHaveText([
  123 |           "package.json",
  124 |         ]);
  125 |       }
  126 |       await expect(page.getByTestId("source-snippet")).toContainText(
  127 |         'return "中文 helper"',
  128 |       );
  129 |       await expect(page.locator(".navigation details").last()).toContainText(
  130 |         "Indexed files: 5",
  131 |       );
  132 |       await english.scrollIntoViewIfNeeded();
  133 |       await page.screenshot({
  134 |         path: join(out, `${legacy ? "legacy" : "captured"}-en.png`),
  135 |         fullPage: true,
  136 |       });
  137 |       // Unknowns must expose their authored call evidence and conservative reason.
  138 |       await page.getByRole("button", { name: /ƒ overwritten/ }).click();
  139 |       await expect(page.getByTestId("source-snippet")).toContainText(
  140 |         "return mod.helper()",
  141 |       );
  142 |       const unknown = snapshot.nodes.find(
  143 |         (n: { name: string }) => n.name === "overwritten",
  144 |       );
  145 |       const unknownContext = await api(`${base}/functions/${unknown.id}`);
  146 |       const reason = unknownContext.outgoing.find(
  147 |         (r: { resolution: string }) => r.resolution === "unresolved",
  148 |       ).reason;
  149 |       await expect(page.locator(".inspector")).toContainText(reason);
  150 |       await page.screenshot({
  151 |         path: join(out, `${legacy ? "legacy" : "captured"}-unknown-en.png`),
  152 |         fullPage: true,
  153 |       });
  154 |       await page.getByRole("button", { name: /ƒ shadowed/ }).click();
  155 |       const shadowed = snapshot.nodes.find(
  156 |         (n: { name: string }) => n.name === "shadowed",
  157 |       );
  158 |       const shadowContext = await api(`${base}/functions/${shadowed.id}`);
  159 |       for (const relation of shadowContext.outgoing) {
  160 |         expect(relation.resolution).toBe("unresolved");
  161 |         await expect(page.locator(".inspector")).toContainText(relation.reason);
  162 |       }
  163 |       const summary = await api(`${base}/summary`);
  164 |       expect(
  165 |         await mcp.call("get_project_summary", { projectId: project.id }),
  166 |       ).toEqual(summary);
  167 |       expect(
  168 |         await mcp.call("get_function_context", {
  169 |           projectId: project.id,
  170 |           nodeId: a.id,
  171 |         }),
  172 |       ).toEqual(await api(`${base}/functions/${a.id}`));
  173 |       await f.assertNotExecuted();
  174 |       expect(errors).toEqual([]);
  175 |       expect(external).toEqual([]);
  176 |       expect(protocolErrors).toEqual([]);
  177 |       expect(mcp.stderr()).toBe("");
  178 |       const evidence = {
  179 |         legacy,
  180 |         snapshotId: summary.snapshotId,
  181 |         coverage: summary.coverage,
  182 |         errors,
  183 |         external,
  184 |         protocolErrors,
  185 |         unknownContext,
  186 |         shadowContext,
  187 |         observedAt: new Date().toISOString(),
  188 |         targetNotExecuted: true,
  189 |       };
  190 |       await writeFile(
  191 |         join(out, `${legacy ? "legacy" : "captured"}-evidence.json`),
  192 |         JSON.stringify(evidence, null, 2),
```