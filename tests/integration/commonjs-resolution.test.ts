import { expect, test } from "vitest";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeSnapshot, CodeNode } from "@codemap/core";
import { SqliteStorage } from "@codemap/storage";
import { startProduction, connectMcp, http } from "../support/production.mjs";
import {
  createCommonjsFixture,
  seedLegacyPackageSnapshot,
} from "../support/commonjs.mjs";

test("compiled HTTP and SDK stale package-only baselines without rewriting approval, symbols or historic SQLite snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-commonjs-http-"));
  const data = join(root, "data");
  let server, mcp;
  try {
    const f = await createCommonjsFixture(root);
    server = await startProduction(data);
    const api = (path: string, method = "GET", body?: unknown) =>
      http(server.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: f.path });
    const base = `/api/projects/${project.id}`;
    const original: CodeSnapshot = await api(`${base}/snapshot`);
    const node = (file: string): CodeNode =>
      original.nodes.find((n) => n.kind === "function" && n.filePath === file)!;
    const entry = node("entry.js"),
      helper = node("helper.js");
    expect(entry.exported).toBe(true);
    expect(helper.exported).toBe(true);
    expect(original.coverage.packageFiles).toEqual(["package.json"]);
    const sources = await Promise.all(
      original.coverage.files.map((path) =>
        readFile(join(f.path, path), "utf8"),
      ),
    );
    mcp = await connectMcp(server.url);
    const protocolErrors: unknown[] = [];
    mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
    const args = { projectId: project.id };
    const before = await api(`${base}/functions/${entry.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: entry.id }),
    ).toEqual(before);
    expect(before.outgoing).toEqual([
      expect.objectContaining({
        targetId: helper.id,
        resolution: "resolved",
        evidence: expect.objectContaining({ filePath: "entry.js", line: 2 }),
      }),
    ]);
    expect(helper.startLine).toBe(2);
    for (const name of ["overwritten", "shadowed"]) {
      const unknown = original.nodes.find(
        (n) => n.name === name && n.kind === "function",
      )!;
      const context = await api(`${base}/functions/${unknown.id}`);
      expect(
        await mcp.call("get_function_context", { ...args, nodeId: unknown.id }),
      ).toEqual(context);
      expect(
        context.outgoing.some(
          (r: { resolution: string; reason?: string }) =>
            r.resolution === "unresolved" && !!r.reason,
        ),
      ).toBe(true);
      expect(
        context.outgoing.some(
          (r: { resolution: string }) => r.resolution === "resolved",
        ),
      ).toBe(false);
    }
    expect(
      original.relations.some(
        (r) =>
          r.type === "imports" &&
          r.resolution === "resolved" &&
          r.evidence?.filePath === "entry.js",
      ),
    ).toBe(true);
    const plan = await mcp.call("propose_plan", {
      ...args,
      baselineSnapshotId: original.id,
      title: "保留 authored plan",
      operations: [
        {
          kind: "add_relation",
          id: "reuse",
          sourceId: entry.id,
          targetId: helper.id,
          type: "must_reuse",
        },
      ],
    });
    const approved = await api(`/api/plans/${plan.plan.id}/approve`, "POST", {
      expectedRevision: plan.plan.revision,
    });
    expect(approved.valid).toBe(true);
    const route = await mcp.call("propose_route", {
      ...args,
      snapshotId: original.id,
      title: "Helper walkthrough",
      description: "原文",
      kind: "call_chain",
      steps: [
        { nodeId: entry.id, note: "Entry" },
        {
          nodeId: helper.id,
          note: "Helper",
          relationId: before.outgoing[0].id,
        },
      ],
    });
    expect((await mcp.call("get_routes", args)).items[0].stale).toBe(false);
    await f.setType("module");
    const refreshed = await mcp.call("refresh_index", args);
    const current: CodeSnapshot = await api(`${base}/snapshot`);
    expect(refreshed.snapshotId).toBe(current.id);
    expect(current.id).not.toBe(original.id);
    expect(current.contentHash).not.toBe(original.contentHash);
    expect(
      current.nodes
        .filter((n) => n.kind === "function")
        .map((n) => n.id)
        .sort(),
    ).toEqual(
      original.nodes
        .filter((n) => n.kind === "function")
        .map((n) => n.id)
        .sort(),
    );
    expect(
      await Promise.all(
        current.coverage.files.map((path) =>
          readFile(join(f.path, path), "utf8"),
        ),
      ),
    ).toEqual(sources);
    const after = await api(`${base}/functions/${entry.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: entry.id }),
    ).toEqual(after);
    expect(after).toMatchObject({
      snapshotId: current.id,
      dataSource: "code",
      outgoing: [{ resolution: "unresolved", reason: expect.any(String) }],
    });
    expect(after.outgoing[0].targetId).toBeNull();
    const target = await api(`${base}/functions/${helper.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: helper.id }),
    ).toEqual(target);
    expect(target.node).toMatchObject({
      name: "helper",
      filePath: "helper.js",
      startLine: 2,
    });
    expect((await api(`${base}/source?filePath=helper.js`)).content).toContain(
      'return "中文 helper"',
    );
    const summary = await api(`${base}/summary`);
    expect(await mcp.call("get_project_summary", args)).toEqual(summary);
    expect(summary).toMatchObject({
      counts: { files: 5 },
      coverage: { packageFiles: ["package.json"] },
    });
    expect(summary.coverage.files).toHaveLength(5);
    expect(current.nodes.some((n) => n.filePath?.endsWith(".json"))).toBe(
      false,
    );
    const stale = await api(`/api/plans/${plan.plan.id}`);
    expect(
      await mcp.call("get_approved_plan", { ...args, planId: plan.plan.id }),
    ).toEqual(stale);
    expect(stale).toMatchObject({
      valid: false,
      plan: {
        status: "stale",
        revision: approved.plan.revision,
        operations: approved.plan.operations,
        baselineSnapshotId: original.id,
      },
      approval: approved.approval,
    });
    expect(await api(`${base}/routes`)).toEqual([route]);
    expect(await mcp.call("get_routes", args)).toMatchObject({
      items: [{ ...route, stale: true }],
    });
    expect(protocolErrors).toEqual([]);
    expect(mcp.stderr()).toBe("");
    await mcp.client.close();
    expect(mcp.transport.pid).toBeNull();
    await server.stop();
    expect(server.child.exitCode).toBe(0);
    const store = new SqliteStorage(join(data, "atlasmode.sqlite"));
    try {
      expect(store.get("snapshots", original.id)).toEqual(original);
      expect(store.list("approvals")).toEqual([approved.approval]);
      expect(store.get("routes", route.id)).toEqual(route);
    } finally {
      store.close();
    }
    // Simulate helper persisted pre-upgrade snapshot, then read through fresh production processes.
    const legacy = seedLegacyPackageSnapshot(data, original);
    server = await startProduction(data);
    mcp = await connectMcp(server.url);
    mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
    expect(await api(`${base}/snapshot`)).toEqual(legacy);
    const legacySummary = await api(`${base}/summary`);
    expect(legacySummary.coverage).not.toHaveProperty("packageFiles");
    expect(legacySummary.coverage.configurationFiles).toEqual(
      original.coverage.configurationFiles,
    );
    expect(await mcp.call("get_project_summary", args)).toEqual(legacySummary);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: entry.id }),
    ).toMatchObject({
      snapshotId: legacy.id,
      outgoing: [{ targetId: helper.id }],
    });
    await mcp.call("refresh_index", args);
    await mcp.client.close();
    await server.stop();
    const persisted = new SqliteStorage(join(data, "atlasmode.sqlite"));
    try {
      expect(persisted.get("snapshots", legacy.id)).toEqual(legacy);
    } finally {
      persisted.close();
    }
    expect(protocolErrors).toEqual([]);
    await f.assertNotExecuted();
    expect(mcp.stderr()).toBe("");
  } finally {
    await mcp?.client.close();
    if (mcp) expect(mcp.transport.pid).toBeNull();
    await server?.stop();
    await rm(root, { recursive: true, force: true });
    await expect(access(root)).rejects.toThrow();
  }
}, 30000);
