# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pol01-structure.spec.ts >> production native policy edit/import retains unsent input and actual 409 requires explicit reload
- Location: tests/e2e/pol01-structure.spec.ts:41:1

# Error details

```
TimeoutError: page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - link "◈ AtlasMode Code facts · Visual planning" [ref=e5] [cursor=pointer]:
      - /url: "#"
      - text: ◈ AtlasMode
      - generic [ref=e6]: Code facts · Visual planning
    - button "Open project" [ref=e7] [cursor=pointer]
    - combobox "Switch project" [ref=e8]:
      - option "Choose an opened project"
      - option "project · /tmp/atlas-pol01-acceptance-EABAcR/project" [selected]
    - button "Refresh code" [ref=e9] [cursor=pointer]
    - button "Toggle light/dark" [ref=e10] [cursor=pointer]: ☾ Dark
    - combobox "Interface language" [ref=e11]:
      - option "中文"
      - option "English" [selected]
  - main [ref=e12]:
    - complementary "Project facts" [ref=e13]:
      - generic [ref=e14]:
        - text: Project facts
        - heading "project" [level=1] [ref=e15]
        - code [ref=e16]: /tmp/atlas-pol01-acceptance-EABAcR/project
      - paragraph [ref=e17]: Search for a function, or open Browse code to choose an entry. Click to inspect references; double-click for dependencies.
      - region "Search functions" [ref=e18]:
        - generic [ref=e19]:
          - textbox "Search functions" [ref=e20]:
            - /placeholder: Name, qualified name or path
          - button "Search" [ref=e21] [cursor=pointer]
      - group [ref=e22]:
        - generic "Browse code" [ref=e23] [cursor=pointer]
        - generic [ref=e24]:
          - heading "Entry candidates 1/1" [level=2] [ref=e25]:
            - text: Entry candidates
            - generic [ref=e26]: 1/1
          - paragraph [ref=e27]: "TS/JS: explicit exports; Python: public top-level names. These are candidates, not confirmed runtime entries."
          - button "ƒ owned src/main.ts" [ref=e29] [cursor=pointer]:
            - strong [ref=e30]: ƒ owned
            - generic [ref=e31]: src/main.ts
        - generic [ref=e32]:
          - heading "Browse routes" [level=2] [ref=e33]
          - combobox "Browse routes" [ref=e34]:
            - option "No route" [selected]
          - paragraph [ref=e35]: A route is an explanation sequence; it does not imply calls.
      - group [ref=e36]:
        - generic "AI exploration · connection and chat" [ref=e37] [cursor=pointer]
      - button "Manage groups" [ref=e38] [cursor=pointer]
      - button "Advanced controls" [expanded] [ref=e39] [cursor=pointer]
      - generic [ref=e40]:
        - generic [ref=e41]:
          - heading "Folder policies" [level=2] [ref=e42]
          - paragraph [ref=e43]:
            - code [ref=e44]: .codemap/structure.json
            - text: · schema v1
          - paragraph [ref=e45]: Edit directory purpose or legacy path rules. Descriptive metadata does not prove a dependency rule is satisfied.
          - button "Read structure again" [ref=e46] [cursor=pointer]
          - paragraph [ref=e47]:
            - text: "Structure status: ready · r1File digest:"
            - code [ref=e48]: 4147191e374490e82ed19533b3e37f26e099676c157c5d09711b52762c431e0a
            - text: "Verified: 2026-10-11T01:47:20.013Z"
          - status [ref=e49]: Saved. Read again before another edit.
          - generic [ref=e50]:
            - button "New policy" [ref=e51] [cursor=pointer]
            - button "New file folder" [ref=e52] [cursor=pointer]
          - generic [ref=e53]:
            - text: Edit policy
            - combobox "Edit policy" [ref=e54]:
              - option "New policy"
              - option "New file folder"
              - option "src · 用户职责说明；待人工判断"
              - option "src · DB original" [selected]
          - group [ref=e56]:
            - generic [ref=e57]:
              - text: Path prefix
              - textbox "Path prefix" [ref=e58]:
                - /placeholder: src/
                - text: src
            - generic [ref=e59]:
              - text: Purpose
              - textbox "Purpose" [ref=e60]: DB edit A
            - generic [ref=e61]:
              - text: Forbidden dependencies
              - textbox "Forbidden dependencies" [ref=e62]:
                - /placeholder: src/internal
                - text: vendor
            - button "Save policy" [disabled] [ref=e63]
          - heading "Legacy path policies" [level=3] [ref=e64]
          - article [ref=e65]:
            - strong [ref=e66]: src
            - paragraph [ref=e67]: DB original
            - generic [ref=e68]: Database policy; not migrated · Existing target-path checks
            - text: Forbidden dependencies
            - list [ref=e69]:
              - listitem [ref=e70]:
                - code [ref=e71]: vendor
          - heading "structure.json folders" [level=3] [ref=e72]
          - paragraph [ref=e73]: Purpose description; requires human judgment
          - article [ref=e74]:
            - strong [ref=e75]: src
            - paragraph [ref=e76]: 用户职责说明；待人工判断
          - group [ref=e77]:
            - generic "Read-only metadata" [ref=e78] [cursor=pointer]
          - paragraph [ref=e79]: Preview first. Import is explicit and invalidates current approval; historical approvals remain recorded.
          - button "Preview DB policy migration" [disabled] [ref=e80]
        - group [ref=e81]:
          - generic "Static analysis diagnostics (0)" [ref=e82] [cursor=pointer]
    - generic [ref=e83]:
      - navigation "Location" [ref=e84]:
        - list [ref=e85]:
          - listitem [ref=e86]:
            - button "project" [ref=e87] [cursor=pointer]
      - generic [ref=e88]:
        - generic "Plan ownership" [ref=e89]:
          - button "Layout" [pressed] [ref=e90] [cursor=pointer]
          - button "Plan ownership" [disabled] [ref=e91]
        - button "Circle-select functions" [ref=e92] [cursor=pointer]
        - generic [ref=e93]:
          - text: Visible layers
          - combobox "Visible layers" [ref=e94]:
            - option "Facts + plan" [selected]
            - option "Fact"
            - option "Plan"
        - generic [ref=e95]:
          - text: New/reconnected relation type
          - combobox "New/reconnected relation type" [disabled] [ref=e96]:
            - option "Calls" [selected]
            - option "Must call"
            - option "Must reuse"
      - generic [ref=e97]: Hover to preview links, click for references, double-click for the dependency funnel. Drag any card. Esc closes the map, then details, then the funnel.
      - generic "Code canvas" [ref=e98]:
        - application [ref=e99]:
          - generic [ref=e101]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:file:5572a3f82cd1b0199fda090cf69241eb to fact:function:f689bd1db103d7b65d50755dc31b7f45" [ref=e102] [cursor=pointer]:
                    - generic [ref=e105]: Fact · Contains
              - generic:
                - group [ref=e107]:
                  - generic [ref=e108]:
                    - generic [ref=e109]:
                      - generic [ref=e110]: ● Code fact
                      - generic [ref=e111]: Folder
                    - strong [ref=e112]:
                      - generic [ref=e113]:
                        - generic [aria-hidden] [ref=e114]: 
                        - generic [ref=e115]: ./
                        - generic [ref=e116]: Folder
                    - code [ref=e117]: .
                - group [ref=e118]:
                  - generic [ref=e119]:
                    - generic [ref=e121]:
                      - generic [ref=e122]: ● Code fact
                      - generic [ref=e123]: File
                    - strong [ref=e124]:
                      - generic [ref=e125]:
                        - generic [aria-hidden] [ref=e126]: 
                        - generic [ref=e127]: main.ts
                        - generic [ref=e128]: File
                    - code [ref=e129]: src/main.ts
                - group [ref=e131]:
                  - generic [ref=e132]:
                    - generic [ref=e134]:
                      - generic [ref=e135]: ● Code fact
                      - generic [ref=e136]: Function
                    - strong [ref=e137]:
                      - generic [ref=e138]:
                        - generic [aria-hidden] [ref=e139]: 
                        - generic [ref=e140]: owned()
                        - generic [ref=e141]: Function
                    - code [ref=e142]: src/main.ts
                    - generic "export function owned()" [ref=e143]
                - group [ref=e145]:
                  - generic [ref=e146]:
                    - generic [ref=e147]:
                      - generic [ref=e148]: ● Code fact
                      - generic [ref=e149]: Folder
                    - strong [ref=e150]:
                      - generic [ref=e151]:
                        - generic [aria-hidden] [ref=e152]: 
                        - generic [ref=e153]: src/
                        - generic [ref=e154]: Folder
                    - code [ref=e155]: src
          - generic "Control Panel" [ref=e156]:
            - button "Zoom in" [ref=e157] [cursor=pointer]
            - button "Zoom out" [ref=e160] [cursor=pointer]
            - button "Fit view" [ref=e163] [cursor=pointer]
            - button "Toggle interaction" [ref=e166] [cursor=pointer]
          - complementary "Map of the loaded graph" [ref=e169]:
            - button "Expand map" [ref=e170] [cursor=pointer]
            - img "Graph overview" [ref=e172]
          - link "React Flow attribution" [ref=e178] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
        - group [ref=e180]:
          - generic "⚠ Scope and uncertainty (1)" [ref=e181] [cursor=pointer]
      - generic [ref=e182]:
        - generic [ref=e183]: "Code fact query budget: Expansion: up to 80 nodes / 240 relations; optionally 300 / 900."
        - generic [ref=e184]: Layout, theme and language saved automatically
    - complementary "Details panel" [ref=e185]:
      - region "Plan review" [ref=e186]:
        - button "No plans awaiting review" [ref=e187] [cursor=pointer]:
          - generic [aria-hidden] [ref=e189]: ▾
      - navigation [ref=e190]:
        - button "View source" [disabled] [ref=e191]
        - button "Advanced editing" [ref=e192] [cursor=pointer]
        - button "Implementation check" [ref=e193] [cursor=pointer]
        - button "Knowledge notes" [ref=e194] [cursor=pointer]
      - generic [ref=e195]:
        - region "Change list" [ref=e196]:
          - heading "Plan overview" [level=2] [ref=e198]
          - generic [ref=e199]:
            - text: Choose plan
            - combobox "Choose plan" [ref=e200]:
              - option "Choose or create a plan" [selected]
          - paragraph [ref=e201]: Choose or create a plan
        - generic [ref=e202]:
          - paragraph [ref=e203]: No plan yet? Create one manually, or open the AI conversation below. Plans overlay the graph without modifying source.
          - button "Create a plan manually" [ref=e204] [cursor=pointer]
        - group [ref=e205]:
          - generic "AI planning · connection and chat" [ref=e206] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import { readFile, writeFile } from "node:fs/promises";
  3   | import type { StructureState } from "@codemap/core";
  4   | import { legacyId, pol01Fixture, v1 } from "../support/pol01-acceptance.js";
  5   | // Main enables only after mounted callbacks and the compiled candidate are frozen.
  6   | // Discovery/skips are UNRUN evidence; no HTTP interception or DOM injection is used.
  7   | test.skip(
  8   |   process.env.POL01_PRODUCTION_GATE !== "1",
  9   |   "UNRUN: shared mounted callbacks + compiled candidate gate not authorized",
  10  | );
  11  | async function openPanel(
  12  |   page: Page,
  13  |   f: Awaited<ReturnType<typeof pol01Fixture>>,
  14  | ) {
  15  |   await f.json(`/api/projects/${f.project.id}/view`, "PUT", {
  16  |     positions: {},
  17  |     theme: "light",
  18  |     locale: "en",
  19  |   });
  20  |   await page.goto(f.url());
  21  |   await page
  22  |     .getByRole("combobox", { name: /^(Switch project|切换项目)$/ })
  23  |     .selectOption(f.project.id);
  24  |   const navigation = page.locator(".compact-navigation");
  25  |   if ((await navigation.getAttribute("open")) === null)
  26  |     await navigation.locator(":scope > summary").click();
  27  |   const advanced = page.getByRole("button", {
  28  |     name: "Advanced controls",
  29  |     exact: true,
  30  |   });
  31  |   if ((await advanced.getAttribute("aria-expanded")) !== "true")
  32  |     await advanced.click();
  33  |   const panel = page.locator("section.knowledge-panel").filter({
  34  |     has: page.getByRole("heading", { name: "Folder policies", exact: true }),
  35  |   });
  36  |   await expect(panel).toBeVisible();
  37  |   await expect(panel.locator('[data-action="save"]')).toBeEnabled();
  38  |   return panel;
  39  | }
  40  | 
  41  | test("production native policy edit/import retains unsent input and actual 409 requires explicit reload", async ({
  42  |   page,
  43  | }, testInfo) => {
  44  |   const f = await pol01Fixture("compiled");
  45  |   try {
  46  |     const panel = await openPanel(page, f),
  47  |       original = await readFile(f.path);
  48  |     for (const action of [
  49  |       "reload",
  50  |       "new-policy",
  51  |       "new-folder",
  52  |       "save",
  53  |       "preview",
  54  |     ])
  55  |       await expect(panel.locator(`[data-action="${action}"]`)).toBeVisible();
  56  |     await panel
  57  |       .getByRole("combobox", { name: "Edit policy" })
  58  |       .selectOption(`legacy:${legacyId}`);
  59  |     await panel
  60  |       .getByRole("textbox", { name: "Purpose", exact: true })
  61  |       .fill("DB edit A");
> 62  |     const dbSave = page.waitForResponse(
      |                         ^ TimeoutError: page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"
  63  |       (r) =>
  64  |         r.url().endsWith(`/api/projects/${f.project.id}/policies`) &&
  65  |         r.request().method() === "POST",
  66  |     );
  67  |     await panel.locator('[data-action="save"]').click();
  68  |     expect((await dbSave).status()).toBe(200);
  69  |     await expect(panel.locator('[data-action="reload"]')).toBeEnabled();
  70  |     expect(await readFile(f.path)).toEqual(original);
  71  |     await panel.locator('[data-action="reload"]').click();
  72  |     await expect(panel.locator('[data-action="save"]')).toBeEnabled();
  73  |     await panel
  74  |       .getByRole("combobox", { name: "Edit policy" })
  75  |       .selectOption(`legacy:${legacyId}`);
  76  |     await panel
  77  |       .getByRole("textbox", { name: "Purpose", exact: true })
  78  |       .fill("unsent local B");
  79  |     await panel.locator('[data-action="preview"]').click();
  80  |     await expect(panel.locator('[data-action="import"]')).toBeVisible();
  81  |     const imported = page.waitForResponse(
  82  |       (r) =>
  83  |         r.url().endsWith(`/api/projects/${f.project.id}/structure`) &&
  84  |         r.request().method() === "PUT",
  85  |     );
  86  |     await panel.locator('[data-action="import"]').click();
  87  |     expect((await imported).status()).toBe(200);
  88  |     await expect(
  89  |       panel.getByRole("textbox", { name: "Purpose", exact: true }),
  90  |     ).toHaveValue("unsent local B");
  91  |     await expect(
  92  |       panel
  93  |         .getByRole("status")
  94  |         .filter({ hasText: "form edits remain unsaved" }),
  95  |     ).toBeVisible();
  96  |     expect(
  97  |       JSON.parse(await readFile(f.path, "utf8"))["x-atlasmode"]
  98  |         .legacyPathPolicies[0].purpose,
  99  |     ).toBe("DB edit A");
  100 |     await panel.locator('[data-action="reload"]').click();
  101 |     await expect(panel.locator('[data-action="save"]')).toBeEnabled();
  102 |     await panel
  103 |       .getByRole("combobox", { name: "Edit policy" })
  104 |       .selectOption("folder:src");
  105 |     await panel
  106 |       .getByRole("textbox", { name: "Purpose", exact: true })
  107 |       .fill("draft after conflict");
  108 |     const external = JSON.parse(await readFile(f.path, "utf8"));
  109 |     external.folders[0].purpose = "external changed";
  110 |     await writeFile(f.path, JSON.stringify(external));
  111 |     const conflict = page.waitForResponse(
  112 |       (r) =>
  113 |         r.url().endsWith(`/api/projects/${f.project.id}/structure`) &&
  114 |         r.request().method() === "PUT",
  115 |     );
  116 |     await panel.locator('[data-action="save"]').click();
  117 |     expect((await conflict).status()).toBe(409);
  118 |     await expect(
  119 |       panel.getByRole("textbox", { name: "Purpose", exact: true }),
  120 |     ).toHaveValue("draft after conflict");
  121 |     await expect(panel.locator('[data-action="save"]')).toBeDisabled();
  122 |     expect(JSON.parse(await readFile(f.path, "utf8")).folders[0].purpose).toBe(
  123 |       "external changed",
  124 |     );
  125 |     await panel.locator('[data-action="reload"]').click();
  126 |     await expect(panel.locator('[data-action="save"]')).toBeEnabled();
  127 |     const saved = page.waitForResponse(
  128 |       (r) =>
  129 |         r.url().endsWith(`/api/projects/${f.project.id}/structure`) &&
  130 |         r.request().method() === "PUT",
  131 |     );
  132 |     await panel.locator('[data-action="save"]').click();
  133 |     expect((await saved).status()).toBe(200);
  134 |     const document = JSON.parse(await readFile(f.path, "utf8"));
  135 |     expect(document.folders[0]).toEqual(v1("draft after conflict").folders[0]);
  136 |     expect(document.ownerMetadata).toEqual(v1().ownerMetadata);
  137 |     expect(document.dependencyRules).toEqual(v1().dependencyRules);
  138 |     await f.invariants();
  139 |     await testInfo.attach("native-policy-panel", {
  140 |       body: await page.screenshot(),
  141 |       contentType: "image/png",
  142 |     });
  143 |   } finally {
  144 |     await f.close();
  145 |     await testInfo.attach("owned-runtime-receipt", {
  146 |       path: `${f.root}/runtime-receipt.json`,
  147 |       contentType: "application/json",
  148 |     });
  149 |   }
  150 | });
  151 | 
  152 | test("production native quarantine disables writing and owned restart preserves invalid file bytes", async ({
  153 |   page,
  154 | }, testInfo) => {
  155 |   const f = await pol01Fixture("compiled");
  156 |   try {
  157 |     const panel = await openPanel(page, f);
  158 |     const malformed =
  159 |       '{"schemaVersion":999,"folders":[],"dependencyRules":[],"unknown":"never silently overwrite"}';
  160 |     await writeFile(f.path, malformed);
  161 |     await panel.locator('[data-action="reload"]').click();
  162 |     await expect(panel).toContainText("Structure status: invalid");
```