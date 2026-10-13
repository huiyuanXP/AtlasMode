import { expect, it } from "vitest";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
import type {
  Operation,
  PlanDetail,
  ProjectSummary,
  SubgraphResult,
} from "@codemap/core";
const fact = {
  id: "f",
  kind: "function" as const,
  name: "f",
  filePath: "src/original.ts",
};
const summary = {
  project: { id: "p", name: "p", path: "/fixture" },
  snapshotId: "S0",
  contentHash: "h",
  entrypoints: [fact],
} as ProjectSummary;
function fixture() {
  const calls: string[] = [];
  const bodies: Record<string, unknown>[] = [];
  let contextSnapshot = "S0",
    responsePath = "src/original.ts";
  let sourceHold: ((value: Response) => void) | undefined;
  let contextHold: ((value: Response) => void) | undefined;
  let deferSource = false,
    deferContext = false;
  const operations: Operation[] = [
    { kind: "move_function", nodeId: "f", filePath: "dest/other.ts" },
  ];
  const detail = {
    valid: false,
    issues: [],
    plan: {
      id: "plan",
      projectId: "p",
      revision: 1,
      title: "Plan",
      description: "",
      status: "draft",
      baselineSnapshotId: "S0",
      baselineContentHash: "h",
      createdAt: "now",
      updatedAt: "now",
      operations,
    },
  } as PlanDetail;
  const context = () => ({
    node: fact,
    incoming: [],
    outgoing: [],
    totalIncoming: 0,
    totalOutgoing: 0,
    truncated: false,
    offset: 0,
    limit: 50,
    snapshotId: contextSnapshot,
    dataSource: "code",
  });
  const reply = (data: unknown) =>
    new Response(JSON.stringify(data), { status: 200 });
  const api = new HttpApi((async (input, init) => {
    const path = String(input);
    calls.push(path);
    if (path.includes("/functions/f?")) {
      if (deferContext)
        return new Promise<Response>((r) => {
          contextHold = r;
        });
      return reply(context());
    }
    if (path.includes("/source?")) {
      if (deferSource)
        return new Promise<Response>((r) => {
          sourceHold = r;
        });
      return reply({ filePath: responsePath, content: "ORIGINAL bytes" });
    }
    if (path === "/api/plans/plan" && init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      return reply({
        ...detail,
        plan: {
          ...detail.plan,
          revision: 2,
          operations: body.operations,
          title: body.title,
          description: body.description,
        },
      });
    }
    return reply([]);
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project: summary.project,
    summary,
    graph: {
      snapshotId: "S0",
      nodes: [fact],
      relations: [],
      dataSource: "code",
      truncated: false,
    } as SubgraphResult,
    plan: detail,
    plans: [detail],
    selectedNode: { ...fact, filePath: "dest/other.ts" },
  });
  return {
    app,
    calls,
    bodies,
    detail,
    context,
    reply,
    setContextSnapshot: (id: string) => {
      contextSnapshot = id;
    },
    setResponsePath: (path: string) => {
      responsePath = path;
    },
    holdSource: () => {
      deferSource = true;
    },
    holdContext: () => {
      deferContext = true;
    },
    releaseSource: () =>
      sourceHold!(reply({ filePath: responsePath, content: "late original" })),
    releaseContext: () => contextHold!(reply(context())),
  };
}
it("source read resolves current domain context and never requests a planned destination", async () => {
  const f = fixture();
  await f.app.loadSource();
  expect(f.calls[0]).toContain("/functions/f?");
  expect(f.calls.some((path) => path.includes("filePath=dest"))).toBe(false);
  expect(f.calls).toContain(
    "/api/projects/p/source?filePath=src%2Foriginal.ts",
  );
  expect(f.app.store.getState().source).toMatchObject({
    filePath: "src/original.ts",
    content: "ORIGINAL bytes",
  });
  expect(f.app.store.getState().selectedNode?.filePath).toBe("src/original.ts");
});
it("a mismatched context snapshot prevents source dispatch", async () => {
  const f = fixture();
  f.setContextSnapshot("S1");
  await f.app.loadSource();
  expect(f.calls.some((path) => path.includes("/source?"))).toBe(false);
  expect(f.app.store.getState().source).toBeUndefined();
  expect(f.app.store.getState().error).toContain("SNAPSHOT_CHANGED");
});
it("unexpected returned source path is refused instead of showing destination bytes", async () => {
  const f = fixture();
  f.setResponsePath("dest/other.ts");
  await f.app.loadSource();
  expect(f.app.store.getState().source).toBeUndefined();
  expect(f.app.store.getState().error).not.toBe("");
});
it("selection generation change before context resolves prevents source dispatch", async () => {
  const f = fixture();
  f.holdContext();
  const pending = f.app.loadSource();
  await Promise.resolve();
  f.app.closeInspection();
  f.releaseContext();
  await pending;
  expect(f.calls.some((path) => path.includes("/source?"))).toBe(false);
  expect(f.app.store.getState().source).toBeUndefined();
});
it("snapshot change after source dispatch refuses the late reply", async () => {
  const f = fixture();
  f.holdSource();
  const pending = f.app.loadSource();
  await expect
    .poll(() => f.calls.some((path) => path.includes("/source?")))
    .toBe(true);
  f.app.store.setState({
    summary: { ...summary, snapshotId: "S1", contentHash: "new" },
  });
  f.releaseSource();
  await pending;
  expect(f.app.store.getState().source).toBeUndefined();
});
it("source reads never use a temporary planned function path", async () => {
  const f = fixture();
  f.app.store.setState({
    selectedNode: { ...fact, id: "temp:f", filePath: "new/file.ts" },
    plan: {
      ...f.detail,
      plan: {
        ...f.detail.plan,
        operations: [
          {
            kind: "add_function",
            tempId: "temp:f",
            name: "new",
            filePath: "new/file.ts",
          },
        ],
      },
    },
  });
  await f.app.loadSource();
  expect(f.calls).toEqual([]);
});
it("captured advanced/ownership save includes snapshot and rejects a changed tuple before HTTP", async () => {
  const f = fixture();
  const capture = {
    projectId: "p",
    snapshotId: "S0",
    snapshotHash: "h",
    planId: "plan",
    revision: 1,
  };
  f.app.store.setState({ summary: { ...summary, snapshotId: "S1" } });
  expect(await f.app.savePlanCaptured(capture, [])).toBeUndefined();
  expect(f.bodies).toEqual([]);
  f.app.store.setState({ summary });
  await f.app.savePlanCaptured(capture, []);
  expect(f.bodies).toContainEqual(
    expect.objectContaining({ expectedRevision: 1, expectedSnapshotId: "S0" }),
  );
});
it("dirty advanced input blocks direct confirmation, including the overview path", async () => {
  const f = fixture();
  f.app.setPlanEditorDirty(true);
  await f.app.approve();
  expect(f.calls.some((path) => path.endsWith("/approve"))).toBe(false);
});

it("actual verify then createPlan path retires idle S0 targets before S1 fresh begin",async()=>{
 const oldTarget={kind:"file" as const,id:"file:old",path:"dest/deleted.ts"};const newTarget={kind:"file" as const,id:"file:new",path:"dest/current.ts"};const requests:{path:string;body?:Record<string,unknown>}[]=[];
 const old={valid:true,issues:[],plan:{id:"old-plan",projectId:"p",revision:1,title:"Old",description:"",status:"draft",baselineSnapshotId:"S0",baselineContentHash:"h0",operations:[]}} as unknown as PlanDetail;
 const fresh={...old,valid:false,plan:{...old.plan,id:"new-plan",title:"Fresh",baselineSnapshotId:"S1",baselineContentHash:"h1"}};
 const s0={...summary,contentHash:"h0"},s1={...summary,snapshotId:"S1",contentHash:"h1"};
 const api=new HttpApi((async(input,init)=>{
  const path=String(input),body=init?.body?JSON.parse(String(init.body)):undefined;requests.push({path,body});const reply=(data:unknown)=>new Response(JSON.stringify(data));
  if(path.endsWith("/verify"))return reply({id:"v",planId:"old-plan",revision:1,items:[]});
  if(path.endsWith("/summary"))return reply(s1);
  if(path.endsWith("/plans")&&init?.method!=="POST")return reply([{...old,plan:{...old.plan,status:"stale"}}]);
  if(path==="/api/plans"&&init?.method==="POST")return reply(fresh);
  if(path.endsWith("/scope")){const sid=body.snapshotId;const target=sid==="S0"?oldTarget:newTarget;return reply({snapshotId:sid,path:body.path,kind:"folder",nodes:[{id:target.id,kind:"file",name:target.path.split("/").at(-1),filePath:target.path}],relations:[],dataSource:"code",truncated:false});}
  if(path.includes("/functions/"))return reply({node:fact,snapshotId:"S1",incoming:[],outgoing:[],totalIncoming:0,totalOutgoing:0,truncated:false});
  if(path.endsWith("/subgraph"))return reply({snapshotId:"S1",nodes:[fact],relations:[],dataSource:"code",truncated:false});
  if(path==="/api/plans/new-plan"&&init?.method==="PUT")return reply({...fresh,plan:{...fresh.plan,revision:2,operations:body.operations}});
  return reply([]);
 }) as typeof fetch);
 const app=createWorkspace(api);app.store.setState({project:summary.project,summary:s0,plan:old,plans:[old],selectedNode:fact});await app.ownership.setMode("ownership");expect(app.ownership.store.getState().tray.scope?.snapshotId).toBe("S0");expect(app.ownership.store.getState().intent).toBeUndefined();
 await app.verify();expect(app.store.getState().summary?.snapshotId).toBe("S1");await app.createPlan("Fresh");expect(app.store.getState().plan?.plan.id).toBe("new-plan");
 expect(app.ownership.store.getState().tray.status).toBe("idle");expect(app.beginOwnership(fact)).toBeUndefined();expect(app.ownership.choose(oldTarget)).toBe(false);expect(await app.ownership.confirm()).toBe(false);expect(requests.filter(r=>r.body&&r.path==="/api/plans/new-plan")).toEqual([]);
 await app.ownership.setMode("ownership");const nonce=app.beginOwnership(fact);expect(nonce).toBeTruthy();expect(app.ownership.choose(oldTarget,nonce)).toBe(false);expect(app.ownership.choose(newTarget,nonce)).toBe(true);expect(await app.ownership.confirm()).toBe(true);
 expect(requests.filter(r=>r.path.endsWith("/scope")).map(r=>r.body?.snapshotId)).toEqual(["S0","S1"]);
 expect(requests.find(r=>r.path==="/api/plans/new-plan"&&r.body)?.body).toMatchObject({expectedRevision:1,expectedSnapshotId:"S1",operations:[{kind:"move_function",nodeId:fact.id,filePath:"dest/current.ts"}]});
});
