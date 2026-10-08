import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  startProduction,
  createFixtures,
  http,
} from "../tests/support/production.mjs";

// This opt-in test invokes an authenticated native Agent. No simulated replies.
const provider =
  process.argv[2] ?? process.env.CODEMAP_AGENT_PROVIDER ?? "codex";
if (!["codex", "claude"].includes(provider))
  throw new Error("Choose codex or claude.");
process.env.CODEMAP_AGENT_PROVIDER = provider;
if (process.argv[3]) process.env.CODEMAP_CODEX_PROFILE = process.argv[3];
const root = await mkdtemp(join(tmpdir(), "atlas-agent-connection-"));
let server, project, run;
try {
  const fixture = await createFixtures(root);
  server = await startProduction(join(root, "data"));
  const status = await http(server.url, "/api/agent/status");
  console.log(
    JSON.stringify({
      provider: status.provider,
      profile: status.profile,
      model: status.model,
      modelProvider: status.modelProvider,
      authentication: status.authentication,
    }),
  );
  if (!status.available) {
    console.error(
      `UNAVAILABLE: ${status.reason || "Check the selected CLI account or provider API environment."}`,
    );
    process.exitCode = 2;
  } else {
    project = await http(server.url, "/api/projects", "POST", {
      path: fixture.ts,
    });
    const summary = await http(
      server.url,
      `/api/projects/${project.id}/summary`,
    );
    run = await http(server.url, `/api/projects/${project.id}/chat`, "POST", {
      channel: "plan",
      snapshotId: summary.snapshotId,
      message:
        "Connection acceptance test. Use AtlasMode MCP to search for caller in the bound project, then propose a NEW unapproved plan titled Native Agent connection test. Add one planned TypeScript function connectionExample in connection.ts. This is only a draft; do not execute or modify repository source. Finish with a brief summary.",
    });
    const deadline = Date.now() + 180000;
    while (run.status === "running" && Date.now() < deadline) {
      await new Promise((done) => setTimeout(done, 300));
      run = await http(
        server.url,
        `/api/projects/${project.id}/chat/${run.runId}`,
      );
    }
    assert.equal(
      run.status,
      "completed",
      "Native Agent did not complete successfully.",
    );
    assert(
      run.activity.some(
        (a) => a.tool === "propose_plan" && a.status === "completed",
      ),
      "No successful real MCP propose_plan event.",
    );
    assert(run.changedPlanIds.length > 0, "No journaled draft saved.");
    const plan = await http(server.url, `/api/plans/${run.changedPlanIds[0]}`);
    assert.equal(plan.plan.projectId, project.id);
    assert.equal(plan.plan.status, "draft");
    assert(!plan.valid && !plan.approval);
    assert(
      plan.plan.operations.some(
        (o) => o.kind === "add_function" && o.name === "connectionExample",
      ),
    );
    await fixture.assertNotExecuted();
    console.log(
      JSON.stringify({
        result: "PASS",
        provider,
        nativeModel: true,
        actualMcpProposal: true,
        revision: plan.plan.revision,
        targetExecuted: false,
      }),
    );
  }
} catch (error) {
  if (run) {
    // Public answer text only, with existing environment credentials and endpoints removed.
    const secrets = Object.entries(process.env)
      .filter(
        ([name, value]) =>
          /KEY|TOKEN|SECRET|PASSWORD/i.test(name) && value?.length > 3,
      )
      .map(([, value]) => value);
    const redact = (value) => {
      for (const secret of secrets)
        value = value.split(secret).join("[redacted]");
      return value
        .replace(/https?:\/\/[^\s"')]+/g, "[endpoint]")
        .replace(/\b(?:sk|key)-[A-Za-z0-9_-]{8,}/g, "[redacted]")
        .slice(0, 2048);
    };
    console.error(
      JSON.stringify({
        status: run.status,
        errorCodes: run.errors.map((e) => e.code),
        activity: run.activity,
        savedDraftCount: run.changedPlanIds.length,
        finalAnswers: run.messages.map((m) => redact(m.text)),
      }),
    );
  }
  console.error(`Native Agent connection test FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (server && project && run?.status === "running") {
    await http(
      server.url,
      `/api/projects/${project.id}/chat/${run.runId}/cancel`,
      "POST",
    ).catch(() => {});
  }
  try {
    await server?.stop();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
