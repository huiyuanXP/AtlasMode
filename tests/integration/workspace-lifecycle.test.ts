import { afterEach, beforeEach, expect, test } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  semanticPlanContent,
  type CodeSnapshot,
  type Operation,
  type Project,
} from "@codemap/core";
import { SourceIndexer } from "../../packages/indexer/src/index.js";
import { SqliteStorage } from "../../packages/storage/src/index.js";
import { WorkspaceService } from "../../packages/service/src/index.js";
let root: string,
  projectPath: string,
  db: SqliteStorage,
  service: WorkspaceService,
  project: Project;
const source =
  "export function A() { return 1; }\nexport function B() { return 2; }\nexport function caller() { return A(); }\n";
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "atlas-lifecycle-"));
  projectPath = join(root, "project");
  await mkdir(projectPath);
  await writeFile(join(projectPath, "main.ts"), source);
  db = new SqliteStorage(join(root, "state.db"));
  service = new WorkspaceService({ storage: db, indexer: new SourceIndexer() });
  project = await service.openProject(projectPath);
});
afterEach(async () => {
  db?.close();
  if (root) await rm(root, { recursive: true, force: true });
});
function node(name: string, snapshot = service.getSnapshot(project.id)) {
  return snapshot.nodes.find((n) => n.kind === "function" && n.name === name)!;
}
function draft(operations: Operation[] = []) {
  const created = service.createPlan({ projectId: project.id, title: "Use B" });
  return service.updatePlan(created.plan.id, {
    expectedRevision: 1,
    operations,
  });
}
function changeCall() {
  return draft([
    {
      kind: "add_relation",
      id: "planned-call",
      sourceId: node("caller").id,
      targetId: node("B").id,
      type: "must_reuse",
    },
  ]);
}

test("opens projects idempotently and isolates plans, routes, groups, policies and views", async () => {
  const otherPath = join(root, "other");
  await mkdir(otherPath);
  await writeFile(join(otherPath, "main.ts"), source);
  const other = await service.openProject(otherPath);
  expect((await service.openProject(projectPath)).id).toBe(project.id);
  expect(service.listProjects()).toHaveLength(2);
  const plan = draft();
  service.saveGroup({
    projectId: project.id,
    title: "g",
    description: "",
    source: "user",
    memberIds: [node("A").id],
  });
  service.savePolicy({
    projectId: project.id,
    pathPrefix: "src",
    purpose: "logic",
    forbiddenDependencies: ["private"],
  });
  service.saveView(project.id, { positions: {}, theme: "dark", locale: "en" });
  expect(service.listPlans(project.id)[0]?.plan.id).toBe(plan.plan.id);
  expect(service.listPlans(other.id)).toEqual([]);
  expect(service.listGroups(other.id)).toEqual([]);
  expect(service.listPolicies(other.id)).toEqual([]);
  expect(service.listRoutes(other.id)).toEqual([]);
  expect(service.getView(other.id)).toEqual({
    positions: {},
    theme: "light",
    locale: "zh",
  });
  expect(() => service.getProject("missing")).toThrow();
});
test("draft revisions reject concurrent edits and clients cannot forge approvals", () => {
  const plan = draft();
  expect(() =>
    service.updatePlan(plan.plan.id, { expectedRevision: 1, operations: [] }),
  ).toThrow(/revision/i);
  expect(() =>
    service.updatePlan(plan.plan.id, {
      expectedRevision: 2,
      operations: [],
      status: "approved",
    } as never),
  ).toThrow();
  expect(() =>
    service.createPlan({
      projectId: project.id,
      title: "forged",
      approval: { actor: "user" },
    } as never),
  ).toThrow();
  expect(service.getPlan(plan.plan.id).valid).toBe(false);
  expect(db.list("approvals")).toHaveLength(0);
});
test("approval saves SHA-256, revision and baseline atomically; layout leaves approval valid", async () => {
  const plan = changeCall();
  const approved = await service.approvePlan(plan.plan.id, 2);
  expect(approved).toMatchObject({
    valid: true,
    plan: { revision: 2, status: "approved" },
    approval: {
      revision: 2,
      actor: "user",
      baselineSnapshotId: plan.plan.baselineSnapshotId,
    },
  });
  expect(approved.approval?.semanticHash).toBe(
    createHash("sha256").update(semanticPlanContent(plan.plan)).digest("hex"),
  );
  service.saveView(project.id, {
    positions: { [node("A").id]: { x: 23, y: 40 } },
    theme: "dark",
    locale: "en",
  });
  expect(service.getPlan(plan.plan.id).valid).toBe(true);
  const edited = service.updatePlan(plan.plan.id, {
    expectedRevision: 2,
    title: "new intent",
    operations: [],
  });
  expect(edited).toMatchObject({
    valid: false,
    plan: { revision: 3, status: "draft" },
  });
  expect(db.list("approvals")).toHaveLength(1);
  expect(await readFile(join(projectPath, "main.ts"), "utf8")).toBe(source);
});
test("approval refreshes actual sources and rejects a changed baseline without explicit refresh", async () => {
  const plan = changeCall();
  await writeFile(join(projectPath, "main.ts"), source + "\n// changed\n");
  await expect(service.approvePlan(plan.plan.id, 2)).rejects.toThrow(
    /baseline/i,
  );
  expect(service.getPlan(plan.plan.id)).toMatchObject({
    valid: false,
    plan: { status: "stale" },
  });
  expect(() =>
    service.createPlan({
      projectId: project.id,
      title: "old",
      baselineSnapshotId: plan.plan.baselineSnapshotId,
    }),
  ).toThrow(/baseline/i);
});
test("verification refreshes and checks the latest approved historical revision after draft edits", async () => {
  const plan = changeCall();
  await service.approvePlan(plan.plan.id, 2);
  service.updatePlan(plan.plan.id, {
    expectedRevision: 2,
    operations: [
      { kind: "annotate", targetId: node("A").id, text: "draft only" },
    ],
  });
  await writeFile(
    join(projectPath, "main.ts"),
    source.replace("return A();", "return B();"),
  );
  const report = await service.verifyPlan(plan.plan.id);
  expect(report).toMatchObject({
    revision: 2,
    items: [{ operationIndex: 0, status: "satisfied" }],
  });
  expect(report.items[0]?.evidence.length).toBeGreaterThan(0);
  expect(service.getPlan(plan.plan.id).valid).toBe(false);
  await writeFile(join(projectPath, "main.ts"), source);
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unmet",
  );
});
test("dynamic calls and annotation semantics are unknown, never fabricated success", async () => {
  const plan = draft([
    {
      kind: "add_relation",
      id: "call",
      sourceId: node("caller").id,
      targetId: node("B").id,
      type: "calls",
    },
    {
      kind: "annotate",
      targetId: node("A").id,
      text: "must retry three times",
    },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    source.replace("return A();", "return globalThis.handler();"),
  );
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((item) => item.status),
  ).toEqual(["unknown", "unknown"]);
});
test("verification maps moved endpoints and removed call facts across snapshots", async () => {
  const baseline = service.getSnapshot(project.id);
  const call = baseline.relations.find(
    (r) => r.type === "calls" && r.sourceId === node("caller").id,
  )!;
  const plan = draft([
    { kind: "move_function", nodeId: node("B").id, filePath: "moved.ts" },
    { kind: "remove_relation", relationId: call.id },
    {
      kind: "add_relation",
      id: "reuse",
      sourceId: node("caller").id,
      targetId: node("B").id,
      type: "must_call",
    },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    'import { B } from "./moved";\nexport function A() { return 1; }\nexport function caller() { return B(); }\n',
  );
  await writeFile(
    join(projectPath, "moved.ts"),
    "export function B() { return 2; }\n",
  );
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["satisfied", "satisfied", "satisfied"]);
});
test("removing a function remains unmet if the same symbol merely moved to another file", async () => {
  const plan = draft([{ kind: "remove_function", nodeId: node("B").id }]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    source.replace("export function B() { return 2; }\n", ""),
  );
  await writeFile(
    join(projectPath, "moved.ts"),
    "export function B() { return 2; }\n",
  );
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unmet",
  );
  await rm(join(projectPath, "moved.ts"));
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "satisfied",
  );
});
test("new temporary functions bind by target path/name and ambiguous candidates stay unknown", async () => {
  const plan = draft([
    {
      kind: "add_function",
      tempId: "new",
      name: "fetchNotes",
      filePath: "new.ts",
    },
    {
      kind: "add_relation",
      id: "reuse",
      sourceId: "new",
      targetId: node("B").id,
      type: "must_reuse",
    },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["unmet", "unmet"]);
  await writeFile(
    join(projectPath, "new.ts"),
    'import { B } from "./main"; export function fetchNotes() { return B(); }',
  );
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["satisfied", "satisfied"]);
  await writeFile(
    join(projectPath, "new.ts"),
    "export class One { fetchNotes() {} }\nexport class Two { fetchNotes() {} }",
  );
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["unknown", "unknown"]);
});
test("parse diagnostics prevent absence being treated as proof of removal", async () => {
  const plan = draft([{ kind: "remove_function", nodeId: node("B").id }]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(join(projectPath, "main.ts"), "export function B( {");
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unknown",
  );
});
test("call chains require real evidence and refresh retains stale routes, groups and original snapshots", async () => {
  const snapshot = service.getSnapshot(project.id);
  const call = snapshot.relations.find((r) => r.type === "calls")!;
  const input = {
    projectId: project.id,
    snapshotId: snapshot.id,
    title: "flow",
    description: "",
    source: "agent" as const,
    kind: "call_chain" as const,
    steps: [
      { nodeId: node("caller").id, note: "start" },
      { nodeId: node("A").id, note: "end", relationId: call.id },
    ],
  };
  const route = service.createRoute(input);
  expect(() =>
    service.createRoute({
      ...input,
      steps: [
        input.steps[0]!,
        { nodeId: node("B").id, note: "wrong", relationId: call.id },
      ],
    }),
  ).toThrow();
  expect(() =>
    service.createRoute({
      ...input,
      steps: [{ nodeId: "other-project", note: "" }],
    }),
  ).toThrow();
  const group = service.saveGroup({
    projectId: project.id,
    title: "g",
    description: "notes",
    source: "user",
    memberIds: [node("A").id],
  });
  expect((await service.refreshIndex(project.id)).id).toBe(snapshot.id);
  await writeFile(
    join(projectPath, "main.ts"),
    "export function replacement() {}\n",
  );
  expect((await service.refreshIndex(project.id)).id).not.toBe(snapshot.id);
  expect(service.listRoutes(project.id)).toEqual([route]);
  expect(service.listGroups(project.id)).toEqual([group]);
  expect(db.get("snapshots", snapshot.id)).toEqual(snapshot);
});
test("group and policy edits cannot overwrite records from another project; paths and members are checked", async () => {
  const p = join(root, "second");
  await mkdir(p);
  await writeFile(join(p, "other.ts"), "export function foreign() {}");
  const other = await service.openProject(p);
  const foreign = service
    .getSnapshot(other.id)
    .nodes.find((n) => n.kind === "function")!;
  const group = service.saveGroup({
    projectId: project.id,
    title: "g",
    description: "",
    source: "user",
    memberIds: [node("A").id],
  });
  expect(() =>
    service.saveGroup({
      ...group,
      projectId: other.id,
      memberIds: [foreign.id],
    }),
  ).toThrow();
  expect(() =>
    service.saveGroup({ ...group, memberIds: [foreign.id] }),
  ).toThrow();
  const policy = service.savePolicy({
    projectId: project.id,
    pathPrefix: "src/",
    purpose: "logic",
    forbiddenDependencies: ["private/"],
  });
  expect(policy.pathPrefix).toBe("src");
  expect(() =>
    service.savePolicy({ ...policy, projectId: other.id }),
  ).toThrow();
  expect(() =>
    service.savePolicy({ ...policy, pathPrefix: "../escape" }),
  ).toThrow();
  expect(() =>
    service.saveView(project.id, {
      positions: { bad: { x: Infinity, y: 0 } },
      theme: "dark",
      locale: "en",
    }),
  ).toThrow();
});
test("directory dependency constraints block approval and invalidate previously approved plans", async () => {
  const plan = changeCall();
  await service.approvePlan(plan.plan.id, 2);
  service.savePolicy({
    projectId: project.id,
    pathPrefix: "",
    purpose: "no main dependency",
    forbiddenDependencies: ["main.ts"],
  });
  expect(service.getPlan(plan.plan.id)).toMatchObject({
    valid: false,
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "FORBIDDEN_DEPENDENCY" }),
    ]),
  });
  await expect(service.approvePlan(plan.plan.id, 2)).rejects.toThrow();
});
test("reopen retains approval history, routes, groups, policy, layout and exports show current validity", async () => {
  const plan = changeCall();
  await service.approvePlan(plan.plan.id, 2);
  const snapshot = service.getSnapshot(project.id);
  service.createRoute({
    projectId: project.id,
    snapshotId: snapshot.id,
    title: "route",
    description: "",
    source: "user",
    kind: "walkthrough",
    steps: [{ nodeId: node("B").id, note: "review" }],
  });
  service.saveGroup({
    projectId: project.id,
    title: "g",
    description: "",
    source: "user",
    memberIds: [node("B").id],
  });
  service.savePolicy({
    projectId: project.id,
    pathPrefix: "src",
    purpose: "logic",
    forbiddenDependencies: [],
  });
  service.saveView(project.id, {
    positions: { planned: { x: 1, y: 2 } },
    theme: "dark",
    locale: "en",
  });
  db.close();
  db = new SqliteStorage(join(root, "state.db"));
  service = new WorkspaceService({ storage: db, indexer: new SourceIndexer() });
  expect(service.getPlan(plan.plan.id)).toMatchObject({
    valid: false,
    plan: { revision: 4, status: "draft" },
    approval: { revision: 2 },
  });
  expect(service.listRoutes(project.id)).toHaveLength(1);
  expect(service.listGroups(project.id)).toHaveLength(1);
  expect(service.listPolicies(project.id)).toHaveLength(1);
  expect(service.getView(project.id).positions.planned).toEqual({ x: 1, y: 2 });
  service.updatePlan(plan.plan.id, { expectedRevision: 4, operations: [] });
  const exported = JSON.parse(service.exportPlan(plan.plan.id, "json"));
  expect(exported).toMatchObject({
    valid: false,
    approval: { revision: 2 },
    approvedPlan: { revision: 2 },
  });
  const markdown = service.exportPlan(plan.plan.id, "markdown");
  expect(markdown).toContain("valid: false");
  expect(markdown).toContain(exported.approval.semanticHash);
  expect(markdown).toContain("Approved revision: 2");
  expect((await service.verifyPlan(plan.plan.id)).revision).toBe(2);
});
test("source reads delegate safe file handling and reject traversal and escaped symlinks", async () => {
  expect(await service.readSource(project.id, "main.ts")).toEqual({
    filePath: "main.ts",
    content: source,
  });
  await writeFile(join(root, "outside.ts"), "secret");
  await symlink(join(root, "outside.ts"), join(projectPath, "link.ts"));
  await expect(
    service.readSource(project.id, "../outside.ts"),
  ).rejects.toThrow();
  await expect(service.readSource(project.id, "link.ts")).rejects.toThrow();
  await expect(service.verifyPlan(draft().plan.id)).rejects.toThrow(/approv/i);
});
test("same-source capability refresh preserves original immutable snapshot and marks approval stale", async () => {
  await writeFile(join(projectPath, "module.py"), "def hello():\n    pass\n");
  const old = process.env.CODEMAP_PYTHON;
  let baseline: CodeSnapshot;
  let planId: string;
  try {
    process.env.CODEMAP_PYTHON = join(root, "missing-python");
    baseline = await service.refreshIndex(project.id);
    const detail = draft();
    planId = detail.plan.id;
    await service.approvePlan(planId, 2);
  } finally {
    if (old === undefined) delete process.env.CODEMAP_PYTHON;
    else process.env.CODEMAP_PYTHON = old;
  }
  const next = await service.refreshIndex(project.id);
  expect(next.contentHash).toBe(baseline.contentHash);
  expect(next.id).not.toBe(baseline.id);
  expect(db.get("snapshots", baseline.id)).toEqual(baseline);
  expect(service.getPlan(planId)).toMatchObject({
    valid: false,
    plan: { status: "stale" },
  });
});

test("approval write failure rolls back history and approval together in actual SQLite", async () => {
  const plan = changeCall();
  const originalPut = db.put.bind(db);
  db.put = (kind, id, value) => {
    if (kind === "approvals") throw new Error("injected disk failure");
    originalPut(kind, id, value);
  };
  await expect(service.approvePlan(plan.plan.id, 2)).rejects.toThrow(
    "injected disk failure",
  );
  expect(service.getPlan(plan.plan.id).valid).toBe(false);
  expect(db.list("settings")).toEqual([]);
  expect(db.list("approvals")).toEqual([]);
  db.put = originalPut;
  expect((await service.approvePlan(plan.plan.id, 2)).valid).toBe(true);
});
test("verification selects the most recent approved revision, never an older approval", async () => {
  const plan = changeCall();
  await service.approvePlan(plan.plan.id, 2);
  service.updatePlan(plan.plan.id, {
    expectedRevision: 2,
    operations: [{ kind: "annotate", targetId: node("A").id, text: "review" }],
  });
  await service.approvePlan(plan.plan.id, 3);
  service.updatePlan(plan.plan.id, { expectedRevision: 3, operations: [] });
  expect(await service.verifyPlan(plan.plan.id)).toMatchObject({
    revision: 3,
    items: [{ status: "unknown" }],
  });
});

test("an unimplemented move cannot disguise the still-existing relation as removed", async () => {
  const snapshot = service.getSnapshot(project.id);
  const relation = snapshot.relations.find((r) => r.type === "calls")!;
  const plan = draft([
    { kind: "move_function", nodeId: node("A").id, filePath: "moved.ts" },
    { kind: "remove_relation", relationId: relation.id },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((item) => item.status),
  ).toEqual(["unmet", "unmet"]);
});
test("relocated symbols with multiple candidates stay unknown for removals and calls", async () => {
  const plan = draft([{ kind: "remove_function", nodeId: node("B").id }]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    source.replace("export function B() { return 2; }\n", ""),
  );
  await writeFile(join(projectPath, "one.ts"), "export function B() {}\n");
  await writeFile(join(projectPath, "two.ts"), "export function B() {}\n");
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unknown",
  );
});
test("runtime null semantic edits and Windows rooted directory policies are rejected", () => {
  const plan = draft();
  expect(() =>
    service.updatePlan(plan.plan.id, {
      expectedRevision: 2,
      operations: [],
      title: null,
    } as never),
  ).toThrow();
  expect(() =>
    service.createPlan({
      projectId: project.id,
      title: "x",
      description: null,
    } as never),
  ).toThrow();
  expect(() =>
    service.savePolicy({
      projectId: project.id,
      pathPrefix: "\\",
      purpose: "rooted",
      forbiddenDependencies: [],
    }),
  ).toThrow();
});

test("unrelated diagnostics do not suppress positive structural evidence or complete call absence", async () => {
  const plan = draft([
    { kind: "add_function", tempId: "new", name: "newFn", filePath: "good.ts" },
    {
      kind: "add_relation",
      id: "new-call",
      sourceId: "new",
      targetId: node("B").id,
      type: "calls",
    },
    {
      kind: "add_relation",
      id: "absent-call",
      sourceId: "new",
      targetId: node("A").id,
      type: "calls",
    },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "good.ts"),
    'import { B } from "./main";\nexport function newFn() { return B(); }\n',
  );
  await writeFile(join(projectPath, "broken.ts"), "export function broken( {");
  const report = await service.verifyPlan(plan.plan.id);
  expect(
    service
      .getSnapshot(project.id)
      .diagnostics.some((d) => d.filePath === "broken.ts"),
  ).toBe(true);
  expect(report.items.map((i) => i.status)).toEqual([
    "satisfied",
    "satisfied",
    "unmet",
  ]);
  expect(report.items[0]?.evidence).toContain("good.ts:2");
  expect(report.items[1]?.evidence.some((e) => e.startsWith("good.ts:2"))).toBe(
    true,
  );
  await writeFile(join(projectPath, "good.ts"), "export function newFn( {");
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["unknown", "unknown", "unknown"]);
});

test("temporary function moves reject copies and accept a true move", async () => {
  const plan = draft([
    {
      kind: "add_function",
      tempId: "new",
      name: "newFn",
      filePath: "original.ts",
    },
    { kind: "move_function", nodeId: "new", filePath: "moved.ts" },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "original.ts"),
    "export function newFn() {}\n",
  );
  await writeFile(
    join(projectPath, "moved.ts"),
    "export function newFn() {}\n",
  );
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["satisfied", "unmet"]);
  await rm(join(projectPath, "original.ts"));
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["satisfied", "satisfied"]);
  await writeFile(join(projectPath, "original.ts"), "export function newFn( {");
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["satisfied", "unknown"]);
});

test("removal absence depends on incomplete files in the symbol's language search scope", async () => {
  const plan = draft([{ kind: "remove_function", nodeId: node("B").id }]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    source.replace("export function B() { return 2; }\n", ""),
  );
  await writeFile(join(projectPath, "broken.py"), "def broken(:\n");
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "satisfied",
  );
  await writeFile(join(projectPath, "broken.ts"), "export function broken( {");
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unknown",
  );
});

test("a unique differently implemented cross-file substitute cannot satisfy approved reuse without a move", async () => {
  const plan = changeCall();
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    'import { B } from "./different";\nexport function A() { return 1; }\nexport function caller() { return B(); }\n',
  );
  await writeFile(
    join(projectPath, "different.ts"),
    'export function B() { throw new Error("different implementation"); }\n',
  );
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unknown",
  );
});

test("a reassigned callable's obsolete initializer cannot satisfy required reuse", async () => {
  await writeFile(
    join(projectPath, "main.ts"),
    'export const handler = () => "original";\nexport function caller() { return handler(); }\n',
  );
  await service.refreshIndex(project.id);
  const plan = draft([
    {
      kind: "add_relation",
      id: "reuse-handler",
      sourceId: node("caller").id,
      targetId: node("handler").id,
      type: "must_reuse",
    },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    'export let handler = () => "original";\nhandler = () => "replacement";\nexport function caller() { return handler(); }\n',
  );
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unknown",
  );
});

test.each(["main.ts", "src/"])(
  "ignoring unchanged source %s cannot prove approved function or relation removal",
  async (ignored) => {
    const path = ignored === "main.ts" ? "main.ts" : "src/main.ts";
    if (path !== "main.ts") {
      await mkdir(join(projectPath, "src"));
      await writeFile(join(projectPath, path), source);
      await rm(join(projectPath, "main.ts"));
      await service.refreshIndex(project.id);
    }
    const relation = service
      .getSnapshot(project.id)
      .relations.find((r) => r.type === "calls")!;
    const plan = draft([
      { kind: "remove_function", nodeId: node("A").id },
      { kind: "remove_relation", relationId: relation.id },
    ]);
    await service.approvePlan(plan.plan.id, 2);
    await writeFile(join(projectPath, ".gitignore"), ignored + "\n");
    expect(
      (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
    ).toEqual(["unknown", "unknown"]);
    expect(await readFile(join(projectPath, path), "utf8")).toBe(source);
    await rm(join(projectPath, ".gitignore"));
    await rm(join(projectPath, path));
    await mkdir(join(projectPath, "node_modules"));
    await writeFile(join(projectPath, "node_modules", "hidden.ts"), source);
    await mkdir(join(projectPath, ".git"));
    expect(
      (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
    ).toEqual(["satisfied", "satisfied"]);
  },
);

test("unavailable source cannot prove an approved move, while unaffected positive facts remain usable", async () => {
  await writeFile(
    join(projectPath, "unrelated.ts"),
    "export function hidden() {}\n",
  );
  await service.refreshIndex(project.id);
  const plan = draft([
    { kind: "move_function", nodeId: node("B").id, filePath: "moved.ts" },
    {
      kind: "add_relation",
      id: "positive",
      sourceId: node("caller").id,
      targetId: node("A").id,
      type: "must_reuse",
    },
    {
      kind: "add_function",
      tempId: "excluded",
      name: "hidden",
      filePath: "node_modules/hidden.ts",
    },
  ]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "moved.ts"),
    "export function B() { return 2; }\n",
  );
  await mkdir(join(projectPath, "node_modules"));
  await writeFile(
    join(projectPath, "node_modules", "hidden.ts"),
    "export function hidden() {}\n",
  );
  await writeFile(join(projectPath, ".gitignore"), "unrelated.ts\n");
  expect(
    (await service.verifyPlan(plan.plan.id)).items.map((i) => i.status),
  ).toEqual(["unmet", "satisfied", "unknown"]);
  await writeFile(join(projectPath, ".gitignore"), "main.ts\nunrelated.ts\n");
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unknown",
  );
});

test("fixed excluded dependency symlinks do not hide genuine deletion evidence", async () => {
  const plan = draft([{ kind: "remove_function", nodeId: node("B").id }]);
  await service.approvePlan(plan.plan.id, 2);
  await writeFile(
    join(projectPath, "main.ts"),
    source.replace("export function B() { return 2; }\n", ""),
  );
  await mkdir(join(root, "dependencies"));
  await writeFile(join(root, "dependencies", "hidden.ts"), source);
  await symlink(
    join(root, "dependencies"),
    join(projectPath, "node_modules"),
    "junction",
  );
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "satisfied",
  );
});

test("legacy snapshots stay readable and cannot prove removal from omitted files", async () => {
  const indexer = new SourceIndexer();
  service = new WorkspaceService({
    storage: db,
    indexer: {
      async index(path, projectId) {
        const snapshot = await indexer.index(path, projectId);
        delete snapshot.coverage.availability;
        snapshot.id += ":legacy";
        return snapshot;
      },
    },
  });
  await service.refreshIndex(project.id);
  const plan = draft([{ kind: "remove_function", nodeId: node("B").id }]);
  await service.approvePlan(plan.plan.id, 2);
  expect(service.getPlan(plan.plan.id).valid).toBe(true);
  await rm(join(projectPath, "main.ts"));
  expect((await service.verifyPlan(plan.plan.id)).items[0]?.status).toBe(
    "unknown",
  );
});
