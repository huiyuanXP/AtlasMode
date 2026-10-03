// Read-only product acceptance for an already checked out, fixed public target.
import assert from "node:assert/strict";
import { repositoryProvenance } from "./repository-provenance.mjs";
import { mkdtemp, mkdir, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, expect } from "@playwright/test";
import {
  startProduction,
  connectMcp,
  http,
  denyExternalRequests,
} from "../tests/support/production.mjs";
const { values } = parseArgs({
  options: {
    ...Object.fromEntries(
      ["path", "commit", "symbol", "file", "label"].map((key) => [
        key,
        { type: "string" },
      ]),
    ),
    "require-entry": { type: "boolean", default: false },
  },
});
for (const key of ["path", "commit", "symbol", "file", "label"])
  assert.ok(values[key], `Required --${key}`);
assert.match(values.label, /^[a-z0-9-]+$/);
const beforeCapture = repositoryProvenance(values.path, values.commit);
const { gitRevision } = beforeCapture;
const root = await mkdtemp(join(tmpdir(), "atlas-target-")),
  out = resolve("artifacts/validation");
await mkdir(out, { recursive: true });
let server, mcp, browser, page, failureCapture;
let entryCriterion = {
  requested: values["require-entry"],
  status: "not-requested",
};
const errors = [],
  external = [],
  protocolErrors = [];
try {
  server = await startProduction(join(root, "data"));
  mcp = await connectMcp(server.url);
  mcp.client.onerror = (error) => protocolErrors.push(String(error));
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await denyExternalRequests(context, external);
  await page.goto(server.url);
  await page.getByRole("textbox", { name: "本地项目路径" }).fill(values.path);
  const start = performance.now();
  const opened = page.waitForResponse(
    (r) => r.url().endsWith("/api/projects") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "打开并索引", exact: true }).click();
  const response = await opened;
  assert.equal(response.ok(), true);
  const project = await response.json();
  const openMilliseconds = Math.round(performance.now() - start);
  await page.getByRole("combobox", { name: "界面语言" }).selectOption("en");
  const args = { projectId: project.id };
  const summary = await mcp.call("get_project_summary", args);
  const httpSummary = await http(
    server.url,
    `/api/projects/${project.id}/summary`,
  );
  assert.deepEqual(summary, httpSummary);
  const search = await mcp.call("search_functions", {
    ...args,
    q: values.symbol,
    limit: 200,
  });
  const node = search.items.find(
    (n) => n.name === values.symbol && n.filePath === values.file,
  );
  assert.ok(node, "Expected real source sample");
  const contextResult = await mcp.call("get_function_context", {
    ...args,
    nodeId: node.id,
    limit: 5,
  });
  const bounded = await mcp.call("get_subgraph", {
    ...args,
    nodeIds: [node.id],
    budget: 1,
    depth: 2,
  });
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.nodes.length, 1);
  const graph = await mcp.call("get_subgraph", {
    ...args,
    nodeIds: [node.id],
    budget: 80,
    depth: 1,
  });
  assert.ok(graph.nodes.length <= 80);
  assert.ok(graph.relations.length <= 240);
  const source = await http(
    server.url,
    `/api/projects/${project.id}/source?filePath=${encodeURIComponent(values.file)}`,
  );
  assert.ok(source.content.includes(values.symbol));
  for (const relation of contextResult.outgoing) {
    const text = (
      await http(
        server.url,
        `/api/projects/${project.id}/source?filePath=${encodeURIComponent(relation.evidence.filePath)}`,
      )
    ).content;
    assert.ok(
      text.split(/\r?\n/)[relation.evidence.line - 1]?.trim(),
      "Evidence resolves to an actual source line",
    );
  }
  await page
    .getByRole("textbox", { name: "Search functions" })
    .fill(values.symbol);
  const initialSearch = page.waitForResponse((r) =>
    r.url().includes("/functions?"),
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await initialSearch;
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeEnabled();
  const result = page
    .locator(".navigation .node-list button")
    .filter({ has: page.getByText(`ƒ ${values.symbol}`, { exact: true }) })
    .filter({ has: page.getByText(values.file, { exact: true }) });
  for (
    let pageNumber = 0;
    !(await result.count()) && pageNumber < 20;
    pageNumber++
  ) {
    const next = page.getByRole("button", { name: "Next page", exact: true });
    await expect(next).toBeEnabled();
    const searched = page.waitForResponse((r) =>
      r.url().includes("/functions?"),
    );
    await next.click();
    await searched;
    await expect(
      page.getByRole("button", { name: "Search", exact: true }),
    ).toBeEnabled();
  }
  await result.last().click();
  await expect(page.getByTestId("source-snippet")).toContainText(values.symbol);
  await page
    .getByRole("button", { name: "Expand one level", exact: true })
    .click();
  await expect(
    page.locator(`.react-flow__node[data-id="fact:${node.id}"]`),
  ).toBeVisible();
  // Keep the selected source readable instead of shrinking all 80 nodes into one viewport.
  const focused = page.locator(`.react-flow__node[data-id="fact:${node.id}"]`);
  await expect(focused).toBeInViewport();
  await expect
    .poll(async () => (await focused.boundingBox())?.width ?? 0)
    .toBeGreaterThan(200);
  await expect(page.locator(".graph-area footer")).not.toContainText(
    "Working…",
  );
  await page.screenshot({
    path: join(out, `${values.label}-product.png`),
    fullPage: true,
  });
  failureCapture = {
    summary,
    sample: {
      node,
      context: contextResult,
      sourceExcerpt: source.content
        .split(/\r?\n/)
        .slice(node.startLine - 1, Math.min(node.endLine, node.startLine + 20))
        .join("\n"),
    },
    bounded,
    expansion: {
      nodes: graph.nodes.length,
      relations: graph.relations.length,
      truncated: graph.truncated,
    },
  };
  if (values["require-entry"]) {
    const returnedEntryIds = summary.entrypoints.map((entry) => entry.id);
    entryCriterion = {
      requested: true,
      status: "failed",
      sampleId: node.id,
      sampleExported: node.exported,
      returnedEntryIds,
      sampleInReturnedEntries: returnedEntryIds.includes(node.id),
      entrypointTotal: summary.entrypointTotal,
      returnedCount: returnedEntryIds.length,
      entrypointsTruncated: summary.entrypointsTruncated,
    };
    assert.equal(
      node.exported,
      true,
      "Required sample must be an exported entry",
    );
    assert.ok(
      returnedEntryIds.length <= 50,
      "Entry response respects its 50-node cap",
    );
    assert.ok(
      summary.entrypointTotal >= returnedEntryIds.length,
      "Entry total accounts for returned nodes",
    );
    assert.equal(
      summary.entrypointsTruncated,
      summary.entrypointTotal > returnedEntryIds.length,
      "Entry truncation agrees with total and returned count",
    );
    assert.ok(
      returnedEntryIds.includes(node.id),
      "Required sample ID must occur in the actual returned entry list (truncated lists do not waive acceptance)",
    );
    entryCriterion.status = "passed";
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  assert.deepEqual(protocolErrors, []);
  assert.equal(mcp.stderr(), "");
  const afterCapture = repositoryProvenance(values.path, gitRevision);
  const evidence = {
    provenance: { beforeCapture, afterCapture },
    target: {
      path: values.path,
      gitRevision,
      symbol: values.symbol,
      file: values.file,
    },
    observedAt: new Date().toISOString(),
    status: "passed",
    entryCriterion,
    openMilliseconds,
    summary,
    search: { total: search.total, limit: search.limit },
    sample: {
      node,
      context: contextResult,
      sourceExcerpt: source.content
        .split(/\r?\n/)
        .slice(node.startLine - 1, Math.min(node.endLine, node.startLine + 20))
        .join("\n"),
    },
    bounded,
    expansion: {
      nodes: graph.nodes.length,
      relations: graph.relations.length,
      truncated: graph.truncated,
    },
    errors,
    external,
    protocolErrors,
    scope:
      "Actual compiled API/web + Chromium open/search/source/expand + SDK stdio summary/search/context/subgraph. Source endpoint is HTTP; MCP supplies source locations/call evidence, no read_source tool. Whole supported checkout indexed; target code and upstream tests never executed.",
  };
  await writeFile(
    join(out, `${values.label}-product.json`),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      label: values.label,
      gitRevision,
      openMilliseconds,
      counts: summary.counts,
      diagnostics: summary.diagnostics.length,
      entrypointTotal: summary.entrypointTotal,
      entrypointsTruncated: summary.entrypointsTruncated,
      entryCriterion,
      expansion: evidence.expansion,
      errors,
      external,
    }),
  );
} catch (error) {
  try {
    if (page && !page.isClosed())
      await page.screenshot({
        path: join(out, `${values.label}-product.png`),
        fullPage: true,
      });
  } catch (captureError) {
    errors.push(`Failure screenshot: ${captureError}`);
  }
  let afterCapture;
  try {
    afterCapture = repositoryProvenance(values.path, gitRevision);
  } catch (captureError) {
    afterCapture = { error: String(captureError) };
  }
  try {
    await writeFile(
      join(out, `${values.label}-product.json`),
      JSON.stringify(
        {
          status: "failed",
          observedAt: new Date().toISOString(),
          target: {
            path: values.path,
            gitRevision,
            symbol: values.symbol,
            file: values.file,
          },
          provenance: {
            beforeCapture,
            afterCapture,
          },
          entryCriterion,
          ...failureCapture,
          error: String(error),
          errors,
          external,
          protocolErrors,
          scope:
            "Actual compiled read-only product validation; target code and upstream tests never executed.",
        },
        null,
        2,
      ),
    );
  } catch (captureError) {
    console.error(`Failure evidence: ${captureError}`);
  }
  throw error;
} finally {
  const mcpPid = mcp?.transport.pid;
  try {
    await browser?.close();
  } finally {
    try {
      await mcp?.client.close();
    } finally {
      try {
        await server?.stop();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }
  if (mcpPid) assert.throws(() => process.kill(mcpPid, 0), { code: "ESRCH" });
  if (server)
    assert.throws(() => process.kill(server.child.pid, 0), { code: "ESRCH" });
  await assert.rejects(access(root));
}
