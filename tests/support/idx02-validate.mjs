import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  access,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { SqliteStorage } from "@codemap/storage";
import { SourceIndexer } from "@codemap/indexer";
import {
  startProduction,
  connectMcp,
  http,
  denyExternalRequests,
} from "./production.mjs";

const out = resolve("docs/superpowers/reviews/idx02-2026-10-10");
await mkdir(out, { recursive: true });
const target = await mkdtemp(join(tmpdir(), "atlasmode-idx02-fixture-"));
const otherTarget = await mkdtemp(join(tmpdir(), "atlasmode-idx02-isolated-"));
const runtime = await mkdtemp(join(tmpdir(), "atlasmode-idx02-runtime-"));
const marker = join(target, "TARGET_EXECUTED");
const rootPackage = {
  private: true,
  type: "module",
  workspaces: ["packages/*"],
};
const libPackage = {
  name: "@idx02/lib",
  type: "module",
  exports: {
    ".": { import: "./src/main.ts", require: "./src/main.cjs" },
    "./stable": { custom: "./src/main.ts", default: "./src/main.ts" },
    "./uncertain": { custom: "./src/other.ts", default: "./src/main.ts" },
    "./blocked": null,
    "./*": "./src/*.ts",
  },
};
const inputs = {
  "package.json": JSON.stringify(rootPackage, null, 2),
  "packages/app/package.json": JSON.stringify({
    name: "@idx02/app",
    type: "module",
  }),
  "packages/lib/package.json": JSON.stringify(libPackage, null, 2),
  "packages/app/entry.ts":
    'import { helper } from "@idx02/lib";\nexport function entry() { return helper(); }\n',
  "packages/app/stable.ts":
    'import { helper } from "@idx02/lib/stable";\nexport function stable() { return helper(); }\n',
  "packages/app/uncertain.ts":
    'import { helper } from "@idx02/lib/uncertain";\nexport function uncertain() { return helper(); }\n',
  "packages/app/blocked.ts":
    'import { helper } from "@idx02/lib/blocked";\nexport function blocked() { return helper(); }\n',
  "packages/app/type.ts":
    'import type * as lib from "@idx02/lib";\nexport function typeOnly() { return lib.helper(); }\n',
  "packages/app/entry.cjs":
    'const {helper} = require("@idx02/lib");\nfunction requireEntry(){ return helper(); }\nexports.requireEntry = requireEntry;\n',
  "packages/lib/src/main.ts": 'export function helper() { return "main"; }\n',
  "packages/lib/src/other.ts": 'export function helper() { return "other"; }\n',
  "packages/lib/src/main.cjs":
    'function helper() { return "require"; }\nexports.helper = helper;\n',
  "never-execute.ts":
    'import {writeFileSync} from "node:fs";\nwriteFileSync(' +
    JSON.stringify(marker) +
    ', "executed");\nthrow new Error("Target source must never execute");\n',
};
for (const dir of [target, otherTarget])
  for (const [file, bytes] of Object.entries(inputs)) {
    await mkdir(join(dir, file, ".."), { recursive: true });
    await writeFile(join(dir, file), bytes);
  }
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const save = (file, value) =>
  writeFile(join(out, file), JSON.stringify(value, null, 2));
await save("fixture-source.json", {
  target,
  otherTarget,
  inputs,
  sha256: Object.fromEntries(
    Object.entries(inputs).map(([f, b]) => [f, hash(b)]),
  ),
});
let server, mcp, browser, page;
const errors = [],
  external = [],
  protocolErrors = [];
const observations = {
  status: "pending",
  target,
  otherTarget,
  scope:
    "Actual built HTTP/MCP/Chromium; only captured source is analyzed; target modules and scripts never execute.",
};
try {
  server = await startProduction(join(runtime, "data"));
  const api = (path, method = "GET", body) =>
    http(server.url, path, method, body);
  mcp = await connectMcp(server.url);
  mcp.client.onerror = (e) => protocolErrors.push(String(e));
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  await denyExternalRequests(context, external);
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(server.url);
  if (await page.locator(".welcome").count())
    await page
      .locator(".welcome")
      .getByRole("button", { name: "选择本地项目", exact: true })
      .click();
  await page.getByRole("textbox", { name: "本地项目路径" }).fill(target);
  const opened = page.waitForResponse(
    (r) => r.url().endsWith("/api/projects") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "打开并索引", exact: true }).click();
  const response = await opened;
  assert.equal(response.ok(), true);
  const project = await response.json(),
    base = "/api/projects/" + project.id,
    args = { projectId: project.id };
  await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  const original = await api(base + "/snapshot");
  const node = (snapshot, name, file) => {
    const found = snapshot.nodes.find(
      (n) => n.kind === "function" && n.name === name && n.filePath === file,
    );
    assert.ok(found, file + ":" + name);
    return found;
  };
  const entry = node(original, "entry", "packages/app/entry.ts"),
    leaf = node(original, "helper", "packages/lib/src/main.ts"),
    alternate = node(original, "helper", "packages/lib/src/other.ts");
  const functionContext = async (n) => {
    const value = await api(base + "/functions/" + n.id);
    assert.deepEqual(
      await mcp.call("get_function_context", {
        ...args,
        nodeId: n.id,
        limit: 50,
      }),
      value,
    );
    return value;
  };
  const context0 = await functionContext(entry);
  assert.equal(context0.totalOutgoing, 1);
  assert.equal(context0.outgoing[0].targetId, leaf.id);
  assert.equal(context0.outgoing[0].resolution, "resolved");
  assert.equal(
    (await functionContext(node(original, "stable", "packages/app/stable.ts")))
      .outgoing[0].targetId,
    leaf.id,
  );
  const requireLeaf = node(original, "helper", "packages/lib/src/main.cjs");
  assert.equal(
    (
      await functionContext(
        node(original, "requireEntry", "packages/app/entry.cjs"),
      )
    ).outgoing[0].targetId,
    requireLeaf.id,
  );
  for (const [name, file] of [
    ["uncertain", "packages/app/uncertain.ts"],
    ["blocked", "packages/app/blocked.ts"],
    ["typeOnly", "packages/app/type.ts"],
  ]) {
    const ctx = await functionContext(node(original, name, file));
    assert.equal(ctx.outgoing[0].targetId, null);
    assert.equal(ctx.outgoing[0].resolution, "unresolved");
  }
  const sources = {};
  for (const [file, bytes] of Object.entries(inputs))
    if (/\.(?:ts|cjs)$/.test(file)) {
      const source = await api(
        base + "/source?filePath=" + encodeURIComponent(file),
      );
      assert.equal(source.content, bytes);
      sources[file] = source;
    }
  const summary = await api(base + "/summary");
  assert.deepEqual(await mcp.call("get_project_summary", args), summary);
  async function show(name, file) {
    await page.getByRole("textbox", { name: "Search functions" }).fill(name);
    const searched = page.waitForResponse((r) =>
      r.url().includes("/functions?"),
    );
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await searched;
    const selected = page
      .locator(".navigation .compact-search .node-list button")
      .filter({ has: page.getByText("ƒ " + name, { exact: true }) })
      .filter({ has: page.getByText(file, { exact: true }) });
    await selected.last().click();
    const tab = page
      .locator(".inspector .tabs")
      .getByRole("button", { name: "View source", exact: true });
    if (await tab.count()) await tab.click();
    await expect(page.getByTestId("source-snippet")).toContainText(name);
  }
  await show("entry", "packages/app/entry.ts");
  await page
    .getByRole("button", { name: "Expand one level", exact: true })
    .click();
  await expect(
    page.locator('.react-flow__node[data-id="fact:' + leaf.id + '"]'),
  ).toBeVisible();
  await page.screenshot({
    path: join(out, "workspace-before.png"),
    fullPage: true,
  });
  const plan = await mcp.call("propose_plan", {
    ...args,
    baselineSnapshotId: original.id,
    title: "IDX02 configured workspace reuse",
    operations: [
      {
        kind: "add_relation",
        id: "reuse",
        sourceId: entry.id,
        targetId: leaf.id,
        type: "must_reuse",
      },
    ],
  });
  const approved = await api(
    "/api/plans/" + plan.plan.id + "/approve",
    "POST",
    { expectedRevision: plan.plan.revision },
  );
  assert.equal(approved.valid, true);
  const route = await mcp.call("propose_route", {
    ...args,
    snapshotId: original.id,
    title: "Workspace actual leaf",
    description: "IDX02 作者原文",
    kind: "call_chain",
    steps: [
      { nodeId: entry.id, note: "entry" },
      {
        nodeId: leaf.id,
        note: "captured source",
        relationId: context0.outgoing[0].id,
      },
    ],
  });
  assert.equal((await mcp.call("get_routes", args)).items[0].stale, false);
  const changedLib = {
    ...libPackage,
    exports: {
      ...libPackage.exports,
      ".": { import: "./src/other.ts", require: "./src/main.cjs" },
    },
  };
  await writeFile(
    join(target, "packages/lib/package.json"),
    JSON.stringify(changedLib, null, 2),
  );
  await mcp.call("refresh_index", args);
  const afterExports = await api(base + "/snapshot");
  assert.notEqual(afterExports.id, original.id);
  assert.notEqual(afterExports.contentHash, original.contentHash);
  const context1 = await functionContext(entry);
  assert.equal(context1.outgoing[0].targetId, alternate.id);
  assert.deepEqual(
    afterExports.nodes
      .filter((n) => n.kind === "function")
      .map((n) => n.id)
      .sort(),
    original.nodes
      .filter((n) => n.kind === "function")
      .map((n) => n.id)
      .sort(),
  );
  const stale = await api("/api/plans/" + plan.plan.id);
  assert.deepEqual(
    await mcp.call("get_approved_plan", { ...args, planId: plan.plan.id }),
    stale,
  );
  assert.equal(stale.valid, false);
  assert.equal(stale.plan.status, "stale");
  assert.deepEqual(stale.approval, approved.approval);
  assert.deepEqual(stale.plan.operations, approved.plan.operations);
  assert.deepEqual(await api(base + "/routes"), [route]);
  assert.equal((await mcp.call("get_routes", args)).items[0].stale, true);
  await page.reload();
  await show("helper", "packages/lib/src/other.ts");
  await expect(page.getByTestId("source-snippet")).toContainText('"other"');
  await page.screenshot({
    path: join(out, "workspace-after-exports.png"),
    fullPage: true,
  });
  const changedRoot = { ...rootPackage, workspaces: ["packages/lib"] };
  await writeFile(
    join(target, "package.json"),
    JSON.stringify(changedRoot, null, 2),
  );
  await mcp.call("refresh_index", args);
  const afterWorkspaces = await api(base + "/snapshot"),
    context2 = await functionContext(entry);
  assert.notEqual(afterWorkspaces.id, afterExports.id);
  assert.notEqual(afterWorkspaces.contentHash, afterExports.contentHash);
  assert.equal(context2.outgoing[0].targetId, null);
  assert.equal(context2.outgoing[0].resolution, "unresolved");
  for (const [file, bytes] of Object.entries(inputs))
    if (file !== "package.json" && file !== "packages/lib/package.json")
      assert.equal(await readFile(join(target, file), "utf8"), bytes);
  const isolated = await api("/api/projects", "POST", { path: otherTarget }),
    isolatedBase = "/api/projects/" + isolated.id;
  const isolatedSnapshot = await api(isolatedBase + "/snapshot");
  const isolatedEntry = node(
      isolatedSnapshot,
      "entry",
      "packages/app/entry.ts",
    ),
    isolatedLeaf = node(isolatedSnapshot, "helper", "packages/lib/src/main.ts");
  assert.notEqual(isolatedEntry.id, entry.id);
  assert.notEqual(isolatedLeaf.id, leaf.id);
  const isolatedContext = await mcp.call("get_function_context", {
    projectId: isolated.id,
    nodeId: isolatedEntry.id,
  });
  assert.equal(isolatedContext.outgoing[0].targetId, isolatedLeaf.id);
  const cross = await mcp.client.callTool({
    name: "get_function_context",
    arguments: { projectId: isolated.id, nodeId: entry.id },
  });
  assert.equal(cross.isError, true);
  const wrong = await fetch(
    server.url + isolatedBase + "/functions/" + entry.id,
  );
  assert.equal(wrong.status, 404);
  await assert.rejects(access(marker));
  await mcp.client.close();
  await server.stop();
  const store = new SqliteStorage(join(runtime, "data", "atlasmode.sqlite"));
  let history;
  try {
    for (const snap of [original, afterExports, afterWorkspaces])
      assert.deepEqual(store.get("snapshots", snap.id), snap);
    assert.deepEqual(store.list("approvals"), [approved.approval]);
    assert.deepEqual(store.get("routes", route.id), route);
    history = {
      snapshotIds: [original.id, afterExports.id, afterWorkspaces.id],
      immutableSnapshots: true,
      approvalUnchanged: true,
      routeUnchanged: true,
    };
  } finally {
    store.close();
  }
  server = await startProduction(join(runtime, "data"));
  mcp = await connectMcp(server.url);
  mcp.client.onerror = (e) => protocolErrors.push(String(e));
  assert.deepEqual(await api(base + "/snapshot"), afterWorkspaces);
  assert.deepEqual(
    await mcp.call("get_function_context", {
      ...args,
      nodeId: entry.id,
      limit: 50,
    }),
    context2,
  );
  assert.deepEqual(
    await mcp.call("get_approved_plan", { ...args, planId: plan.plan.id }),
    stale,
  );
  assert.equal((await mcp.call("get_routes", args)).items[0].stale, true);
  history.restartConfirmed = true;
  const actual = await new SourceIndexer().index(
    resolve("."),
    "idx02-readonly-atlasmode",
  );
  const workspaceDiagnostics = actual.diagnostics.filter(
    (d) =>
      d.message.startsWith("WORKSPACE_MAPPING_UNAVAILABLE:") &&
      d.message.includes("@codemap/"),
  );
  assert.ok(workspaceDiagnostics.length > 0);
  assert.ok(
    workspaceDiagnostics.some((d) =>
      d.message.includes("exact captured implementation"),
    ),
  );
  await save("atlasmode-readonly.json", {
    status: "captured",
    path: resolve("."),
    id: actual.id,
    contentHash: actual.contentHash,
    coverage: actual.coverage,
    workspaceDiagnostics,
    scope:
      "No dist-to-src inference: existing package exports name excluded dist. This remains unknown, not a successful source mapping.",
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  assert.deepEqual(protocolErrors, []);
  assert.equal(mcp.stderr(), "");
  await assert.rejects(access(marker));
  Object.assign(observations, {
    status: "passed",
    observedAt: new Date().toISOString(),
    project,
    summary,
    original,
    afterExports,
    afterWorkspaces,
    contexts: [context0, context1, context2],
    sources,
    approved,
    stale,
    route,
    history,
    isolated: {
      project: isolated,
      entry: isolatedEntry,
      leaf: isolatedLeaf,
      context: isolatedContext,
      crossProjectMcp: cross,
      httpStatus: wrong.status,
    },
    changedManifests: { exports: changedLib, workspaces: changedRoot },
    targetNeverExecuted: true,
    errors,
    external,
    protocolErrors,
  });
  await save("workspace-product.json", observations);
  console.log(
    JSON.stringify({
      status: observations.status,
      counts: summary.counts,
      snapshots: history.snapshotIds,
      history,
      sourceFiles: Object.keys(sources).length,
      atlasmodeWorkspaceUnknowns: workspaceDiagnostics.length,
      errors,
      external,
      protocolErrors,
    }),
  );
} catch (error) {
  Object.assign(observations, {
    status: "failed",
    error: String(error),
    errors,
    external,
    protocolErrors,
  });
  await save("workspace-product-fail.json", observations);
  throw error;
} finally {
  await browser?.close();
  await mcp?.client.close();
  await server?.stop();
  await rm(runtime, { recursive: true, force: true });
}
