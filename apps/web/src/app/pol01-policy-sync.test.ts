import { afterEach, expect, test } from "vitest";
import type {
  Approval,
  DirectoryPolicy,
  PlanDetail,
  ProjectSummary,
  StructureState,
} from "@codemap/core";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
import {
  createPolicyController,
  type AcceptedPolicyResponse,
} from "../features/structure/policy-controller.js";
const timestamp = "2026-10-11T00:00:00.000Z";
const approval = (revision = 2): Approval => ({
  id: "approval",
  planId: "plan",
  revision,
  semanticHash: "a".repeat(64),
  baselineSnapshotId: "s1",
  baselineContentHash: "h",
  approvedAt: timestamp,
  actor: "user",
  reviewContext: { version: 1, knowledgeHash: "b".repeat(64) },
});
const plan = (revision = 2): PlanDetail => ({
  plan: {
    id: "plan",
    projectId: "p",
    title: "original body",
    description: "original description",
    revision,
    status: revision === 2 ? "approved" : "draft",
    baselineSnapshotId: "s1",
    baselineContentHash: "h",
    operations: [
      {
        kind: "add_function",
        tempId: "new",
        name: "unchanged",
        filePath: "src/new.ts",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  approval: approval(),
  valid: revision === 2,
  issues: [],
});
const policy = (id = "policy"): DirectoryPolicy => ({
  id,
  projectId: "p",
  pathPrefix: "src",
  purpose: "fresh policy",
  forbiddenDependencies: ["internal"],
});
const state = (): StructureState => ({
  projectId: "p",
  schemaVersion: 1,
  structureRevision: 3,
  fileDigest: "c".repeat(64),
  semanticDigest: "d".repeat(64),
  verifiedAt: timestamp,
  status: "ready",
  diagnostics: [],
  legacyPendingCount: 0,
  document: { schemaVersion: 1, folders: [], dependencyRules: [] },
});
const summary = (): ProjectSummary => ({
  project: { id: "p", name: "p", path: "/p" },
  snapshotId: "s1",
  contentHash: "h",
  entrypoints: [],
  entrypointTotal: 0,
  entrypointsTruncated: false,
  counts: {
    files: 1,
    folders: 1,
    functions: 0,
    relations: 0,
    calls: { resolved: 0, unresolved: 0, external: 0 },
  },
  diagnostics: [],
  coverage: {
    files: ["src/main.ts"],
    excludedPatterns: [],
    unresolvedCount: 0,
  },
  dataSource: "code",
});
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const notApproved = () =>
  json({ code: "NOT_APPROVED", message: "fresh current draft" }, 409);
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
function fixture() {
  const calls: string[] = [];
  let rows = [policy()],
    details = [plan(3)],
    strong = notApproved(),
    failPath = "";
  let hold:
    | {
        suffix: string;
        gate: ReturnType<typeof deferred<Response>>;
        entered: boolean;
      }
    | undefined;
  const api = new HttpApi((async (input, init) => {
    const path = String(input);
    calls.push(`${init?.method ?? "GET"} ${path}`);
    if (hold && path.endsWith(hold.suffix) && !hold.entered) {
      hold.entered = true;
      return hold.gate.promise;
    }
    if (failPath && path.endsWith(failPath))
      return json({ code: "READ_UNAVAILABLE", message: "read failed" }, 503);
    if (path.endsWith("/approved")) return strong.clone();
    if (path.endsWith("/summary")) return json(summary());
    if (path.endsWith("/plans")) return json(details);
    if (path.endsWith("/policies")) return json(rows);
    if (path.endsWith("/view"))
      return json({ positions: {}, theme: "light", locale: "en" });
    if (path === "/api/plans/other") {
      const other = plan(8);
      other.plan.id = "other";
      other.approval = undefined;
      return json(other);
    }
    return json([]);
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project: summary().project,
    summary: summary(),
    plan: plan(),
    plans: [plan()],
    policies: [],
    source: { filePath: "src/main.ts", content: "do not change" },
    groupDraft: {
      title: "unsaved group",
      description: "keep",
      source: "user",
      memberIds: [],
    },
  });
  cleanups.push(app.disposeAnnotations);
  const ack = (): AcceptedPolicyResponse => ({
    projectId: "p",
    epoch: 71,
    operation: {
      kind: "upsertLegacyPolicy",
      id: "policy",
      pathPrefix: "src",
      purpose: "fresh policy",
      forbiddenDependencies: ["internal"],
    },
    result: policy(),
  });
  return {
    app,
    calls,
    ack,
    rows: (value: DirectoryPolicy[]) => {
      rows = value;
    },
    plans: (value: PlanDetail[]) => {
      details = value;
    },
    strong: (value: Response) => {
      strong = value;
    },
    fail: (suffix: string) => {
      failPath = suffix;
    },
    hold: (suffix: string) => {
      const gate = deferred<Response>();
      const own = { suffix, gate, entered: false };
      hold = own;
      return { ...gate, entered: () => own.entered };
    },
  };
}
test("ACK synchronizes full policy/summary/actual plan revision read-only and preserves historical approval/source/group", async () => {
  const f = fixture(),
    before = f.app.store.getState();
  await f.app.acceptPolicyWrite(f.ack());
  const after = f.app.store.getState();
  expect(after.policies).toEqual([policy()]);
  expect(after.plan).toMatchObject({
    valid: false,
    plan: { revision: 3 },
    approval: before.plan?.approval,
  });
  expect(after.summary).toEqual(summary());
  expect(after.source).toBe(before.source);
  expect(after.groupDraft).toBe(before.groupDraft);
  expect(after.busy.knowledge).toBe(false);
  expect(
    f.calls.every(
      (c) => c.startsWith("GET ") || c === "POST /api/projects/p/layout-target",
    ),
  ).toBe(true);
  expect(f.calls.filter((c) => c.endsWith("/approved"))).toHaveLength(1);
});
test("dirty plan retains exact body/revision/CAS while refreshed list and validity change", async () => {
  const f = fixture(),
    before = f.app.store.getState().plan!.plan,
    capture = f.app.capturePlan();
  f.app.setPlanEditorDirty(true);
  await f.app.acceptPolicyWrite(f.ack());
  expect(f.app.store.getState().plan?.plan).toBe(before);
  expect(f.app.capturePlan()).toEqual(capture);
  expect(f.app.store.getState()).toMatchObject({
    dirtyPlanEditor: true,
    plan: { valid: false },
    plans: [{ plan: { revision: 3 } }],
  });
});
for (const suffix of ["/policies", "/plans", "/summary"])
  test(`read failure ${suffix} rejects and keeps old collection/current receipt unusable`, async () => {
    const f = fixture(),
      before = f.app.store.getState();
    f.fail(suffix);
    await expect(f.app.acceptPolicyWrite(f.ack())).rejects.toMatchObject({
      code: "READ_UNAVAILABLE",
    });
    expect(f.app.store.getState().policies).toBe(before.policies);
    expect(f.app.store.getState().plan?.valid).toBe(false);
    expect(f.app.store.getState().busy.knowledge).toBe(false);
  });
test("only authoritative 409 NOT_APPROVED may recover; context-invalid and 503 never fall back", async () => {
  const f = fixture();
  for (const [status, code] of [
    [409, "APPROVAL_CONTEXT_INVALID"],
    [503, "NOT_APPROVED"],
  ] as const) {
    f.strong(json({ code, message: "must reject" }, status));
    await expect(f.app.acceptPolicyWrite(f.ack())).rejects.toMatchObject({
      code,
    });
  }
  f.strong(notApproved());
  await expect(f.app.acceptPolicyWrite(f.ack())).resolves.toBeUndefined();
});
test("matched strong v1 approval is accepted, mismatched plan revision/owner is rejected", async () => {
  const f = fixture(),
    current = plan(3);
  current.valid = true;
  current.plan.status = "approved";
  current.approval = approval(3);
  f.plans([current]);
  f.strong(json(current));
  await f.app.acceptPolicyWrite(f.ack());
  expect(f.app.store.getState().plan?.valid).toBe(true);
  const invalid = structuredClone(current);
  invalid.plan.projectId = "foreign";
  f.strong(json(invalid));
  await expect(f.app.acceptPolicyWrite(f.ack())).rejects.toMatchObject({
    code: "APPROVAL_CONTEXT_INVALID",
  });
});
test("full captured policy read >50 is accepted, stale or foreign policies are rejected", async () => {
  const f = fixture(),
    rows = Array.from({ length: 73 }, (_, i) => policy(`policy:${i}`));
  f.rows(rows);
  await f.app.acceptPolicyRead({
    projectId: "p",
    epoch: 99,
    snapshot: state(),
    policies: rows,
  });
  expect(f.app.store.getState().policies).toHaveLength(73);
  await expect(
    f.app.acceptPolicyRead({
      projectId: "p",
      epoch: 99,
      snapshot: state(),
      policies: [policy("old")],
    }),
  ).rejects.toMatchObject({ code: "SNAPSHOT_CHANGED" });
  f.rows([{ ...policy(), projectId: "foreign" }]);
  await expect(f.app.acceptPolicyWrite(f.ack())).rejects.toMatchObject({
    code: "PROJECT_MISMATCH",
  });
});
test("late strong approval during public project A→B→A cannot commit even with same project id", async () => {
  const f = fixture(),
    hold = f.hold("/approved"),
    pending = f.app.acceptPolicyWrite(f.ack());
  const result = pending.catch((e) => e);
  await expect.poll(hold.entered).toBe(true);
  await f.app.selectProject({
    id: "other-project",
    name: "other",
    path: "/other",
  });
  await f.app.selectProject(summary().project);
  const after = f.app.store.getState();
  hold.resolve(notApproved());
  expect(await result).toMatchObject({ code: "SNAPSHOT_CHANGED" });
  expect(f.app.store.getState().policies).toBe(after.policies);
  expect(f.app.store.getState().plans).toBe(after.plans);
});
test("same-epoch old callback failure neither clears newer busy nor overwrites newer result", async () => {
  const f = fixture(),
    old = f.hold("/plans"),
    first = f.app.acceptPolicyWrite(f.ack()).catch((e) => e);
  await expect.poll(old.entered).toBe(true);
  const newest = f.hold("/approved"),
    second = f.app.acceptPolicyWrite(f.ack());
  await expect.poll(newest.entered).toBe(true);
  old.reject(Error("late old failure"));
  expect(await first).toBeInstanceOf(Error);
  expect(f.app.store.getState().busy.knowledge).toBe(true);
  newest.resolve(notApproved());
  await second;
  expect(f.app.store.getState().plan?.plan.revision).toBe(3);
  expect(f.app.store.getState().busy.knowledge).toBe(false);
});
test("rejected quarantined read does not steal active same-epoch synchronization lease", async () => {
  const f = fixture(),
    hold = f.hold("/approved"),
    pending = f.app.acceptPolicyWrite(f.ack());
  const result = pending.catch((e) => e);
  await expect.poll(hold.entered).toBe(true);
  await expect(
    f.app.acceptPolicyRead({
      projectId: "p",
      epoch: 2,
      snapshot: { ...state(), status: "invalid" },
      policies: [],
    }),
  ).rejects.toMatchObject({ code: "INVALID_STRUCTURE" });
  expect(f.app.store.getState().busy.knowledge).toBe(true);
  hold.resolve(notApproved());
  expect(await result).toBeUndefined();
  expect(f.app.store.getState().plan?.plan.revision).toBe(3);
  expect(f.app.store.getState().busy.knowledge).toBe(false);
});
test("public planning context change during strong read cannot overwrite newly selected plan", async () => {
  const f = fixture(),
    hold = f.hold("/approved"),
    result = f.app.acceptPolicyWrite(f.ack()).catch((e) => e);
  await expect.poll(hold.entered).toBe(true);
  await f.app.choosePlan("other");
  const other = f.app.store.getState().plan;
  hold.resolve(notApproved());
  expect(await result).toMatchObject({ code: "SNAPSHOT_CHANGED" });
  expect(f.app.store.getState().plan).toBe(other);
});
test("other knowledge owner remains busy; foreign ACK/quarantine cannot become an accepted read", async () => {
  const f = fixture();
  f.app.store.setState({ busy: { knowledge: true } });
  await expect(f.app.acceptPolicyWrite(f.ack())).rejects.toMatchObject({
    code: "KNOWLEDGE_READ_REQUIRED",
  });
  expect(f.app.store.getState().busy.knowledge).toBe(true);
  f.app.store.setState({ busy: {} });
  await expect(
    f.app.acceptPolicyWrite({ ...f.ack(), projectId: "foreign" }),
  ).rejects.toMatchObject({ code: "PROJECT_MISMATCH" });
  await expect(
    f.app.acceptPolicyRead({
      projectId: "p",
      epoch: 1,
      snapshot: { ...state(), status: "invalid" },
      policies: [],
    }),
  ).rejects.toMatchObject({ code: "INVALID_STRUCTURE" });
});
test("real controller known ACK + parent sync failure keeps saved notice and never replays PUT", async () => {
  const f = fixture();
  f.fail("/plans");
  let writes = 0;
  const controller = createPolicyController(
    {
      readState: async () => state(),
      readPolicies: async () => ({ ...state(), policies: [policy()] }),
      preview: async () => ({ ...state(), policies: [] }),
      savePolicy: async () => {
        writes++;
        return policy();
      },
      writeStructure: async () => {
        writes++;
        return state();
      },
    },
    f.app.acceptPolicyWrite,
  );
  controller.selectProject("p");
  await controller.reload();
  controller.choose("legacy:policy");
  controller.edit({ purpose: "fresh policy" });
  await controller.save();
  expect(controller.store.getState()).toMatchObject({
    notice: "saved",
    needsReload: true,
    retryAvailable: false,
    error: { code: "WORKSPACE_SYNC_REQUIRED" },
  });
  await controller.retry();
  expect(writes).toBe(1);
  controller.dispose();
});
