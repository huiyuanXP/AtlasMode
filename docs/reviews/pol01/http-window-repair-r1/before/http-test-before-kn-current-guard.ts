import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createPortReservation } from "node:net";
import { WorkspaceService } from "@codemap/service";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
import { SourceIndexer } from "@codemap/indexer";
import type { IndexerPort, StructureFilePort } from "@codemap/core";
import { createServer } from "./server.js";
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const text = (purpose = "old") =>
  JSON.stringify({
    schemaVersion: 1,
    folders: [{ path: "src", purpose, unknown: [1, null] }],
    dependencyRules: [],
  });
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "atlas-pol01-http-")),
    database = join(root, "atlasmode.sqlite");
  await mkdir(join(root, ".codemap"));
  await writeFile(join(root, ".codemap", "structure.json"), text());
  await writeFile(
    join(root, "main.ts"),
    "export function owned() { return 1; }\n",
  );
  const storage = new SqliteStorage(database);
  cleanups.push(() => storage.close());
  const files = new StructureFileStore(),
    make = (
      db = storage,
      port: StructureFilePort = files,
      indexer: IndexerPort = new SourceIndexer(),
    ) => new WorkspaceService({ storage: db, indexer, structureFiles: port });
  const service = make(),
    project = await service.openProject(root),
    app = await createServer({ service });
  cleanups.push(() => app.close());
  const base = `/api/projects/${project.id}`,
    path = join(root, ".codemap", "structure.json");
  return {
    root,
    database,
    storage,
    files,
    make,
    service,
    project,
    app,
    base,
    path,
  };
}
async function request(
  f: Awaited<ReturnType<typeof fixture>>,
  purpose = "new",
) {
  const state = await f.service.getStructure(f.project.id);
  return {
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: state.fileDigest,
    operation: {
      kind: "upsertFolder" as const,
      previousPath: "src",
      path: "src",
      purpose,
    },
  };
}
test("HTTP real file write, array/meta policies, stale CAS and invalid diagnostics use one service boundary", async () => {
  const f = await fixture(),
    original = await readFile(f.path);
  const plan = f.service.createPlan({
    projectId: f.project.id,
    title: "owned",
  }).plan;
  const approved = await f.service.approvePlan(plan.id, plan.revision),
    body = await request(f);
  expect(
    (await f.app.inject({ method: "GET", url: `${f.base}/structure` }))
      .statusCode,
  ).toBe(200);
  const saved = await f.app.inject({
    method: "PUT",
    url: `${f.base}/structure`,
    payload: body,
  });
  expect(saved.statusCode).toBe(200);
  expect(saved.json().document.folders[0]).toMatchObject({
    purpose: "new",
    unknown: [1, null],
  });
  expect(f.service.getPlan(plan.id)).toMatchObject({
    valid: false,
    plan: { revision: 2 },
    approval: approved.approval,
  });
  expect(
    (await f.app.inject({ method: "GET", url: `${f.base}/policies` })).json(),
  ).toEqual(expect.any(Array));
  expect(
    (
      await f.app.inject({
        method: "GET",
        url: `${f.base}/policies?includeStructure=1`,
      })
    ).json(),
  ).toMatchObject({
    structureRevision: saved.json().structureRevision,
    fileDigest: saved.json().fileDigest,
    status: "ready",
  });
  const stale = await f.app.inject({
    method: "PUT",
    url: `${f.base}/structure`,
    payload: { ...body, mutationId: randomUUID() },
  });
  expect(stale.statusCode).toBe(409);
  const actual = await readFile(f.path);
  expect(Buffer.compare(actual, original)).not.toBe(0);
  await writeFile(f.path, "invalid");
  expect(
    (await f.app.inject({ method: "GET", url: `${f.base}/policies` }))
      .statusCode,
  ).toBe(422);
  const invalid = await f.app.inject({
    method: "PUT",
    url: `${f.base}/structure`,
    payload: await request(f),
  });
  expect(invalid.statusCode).toBe(422);
  expect(invalid.json().diagnostics[0].pointer).toBeTypeOf("string");
  expect(await readFile(f.path, "utf8")).toBe("invalid");
});
test("old policy POST requires explicit CAS, preserves DB source until preview plus migration, then edits file", async () => {
  const f = await fixture(),
    policy = {
      id: "legacy",
      projectId: f.project.id,
      pathPrefix: "src",
      purpose: "old DB",
      forbiddenDependencies: ["private"],
    };
  f.storage.put("policies", policy.id, policy);
  const original = await readFile(f.path);
  const fields = {
    id: policy.id,
    pathPrefix: "src",
    purpose: "DB edit",
    forbiddenDependencies: ["private"],
  };
  expect(
    (
      await f.app.inject({
        method: "POST",
        url: `${f.base}/policies`,
        payload: fields,
      })
    ).statusCode,
  ).toBe(428);
  const state = await f.service.getStructure(f.project.id);
  expect(
    (
      await f.app.inject({
        method: "POST",
        url: `${f.base}/policies`,
        payload: {
          ...fields,
          mutationId: randomUUID(),
          expectedStructureRevision: state.structureRevision,
          expectedFileDigest: state.fileDigest,
        },
      })
    ).json(),
  ).toMatchObject({ id: policy.id, purpose: "DB edit" });
  expect(Buffer.compare(await readFile(f.path), original)).toBe(0);
  expect(f.storage.get("policies", policy.id)).toMatchObject({
    purpose: "DB edit",
  });
  const preview = (
    await f.app.inject({
      method: "GET",
      url: `${f.base}/structure/legacy-preview`,
    })
  ).json();
  expect(preview.policies).toMatchObject([
    { id: policy.id, purpose: "DB edit" },
  ]);
  expect(Buffer.compare(await readFile(f.path), original)).toBe(0);
  const migrated = await f.app.inject({
    method: "PUT",
    url: `${f.base}/structure`,
    payload: {
      mutationId: randomUUID(),
      expectedStructureRevision: preview.structureRevision,
      expectedFileDigest: preview.fileDigest,
      operation: { kind: "importLegacy" },
    },
  });
  expect(migrated.statusCode).toBe(200);
  expect(f.storage.get("policies", policy.id)).toBeUndefined();
  const latest = migrated.json();
  expect(
    (
      await f.app.inject({
        method: "POST",
        url: `${f.base}/policies`,
        payload: {
          ...fields,
          purpose: "file edit",
          mutationId: randomUUID(),
          expectedStructureRevision: latest.structureRevision,
          expectedFileDigest: latest.fileDigest,
        },
      })
    ).json(),
  ).toMatchObject({ id: policy.id, purpose: "file edit" });
  expect(
    JSON.parse(await readFile(f.path, "utf8"))["x-atlasmode"]
      .legacyPathPolicies[0].purpose,
  ).toBe("file edit");
});
test.each(["prepared", "published"])(
  "actual Workspace approval/current-read queue blocks %s structure write",
  async (phase) => {
    const f = await fixture(),
      entered = gate(),
      release = gate();
    const port: StructureFilePort = {
      read: (root) => f.files.read(root),
      publish: async (root, value) => {
        if (phase === "prepared") {
          entered.resolve();
          await release.promise;
        }
        const result = await f.files.publish(root, value);
        if (phase === "published") {
          entered.resolve();
          await release.promise;
        }
        return result;
      },
    };
    let indexCalls = 0;
    const source = new SourceIndexer();
    const indexer: IndexerPort = {
      index: (...args) => {
        indexCalls += 1;
        return source.index(...args);
      },
    };
    const service = f.make(f.storage, port, indexer),
      plan = service.createPlan({
        projectId: f.project.id,
        title: "barrier",
      }).plan;
    await service.approvePlan(plan.id, 1);
    const writing = service.updateStructure(f.project.id, await request(f));
    void writing.catch(() => entered.resolve());
    await entered.promise;
    let settled = false,
      currentSettled = false;
    const beforeIndexCalls = indexCalls;
    const approving = service.approvePlan(plan.id, 1),
      current = service.getCurrentApproval(plan.id);
    void approving.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    void current.then(
      () => {
        currentSettled = true;
      },
      () => {
        currentSettled = true;
      },
    );
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(currentSettled).toBe(false);
    expect(indexCalls).toBe(beforeIndexCalls);
    release.resolve();
    await writing;
    await expect(approving).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
    });
    expect(await current).toMatchObject({
      valid: false,
      plan: { revision: 2 },
      approval: { revision: 1 },
    });
    expect(f.storage.list("approvals")).toHaveLength(1);
  },
);
test.each(["before", "after", "third", "unknown"])(
  "owned process crash %s recovers before HTTP availability without touching user files",
  async (phase) => {
    const f = await fixture(),
      plan = f.service.createPlan({
        projectId: f.project.id,
        title: "crash",
      }).plan;
    await f.service.approvePlan(plan.id, 1);
    await f.app.close();
    f.storage.close();
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "tests/support/pol01-crash.ts",
        f.root,
        f.database,
        f.project.id,
        phase === "unknown" ? "after" : phase,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: "/tmp/atlasmode-pol01-runtime-tsconfig.json",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let errors = "";
    child.stderr.on("data", (data) => {
      errors += String(data);
    });
    const [code, signal] = await once(child, "exit");
    expect({ code, signal, errors }).toEqual({
      code: null,
      signal: "SIGKILL",
      errors: "",
    });
    const reopened = new SqliteStorage(f.database);
    cleanups.push(() => reopened.close());
    let unreadable = phase === "unknown";
    const unavailable: StructureFilePort = {
      read: (root) => {
        if (unreadable) throw new Error("startup-read-io-fault");
        return f.files.read(root);
      },
      publish: (root, input) => f.files.publish(root, input),
    };
    const service = f.make(reopened, unavailable);
    const recovery = await service.recoverStructureWrites();
    expect(recovery).toMatchObject(
      phase === "third" || phase === "unknown"
        ? { blockedProjectIds: [f.project.id] }
        : { recoveredProjectIds: [f.project.id], blockedProjectIds: [] },
    );
    const app = await createServer({ service });
    cleanups.push(() => app.close());
    const response = await app.inject({
      method: "GET",
      url: `/api/plans/${plan.id}/approved`,
    });
    if (phase === "unknown") {
      expect(response.statusCode).toBe(503);
      expect(await readFile(f.path, "utf8")).toContain("candidate B");
      unreadable = false;
      expect(await service.recoverStructureWrites()).toMatchObject({
        recoveredProjectIds: [f.project.id],
        blockedProjectIds: [],
      });
      expect(
        (
          await app.inject({
            method: "GET",
            url: `/api/plans/${plan.id}/approved`,
          })
        ).json(),
      ).toMatchObject({
        valid: false,
        plan: { revision: 2 },
        approval: { revision: 1 },
      });
    } else if (phase === "third") {
      expect(response.statusCode).toBe(409);
      expect(await readFile(f.path, "utf8")).toContain("external C");
    } else {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        valid: phase === "before",
        plan: { revision: phase === "before" ? 1 : 2 },
        approval: { revision: 1 },
      });
    }
    expect(reopened.list("approvals")).toHaveLength(1);
    await service.recoverStructureWrites();
    expect(reopened.get("plans", plan.id)).toMatchObject({
      revision: phase === "after" || phase === "unknown" ? 2 : 1,
    });
  },
);

test("HTTP published-file finalize failure blocks policies/approval then atomically recovers once", async () => {
  const f = await fixture(),
    plan = f.service.createPlan({
      projectId: f.project.id,
      title: "DB fault",
    }).plan;
  await f.service.approvePlan(plan.id, 1);
  let fault = true;
  const storage = new Proxy(f.storage, {
    get(target, key) {
      if (key === "put")
        return (kind: string, id: string, value: unknown) => {
          if (fault && kind === "settings" && id.startsWith("structure:state:"))
            throw new Error("injected-database-finalize");
          return target.put(kind as "settings", id, value);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const service = f.make(storage),
    app = await createServer({ service });
  cleanups.push(() => app.close());
  const body = await request(f),
    original = await readFile(f.path);
  expect(
    (
      await app.inject({
        method: "PUT",
        url: `${f.base}/structure`,
        payload: body,
      })
    ).statusCode,
  ).toBe(503);
  expect(Buffer.compare(await readFile(f.path), original)).not.toBe(0);
  expect(f.storage.get("plans", plan.id)).toMatchObject({ revision: 1 });
  expect(f.storage.list("policies")).toEqual([]);
  expect(
    (await app.inject({ method: "GET", url: `${f.base}/policies` })).statusCode,
  ).toBe(503);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/api/plans/${plan.id}/approve`,
        payload: { expectedRevision: 1 },
      })
    ).statusCode,
  ).toBe(503);
  fault = false;
  expect(await service.recoverStructureWrites()).toMatchObject({
    recoveredProjectIds: [f.project.id],
    blockedProjectIds: [],
  });
  const policies = (
    await app.inject({
      method: "GET",
      url: `${f.base}/policies?includeStructure=1`,
    })
  ).json();
  expect(policies.policies[0]).toMatchObject({ purpose: "new" });
  expect(policies.fileDigest).toBe((await f.files.read(f.root)).digest);
  expect(
    service
      .listStructureAudit(f.project.id, { offset: 0, limit: 50 })
      .items.find((a) => a.id === body.mutationId),
  ).toMatchObject({
    outcome: "committed",
    observedAfterDigest: policies.fileDigest,
    recoveredAt: expect.any(String),
  });
  await service.recoverStructureWrites();
  expect(f.storage.get("plans", plan.id)).toMatchObject({ revision: 2 });
  expect(f.storage.list("approvals")).toHaveLength(1);
});

test("actual source entrypoint recovers published intent before it listens", async () => {
  const f = await fixture();
  const plan = f.service.createPlan({
    projectId: f.project.id,
    title: "entrypoint",
  }).plan;
  await f.service.approvePlan(plan.id, 1);
  await f.app.close();
  f.storage.close();
  const env = {
    ...process.env,
    TSX_TSCONFIG_PATH: "/tmp/atlasmode-pol01-runtime-tsconfig.json",
  };
  const crashed = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "tests/support/pol01-crash.ts",
      f.root,
      f.database,
      f.project.id,
      "after",
    ],
    { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let crashErrors = "";
  crashed.stderr.on("data", (value) => {
    crashErrors += String(value);
  });
  expect(await once(crashed, "exit")).toEqual([null, "SIGKILL"]);
  expect(crashErrors).toBe("");
  const reservation = createPortReservation().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string")
    throw new Error("owned-port-unavailable");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "apps/server/src/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...env,
        CODEMAP_DATA_DIR: f.root,
        CODEMAP_PORT: String(port),
        CODEMAP_WORKSPACE_ROOT: "",
        CODEMAP_DEV_PROXY: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit"),
    ready = gate();
  let output = "";
  child.stdout.on("data", (value) => {
    output += String(value);
    if (output.includes("AtlasMode API listening")) ready.resolve();
  });
  child.stderr.on("data", (value) => {
    output += String(value);
  });
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        ready.promise,
        exited.then(() => {
          throw new Error(`source-entrypoint-exited:${output}`);
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`source-entrypoint-timeout:${output}`)),
            12000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    const base = `http://127.0.0.1:${port}`;
    const structureResponse = await fetch(`${base}${f.base}/structure`);
    expect(structureResponse.status).toBe(200);
    expect(await structureResponse.json()).toMatchObject({
      status: "ready",
      document: { folders: [{ purpose: "candidate B" }] },
    });
    const planResponse = await fetch(`${base}/api/plans/${plan.id}`);
    expect(planResponse.status).toBe(200);
    expect(await planResponse.json()).toMatchObject({
      valid: false,
      plan: { revision: 2 },
      approval: { revision: 1 },
    });
    const audits = await (
      await fetch(`${base}${f.base}/structure/audit`)
    ).json();
    expect(audits.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: "committed",
          recoveredAt: expect.any(String),
        }),
      ]),
    );
    expect(await readFile(f.path, "utf8")).toContain("candidate B");
    child.kill("SIGTERM");
    expect(await exited).toEqual([0, null]);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
  }
});
