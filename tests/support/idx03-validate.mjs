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

const out = resolve("docs/superpowers/reviews/idx03-2026-10-10");
await mkdir(out, { recursive: true });
const target = await mkdtemp(join(tmpdir(), "atlasmode-idx03-fixture-"));
const otherTarget = await mkdtemp(join(tmpdir(), "atlasmode-idx03-isolated-"));
const runtime = await mkdtemp(join(tmpdir(), "atlasmode-idx03-runtime-"));
const marker = join(target, "TARGET_EXECUTED");
const rootConfiguration = {
  files: [],
  references: [
    { path: "./configs/app.json" },
    { path: "./configs/bulk.json" },
    { path: "./configs/mutator.json" },
    { path: "./missing" },
  ],
};
const appConfiguration = {
  compilerOptions: {
    composite: true,
    allowJs: true,
    baseUrl: "../lib",
    paths: { "@leaf": ["main.ts"] },
  },
  include: ["../app"],
  references: [{ path: "./lib.json" }, { path: "./cjslib.json" }],
};
const inputs = {
  "tsconfig.json": JSON.stringify(rootConfiguration, null, 2),
  "configs/app.json": JSON.stringify(appConfiguration, null, 2),
  "configs/lib.json": JSON.stringify(
    { compilerOptions: { composite: true }, include: ["../lib"] },
    null,
    2,
  ),
  "configs/bulk.json": JSON.stringify(
    { compilerOptions: { composite: true }, include: ["../bulk"] },
    null,
    2,
  ),
  "configs/cjslib.json": JSON.stringify(
    {
      compilerOptions: { composite: true, allowJs: true },
      include: ["../cjslib"],
    },
    null,
    2,
  ),
  "configs/mutator.json": JSON.stringify(
    {
      compilerOptions: { composite: true, allowJs: true },
      include: ["../mutator"],
    },
    null,
    2,
  ),
  "app/cjs-entry.cjs":
    'const {helper}=require("../cjslib/main.cjs"); function cjsEntry(){helper();} exports.cjsEntry=cjsEntry;',
  "cjslib/main.cjs": "function helper(){} exports.helper=helper;",
  "mutator/change.cjs":
    'const mod=require("../cjslib/main.cjs"); mod.helper=()=>9;',
  "app/entry.ts":
    'import {helper} from "@leaf";\nexport function entry(){ return helper(); }\n',
  "app/no-import.ts": "export function noImport(){ return helper(); }\n",
  "app/side-effect.ts":
    'import "../lib/global.js";\nexport function sideEffect(){ return helper(); }\n',
  "lib/global.ts": 'function helper(){ return "global"; }\n',
  "lib/main.ts": 'export function helper(){ return "main"; }\n',
  "lib/other.ts": 'export function helper(){ return "other"; }\n',
  ...Object.fromEntries(
    Array.from({ length: 56 }, (_, i) => [
      `bulk/file${String(i).padStart(3, "0")}.ts`,
      `export function item${i}(){return ${i};}\n`,
    ]),
  ),
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
  const entry = node(original, "entry", "app/entry.ts"),
    leaf = node(original, "helper", "lib/main.ts"),
    alternate = node(original, "helper", "lib/other.ts");
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
  const negativeContexts = {};
  for (const [name, file] of [
    ["noImport", "app/no-import.ts"],
    ["sideEffect", "app/side-effect.ts"],
    ["cjsEntry", "app/cjs-entry.cjs"],
  ]) {
    const ctx = await functionContext(node(original, name, file));
    negativeContexts[name] = ctx;
    assert.equal(ctx.outgoing[0].targetId, null);
    assert.equal(ctx.outgoing[0].resolution, "unresolved");
  }
  const graph0 = original.coverage.configurationProjectGraph;
  assert.equal(graph0.status, "partial");
  assert.equal(graph0.counts.sourceScopes, 66);
  assert.equal(graph0.counts.resolved, 65);
  assert.equal(graph0.counts.unconfigured, 1);
  assert.equal(graph0.scopes.length, 50);
  assert.equal(graph0.truncated.scopes, true);
  assert.ok(
    graph0.projects.some(
      (p) => p.configPath === "configs/app.json" && p.status === "resolved",
    ),
  );
  assert.ok(
    graph0.references.some(
      (e) =>
        e.targetConfigPath === "missing/tsconfig.json" &&
        e.status === "unavailable",
    ),
  );
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
  await show("entry", "app/entry.ts");
  await page
    .getByRole("button", { name: "Expand one level", exact: true })
    .click();
  await expect(
    page.locator('.react-flow__node[data-id="fact:' + leaf.id + '"]'),
  ).toBeVisible();
  await page.screenshot({
    path: join(out, "references-before.png"),
    fullPage: true,
  });
  async function showProjectGraph(snapshot) {
    const graph = snapshot.coverage.configurationProjectGraph;
    const advanced = page.getByRole("button", {
      name: "Advanced controls",
      exact: true,
    });
    if ((await advanced.getAttribute("aria-expanded")) !== "true")
      await advanced.click();
    const diagnostics = page.locator(".advanced-navigation-content > details");
    if ((await diagnostics.getAttribute("open")) === null)
      await diagnostics.locator(":scope > summary").click();
    const panel = page.getByTestId("configuration-project-graph");
    if ((await panel.getAttribute("open")) === null)
      await panel.locator(":scope > summary").click();
    await expect(panel).toContainText("Partial captured graph");
    await expect(panel).toContainText(
      "Source scopes: " + graph.counts.sourceScopes,
    );
    const refs = panel
      .locator("details")
      .filter({
        has: page.getByText(
          "Project references (" +
            graph.references.length +
            "/" +
            graph.counts.observedReferences +
            ")",
          { exact: true },
        ),
      });
    if ((await refs.getAttribute("open")) === null)
      await refs.locator(":scope > summary").click();
    await expect(
      refs.getByText("missing/tsconfig.json", { exact: true }),
    ).toBeVisible();
    await expect(refs).toContainText("Unavailable");
    await expect(refs).toContainText("Reference configuration unavailable");
    const samples = panel
      .locator("details")
      .filter({
        has: page.getByText(
          "Source scope samples (" +
            graph.scopes.length +
            "/" +
            graph.counts.sourceScopes +
            ")",
          { exact: true },
        ),
      });
    if ((await samples.getAttribute("open")) === null)
      await samples.locator(":scope > summary").click();
    await expect(samples).toContainText(
      "omitted sources retain their recorded scope",
    );
    await expect(
      samples.getByText("app/entry.ts", { exact: true }),
    ).toBeVisible();
    await panel.scrollIntoViewIfNeeded();
  }
  await showProjectGraph(original);
  await page.screenshot({
    path: join(out, "references-graph-before.png"),
    fullPage: true,
  });
  const plan = await mcp.call("propose_plan", {
    ...args,
    baselineSnapshotId: original.id,
    title: "IDX03 configured workspace reuse",
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
    description: "IDX03 作者原文",
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
  const changedApp = {
    ...appConfiguration,
    compilerOptions: {
      ...appConfiguration.compilerOptions,
      paths: { "@leaf": ["other.ts"] },
    },
  };
  await writeFile(
    join(target, "configs/app.json"),
    JSON.stringify(changedApp, null, 2),
  );
  await mcp.call("refresh_index", args);
  const afterOptions = await api(base + "/snapshot");
  assert.notEqual(afterOptions.id, original.id);
  assert.notEqual(afterOptions.contentHash, original.contentHash);
  const context1 = await functionContext(entry);
  assert.equal(context1.outgoing[0].targetId, alternate.id);
  assert.deepEqual(
    afterOptions.nodes
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
  await show("helper", "lib/other.ts");
  await expect(page.getByTestId("source-snippet")).toContainText('"other"');
  await page.screenshot({
    path: join(out, "references-after-options.png"),
    fullPage: true,
  });
  await showProjectGraph(afterOptions);
  await page.screenshot({
    path: join(out, "references-graph-after-options.png"),
    fullPage: true,
  });
  const changedRoot = {
    ...rootConfiguration,
    references: [...rootConfiguration.references, { path: "../../outside" }],
  };
  await writeFile(
    join(target, "tsconfig.json"),
    JSON.stringify(changedRoot, null, 2),
  );
  await mcp.call("refresh_index", args);
  const afterReferences = await api(base + "/snapshot"),
    context2 = await functionContext(entry);
  assert.notEqual(afterReferences.id, afterOptions.id);
  assert.notEqual(afterReferences.contentHash, afterOptions.contentHash);
  assert.equal(context2.outgoing[0].targetId, alternate.id);
  assert.equal(context2.outgoing[0].resolution, "resolved");
  assert.equal(
    afterReferences.coverage.configurationProjectGraph.counts
      .observedReferences,
    graph0.counts.observedReferences + 1,
  );
  for (const [file, bytes] of Object.entries(inputs))
    if (file !== "tsconfig.json" && file !== "configs/app.json")
      assert.equal(await readFile(join(target, file), "utf8"), bytes);
  const isolated = await api("/api/projects", "POST", { path: otherTarget }),
    isolatedBase = "/api/projects/" + isolated.id;
  const isolatedSnapshot = await api(isolatedBase + "/snapshot");
  const isolatedEntry = node(isolatedSnapshot, "entry", "app/entry.ts"),
    isolatedLeaf = node(isolatedSnapshot, "helper", "lib/main.ts");
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
    for (const snap of [original, afterOptions, afterReferences])
      assert.deepEqual(store.get("snapshots", snap.id), snap);
    assert.deepEqual(store.list("approvals"), [approved.approval]);
    assert.deepEqual(store.get("routes", route.id), route);
    history = {
      snapshotIds: [original.id, afterOptions.id, afterReferences.id],
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
  assert.deepEqual(await api(base + "/snapshot"), afterReferences);
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
    "idx03-readonly-atlasmode",
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
    afterOptions,
    afterReferences,
    contexts: [context0, context1, context2],
    negativeContexts,
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
    changedConfigurations: { options: changedApp, references: changedRoot },
    targetNeverExecuted: true,
    errors,
    external,
    protocolErrors,
  });
  await save("references-product.json", observations);
  console.log(
    JSON.stringify({
      status: observations.status,
      counts: summary.counts,
      snapshots: history.snapshotIds,
      history,
      sourceFiles: Object.keys(sources).length,
      projectGraph: original.coverage.configurationProjectGraph,
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
  await save("references-product-fail.json", observations);
  throw error;
} finally {
  await browser?.close();
  await mcp?.client.close();
  await server?.stop();
  await rm(runtime, { recursive: true, force: true });
}
