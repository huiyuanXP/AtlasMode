# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: planning.spec.mjs >> production UI and SDK share the complete planning, approval, persistence and verification flow offline
- Location: tests/e2e/planning.spec.mjs:13:1

# Error details

```
AssertionError: AtlasMode API listening on 127.0.0.1:37071 (built web assets available)

+ actual - expected

  [
-   0,
    null,
+   'SIGKILL'
  ]

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - banner [ref=f1e4]:
    - link "◈ AtlasMode Code facts · Visual planning" [ref=f1e5] [cursor=pointer]:
      - /url: "#"
      - text: ◈ AtlasMode
      - generic [ref=f1e6]: Code facts · Visual planning
    - generic [ref=f1e7]:
      - textbox "Local project path" [ref=f1e8]:
        - /placeholder: Absolute path, e.g. C:\work\project or /home/me/project
      - button "Open and index" [ref=f1e9] [cursor=pointer]
    - combobox "Switch project" [ref=f1e10]:
      - option "Choose an opened project"
      - option "typescript · /tmp/atlas-e2e-HXfbRH/typescript" [selected]
    - button "Refresh code" [ref=f1e11] [cursor=pointer]
    - button "Toggle light/dark" [ref=f1e12] [cursor=pointer]: ☀ Light
    - combobox "Interface language" [ref=f1e13]:
      - option "中文"
      - option "English" [selected]
  - status [ref=f1e14]:
    - text: Validation complete; results come from the local service.
    - button "Dismiss" [ref=f1e15] [cursor=pointer]: ×
  - main [ref=f1e16]:
    - complementary "Project facts" [ref=f1e17]:
      - generic [ref=f1e18]:
        - text: Project facts
        - heading "typescript" [level=1] [ref=f1e19]
        - code [ref=f1e20]: /tmp/atlas-e2e-HXfbRH/typescript
      - generic [ref=f1e21]:
        - generic [ref=f1e22]:
          - strong [ref=f1e23]: "4"
          - text: Functions/classes
        - generic [ref=f1e24]:
          - strong [ref=f1e25]: "3"
          - text: Files
      - paragraph [ref=f1e26]: "Calls: 1 Resolved · 2 Unresolved · 1 External"
      - generic [ref=f1e27]:
        - heading "Entry candidates 4/4" [level=2] [ref=f1e28]:
          - text: Entry candidates
          - generic [ref=f1e29]: 4/4
        - paragraph [ref=f1e30]: "TS/JS: explicit exports; Python: public top-level names. These are candidates, not confirmed runtime entries."
        - generic [ref=f1e31]:
          - button "ƒ A requests.ts" [ref=f1e32] [cursor=pointer]:
            - strong [ref=f1e33]: ƒ A
            - generic [ref=f1e34]: requests.ts
          - button "ƒ caller main.ts" [ref=f1e35] [cursor=pointer]:
            - strong [ref=f1e36]: ƒ caller
            - generic [ref=f1e37]: main.ts
          - button "ƒ dynamic main.ts" [ref=f1e38] [cursor=pointer]:
            - strong [ref=f1e39]: ƒ dynamic
            - generic [ref=f1e40]: main.ts
          - button "ƒ requestWithRetry requests.ts" [ref=f1e41] [cursor=pointer]:
            - strong [ref=f1e42]: ƒ requestWithRetry
            - generic [ref=f1e43]: requests.ts
      - generic [ref=f1e44]:
        - heading "Search functions" [level=2] [ref=f1e45]
        - generic [ref=f1e46]:
          - textbox "Search functions" [ref=f1e47]:
            - /placeholder: Name, qualified name or path
          - button "Search" [ref=f1e48] [cursor=pointer]
      - generic [ref=f1e49]:
        - heading "Browse routes" [level=2] [ref=f1e50]
        - combobox "Browse routes" [ref=f1e51]:
          - option "No route"
          - option "Actual call chain"
          - option "Reuse walkthrough" [selected]
        - paragraph [ref=f1e52]: A route is an explanation sequence; it does not imply calls.
        - paragraph [ref=f1e53]: Explanation, not a call
        - generic [ref=f1e54]: "Route source: Agent · Walkthrough · r1"
        - list [ref=f1e55]:
          - listitem [ref=f1e56]:
            - button "1. Reusable target" [ref=f1e57] [cursor=pointer]
        - paragraph [ref=f1e58]: "Step note: Reusable target"
        - generic [ref=f1e59]:
          - button "Previous step" [disabled] [ref=f1e60]
          - button "Next step" [disabled] [ref=f1e61]
          - button "Focus step" [ref=f1e62] [cursor=pointer]
      - generic [ref=f1e63]:
        - heading "Function groups" [level=2] [ref=f1e64]
        - paragraph [ref=f1e65]: Select fact functions below. A function can belong to multiple groups; source files stay in place.
        - paragraph [ref=f1e66]: Changing groups or directory policies creates a new revision for every plan in this project and requires renewed confirmation.
        - group [ref=f1e68]:
          - generic [ref=f1e69]:
            - text: Group title
            - textbox "Group title" [ref=f1e70]: Shared membership
          - generic [ref=f1e71]:
            - text: Group design / description
            - textbox "Group design / description" [ref=f1e72]
          - group [ref=f1e73]:
            - generic "Selected members (1)" [ref=f1e74] [cursor=pointer]
            - generic [ref=f1e75]:
              - generic [ref=f1e76]:
                - checkbox "A requests.ts" [ref=f1e77]
                - generic [ref=f1e78]:
                  - text: A
                  - generic [ref=f1e79]: requests.ts
              - generic [ref=f1e80]:
                - checkbox "caller main.ts" [ref=f1e81]
                - generic [ref=f1e82]:
                  - text: caller
                  - generic [ref=f1e83]: main.ts
              - generic [ref=f1e84]:
                - checkbox "dynamic main.ts" [ref=f1e85]
                - generic [ref=f1e86]:
                  - text: dynamic
                  - generic [ref=f1e87]: main.ts
              - generic [ref=f1e88]:
                - checkbox "requestWithRetry requests.ts" [checked] [ref=f1e89]
                - generic [ref=f1e90]:
                  - text: requestWithRetry
                  - generic [ref=f1e91]: requests.ts
          - button "Create group" [ref=f1e92] [cursor=pointer]
        - article [ref=f1e93]:
          - heading "Reusable requests" [level=3] [ref=f1e94]
          - paragraph [ref=f1e95]: Agent-authored group
          - generic [ref=f1e96]: "Agent · Members: 2"
          - button "Members" [ref=f1e97] [cursor=pointer]
        - article [ref=f1e98]:
          - heading "Shared membership" [level=3] [ref=f1e99]
          - paragraph
          - generic [ref=f1e100]: "User · Members: 1"
          - button "Members" [ref=f1e101] [cursor=pointer]
      - generic [ref=f1e102]:
        - heading "Directory responsibilities" [level=2] [ref=f1e103]
        - paragraph [ref=f1e104]: Responsibility text requires human/Agent review. Explicit dependency rules are checked against existing and planned relations.
        - paragraph [ref=f1e105]: Changing groups or directory policies creates a new revision for every plan in this project and requires renewed confirmation.
        - combobox "Directory responsibilities" [ref=f1e106]:
          - option "New policy"
          - option "services · Reuse requests; reviewed policy version" [selected]
        - group [ref=f1e108]:
          - generic [ref=f1e109]:
            - text: Directory scope
            - textbox "Directory scope" [ref=f1e110]:
              - /placeholder: src/
              - text: services
          - generic [ref=f1e111]:
            - text: Responsibility
            - textbox "Responsibility" [ref=f1e112]: Reuse requests; reviewed policy version
          - generic [ref=f1e113]:
            - text: Forbidden dependencies (one directory per line)
            - textbox "Forbidden dependencies (one directory per line)" [ref=f1e114]:
              - /placeholder: src/internal
              - text: internal
          - button "Save directory policy" [ref=f1e115] [cursor=pointer]
        - article [ref=f1e116]:
          - strong [ref=f1e117]: services
          - paragraph [ref=f1e118]: Reuse requests; reviewed policy version
          - text: Forbidden dependencies (one directory per line)
          - list [ref=f1e119]:
            - listitem [ref=f1e120]:
              - code [ref=f1e121]: internal
      - group [ref=f1e122]:
        - generic "Static analysis diagnostics (0)" [ref=f1e123] [cursor=pointer]
    - generic [ref=f1e124]:
      - generic [ref=f1e125]:
        - generic [ref=f1e126]:
          - text: Visible layers
          - combobox "Visible layers" [ref=f1e127]:
            - option "Facts + plan" [selected]
            - option "Fact"
            - option "Plan"
        - generic [ref=f1e128]:
          - text: New/reconnected relation type
          - combobox "New/reconnected relation type" [ref=f1e129]:
            - option "Calls" [selected]
            - option "Must call"
            - option "Must reuse"
      - generic [ref=f1e130]: Click to inspect source; double-click to expand. Dragging saves layout only.
      - generic "Code canvas" [ref=f1e131]:
        - application [ref=f1e132]:
          - generic [ref=f1e134]:
            - generic:
              - generic:
                - img:
                  - group "Edge from fact:function:506634e893a4e19219b793a8ee22b819 to fact:function:713946acc7a285cf4c37e470b674f84a" [ref=f1e135] [cursor=pointer]:
                    - generic [ref=f1e138]: Fact · Calls · Planned removal
                - img:
                  - group "Edge from plan:notes to fact:function:95de1ef5c9764f5535aef98dbc33dce0" [ref=f1e142] [cursor=pointer]:
                    - generic [ref=f1e145]: Plan · Calls
                - img:
                  - group "Edge from fact:function:506634e893a4e19219b793a8ee22b819 to fact:function:95de1ef5c9764f5535aef98dbc33dce0" [ref=f1e149] [cursor=pointer]:
                    - generic [ref=f1e152]: Plan · Calls
              - generic:
                - group [ref=f1e156]:
                  - generic [ref=f1e157]:
                    - generic [ref=f1e158]:
                      - generic [ref=f1e159]: ● Code fact
                      - generic [ref=f1e160]: Folder
                    - strong [ref=f1e161]: .
                    - code [ref=f1e162]: .
                - group [ref=f1e163]:
                  - generic [ref=f1e164]:
                    - generic [ref=f1e166]:
                      - generic [ref=f1e167]: ● Code fact
                      - generic [ref=f1e168]: Function
                    - strong [ref=f1e169]: A
                    - code [ref=f1e170]: requests.ts
                    - generic "export function A()" [ref=f1e171]
                - group [ref=f1e173]:
                  - generic [ref=f1e174]:
                    - generic [ref=f1e176]:
                      - generic [ref=f1e177]: ● Code fact
                      - generic [ref=f1e178]: Function
                    - strong [ref=f1e179]: caller
                    - code [ref=f1e180]: main.ts
                    - generic "export function caller()" [ref=f1e181]
                - group [ref=f1e183]:
                  - generic [ref=f1e184]:
                    - generic [ref=f1e185]:
                      - generic [ref=f1e186]: ● Code fact
                      - generic [ref=f1e187]: File
                    - strong [ref=f1e188]: main.ts
                    - code [ref=f1e189]: main.ts
                - group [ref=f1e190]:
                  - generic [ref=f1e191]:
                    - generic [ref=f1e192]:
                      - generic [ref=f1e193]: ● Code fact
                      - generic [ref=f1e194]: File
                    - strong [ref=f1e195]: requests.ts
                    - code [ref=f1e196]: requests.ts
                - group [ref=f1e197]:
                  - generic [ref=f1e198]:
                    - generic [ref=f1e200]:
                      - generic [ref=f1e201]: ＋ Planned addition
                      - generic [ref=f1e202]: Function
                    - strong [ref=f1e203]: fetchNotes
                    - code [ref=f1e204]: services/notes.ts
                    - generic [ref=f1e205]: Annotation · Preserve retry behavior; human review required
                - group [ref=f1e207]:
                  - generic [ref=f1e208]:
                    - generic [ref=f1e210]:
                      - generic [ref=f1e211]: ↳ Fact reference
                      - generic [ref=f1e212]: Function
                    - strong [ref=f1e213]: requestWithRetry
                    - code [ref=f1e214]: requests.ts
                    - generic "export function requestWithRetry()" [ref=f1e215]
          - generic "Control Panel" [ref=f1e217]:
            - button "Zoom in" [ref=f1e218] [cursor=pointer]
            - button "Zoom out" [ref=f1e221] [cursor=pointer]
            - button "Fit view" [active] [ref=f1e224] [cursor=pointer]
            - button "Toggle interaction" [ref=f1e227] [cursor=pointer]
          - img "Graph overview" [ref=f1e231]
          - link "React Flow attribution" [ref=f1e240] [cursor=pointer]:
            - /url: https://reactflow.dev?utm_source=attribution
            - text: React Flow
      - generic [ref=f1e242]:
        - generic [ref=f1e243]: "Expansion: up to 80 nodes / 240 relations; optionally 300 / 900."
        - generic [ref=f1e244]: Layout, theme and language saved automatically
    - complementary "Details panel" [ref=f1e245]:
      - navigation [ref=f1e246]:
        - button "Node / source" [ref=f1e247] [cursor=pointer]
        - button "Plan editor" [pressed] [ref=f1e248] [cursor=pointer]
        - button "Implementation check" [ref=f1e249] [cursor=pointer]
      - generic [ref=f1e250]:
        - generic [ref=f1e251]:
          - button "Undo" [ref=f1e252] [cursor=pointer]
          - button "Redo" [disabled] [ref=f1e253]
        - paragraph [ref=f1e254]: "Session history: up to 50 edits per plan, across 20 plans. Undo/redo saves a new revision. Reloading the page clears history; external revisions reset it."
        - generic [ref=f1e255]:
          - heading "Plan editor" [level=2] [ref=f1e256]
          - generic [ref=f1e257]:
            - generic [ref=f1e258]:
              - text: New plan title
              - textbox "New plan title" [ref=f1e259]
            - button "Create plan" [ref=f1e260] [cursor=pointer]
          - generic [ref=f1e261]:
            - text: Choose plan
            - combobox "Choose plan" [ref=f1e262]:
              - option "Choose or create a plan"
              - option "Reviewed notes plan · r16 · Approved" [selected]
          - button "Reload plan" [ref=f1e263] [cursor=pointer]
          - group [ref=f1e264]:
            - generic [ref=f1e265]:
              - strong [ref=f1e266]: Revision r16 · Approved
              - paragraph [ref=f1e267]: ✓ Current approval valid
              - text: Baseline snapshot
              - code [ref=f1e268]: snapshot:974e5b0dbdc665541f46f834d9422889
              - generic [ref=f1e269]: Approval digest · r16
              - code [ref=f1e270]: a647f166fb83bc4d81b607c28ba0a5daaa1b07b991372bc32587ceffaf324407
            - generic [ref=f1e271]:
              - generic [ref=f1e272]:
                - text: Plan title
                - textbox "Plan title" [ref=f1e273]: Reviewed notes plan
              - generic [ref=f1e274]:
                - text: Description / constraints
                - textbox "Description / constraints" [ref=f1e275]
              - button "Save title and description" [disabled] [ref=f1e276]
            - paragraph [ref=f1e277]: Confirmation binds the current revision and semantic digest. Semantic edits create a revision; dragging only saves layout.
            - generic [ref=f1e278]:
              - button "Validate plan" [ref=f1e279] [cursor=pointer]
              - button "Confirm current revision" [ref=f1e280] [cursor=pointer]
            - generic [ref=f1e281]:
              - button "Export Markdown" [ref=f1e282] [cursor=pointer]
              - button "Export JSON" [ref=f1e283] [cursor=pointer]
            - group [ref=f1e284]:
              - generic "Server validation results (2)" [ref=f1e285] [cursor=pointer]
              - paragraph [ref=f1e286]: "Warning · COMPATIBILITY_UNKNOWN: Interface compatibility is unknown; arguments, return values, and possible adaptation require human review."
              - paragraph [ref=f1e287]: "Warning · COMPATIBILITY_UNKNOWN: Interface compatibility is unknown; arguments, return values, and possible adaptation require human review."
            - group [ref=f1e288]:
              - generic "New planned function" [ref=f1e289] [cursor=pointer]
              - paragraph [ref=f1e290]: A target file is planned through add_function or move_function; source files are not written.
              - generic [ref=f1e291]:
                - generic [ref=f1e292]:
                  - text: Function name
                  - textbox "Function name" [ref=f1e293]
                - generic [ref=f1e294]:
                  - text: Target file (repository relative)
                  - textbox "Target file (repository relative)" [ref=f1e295]:
                    - /placeholder: src/feature.ts
                - generic [ref=f1e296]:
                  - text: Signature
                  - textbox "Signature" [ref=f1e297]
                - generic [ref=f1e298]:
                  - text: Function responsibility
                  - textbox "Function responsibility" [ref=f1e299]
                - paragraph [ref=f1e300]:
                  - text: "Target file preview:"
                  - code [ref=f1e301]: ∅ → …
                - button "Add function" [ref=f1e302] [cursor=pointer]
            - group [ref=f1e303]:
              - generic "Edit selected function intent · caller" [ref=f1e304] [cursor=pointer]
              - paragraph [ref=f1e305]: Existing function edits create move/annotation operations; current source facts stay intact.
              - generic [ref=f1e306]:
                - generic [ref=f1e307]:
                  - text: Function name
                  - textbox "Function name" [ref=f1e308]: caller
                - generic [ref=f1e309]:
                  - text: Target file (repository relative)
                  - textbox "Target file (repository relative)" [ref=f1e310]:
                    - /placeholder: src/feature.ts
                    - text: main.ts
                - generic [ref=f1e311]:
                  - text: Signature
                  - textbox "Signature" [ref=f1e312]: export function caller()
                - generic [ref=f1e313]:
                  - text: Function responsibility
                  - textbox "Function responsibility" [ref=f1e314]
                - paragraph [ref=f1e315]:
                  - text: "Target file preview:"
                  - code [ref=f1e316]: main.ts → main.ts
                - button "Save function intent" [ref=f1e317] [cursor=pointer]
              - button "Plan removal of existing function" [ref=f1e318] [cursor=pointer]
            - group [ref=f1e319]:
              - generic "Planned relations" [ref=f1e320] [cursor=pointer]
              - paragraph [ref=f1e321]: Click a relation to reconnect/remove it, or drag its endpoint.
              - generic [ref=f1e322]:
                - generic [ref=f1e323]:
                  - text: Source function
                  - combobox "Source function" [ref=f1e324]:
                    - option "Choose a function"
                    - option "A · requests.ts"
                    - option "caller · main.ts" [selected]
                    - option "dynamic · main.ts"
                    - option "requestWithRetry · requests.ts"
                    - option "fetchNotes · services/notes.ts"
                - generic [ref=f1e325]:
                  - text: Target function
                  - combobox "Target function" [ref=f1e326]:
                    - option "Choose a function" [selected]
                    - option "A · requests.ts"
                    - option "caller · main.ts"
                    - option "dynamic · main.ts"
                    - option "requestWithRetry · requests.ts"
                    - option "fetchNotes · services/notes.ts"
                - generic [ref=f1e327]:
                  - text: New/reconnected relation type
                  - combobox "New/reconnected relation type" [ref=f1e328]:
                    - option "Calls" [selected]
                    - option "Must call"
                    - option "Must reuse"
                - button "Add relation" [ref=f1e329] [cursor=pointer]
            - group [ref=f1e330]:
              - generic "Node description / constraints" [ref=f1e331] [cursor=pointer]
            - group [ref=f1e332]:
              - generic "Change list (5)" [ref=f1e333] [cursor=pointer]
              - article [ref=f1e334]:
                - strong [ref=f1e335]: "#1 Add function"
                - generic [ref=f1e336]: "{ \"kind\": \"add_function\", \"tempId\": \"notes\", \"name\": \"fetchNotes\", \"filePath\": \"services/notes.ts\", \"signature\": \"\", \"description\": \"\" }"
                - button "Remove operation 1" [ref=f1e337] [cursor=pointer]: Remove operation
              - article [ref=f1e338]:
                - strong [ref=f1e339]: "#2 Add relation"
                - generic [ref=f1e340]: "{ \"kind\": \"add_relation\", \"id\": \"new-call\", \"sourceId\": \"notes\", \"targetId\": \"function:95de1ef5c9764f5535aef98dbc33dce0\", \"type\": \"calls\" }"
                - button "Remove operation 2" [ref=f1e341] [cursor=pointer]: Remove operation
              - article [ref=f1e342]:
                - strong [ref=f1e343]: "#3 Node description / constraints"
                - generic [ref=f1e344]: "{ \"kind\": \"annotate\", \"targetId\": \"notes\", \"text\": \"Preserve retry behavior; human review required\" }"
                - button "Remove operation 3" [ref=f1e345] [cursor=pointer]: Remove operation
              - article [ref=f1e346]:
                - strong [ref=f1e347]: "#4 Remove relation"
                - generic [ref=f1e348]: "{ \"kind\": \"remove_relation\", \"relationId\": \"relation:3a6fb576da6cc26f319b087966734a8b\" }"
                - button "Remove operation 4" [ref=f1e349] [cursor=pointer]: Remove operation
              - article [ref=f1e350]:
                - strong [ref=f1e351]: "#5 Add relation"
                - generic [ref=f1e352]: "{ \"kind\": \"add_relation\", \"id\": \"temp:a721cefd-0359-44ec-bfc5-083df567fbaa\", \"sourceId\": \"function:506634e893a4e19219b793a8ee22b819\", \"targetId\": \"function:95de1ef5c9764f5535aef98dbc33dce0\", \"type\": \"calls\" }"
                - button "Remove operation 5" [ref=f1e353] [cursor=pointer]: Remove operation
```

# Test source

```ts
  1   | import { spawn } from "node:child_process";
  2   | import { once } from "node:events";
  3   | import { createServer } from "node:net";
  4   | import { mkdir, writeFile, access } from "node:fs/promises";
  5   | import { resolve, join } from "node:path";
  6   | import { pathToFileURL } from "node:url";
  7   | import assert from "node:assert/strict";
  8   | import { Client } from "@modelcontextprotocol/sdk/client/index.js";
  9   | import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
  10  | 
  11  | function childEnvironment() {
  12  |   const env = { ...process.env };
  13  |   // Playwright may force color while the host declares NO_COLOR; keep child stderr diagnostic-only.
  14  |   if (env.NO_COLOR !== undefined) delete env.FORCE_COLOR;
  15  |   return env;
  16  | }
  17  | export async function freePort() {
  18  |   const listener = createServer().listen(0, "127.0.0.1");
  19  |   await once(listener, "listening");
  20  |   const port = listener.address().port;
  21  |   await new Promise((done) => listener.close(done));
  22  |   return port;
  23  | }
  24  | export async function startProduction(data, port) {
  25  |   port ??= await freePort();
  26  |   const child = spawn(
  27  |     process.execPath,
  28  |     [
  29  |       "--import",
  30  |       pathToFileURL(resolve("tests/support/graceful-preload.mjs")).href,
  31  |       resolve("apps/server/dist/index.js"),
  32  |     ],
  33  |     {
  34  |       env: {
  35  |         ...childEnvironment(),
  36  |         CODEMAP_PORT: String(port),
  37  |         CODEMAP_DATA_DIR: data,
  38  |         CODEMAP_WORKSPACE_ROOT: "",
  39  |       },
  40  |       stdio: ["ignore", "pipe", "pipe", "ipc"],
  41  |     },
  42  |   );
  43  |   let output = "";
  44  |   child.stdout.on("data", (value) => {
  45  |     output += value;
  46  |   });
  47  |   child.stderr.on("data", (value) => {
  48  |     output += value;
  49  |   });
  50  |   const exited = once(child, "exit");
  51  |   const url = `http://127.0.0.1:${port}`;
  52  |   const stop = async () => {
  53  |     if (child.exitCode !== null || child.signalCode !== null) return;
  54  |     child.send({ testSignal: "SIGTERM" });
  55  |     const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
  56  |     try {
> 57  |       assert.deepEqual(await exited, [0, null], output);
      |              ^ AssertionError: AtlasMode API listening on 127.0.0.1:37071 (built web assets available)
  58  |     } finally {
  59  |       clearTimeout(timer);
  60  |     }
  61  |   };
  62  |   try {
  63  |     const deadline = Date.now() + 15000;
  64  |     while (
  65  |       Date.now() < deadline &&
  66  |       child.exitCode === null &&
  67  |       child.signalCode === null
  68  |     ) {
  69  |       try {
  70  |         if ((await fetch(`${url}/api/health`)).ok)
  71  |           return { url, port, stop, child, output: () => output };
  72  |       } catch {}
  73  |       await new Promise((done) => setTimeout(done, 40));
  74  |     }
  75  |     throw new Error(`Production server did not become ready: ${output}`);
  76  |   } catch (error) {
  77  |     await stop();
  78  |     throw error;
  79  |   }
  80  | }
  81  | export async function http(url, path, method = "GET", body) {
  82  |   const response = await fetch(`${url}${path}`, {
  83  |     method,
  84  |     headers: { "content-type": "application/json" },
  85  |     ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  86  |   });
  87  |   const value = await response.json();
  88  |   assert.equal(response.ok, true, JSON.stringify(value));
  89  |   return value;
  90  | }
  91  | export async function connectMcp(url) {
  92  |   const transport = new StdioClientTransport({
  93  |     command: process.execPath,
  94  |     args: [resolve("apps/mcp/dist/index.js")],
  95  |     env: { ...childEnvironment(), CODEMAP_API_URL: url },
  96  |     stderr: "pipe",
  97  |   });
  98  |   let stderr = "";
  99  |   transport.stderr?.on("data", (chunk) => {
  100 |     stderr += chunk;
  101 |   });
  102 |   const client = new Client({ name: "atlasmode-acceptance", version: "1.0.0" });
  103 |   await client.connect(transport);
  104 |   return {
  105 |     client,
  106 |     transport,
  107 |     stderr: () => stderr,
  108 |     call: async (name, args = {}) => {
  109 |       const result = await client.callTool({ name, arguments: args });
  110 |       assert.notEqual(result.isError, true, JSON.stringify(result));
  111 |       return JSON.parse(result.content[0].text);
  112 |     },
  113 |   };
  114 | }
  115 | export const requestSource =
  116 |   'export function A() { return "direct"; }\nexport function requestWithRetry() { return "retry"; }\n';
  117 | export const callerSource =
  118 |   'import { A, requestWithRetry } from "./requests";\nexport function caller() { return A(); }\nexport function dynamic(fn: () => void) { return fn(); }\n';
  119 | export async function createFixtures(root) {
  120 |   const ts = join(root, "typescript"),
  121 |     python = join(root, "python"),
  122 |     marker = join(root, "TARGET_EXECUTED");
  123 |   await mkdir(ts, { recursive: true });
  124 |   await mkdir(python, { recursive: true });
  125 |   await writeFile(join(ts, "requests.ts"), requestSource);
  126 |   await writeFile(join(ts, "main.ts"), callerSource);
  127 |   await writeFile(
  128 |     join(ts, "never-execute.ts"),
  129 |     `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "executed");\nthrow new Error("Target source must never execute");\n`,
  130 |   );
  131 |   await writeFile(
  132 |     join(python, "app.py"),
  133 |     `from pathlib import Path\nPath(${JSON.stringify(marker)}).write_text("executed")\nraise RuntimeError("Target source must never execute")\ndef helper():\n    return 7\ndef entry():\n    return helper()\ndef dynamic(fn):\n    return fn()\n`,
  134 |   );
  135 |   return {
  136 |     ts,
  137 |     python,
  138 |     marker,
  139 |     assertNotExecuted: async () => {
  140 |       await assert.rejects(access(marker));
  141 |     },
  142 |   };
  143 | }
  144 | 
```