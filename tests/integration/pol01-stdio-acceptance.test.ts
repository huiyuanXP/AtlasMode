import { afterEach, expect, test } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { DirectoryPolicy, StructureState } from "@codemap/core";
import { SqliteStorage } from "@codemap/storage";
import { StructureClient } from "../../apps/web/src/api/structure-client.js";
import { createPolicyController } from "../../apps/web/src/features/structure/policy-controller.js";
import { legacyId, pol01Fixture, v1 } from "../support/pol01-acceptance.js";
const fixtures: Awaited<ReturnType<typeof pol01Fixture>>[] = [];
afterEach(async () => {
  for (const f of fixtures.splice(0).reverse()) await f.close();
});
async function fixture() {
  const f = await pol01Fixture(
    process.env.POL01_ACCEPTANCE_MODE === "compiled" ? "compiled" : "source",
  );
  fixtures.push(f);
  return f;
}
test("actual SQLite/API: v1 unknown roundtrip, DB-only edit then explicit import retains unsent controller draft", async () => {
  const f = await fixture(),
    base = `/api/projects/${f.project.id}`;
  const client = new StructureClient(f.transport),
    state = await client.readState(f.project.id);
  const saved = await client.writeStructure(f.project.id, {
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: state.fileDigest,
    operation: {
      kind: "upsertFolder",
      previousPath: "src",
      path: "src",
      purpose: "人工编辑职责",
    },
  });
  expect(saved.document).toEqual({
    ...v1("人工编辑职责"),
    folders: v1("人工编辑职责").folders,
  });
  expect(JSON.parse(await readFile(f.path, "utf8"))).toEqual(saved.document);
  const controller = createPolicyController(client);
  controller.selectProject(f.project.id);
  await controller.reload();
  controller.choose(`legacy:${legacyId}`);
  controller.edit({ purpose: "DB edit A" });
  const before = await readFile(f.path);
  await controller.save();
  expect(controller.store.getState()).toMatchObject({
    notice: "saved",
    dirty: false,
    draft: { id: legacyId, purpose: "DB edit A" },
  });
  expect(await readFile(f.path)).toEqual(before); // pre-migration edit remains genuine DB-only
  expect(
    (await f.json<DirectoryPolicy[]>(`${base}/policies`)).find(
      (p) => p.id === legacyId,
    )?.purpose,
  ).toBe("DB edit A");
  const plan = await f.json<{ plan: { id: string; revision: number } }>(
    "/api/plans",
    "POST",
    { projectId: f.project.id, title: "owned migration review" },
  );
  const approved = await f.json<{ approval: unknown }>(
    `/api/plans/${plan.plan.id}/approve`,
    "POST",
    { expectedRevision: plan.plan.revision },
  );
  await controller.reload();
  controller.choose(`legacy:${legacyId}`);
  controller.edit({ purpose: "unsent local B" });
  await controller.previewLegacy();
  expect(controller.store.getState().preview?.policies).toEqual([
    expect.objectContaining({ id: legacyId, purpose: "DB edit A" }),
  ]);
  await controller.importLegacy();
  expect(controller.store.getState()).toMatchObject({
    notice: "imported",
    dirty: true,
    draft: { purpose: "unsent local B" },
    retryAvailable: false,
  });
  const imported = JSON.parse(await readFile(f.path, "utf8"));
  expect(imported["x-atlasmode"].legacyPathPolicies[0]).toMatchObject({
    id: legacyId,
    purpose: "DB edit A",
  });
  expect(imported.ownerMetadata).toEqual(v1().ownerMetadata);
  expect(imported.folders[0]).toEqual(v1("人工编辑职责").folders[0]);
  expect(imported.dependencyRules).toEqual(v1().dependencyRules);
  await f.restart();
  const reopened = await client.readState(f.project.id);
  expect(reopened.document).toEqual(imported);
  const db = new SqliteStorage(f.database);
  try {
    expect(db.get("policies", legacyId)).toBeUndefined();
  } finally {
    db.close();
  }
  expect(
    (await client.readPolicies(f.project.id)).policies.find(
      (p) => p.id === legacyId,
    )?.purpose,
  ).toBe("DB edit A");
  expect((await f.raw(`/api/plans/${plan.plan.id}/approved`)).status).toBe(409);
  expect(await f.json(`/api/plans/${plan.plan.id}`)).toMatchObject({
    valid: false,
    approval: approved.approval,
    plan: { revision: plan.plan.revision + 1 },
  });
  controller.dispose();
  await f.invariants();
}, 30000);

test("actual HTTP 409 preserves draft and old capture until explicit reread, no implicit CAS rebase", async () => {
  const f = await fixture(),
    statuses: number[] = [];
  const client = new StructureClient(async (input, init) => {
    const response = await f.transport(input, init);
    if (init?.method === "PUT") statuses.push(response.status);
    return response;
  });
  const controller = createPolicyController(client);
  controller.selectProject(f.project.id);
  await controller.reload();
  controller.choose("folder:src");
  controller.edit({ purpose: "draft remains" });
  const capture = { ...controller.store.getState().capture };
  await writeFile(f.path, JSON.stringify(v1("external changed")));
  await controller.save();
  expect(statuses).toEqual([409]);
  expect(controller.store.getState()).toMatchObject({
    dirty: true,
    draft: { purpose: "draft remains" },
    needsReload: true,
    retryAvailable: false,
    capture,
  });
  expect(JSON.parse(await readFile(f.path, "utf8")).folders[0].purpose).toBe(
    "external changed",
  );
  await controller.save();
  expect(statuses).toEqual([409]);
  await controller.reload();
  expect(controller.store.getState().draft.purpose).toBe("draft remains");
  expect(controller.store.getState().capture?.fileDigest).not.toBe(
    capture.fileDigest,
  );
  await controller.save();
  expect(statuses).toEqual([409, 200]);
  expect(JSON.parse(await readFile(f.path, "utf8"))).toEqual(
    v1("draft remains"),
  );
  controller.dispose();
  await f.invariants();
}, 30000);

test("actual SDK stdio current approval is fresh after external edit; quarantine persists across actual API restart", async () => {
  const f = await fixture(),
    base = `/api/projects/${f.project.id}`;
  const plan = await f.json<{ plan: { id: string; revision: number } }>(
    "/api/plans",
    "POST",
    { projectId: f.project.id, title: "owned review" },
  );
  const approved = await f.json<{ approval: unknown }>(
    `/api/plans/${plan.plan.id}/approve`,
    "POST",
    { expectedRevision: plan.plan.revision },
  );
  const mcp = await f.mcp();
  const tools = await mcp.client.listTools();
  expect(tools.tools).toHaveLength(18);
  expect(tools.tools.some((tool) => tool.name === "get_approved_plan")).toBe(
    true,
  );
  expect(tools.tools.some((tool) => /^(approve|write)_/.test(tool.name))).toBe(
    false,
  );
  expect(
    (
      await mcp.call("get_approved_plan", {
        projectId: f.project.id,
        planId: plan.plan.id,
      })
    ).isError,
  ).toBe(false);
  await writeFile(f.path, JSON.stringify(v1("external freshness")));
  const invalidated = await mcp.call<{ code?: string; error?: unknown }>(
    "get_approved_plan",
    { projectId: f.project.id, planId: plan.plan.id },
  );
  expect(invalidated.isError).toBe(true);
  expect(JSON.stringify(invalidated.body)).toContain("NOT_APPROVED");
  const policies = await mcp.call<{
    items: DirectoryPolicy[];
    fileDigest: string;
    structureRevision: number;
  }>("get_folder_policies", { projectId: f.project.id });
  expect(policies.isError).toBe(false);
  expect(policies.body.items).toContainEqual(
    expect.objectContaining({ purpose: "external freshness" }),
  );
  const fresh = await f.json<StructureState>(`${base}/structure`);
  expect(policies.body).toMatchObject({
    fileDigest: fresh.fileDigest,
    structureRevision: fresh.structureRevision,
  });
  const history = await f.json<{ approval: unknown; valid: boolean }>(
    `/api/plans/${plan.plan.id}`,
  );
  expect(history).toMatchObject({ valid: false, approval: approved.approval });
  const malformed =
    '{"schemaVersion":999,"folders":[],"dependencyRules":[],"unknown":"retain invalid bytes"}';
  await writeFile(f.path, malformed);
  expect((await f.json<StructureState>(`${base}/structure`)).status).toBe(
    "invalid",
  );
  expect(
    (await mcp.call("get_folder_policies", { projectId: f.project.id }))
      .isError,
  ).toBe(true);
  await mcp.stop();
  await f.restart();
  expect((await f.json<StructureState>(`${base}/structure`)).status).toBe(
    "invalid",
  );
  expect(await readFile(f.path, "utf8")).toBe(malformed);
  expect((await f.raw(`/api/plans/${plan.plan.id}/approved`)).status).toBe(422);
  const historyAfter = await f.raw<{ approval: unknown }>(
    `/api/plans/${plan.plan.id}`,
  );
  // Quarantine may reject current read; immutable approval must remain in SQLite.
  expect([200, 422]).toContain(historyAfter.status);
  const db = new SqliteStorage(f.database);
  try {
    expect(db.list("approvals")).toContainEqual(approved.approval);
  } finally {
    db.close();
  }
  await writeFile(f.path, JSON.stringify(v1("external freshness")));
  expect((await f.json<StructureState>(`${base}/structure`)).status).toBe(
    "ready",
  );
  await f.invariants();
}, 30000);
