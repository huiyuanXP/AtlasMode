# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: planning.spec.mjs >> production UI and SDK share the complete planning, approval, persistence and verification flow offline
- Location: tests/e2e/planning.spec.mjs:18:1

# Error details

```
TimeoutError: locator.selectOption: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('combobox', { name: 'Directory responsibilities', exact: true })

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - link "◈ AtlasMode Code facts · Visual planning" [ref=f1e5] [cursor=pointer]:
      - /url: "#"
      - text: ◈ AtlasMode
      - generic [ref=f1e6]: Code facts · Visual planning
    - button "Open project" [ref=f1e7] [cursor=pointer]
    - combobox "Switch project" [ref=f1e8]:
      - option "Choose an opened project"
      - option "typescript · /tmp/atlas-e2e-SyVZQW/typescript" [selected]
    - button "Refresh code" [ref=f1e9] [cursor=pointer]
    - button "Toggle light/dark" [ref=f1e10] [cursor=pointer]: ☾ Dark
    - combobox "Interface language" [ref=f1e11]:
      - option "中文"
      - option "English" [selected]
  - status [ref=f1e12]:
    - text: Validation complete; results come from the local service.
    - button "Dismiss" [ref=f1e13] [cursor=pointer]: ×
  - main [ref=f1e14]:
    - complementary "Project facts" [ref=f1e15]:
      - generic [ref=f1e16]:
        - text: Project facts
        - heading "typescript" [level=1] [ref=f1e17]
        - code [ref=f1e18]: /tmp/atlas-e2e-SyVZQW/typescript
      - paragraph [ref=f1e19]: Search for a function, or open Browse code to choose an entry. Click to inspect references; double-click for dependencies.
      - region "Search functions" [ref=f1e20]:
        - generic [ref=f1e21]:
          - textbox "Search functions" [ref=f1e22]:
            - /placeholder: Name, qualified name or path
          - button "Search" [ref=f1e23] [cursor=pointer]
      - group [ref=f1e24]:
        - generic "Browse code" [ref=f1e25] [cursor=pointer]
        - generic [ref=f1e26]:
          - heading "Entry candidates 4/4" [level=2] [ref=f1e27]:
            - text: Entry candidates
            - generic [ref=f1e28]: 4/4
          - paragraph [ref=f1e29]: "TS/JS: explicit exports; Python: public top-level names. These are candidates, not confirmed runtime entries."
          - generic [ref=f1e30]:
            - button "ƒ A requests.ts" [ref=f1e31] [cursor=pointer]:
              - strong [ref=f1e32]: ƒ A
              - generic [ref=f1e33]: requests.ts
            - button "ƒ caller main.ts" [ref=f1e34] [cursor=pointer]:
              - strong [ref=f1e35]: ƒ caller
              - generic [ref=f1e36]: main.ts
            - button "ƒ dynamic main.ts" [ref=f1e37] [cursor=pointer]:
              - strong [ref=f1e38]: ƒ dynamic
              - generic [ref=f1e39]: main.ts
            - button "ƒ requestWithRetry requests.ts" [ref=f1e40] [cursor=pointer]:
              - strong [ref=f1e41]: ƒ requestWithRetry
              - generic [ref=f1e42]: requests.ts
        - generic [ref=f1e43]:
          - heading "Browse routes" [level=2] [ref=f1e44]
          - combobox "Browse routes" [ref=f1e45]:
            - option "No route"
            - option "Actual call chain"
            - option "Reuse walkthrough" [selected]
          - paragraph [ref=f1e46]: A route is an explanation sequence; it does not imply calls.
          - paragraph [ref=f1e47]: Explanation, not a call
          - generic [ref=f1e48]: "Route source: Agent · Walkthrough · r1"
          - list [ref=f1e49]:
            - listitem [ref=f1e50]:
              - button "1. Reusable target" [ref=f1e51] [cursor=pointer]
          - paragraph [ref=f1e52]: "Step note: Reusable target"
          - generic [ref=f1e53]:
            - button "Previous step" [disabled] [ref=f1e54]
            - button "Next step" [disabled] [ref=f1e55]
            - button "Focus step" [ref=f1e56] [cursor=pointer]
      - group [ref=f1e57]:
        - generic "AI exploration · connection and chat" [ref=f1e58] [cursor=pointer]
      - button "Manage groups" [expanded] [ref=f1e59] [cursor=pointer]
      - generic [ref=f1e60]:
        - heading "Function groups" [level=2] [ref=f1e61]
        - paragraph [ref=f1e62]: Select fact functions below. A function can belong to multiple groups; source files stay in place.
        - paragraph [ref=f1e63]: Changing groups or directory policies creates a new revision for every plan in this project and requires renewed confirmation.
        - button "Create group" [ref=f1e64] [cursor=pointer]
        - article [ref=f1e65]:
          - heading "Reusable requests" [level=3] [ref=f1e66]
          - paragraph [ref=f1e67]: Agent-authored group
          - button "Collapse" [ref=f1e68] [cursor=pointer]
          - generic [ref=f1e69]: "Agent · Members: 2"
          - button "Edit group" [ref=f1e70] [cursor=pointer]
          - button "Members" [ref=f1e71] [cursor=pointer]
        - article [ref=f1e72]:
          - heading "Shared membership" [level=3] [ref=f1e73]
          - paragraph
          - button "Collapse" [ref=f1e74] [cursor=pointer]
          - generic [ref=f1e75]: "User · Members: 1"
          - button "Edit group" [ref=f1e76] [cursor=pointer]
          - button "Members" [ref=f1e77] [cursor=pointer]
      - button "Advanced controls" [expanded] [ref=f1e78] [cursor=pointer]
      - generic [ref=f1e79]:
        - generic [ref=f1e80]:
          - heading "Folder policies" [level=2] [ref=f1e81]
          - paragraph [ref=f1e82]:
            - code [ref=f1e83]: .codemap/structure.json
            - text: · schema v1
          - paragraph [ref=f1e84]: Edit directory purpose or legacy path rules. Descriptive metadata does not prove a dependency rule is satisfied.
          - button "Read structure again" [ref=f1e85] [cursor=pointer]
          - paragraph [ref=f1e86]:
            - text: "Structure status: missing · r0File digest:"
            - code [ref=f1e87]: ∅
            - text: "Verified: 2026-10-11T01:46:39.759Z"
          - paragraph [ref=f1e88]: Create a missing structure.json by saving a policy or file folder.
          - status [ref=f1e89]: Saved. Read again before another edit.
          - generic [ref=f1e90]:
            - button "New policy" [ref=f1e91] [cursor=pointer]
            - button "New file folder" [ref=f1e92] [cursor=pointer]
          - generic [ref=f1e93]:
            - text: Edit policy
            - combobox "Edit policy" [ref=f1e94]:
              - option "New policy" [selected]
              - option "New file folder"
          - group [ref=f1e96]:
            - generic [ref=f1e97]:
              - text: Path prefix
              - textbox "Path prefix" [ref=f1e98]:
                - /placeholder: src/
                - text: services
            - generic [ref=f1e99]:
              - text: Purpose
              - textbox "Purpose" [ref=f1e100]: Reuse existing request behavior
            - generic [ref=f1e101]:
              - text: Forbidden dependencies
              - textbox "Forbidden dependencies" [ref=f1e102]:
                - /placeholder: src/internal
                - text: internal
            - button "Save policy" [disabled] [ref=f1e103]
          - heading "Legacy path policies" [level=3] [ref=f1e104]
          - paragraph [ref=f1e105]: No policies
          - heading "structure.json folders" [level=3] [ref=f1e106]
          - paragraph [ref=f1e107]: Purpose description; requires human judgment
          - group [ref=f1e108]:
            - generic "Read-only metadata" [ref=f1e109] [cursor=pointer]
          - paragraph [ref=f1e110]: Preview first. Import is explicit and invalidates current approval; historical approvals remain recorded.
          - button "Preview DB policy migration" [disabled] [ref=f1e111]
        - group [ref=f1e112]:
          - generic "Static analysis diagnostics (0)" [ref=f1e113] [cursor=pointer]
    - generic [ref=f1e114]:
      - navigation "Location" [ref=f1e115]:
        - list [ref=f1e116]:
          - listitem [ref=f1e117]:
            - button "typescript" [ref=f1e118] [cursor=pointer]
        - generic [ref=f1e119]: Fetch notes through reuse · Affected objects 3
      - generic [ref=f1e120]:
        - generic "Plan ownership" [ref=f1e121]:
          - button "Layout" [pressed] [ref=f1e122] [cursor=pointer]
          - button "Plan ownership" [ref=f1e123] [cursor=pointer]
        - button "Circle-select functions" [ref=f1e124] [cursor=pointer]
        - generic [ref=f1e125]:
          - text: Visible layers
          - combobox "Visible layers" [ref=f1e126]:
            - option "Facts + plan" [selected]
            - option "Fact"
            - option "Plan"
        - generic [ref=f1e127]:
          - text: New/reconnected relation type
          - combobox "New/reconnected relation type" [ref=f1e128]:
            - option "Calls" [selected]
            - option "Must call"
            - option "Must reuse"
      - generic [ref=f1e129]: Hover to preview links, click for references, double-click for the dependency funnel. Drag any card. Esc closes the map, then details, then the funnel.
      - generic "Code canvas" [ref=f1e130]:
        - application [ref=f1e131]:
          - generic [ref=f1e133]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:file:b5dd5ec90b632c7e00f59da80196469e to group-member:aad736b6-b304-425f-94f0-7923b6e46b9a:function:2ade8a422d7c92745a906a4696b8ca9a" [ref=f1e134] [cursor=pointer]:
                    - generic [ref=f1e137]: Fact · Contains
                - img:
                  - group "Edge from fact:file:4ea62baf15645a94b7e0617201d97dbe to fact:function:ff37abf2605d7e6bffa068c49c6c3c29" [ref=f1e139] [cursor=pointer]:
                    - generic [ref=f1e142]: Fact · Contains
                - img:
                  - group "Edge from fact:function:ff37abf2605d7e6bffa068c49c6c3c29 to group-member:aad736b6-b304-425f-94f0-7923b6e46b9a:function:2ade8a422d7c92745a906a4696b8ca9a" [ref=f1e144] [cursor=pointer]:
                    - generic [ref=f1e147]: Fact · Calls · Planned removal
                - img:
                  - group "Edge from plan:notes to group-member:62186c99-b6f7-4fd0-bd08-be3f3ad8390b:function:623fa6c72b4803ad5ebcae3ef26517f0" [ref=f1e151] [cursor=pointer]:
                    - generic [ref=f1e154]: Plan · Calls · same relation mirrored
                - img:
                  - group "Edge from plan:notes to group-member:aad736b6-b304-425f-94f0-7923b6e46b9a:function:623fa6c72b4803ad5ebcae3ef26517f0" [ref=f1e158] [cursor=pointer]:
                    - generic [ref=f1e161]: Plan · Calls · same relation mirrored
                - img:
                  - group "Edge from fact:function:ff37abf2605d7e6bffa068c49c6c3c29 to group-member:62186c99-b6f7-4fd0-bd08-be3f3ad8390b:function:623fa6c72b4803ad5ebcae3ef26517f0" [ref=f1e165] [cursor=pointer]:
                    - generic [ref=f1e168]: Plan · Calls · same relation mirrored
                - img:
                  - group "Edge from fact:function:ff37abf2605d7e6bffa068c49c6c3c29 to group-member:aad736b6-b304-425f-94f0-7923b6e46b9a:function:623fa6c72b4803ad5ebcae3ef26517f0" [ref=f1e172] [cursor=pointer]:
                    - generic [ref=f1e175]: Plan · Calls · same relation mirrored
              - generic:
                - group [ref=f1e179]:
                  - generic [ref=f1e180]:
                    - generic [ref=f1e181]:
                      - generic [ref=f1e182]: ● Code fact
                      - generic [ref=f1e183]: Folder
                    - strong [ref=f1e184]:
                      - generic [ref=f1e185]:
                        - generic [aria-hidden] [ref=f1e186]: 
                        - generic [ref=f1e187]: ./
                        - generic [ref=f1e188]: Folder
                    - code [ref=f1e189]: .
                - group [ref=f1e190]:
                  - generic [ref=f1e191]:
                    - generic [ref=f1e193]:
                      - generic [ref=f1e194]: ● Code fact
                      - generic [ref=f1e195]: Function
                    - strong [ref=f1e196]:
                      - generic [ref=f1e197]:
                        - generic [aria-hidden] [ref=f1e198]: 
                        - generic [ref=f1e199]: caller()
                        - generic [ref=f1e200]: Function
                    - code [ref=f1e201]: main.ts
                    - generic "export function caller()" [ref=f1e202]
                - group [ref=f1e204]:
                  - generic [ref=f1e205]:
                    - generic [ref=f1e207]:
                      - generic [ref=f1e208]: ● Code fact
                      - generic [ref=f1e209]: File
                    - strong [ref=f1e210]:
                      - generic [ref=f1e211]:
                        - generic [aria-hidden] [ref=f1e212]: 
                        - generic [ref=f1e213]: main.ts
                        - generic [ref=f1e214]: File
                    - code [ref=f1e215]: main.ts
                - group [ref=f1e217]:
                  - generic [ref=f1e218]:
                    - generic [ref=f1e220]:
                      - generic [ref=f1e221]: ● Code fact
                      - generic [ref=f1e222]: File
                    - strong [ref=f1e223]:
                      - generic [ref=f1e224]:
                        - generic [aria-hidden] [ref=f1e225]: 
                        - generic [ref=f1e226]: requests.ts
                        - generic [ref=f1e227]: File
                    - code [ref=f1e228]: requests.ts
                - group [ref=f1e230]:
                  - generic [ref=f1e231]:
                    - generic [ref=f1e233]:
                      - generic [ref=f1e234]: ＋ Planned addition
                      - generic [ref=f1e235]: Function
                    - strong [ref=f1e236]:
                      - generic [ref=f1e237]:
                        - generic [aria-hidden] [ref=f1e238]: 
                        - generic [ref=f1e239]: fetchNotes()
                        - generic [ref=f1e240]: Function
                    - code [ref=f1e241]: services/notes.ts
                    - generic [ref=f1e242]: Annotation · Preserve retry behavior; human review required
                - group [ref=f1e244]:
                  - generic [ref=f1e246]:
                    - strong [ref=f1e247]: Shared membership
                    - button "Collapse Shared membership" [ref=f1e248] [cursor=pointer]: Collapse
                    - paragraph [ref=f1e249]: 1 / 1 loaded members · 0 not loaded
                    - generic [ref=f1e250]: Only the loaded scope is shown; unloaded calls are unknown
                    - generic [ref=f1e251]: Same function mirrored · Shared membership
                - group [ref=f1e252]:
                  - generic [ref=f1e253]:
                    - generic [ref=f1e255]:
                      - generic [ref=f1e256]: ↳ Fact reference
                      - generic [ref=f1e257]: Function
                    - generic [ref=f1e258]: Same function mirrored · Shared membership
                    - strong [ref=f1e259]:
                      - generic [ref=f1e260]:
                        - generic [aria-hidden] [ref=f1e261]: 
                        - generic [ref=f1e262]: requestWithRetry()
                        - generic [ref=f1e263]: Function
                    - code [ref=f1e264]: requests.ts
                    - generic "export function requestWithRetry()" [ref=f1e265]
                - group [ref=f1e267]:
                  - generic [ref=f1e269]:
                    - strong [ref=f1e270]: Reusable requests
                    - button "Collapse Reusable requests" [ref=f1e271] [cursor=pointer]: Collapse
                    - paragraph [ref=f1e272]: 2 / 2 loaded members · 0 not loaded
                    - generic [ref=f1e273]: Only the loaded scope is shown; unloaded calls are unknown
                    - generic [ref=f1e274]: Same function mirrored · Reusable requests
                - group [ref=f1e275]:
                  - generic [ref=f1e276]:
                    - generic [ref=f1e278]:
                      - generic [ref=f1e279]: ↳ Fact reference
                      - generic [ref=f1e280]: Function
                    - generic [ref=f1e281]: Same function mirrored · Reusable requests
                    - strong [ref=f1e282]:
                      - generic [ref=f1e283]:
                        - generic [aria-hidden] [ref=f1e284]: 
                        - generic [ref=f1e285]: requestWithRetry()
                        - generic [ref=f1e286]: Function
                    - code [ref=f1e287]: requests.ts
                    - generic "export function requestWithRetry()" [ref=f1e288]
                - group [ref=f1e290]:
                  - generic [ref=f1e291]:
                    - generic [ref=f1e293]:
                      - generic [ref=f1e294]: ● Code fact
                      - generic [ref=f1e295]: Function
                    - generic [ref=f1e296]: Same function mirrored · Reusable requests
                    - strong [ref=f1e297]:
                      - generic [ref=f1e298]:
                        - generic [aria-hidden] [ref=f1e299]: 
                        - generic [ref=f1e300]: A()
                        - generic [ref=f1e301]: Function
                    - code [ref=f1e302]: requests.ts
                    - generic "export function A()" [ref=f1e303]
          - generic "Control Panel" [ref=f1e305]:
            - button "Zoom in" [ref=f1e306] [cursor=pointer]
            - button "Zoom out" [ref=f1e309] [cursor=pointer]
            - button "Fit view" [ref=f1e312] [cursor=pointer]
            - button "Toggle interaction" [ref=f1e315] [cursor=pointer]
          - complementary "Map of the loaded graph" [ref=f1e318]:
            - button "Expand map" [ref=f1e319] [cursor=pointer]
            - img "Graph overview" [ref=f1e321]
          - link "React Flow attribution" [ref=f1e333] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
        - status:
          - generic: "Loaded scope: group cards: 2 · expanded member mirrors: 3"
          - generic: Group view counts are additional to the fact query budget
      - generic [ref=f1e335]:
        - generic [ref=f1e336]: "Code fact query budget: Expansion: up to 80 nodes / 240 relations; optionally 300 / 900."
        - generic [ref=f1e337]: Layout, theme and language saved automatically
    - complementary "Details panel" [ref=f1e338]:
      - region "Plan review" [ref=f1e339]:
        - button "No plans awaiting review" [ref=f1e340] [cursor=pointer]:
          - generic [aria-hidden] [ref=f1e342]: ▾
      - navigation [ref=f1e343]:
        - button "Back to chat" [ref=f1e344] [cursor=pointer]
        - button "View source" [disabled] [ref=f1e345]
        - button "Advanced editing" [pressed] [ref=f1e346] [cursor=pointer]
        - button "Implementation check" [ref=f1e347] [cursor=pointer]
        - button "Knowledge notes" [ref=f1e348] [cursor=pointer]
      - generic [ref=f1e349]:
        - generic [ref=f1e350]:
          - button "Undo" [ref=f1e351] [cursor=pointer]
          - button "Redo" [disabled] [ref=f1e352]
        - paragraph [ref=f1e353]: "Session history: up to 50 edits per plan, across 20 plans. Undo/redo saves a new revision. Reloading the page clears history; external revisions reset it."
        - generic [ref=f1e354]:
          - heading "Plan editor" [level=2] [ref=f1e355]
          - generic [ref=f1e356]:
            - generic [ref=f1e357]:
              - text: New plan title
              - textbox "New plan title" [ref=f1e358]
            - button "Create plan" [ref=f1e359] [cursor=pointer]
          - generic [ref=f1e360]:
            - text: Choose plan
            - combobox "Choose plan" [ref=f1e361]:
              - option "Choose or create a plan"
              - option "Fetch notes through reuse · r13 · Approved" [selected]
          - button "Reload plan" [ref=f1e362] [cursor=pointer]
          - group [ref=f1e363]:
            - generic [ref=f1e364]:
              - strong [ref=f1e365]: Revision r13 · Approved
              - paragraph [ref=f1e366]: ✓ Current approval valid
              - text: Baseline snapshot
              - code [ref=f1e367]: snapshot:0f3776ec576f02b64b8995d986c3985e
              - generic [ref=f1e368]: Approval digest · r13
              - code [ref=f1e369]: a74f5f7946db746db8ed231de7cdd86963c74870a32c1532eab3ffe4f3568d6e
            - generic [ref=f1e370]:
              - generic [ref=f1e371]:
                - text: Plan title
                - textbox "Plan title" [ref=f1e372]: Fetch notes through reuse
              - generic [ref=f1e373]:
                - text: Description / constraints
                - textbox "Description / constraints" [ref=f1e374]
              - button "Save title and description" [disabled] [ref=f1e375]
            - paragraph [ref=f1e376]: Confirmation binds the current revision and semantic digest. Semantic edits create a revision; dragging only saves layout.
            - generic [ref=f1e377]:
              - button "Validate plan" [ref=f1e378] [cursor=pointer]
              - button "Confirm current revision" [ref=f1e379] [cursor=pointer]
            - generic [ref=f1e380]:
              - button "Export Markdown" [ref=f1e381] [cursor=pointer]
              - button "Export JSON" [ref=f1e382] [cursor=pointer]
            - group [ref=f1e383]:
              - generic "Server validation results (2)" [ref=f1e384] [cursor=pointer]
              - paragraph [ref=f1e385]: "Warning · COMPATIBILITY_UNKNOWN: Interface compatibility is unknown; arguments, return values, and possible adaptation require human review."
              - paragraph [ref=f1e386]: "Warning · COMPATIBILITY_UNKNOWN: Interface compatibility is unknown; arguments, return values, and possible adaptation require human review."
            - group [ref=f1e387]:
              - generic "New planned function" [ref=f1e388] [cursor=pointer]
              - paragraph [ref=f1e389]: A target file is planned through add_function or move_function; source files are not written.
              - generic [ref=f1e390]:
                - generic [ref=f1e391]:
                  - text: Function name
                  - textbox "Function name" [ref=f1e392]
                - generic [ref=f1e393]:
                  - text: Target file (repository relative)
                  - textbox "Target file (repository relative)" [ref=f1e394]:
                    - /placeholder: src/feature.ts
                - generic [ref=f1e395]:
                  - text: Signature
                  - textbox "Signature" [ref=f1e396]
                - generic [ref=f1e397]:
                  - text: Function responsibility
                  - textbox "Function responsibility" [ref=f1e398]
                - paragraph [ref=f1e399]:
                  - text: "Target file preview:"
                  - code [ref=f1e400]: ∅ → …
                - button "Add function" [disabled] [ref=f1e401]
            - group [ref=f1e402]:
              - generic "Planned relations" [ref=f1e403] [cursor=pointer]
              - paragraph [ref=f1e404]: Click a relation to reconnect/remove it, or drag its endpoint.
              - generic [ref=f1e405]:
                - generic [ref=f1e406]:
                  - text: Source function
                  - combobox "Source function" [ref=f1e407]:
                    - option "Choose a function" [selected]
                    - option "A · requests.ts"
                    - option "caller · main.ts"
                    - option "dynamic · main.ts"
                    - option "requestWithRetry · requests.ts"
                    - option "fetchNotes · services/notes.ts"
                - generic [ref=f1e408]:
                  - text: Target function
                  - combobox "Target function" [ref=f1e409]:
                    - option "Choose a function" [selected]
                    - option "A · requests.ts"
                    - option "caller · main.ts"
                    - option "dynamic · main.ts"
                    - option "requestWithRetry · requests.ts"
                    - option "fetchNotes · services/notes.ts"
                - generic [ref=f1e410]:
                  - text: New/reconnected relation type
                  - combobox "New/reconnected relation type" [ref=f1e411]:
                    - option "Calls" [selected]
                    - option "Must call"
                    - option "Must reuse"
                - button "Add relation" [ref=f1e412] [cursor=pointer]
            - group [ref=f1e413]:
              - generic "Change list (5)" [ref=f1e414] [cursor=pointer]
              - article [ref=f1e415]:
                - strong [ref=f1e416]: "#1 Add function"
                - generic [ref=f1e417]: "{ \"kind\": \"add_function\", \"tempId\": \"notes\", \"name\": \"fetchNotes\", \"filePath\": \"services/notes.ts\", \"signature\": \"\", \"description\": \"\" }"
                - button "Remove operation 1" [ref=f1e418] [cursor=pointer]: Remove operation
              - article [ref=f1e419]:
                - strong [ref=f1e420]: "#2 Add relation"
                - generic [ref=f1e421]: "{ \"kind\": \"add_relation\", \"id\": \"new-call\", \"sourceId\": \"notes\", \"targetId\": \"function:623fa6c72b4803ad5ebcae3ef26517f0\", \"type\": \"calls\" }"
                - button "Remove operation 2" [ref=f1e422] [cursor=pointer]: Remove operation
              - article [ref=f1e423]:
                - strong [ref=f1e424]: "#3 Node description / constraints"
                - generic [ref=f1e425]: "{ \"kind\": \"annotate\", \"targetId\": \"notes\", \"text\": \"Preserve retry behavior; human review required\" }"
                - button "Remove operation 3" [ref=f1e426] [cursor=pointer]: Remove operation
              - article [ref=f1e427]:
                - strong [ref=f1e428]: "#4 Remove relation"
                - generic [ref=f1e429]: "{ \"kind\": \"remove_relation\", \"relationId\": \"relation:b7e3273cba7761869b456b64c4d2356a\" }"
                - button "Remove operation 4" [ref=f1e430] [cursor=pointer]: Remove operation
              - article [ref=f1e431]:
                - strong [ref=f1e432]: "#5 Add relation"
                - generic [ref=f1e433]: "{ \"kind\": \"add_relation\", \"id\": \"temp:88cfb805-64b3-4600-921a-ac06cf1b964e\", \"sourceId\": \"function:ff37abf2605d7e6bffa068c49c6c3c29\", \"targetId\": \"function:623fa6c72b4803ad5ebcae3ef26517f0\", \"type\": \"calls\" }"
                - button "Remove operation 5" [ref=f1e434] [cursor=pointer]: Remove operation
```

# Test source

```ts
  395 |       }),
  396 |     });
  397 |     await editForm
  398 |       .getByLabel("Target file (repository relative)", { exact: true })
  399 |       .fill("services/notes.ts");
  400 |     await save(() =>
  401 |       page
  402 |         .getByRole("button", { name: "Save function intent", exact: true })
  403 |         .click(),
  404 |     );
  405 |     await page
  406 |       .getByText("Node description / constraints", { exact: true })
  407 |       .click();
  408 |     await page
  409 |       .getByLabel("Annotation text", { exact: true })
  410 |       .fill("Preserve retry behavior; human review required");
  411 |     await save(() =>
  412 |       page.getByRole("button", { name: "Add annotation", exact: true }).click(),
  413 |     );
  414 |     // Reconnect an actual existing A call: removal intent and B target must coexist.
  415 |     await openCodeNavigation(page);
  416 |     await page
  417 |       .getByRole("button", { name: /ƒ caller/ })
  418 |       .first()
  419 |       .click();
  420 |     await openSourceDrawer(page);
  421 |     await page
  422 |       .getByRole("button", { name: "Expand one level", exact: true })
  423 |       .click();
  424 |     await clickEdge(`fact:${callA.id}`);
  425 |     await page
  426 |       .getByRole("combobox", { name: "Source function", exact: true })
  427 |       .selectOption(node("caller").id);
  428 |     await page
  429 |       .getByRole("combobox", { name: "Target function", exact: true })
  430 |       .selectOption(node("requestWithRetry").id);
  431 |     await save(() =>
  432 |       page
  433 |         .getByRole("button", { name: "Save reconnected relation", exact: true })
  434 |         .click(),
  435 |     );
  436 |     expect((await detail()).plan.operations).toEqual(
  437 |       expect.arrayContaining([
  438 |         { kind: "remove_relation", relationId: callA.id },
  439 |       ]),
  440 |     );
  441 |     const reconnectTarget = page
  442 |       .locator(`.code-card[data-domain-id="${node("requestWithRetry").id}"]`)
  443 |       .first();
  444 |     await expect(reconnectTarget).toBeVisible();
  445 |     await expect(reconnectTarget).toContainText("requestWithRetry");
  446 |     await expect(reconnectTarget).toContainText(
  447 |       node("requestWithRetry").filePath,
  448 |     );
  449 |     await page
  450 |       .getByRole("button", { name: "Validate plan", exact: true })
  451 |       .click();
  452 |     await expect(page.locator('.banner[role="status"]')).toContainText(
  453 |       "Validation complete",
  454 |     );
  455 |     await expect(
  456 |       page
  457 |         .locator(".plan-editor .warning")
  458 |         .filter({ hasText: "COMPATIBILITY_UNKNOWN" })
  459 |         .first(),
  460 |     ).toBeVisible();
  461 |     await page
  462 |       .locator(".plan-editor .warning")
  463 |       .filter({ hasText: "COMPATIBILITY_UNKNOWN" })
  464 |       .first()
  465 |       .scrollIntoViewIfNeeded();
  466 |     await page.screenshot({
  467 |       path: join(screenshots, "compatibility-warning.png"),
  468 |       fullPage: true,
  469 |     });
  470 |     const validationIssues = await mcp.call("validate_plan", {
  471 |       projectId: project.id,
  472 |       planId: (await detail()).plan.id,
  473 |     });
  474 |     expect(
  475 |       validationIssues.some(
  476 |         (issue) =>
  477 |           issue.code === "COMPATIBILITY_UNKNOWN" &&
  478 |           issue.severity === "warning",
  479 |       ),
  480 |     ).toBe(true);
  481 |     await page
  482 |       .getByRole("button", { name: "Confirm current revision", exact: true })
  483 |       .click();
  484 |     await expect(
  485 |       page.getByText("✓ Current approval valid", { exact: true }),
  486 |     ).toBeVisible();
  487 |     const beforeKnowledge = await detail();
  488 |     expect(beforeKnowledge.valid).toBe(true);
  489 |     const [policy] = await api(`/api/projects/${project.id}/policies`);
  490 |     await page
  491 |       .getByRole("combobox", {
  492 |         name: "Directory responsibilities",
  493 |         exact: true,
  494 |       })
> 495 |       .selectOption(policy.id);
      |        ^ TimeoutError: locator.selectOption: Timeout 15000ms exceeded.
  496 |     await page
  497 |       .getByLabel("Forbidden dependencies", {
  498 |         exact: true,
  499 |       })
  500 |       .fill("requests.ts");
  501 |     await page
  502 |       .getByRole("button", { name: "Save policy", exact: true })
  503 |       .click();
  504 |     await expect
  505 |       .poll(async () => (await detail()).plan.revision)
  506 |       .toBe(beforeKnowledge.plan.revision + 1);
  507 |     const prohibited = await detail();
  508 |     expect(prohibited.valid).toBe(false);
  509 |     expect(prohibited.approval).toEqual(beforeKnowledge.approval);
  510 |     expect(
  511 |       prohibited.issues.some((issue) => issue.code === "FORBIDDEN_DEPENDENCY"),
  512 |     ).toBe(true);
  513 |     await page
  514 |       .getByLabel("Forbidden dependencies", {
  515 |         exact: true,
  516 |       })
  517 |       .fill("internal");
  518 |     await page
  519 |       .getByLabel("Purpose", { exact: true })
  520 |       .fill("Reuse requests; reviewed policy version");
  521 |     await page
  522 |       .getByRole("button", { name: "Save policy", exact: true })
  523 |       .click();
  524 |     await expect
  525 |       .poll(async () => (await detail()).plan.revision)
  526 |       .toBe(beforeKnowledge.plan.revision + 2);
  527 |     expect(
  528 |       (await mcp.call("get_approved_plan", { ...args, planId })).valid,
  529 |     ).toBe(false);
  530 |     await page
  531 |       .getByRole("button", { name: "Confirm current revision", exact: true })
  532 |       .click();
  533 |     await expect(
  534 |       page.getByText("✓ Current approval valid", { exact: true }),
  535 |     ).toBeVisible();
  536 |     const approved = await detail();
  537 |     expect(approved.valid).toBe(true);
  538 |     const originalView = await api(`/api/projects/${project.id}/view`);
  539 |     const card = page.locator(
  540 |       `.react-flow__node[data-id="fact:${node("caller").id}"]`,
  541 |     );
  542 |     const box = await card.boundingBox();
  543 |     expect(box).toBeTruthy();
  544 |     await page.mouse.move(box.x + box.width / 2, box.y + 30);
  545 |     await page.mouse.down();
  546 |     await page.mouse.move(box.x + box.width / 2 + 35, box.y + 55, {
  547 |       steps: 10,
  548 |     });
  549 |     await page.mouse.up();
  550 |     await expect
  551 |       .poll(async () =>
  552 |         JSON.stringify(
  553 |           (await api(`/api/projects/${project.id}/view`)).positions,
  554 |         ),
  555 |       )
  556 |       .not.toBe(JSON.stringify(originalView.positions));
  557 |     expect(await detail()).toEqual(approved);
  558 |     await page
  559 |       .getByRole("button", { name: "Advanced editing", exact: true })
  560 |       .click();
  561 |     await page
  562 |       .getByLabel("Plan title", { exact: true })
  563 |       .fill("Reviewed notes plan");
  564 |     const changed = await save(() =>
  565 |       page
  566 |         .getByRole("button", {
  567 |           name: "Save title and description",
  568 |           exact: true,
  569 |         })
  570 |         .click(),
  571 |     );
  572 |     expect(changed.valid).toBe(false);
  573 |     expect(changed.plan.revision).toBe(approved.plan.revision + 1);
  574 |     await page
  575 |       .getByRole("button", { name: "Confirm current revision", exact: true })
  576 |       .click();
  577 |     await expect(
  578 |       page.getByText("✓ Current approval valid", { exact: true }),
  579 |     ).toBeVisible();
  580 |     const final = await detail();
  581 |     evidence.approval = final.approval;
  582 |     for (const format of ["JSON", "Markdown"]) {
  583 |       const downloadPromise = page.waitForEvent("download");
  584 |       await page
  585 |         .getByRole("button", { name: `Export ${format}`, exact: true })
  586 |         .click();
  587 |       const download = await downloadPromise,
  588 |         content = await readFile(await download.path(), "utf8");
  589 |       expect(content).toContain("Reviewed notes plan");
  590 |       expect(content).toContain("services/notes.ts");
  591 |       if (format === "JSON")
  592 |         expect(JSON.parse(content).approval.semanticHash).toBe(
  593 |           final.approval.semanticHash,
  594 |         );
  595 |       evidence[`export${format}`] = {
```