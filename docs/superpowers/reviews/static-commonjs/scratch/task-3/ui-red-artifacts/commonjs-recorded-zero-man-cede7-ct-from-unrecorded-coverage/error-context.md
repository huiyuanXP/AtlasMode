# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commonjs.spec.ts >> recorded zero manifests is distinct from unrecorded coverage
- Location: tests/e2e/commonjs.spec.ts:208:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByRole('region', { name: '包配置', exact: true })
Expected: "包配置: 0"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" getByRole('region', { name: '包配置', exact: true }) with timeout 10000ms
  - waiting for getByRole('region', { name: '包配置', exact: true })

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
    - option "empty-package-scope · /tmp/atlas-package-zero-tflKuK/empty-package-scope" [selected]
  - button "刷新代码"
  - button "切换浅色/深色": ☾ 深色
  - combobox "界面语言":
    - option "中文" [selected]
    - option "English"
- main:
  - complementary "项目事实":
    - text: 项目事实
    - heading "empty-package-scope" [level=1]
    - code: /tmp/atlas-package-zero-tflKuK/empty-package-scope
    - strong: "1"
    - text: 函数/类
    - strong: "1"
    - text: 文件
    - paragraph: "调用: 0 已解析 · 0 未解析 · 0 外部依赖"
    - heading "入口候选 1/1" [level=2]
    - paragraph: TS/JS：显式导出；Python：顶层公开命名约定。均非运行时确认入口。
    - button "ƒ entry entry.cjs":
      - strong: ƒ entry
      - text: entry.cjs
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
      - paragraph: "已索引文件: 1"
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
    - group:
      - text: ● 代码事实 目录
      - strong: .
      - code: .
    - group:
      - text: ● 代码事实 函数
      - strong: entry
      - code: entry.cjs
      - text: function entry()
    - group:
      - text: ● 代码事实 文件
      - strong: entry.cjs
      - code: entry.cjs
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
    - paragraph: 选择节点以查看文件、签名和源码。
```

# Test source

```ts
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
  193 |       );
  194 |       await testInfo.attach("package-evidence", {
  195 |         body: JSON.stringify(evidence),
  196 |         contentType: "application/json",
  197 |       });
  198 |     } finally {
  199 |       await mcp?.client.close();
  200 |       if (mcp) expect(mcp.transport.pid).toBeNull();
  201 |       await server?.stop();
  202 |       await rm(root, { recursive: true, force: true });
  203 |       await expect(access(root)).rejects.toThrow();
  204 |     }
  205 |   });
  206 | }
  207 | 
  208 | test("recorded zero manifests is distinct from unrecorded coverage", async ({
  209 |   page,
  210 |   context,
  211 | }) => {
  212 |   const root = await mkdtemp(join(tmpdir(), "atlas-package-zero-"));
  213 |   const errors: string[] = [],
  214 |     external: string[] = [];
  215 |   let server;
  216 |   try {
  217 |     const target = join(root, "empty-package-scope");
  218 |     await mkdir(target);
  219 |     await writeFile(
  220 |       join(target, "entry.cjs"),
  221 |       "exports.entry = function entry() {};\n",
  222 |     );
  223 |     server = await startProduction(join(root, "data"));
  224 |     page.on("pageerror", (e) => errors.push(e.message));
  225 |     page.on("console", (m) => {
  226 |       if (m.type() === "error") errors.push(m.text());
  227 |     });
  228 |     await context.route("**/*", (route) => {
  229 |       if (
  230 |         !["127.0.0.1", "localhost", "[::1]"].includes(
  231 |           new URL(route.request().url()).hostname,
  232 |         )
  233 |       ) {
  234 |         external.push(route.request().url());
  235 |         return route.abort("blockedbyclient");
  236 |       }
  237 |       return route.continue();
  238 |     });
  239 |     const project = await http(server.url, "/api/projects", "POST", {
  240 |       path: target,
  241 |     });
  242 |     await page.goto(server.url);
  243 |     await page
  244 |       .getByRole("combobox", { name: "切换项目", exact: true })
  245 |       .selectOption(project.id);
  246 |     await page
  247 |       .locator(".navigation details")
  248 |       .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) })
  249 |       .locator("summary")
  250 |       .click();
  251 |     await expect(
  252 |       page.getByRole("region", { name: "包配置", exact: true }),
> 253 |     ).toHaveText("包配置: 0");
      |       ^ Error: expect(locator).toHaveText(expected) failed
  254 |     await page
  255 |       .getByRole("combobox", { name: "界面语言", exact: true })
  256 |       .selectOption("en");
  257 |     await expect(
  258 |       page.getByRole("region", { name: "Package manifests", exact: true }),
  259 |     ).toHaveText("Package manifests: 0");
  260 |     expect(errors).toEqual([]);
  261 |     expect(external).toEqual([]);
  262 |   } finally {
  263 |     await server?.stop();
  264 |     await rm(root, { recursive: true, force: true });
  265 |     await expect(access(root)).rejects.toThrow();
  266 |   }
  267 | });
  268 | 
```