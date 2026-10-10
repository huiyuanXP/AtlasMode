# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tsconfig.spec.ts >> production browser displays unrecorded legacy configuration coverage truthfully in Chinese and English
- Location: tests/e2e/tsconfig.spec.ts:17:3

# Error details

```
Error: locator.click: Error: strict mode violation: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).locator('summary') resolved to 6 elements:
    1) <summary>静态分析诊断 (0)</summary> aka getByText('静态分析诊断 (0)')
    2) <summary>配置项目图</summary> aka getByText('配置项目图')
    3) <summary>…</summary> aka getByText('项目根配置 (1/1)')
    4) <summary>…</summary> aka getByText('已观察项目 (1/1)')
    5) <summary>…</summary> aka getByText('项目引用 (0/0)')
    6) <summary>…</summary> aka getByText('源码归属样本 (6/6)')

Call log:
  - waiting for locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).locator('summary')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - link "◈ AtlasMode 代码事实 · 图上规划" [ref=e5] [cursor=pointer]:
      - /url: "#"
      - text: ◈ AtlasMode
      - generic [ref=e6]: 代码事实 · 图上规划
    - button "打开项目" [ref=e7] [cursor=pointer]
    - combobox "切换项目" [ref=e8]:
      - option "选择已打开的项目"
      - option "typescript · /tmp/atlas-config-ui-D9uR7f/typescript" [selected]
    - button "刷新代码" [ref=e9] [cursor=pointer]
    - button "切换浅色/深色" [ref=e10] [cursor=pointer]: ☾ 深色
    - combobox "界面语言" [ref=e11]:
      - option "中文" [selected]
      - option "English"
  - main [ref=e12]:
    - complementary "项目事实" [ref=e13]:
      - generic [ref=e14]:
        - text: 项目事实
        - heading "typescript" [level=1] [ref=e15]
        - code [ref=e16]: /tmp/atlas-config-ui-D9uR7f/typescript
      - paragraph [ref=e17]: 先搜索函数，或展开“浏览代码”选择入口。单击查看引用，双击进入依赖视图。
      - region "搜索函数" [ref=e18]:
        - generic [ref=e19]:
          - textbox "搜索函数" [ref=e20]:
            - /placeholder: 名称、限定名或路径
          - button "搜索" [ref=e21] [cursor=pointer]
      - group [ref=e22]:
        - generic "浏览代码" [ref=e23] [cursor=pointer]
        - generic [ref=e24]:
          - heading "入口候选 7/7" [level=2] [ref=e25]:
            - text: 入口候选
            - generic [ref=e26]: 7/7
          - paragraph [ref=e27]: TS/JS：显式导出；Python：顶层公开命名约定。均非运行时确认入口。
          - generic [ref=e28]:
            - button "ƒ A requests.ts" [ref=e29] [cursor=pointer]:
              - strong [ref=e30]: ƒ A
              - generic [ref=e31]: requests.ts
            - button "ƒ caller main.ts" [ref=e32] [cursor=pointer]:
              - strong [ref=e33]: ƒ caller
              - generic [ref=e34]: main.ts
            - button "ƒ dynamic main.ts" [ref=e35] [cursor=pointer]:
              - strong [ref=e36]: ƒ dynamic
              - generic [ref=e37]: main.ts
            - button "ƒ entry entry.ts" [ref=e38] [cursor=pointer]:
              - strong [ref=e39]: ƒ entry
              - generic [ref=e40]: entry.ts
            - button "ƒ requestWithRetry requests.ts" [ref=e41] [cursor=pointer]:
              - strong [ref=e42]: ƒ requestWithRetry
              - generic [ref=e43]: requests.ts
            - button "ƒ target targetA.ts" [ref=e44] [cursor=pointer]:
              - strong [ref=e45]: ƒ target
              - generic [ref=e46]: targetA.ts
            - button "ƒ target targetB.ts" [ref=e47] [cursor=pointer]:
              - strong [ref=e48]: ƒ target
              - generic [ref=e49]: targetB.ts
        - generic [ref=e50]:
          - heading "浏览路线" [level=2] [ref=e51]
          - combobox "浏览路线" [ref=e52]:
            - option "不使用路线" [selected]
          - paragraph [ref=e53]: 路线是讲解顺序，不表示真实调用关系。
      - group [ref=e54]:
        - generic "AI 探索代码 · 连接与对话" [ref=e55] [cursor=pointer]
      - button "管理分组" [ref=e56] [cursor=pointer]
      - button "高级控件" [expanded] [active] [ref=e57] [cursor=pointer]
      - generic [ref=e58]:
        - generic [ref=e59]:
          - heading "目录职责" [level=2] [ref=e60]
          - paragraph [ref=e61]: 自然语言职责需由用户/Agent 审核；明确依赖规则会检查已有和规划关系。
          - paragraph [ref=e62]: 修改分组或目录规则将为此项目的全部规划创建新版本，并要求重新确认。
          - combobox "目录职责" [ref=e63]:
            - option "新建规则" [selected]
          - group [ref=e65]:
            - generic [ref=e66]:
              - text: 目录范围
              - textbox "目录范围" [ref=e67]:
                - /placeholder: src/
            - generic [ref=e68]:
              - text: 职责说明
              - textbox "职责说明" [ref=e69]
            - generic [ref=e70]:
              - text: 禁止依赖（每行一个目录）
              - textbox "禁止依赖（每行一个目录）" [ref=e71]:
                - /placeholder: src/internal
            - button "保存目录规则" [ref=e72] [cursor=pointer]
          - paragraph [ref=e73]: 暂无目录规则
        - group [ref=e74]:
          - generic "静态分析诊断 (0)" [ref=e75] [cursor=pointer]
    - generic [ref=e76]:
      - navigation "当前位置" [ref=e77]:
        - list [ref=e78]:
          - listitem [ref=e79]:
            - button "typescript" [ref=e80] [cursor=pointer]
          - listitem [ref=e81]:
            - generic [aria-hidden] [ref=e82]: ›
            - button "targetA.ts" [ref=e83] [cursor=pointer]
          - listitem [ref=e84]:
            - generic [aria-hidden] [ref=e85]: ›
            - button "target" [ref=e86] [cursor=pointer]
      - generic [ref=e87]:
        - button "圈选函数" [ref=e88] [cursor=pointer]
        - generic [ref=e89]:
          - text: 显示层
          - combobox "显示层" [ref=e90]:
            - option "事实 + 规划" [selected]
            - option "事实"
            - option "规划"
        - generic [ref=e91]:
          - text: 新增/改接关系类型
          - combobox "新增/改接关系类型" [disabled] [ref=e92]:
            - option "调用" [selected]
            - option "必须调用"
            - option "必须复用"
      - generic [ref=e93]: 悬停预览关联，单击查看引用，双击进入依赖漏斗；所有卡片均可拖动。Esc 依次收起小地图、详情，再退出漏斗。
      - generic "代码画布" [ref=e94]:
        - application [ref=e95]:
          - generic [ref=e97]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:file:a5037115db53058e51b1dc05b3a5c9e0 to fact:function:ebe7e0e46f85baa82dfff54d76e82fb9" [ref=e98] [cursor=pointer]:
                    - generic [ref=e101]: 事实 · 包含
                - img:
                  - group "Edge from fact:file:ddcebead12fd357aca022cb70f25dcac to fact:function:b6e50b1fed94043bd4849a25f9d02e70" [ref=e103] [cursor=pointer]:
                    - generic [ref=e106]: 事实 · 包含
                - img:
                  - group "Edge from fact:function:ebe7e0e46f85baa82dfff54d76e82fb9 to fact:function:b6e50b1fed94043bd4849a25f9d02e70" [ref=e108] [cursor=pointer]:
                    - generic [ref=e111]: 事实 · 调用
              - generic:
                - group [ref=e113]:
                  - generic [ref=e114]:
                    - generic [ref=e115]:
                      - generic [ref=e116]: ● 代码事实
                      - generic [ref=e117]: 目录
                    - strong [ref=e118]:
                      - generic [ref=e119]:
                        - generic [aria-hidden] [ref=e120]: 
                        - generic [ref=e121]: ./
                        - generic [ref=e122]: 目录
                    - code [ref=e123]: .
                - group [ref=e124]:
                  - generic [ref=e125]:
                    - generic [ref=e127]:
                      - generic [ref=e128]: ● 代码事实
                      - generic [ref=e129]: 函数
                    - strong [ref=e130]:
                      - generic [ref=e131]:
                        - generic [aria-hidden] [ref=e132]: 
                        - generic [ref=e133]: entry()
                        - generic [ref=e134]: 函数
                    - code [ref=e135]: entry.ts
                    - generic "export function entry()" [ref=e136]
                - group [ref=e138]:
                  - generic [ref=e139]:
                    - generic [ref=e141]:
                      - generic [ref=e142]: ● 代码事实
                      - generic [ref=e143]: 文件
                    - strong [ref=e144]:
                      - generic [ref=e145]:
                        - generic [aria-hidden] [ref=e146]: 
                        - generic [ref=e147]: entry.ts
                        - generic [ref=e148]: 文件
                    - code [ref=e149]: entry.ts
                - group [ref=e151]:
                  - generic [ref=e152]:
                    - generic [ref=e154]:
                      - generic [ref=e155]: ● 代码事实
                      - generic [ref=e156]: 函数
                    - strong [ref=e157]:
                      - generic [ref=e158]:
                        - generic [aria-hidden] [ref=e159]: 
                        - generic [ref=e160]: target()
                        - generic [ref=e161]: 函数
                    - code [ref=e162]: targetA.ts
                    - generic "export function target()" [ref=e163]
                - group [ref=e165]:
                  - generic [ref=e166]:
                    - generic [ref=e168]:
                      - generic [ref=e169]: ● 代码事实
                      - generic [ref=e170]: 文件
                    - strong [ref=e171]:
                      - generic [ref=e172]:
                        - generic [aria-hidden] [ref=e173]: 
                        - generic [ref=e174]: targetA.ts
                        - generic [ref=e175]: 文件
                    - code [ref=e176]: targetA.ts
          - generic "Control Panel" [ref=e178]:
            - button "放大" [ref=e179] [cursor=pointer]
            - button "缩小" [ref=e182] [cursor=pointer]
            - button "适应画布" [ref=e185] [cursor=pointer]
            - button "切换交互" [ref=e188] [cursor=pointer]
          - complementary "已加载图的小地图" [ref=e191]:
            - button "展开小地图" [ref=e192] [cursor=pointer]
            - img "图概览" [ref=e194]
          - link "React Flow attribution" [ref=e201] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
        - generic:
          - generic: ↑ 指向当前对象
          - generic: ↓ 当前对象指向
        - region "引用详情" [ref=e204]:
          - generic [ref=e205]:
            - heading "target() 函数" [level=2] [ref=e206]:
              - generic [ref=e207]:
                - generic [aria-hidden] [ref=e208]: 
                - generic [ref=e209]: target()
                - generic [ref=e210]: 函数
            - button "关闭详情" [ref=e211] [cursor=pointer]: ×
          - generic [ref=e212]:
            - paragraph [ref=e213]: 源码事实
            - code [ref=e214]: targetA.ts:2
            - generic [ref=e215]: export function target()
            - generic [ref=e216]:
              - button "复制位置" [ref=e217] [cursor=pointer]
              - button "查看源码" [ref=e218] [cursor=pointer]
            - generic [ref=e219]:
              - heading "↑ 调用它的函数 1" [level=3] [ref=e220]:
                - text: ↑ 调用它的函数
                - generic [ref=e221]: "1"
              - article [ref=e222]:
                - button "entry() 函数 entry.ts:2" [ref=e223] [cursor=pointer]:
                  - generic [ref=e224]:
                    - generic [aria-hidden] [ref=e225]: 
                    - generic [ref=e226]: entry()
                    - generic [ref=e227]: 函数
                  - code [ref=e228]: entry.ts:2
                - generic [ref=e229]: entry → target
                - code [ref=e230]: entry.ts:2
                - generic [ref=e231]: target()
            - generic [ref=e232]:
              - heading "↓ 它调用的函数 0 本页已解析 / 总调用 0" [level=3] [ref=e233]:
                - text: ↓ 它调用的函数
                - generic [ref=e234]: 0 本页已解析 / 总调用 0
              - paragraph [ref=e235]: 本页没有记录
            - generic [ref=e236]:
              - heading "本页待确认 / 外部调用 0" [level=3] [ref=e237]:
                - text: 本页待确认 / 外部调用
                - generic [ref=e238]: "0"
              - paragraph [ref=e239]: 本页没有记录
            - paragraph [ref=e240]: 已解析调用依据当前快照；零入边表示本次静态查询没有记录。
            - generic [ref=e241]:
              - button "上一页引用" [disabled] [ref=e242]
              - button "下一页引用" [disabled] [ref=e243]
      - generic [ref=e244]:
        - generic [ref=e245]: 代码事实查询预算：每次展开最多 80 个节点 / 240 条关系；按需可增至 300 / 900。
        - generic [ref=e246]: 布局与主题自动保存
    - complementary "详情面板" [ref=e247]:
      - region "规划审查" [ref=e248]:
        - button "暂无待审规划" [ref=e249] [cursor=pointer]:
          - generic [aria-hidden] [ref=e251]: ▾
      - navigation [ref=e252]:
        - button "返回对话" [ref=e253] [cursor=pointer]
        - button "查看源码" [pressed] [ref=e254] [cursor=pointer]
        - button "高级编辑" [ref=e255] [cursor=pointer]
        - button "实现核对" [ref=e256] [cursor=pointer]
      - generic [ref=e258]:
        - heading "target" [level=2] [ref=e259]
        - code [ref=e260]: targetA.ts:2
        - paragraph [ref=e261]:
          - generic [ref=e262]: 函数
          - text: typescript
        - generic [ref=e263]: export function target()
        - generic [ref=e264]:
          - button "展开一层" [ref=e265] [cursor=pointer]
          - button "扩大到 300 节点" [ref=e266] [cursor=pointer]
        - button "复制文件与行号" [ref=e267] [cursor=pointer]
        - heading "只读源码" [level=3] [ref=e268]
        - generic [ref=e269]: 2–2
        - generic [ref=e270]: "2 export function target() { return \"A 原文\"; }"
        - heading "调用者 (1) / 调用目标 (0)" [level=3] [ref=e271]
        - paragraph [ref=e272]: 静态调用证据；未解析不等于不存在。
        - article [ref=e273]:
          - strong [ref=e274]: 调用者 · 已解析
          - code [ref=e275]: entry.ts:2
          - paragraph [ref=e276]: target()
        - generic [ref=e277]:
          - button "上一页调用" [disabled] [ref=e278]
          - button "下一页调用" [disabled] [ref=e279]
```

# Test source

```ts
  3   |   openSourceDrawer,
  4   |   openAdvancedNavigation,
  5   | } from "../support/chat-shell.mjs";
  6   | import { test, expect } from "@playwright/test";
  7   | import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
  8   | import { tmpdir } from "node:os";
  9   | import { join, resolve } from "node:path";
  10  | import { startProduction, connectMcp, http } from "../support/production.mjs";
  11  | import {
  12  |   createTsconfigFixture,
  13  |   seedLegacySnapshot,
  14  | } from "../support/tsconfig.mjs";
  15  | 
  16  | for (const legacy of [false, true]) {
  17  |   test(`production browser displays ${legacy ? "unrecorded legacy" : "captured"} configuration coverage truthfully in Chinese and English`, async ({
  18  |     page,
  19  |     context,
  20  |   }, testInfo) => {
  21  |     const root = await mkdtemp(join(tmpdir(), "atlas-config-ui-"));
  22  |     const data = join(root, "data");
  23  |     const out = resolve("artifacts/e2e/tsconfig");
  24  |     await mkdir(out, { recursive: true });
  25  |     const errors: string[] = [],
  26  |       external: string[] = [];
  27  |     page.on("pageerror", (error) => errors.push(error.message));
  28  |     page.on("console", (message) => {
  29  |       if (message.type() === "error") errors.push(message.text());
  30  |     });
  31  |     await context.route("**/*", (route) => {
  32  |       if (
  33  |         !["127.0.0.1", "localhost", "[::1]"].includes(
  34  |           new URL(route.request().url()).hostname,
  35  |         )
  36  |       ) {
  37  |         external.push(route.request().url());
  38  |         return route.abort("blockedbyclient");
  39  |       }
  40  |       return route.continue();
  41  |     });
  42  |     let server, mcp;
  43  |     try {
  44  |       const f = await createTsconfigFixture(root);
  45  |       server = await startProduction(data);
  46  |       const api = (path: string) => http(server.url, path);
  47  |       const project = await http(server.url, "/api/projects", "POST", {
  48  |         path: f.ts,
  49  |       });
  50  |       const base = `/api/projects/${project.id}`;
  51  |       const snapshot = await api(`${base}/snapshot`);
  52  |       if (legacy) {
  53  |         await server.stop();
  54  |         seedLegacySnapshot(data, snapshot);
  55  |         server = await startProduction(data);
  56  |       }
  57  |       mcp = await connectMcp(server.url);
  58  |       const protocolErrors: unknown[] = [];
  59  |       mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
  60  |       await page.goto(server.url);
  61  |       await page
  62  |         .getByRole("combobox", { name: "切换项目", exact: true })
  63  |         .selectOption(project.id);
  64  |       await expect(page.locator(".project-heading h1")).toHaveText(
  65  |         "typescript",
  66  |       );
  67  |       await openCodeNavigation(page);
  68  |       await page.getByRole("button", { name: /ƒ entry/ }).click();
  69  |       await openSourceDrawer(page);
  70  |       await expect(page.getByTestId("source-snippet")).toContainText(
  71  |         "return target()",
  72  |       );
  73  |       await page.getByRole("button", { name: "展开一层", exact: true }).click();
  74  |       const a = snapshot.nodes.find(
  75  |         (n: { kind: string; filePath: string }) =>
  76  |           n.kind === "function" && n.filePath === "targetA.ts",
  77  |       );
  78  |       const targetCard = page.locator(
  79  |         `.react-flow__node[data-id="fact:${a.id}"]`,
  80  |       );
  81  |       await expect(targetCard).toBeVisible();
  82  |       await targetCard.click();
  83  |       // A card single-click waits for the double-click window before selecting.
  84  |       await expect(page.locator(".inspector code.path")).toHaveText(
  85  |         "targetA.ts:2",
  86  |       );
  87  |       await openSourceDrawer(page);
  88  |       await expect(page.getByTestId("source-snippet")).toContainText(
  89  |         'return "A 原文"',
  90  |       );
  91  |       await expect(page.locator(".inspector code.path")).toHaveText(
  92  |         "targetA.ts:2",
  93  |       );
  94  |       await openSourceDrawer(page);
  95  |       await expect(page.getByTestId("source-snippet")).not.toHaveAttribute(
  96  |         "contenteditable",
  97  |         "true",
  98  |       );
  99  |       await openAdvancedNavigation(page);
  100 |       const diagnostics = page
  101 |         .locator(".navigation details")
  102 |         .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) });
> 103 |       await diagnostics.locator("summary").click();
      |                                            ^ Error: locator.click: Error: strict mode violation: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).locator('summary') resolved to 6 elements:
  104 |       const coverage = diagnostics.getByRole("region", {
  105 |         name: "配置输入",
  106 |         exact: true,
  107 |       });
  108 |       await expect(coverage).toBeVisible();
  109 |       if (legacy) {
  110 |         await expect(coverage).toContainText("此快照未记录配置输入");
  111 |         await expect(coverage).not.toContainText("配置输入: 0");
  112 |       } else {
  113 |         await expect(coverage).toContainText("配置输入: 2");
  114 |         await expect(coverage.getByRole("listitem")).toHaveText([
  115 |           "config/shared.json",
  116 |           "tsconfig.json",
  117 |         ]);
  118 |       }
  119 |       await expect(diagnostics).toContainText("已索引文件: 6");
  120 |       await coverage.scrollIntoViewIfNeeded();
  121 |       await page.screenshot({
  122 |         path: join(out, `${legacy ? "legacy" : "captured"}-zh.png`),
  123 |         fullPage: true,
  124 |       });
  125 |       await page
  126 |         .getByRole("combobox", { name: "界面语言", exact: true })
  127 |         .selectOption("en");
  128 |       const english = page.getByRole("region", {
  129 |         name: "Configuration inputs",
  130 |         exact: true,
  131 |       });
  132 |       if (legacy) {
  133 |         await expect(english).toContainText(
  134 |           "Configuration inputs were not recorded for this snapshot",
  135 |         );
  136 |         await expect(english).not.toContainText("Configuration inputs: 0");
  137 |       } else {
  138 |         await expect(english).toContainText("Configuration inputs: 2");
  139 |         await expect(english.getByRole("listitem")).toHaveText([
  140 |           "config/shared.json",
  141 |           "tsconfig.json",
  142 |         ]);
  143 |       }
  144 |       await openSourceDrawer(page);
  145 |       await expect(page.getByTestId("source-snippet")).toContainText(
  146 |         'return "A 原文"',
  147 |       );
  148 |       await expect(page.locator(".navigation details").last()).toContainText(
  149 |         "Indexed files: 6",
  150 |       );
  151 |       await english.scrollIntoViewIfNeeded();
  152 |       await page.screenshot({
  153 |         path: join(out, `${legacy ? "legacy" : "captured"}-en.png`),
  154 |         fullPage: true,
  155 |       });
  156 |       // Real function search and transport agreement on the selected source location.
  157 |       await page
  158 |         .getByRole("textbox", { name: "Search functions", exact: true })
  159 |         .fill("entry");
  160 |       await page.getByRole("button", { name: "Search", exact: true }).click();
  161 |       await expect(page.getByRole("button", { name: /ƒ entry/ })).toHaveCount(
  162 |         2,
  163 |       );
  164 |       const summary = await api(`${base}/summary`);
  165 |       expect(
  166 |         await mcp.call("get_project_summary", { projectId: project.id }),
  167 |       ).toEqual(summary);
  168 |       expect(
  169 |         await mcp.call("get_function_context", {
  170 |           projectId: project.id,
  171 |           nodeId: a.id,
  172 |         }),
  173 |       ).toEqual(await api(`${base}/functions/${a.id}`));
  174 |       await f.assertNotExecuted();
  175 |       expect(errors).toEqual([]);
  176 |       expect(external).toEqual([]);
  177 |       expect(protocolErrors).toEqual([]);
  178 |       expect(mcp.stderr()).toBe("");
  179 |       const evidence = {
  180 |         legacy,
  181 |         snapshotId: summary.snapshotId,
  182 |         coverage: summary.coverage,
  183 |         errors,
  184 |         external,
  185 |         protocolErrors,
  186 |         targetNotExecuted: true,
  187 |       };
  188 |       await writeFile(
  189 |         join(out, `${legacy ? "legacy" : "captured"}-evidence.json`),
  190 |         JSON.stringify(evidence, null, 2),
  191 |       );
  192 |       await testInfo.attach("configuration-evidence", {
  193 |         body: JSON.stringify(evidence),
  194 |         contentType: "application/json",
  195 |       });
  196 |     } finally {
  197 |       await mcp?.client.close();
  198 |       if (mcp) expect(mcp.transport.pid).toBeNull();
  199 |       await server?.stop();
  200 |       await rm(root, { recursive: true, force: true });
  201 |       await expect(access(root)).rejects.toThrow();
  202 |     }
  203 |   });
```