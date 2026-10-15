# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: planning.spec.mjs >> production UI and SDK share the complete planning, approval, persistence and verification flow offline
- Location: tests/e2e/planning.spec.mjs:18:1

# Error details

```
AssertionError: {"content":[{"type":"text","text":"{\"code\":\"NOT_APPROVED\",\"message\":\"Plan no longer has a valid current approval.\",\"status\":409}"}],"isError":true}
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
      - option "typescript · /tmp/atlas-e2e-wozQzL/typescript" [selected]
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
        - code [ref=f1e18]: /tmp/atlas-e2e-wozQzL/typescript
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
            - text: "Structure status: ready · r2File digest:"
            - code [ref=f1e87]: 094dafdd2debe1479265d959c2a50fc33668ba1bd34096371c5d7ab2f1717f00
            - text: "Verified: 2026-10-11T01:53:48.179Z"
          - status [ref=f1e88]: Saved. Read again before another edit.
          - generic [ref=f1e89]:
            - button "New policy" [ref=f1e90] [cursor=pointer]
            - button "New file folder" [ref=f1e91] [cursor=pointer]
          - generic [ref=f1e92]:
            - text: Edit policy
            - combobox "Edit policy" [ref=f1e93]:
              - option "New policy"
              - option "New file folder"
              - option "services · Reuse existing request behavior" [selected]
          - group [ref=f1e95]:
            - generic [ref=f1e96]:
              - text: Path prefix
              - textbox "Path prefix" [ref=f1e97]:
                - /placeholder: src/
                - text: services
            - generic [ref=f1e98]:
              - text: Purpose
              - textbox "Purpose" [ref=f1e99]: Reuse requests; reviewed policy version
            - generic [ref=f1e100]:
              - text: Forbidden dependencies
              - textbox "Forbidden dependencies" [ref=f1e101]:
                - /placeholder: src/internal
                - text: internal
            - button "Save policy" [disabled] [ref=f1e102]
          - heading "Legacy path policies" [level=3] [ref=f1e103]
          - article [ref=f1e104]:
            - strong [ref=f1e105]: services
            - paragraph [ref=f1e106]: Reuse existing request behavior
            - generic [ref=f1e107]: File extension policy · Existing target-path checks
            - text: Forbidden dependencies
            - list [ref=f1e108]:
              - listitem [ref=f1e109]:
                - code [ref=f1e110]: requests.ts
          - heading "structure.json folders" [level=3] [ref=f1e111]
          - paragraph [ref=f1e112]: Purpose description; requires human judgment
          - group [ref=f1e113]:
            - generic "Read-only metadata" [ref=f1e114] [cursor=pointer]
          - paragraph [ref=f1e115]: Preview first. Import is explicit and invalidates current approval; historical approvals remain recorded.
          - button "Preview DB policy migration" [disabled] [ref=f1e116]
        - group [ref=f1e117]:
          - generic "Static analysis diagnostics (0)" [ref=f1e118] [cursor=pointer]
    - generic [ref=f1e119]:
      - navigation "Location" [ref=f1e120]:
        - list [ref=f1e121]:
          - listitem [ref=f1e122]:
            - button "typescript" [ref=f1e123] [cursor=pointer]
        - generic [ref=f1e124]: Fetch notes through reuse · Affected objects 3
      - generic [ref=f1e125]:
        - generic "Plan ownership" [ref=f1e126]:
          - button "Layout" [pressed] [ref=f1e127] [cursor=pointer]
          - button "Plan ownership" [ref=f1e128] [cursor=pointer]
        - button "Circle-select functions" [ref=f1e129] [cursor=pointer]
        - generic [ref=f1e130]:
          - text: Visible layers
          - combobox "Visible layers" [ref=f1e131]:
            - option "Facts + plan" [selected]
            - option "Fact"
            - option "Plan"
        - generic [ref=f1e132]:
          - text: New/reconnected relation type
          - combobox "New/reconnected relation type" [ref=f1e133]:
            - option "Calls" [selected]
            - option "Must call"
            - option "Must reuse"
      - generic [ref=f1e134]: Hover to preview links, click for references, double-click for the dependency funnel. Drag any card. Esc closes the map, then details, then the funnel.
      - generic "Code canvas" [ref=f1e135]:
        - application [ref=f1e136]:
          - generic [ref=f1e138]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:file:df14cf0a6c49ed283096773342e2827e to fact:function:3dcba27c9805358de69437a46c3b4e71" [ref=f1e139] [cursor=pointer]:
                    - generic [ref=f1e142]: Fact · Contains
                - img:
                  - group "Edge from fact:function:3dcba27c9805358de69437a46c3b4e71 to group-member:85d75ff7-daae-4db4-a278-9b72324bb733:function:11f35a6d2072fcc62f26ab79ec50e062" [ref=f1e144] [cursor=pointer]:
                    - generic [ref=f1e147]: Fact · Calls · Planned removal
                - img:
                  - group "Edge from fact:file:9304a8b21fad29b03eeb31559212b55e to group-member:85d75ff7-daae-4db4-a278-9b72324bb733:function:11f35a6d2072fcc62f26ab79ec50e062" [ref=f1e151] [cursor=pointer]:
                    - generic [ref=f1e154]: Fact · Contains
                - img:
                  - group "Edge from plan:notes to group-member:74ad6e42-652a-4077-9ca0-39fa9f86ca14:function:df820708a12ce8ac3edf5ca1bf4d6678" [ref=f1e156] [cursor=pointer]:
                    - generic [ref=f1e159]: Plan · Calls · same relation mirrored
                - img:
                  - group "Edge from plan:notes to group-member:85d75ff7-daae-4db4-a278-9b72324bb733:function:df820708a12ce8ac3edf5ca1bf4d6678" [ref=f1e163] [cursor=pointer]:
                    - generic [ref=f1e166]: Plan · Calls · same relation mirrored
                - img:
                  - group "Edge from fact:function:3dcba27c9805358de69437a46c3b4e71 to group-member:74ad6e42-652a-4077-9ca0-39fa9f86ca14:function:df820708a12ce8ac3edf5ca1bf4d6678" [ref=f1e170] [cursor=pointer]:
                    - generic [ref=f1e173]: Plan · Calls · same relation mirrored
                - img:
                  - group "Edge from fact:function:3dcba27c9805358de69437a46c3b4e71 to group-member:85d75ff7-daae-4db4-a278-9b72324bb733:function:df820708a12ce8ac3edf5ca1bf4d6678" [ref=f1e177] [cursor=pointer]:
                    - generic [ref=f1e180]: Plan · Calls · same relation mirrored
              - generic:
                - group [ref=f1e184]:
                  - generic [ref=f1e185]:
                    - generic [ref=f1e186]:
                      - generic [ref=f1e187]: ● Code fact
                      - generic [ref=f1e188]: Folder
                    - strong [ref=f1e189]:
                      - generic [ref=f1e190]:
                        - generic [aria-hidden] [ref=f1e191]: 
                        - generic [ref=f1e192]: ./
                        - generic [ref=f1e193]: Folder
                    - code [ref=f1e194]: .
                - group [ref=f1e195]:
                  - generic [ref=f1e196]:
                    - generic [ref=f1e198]:
                      - generic [ref=f1e199]: ● Code fact
                      - generic [ref=f1e200]: Function
                    - strong [ref=f1e201]:
                      - generic [ref=f1e202]:
                        - generic [aria-hidden] [ref=f1e203]: 
                        - generic [ref=f1e204]: caller()
                        - generic [ref=f1e205]: Function
                    - code [ref=f1e206]: main.ts
                    - generic "export function caller()" [ref=f1e207]
                - group [ref=f1e209]:
                  - generic [ref=f1e210]:
                    - generic [ref=f1e212]:
                      - generic [ref=f1e213]: ● Code fact
                      - generic [ref=f1e214]: File
                    - strong [ref=f1e215]:
                      - generic [ref=f1e216]:
                        - generic [aria-hidden] [ref=f1e217]: 
                        - generic [ref=f1e218]: main.ts
                        - generic [ref=f1e219]: File
                    - code [ref=f1e220]: main.ts
                - group [ref=f1e222]:
                  - generic [ref=f1e223]:
                    - generic [ref=f1e225]:
                      - generic [ref=f1e226]: ● Code fact
                      - generic [ref=f1e227]: File
                    - strong [ref=f1e228]:
                      - generic [ref=f1e229]:
                        - generic [aria-hidden] [ref=f1e230]: 
                        - generic [ref=f1e231]: requests.ts
                        - generic [ref=f1e232]: File
                    - code [ref=f1e233]: requests.ts
                - group [ref=f1e235]:
                  - generic [ref=f1e236]:
                    - generic [ref=f1e238]:
                      - generic [ref=f1e239]: ＋ Planned addition
                      - generic [ref=f1e240]: Function
                    - strong [ref=f1e241]:
                      - generic [ref=f1e242]:
                        - generic [aria-hidden] [ref=f1e243]: 
                        - generic [ref=f1e244]: fetchNotes()
                        - generic [ref=f1e245]: Function
                    - code [ref=f1e246]: services/notes.ts
                    - generic [ref=f1e247]: Annotation · Preserve retry behavior; human review required
                - group [ref=f1e249]:
                  - generic [ref=f1e251]:
                    - strong [ref=f1e252]: Shared membership
                    - button "Collapse Shared membership" [ref=f1e253] [cursor=pointer]: Collapse
                    - paragraph [ref=f1e254]: 1 / 1 loaded members · 0 not loaded
                    - generic [ref=f1e255]: Only the loaded scope is shown; unloaded calls are unknown
                    - generic [ref=f1e256]: Same function mirrored · Shared membership
                - group [ref=f1e257]:
                  - generic [ref=f1e258]:
                    - generic [ref=f1e260]:
                      - generic [ref=f1e261]: ↳ Fact reference
                      - generic [ref=f1e262]: Function
                    - generic [ref=f1e263]: Same function mirrored · Shared membership
                    - strong [ref=f1e264]:
                      - generic [ref=f1e265]:
                        - generic [aria-hidden] [ref=f1e266]: 
                        - generic [ref=f1e267]: requestWithRetry()
                        - generic [ref=f1e268]: Function
                    - code [ref=f1e269]: requests.ts
                    - generic "export function requestWithRetry()" [ref=f1e270]
                - group [ref=f1e272]:
                  - generic [ref=f1e274]:
                    - strong [ref=f1e275]: Reusable requests
                    - button "Collapse Reusable requests" [ref=f1e276] [cursor=pointer]: Collapse
                    - paragraph [ref=f1e277]: 2 / 2 loaded members · 0 not loaded
                    - generic [ref=f1e278]: Only the loaded scope is shown; unloaded calls are unknown
                    - generic [ref=f1e279]: Same function mirrored · Reusable requests
                - group [ref=f1e280]:
                  - generic [ref=f1e281]:
                    - generic [ref=f1e283]:
                      - generic [ref=f1e284]: ↳ Fact reference
                      - generic [ref=f1e285]: Function
                    - generic [ref=f1e286]: Same function mirrored · Reusable requests
                    - strong [ref=f1e287]:
                      - generic [ref=f1e288]:
                        - generic [aria-hidden] [ref=f1e289]: 
                        - generic [ref=f1e290]: requestWithRetry()
                        - generic [ref=f1e291]: Function
                    - code [ref=f1e292]: requests.ts
                    - generic "export function requestWithRetry()" [ref=f1e293]
                - group [ref=f1e295]:
                  - generic [ref=f1e296]:
                    - generic [ref=f1e298]:
                      - generic [ref=f1e299]: ● Code fact
                      - generic [ref=f1e300]: Function
                    - generic [ref=f1e301]: Same function mirrored · Reusable requests
                    - strong [ref=f1e302]:
                      - generic [ref=f1e303]:
                        - generic [aria-hidden] [ref=f1e304]: 
                        - generic [ref=f1e305]: A()
                        - generic [ref=f1e306]: Function
                    - code [ref=f1e307]: requests.ts
                    - generic "export function A()" [ref=f1e308]
          - generic "Control Panel" [ref=f1e310]:
            - button "Zoom in" [ref=f1e311] [cursor=pointer]
            - button "Zoom out" [ref=f1e314] [cursor=pointer]
            - button "Fit view" [ref=f1e317] [cursor=pointer]
            - button "Toggle interaction" [ref=f1e320] [cursor=pointer]
          - complementary "Map of the loaded graph" [ref=f1e323]:
            - button "Expand map" [ref=f1e324] [cursor=pointer]
            - img "Graph overview" [ref=f1e326]
          - link "React Flow attribution" [ref=f1e338] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
        - status:
          - generic: "Loaded scope: group cards: 2 · expanded member mirrors: 3"
          - generic: Group view counts are additional to the fact query budget
      - generic [ref=f1e340]:
        - generic [ref=f1e341]: "Code fact query budget: Expansion: up to 80 nodes / 240 relations; optionally 300 / 900."
        - generic [ref=f1e342]: Layout, theme and language saved automatically
    - complementary "Details panel" [ref=f1e343]:
      - region "Plan review" [ref=f1e344]:
        - button "Awaiting your review · 1" [ref=f1e345] [cursor=pointer]:
          - generic [aria-hidden] [ref=f1e347]: ▾
      - navigation [ref=f1e348]:
        - button "Back to chat" [ref=f1e349] [cursor=pointer]
        - button "View source" [disabled] [ref=f1e350]
        - button "Advanced editing" [pressed] [ref=f1e351] [cursor=pointer]
        - button "Implementation check" [ref=f1e352] [cursor=pointer]
        - button "Knowledge notes" [ref=f1e353] [cursor=pointer]
      - generic [ref=f1e354]:
        - generic [ref=f1e355]:
          - button "Undo" [disabled] [ref=f1e356]
          - button "Redo" [disabled] [ref=f1e357]
        - paragraph [ref=f1e358]: "Session history: up to 50 edits per plan, across 20 plans. Undo/redo saves a new revision. Reloading the page clears history; external revisions reset it."
        - generic [ref=f1e359]:
          - heading "Plan editor" [level=2] [ref=f1e360]
          - generic [ref=f1e361]:
            - generic [ref=f1e362]:
              - text: New plan title
              - textbox "New plan title" [ref=f1e363]
            - button "Create plan" [ref=f1e364] [cursor=pointer]
          - generic [ref=f1e365]:
            - text: Choose plan
            - combobox "Choose plan" [ref=f1e366]:
              - option "Choose or create a plan"
              - option "Fetch notes through reuse · r15 · Draft" [selected]
          - button "Reload plan" [ref=f1e367] [cursor=pointer]
          - group [ref=f1e368]:
            - generic [ref=f1e369]:
              - strong [ref=f1e370]: Revision r15 · Draft
              - paragraph [ref=f1e371]: ○ No valid current approval
              - text: Baseline snapshot
              - code [ref=f1e372]: snapshot:d29ddff772fbff10bc14f8e9ad760de7
              - generic [ref=f1e373]: Approval digest · r13
              - code [ref=f1e374]: 5f0cd0e385f0bb77ce775f71ca8a11bca1d12e5c2f9a718bc631951274afd751
            - generic [ref=f1e375]:
              - generic [ref=f1e376]:
                - text: Plan title
                - textbox "Plan title" [ref=f1e377]: Fetch notes through reuse
              - generic [ref=f1e378]:
                - text: Description / constraints
                - textbox "Description / constraints" [ref=f1e379]
              - button "Save title and description" [disabled] [ref=f1e380]
            - paragraph [ref=f1e381]: Confirmation binds the current revision and semantic digest. Semantic edits create a revision; dragging only saves layout.
            - generic [ref=f1e382]:
              - button "Validate plan" [ref=f1e383] [cursor=pointer]
              - button "Confirm current revision" [ref=f1e384] [cursor=pointer]
            - generic [ref=f1e385]:
              - button "Export Markdown" [ref=f1e386] [cursor=pointer]
              - button "Export JSON" [ref=f1e387] [cursor=pointer]
            - group [ref=f1e388]:
              - generic "Server validation results (2)" [ref=f1e389] [cursor=pointer]
              - paragraph [ref=f1e390]: "Warning · COMPATIBILITY_UNKNOWN: Interface compatibility is unknown; arguments, return values, and possible adaptation require human review."
              - paragraph [ref=f1e391]: "Warning · COMPATIBILITY_UNKNOWN: Interface compatibility is unknown; arguments, return values, and possible adaptation require human review."
            - group [ref=f1e392]:
              - generic "New planned function" [ref=f1e393] [cursor=pointer]
              - paragraph [ref=f1e394]: A target file is planned through add_function or move_function; source files are not written.
              - generic [ref=f1e395]:
                - generic [ref=f1e396]:
                  - text: Function name
                  - textbox "Function name" [ref=f1e397]
                - generic [ref=f1e398]:
                  - text: Target file (repository relative)
                  - textbox "Target file (repository relative)" [ref=f1e399]:
                    - /placeholder: src/feature.ts
                - generic [ref=f1e400]:
                  - text: Signature
                  - textbox "Signature" [ref=f1e401]
                - generic [ref=f1e402]:
                  - text: Function responsibility
                  - textbox "Function responsibility" [ref=f1e403]
                - paragraph [ref=f1e404]:
                  - text: "Target file preview:"
                  - code [ref=f1e405]: ∅ → …
                - button "Add function" [disabled] [ref=f1e406]
            - group [ref=f1e407]:
              - generic "Planned relations" [ref=f1e408] [cursor=pointer]
              - paragraph [ref=f1e409]: Click a relation to reconnect/remove it, or drag its endpoint.
              - generic [ref=f1e410]:
                - generic [ref=f1e411]:
                  - text: Source function
                  - combobox "Source function" [ref=f1e412]:
                    - option "Choose a function" [selected]
                    - option "A · requests.ts"
                    - option "caller · main.ts"
                    - option "dynamic · main.ts"
                    - option "requestWithRetry · requests.ts"
                    - option "fetchNotes · services/notes.ts"
                - generic [ref=f1e413]:
                  - text: Target function
                  - combobox "Target function" [ref=f1e414]:
                    - option "Choose a function" [selected]
                    - option "A · requests.ts"
                    - option "caller · main.ts"
                    - option "dynamic · main.ts"
                    - option "requestWithRetry · requests.ts"
                    - option "fetchNotes · services/notes.ts"
                - generic [ref=f1e415]:
                  - text: New/reconnected relation type
                  - combobox "New/reconnected relation type" [ref=f1e416]:
                    - option "Calls" [selected]
                    - option "Must call"
                    - option "Must reuse"
                - button "Add relation" [ref=f1e417] [cursor=pointer]
            - group [ref=f1e418]:
              - generic "Change list (5)" [ref=f1e419] [cursor=pointer]
              - article [ref=f1e420]:
                - strong [ref=f1e421]: "#1 Add function"
                - generic [ref=f1e422]: "{ \"kind\": \"add_function\", \"tempId\": \"notes\", \"name\": \"fetchNotes\", \"filePath\": \"services/notes.ts\", \"signature\": \"\", \"description\": \"\" }"
                - button "Remove operation 1" [ref=f1e423] [cursor=pointer]: Remove operation
              - article [ref=f1e424]:
                - strong [ref=f1e425]: "#2 Add relation"
                - generic [ref=f1e426]: "{ \"kind\": \"add_relation\", \"id\": \"new-call\", \"sourceId\": \"notes\", \"targetId\": \"function:df820708a12ce8ac3edf5ca1bf4d6678\", \"type\": \"calls\" }"
                - button "Remove operation 2" [ref=f1e427] [cursor=pointer]: Remove operation
              - article [ref=f1e428]:
                - strong [ref=f1e429]: "#3 Node description / constraints"
                - generic [ref=f1e430]: "{ \"kind\": \"annotate\", \"targetId\": \"notes\", \"text\": \"Preserve retry behavior; human review required\" }"
                - button "Remove operation 3" [ref=f1e431] [cursor=pointer]: Remove operation
              - article [ref=f1e432]:
                - strong [ref=f1e433]: "#4 Remove relation"
                - generic [ref=f1e434]: "{ \"kind\": \"remove_relation\", \"relationId\": \"relation:6a34ee4cd5f8d9b283cce289b2f563f6\" }"
                - button "Remove operation 4" [ref=f1e435] [cursor=pointer]: Remove operation
              - article [ref=f1e436]:
                - strong [ref=f1e437]: "#5 Add relation"
                - generic [ref=f1e438]: "{ \"kind\": \"add_relation\", \"id\": \"temp:83c35fdd-043b-4dbd-b26e-b73fd4f6b732\", \"sourceId\": \"function:3dcba27c9805358de69437a46c3b4e71\", \"targetId\": \"function:df820708a12ce8ac3edf5ca1bf4d6678\", \"type\": \"calls\" }"
                - button "Remove operation 5" [ref=f1e439] [cursor=pointer]: Remove operation
```

# Test source

```ts
  25  | 
  26  | function childEnvironment() {
  27  |   const env = { ...process.env };
  28  |   // Playwright may force color while the host declares NO_COLOR; keep child stderr diagnostic-only.
  29  |   if (env.NO_COLOR !== undefined) delete env.FORCE_COLOR;
  30  |   return env;
  31  | }
  32  | export async function freePort() {
  33  |   const listener = createServer().listen(0, "127.0.0.1");
  34  |   await once(listener, "listening");
  35  |   const port = listener.address().port;
  36  |   await new Promise((done) => listener.close(done));
  37  |   return port;
  38  | }
  39  | export async function startProduction(data, port) {
  40  |   port ??= await freePort();
  41  |   const child = spawn(
  42  |     process.execPath,
  43  |     [
  44  |       "--import",
  45  |       pathToFileURL(resolve("tests/support/graceful-preload.mjs")).href,
  46  |       resolve("apps/server/dist/index.js"),
  47  |     ],
  48  |     {
  49  |       env: {
  50  |         ...childEnvironment(),
  51  |         CODEMAP_PORT: String(port),
  52  |         CODEMAP_DATA_DIR: data,
  53  |         CODEMAP_WORKSPACE_ROOT: "",
  54  |       },
  55  |       stdio: ["ignore", "pipe", "pipe", "ipc"],
  56  |     },
  57  |   );
  58  |   let output = "";
  59  |   child.stdout.on("data", (value) => {
  60  |     output += value;
  61  |   });
  62  |   child.stderr.on("data", (value) => {
  63  |     output += value;
  64  |   });
  65  |   const exited = once(child, "exit");
  66  |   const url = `http://127.0.0.1:${port}`;
  67  |   const stop = async () => {
  68  |     if (child.exitCode !== null || child.signalCode !== null) return;
  69  |     child.send({ testSignal: "SIGTERM" });
  70  |     const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
  71  |     try {
  72  |       assert.deepEqual(await exited, [0, null], output);
  73  |     } finally {
  74  |       clearTimeout(timer);
  75  |     }
  76  |   };
  77  |   try {
  78  |     const deadline = Date.now() + 15000;
  79  |     while (
  80  |       Date.now() < deadline &&
  81  |       child.exitCode === null &&
  82  |       child.signalCode === null
  83  |     ) {
  84  |       try {
  85  |         if ((await fetch(`${url}/api/health`)).ok)
  86  |           return { url, port, stop, child, output: () => output };
  87  |       } catch {}
  88  |       await new Promise((done) => setTimeout(done, 40));
  89  |     }
  90  |     throw new Error(`Production server did not become ready: ${output}`);
  91  |   } catch (error) {
  92  |     await stop();
  93  |     throw error;
  94  |   }
  95  | }
  96  | export async function http(url, path, method = "GET", body) {
  97  |   const response = await fetch(`${url}${path}`, {
  98  |     method,
  99  |     headers: { "content-type": "application/json" },
  100 |     ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  101 |   });
  102 |   const value = await response.json();
  103 |   assert.equal(response.ok, true, JSON.stringify(value));
  104 |   return value;
  105 | }
  106 | export async function connectMcp(url) {
  107 |   const transport = new StdioClientTransport({
  108 |     command: process.execPath,
  109 |     args: [resolve("apps/mcp/dist/index.js")],
  110 |     env: { ...childEnvironment(), CODEMAP_API_URL: url },
  111 |     stderr: "pipe",
  112 |   });
  113 |   let stderr = "";
  114 |   transport.stderr?.on("data", (chunk) => {
  115 |     stderr += chunk;
  116 |   });
  117 |   const client = new Client({ name: "atlasmode-acceptance", version: "1.0.0" });
  118 |   await client.connect(transport);
  119 |   return {
  120 |     client,
  121 |     transport,
  122 |     stderr: () => stderr,
  123 |     call: async (name, args = {}) => {
  124 |       const result = await client.callTool({ name, arguments: args });
> 125 |       assert.notEqual(result.isError, true, JSON.stringify(result));
      |              ^ AssertionError: {"content":[{"type":"text","text":"{\"code\":\"NOT_APPROVED\",\"message\":\"Plan no longer has a valid current approval.\",\"status\":409}"}],"isError":true}
  126 |       return JSON.parse(result.content[0].text);
  127 |     },
  128 |   };
  129 | }
  130 | export const requestSource =
  131 |   'export function A() { return "direct"; }\nexport function requestWithRetry() { return "retry"; }\n';
  132 | export const callerSource =
  133 |   'import { A, requestWithRetry } from "./requests";\nexport function caller() { return A(); }\nexport function dynamic(fn: () => void) { return fn(); }\n';
  134 | export async function createFixtures(root) {
  135 |   const ts = join(root, "typescript"),
  136 |     python = join(root, "python"),
  137 |     marker = join(root, "TARGET_EXECUTED");
  138 |   await mkdir(ts, { recursive: true });
  139 |   await mkdir(python, { recursive: true });
  140 |   await writeFile(join(ts, "requests.ts"), requestSource);
  141 |   await writeFile(join(ts, "main.ts"), callerSource);
  142 |   await writeFile(
  143 |     join(ts, "never-execute.ts"),
  144 |     `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "executed");\nthrow new Error("Target source must never execute");\n`,
  145 |   );
  146 |   await writeFile(
  147 |     join(python, "app.py"),
  148 |     `from pathlib import Path\nPath(${JSON.stringify(marker)}).write_text("executed")\nraise RuntimeError("Target source must never execute")\ndef helper():\n    return 7\ndef entry():\n    return helper()\ndef dynamic(fn):\n    return fn()\n`,
  149 |   );
  150 |   return {
  151 |     ts,
  152 |     python,
  153 |     marker,
  154 |     assertNotExecuted: async () => {
  155 |       await assert.rejects(access(marker));
  156 |     },
  157 |   };
  158 | }
  159 | 
```