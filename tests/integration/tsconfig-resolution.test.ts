import { expect, test } from "vitest";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeSnapshot, CodeNode } from "@codemap/core";
import { SqliteStorage } from "@codemap/storage";
import { startProduction, connectMcp, http } from "../support/production.mjs";
import {
  createTsconfigFixture,
  seedLegacySnapshot,
} from "../support/tsconfig.mjs";

test("compiled HTTP and SDK stale config-only baselines without rewriting approval, symbols or historic SQLite snapshots", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-config-http-"));
  const data = join(root, "data");
  let server, mcp;
  try {
    const f = await createTsconfigFixture(root);
    server = await startProduction(data);
    const api = (path: string, method = "GET", body?: unknown) =>
      http(server.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: f.ts });
    const base = `/api/projects/${project.id}`;
    const original: CodeSnapshot = await api(`${base}/snapshot`);
    const node = (file: string): CodeNode =>
      original.nodes.find((n) => n.kind === "function" && n.filePath === file)!;
    const entry = node("entry.ts"),
      a = node("targetA.ts"),
      b = node("targetB.ts");
    const sources = await Promise.all(
      original.coverage.files.map((path) => readFile(join(f.ts, path), "utf8")),
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
        targetId: a.id,
        resolution: "resolved",
        evidence: expect.objectContaining({ filePath: "entry.ts", line: 2 }),
      }),
    ]);
    expect(a.startLine).toBe(2);
    const plan = await mcp.call("propose_plan", {
      ...args,
      baselineSnapshotId: original.id,
      title: "保留 authored plan",
      operations: [
        {
          kind: "add_relation",
          id: "reuse",
          sourceId: entry.id,
          targetId: a.id,
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
      title: "A walkthrough",
      description: "原文",
      kind: "call_chain",
      steps: [
        { nodeId: entry.id, note: "Entry" },
        { nodeId: a.id, note: "A", relationId: before.outgoing[0].id },
      ],
    });
    expect((await mcp.call("get_routes", args)).items[0].stale).toBe(false);
    await f.mapTo("targetB");
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
          readFile(join(f.ts, path), "utf8"),
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
      outgoing: [
        {
          targetId: b.id,
          resolution: "resolved",
          evidence: { filePath: "entry.ts", line: 2 },
        },
      ],
    });
    const target = await api(`${base}/functions/${b.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: b.id }),
    ).toEqual(target);
    expect(target.node).toMatchObject({
      name: "target",
      filePath: "targetB.ts",
      startLine: 3,
    });
    expect((await api(`${base}/source?filePath=targetB.ts`)).content).toContain(
      'return "B 原文"',
    );
    const summary = await api(`${base}/summary`);
    expect(await mcp.call("get_project_summary", args)).toEqual(summary);
    expect(summary).toMatchObject({
      counts: { files: 6 },
      coverage: { configurationFiles: ["config/shared.json", "tsconfig.json"] },
    });
    expect(summary.coverage.files).toHaveLength(6);
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
    // Simulate a persisted pre-upgrade snapshot, then read through fresh production processes.
    const legacy = seedLegacySnapshot(data, original);
    server = await startProduction(data);
    mcp = await connectMcp(server.url);
    expect(await api(`${base}/snapshot`)).toEqual(legacy);
    const legacySummary = await api(`${base}/summary`);
    expect(legacySummary.coverage).not.toHaveProperty("configurationFiles");
    expect(await mcp.call("get_project_summary", args)).toEqual(legacySummary);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: entry.id }),
    ).toMatchObject({ snapshotId: legacy.id, outgoing: [{ targetId: a.id }] });
    await mcp.call("refresh_index", args);
    const persisted = new SqliteStorage(join(data, "atlasmode.sqlite"));
    try {
      expect(persisted.get("snapshots", legacy.id)).toEqual(legacy);
    } finally {
      persisted.close();
    }
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
