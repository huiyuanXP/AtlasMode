import { expect, test } from "vitest";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeSnapshot, CodeNode } from "@codemap/core";
import { SqliteStorage } from "@codemap/storage";
import { startProduction, connectMcp, http } from "../support/production.mjs";
import {
  createForwardingFixture,
  assertProcessStopped,
} from "../support/forwarding.mjs";

// Catches canonical leaf loss, alias-only freshness loss and rewritten approval/history.
test("compiled HTTP and SDK preserve real forwarding leaf identity and immutable approval/history after alias-only refresh and SQLite reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-forwarding-http-"));
  const data = join(root, "data");
  let server, mcp;
  const protocolErrors: unknown[] = [];
  try {
    const f = await createForwardingFixture(root);
    server = await startProduction(data);
    const api = (path: string, method = "GET", body?: unknown) =>
      http(server.url, path, method, body);
    const project = await api("/api/projects", "POST", { path: f.path });
    const base = `/api/projects/${project.id}`;
    const original: CodeSnapshot = await api(`${base}/snapshot`);
    const node = (name: string): CodeNode =>
      original.nodes.find((n) => n.kind === "function" && n.name === name)!;
    const entry = node("entry"),
      leaf = node("helper"),
      other = node("helperB");
    expect(leaf).toMatchObject({
      filePath: "leaf-a.cjs",
      startLine: 2,
      exported: true,
    });
    mcp = await connectMcp(server.url);
    mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
    const args = { projectId: project.id };
    const context = await api(`${base}/functions/${entry.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: entry.id }),
    ).toEqual(context);
    expect(context.outgoing).toEqual([
      expect.objectContaining({
        targetId: leaf.id,
        resolution: "resolved",
        evidence: expect.objectContaining({ filePath: "entry.cjs", line: 2 }),
      }),
    ]);
    const physical = original.nodes.find(
      (n) => n.kind === "file" && n.filePath === "index.cjs",
    )!;
    expect(original.relations).toContainEqual(
      expect.objectContaining({
        type: "imports",
        targetId: physical.id,
        evidence: expect.objectContaining({ filePath: "entry.cjs", line: 1 }),
      }),
    );
    const leafContext = await api(`${base}/functions/${leaf.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: leaf.id }),
    ).toEqual(leafContext);
    expect(leafContext.node).toEqual(leaf);
    expect((await api(`${base}/source?filePath=leaf-a.cjs`)).content).toBe(
      f.files["leaf-a.cjs"],
    );
    const summary = await api(`${base}/summary`);
    expect(await mcp.call("get_project_summary", args)).toEqual(summary);
    expect(summary.entrypoints.map((n: CodeNode) => n.id)).toContain(leaf.id);
    const unknown = node("unsafeCaller");
    const unknownContext = await api(`${base}/functions/${unknown.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: unknown.id }),
    ).toEqual(unknownContext);
    expect(unknownContext.outgoing).toEqual([
      expect.objectContaining({
        targetId: null,
        resolution: "unresolved",
        reason: expect.any(String),
      }),
    ]);
    expect(unknownContext.outgoing[0].reason.length).toBeGreaterThan(0);
    const draft = await mcp.call("propose_plan", {
      ...args,
      baselineSnapshotId: original.id,
      title: "Forwarded reuse",
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
    const approved = await api(`/api/plans/${draft.plan.id}/approve`, "POST", {
      expectedRevision: draft.plan.revision,
    });
    expect(approved.valid).toBe(true);
    const route = await mcp.call("propose_route", {
      ...args,
      snapshotId: original.id,
      title: "Real leaf",
      description: "作者原文",
      kind: "call_chain",
      steps: [
        { nodeId: entry.id, note: "entry" },
        { nodeId: leaf.id, note: "leaf", relationId: context.outgoing[0].id },
      ],
    });
    expect((await mcp.call("get_routes", args)).items[0].stale).toBe(false);
    await f.redirect();
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
    for (const [name, bytes] of Object.entries(f.files)) {
      if (name !== "barrel.cjs")
        expect(await readFile(join(f.path, name), "utf8")).toBe(bytes);
    }
    const after = await api(`${base}/functions/${entry.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: entry.id }),
    ).toEqual(after);
    expect(after.outgoing).toEqual([
      expect.objectContaining({ targetId: other.id, resolution: "resolved" }),
    ]);
    const otherContext = await api(`${base}/functions/${other.id}`);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: other.id }),
    ).toEqual(otherContext);
    expect(otherContext.node).toMatchObject({
      id: other.id,
      name: "helperB",
      filePath: "leaf-b.cjs",
      startLine: 2,
    });
    expect((await api(`${base}/source?filePath=leaf-b.cjs`)).content).toBe(
      f.files["leaf-b.cjs"],
    );
    const stale = await api(`/api/plans/${draft.plan.id}`);
    expect(
      await mcp.call("get_approved_plan", { ...args, planId: draft.plan.id }),
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
    await f.assertNotExecuted();
    expect(protocolErrors).toEqual([]);
    expect(mcp.stderr()).toBe("");
    const pid = mcp.transport.pid;
    await mcp.client.close();
    assertProcessStopped(pid);
    await server.stop();
    expect(server.child.exitCode).toBe(0);
    assertProcessStopped(server.child.pid);
    const store = new SqliteStorage(join(data, "atlasmode.sqlite"));
    try {
      expect(store.get("snapshots", original.id)).toEqual(original);
      expect(store.get("snapshots", current.id)).toEqual(current);
      expect(store.list("approvals")).toEqual([approved.approval]);
      expect(
        store.get("settings", `approved-plan:${approved.approval.id}`),
      ).toEqual(approved.plan);
      expect(store.get("routes", route.id)).toEqual(route);
    } finally {
      store.close();
    }
    server = await startProduction(data);
    mcp = await connectMcp(server.url);
    mcp.client.onerror = (error: unknown) => protocolErrors.push(error);
    expect(await api(`${base}/snapshot`)).toEqual(current);
    expect(
      await mcp.call("get_approved_plan", { ...args, planId: draft.plan.id }),
    ).toEqual(stale);
    expect(
      await mcp.call("get_function_context", { ...args, nodeId: entry.id }),
    ).toEqual(after);
    expect(await mcp.call("get_routes", args)).toMatchObject({
      items: [{ ...route, stale: true }],
    });
    expect(protocolErrors).toEqual([]);
    expect(mcp.stderr()).toBe("");
    await f.assertNotExecuted();
  } finally {
    const pid = mcp?.transport.pid;
    try {
      await mcp?.client.close();
    } finally {
      try {
        await server?.stop();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
    if (pid) assertProcessStopped(pid);
    if (server) assertProcessStopped(server.child.pid);
    await expect(access(root)).rejects.toThrow();
  }
}, 30000);
