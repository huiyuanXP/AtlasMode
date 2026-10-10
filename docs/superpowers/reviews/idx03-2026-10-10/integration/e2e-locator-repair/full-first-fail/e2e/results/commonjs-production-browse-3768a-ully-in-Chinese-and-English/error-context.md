# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commonjs.spec.ts >> production browser displays unrecorded legacy package coverage truthfully in Chinese and English
- Location: tests/e2e/commonjs.spec.ts:22:3

# Error details

```
Error: locator.click: Error: strict mode violation: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).locator('summary') resolved to 6 elements:
    1) <summary>静态分析诊断 (0)</summary> aka getByText('静态分析诊断 (0)')
    2) <summary>配置项目图</summary> aka getByText('配置项目图')
    3) <summary>…</summary> aka getByText('项目根配置 (0/0)')
    4) <summary>…</summary> aka getByText('已观察项目 (0/0)')
    5) <summary>…</summary> aka getByText('项目引用 (0/0)')
    6) <summary>…</summary> aka getByText('源码归属样本 (5/5)')

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
      - option "commonjs · /tmp/atlas-commonjs-ui-4w6NYW/commonjs" [selected]
    - button "刷新代码" [ref=e9] [cursor=pointer]
    - button "切换浅色/深色" [ref=e10] [cursor=pointer]: ☾ 深色
    - combobox "界面语言" [ref=e11]:
      - option "中文" [selected]
      - option "English"
  - main [ref=e12]:
    - complementary "项目事实" [ref=e13]:
      - generic [ref=e14]:
        - text: 项目事实
        - heading "commonjs" [level=1] [ref=e15]
        - code [ref=e16]: /tmp/atlas-commonjs-ui-4w6NYW/commonjs
      - paragraph [ref=e17]: 先搜索函数，或展开“浏览代码”选择入口。单击查看引用，双击进入依赖视图。
      - region "搜索函数" [ref=e18]:
        - generic [ref=e19]:
          - textbox "搜索函数" [ref=e20]:
            - /placeholder: 名称、限定名或路径
          - button "搜索" [ref=e21] [cursor=pointer]
      - group [ref=e22]:
        - generic "浏览代码" [ref=e23] [cursor=pointer]
        - generic [ref=e24]:
          - heading "入口候选 4/4" [level=2] [ref=e25]:
            - text: 入口候选
            - generic [ref=e26]: 4/4
          - paragraph [ref=e27]: TS/JS：显式导出；Python：顶层公开命名约定。均非运行时确认入口。
          - generic [ref=e28]:
            - button "ƒ entry entry.js" [ref=e29] [cursor=pointer]:
              - strong [ref=e30]: ƒ entry
              - generic [ref=e31]: entry.js
            - button "ƒ helper helper.js" [ref=e32] [cursor=pointer]:
              - strong [ref=e33]: ƒ helper
              - generic [ref=e34]: helper.js
            - button "ƒ overwritten unknown.js" [ref=e35] [cursor=pointer]:
              - strong [ref=e36]: ƒ overwritten
              - generic [ref=e37]: unknown.js
            - button "ƒ shadowed unknown.js" [ref=e38] [cursor=pointer]:
              - strong [ref=e39]: ƒ shadowed
              - generic [ref=e40]: unknown.js
        - generic [ref=e41]:
          - heading "浏览路线" [level=2] [ref=e42]
          - combobox "浏览路线" [ref=e43]:
            - option "不使用路线" [selected]
          - paragraph [ref=e44]: 路线是讲解顺序，不表示真实调用关系。
      - group [ref=e45]:
        - generic "AI 探索代码 · 连接与对话" [ref=e46] [cursor=pointer]
      - button "管理分组" [ref=e47] [cursor=pointer]
      - button "高级控件" [expanded] [active] [ref=e48] [cursor=pointer]
      - generic [ref=e49]:
        - generic [ref=e50]:
          - heading "目录职责" [level=2] [ref=e51]
          - paragraph [ref=e52]: 自然语言职责需由用户/Agent 审核；明确依赖规则会检查已有和规划关系。
          - paragraph [ref=e53]: 修改分组或目录规则将为此项目的全部规划创建新版本，并要求重新确认。
          - combobox "目录职责" [ref=e54]:
            - option "新建规则" [selected]
          - group [ref=e56]:
            - generic [ref=e57]:
              - text: 目录范围
              - textbox "目录范围" [ref=e58]:
                - /placeholder: src/
            - generic [ref=e59]:
              - text: 职责说明
              - textbox "职责说明" [ref=e60]
            - generic [ref=e61]:
              - text: 禁止依赖（每行一个目录）
              - textbox "禁止依赖（每行一个目录）" [ref=e62]:
                - /placeholder: src/internal
            - button "保存目录规则" [ref=e63] [cursor=pointer]
          - paragraph [ref=e64]: 暂无目录规则
        - group [ref=e65]:
          - generic "静态分析诊断 (0)" [ref=e66] [cursor=pointer]
    - generic [ref=e67]:
      - navigation "当前位置" [ref=e68]:
        - list [ref=e69]:
          - listitem [ref=e70]:
            - button "commonjs" [ref=e71] [cursor=pointer]
          - listitem [ref=e72]:
            - generic [aria-hidden] [ref=e73]: ›
            - button "helper.js" [ref=e74] [cursor=pointer]
          - listitem [ref=e75]:
            - generic [aria-hidden] [ref=e76]: ›
            - button "helper" [ref=e77] [cursor=pointer]
      - generic [ref=e78]:
        - button "圈选函数" [ref=e79] [cursor=pointer]
        - generic [ref=e80]:
          - text: 显示层
          - combobox "显示层" [ref=e81]:
            - option "事实 + 规划" [selected]
            - option "事实"
            - option "规划"
        - generic [ref=e82]:
          - text: 新增/改接关系类型
          - combobox "新增/改接关系类型" [disabled] [ref=e83]:
            - option "调用" [selected]
            - option "必须调用"
            - option "必须复用"
      - generic [ref=e84]: 悬停预览关联，单击查看引用，双击进入依赖漏斗；所有卡片均可拖动。Esc 依次收起小地图、详情，再退出漏斗。
      - generic "代码画布" [ref=e85]:
        - application [ref=e86]:
          - generic [ref=e88]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:function:5510be57e004c8ce3c4087ba1379c307 to fact:function:6f18e1ffdc9c9df78ae6b4711b16f345" [ref=e89] [cursor=pointer]:
                    - generic [ref=e92]: 事实 · 调用
                - img:
                  - group "Edge from fact:file:aa5b00451ce59d9416fd1cfcea598a88 to fact:function:5510be57e004c8ce3c4087ba1379c307" [ref=e94] [cursor=pointer]:
                    - generic [ref=e97]: 事实 · 包含
                - img:
                  - group "Edge from fact:file:b3fc3a0754acb68081a7eb6e6aac912a to fact:function:6f18e1ffdc9c9df78ae6b4711b16f345" [ref=e99] [cursor=pointer]:
                    - generic [ref=e102]: 事实 · 包含
              - generic:
                - group [ref=e104]:
                  - generic [ref=e105]:
                    - generic [ref=e106]:
                      - generic [ref=e107]: ● 代码事实
                      - generic [ref=e108]: 目录
                    - strong [ref=e109]:
                      - generic [ref=e110]:
                        - generic [aria-hidden] [ref=e111]: 
                        - generic [ref=e112]: ./
                        - generic [ref=e113]: 目录
                    - code [ref=e114]: .
                - group [ref=e115]:
                  - generic [ref=e116]:
                    - generic [ref=e118]:
                      - generic [ref=e119]: ● 代码事实
                      - generic [ref=e120]: 函数
                    - strong [ref=e121]:
                      - generic [ref=e122]:
                        - generic [aria-hidden] [ref=e123]: 
                        - generic [ref=e124]: entry()
                        - generic [ref=e125]: 函数
                    - code [ref=e126]: entry.js
                    - generic "function entry()" [ref=e127]
                - group [ref=e129]:
                  - generic [ref=e130]:
                    - generic [ref=e132]:
                      - generic [ref=e133]: ● 代码事实
                      - generic [ref=e134]: 文件
                    - strong [ref=e135]:
                      - generic [ref=e136]:
                        - generic [aria-hidden] [ref=e137]: 
                        - generic [ref=e138]: entry.js
                        - generic [ref=e139]: 文件
                    - code [ref=e140]: entry.js
                - group [ref=e142]:
                  - generic [ref=e143]:
                    - generic [ref=e145]:
                      - generic [ref=e146]: ● 代码事实
                      - generic [ref=e147]: 函数
                    - strong [ref=e148]:
                      - generic [ref=e149]:
                        - generic [aria-hidden] [ref=e150]: 
                        - generic [ref=e151]: helper()
                        - generic [ref=e152]: 函数
                    - code [ref=e153]: helper.js
                    - generic "function helper()" [ref=e154]
                - group [ref=e156]:
                  - generic [ref=e157]:
                    - generic [ref=e159]:
                      - generic [ref=e160]: ● 代码事实
                      - generic [ref=e161]: 文件
                    - strong [ref=e162]:
                      - generic [ref=e163]:
                        - generic [aria-hidden] [ref=e164]: 
                        - generic [ref=e165]: helper.js
                        - generic [ref=e166]: 文件
                    - code [ref=e167]: helper.js
          - generic "Control Panel" [ref=e169]:
            - button "放大" [ref=e170] [cursor=pointer]
            - button "缩小" [ref=e173] [cursor=pointer]
            - button "适应画布" [ref=e176] [cursor=pointer]
            - button "切换交互" [ref=e179] [cursor=pointer]
          - complementary "已加载图的小地图" [ref=e182]:
            - button "展开小地图" [ref=e183] [cursor=pointer]
            - img "图概览" [ref=e185]
          - link "React Flow attribution" [ref=e192] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
        - generic:
          - generic: ↑ 指向当前对象
          - generic: ↓ 当前对象指向
        - region "引用详情" [ref=e195]:
          - generic [ref=e196]:
            - heading "helper() 函数" [level=2] [ref=e197]:
              - generic [ref=e198]:
                - generic [aria-hidden] [ref=e199]: 
                - generic [ref=e200]: helper()
                - generic [ref=e201]: 函数
            - button "关闭详情" [ref=e202] [cursor=pointer]: ×
          - generic [ref=e203]:
            - paragraph [ref=e204]: 源码事实
            - code [ref=e205]: helper.js:2
            - generic [ref=e206]: function helper()
            - generic [ref=e207]:
              - button "复制位置" [ref=e208] [cursor=pointer]
              - button "查看源码" [ref=e209] [cursor=pointer]
            - generic [ref=e210]:
              - heading "↑ 调用它的函数 1" [level=3] [ref=e211]:
                - text: ↑ 调用它的函数
                - generic [ref=e212]: "1"
              - article [ref=e213]:
                - button "entry() 函数 entry.js:2" [ref=e214] [cursor=pointer]:
                  - generic [ref=e215]:
                    - generic [aria-hidden] [ref=e216]: 
                    - generic [ref=e217]: entry()
                    - generic [ref=e218]: 函数
                  - code [ref=e219]: entry.js:2
                - generic [ref=e220]: entry → helper
                - code [ref=e221]: entry.js:2
                - generic [ref=e222]: mod.helper()
            - generic [ref=e223]:
              - heading "↓ 它调用的函数 0 本页已解析 / 总调用 0" [level=3] [ref=e224]:
                - text: ↓ 它调用的函数
                - generic [ref=e225]: 0 本页已解析 / 总调用 0
              - paragraph [ref=e226]: 本页没有记录
            - generic [ref=e227]:
              - heading "本页待确认 / 外部调用 0" [level=3] [ref=e228]:
                - text: 本页待确认 / 外部调用
                - generic [ref=e229]: "0"
              - paragraph [ref=e230]: 本页没有记录
            - paragraph [ref=e231]: 已解析调用依据当前快照；零入边表示本次静态查询没有记录。
            - generic [ref=e232]:
              - button "上一页引用" [disabled] [ref=e233]
              - button "下一页引用" [disabled] [ref=e234]
        - group [ref=e235]:
          - generic "⚠ 范围与不确定性 (1)" [ref=e236] [cursor=pointer]
      - generic [ref=e237]:
        - generic [ref=e238]: 代码事实查询预算：每次展开最多 80 个节点 / 240 条关系；按需可增至 300 / 900。
        - generic [ref=e239]: 布局与主题自动保存
    - complementary "详情面板" [ref=e240]:
      - region "规划审查" [ref=e241]:
        - button "暂无待审规划" [ref=e242] [cursor=pointer]:
          - generic [aria-hidden] [ref=e244]: ▾
      - navigation [ref=e245]:
        - button "返回对话" [ref=e246] [cursor=pointer]
        - button "查看源码" [pressed] [ref=e247] [cursor=pointer]
        - button "高级编辑" [ref=e248] [cursor=pointer]
        - button "实现核对" [ref=e249] [cursor=pointer]
      - generic [ref=e251]:
        - heading "helper" [level=2] [ref=e252]
        - code [ref=e253]: helper.js:2
        - paragraph [ref=e254]:
          - generic [ref=e255]: 函数
          - text: javascript
        - generic [ref=e256]: function helper()
        - generic [ref=e257]:
          - button "展开一层" [ref=e258] [cursor=pointer]
          - button "扩大到 300 节点" [ref=e259] [cursor=pointer]
        - button "复制文件与行号" [ref=e260] [cursor=pointer]
        - heading "只读源码" [level=3] [ref=e261]
        - generic [ref=e262]: 2–2
        - generic [ref=e263]: "2 function helper() { return \"中文 helper\"; }"
        - heading "调用者 (1) / 调用目标 (0)" [level=3] [ref=e264]
        - paragraph [ref=e265]: 静态调用证据；未解析不等于不存在。
        - article [ref=e266]:
          - strong [ref=e267]: 调用者 · 已解析
          - code [ref=e268]: entry.js:2
          - paragraph [ref=e269]: mod.helper()
        - generic [ref=e270]:
          - button "上一页调用" [disabled] [ref=e271]
          - button "下一页调用" [disabled] [ref=e272]
```

# Test source

```ts
  1   | import {
  2   |   openCodeNavigation,
  3   |   openSourceDrawer,
  4   |   openAdvancedNavigation,
  5   | } from "../support/chat-shell.mjs";
  6   | import { test, expect } from "@playwright/test";
  7   | import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
  8   | import { tmpdir } from "node:os";
  9   | import { join, resolve } from "node:path";
  10  | import {
  11  |   startProduction,
  12  |   connectMcp,
  13  |   http,
  14  |   denyExternalRequests,
  15  | } from "../support/production.mjs";
  16  | import {
  17  |   createCommonjsFixture,
  18  |   seedLegacyPackageSnapshot,
  19  | } from "../support/commonjs.mjs";
  20  | 
  21  | for (const legacy of [false, true]) {
  22  |   test(`production browser displays ${legacy ? "unrecorded legacy" : "captured"} package coverage truthfully in Chinese and English`, async ({
  23  |     page,
  24  |     context,
  25  |   }, testInfo) => {
  26  |     const root = await mkdtemp(join(tmpdir(), "atlas-commonjs-ui-"));
  27  |     const data = join(root, "data");
  28  |     const out = resolve("artifacts/e2e/commonjs");
  29  |     await mkdir(out, { recursive: true });
  30  |     const errors: string[] = [],
  31  |       external: string[] = [];
  32  |     page.on("pageerror", (error) => errors.push(error.message));
  33  |     page.on("console", (message) => {
  34  |       if (message.type() === "error") errors.push(message.text());
  35  |     });
  36  |     await denyExternalRequests(context, external);
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
  60  |       await openCodeNavigation(page);
  61  |       await page.getByRole("button", { name: /ƒ entry/ }).click();
  62  |       await openSourceDrawer(page);
  63  |       await expect(page.getByTestId("source-snippet")).toContainText(
  64  |         "return mod.helper()",
  65  |       );
  66  |       await page.getByRole("button", { name: "展开一层", exact: true }).click();
  67  |       const a = snapshot.nodes.find(
  68  |         (n: { kind: string; filePath: string }) =>
  69  |           n.kind === "function" && n.filePath === "helper.js",
  70  |       );
  71  |       const targetCard = page.locator(
  72  |         `.react-flow__node[data-id="fact:${a.id}"]`,
  73  |       );
  74  |       await expect(targetCard).toBeVisible();
  75  |       await targetCard.click();
  76  |       // A card single-click waits for the double-click window before selecting.
  77  |       await expect(page.locator(".inspector code.path")).toHaveText(
  78  |         "helper.js:2",
  79  |       );
  80  |       await openSourceDrawer(page);
  81  |       await expect(page.getByTestId("source-snippet")).toContainText(
  82  |         'return "中文 helper"',
  83  |       );
  84  |       await expect(page.locator(".inspector code.path")).toHaveText(
  85  |         "helper.js:2",
  86  |       );
  87  |       await openSourceDrawer(page);
  88  |       await expect(page.getByTestId("source-snippet")).not.toHaveAttribute(
  89  |         "contenteditable",
  90  |         "true",
  91  |       );
  92  |       await openAdvancedNavigation(page);
  93  |       const diagnostics = page
  94  |         .locator(".navigation details")
  95  |         .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) });
> 96  |       await diagnostics.locator("summary").click();
      |                                            ^ Error: locator.click: Error: strict mode violation: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).locator('summary') resolved to 6 elements:
  97  |       const coverage = diagnostics.getByRole("region", {
  98  |         name: "包配置",
  99  |         exact: true,
  100 |       });
  101 |       await expect(coverage).toBeVisible();
  102 |       if (legacy) {
  103 |         await expect(coverage).toContainText("此快照未记录包配置");
  104 |         await expect(coverage).not.toContainText("包配置: 0");
  105 |       } else {
  106 |         await expect(coverage).toContainText("包配置: 1");
  107 |         await expect(coverage.getByRole("listitem")).toHaveText([
  108 |           "package.json",
  109 |         ]);
  110 |       }
  111 |       await expect(diagnostics).toContainText("已索引文件: 5");
  112 |       await coverage.scrollIntoViewIfNeeded();
  113 |       await page.screenshot({
  114 |         path: join(out, `${legacy ? "legacy" : "captured"}-zh.png`),
  115 |         fullPage: true,
  116 |       });
  117 |       await page
  118 |         .getByRole("combobox", { name: "界面语言", exact: true })
  119 |         .selectOption("en");
  120 |       const english = page.getByRole("region", {
  121 |         name: "Package manifests",
  122 |         exact: true,
  123 |       });
  124 |       if (legacy) {
  125 |         await expect(english).toContainText(
  126 |           "Package manifests were not recorded for this snapshot",
  127 |         );
  128 |         await expect(english).not.toContainText("Package manifests: 0");
  129 |       } else {
  130 |         await expect(english).toContainText("Package manifests: 1");
  131 |         await expect(english.getByRole("listitem")).toHaveText([
  132 |           "package.json",
  133 |         ]);
  134 |       }
  135 |       await openSourceDrawer(page);
  136 |       await expect(page.getByTestId("source-snippet")).toContainText(
  137 |         'return "中文 helper"',
  138 |       );
  139 |       await expect(page.locator(".navigation details").last()).toContainText(
  140 |         "Indexed files: 5",
  141 |       );
  142 |       await english.scrollIntoViewIfNeeded();
  143 |       await page.screenshot({
  144 |         path: join(out, `${legacy ? "legacy" : "captured"}-en.png`),
  145 |         fullPage: true,
  146 |       });
  147 |       // Unknowns must expose their authored call evidence and conservative reason.
  148 |       await openCodeNavigation(page);
  149 |       await page.getByRole("button", { name: /ƒ overwritten/ }).click();
  150 |       await openSourceDrawer(page);
  151 |       await expect(page.getByTestId("source-snippet")).toContainText(
  152 |         "return mod.helper()",
  153 |       );
  154 |       const unknown = snapshot.nodes.find(
  155 |         (n: { name: string }) => n.name === "overwritten",
  156 |       );
  157 |       const unknownContext = await api(`${base}/functions/${unknown.id}`);
  158 |       const reason = unknownContext.outgoing.find(
  159 |         (r: { resolution: string }) => r.resolution === "unresolved",
  160 |       ).reason;
  161 |       await expect(page.locator(".inspector")).toContainText(reason);
  162 |       await page.screenshot({
  163 |         path: join(out, `${legacy ? "legacy" : "captured"}-unknown-en.png`),
  164 |         fullPage: true,
  165 |       });
  166 |       await openCodeNavigation(page);
  167 |       await page.getByRole("button", { name: /ƒ shadowed/ }).click();
  168 |       const shadowed = snapshot.nodes.find(
  169 |         (n: { name: string }) => n.name === "shadowed",
  170 |       );
  171 |       const shadowContext = await api(`${base}/functions/${shadowed.id}`);
  172 |       for (const relation of shadowContext.outgoing) {
  173 |         expect(relation.resolution).toBe("unresolved");
  174 |         await expect(page.locator(".inspector")).toContainText(relation.reason);
  175 |       }
  176 |       const summary = await api(`${base}/summary`);
  177 |       expect(
  178 |         await mcp.call("get_project_summary", { projectId: project.id }),
  179 |       ).toEqual(summary);
  180 |       expect(
  181 |         await mcp.call("get_function_context", {
  182 |           projectId: project.id,
  183 |           nodeId: a.id,
  184 |         }),
  185 |       ).toEqual(await api(`${base}/functions/${a.id}`));
  186 |       await f.assertNotExecuted();
  187 |       expect(errors).toEqual([]);
  188 |       expect(external).toEqual([]);
  189 |       expect(protocolErrors).toEqual([]);
  190 |       expect(mcp.stderr()).toBe("");
  191 |       const evidence = {
  192 |         legacy,
  193 |         snapshotId: summary.snapshotId,
  194 |         coverage: summary.coverage,
  195 |         errors,
  196 |         external,
```