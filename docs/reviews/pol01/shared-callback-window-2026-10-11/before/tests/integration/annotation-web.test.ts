import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
import { SourceIndexer } from "@codemap/indexer";
import { WorkspaceService } from "@codemap/service";
import { createServer } from "../../apps/server/src/server.js";
import { HttpApi } from "../../apps/web/src/api/client.js";
import { createWorkspace } from "../../apps/web/src/app/workspace.js";
import {
  activeAnnotationDraft,
  beginAnnotationRequest,
  changeAnnotationDraft,
  openAnnotationDraft,
  prepareAnnotationCandidate,
  confirmAnnotationDelete,
} from "../../apps/web/src/features/annotations/draft.js";
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "kn01-web-http-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "owned-source");
  await mkdir(join(target, ".codemap"), { recursive: true });
  await writeFile(
    join(target, ".codemap", "structure.json"),
    JSON.stringify({ schemaVersion: 1, folders: [], dependencyRules: [] }),
  );
  await writeFile(join(target, "a.ts"), "export function same(){return 1;}\n");
  await writeFile(join(target, "b.ts"), "export function same(){return 2;}\n");
  const storage = new SqliteStorage(join(root, "owned.sqlite"));
  cleanups.push(() => storage.close());
  const service = new WorkspaceService({
    storage,
    indexer: new SourceIndexer(),
    structureFiles: new StructureFileStore(),
  });
  const server = await createServer({ service });
  cleanups.push(async () => {
    await server.close();
  });
  await server.listen({ host: "127.0.0.1", port: 0 });
  const base = server.server.address();
  if (!base || typeof base === "string")
    throw Error("owned HTTP listener missing");
  const url = `http://127.0.0.1:${base.port}`;
  let lose = false,
    writes = 0;
  const api = new HttpApi((async (path, init) => {
    const response = await fetch(url + path, init);
    if (init?.method === "POST" && String(path).endsWith("/annotations")) {
      writes++;
      if (lose) {
        lose = false;
        throw Error("fixture: actual committed response lost");
      }
    }
    return response;
  }) as typeof fetch);
  const project = await api.open(target),
    app = createWorkspace(api);
  cleanups.push(() => app.disposeAnnotations());
  await app.selectProject(project);
  await app.annotations.activate();
  return {
    root,
    target,
    api,
    app,
    service,
    project,
    storage,
    lose: () => {
      lose = true;
    },
    writes: () => writes,
  };
}
async function submit(
  app: ReturnType<typeof createWorkspace>,
  action: "save" | "bind" | "detach" | "delete" = "save",
) {
  const started = beginAnnotationRequest(
    app.annotations.store.getState().editor!,
    action,
  );
  app.annotations.setEditor(started.state);
  await app.annotations.submit(started.request);
}
test("real TCP + owned SQLite live notes preserve actor/source/constraint, explicit current SID/domain CAS, immutable approval and exactly one plan invalidation", async () => {
  const f = await fixture(),
    snapshot = await f.api.snapshot(f.project.id),
    target = snapshot.nodes.find(
      (n) => n.kind === "function" && n.filePath === "b.ts",
    )!;
  f.app.store.setState({ selectedNode: target });
  let editor = changeAnnotationDraft(
    f.app.annotations.store.getState().editor!,
    {
      text: "independent retained knowledge",
      author: "actual author",
      isConstraint: true,
    },
  );
  editor = prepareAnnotationCandidate(editor, snapshot, {
    kind: "node",
    id: target.id,
  });
  f.app.annotations.setEditor(editor);
  await submit(f.app, "bind");
  const page = await f.api.annotations(f.project.id),
    created = page.items[0]!;
  expect(created.annotation).toMatchObject({
    author: "actual author",
    source: "user",
    isConstraint: true,
    revision: 1,
    binding: {
      state: "bound",
      selectedSnapshotId: snapshot.id,
      target: { kind: "node", id: target.id },
    },
  });
  expect(f.app.annotations.store.getState().editor?.error).toBeUndefined();
  const plan = await f.api.createPlan(f.project.id, "approval", snapshot.id),
    approved = await f.api.approve(plan.plan.id, plan.plan.revision);
  f.app.store.setState({ plan: approved, plans: [approved] });
  const historyBefore = await f.api.export(plan.plan.id, "json");
  editor = changeAnnotationDraft(
    openAnnotationDraft(f.app.annotations.store.getState().editor!, created),
    { text: "new body", author: "new display author" },
  );
  f.app.annotations.setEditor(editor);
  await submit(f.app);
  const current = await f.api.plan(plan.plan.id);
  expect(current.plan.revision).toBe(approved.plan.revision + 1);
  expect(current.valid).toBe(false);
  expect(f.app.annotations.store.getState().executionBlocked).toBe(false);
  expect(f.app.store.getState().plan?.valid).toBe(false);
  const historical = JSON.parse(historyBefore),
    after = JSON.parse(await f.api.export(plan.plan.id, "json"));
  expect(after.annotationContext).toEqual(historical.annotationContext);
  expect(after.approval).toEqual(historical.approval);
  expect(after.annotationContext.annotations[0].text).toBe(
    "independent retained knowledge",
  );
  const updated = (await f.api.annotations(f.project.id)).items[0]!;
  expect(updated.annotation).toMatchObject({
    text: "new body",
    author: "new display author",
    source: "user",
    isConstraint: true,
    revision: 2,
  });
  const records = await f.api.annotationHistory(
    f.project.id,
    updated.annotation.id,
  );
  expect(records.items.map((r) => r.action)).toEqual(["edit", "create"]);
  expect(await readFile(join(f.target, "b.ts"), "utf8")).toBe(
    "export function same(){return 2;}\n",
  );
});
test("real committed lost ACK keeps new UUID unknown; list equality and reread unlock execution without clearing draft or repeating create", async () => {
  const f = await fixture(),
    snapshot = await f.api.snapshot(f.project.id),
    plan = await f.api.createPlan(f.project.id, "unknown", snapshot.id);
  f.app.store.setState({ plan, plans: [plan] });
  f.lose();
  f.app.annotations.setEditor(
    changeAnnotationDraft(f.app.annotations.store.getState().editor!, {
      text: "actual committed unknown",
      author: "actual actor",
    }),
  );
  await submit(f.app);
  expect(f.writes()).toBe(1);
  const page = await f.api.annotations(f.project.id);
  expect(page.total).toBe(1);
  expect(page.items[0]?.annotation.id).toBeTruthy();
  expect(
    activeAnnotationDraft(f.app.annotations.store.getState().editor!),
  ).toMatchObject({
    text: "actual committed unknown",
    dirty: true,
    uncertain: true,
  });
  expect(
    activeAnnotationDraft(f.app.annotations.store.getState().editor!)
      .annotationId,
  ).toBeUndefined();
  await f.app.annotations.reload();
  expect(f.app.annotations.store.getState().executionBlocked).toBe(false);
  expect(() =>
    beginAnnotationRequest(f.app.annotations.store.getState().editor!, "save"),
  ).toThrow();
  expect(f.writes()).toBe(1);
  expect((await f.api.annotations(f.project.id)).total).toBe(1);
});
test("source disappearance retains orphan body, return never guesses same name, explicit rebind requires new current captured SID; old CAS fails", async () => {
  const f = await fixture(),
    snapshot = await f.api.snapshot(f.project.id),
    target = snapshot.nodes.find(
      (n) => n.kind === "function" && n.filePath === "a.ts",
    )!;
  const note = await f.api.createAnnotation(f.project.id, {
    text: "keep knowledge",
    author: "author",
    source: "agent",
    isConstraint: true,
    binding: {
      snapshotId: snapshot.id,
      target: { kind: "node", id: target.id },
    },
  });
  await writeFile(
    join(f.target, "a.ts"),
    "export function renamed(){return 3;}\n",
  );
  await f.api.refresh(f.project.id);
  const orphan = await f.api.annotation(f.project.id, note.annotation.id);
  expect(orphan.annotation.binding?.state).toBe("orphan");
  expect(orphan.annotation.text).toBe("keep knowledge");
  await writeFile(
    join(f.target, "a.ts"),
    "export function same(){return 1;}\n",
  );
  const returned = await f.api.refresh(f.project.id);
  const stillOrphan = await f.api.annotation(f.project.id, note.annotation.id);
  expect(stillOrphan.annotation.binding?.state).toBe("orphan");
  await expect(
    f.api.bindAnnotation(f.project.id, note.annotation.id, {
      expectedRevision: note.annotation.revision,
      snapshotId: returned.id,
      target: { kind: "node", id: target.id },
    }),
  ).rejects.toMatchObject({ code: "REVISION_CONFLICT", status: 409 });
  const rebound = await f.api.bindAnnotation(f.project.id, note.annotation.id, {
    expectedRevision: stillOrphan.annotation.revision,
    snapshotId: returned.id,
    target: { kind: "node", id: target.id },
  });
  expect(rebound.annotation.binding?.state).toBe("bound");
  expect(rebound.annotation.source).toBe("agent");
  expect(
    (await f.api.annotationHistory(f.project.id, note.annotation.id)).items.map(
      (item) => item.action,
    ),
  ).toEqual(["bind", "orphan", "create"]);
});

test("real notes detach and confirmed revision delete are separate writes; opened immutable history includes deleted body after current list hides it", async () => {
  const f = await fixture(),
    snapshot = await f.api.snapshot(f.project.id),
    target = snapshot.nodes.find((n) => n.kind === "function")!;
  const note = await f.api.createAnnotation(f.project.id, {
    text: "recorded retained body",
    author: "initial",
    source: "agent",
    isConstraint: true,
    binding: {
      snapshotId: snapshot.id,
      target: { kind: "node", id: target.id },
    },
  });
  await f.app.annotations.reload();
  f.app.annotations.setEditor(
    openAnnotationDraft(f.app.annotations.store.getState().editor!, note),
  );
  await submit(f.app, "detach");
  const detached = await f.api.annotation(f.project.id, note.annotation.id);
  expect(detached.annotation).toMatchObject({
    revision: 2,
    binding: null,
    source: "agent",
    text: "recorded retained body",
  });
  await f.app.annotations.history(note.annotation.id);
  f.app.annotations.setEditor(
    confirmAnnotationDelete(f.app.annotations.store.getState().editor!, true),
  );
  await submit(f.app, "delete");
  expect((await f.api.annotations(f.project.id)).total).toBe(0);
  expect(
    f.app.annotations.store.getState().history?.value?.items[0],
  ).toMatchObject({
    action: "delete",
    annotation: {
      revision: 3,
      text: "recorded retained body",
      source: "agent",
      isConstraint: true,
    },
  });
  expect(
    activeAnnotationDraft(f.app.annotations.store.getState().editor!).accepted
      ?.deletedAt,
  ).toBeTruthy();
});
