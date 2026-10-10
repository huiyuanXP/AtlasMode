# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groups-collapse.spec.ts >> group collapse preserves shared function aliases, true external call endpoints, layout and view across owned restart
- Location: tests/e2e/groups-collapse.spec.ts:17:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: '调用证据', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('region', { name: '调用证据', exact: true }) with timeout 10000ms
  - waiting for getByRole('region', { name: '调用证据', exact: true })

```

```yaml
- banner:
  - link "◈ AtlasMode 代码事实 · 图上规划":
    - /url: "#"
  - button "打开项目"
  - combobox "切换项目":
    - option "选择已打开的项目"
    - option "example · /tmp/atlas-grp02-hp31zC/example" [selected]
  - button "刷新代码"
  - button "切换浅色/深色": ☾ 深色
  - combobox "界面语言":
    - option "中文" [selected]
    - option "English"
- main:
  - complementary "项目事实":
    - text: 项目事实
    - heading "example" [level=1]
    - code: /tmp/atlas-grp02-hp31zC/example
    - paragraph: 先搜索函数，或展开“浏览代码”选择入口。单击查看引用，双击进入依赖视图。
    - region "搜索函数":
      - textbox "搜索函数":
        - /placeholder: 名称、限定名或路径
      - button "搜索"
    - group: 浏览代码
    - group: AI 探索代码 · 连接与对话
    - button "管理分组"
    - button "高级控件"
  - navigation "当前位置":
    - list:
      - listitem:
        - button "example"
  - button "圈选函数"
  - text: 显示层
  - combobox "显示层":
    - option "事实 + 规划" [selected]
    - option "事实"
    - option "规划"
  - text: 新增/改接关系类型
  - combobox "新增/改接关系类型":
    - option "调用" [selected]
    - option "必须调用"
    - option "必须复用"
  - text: 悬停预览关联，单击查看引用，双击进入依赖漏斗；所有卡片均可拖动。Esc 依次收起小地图、详情，再退出漏斗。
  - application:
    - img:
      - group "Edge from fact:file:0eb076c55db3abb740453564c8896020 to group:24a5e8ba-46f7-4d10-ae19-5454de94f8c9": 事实 · 包含 · 同一关系镜像
    - img:
      - group "Edge from fact:file:0eb076c55db3abb740453564c8896020 to group:cd5affc3-d3f6-4673-b27e-5c830e215c0d": 事实 · 包含 · 同一关系镜像
    - img:
      - group "Edge from group:24a5e8ba-46f7-4d10-ae19-5454de94f8c9 to fact:function:ee8d1f52588ed280377512e94cf7704f": 事实 · 调用 · 同一关系镜像
    - img:
      - group "Edge from group:cd5affc3-d3f6-4673-b27e-5c830e215c0d to fact:function:ee8d1f52588ed280377512e94cf7704f": 事实 · 调用 · 同一关系镜像
    - img:
      - group "Edge from group:cd5affc3-d3f6-4673-b27e-5c830e215c0d to group:24a5e8ba-46f7-4d10-ae19-5454de94f8c9": 事实 · 调用
    - img:
      - group "Edge from fact:file:2cccd5cb162760963476e70695dea15a to fact:function:ee8d1f52588ed280377512e94cf7704f": 事实 · 包含
    - img:
      - group "Edge from fact:function:14f1fd0fbb680fa2cf33f3d36ed87b53 to group:24a5e8ba-46f7-4d10-ae19-5454de94f8c9": 事实 · 调用 · 同一关系镜像
    - img:
      - group "Edge from fact:function:14f1fd0fbb680fa2cf33f3d36ed87b53 to group:cd5affc3-d3f6-4673-b27e-5c830e215c0d": 事实 · 调用 · 同一关系镜像
    - img:
      - group "Edge from fact:file:eb260aa6ba67a247bd0f7737dd082a9a to group:cd5affc3-d3f6-4673-b27e-5c830e215c0d": 事实 · 包含
    - img:
      - group "Edge from fact:file:77d9d1b7bd33702fb44153bc2913fcce to fact:function:14f1fd0fbb680fa2cf33f3d36ed87b53": 事实 · 包含
    - group:
      - text: ● 代码事实 目录
      - strong: ./ 目录
      - code: .
    - group:
      - text: ● 代码事实 文件
      - strong: a.ts 文件
      - code: one/a.ts
    - group:
      - text: ● 代码事实 文件
      - strong: b.ts 文件
      - code: two/b.ts
    - group:
      - text: ● 代码事实 函数
      - strong: caller() 函数
      - code: caller.ts
      - text: export function caller()
    - group:
      - text: ● 代码事实 文件
      - strong: caller.ts 文件
      - code: caller.ts
    - group:
      - text: ● 代码事实 目录
      - strong: one/ 目录
      - code: one
    - group:
      - text: ● 代码事实 函数
      - strong: outside() 函数
      - code: outside.ts
      - text: export function outside()
    - group:
      - text: ● 代码事实 文件
      - strong: outside.ts 文件
      - code: outside.ts
    - group:
      - text: ● 代码事实 目录
      - strong: two/ 目录
      - code: two
    - group:
      - strong: G2
      - button "展开 G2": 展开
      - paragraph: 1 / 1 已加载成员 · 0 尚未加载
      - text: 仅显示已加载范围；未加载调用关系未知 同一函数镜像 · G2
      - paragraph: 0 已加载内部调用 · 0 已加载内部计划关系
      - strong: 具体外部调用端点
      - button "alpha one/a.ts":
        - text: alpha
        - code: one/a.ts
    - group:
      - strong: G1
      - button "展开 G1": 展开
      - paragraph: 2 / 2 已加载成员 · 0 尚未加载
      - text: 仅显示已加载范围；未加载调用关系未知 同一函数镜像 · G1
      - paragraph: 1 已加载内部调用 · 0 已加载内部计划关系
      - strong: 具体外部调用端点
      - button "alpha one/a.ts":
        - text: alpha
        - code: one/a.ts
      - button "beta two/b.ts":
        - text: beta
        - code: two/b.ts
    - img
    - button "放大":
      - img
    - button "缩小":
      - img
    - button "适应画布":
      - img
    - button "切换交互":
      - img
    - complementary "已加载图的小地图":
      - button "展开小地图"
      - img "图概览"
    - link "React Flow attribution":
      - /url: https://reactflow.dev?utm_source=attribution
      - text: React Flow
  - status: "当前加载范围：分组卡片: 2 · 展开成员镜像: 0 分组视图数量另计，不包含在事实查询预算中"
  - text: 代码事实查询预算：每次展开最多 80 个节点 / 240 条关系；按需可增至 300 / 900。 布局与主题自动保存
  - complementary "详情面板":
    - region "规划审查":
      - button "暂无待审规划"
    - navigation:
      - button "查看源码" [disabled]
      - button "高级编辑"
      - button "实现核对"
    - region "变更清单":
      - heading "Approved" [level=2]
      - text: r1 · 已批准 选择规划
      - combobox "选择规划":
        - option "选择或创建规划"
        - option "Approved · r1" [selected]
      - paragraph: ✓ 当前批准有效
      - group:
        - text: 变更清单 (0)
        - paragraph: 尚无语义变更
      - button "撤销" [disabled]
      - button "重做" [disabled]
      - button "校验规划"
      - button "确认此规划" [disabled]
      - button "导出 Markdown"
      - button "导出 JSON"
      - button "核对已批准实现"
    - group: AI 讨论规划 · 连接与对话
```

# Test source

```ts
  84  |       title: "Approved",
  85  |       baselineSnapshotId: summary.snapshotId,
  86  |     });
  87  |     await page.goto(server.url);
  88  |     await page
  89  |       .getByRole("combobox", { name: "切换项目", exact: true })
  90  |       .selectOption(project.id);
  91  |     const card = (id: string) =>
  92  |       page.locator(`.group-card[data-group-id="${id}"]`);
  93  |     await expect(card(g1.id)).toBeVisible();
  94  |     await expect(card(g2.id)).toBeVisible();
  95  |     await expect(page.locator(".group-projection-summary")).toContainText(
  96  |       "分组卡片: 2 · 展开成员镜像: 3",
  97  |     );
  98  |     await expect(page.locator(".group-projection-summary")).toContainText(
  99  |       "不包含在事实查询预算中",
  100 |     );
  101 |     await expect(
  102 |       page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
  103 |     ).toHaveCount(2);
  104 |     await expect(
  105 |       page.locator(`.code-card[data-domain-id="${alpha.id}"]`).first(),
  106 |     ).toContainText("同一函数镜像");
  107 |     await page
  108 |       .getByRole("combobox", { name: "选择规划", exact: true })
  109 |       .selectOption(plan.plan.id);
  110 |     await page.getByRole("button", { name: "确认此规划", exact: true }).click();
  111 |     await expect(page.locator(".plan-overview")).toContainText("当前批准有效");
  112 |     await card(g1.id)
  113 |       .getByRole("button", { name: "折叠 G1", exact: true })
  114 |       .click();
  115 |     await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
  116 |     await expect(card(g1.id)).toContainText("1 已加载内部调用");
  117 |     await expect(
  118 |       page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
  119 |     ).toHaveCount(1);
  120 |     await card(g2.id)
  121 |       .getByRole("button", { name: "折叠 G2", exact: true })
  122 |       .click();
  123 |     await expect(card(g2.id)).toHaveAttribute("data-collapsed", "true");
  124 |     const firstBounds = await card(g1.id).boundingBox(),
  125 |       secondBounds = await card(g2.id).boundingBox();
  126 |     expect(firstBounds).not.toBeNull();
  127 |     expect(secondBounds).not.toBeNull();
  128 |     expect(
  129 |       Math.min(
  130 |         firstBounds!.y + firstBounds!.height,
  131 |         secondBounds!.y + secondBounds!.height,
  132 |       ) - Math.max(firstBounds!.y, secondBounds!.y),
  133 |     ).toBeLessThanOrEqual(0);
  134 | 
  135 |     await expect(
  136 |       page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
  137 |     ).toHaveCount(0);
  138 |     await expect(
  139 |       card(g1.id).locator(`.group-endpoint[data-domain-id="${alpha.id}"]`),
  140 |     ).toContainText("one/a.ts");
  141 |     const graph = await http(
  142 |       server.url,
  143 |       `/api/projects/${project.id}/subgraph`,
  144 |       "POST",
  145 |       { nodeIds: [alpha.id, beta.id, outside.id], depth: 1, budget: 100 },
  146 |     );
  147 |     const relation = graph.relations.find(
  148 |       (r) => r.sourceId === alpha.id && r.targetId === outside.id,
  149 |     );
  150 |     expect(relation).toBeTruthy();
  151 |     const projected = page.locator(
  152 |       `.react-flow__edge[data-id^="group-edge:fact:${relation.id}:"]`,
  153 |     );
  154 |     await expect(projected).toHaveCount(2);
  155 |     await page.getByRole("button", { name: "适应画布", exact: true }).click();
  156 |     const clickPoint = await projected
  157 |       .first()
  158 |       .locator(".react-flow__edge-interaction")
  159 |       .evaluate((path: SVGPathElement) => {
  160 |         const matrix = path.getScreenCTM()!,
  161 |           length = path.getTotalLength(),
  162 |           id = path.closest(".react-flow__edge")!.getAttribute("data-id");
  163 |         for (let fraction = 0.1; fraction < 0.95; fraction += 0.05) {
  164 |           const point = path
  165 |             .getPointAtLength(length * fraction)
  166 |             .matrixTransform(matrix);
  167 |           if (
  168 |             document
  169 |               .elementFromPoint(point.x, point.y)
  170 |               ?.closest(".react-flow__edge")
  171 |               ?.getAttribute("data-id") === id
  172 |           )
  173 |             return { x: point.x, y: point.y };
  174 |         }
  175 |         throw new Error(
  176 |           "No unobstructed real click point on the requested relation",
  177 |         );
  178 |       });
  179 |     await page.mouse.click(clickPoint.x, clickPoint.y);
  180 |     const evidence = page.getByRole("region", {
  181 |       name: "调用证据",
  182 |       exact: true,
  183 |     });
> 184 |     await expect(evidence).toBeVisible();
      |                            ^ Error: expect(locator).toBeVisible() failed
  185 |     await expect(evidence).toContainText("alpha");
  186 |     await expect(evidence).toContainText("outside");
  187 |     await expect(evidence).toContainText(
  188 |       `${relation.evidence.filePath}:${relation.evidence.line}`,
  189 |     );
  190 |     await expect(evidence).toContainText(relation.id);
  191 |     await page.screenshot({
  192 |       path: resolve("artifacts/e2e/grp02-collapsed-endpoints.png"),
  193 |       fullPage: true,
  194 |     });
  195 |     await evidence
  196 |       .getByRole("button", { name: "查看调用方", exact: true })
  197 |       .click();
  198 |     await expect(
  199 |       page.getByRole("region", { name: "引用详情", exact: true }),
  200 |     ).toContainText("alpha");
  201 |     await expect(
  202 |       page.getByRole("region", { name: "引用详情", exact: true }),
  203 |     ).toContainText("one/a.ts");
  204 |     await page
  205 |       .getByRole("region", { name: "引用详情", exact: true })
  206 |       .getByRole("button", { name: "查看源码", exact: true })
  207 |       .click();
  208 |     await expect(page.getByTestId("inspection-source")).toContainText(
  209 |       "return outside()",
  210 |     );
  211 |     await page.keyboard.press("Escape");
  212 |     const box = await card(g1.id).boundingBox();
  213 |     expect(box).not.toBeNull();
  214 |     await page.mouse.move(box!.x + 30, box!.y + 14);
  215 |     await page.mouse.down();
  216 |     await page.mouse.move(box!.x + 120, box!.y + 70, { steps: 12 });
  217 |     await page.mouse.up();
  218 |     await expect
  219 |       .poll(async () => {
  220 |         const view = await http(
  221 |           server!.url,
  222 |           `/api/projects/${project.id}/view`,
  223 |         );
  224 |         return Object.keys(view.positions).includes(`group:${g1.id}`);
  225 |       })
  226 |       .toBe(true);
  227 |     const saved = await http(server.url, `/api/projects/${project.id}/view`);
  228 |     expect(saved.collapsedGroupIds.sort()).toEqual([g1.id, g2.id].sort());
  229 |     expect((await http(server.url, `/api/plans/${plan.plan.id}`)).valid).toBe(
  230 |       true,
  231 |     );
  232 |     await page.getByRole("button", { name: "圈选函数", exact: true }).click();
  233 |     await expect(page.locator(".group-card")).toHaveCount(0);
  234 |     await expect(
  235 |       page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
  236 |     ).toHaveCount(1);
  237 |     await page.getByRole("button", { name: "完成圈选", exact: true }).click();
  238 |     await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
  239 |     await page.reload();
  240 |     await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
  241 |     const port = server.port;
  242 |     await server.stop();
  243 |     server = await startProduction(data, port);
  244 |     await page.reload();
  245 |     await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
  246 |     await expect(card(g2.id)).toHaveAttribute("data-collapsed", "true");
  247 |     expect(
  248 |       (await http(server.url, `/api/projects/${project.id}/view`)).positions,
  249 |     ).toEqual(saved.positions);
  250 |     await card(g1.id)
  251 |       .getByRole("button", { name: "展开 G1", exact: true })
  252 |       .click();
  253 |     await expect(
  254 |       page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
  255 |     ).toHaveCount(1);
  256 |     await card(g2.id)
  257 |       .getByRole("button", { name: "展开 G2", exact: true })
  258 |       .click();
  259 |     await expect(
  260 |       page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
  261 |     ).toHaveCount(2);
  262 |     await page.getByRole("button", { name: "适应画布", exact: true }).click();
  263 |     await page.screenshot({
  264 |       path: resolve("artifacts/e2e/grp02-expanded-shared.png"),
  265 |       fullPage: true,
  266 |     });
  267 |     // Alias inspection and new planning handles must resolve domain IDs, never view IDs.
  268 |     await page
  269 |       .getByRole("combobox", { name: "选择规划", exact: true })
  270 |       .selectOption(plan.plan.id);
  271 |     await page.getByRole("button", { name: "适应画布", exact: true }).click();
  272 |     await page
  273 |       .locator(
  274 |         `.code-card[data-group-id="${g1.id}"][data-domain-id="${alpha.id}"]`,
  275 |       )
  276 |       .click();
  277 |     await expect(
  278 |       page.getByRole("region", { name: "引用详情", exact: true }),
  279 |     ).toContainText("one/a.ts");
  280 |     await page.keyboard.press("Escape");
  281 |     await page.getByRole("button", { name: "适应画布", exact: true }).click();
  282 |     await page
  283 |       .getByRole("combobox", { name: "新增/改接关系类型", exact: true })
  284 |       .selectOption("must_call");
```