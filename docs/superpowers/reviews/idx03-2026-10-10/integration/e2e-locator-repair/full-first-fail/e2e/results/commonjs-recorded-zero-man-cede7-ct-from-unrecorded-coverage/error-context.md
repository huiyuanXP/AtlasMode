# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commonjs.spec.ts >> recorded zero manifests is distinct from unrecorded coverage
- Location: tests/e2e/commonjs.spec.ts:221:1

# Error details

```
Error: locator.click: Error: strict mode violation: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).locator('summary') resolved to 6 elements:
    1) <summary>静态分析诊断 (0)</summary> aka getByText('静态分析诊断 (0)')
    2) <summary>配置项目图</summary> aka getByText('配置项目图')
    3) <summary>…</summary> aka getByText('项目根配置 (0/0)')
    4) <summary>…</summary> aka getByText('已观察项目 (0/0)')
    5) <summary>…</summary> aka getByText('项目引用 (0/0)')
    6) <summary>…</summary> aka getByText('源码归属样本 (1/1)')

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
      - option "empty-package-scope · /tmp/atlas-package-zero-pfc8ye/empty-package-scope" [selected]
    - button "刷新代码" [ref=e9] [cursor=pointer]
    - button "切换浅色/深色" [ref=e10] [cursor=pointer]: ☾ 深色
    - combobox "界面语言" [ref=e11]:
      - option "中文" [selected]
      - option "English"
  - main [ref=e12]:
    - complementary "项目事实" [ref=e13]:
      - generic [ref=e14]:
        - text: 项目事实
        - heading "empty-package-scope" [level=1] [ref=e15]
        - code [ref=e16]: /tmp/atlas-package-zero-pfc8ye/empty-package-scope
      - paragraph [ref=e17]: 先搜索函数，或展开“浏览代码”选择入口。单击查看引用，双击进入依赖视图。
      - region "搜索函数" [ref=e18]:
        - generic [ref=e19]:
          - textbox "搜索函数" [ref=e20]:
            - /placeholder: 名称、限定名或路径
          - button "搜索" [ref=e21] [cursor=pointer]
      - group [ref=e22]:
        - generic "浏览代码" [ref=e23] [cursor=pointer]
        - option "不使用路线" [selected]
      - group [ref=e24]:
        - generic "AI 探索代码 · 连接与对话" [ref=e25] [cursor=pointer]
      - button "管理分组" [ref=e26] [cursor=pointer]
      - button "高级控件" [expanded] [active] [ref=e27] [cursor=pointer]
      - generic [ref=e28]:
        - generic [ref=e29]:
          - heading "目录职责" [level=2] [ref=e30]
          - paragraph [ref=e31]: 自然语言职责需由用户/Agent 审核；明确依赖规则会检查已有和规划关系。
          - paragraph [ref=e32]: 修改分组或目录规则将为此项目的全部规划创建新版本，并要求重新确认。
          - combobox "目录职责" [ref=e33]:
            - option "新建规则" [selected]
          - group [ref=e35]:
            - generic [ref=e36]:
              - text: 目录范围
              - textbox "目录范围" [ref=e37]:
                - /placeholder: src/
            - generic [ref=e38]:
              - text: 职责说明
              - textbox "职责说明" [ref=e39]
            - generic [ref=e40]:
              - text: 禁止依赖（每行一个目录）
              - textbox "禁止依赖（每行一个目录）" [ref=e41]:
                - /placeholder: src/internal
            - button "保存目录规则" [ref=e42] [cursor=pointer]
          - paragraph [ref=e43]: 暂无目录规则
        - group [ref=e44]:
          - generic "静态分析诊断 (0)" [ref=e45] [cursor=pointer]
    - generic [ref=e46]:
      - navigation "当前位置" [ref=e47]:
        - list [ref=e48]:
          - listitem [ref=e49]:
            - button "empty-package-scope" [ref=e50] [cursor=pointer]
      - generic [ref=e51]:
        - button "圈选函数" [ref=e52] [cursor=pointer]
        - generic [ref=e53]:
          - text: 显示层
          - combobox "显示层" [ref=e54]:
            - option "事实 + 规划" [selected]
            - option "事实"
            - option "规划"
        - generic [ref=e55]:
          - text: 新增/改接关系类型
          - combobox "新增/改接关系类型" [disabled] [ref=e56]:
            - option "调用" [selected]
            - option "必须调用"
            - option "必须复用"
      - generic [ref=e57]: 悬停预览关联，单击查看引用，双击进入依赖漏斗；所有卡片均可拖动。Esc 依次收起小地图、详情，再退出漏斗。
      - generic "代码画布" [ref=e58]:
        - application [ref=e59]:
          - generic [ref=e61]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:file:24124a8ec1357e9e97691e3e0d5d1859 to fact:function:8fcd0e05df67f4dff1c7b3de6f6f1a55" [ref=e62] [cursor=pointer]:
                    - generic [ref=e65]: 事实 · 包含
              - generic:
                - group [ref=e67]:
                  - generic [ref=e68]:
                    - generic [ref=e69]:
                      - generic [ref=e70]: ● 代码事实
                      - generic [ref=e71]: 目录
                    - strong [ref=e72]:
                      - generic [ref=e73]:
                        - generic [aria-hidden] [ref=e74]: 
                        - generic [ref=e75]: ./
                        - generic [ref=e76]: 目录
                    - code [ref=e77]: .
                - group [ref=e78]:
                  - generic [ref=e79]:
                    - generic [ref=e81]:
                      - generic [ref=e82]: ● 代码事实
                      - generic [ref=e83]: 函数
                    - strong [ref=e84]:
                      - generic [ref=e85]:
                        - generic [aria-hidden] [ref=e86]: 
                        - generic [ref=e87]: entry()
                        - generic [ref=e88]: 函数
                    - code [ref=e89]: entry.cjs
                    - generic "function entry()" [ref=e90]
                - group [ref=e92]:
                  - generic [ref=e93]:
                    - generic [ref=e95]:
                      - generic [ref=e96]: ● 代码事实
                      - generic [ref=e97]: 文件
                    - strong [ref=e98]:
                      - generic [ref=e99]:
                        - generic [aria-hidden] [ref=e100]: 
                        - generic [ref=e101]: entry.cjs
                        - generic [ref=e102]: 文件
                    - code [ref=e103]: entry.cjs
          - generic "Control Panel" [ref=e105]:
            - button "放大" [ref=e106] [cursor=pointer]
            - button "缩小" [ref=e109] [cursor=pointer]
            - button "适应画布" [ref=e112] [cursor=pointer]
            - button "切换交互" [ref=e115] [cursor=pointer]
          - complementary "已加载图的小地图" [ref=e118]:
            - button "展开小地图" [ref=e119] [cursor=pointer]
            - img "图概览" [ref=e121]
          - link "React Flow attribution" [ref=e126] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
      - generic [ref=e128]:
        - generic [ref=e129]: 代码事实查询预算：每次展开最多 80 个节点 / 240 条关系；按需可增至 300 / 900。
        - generic [ref=e130]: 布局与主题自动保存
    - complementary "详情面板" [ref=e131]:
      - region "规划审查" [ref=e132]:
        - button "暂无待审规划" [ref=e133] [cursor=pointer]:
          - generic [aria-hidden] [ref=e135]: ▾
      - navigation [ref=e136]:
        - button "查看源码" [disabled] [ref=e137]
        - button "高级编辑" [ref=e138] [cursor=pointer]
        - button "实现核对" [ref=e139] [cursor=pointer]
      - generic [ref=e140]:
        - region "变更清单" [ref=e141]:
          - heading "规划概览" [level=2] [ref=e143]
          - generic [ref=e144]:
            - text: 选择规划
            - combobox "选择规划" [ref=e145]:
              - option "选择或创建规划" [selected]
          - paragraph [ref=e146]: 选择或创建规划
        - generic [ref=e147]:
          - paragraph [ref=e148]: 还没有规划？可先手动创建，或展开下方 AI 对话。规划只叠加在图上，不修改源码。
          - button "手动创建规划" [ref=e149] [cursor=pointer]
        - group [ref=e150]:
          - generic "AI 讨论规划 · 连接与对话" [ref=e151] [cursor=pointer]
```

# Test source

```ts
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
  197 |         protocolErrors,
  198 |         unknownContext,
  199 |         shadowContext,
  200 |         observedAt: new Date().toISOString(),
  201 |         targetNotExecuted: true,
  202 |       };
  203 |       await writeFile(
  204 |         join(out, `${legacy ? "legacy" : "captured"}-evidence.json`),
  205 |         JSON.stringify(evidence, null, 2),
  206 |       );
  207 |       await testInfo.attach("package-evidence", {
  208 |         body: JSON.stringify(evidence),
  209 |         contentType: "application/json",
  210 |       });
  211 |     } finally {
  212 |       await mcp?.client.close();
  213 |       if (mcp) expect(mcp.transport.pid).toBeNull();
  214 |       await server?.stop();
  215 |       await rm(root, { recursive: true, force: true });
  216 |       await expect(access(root)).rejects.toThrow();
  217 |     }
  218 |   });
  219 | }
  220 | 
  221 | test("recorded zero manifests is distinct from unrecorded coverage", async ({
  222 |   page,
  223 |   context,
  224 | }) => {
  225 |   const root = await mkdtemp(join(tmpdir(), "atlas-package-zero-"));
  226 |   const errors: string[] = [],
  227 |     external: string[] = [];
  228 |   let server;
  229 |   try {
  230 |     const target = join(root, "empty-package-scope");
  231 |     await mkdir(target);
  232 |     await writeFile(
  233 |       join(target, "entry.cjs"),
  234 |       "exports.entry = function entry() {};\n",
  235 |     );
  236 |     server = await startProduction(join(root, "data"));
  237 |     page.on("pageerror", (e) => errors.push(e.message));
  238 |     page.on("console", (m) => {
  239 |       if (m.type() === "error") errors.push(m.text());
  240 |     });
  241 |     await denyExternalRequests(context, external);
  242 |     const project = await http(server.url, "/api/projects", "POST", {
  243 |       path: target,
  244 |     });
  245 |     await page.goto(server.url);
  246 |     await page
  247 |       .getByRole("combobox", { name: "切换项目", exact: true })
  248 |       .selectOption(project.id);
  249 |     await openAdvancedNavigation(page);
  250 |     await page
  251 |       .locator(".navigation details")
  252 |       .filter({ has: page.locator("summary", { hasText: "静态分析诊断" }) })
  253 |       .locator("summary")
> 254 |       .click();
      |        ^ Error: locator.click: Error: strict mode violation: locator('.navigation details').filter({ has: locator('summary').filter({ hasText: '静态分析诊断' }) }).locator('summary') resolved to 6 elements:
  255 |     await expect(
  256 |       page.getByRole("region", { name: "包配置", exact: true }),
  257 |     ).toHaveText("包配置: 0");
  258 |     await page
  259 |       .getByRole("combobox", { name: "界面语言", exact: true })
  260 |       .selectOption("en");
  261 |     await expect(
  262 |       page.getByRole("region", { name: "Package manifests", exact: true }),
  263 |     ).toHaveText("Package manifests: 0");
  264 |     expect(errors).toEqual([]);
  265 |     expect(external).toEqual([]);
  266 |   } finally {
  267 |     await server?.stop();
  268 |     await rm(root, { recursive: true, force: true });
  269 |     await expect(access(root)).rejects.toThrow();
  270 |   }
  271 | });
  272 | 
```