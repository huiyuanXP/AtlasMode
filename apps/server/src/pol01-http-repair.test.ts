import {
  pol01Runtime,
  assertOwnedPidAbsent,
} from "../../../tests/support/pol01-runtime.js";
import { afterEach, expect, test, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WorkspaceService } from "@codemap/service";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
import type {
  IndexerPort,
  StructureFilePort,
  StructureWriteInput,
} from "@codemap/core";
import { createServer } from "./server.js";

const closes: (() => Promise<void> | void)[] = [];
const ownedRoots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of closes.splice(0).reverse()) await close();
  for (const root of ownedRoots.splice(0))
    console.info(
      JSON.stringify({
        receipt: "POL01_OWNED_FIXTURE_CLOSED",
        root,
        sqliteConnections: "closed",
        apps: "closed",
        listener: "inject-only/no-listener",
        rootCleanup: "retained-evidence",
        workerPid: process.pid,
      }),
    );
});
const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const document = (purpose = "before") =>
  JSON.stringify({
    schemaVersion: 1,
    folders: [{ path: "src", purpose }],
    dependencyRules: [],
  });
async function setup(
  ports: (
    files: StructureFileStore,
    source: SourceIndexer,
    roots: string[],
  ) => { files?: StructureFilePort; indexer?: IndexerPort } = () => ({}),
) {
  const root = await mkdtemp(join(tmpdir(), "atlas-pol01-repair-")),
    roots = [join(root, "a"), join(root, "b")];
  for (const path of roots) {
    await mkdir(join(path, ".codemap"), { recursive: true });
    await writeFile(join(path, ".codemap", "structure.json"), document());
    await writeFile(
      join(path, "main.ts"),
      "export function owned() { return 1; }\n",
    );
  }
  ownedRoots.push(root);
  const storage = new SqliteStorage(join(root, "owned.sqlite")),
    files = new StructureFileStore(),
    source = new SourceIndexer(),
    options = ports(files, source, roots);
  closes.push(() => storage.close());
  const service = new WorkspaceService({
    storage,
    indexer: options.indexer ?? source,
    structureFiles: options.files ?? files,
  });
  const projects = await Promise.all(
      roots.map((path) => service.openProject(path)),
    ),
    app = await createServer({ service });
  closes.push(() => app.close());
  return {
    root,
    roots,
    projects,
    storage,
    files,
    service,
    app,
    path: (index = 0) => join(roots[index]!, ".codemap", "structure.json"),
  };
}
async function input(
  f: Awaited<ReturnType<typeof setup>>,
  index: number,
  operation: StructureWriteInput["operation"],
): Promise<StructureWriteInput> {
  const state = await f.service.getStructure(f.projects[index]!.id);
  return {
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: state.fileDigest,
    operation,
  };
}
const policy = (id: string) => ({
  kind: "upsertLegacyPolicy" as const,
  id,
  pathPrefix: "src",
  purpose: "owned binding",
  forbiddenDependencies: [],
});
const url = (f: Awaited<ReturnType<typeof setup>>, index: number) =>
  `/api/projects/${f.projects[index]!.id}/structure`;

test.each(["json", "markdown"])(
  "I1 direct %s HTTP export synchronizes external semantics and preserves immutable history",
  async (format) => {
    const f = await setup(),
      plan = f.service.createPlan({
        projectId: f.projects[0]!.id,
        title: "export",
      }).plan;
    await f.service.approvePlan(plan.id, 1);
    const history = f.storage.list("approvals"),
      approvedSnapshots = f.storage
        .list("settings")
        .filter(
          (value) => (value as { status?: string }).status === "approved",
        );
    await writeFile(f.path(), document("external semantic edit"));
    const response = await f.app.inject({
      method: "GET",
      url: `/api/plans/${plan.id}/export?format=${format}`,
    });
    expect(response.statusCode).toBe(200);
    if (format === "json")
      expect(response.json()).toMatchObject({
        valid: false,
        plan: { revision: 2 },
        approval: { revision: 1 },
        approvedPlan: { revision: 1 },
      });
    else {
      expect(response.body).toContain("Current valid: false");
      expect(response.body).toContain("Current revision: 2");
      expect(response.body).toContain("Approved revision: 1");
    }
    expect(f.storage.list("approvals")).toEqual(history);
    expect(
      f.storage
        .list("settings")
        .filter(
          (value) => (value as { status?: string }).status === "approved",
        ),
    ).toEqual(approvedSnapshots);
    expect(
      (
        await f.app.inject({
          method: "GET",
          url: `/api/plans/${plan.id}/export?format=${format}`,
        })
      ).statusCode,
    ).toBe(200);
    expect(f.storage.get("plans", plan.id)).toMatchObject({ revision: 2 });
  },
);

test("I2 queued B claim is revalidated before publication after A commits the identity", async () => {
  const entered = gate(),
    release = gate();
  let holdB = false;
  const f = await setup((_, source, roots) => ({
    indexer: {
      index: async (path, id) => {
        if (holdB && path === roots[1]) {
          entered.resolve();
          await release.promise;
        }
        return source.index(path, id);
      },
    },
  }));
  const bodies = await Promise.all([
    input(f, 0, policy("shared-explicit-id")),
    input(f, 1, policy("shared-explicit-id")),
  ]);
  const before = await readFile(f.path(1));
  const planB = f.service.createPlan({
    projectId: f.projects[1]!.id,
    title: "loser history",
  }).plan;
  await f.service.approvePlan(planB.id, 1);
  const history = f.storage.list("approvals");
  holdB = true;
  const refreshing = f.service.refreshIndex(f.projects[1]!.id);
  await entered.promise;
  const bQueued = gate(),
    original = f.service.updateStructure.bind(f.service);
  vi.spyOn(f.service, "updateStructure").mockImplementation((id, value) => {
    const pending = original(id, value);
    if (id === f.projects[1]!.id) bQueued.resolve();
    return pending;
  });
  const losing = f.app.inject({
    method: "PUT",
    url: url(f, 1),
    payload: bodies[1],
  });
  await bQueued.promise;
  let winner;
  try {
    winner = await f.app.inject({
      method: "PUT",
      url: url(f, 0),
      payload: bodies[0],
    });
  } finally {
    holdB = false;
    release.resolve();
  }
  await refreshing;
  const loser = await losing;
  expect(winner.statusCode).toBe(200);
  expect([400, 409]).toContain(loser.statusCode);
  expect(["PROJECT_MISMATCH", "STRUCTURE_CONFLICT"]).toContain(
    loser.json().code,
  );
  expect(await readFile(f.path(1))).toEqual(before);
  expect(f.storage.get("plans", planB.id)).toMatchObject({ revision: 1 });
  expect(f.storage.list("approvals")).toEqual(history);
  expect(
    f.service
      .listStructureAudit(f.projects[1]!.id, { offset: 0, limit: 100 })
      .items.some(
        (item) =>
          item.id === bodies[1]!.mutationId && item.outcome === "committed",
      ),
  ).toBe(false);
  expect(
    (
      await f.app.inject({
        method: "GET",
        url: `/api/projects/${f.projects[0]!.id}/policies`,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await f.app.inject({
        method: "GET",
        url: `/api/projects/${f.projects[1]!.id}/policies`,
      })
    ).statusCode,
  ).toBe(200);
});

test.each(["invalid", "deleted"])(
  "I1 export first observes %s bytes instead of cached current approval",
  async (kind) => {
    const f = await setup(),
      plan = f.service.createPlan({
        projectId: f.projects[0]!.id,
        title: kind,
      }).plan;
    await f.service.approvePlan(plan.id, 1);
    const history = f.storage.list("approvals");
    if (kind === "invalid") await writeFile(f.path(), "{invalid");
    else await unlink(f.path());
    const response = await f.app.inject({
      method: "GET",
      url: `/api/plans/${plan.id}/export?format=json`,
    });
    if (kind === "invalid") {
      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: "INVALID_STRUCTURE" });
      expect(await readFile(f.path(), "utf8")).toBe("{invalid");
    } else {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        valid: false,
        plan: { revision: 2 },
        approvedPlan: { revision: 1 },
      });
    }
    expect(f.storage.list("approvals")).toEqual(history);
  },
);

test("I2 prepared simultaneous claim loses before publication and winner remains usable", async () => {
  const entered = gate(),
    release = gate();
  let aPath = "",
    bPublications = 0;
  const f = await setup((files, _, roots) => {
    aPath = roots[0]!;
    return {
      files: {
        read: (path) => files.read(path),
        publish: async (path, value) => {
          if (path === aPath) {
            entered.resolve();
            await release.promise;
          } else bPublications++;
          return files.publish(path, value);
        },
      },
    };
  });
  const bodies = await Promise.all([
      input(f, 0, policy("simultaneous-id")),
      input(f, 1, policy("simultaneous-id")),
    ]),
    before = await readFile(f.path(1));
  const winning = f.app.inject({
    method: "PUT",
    url: url(f, 0),
    payload: bodies[0],
  });
  await entered.promise;
  let loser;
  try {
    loser = await f.app.inject({
      method: "PUT",
      url: url(f, 1),
      payload: bodies[1],
    });
  } finally {
    release.resolve();
  }
  expect((await winning).statusCode).toBe(200);
  expect([400, 409]).toContain(loser.statusCode);
  expect(bPublications).toBe(0);
  expect(await readFile(f.path(1))).toEqual(before);
  expect(
    (
      await f.app.inject({
        method: "GET",
        url: `/api/projects/${f.projects[0]!.id}/policies`,
      })
    ).statusCode,
  ).toBe(200);
});

test.each(["prepared", "published"])(
  "I1 export is queued behind %s publication before it reports current validity",
  async (phase) => {
    const entered = gate(),
      release = gate();
    let enabled = false;
    const f = await setup((files) => ({
      files: {
        read: (path) => files.read(path),
        publish: async (path, value) => {
          if (enabled && phase === "prepared") {
            entered.resolve();
            await release.promise;
          }
          const result = await files.publish(path, value);
          if (enabled && phase === "published") {
            entered.resolve();
            await release.promise;
          }
          return result;
        },
      },
    }));
    const plan = f.service.createPlan({
      projectId: f.projects[0]!.id,
      title: "export barrier",
    }).plan;
    await f.service.approvePlan(plan.id, 1);
    const history = f.storage.list("approvals");
    const body = await input(f, 0, {
      kind: "upsertFolder",
      previousPath: "src",
      path: "src",
      purpose: "changed",
    });
    enabled = true;
    const writing = f.service.updateStructure(f.projects[0]!.id, body);
    await entered.promise;
    const queued = gate(),
      original = f.service.exportPlanFresh.bind(f.service);
    vi.spyOn(f.service, "exportPlanFresh").mockImplementation((id, format) => {
      const value = original(id, format);
      queued.resolve();
      return value;
    });
    const request = f.app.inject({
      method: "GET",
      url: `/api/plans/${plan.id}/export?format=json`,
    });
    let settled = false;
    void request.then(() => {
      settled = true;
    });
    await queued.promise;
    await Promise.resolve();
    expect(settled).toBe(false);
    release.resolve();
    await writing;
    const response = await request;
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      valid: false,
      plan: { revision: 2 },
      approvedPlan: { revision: 1 },
    });
    expect(f.storage.list("approvals")).toEqual(history);
  },
);

test.each(["before", "after", "unknown"])(
  "I2 durable %s crash claim prevents losing publication and recovery releases only proved-before claims",
  async (phase) => {
    const f = await setup(),
      id = `crash-claim-${phase}`;
    const planB = f.service.createPlan({
      projectId: f.projects[1]!.id,
      title: "unchanged loser",
    }).plan;
    await f.service.approvePlan(planB.id, 1);
    const history = f.storage.list("approvals"),
      beforeA = await readFile(f.path()),
      beforeB = await readFile(f.path(1));
    await f.app.close();
    f.storage.close();
    const runtime = await pol01Runtime(f.root);
    const child = spawn(
      process.execPath,
      [
        ...runtime.crashArgs,
        f.roots[0]!,
        join(f.root, "owned.sqlite"),
        f.projects[0]!.id,
        phase === "unknown" ? "after" : phase,
        id,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...runtime.env,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (value) => {
      stderr += String(value);
    });
    const exit = await once(child, "close");
    assertOwnedPidAbsent(child.pid);
    expect(
      JSON.parse(
        await readFile(join(f.roots[0]!, "crash-checkpoint.json"), "utf8"),
      ),
    ).toMatchObject({
      pid: child.pid,
      phase: phase === "unknown" ? "after" : phase,
      productMode: runtime.mode,
    });
    expect(exit).toEqual([null, "SIGKILL"]);
    expect(stderr).toBe("");
    console.info(
      JSON.stringify({
        receipt: "POL01_OWNED_RUNTIME",
        phase,
        pid: child.pid,
        exitCode: exit[0],
        signal: exit[1],
        database: join(f.root, "owned.sqlite"),
        root: f.root,
        port: null,
        portState: "no-listener",
        rootCleanup: "retained-evidence",
        processExited: true,
      }),
    );
    const storage = new SqliteStorage(join(f.root, "owned.sqlite"));
    closes.push(() => storage.close());
    let unreadable = phase === "unknown",
      bPublications = 0;
    const service = new WorkspaceService({
      storage,
      indexer: new SourceIndexer(),
      structureFiles: {
        read: (path) => {
          if (unreadable && path === f.roots[0])
            throw new Error("owned-unknown-io");
          return f.files.read(path);
        },
        publish: (path, value) => {
          if (path === f.roots[1]) bPublications++;
          return f.files.publish(path, value);
        },
      },
    });
    const app = await createServer({ service });
    closes.push(() => app.close());
    const stateB = await service.getStructure(f.projects[1]!.id),
      body = {
        mutationId: randomUUID(),
        expectedStructureRevision: stateB.structureRevision,
        expectedFileDigest: stateB.fileDigest,
        operation: policy(id),
      };
    const blocked = await app.inject({
      method: "PUT",
      url: url(f, 1),
      payload: body,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ code: "STRUCTURE_CONFLICT" });
    expect(bPublications).toBe(0);
    expect(await readFile(f.path(1))).toEqual(beforeB);
    const recovery = await service.recoverStructureWrites();
    if (phase === "unknown") {
      expect(recovery).toMatchObject({
        blockedProjectIds: [f.projects[0]!.id],
      });
      expect(
        (await app.inject({ method: "PUT", url: url(f, 1), payload: body }))
          .statusCode,
      ).toBe(409);
      expect(bPublications).toBe(0);
      unreadable = false;
      expect(await service.recoverStructureWrites()).toMatchObject({
        blockedProjectIds: [],
      });
    } else expect(recovery).toMatchObject({ blockedProjectIds: [] });
    const retried = await app.inject({
      method: "PUT",
      url: url(f, 1),
      payload: body,
    });
    if (phase === "before") {
      expect(retried.statusCode).toBe(200);
      expect(await readFile(f.path())).toEqual(beforeA);
      expect(bPublications).toBe(1);
    } else {
      expect(retried.statusCode).toBe(400);
      expect(retried.json()).toMatchObject({ code: "PROJECT_MISMATCH" });
      expect(bPublications).toBe(0);
      expect(await readFile(f.path(1))).toEqual(beforeB);
    }
    expect(storage.get("plans", planB.id)).toMatchObject({
      revision: phase === "before" ? 2 : 1,
    });
    expect(storage.list("approvals")).toEqual(history);
    await service.recoverStructureWrites();
    expect(storage.get("plans", planB.id)).toMatchObject({
      revision: phase === "before" ? 2 : 1,
    });
  },
);

test("I2 two initially unclaimed IDs are coordinated before any durable intent or publication", async () => {
  const entered = gate(),
    release = gate();
  let enabled = false,
    aRoot = "",
    bReads = 0,
    bPublications = 0;
  const f = await setup((files, _, roots) => {
    aRoot = roots[0]!;
    return {
      files: {
        read: async (path) => {
          if (enabled && path === aRoot) {
            entered.resolve();
            await release.promise;
          }
          if (enabled && path === roots[1]) bReads++;
          return files.read(path);
        },
        publish: (path, value) => {
          if (path === roots[1]) bPublications++;
          return files.publish(path, value);
        },
      },
    };
  });
  const bodies = await Promise.all([
      input(f, 0, policy("initially-unclaimed-id")),
      input(f, 1, policy("initially-unclaimed-id")),
    ]),
    beforeB = await readFile(f.path(1));
  enabled = true;
  const winner = f.app.inject({
    method: "PUT",
    url: url(f, 0),
    payload: bodies[0],
  });
  await entered.promise;
  expect(
    f.storage
      .list<{ recordType?: string; pending?: boolean }>("settings")
      .some(
        (value) => value.recordType === "structure_intent" && value.pending,
      ),
  ).toBe(false);
  const arrived = gate(),
    original = f.service.updateStructure.bind(f.service);
  vi.spyOn(f.service, "updateStructure").mockImplementation((id, value) => {
    const work = original(id, value);
    if (id === f.projects[1]!.id) arrived.resolve();
    return work;
  });
  const loser = f.app.inject({
    method: "PUT",
    url: url(f, 1),
    payload: bodies[1],
  });
  let settled = false;
  void loser.then(() => {
    settled = true;
  });
  try {
    await arrived.promise;
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(bReads).toBe(0);
    expect(bPublications).toBe(0);
  } finally {
    enabled = false;
    release.resolve();
  }
  expect((await winner).statusCode).toBe(200);
  const response = await loser;
  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ code: "PROJECT_MISMATCH" });
  expect(bPublications).toBe(0);
  expect(await readFile(f.path(1))).toEqual(beforeB);
});
