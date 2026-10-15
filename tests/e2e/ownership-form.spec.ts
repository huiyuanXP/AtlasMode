import { test as it, expect, type Browser } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
let browser: Browser;
let server: ViteDevServer;
let root: string;
let url: string;
it.beforeAll(async ({ browser: fixtureBrowser }) => {
  root = await mkdtemp(join(tmpdir(), "atlas-fs01-form-"));
  const repo = resolve(import.meta.dirname, "../..");
  const fixture = join(root, "fixture.tsx");
  await writeFile(
    fixture,
    `import React from 'react';
import {createRoot} from 'react-dom/client';
import {LocaleProvider} from '${repo}/apps/web/src/i18n/index.tsx';
import {PlanningPanel} from '${repo}/apps/web/src/features/planning/PlanningPanel.tsx';
import {createWorkspace} from '${repo}/apps/web/src/app/workspace.ts';
import {HttpApi} from '${repo}/apps/web/src/api/client.ts';
import {useStore} from 'zustand';
function App(){const [revision,setRevision]=React.useState(1);const [path,setPath]=React.useState('src/a.ts');const [selected,setSelected]=React.useState('f');const [saved,setSaved]=React.useState([]);const [dirty,setDirty]=React.useState(false);const [title,setTitle]=React.useState('Plan');
const node={id:selected,kind:'function',name:'f',filePath:'src/a.ts'};const detail={valid:false,issues:[],plan:{id:'plan',projectId:'p',title,description:'',revision,status:'draft',baselineSnapshotId:'S0',baselineContentHash:'h',createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z',operations:path==='src/a.ts'?[]:[{kind:'move_function',nodeId:selected,filePath:path}]}};
return <LocaleProvider locale="en"><button id="remote" onClick={()=>{setPath('dest/b.ts');setRevision(r=>r+1)}}>Remote revision</button><button id="ack" onClick={()=>{setPath(saved.find(o=>o.kind==='move_function')?.filePath??'src/a.ts');setRevision(r=>r+1)}}>Accept saved operations</button><button id="remote-title" onClick={()=>{setTitle('Remote title');setRevision(r=>r+1)}}>Remote title</button><button id="selection" onClick={()=>setSelected('other')}>Other function</button><output id="saved">{JSON.stringify(saved)}</output><output id="dirty">{String(dirty)}</output><PlanningPanel plans={[detail]} detail={detail} node={node} nodes={[node]} busy={false} onChoose={()=>{}} onCreate={()=>{}} onSave={(ops)=>setSaved(ops)} onValidate={()=>{}} onApprove={()=>setSaved(['approved'])} onExport={()=>{}} onClearEdge={()=>{}} onDirtyChange={setDirty}/></LocaleProvider>};
const fact={id:'f',kind:'function',name:'f',filePath:'src/a.ts'};
const summary={project:{id:'p',path:'/fixture',name:'fixture'},snapshotId:'S0',contentHash:'h',entrypoints:[fact],entrypointTotal:1,entrypointsTruncated:false,counts:{files:1,folders:0,functions:1,relations:0,calls:{resolved:0,unresolved:0,external:0}},diagnostics:[],coverage:{files:['src/a.ts'],excludedPatterns:[],unresolvedCount:0},dataSource:'code'};
let accepted={valid:false,issues:[],plan:{id:'plan',projectId:'p',title:'Plan',description:'',revision:1,status:'draft',baselineSnapshotId:'S0',baselineContentHash:'h',createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z',operations:[]}};
let rejectLostResponse;let loseResponse=false;let savedOperations=[];
const api=new HttpApi(async(input,init)=>{const path=String(input);const reply=data=>new Response(JSON.stringify(data),{status:200});
if(path==='/api/plans/plan'&&init?.method==='PUT'){const body=JSON.parse(init.body);accepted={...accepted,plan:{...accepted.plan,title:body.title,description:body.description,operations:body.operations,revision:accepted.plan.revision+1}};savedOperations=body.operations;if(loseResponse){loseResponse=false;return new Promise((_resolve,reject)=>{rejectLostResponse=()=>reject(new Error('fixture: response lost after commit'));});}return reply(accepted);}
if(path==='/api/plans/plan')return reply(accepted);
if(path.endsWith('/validate'))return reply([]);
if(path.endsWith('/summary'))return reply(summary);
if(path.endsWith('/plans'))return reply([accepted]);
if(path.endsWith('/subgraph'))return reply({nodes:[fact],relations:[],snapshotId:'S0',dataSource:'code',truncated:false});
return reply([]);});
const app=createWorkspace(api);app.store.setState({project:summary.project,summary,graph:{nodes:[fact],relations:[],snapshotId:'S0',dataSource:'code',truncated:false},plan:accepted,plans:[accepted],selectedNode:fact});
function ControllerApp(){const state=useStore(app.store);const [dirty,setDirty]=React.useState(false);return <LocaleProvider locale="en"><button id="lose-response" onClick={()=>{loseResponse=true}}>Lose next save response</button><button id="release-loss" onClick={()=>rejectLostResponse?.()}>Release response failure</button><button id="agent-sync" onClick={()=>{accepted={...accepted,plan:{...accepted.plan,revision:accepted.plan.revision+1,title:'Agent revision'}};void app.syncAgentChanges()}}>Agent sync</button><output id="revision">{state.plan?.plan.revision}</output><output id="latest">{state.plans[0]?.plan.revision}</output><output id="busy">{String(!!state.busy.plan)}</output><output id="error">{state.error}</output><output id="saved">{JSON.stringify(savedOperations)}</output><output id="dirty">{String(dirty)}</output><PlanningPanel plans={state.plans} detail={state.plan} node={state.selectedNode} nodes={[fact]} busy={!!state.busy.plan} onChoose={app.choosePlan} onCreate={app.createPlan} onSave={app.savePlan} onValidate={app.validate} onApprove={app.approve} onExport={()=>{}} onClearEdge={()=>{}} onDirtyChange={React.useCallback(value=>{setDirty(value);app.setPlanEditorDirty(value)},[])}/></LocaleProvider>}
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('controller')?<ControllerApp/>:<App/>);`,
  );
  server = await createServer({
    configFile: false,
    root: repo,
    cacheDir: join(root, "vite-cache"),
    resolve: { dedupe: ["react", "react-dom", "zustand"] },
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [repo, root] } },
    plugins: [
      {
        name: "fs01-form-fixture",
        configureServer(vite) {
          vite.middlewares.use("/__fs01_form", async (_request, response) => {
            response.setHeader("Content-Type", "text/html");
            response.end(
              await vite.transformIndexHtml(
                "/__fs01_form",
                `<div id="root"></div><script type="module" src="/@fs${fixture}"></script>`,
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  url = `${server.resolvedUrls!.local[0]}__fs01_form`;
  browser = fixtureBrowser;
});
it.afterAll(async () => {
  await server?.close();
  if (root) await rm(root, { recursive: true, force: true });
});
it("clean same-id advanced form follows accepted revision/effective path", async () => {
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    console.error(error.message);
  });
  try {
    await page.goto(url);
    const form = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Save function intent",
        exact: true,
      }),
    });
    await expect
      .poll(() => form.locator("input").nth(1).inputValue())
      .toBe("src/a.ts");
    await page.click("#remote");
    await expect
      .poll(() => form.locator("input").nth(1).inputValue())
      .toBe("dest/b.ts");
  } finally {
    await page.close();
  }
});
it("dirty same-id revision retains edits, blocks stale submit and approval, reload is explicit", async () => {
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    console.error(error.message);
  });
  try {
    await page.goto(url);
    const form = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Save function intent",
        exact: true,
      }),
    });
    await form.locator("input").nth(1).fill("draft/mine.ts");
    await expect.poll(() => page.locator("#dirty").textContent()).toBe("true");
    await page.click("#remote");
    expect(await form.locator("input").nth(1).inputValue()).toBe(
      "draft/mine.ts",
    );
    expect(
      await form
        .getByRole("button", { name: "Save function intent", exact: true })
        .isDisabled(),
    ).toBe(true);
    expect(
      await page
        .getByRole("button", { name: "Confirm current revision", exact: true })
        .isDisabled(),
    ).toBe(true);
    await form
      .getByRole("button", { name: "Reload plan", exact: true })
      .click();
    await expect
      .poll(() => form.locator("input").nth(1).inputValue())
      .toBe("dest/b.ts");
    expect(await page.locator("#saved").textContent()).toBe("[]");
    await form.locator("input").nth(1).fill("dest/c.ts");
    await form
      .getByRole("button", { name: "Save function intent", exact: true })
      .click();
    await expect
      .poll(() => page.locator("#saved").textContent())
      .toContain("dest/c.ts");
    const ops = JSON.parse((await page.locator("#saved").textContent())!);
    expect(
      ops.filter((o: { kind: string }) => o.kind === "move_function"),
    ).toEqual([{ kind: "move_function", nodeId: "f", filePath: "dest/c.ts" }]);
  } finally {
    await page.close();
  }
});

it("accepted exact operation ACK clears dirty guard while explicit selection close never saves", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const form = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Save function intent",
        exact: true,
      }),
    });
    await form.locator("input").nth(1).fill("dest/accepted.ts");
    await form
      .getByRole("button", { name: "Save function intent", exact: true })
      .click();
    await page.click("#ack");
    await expect(page.locator("#dirty")).toHaveText("false");
    await expect(form.locator("input").nth(1)).toHaveValue("dest/accepted.ts");
    await expect(
      page.getByRole("button", {
        name: "Confirm current revision",
        exact: true,
      }),
    ).toBeEnabled();
    const saved = await page.locator("#saved").textContent();
    await form.locator("input").nth(1).fill("draft/unsaved.ts");
    await page.click("#selection");
    await expect(page.locator("#dirty")).toHaveText("false");
    expect(await page.locator("#saved").textContent()).toBe(saved);
    expect(await form.locator("input").nth(1).inputValue()).not.toBe(
      "draft/unsaved.ts",
    );
  } finally {
    await page.close();
  }
});
it("remote metadata revision retains dirty title and prevents whole-operations stale save", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const metadata = page.locator(".plan-editor > form").first();
    await metadata.locator("input").fill("Local draft title");
    await page.click("#remote-title");
    await expect(metadata.locator("input")).toHaveValue("Local draft title");
    await expect(metadata.locator('button[type="submit"]')).toBeDisabled();
    expect(await page.locator("#saved").textContent()).toBe("[]");
    await metadata
      .getByRole("button", { name: "Reload plan", exact: true })
      .click();
    await expect(metadata.locator("input")).toHaveValue("Remote title");
  } finally {
    await page.close();
  }
});

it("component contract: old ACK must not erase newer unsent function edit generation", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const form = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Save function intent",
        exact: true,
      }),
    });
    await form.locator("input").nth(1).fill("dest/A.ts");
    await form
      .getByRole("button", { name: "Save function intent", exact: true })
      .click();
    await form.locator("input").nth(1).fill("draft/B.ts");
    await page.click("#ack");
    await expect(form.locator("input").nth(1)).toHaveValue("draft/B.ts");
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(
      form.getByRole("button", { name: "Save function intent", exact: true }),
    ).toBeDisabled();
    expect(await page.locator("#saved").textContent()).toContain("dest/A.ts");
  } finally {
    await page.close();
  }
});
it("add-function dirty input is revision-bound and blocks confirmation", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    const add = page
      .locator(".plan-editor details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: /^New planned function$/ }),
      })
      .locator("form");
    await add.locator("input").nth(0).fill("newFunction");
    await add.locator("input").nth(1).fill("new/file.ts");
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(
      page.getByRole("button", {
        name: "Confirm current revision",
        exact: true,
      }),
    ).toBeDisabled();
    await page.click("#remote");
    await expect(add.locator("input").nth(1)).toHaveValue("new/file.ts");
    await expect(add.locator('button[type="submit"]')).toBeDisabled();
    expect(await page.locator("#saved").textContent()).toBe("[]");
  } finally {
    await page.close();
  }
});

it("real controller response loss then Validate ACK preserves newer function input", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const form = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Save function intent",
        exact: true,
      }),
    });
    await page.click("#lose-response");
    await form.locator("input").nth(1).fill("dest/A.ts");
    await form
      .getByRole("button", { name: "Save function intent", exact: true })
      .click();
    await expect(page.locator("#busy")).toHaveText("true");
    await expect(form.locator("input").nth(1)).toBeDisabled();
    await page.click("#release-loss");
    await expect(page.locator("#error")).toContainText(
      "response lost after commit",
    );
    await expect(page.locator("#busy")).toHaveText("false");
    await expect(page.locator("#revision")).toHaveText("1");
    await form.locator("input").nth(1).fill("draft/B.ts");
    await page
      .getByRole("button", { name: "Validate plan", exact: true })
      .click();
    await expect(page.locator("#revision")).toHaveText("2");
    await expect(form.locator("input").nth(1)).toHaveValue("draft/B.ts");
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(
      form.getByRole("button", { name: "Save function intent", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Confirm current revision",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(page.locator("#saved")).toContainText("dest/A.ts");
  } finally {
    await page.close();
  }
});
it("real controller add draft blocks agent-sync adoption until explicit reload", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const add = page
      .locator(".plan-editor details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: /^New planned function$/ }),
      })
      .locator("form");
    await add.locator("input").nth(0).fill("newFunction");
    await add.locator("input").nth(1).fill("new/file.ts");
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(
      page.getByRole("button", {
        name: "Confirm current revision",
        exact: true,
      }),
    ).toBeDisabled();
    await page.click("#agent-sync");
    await expect(page.locator("#latest")).toHaveText("2");
    await expect(page.locator("#revision")).toHaveText("1");
    await expect(add.locator("input").nth(1)).toHaveValue("new/file.ts");
    await add.getByRole("button", { name: "Reload plan", exact: true }).click();
    await expect(page.locator("#revision")).toHaveText("2");
    await expect(page.locator("#dirty")).toHaveText("false");
    await expect(page.locator("#saved")).toHaveText("[]");
  } finally {
    await page.close();
  }
});
it("real controller successful metadata ACK cleans basis for the next edit", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const metadata = page.locator(".plan-editor > form").first();
    await metadata.locator("input").fill("Saved title");
    await metadata
      .getByRole("button", { name: "Save title and description", exact: true })
      .click();
    await expect(page.locator("#revision")).toHaveText("2");
    await expect(metadata.locator("input")).toHaveValue("Saved title");
    await expect(page.locator("#dirty")).toHaveText("false");
    await metadata.locator("input").fill("Next title");
    await expect(
      metadata.getByRole("button", {
        name: "Save title and description",
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    await page.close();
  }
});

it("real controller recovered metadata ACK preserves a later unsent title", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const metadata = page.locator(".plan-editor > form").first();
    await page.click("#lose-response");
    await metadata.locator("input").fill("Title A");
    await metadata
      .getByRole("button", { name: "Save title and description", exact: true })
      .click();
    await expect(metadata.locator("input")).toBeDisabled();
    await page.click("#release-loss");
    await expect(page.locator("#busy")).toHaveText("false");
    await metadata.locator("input").fill("Title B");
    await page
      .getByRole("button", { name: "Validate plan", exact: true })
      .click();
    await expect(page.locator("#revision")).toHaveText("2");
    await expect(metadata.locator("input")).toHaveValue("Title B");
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(
      metadata.getByRole("button", {
        name: "Save title and description",
        exact: true,
      }),
    ).toBeDisabled();
  } finally {
    await page.close();
  }
});
it("real controller successful add ACK clears unchanged submitted draft", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const add = page
      .locator(".plan-editor details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: /^New planned function$/ }),
      })
      .locator("form");
    await add.locator("input").nth(0).fill("newFunction");
    await add.locator("input").nth(1).fill("new/file.ts");
    await add
      .getByRole("button", { name: "Add function", exact: true })
      .click();
    await expect(page.locator("#revision")).toHaveText("2");
    await expect(page.locator("#busy")).toHaveText("false");
    await expect(add.locator("input").nth(1)).toHaveValue("");
    await expect(page.locator("#dirty")).toHaveText("false");
    await expect(page.locator("#saved")).toContainText('"kind":"add_function"');
  } finally {
    await page.close();
  }
});
it("real controller recovered add ACK preserves a later unsent add draft", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const add = page
      .locator(".plan-editor details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: /^New planned function$/ }),
      })
      .locator("form");
    await page.click("#lose-response");
    await add.locator("input").nth(0).fill("newFunction");
    await add.locator("input").nth(1).fill("new/A.ts");
    await add
      .getByRole("button", { name: "Add function", exact: true })
      .click();
    await expect(add.locator("input").nth(1)).toBeDisabled();
    await page.click("#release-loss");
    await expect(page.locator("#busy")).toHaveText("false");
    await add.locator("input").nth(1).fill("new/B.ts");
    await page
      .getByRole("button", { name: "Validate plan", exact: true })
      .click();
    await expect(page.locator("#revision")).toHaveText("2");
    await expect(add.locator("input").nth(1)).toHaveValue("new/B.ts");
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(
      add.getByRole("button", { name: "Add function", exact: true }),
    ).toBeDisabled();
    await expect(page.locator("#saved")).toContainText("new/A.ts");
  } finally {
    await page.close();
  }
});
it("add and selected function dirty signals are independently aggregated", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const add = page
      .locator(".plan-editor details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: /^New planned function$/ }),
      })
      .locator("form");
    const edit = page.locator("form").filter({
      has: page.getByRole("button", {
        name: "Save function intent",
        exact: true,
      }),
    });
    await add.locator("input").nth(0).fill("newFunction");
    await edit.locator("input").nth(1).fill("edit/local.ts");
    await add.getByRole("button", { name: "Reload plan", exact: true }).click();
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(edit.locator("input").nth(1)).toHaveValue("edit/local.ts");
    await add.locator("input").nth(0).fill("anotherFunction");
    await edit
      .getByRole("button", { name: "Reload plan", exact: true })
      .click();
    await expect(page.locator("#dirty")).toHaveText("true");
    await expect(add.locator("input").nth(0)).toHaveValue("anotherFunction");
    await expect(
      page.getByRole("button", {
        name: "Confirm current revision",
        exact: true,
      }),
    ).toBeDisabled();
  } finally {
    await page.close();
  }
});

it("real controller recovered unchanged add ACK resets its form without selection remount", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${url}?controller`);
    const add = page
      .locator(".plan-editor details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: /^New planned function$/ }),
      })
      .locator("form");
    await page.click("#lose-response");
    await add.locator("input").nth(0).fill("newFunction");
    await add.locator("input").nth(1).fill("new/A.ts");
    await add
      .getByRole("button", { name: "Add function", exact: true })
      .click();
    await expect(add.locator("input").nth(1)).toBeDisabled();
    await page.click("#release-loss");
    await expect(page.locator("#busy")).toHaveText("false");
    await page
      .getByRole("button", { name: "Validate plan", exact: true })
      .click();
    await expect(page.locator("#revision")).toHaveText("2");
    await expect(add.locator("input").nth(0)).toHaveValue("");
    await expect(add.locator("input").nth(1)).toHaveValue("");
    await expect(page.locator("#dirty")).toHaveText("false");
    await expect(
      page
        .locator(".plan-editor summary")
        .filter({ hasText: /Edit selected function intent · f/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Confirm current revision",
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    await page.close();
  }
});
