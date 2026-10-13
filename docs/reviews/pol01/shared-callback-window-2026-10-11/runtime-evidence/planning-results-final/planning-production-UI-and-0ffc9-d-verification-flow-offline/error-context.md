# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: planning.spec.mjs >> production UI and SDK share the complete planning, approval, persistence and verification flow offline
- Location: tests/e2e/planning.spec.mjs:18:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "console: Failed to load resource: the server responded with a status of 409 (Conflict)",
+   "console: Failed to load resource: the server responded with a status of 409 (Conflict)",
+   "console: Failed to load resource: the server responded with a status of 409 (Conflict)",
+ ]
```

# Page snapshot

```yaml
- generic [ref=f2e3]:
  - banner [ref=f2e4]:
    - link "◈ AtlasMode Code facts · Visual planning" [ref=f2e5] [cursor=pointer]:
      - /url: "#"
      - text: ◈ AtlasMode
      - generic [ref=f2e6]: Code facts · Visual planning
    - button "Open project" [ref=f2e7] [cursor=pointer]
    - combobox "Switch project" [ref=f2e8]:
      - option "Choose an opened project"
      - option "python · /tmp/atlas-e2e-z5bG4v/python"
      - option "typescript · /tmp/atlas-e2e-z5bG4v/typescript" [selected]
    - button "Refresh code" [ref=f2e9] [cursor=pointer]
    - button "Toggle light/dark" [ref=f2e10] [cursor=pointer]: ☀ Light
    - combobox "Interface language" [ref=f2e11]:
      - option "中文"
      - option "English" [selected]
  - main [ref=f2e12]:
    - complementary "Project facts" [ref=f2e13]:
      - generic [ref=f2e14]:
        - text: Project facts
        - heading "typescript" [level=1] [ref=f2e15]
        - code [ref=f2e16]: /tmp/atlas-e2e-z5bG4v/typescript
      - paragraph [ref=f2e17]: Search for a function, or open Browse code to choose an entry. Click to inspect references; double-click for dependencies.
      - region "Search functions" [ref=f2e18]:
        - generic [ref=f2e19]:
          - textbox "Search functions" [ref=f2e20]:
            - /placeholder: Name, qualified name or path
          - button "Search" [ref=f2e21] [cursor=pointer]
      - group [ref=f2e22]:
        - generic "Browse code" [ref=f2e23] [cursor=pointer]
        - option "No route" [selected]
        - option "Actual call chain"
        - option "Reuse walkthrough"
      - group [ref=f2e24]:
        - generic "AI exploration · connection and chat" [ref=f2e25] [cursor=pointer]
      - button "Manage groups" [ref=f2e26] [cursor=pointer]
      - button "Advanced controls" [ref=f2e27] [cursor=pointer]
    - generic [ref=f2e28]:
      - navigation "Location" [ref=f2e29]:
        - list [ref=f2e30]:
          - listitem [ref=f2e31]:
            - button "typescript" [ref=f2e32] [cursor=pointer]
      - generic [ref=f2e33]:
        - generic "Plan ownership" [ref=f2e34]:
          - button "Layout" [pressed] [ref=f2e35] [cursor=pointer]
          - button "Plan ownership" [disabled] [ref=f2e36]
        - button "Circle-select functions" [ref=f2e37] [cursor=pointer]
        - generic [ref=f2e38]:
          - text: Visible layers
          - combobox "Visible layers" [ref=f2e39]:
            - option "Facts + plan" [selected]
            - option "Fact"
            - option "Plan"
        - generic [ref=f2e40]:
          - text: New/reconnected relation type
          - combobox "New/reconnected relation type" [disabled] [ref=f2e41]:
            - option "Calls" [selected]
            - option "Must call"
            - option "Must reuse"
      - generic [ref=f2e42]: Hover to preview links, click for references, double-click for the dependency funnel. Drag any card. Esc closes the map, then details, then the funnel.
      - generic "Code canvas" [ref=f2e43]:
        - application [ref=f2e44]:
          - generic [ref=f2e46]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:file:970440b18763062bafbf838e0e2b6c41 to group-member:24053e9c-bd42-480b-a732-659dfdf79a31:function:b4c84d591dccc6a761c5b2e17fb96331" [ref=f2e47] [cursor=pointer]:
                    - generic [ref=f2e50]: Fact · Contains · same relation mirrored
                - img:
                  - group "Edge from fact:file:970440b18763062bafbf838e0e2b6c41 to group-member:c06dc95a-cf43-4207-a813-880801b8f864:function:b4c84d591dccc6a761c5b2e17fb96331" [ref=f2e52] [cursor=pointer]:
                    - generic [ref=f2e55]: Fact · Contains · same relation mirrored
                - img:
                  - group "Edge from fact:function:7ab1e575068aa94a09429eaac0bf2468 to group-member:24053e9c-bd42-480b-a732-659dfdf79a31:function:b4c84d591dccc6a761c5b2e17fb96331" [ref=f2e57] [cursor=pointer]:
                    - generic [ref=f2e60]: Fact · Calls · same relation mirrored
                - img:
                  - group "Edge from fact:function:7ab1e575068aa94a09429eaac0bf2468 to group-member:c06dc95a-cf43-4207-a813-880801b8f864:function:b4c84d591dccc6a761c5b2e17fb96331" [ref=f2e62] [cursor=pointer]:
                    - generic [ref=f2e65]: Fact · Calls · same relation mirrored
                - img:
                  - group "Edge from fact:file:970440b18763062bafbf838e0e2b6c41 to group-member:24053e9c-bd42-480b-a732-659dfdf79a31:function:1c791e819444f085fdd0884784dfb179" [ref=f2e67] [cursor=pointer]:
                    - generic [ref=f2e70]: Fact · Contains
                - img:
                  - group "Edge from fact:file:04fc23dbf7c77d8b214a1b62c6c93155 to fact:function:73cb353dee2d1d4946b97faf21deadd1" [ref=f2e72] [cursor=pointer]:
                    - generic [ref=f2e75]: Fact · Contains
                - img:
                  - group "Edge from fact:file:78ce2afabe70d3864f270624d1a063e9 to fact:function:7ab1e575068aa94a09429eaac0bf2468" [ref=f2e77] [cursor=pointer]:
                    - generic [ref=f2e80]: Fact · Contains
                - img:
                  - group "Edge from fact:file:78ce2afabe70d3864f270624d1a063e9 to fact:function:b9349f421fd7eed1115735e41fe52fde" [ref=f2e82] [cursor=pointer]:
                    - generic [ref=f2e85]: Fact · Contains
              - generic:
                - group [ref=f2e87]:
                  - generic [ref=f2e88]:
                    - generic [ref=f2e89]:
                      - generic [ref=f2e90]: ● Code fact
                      - generic [ref=f2e91]: Folder
                    - strong [ref=f2e92]:
                      - generic [ref=f2e93]:
                        - generic [aria-hidden] [ref=f2e94]: 
                        - generic [ref=f2e95]: ./
                        - generic [ref=f2e96]: Folder
                    - code [ref=f2e97]: .
                - group [ref=f2e98]:
                  - generic [ref=f2e99]:
                    - generic [ref=f2e101]:
                      - generic [ref=f2e102]: ● Code fact
                      - generic [ref=f2e103]: Function
                    - strong [ref=f2e104]:
                      - generic [ref=f2e105]:
                        - generic [aria-hidden] [ref=f2e106]: 
                        - generic [ref=f2e107]: caller()
                        - generic [ref=f2e108]: Function
                    - code [ref=f2e109]: main.ts
                    - generic "export function caller()" [ref=f2e110]
                - group [ref=f2e112]:
                  - generic [ref=f2e113]:
                    - generic [ref=f2e115]:
                      - generic [ref=f2e116]: ● Code fact
                      - generic [ref=f2e117]: Function
                    - strong [ref=f2e118]:
                      - generic [ref=f2e119]:
                        - generic [aria-hidden] [ref=f2e120]: 
                        - generic [ref=f2e121]: dynamic()
                        - generic [ref=f2e122]: Function
                    - code [ref=f2e123]: main.ts
                    - 'generic "export function dynamic(fn: () => void)" [ref=f2e124]'
                - group [ref=f2e126]:
                  - generic [ref=f2e127]:
                    - generic [ref=f2e129]:
                      - generic [ref=f2e130]: ● Code fact
                      - generic [ref=f2e131]: Function
                    - strong [ref=f2e132]:
                      - generic [ref=f2e133]:
                        - generic [aria-hidden] [ref=f2e134]: 
                        - generic [ref=f2e135]: fetchNotes()
                        - generic [ref=f2e136]: Function
                    - code [ref=f2e137]: services/notes.ts
                    - 'generic "export function fetchNotes(fn: () => string)" [ref=f2e138]'
                - group [ref=f2e140]:
                  - generic [ref=f2e141]:
                    - generic [ref=f2e143]:
                      - generic [ref=f2e144]: ● Code fact
                      - generic [ref=f2e145]: File
                    - strong [ref=f2e146]:
                      - generic [ref=f2e147]:
                        - generic [aria-hidden] [ref=f2e148]: 
                        - generic [ref=f2e149]: main.ts
                        - generic [ref=f2e150]: File
                    - code [ref=f2e151]: main.ts
                - group [ref=f2e153]:
                  - generic [ref=f2e154]:
                    - generic [ref=f2e156]:
                      - generic [ref=f2e157]: ● Code fact
                      - generic [ref=f2e158]: File
                    - strong [ref=f2e159]:
                      - generic [ref=f2e160]:
                        - generic [aria-hidden] [ref=f2e161]: 
                        - generic [ref=f2e162]: notes.ts
                        - generic [ref=f2e163]: File
                    - code [ref=f2e164]: services/notes.ts
                - group [ref=f2e166]:
                  - generic [ref=f2e167]:
                    - generic [ref=f2e169]:
                      - generic [ref=f2e170]: ● Code fact
                      - generic [ref=f2e171]: File
                    - strong [ref=f2e172]:
                      - generic [ref=f2e173]:
                        - generic [aria-hidden] [ref=f2e174]: 
                        - generic [ref=f2e175]: requests.ts
                        - generic [ref=f2e176]: File
                    - code [ref=f2e177]: requests.ts
                - group [ref=f2e179]:
                  - generic [ref=f2e180]:
                    - generic [ref=f2e181]:
                      - generic [ref=f2e182]: ● Code fact
                      - generic [ref=f2e183]: Folder
                    - strong [ref=f2e184]:
                      - generic [ref=f2e185]:
                        - generic [aria-hidden] [ref=f2e186]: 
                        - generic [ref=f2e187]: services/
                        - generic [ref=f2e188]: Folder
                    - code [ref=f2e189]: services
                - group [ref=f2e190]:
                  - generic [ref=f2e192]:
                    - strong [ref=f2e193]: Reusable requests
                    - button "Collapse Reusable requests" [ref=f2e194] [cursor=pointer]: Collapse
                    - paragraph [ref=f2e195]: 2 / 2 loaded members · 0 not loaded
                    - generic [ref=f2e196]: Only the loaded scope is shown; unloaded calls are unknown
                    - generic [ref=f2e197]: Same function mirrored · Reusable requests
                - group [ref=f2e198]:
                  - generic [ref=f2e199]:
                    - generic [ref=f2e201]:
                      - generic [ref=f2e202]: ● Code fact
                      - generic [ref=f2e203]: Function
                    - generic [ref=f2e204]: Same function mirrored · Reusable requests
                    - strong [ref=f2e205]:
                      - generic [ref=f2e206]:
                        - generic [aria-hidden] [ref=f2e207]: 
                        - generic [ref=f2e208]: requestWithRetry()
                        - generic [ref=f2e209]: Function
                    - code [ref=f2e210]: requests.ts
                    - generic "export function requestWithRetry()" [ref=f2e211]
                - group [ref=f2e213]:
                  - generic [ref=f2e214]:
                    - generic [ref=f2e216]:
                      - generic [ref=f2e217]: ● Code fact
                      - generic [ref=f2e218]: Function
                    - generic [ref=f2e219]: Same function mirrored · Reusable requests
                    - strong [ref=f2e220]:
                      - generic [ref=f2e221]:
                        - generic [aria-hidden] [ref=f2e222]: 
                        - generic [ref=f2e223]: A()
                        - generic [ref=f2e224]: Function
                    - code [ref=f2e225]: requests.ts
                    - generic "export function A()" [ref=f2e226]
                - group [ref=f2e228]:
                  - generic [ref=f2e230]:
                    - strong [ref=f2e231]: Shared membership
                    - button "Collapse Shared membership" [ref=f2e232] [cursor=pointer]: Collapse
                    - paragraph [ref=f2e233]: 1 / 1 loaded members · 0 not loaded
                    - generic [ref=f2e234]: Only the loaded scope is shown; unloaded calls are unknown
                    - generic [ref=f2e235]: Same function mirrored · Shared membership
                - group [ref=f2e236]:
                  - generic [ref=f2e237]:
                    - generic [ref=f2e239]:
                      - generic [ref=f2e240]: ● Code fact
                      - generic [ref=f2e241]: Function
                    - generic [ref=f2e242]: Same function mirrored · Shared membership
                    - strong [ref=f2e243]:
                      - generic [ref=f2e244]:
                        - generic [aria-hidden] [ref=f2e245]: 
                        - generic [ref=f2e246]: requestWithRetry()
                        - generic [ref=f2e247]: Function
                    - code [ref=f2e248]: requests.ts
                    - generic "export function requestWithRetry()" [ref=f2e249]
          - generic "Control Panel" [ref=f2e251]:
            - button "Zoom in" [ref=f2e252] [cursor=pointer]
            - button "Zoom out" [ref=f2e255] [cursor=pointer]
            - button "Fit view" [ref=f2e258] [cursor=pointer]
            - button "Toggle interaction" [ref=f2e261] [cursor=pointer]
          - complementary "Map of the loaded graph" [ref=f2e264]:
            - button "Expand map" [ref=f2e265] [cursor=pointer]
            - img "Graph overview" [ref=f2e267]
          - link "React Flow attribution" [ref=f2e282] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
        - status:
          - generic: "Loaded scope: group cards: 2 · expanded member mirrors: 3"
          - generic: Group view counts are additional to the fact query budget
        - group [ref=f2e284]:
          - generic "⚠ Scope and uncertainty (2)" [ref=f2e285] [cursor=pointer]
      - generic [ref=f2e286]:
        - generic [ref=f2e287]: "Code fact query budget: Expansion: up to 80 nodes / 240 relations; optionally 300 / 900."
        - generic [ref=f2e288]: Layout, theme and language saved automatically
    - complementary "Details panel" [ref=f2e289]:
      - region "Plan review" [ref=f2e290]:
        - button "Awaiting your review · 1" [ref=f2e291] [cursor=pointer]:
          - generic [aria-hidden] [ref=f2e293]: ▾
      - navigation [ref=f2e294]:
        - button "View source" [disabled] [ref=f2e295]
        - button "Advanced editing" [ref=f2e296] [cursor=pointer]
        - button "Implementation check" [ref=f2e297] [cursor=pointer]
        - button "Knowledge notes" [ref=f2e298] [cursor=pointer]
      - generic [ref=f2e299]:
        - region "Change list" [ref=f2e300]:
          - heading "Plan overview" [level=2] [ref=f2e302]
          - generic [ref=f2e303]:
            - text: Choose plan
            - combobox "Choose plan" [ref=f2e304]:
              - option "Choose or create a plan" [selected]
              - option "Reviewed notes plan · r16"
          - paragraph [ref=f2e305]: Choose or create a plan
        - generic [ref=f2e306]:
          - paragraph [ref=f2e307]: No plan yet? Create one manually, or open the AI conversation below. Plans overlay the graph without modifying source.
          - button "Create a plan manually" [ref=f2e308] [cursor=pointer]
        - group [ref=f2e309]:
          - generic "AI planning · connection and chat" [ref=f2e310] [cursor=pointer]
```

# Test source

```ts
  684 |       callerSource.replace("return A();", "return requestWithRetry();"),
  685 |     );
  686 |     const satisfied = await mcp.call("verify_implementation", {
  687 |       ...args,
  688 |       planId,
  689 |     });
  690 |     expect(satisfied.items.filter((i) => i.status === "unmet")).toEqual([]);
  691 |     expect(
  692 |       satisfied.items.filter((i) => i.status === "satisfied").length,
  693 |     ).toBeGreaterThanOrEqual(4);
  694 |     expect(satisfied.items.find((i) => i.status === "unknown").message).toMatch(
  695 |       /annotation|human/i,
  696 |     );
  697 |     evidence.satisfied = satisfied;
  698 |     await page
  699 |       .getByRole("button", { name: "Refresh code", exact: true })
  700 |       .click();
  701 |     await openCodeNavigation(page);
  702 |     await page
  703 |       .getByRole("combobox", { name: "Browse routes", exact: true })
  704 |       .selectOption(chain.id);
  705 |     await expect(page.getByText(/Route uses an older snapshot/)).toBeVisible();
  706 |     await expect(
  707 |       page.getByRole("button", { name: "Next step", exact: true }),
  708 |     ).toBeDisabled();
  709 |     await writeFile(
  710 |       join(f.ts, "services/notes.ts"),
  711 |       'import { A } from "../requests";\nexport function fetchNotes() { return A(); }\n',
  712 |     );
  713 |     const bypass = await mcp.call("verify_implementation", { ...args, planId });
  714 |     expect(
  715 |       bypass.items.some((i) => i.status === "unmet" && i.evidence.length > 0),
  716 |     ).toBe(true);
  717 |     evidence.bypass = bypass;
  718 |     await page
  719 |       .getByRole("button", { name: "Implementation check", exact: true })
  720 |       .click();
  721 |     await page
  722 |       .getByRole("button", {
  723 |         name: "Check approved implementation",
  724 |         exact: true,
  725 |       })
  726 |       .click();
  727 |     await expect(page.locator(".verification.unmet")).toHaveCount(1);
  728 |     await writeFile(
  729 |       join(f.ts, "services/notes.ts"),
  730 |       "export function fetchNotes(fn: () => string) { return fn(); }\n",
  731 |     );
  732 |     const unknown = await mcp.call("verify_implementation", {
  733 |       ...args,
  734 |       planId,
  735 |     });
  736 |     expect(
  737 |       unknown.items.some(
  738 |         (i) =>
  739 |           i.status === "unknown" &&
  740 |           i.evidence.some((e) => e.includes("services/notes.ts")),
  741 |       ),
  742 |     ).toBe(true);
  743 |     evidence.unknown = unknown;
  744 |     // A different language/project clears the previous plan and source selection.
  745 |     await page
  746 |       .getByRole("button", { name: "Open project", exact: true })
  747 |       .click();
  748 |     await page
  749 |       .getByRole("textbox", { name: "Local project path" })
  750 |       .fill(f.python);
  751 |     await page
  752 |       .getByRole("button", { name: "Open and index", exact: true })
  753 |       .click();
  754 |     await expect(page.locator(".project-heading h1")).toHaveText("python");
  755 |     await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  756 |     await openCodeNavigation(page);
  757 |     await page.getByRole("button", { name: /ƒ entry/ }).click();
  758 |     await openSourceDrawer(page);
  759 |     await expect(page.getByTestId("source-snippet")).toContainText(
  760 |       "return helper()",
  761 |     );
  762 |     await page
  763 |       .getByRole("button", { name: "Expand one level", exact: true })
  764 |       .click();
  765 |     await page
  766 |       .getByRole("button", { name: "Advanced editing", exact: true })
  767 |       .click();
  768 |     await expect(
  769 |       page.getByRole("combobox", { name: "Choose plan", exact: true }),
  770 |     ).toHaveValue("");
  771 |     const python = (await api("/api/projects")).find(
  772 |       (p) => p.path === f.python,
  773 |     );
  774 |     expect(
  775 |       (await mcp.call("search_functions", { projectId: python.id, q: "entry" }))
  776 |         .items,
  777 |     ).toHaveLength(1);
  778 |     await page
  779 |       .getByRole("combobox", { name: "Switch project", exact: true })
  780 |       .selectOption(project.id);
  781 |     await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  782 |     await f.assertNotExecuted();
  783 |     expect(external).toEqual([]);
> 784 |     expect(errors).toEqual([]);
      |                    ^ Error: expect(received).toEqual(expected) // deep equality
  785 |     expect(mcp.stderr()).toBe("");
  786 |   } finally {
  787 |     await writeFile(
  788 |       join(screenshots, "joint-flow-evidence.json"),
  789 |       JSON.stringify(evidence, null, 2),
  790 |     );
  791 |     await testInfo.attach("joint-flow-evidence", {
  792 |       body: JSON.stringify(evidence, null, 2),
  793 |       contentType: "application/json",
  794 |     });
  795 |     await mcp?.client.close();
  796 |     await server?.stop();
  797 |     await rm(root, { recursive: true, force: true });
  798 |   }
  799 | });
  800 | 
```