import {
  test,
  expect,
  type Page,
  type BrowserContext,
  type TestInfo,
} from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
const labels = {
  zh: {
    tab: "知识注释",
    refresh: "刷新代码",
    history: "修订历史",
    orphan: "失联，知识已保留",
    advanced: "高级编辑",
    choosePlan: "选择规划",
  },
  en: {
    tab: "Knowledge notes",
    refresh: "Refresh code",
    history: "Revision history",
    orphan: "Orphaned; knowledge retained",
    advanced: "Advanced editing",
    choosePlan: "Choose plan",
  },
};
async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(name + ".png");
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}
async function refused(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", (error) => {
      socket.destroy();
      resolve((error as NodeJS.ErrnoException).code === "ECONNREFUSED");
    });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function fixture(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
  locale: "zh" | "en" = "zh",
) {
  const root = await mkdtemp(join(tmpdir(), "atlas-kn01-browser-")),
    target = join(root, "owned-source"),
    data = join(root, "owned-data");
  const runtimes: {
    pid: number;
    port: number;
    url: string;
    registeredAt: string;
    stoppedAt?: string;
    exitCode?: number | null;
    signalCode?: string | null;
    pidAliveAfterStop?: boolean;
    portRefusedAfterStop?: boolean;
  }[] = [];
  await mkdir(join(target, ".codemap"), { recursive: true });
  await writeFile(
    join(target, ".codemap", "structure.json"),
    JSON.stringify({ schemaVersion: 1, folders: [], dependencyRules: [] }),
  );
  await writeFile(join(target, "a.ts"), "export function same(){return 1;}\n");
  await writeFile(join(target, "b.ts"), "export function same(){return 2;}\n");
  const start = async () => {
    const own = await startProduction(data);
    runtimes.push({
      pid: own.child.pid!,
      port: own.port,
      url: own.url,
      registeredAt: new Date().toISOString(),
    });
    return own;
  };
  let server = await start();
  const stop = async () => {
    const own = server,
      receipt = runtimes.find((item) => item.pid === own.child.pid)!;
    try {
      await own.stop();
    } finally {
      receipt.stoppedAt = new Date().toISOString();
      receipt.exitCode = own.child.exitCode;
      receipt.signalCode = own.child.signalCode;
      try {
        process.kill(receipt.pid, 0);
        receipt.pidAliveAfterStop = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        receipt.pidAliveAfterStop = false;
      }
      receipt.portRefusedAfterStop = await refused(receipt.port);
    }
    expect(receipt.exitCode).toBe(0);
    expect(receipt.signalCode).toBe(null);
    expect(receipt.pidAliveAfterStop).toBe(false);
    expect(receipt.portRefusedAfterStop).toBe(true);
  };
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await denyExternalRequests(context, external);
  const project = await http(server.url, "/api/projects", "POST", {
    path: target,
  });
  await http(server.url, `/api/projects/${project.id}/view`, "PUT", {
    positions: {},
    theme: "light",
    locale,
  });
  const open = async () => {
    await page.goto(server.url);
    await page
      .getByRole("combobox", {
        name: /^(切换项目|Switch project)$/,
        exact: true,
      })
      .selectOption(project.id);
    await page
      .getByRole("button", { name: labels[locale].tab, exact: true })
      .click();
    await expect(
      page.locator(".annotations-panel [data-action=text]"),
    ).toBeVisible();
  };
  const close = async () => {
    let removed = false;
    try {
      await stop();
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
      try {
        await access(root);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        removed = true;
      }
      const receipt = {
        scope: "KN01 owned fixture only",
        root,
        target,
        data,
        runtimes,
        fixtureRemoved: removed,
        errors,
        external,
        completedAt: new Date().toISOString(),
      };
      const path = testInfo.outputPath("runtime-receipt.json");
      await writeFile(path, JSON.stringify(receipt, null, 2));
      await testInfo.attach("owned-runtime-cleanup", {
        path,
        contentType: "application/json",
      });
      expect(removed).toBe(true);
    }
  };
  try {
    await open();
  } catch (error) {
    await close();
    throw error;
  }
  return {
    target,
    data,
    project,
    url: () => server.url,
    open,
    restart: async () => {
      await stop();
      server = await start();
      await open();
    },
    close,
  };
}
for (const locale of ["zh", "en"] as const)
  test(`${locale} mounted production notes CRUD, exact source rebind, orphan retention, readonly history and owned SQLite restart`, async ({
    page,
    context,
  }, testInfo) => {
    const f = await fixture(page, context, testInfo, locale);
    try {
      const panel = page.locator(".annotations-panel"),
        sourceBefore = await readFile(join(f.target, "a.ts"));
      await panel.locator("[data-action=author]").fill("Actual note author");
      await panel
        .locator("[data-action=text]")
        .fill("Independent constraint survives source");
      await panel.locator("[data-action=constraint]").check();
      await panel.locator("[data-action=save]").click();
      await expect(panel.locator(".annotation-list li")).toHaveCount(1);
      const records = await http(
          f.url(),
          `/api/projects/${f.project.id}/annotations`,
        ),
        note = records.items[0].annotation;
      expect(note).toMatchObject({
        revision: 1,
        author: "Actual note author",
        source: "user",
        isConstraint: true,
        binding: null,
      });
      expect(await readFile(join(f.target, "a.ts"))).toEqual(sourceBefore);
      const snapshot = await http(
          f.url(),
          `/api/projects/${f.project.id}/snapshot`,
        ),
        target = snapshot.nodes.find(
          (node: { kind: string; filePath?: string }) =>
            node.kind === "function" && node.filePath === "b.ts",
        );
      await page
        .locator(
          `.react-flow__node[data-id=${JSON.stringify("fact:" + target.id)}]`,
        )
        .click();
      await expect(panel.locator("[data-action=use-selection]")).toBeEnabled();
      await panel.locator("[data-action=use-selection]").click();
      await expect(panel).toContainText(target.id);
      await expect(panel).toContainText(snapshot.id);
      await expect(panel).toContainText("b.ts");
      await panel.locator("[data-action=confirm-binding]").click();
      await expect
        .poll(
          async () =>
            (
              await http(
                f.url(),
                `/api/projects/${f.project.id}/annotations/${note.id}`,
              )
            ).annotation.revision,
        )
        .toBe(2);
      await writeFile(
        join(f.target, "b.ts"),
        "export function renamed(){return 3;}\n",
      );
      await page
        .getByRole("button", { name: labels[locale].refresh, exact: true })
        .click();
      await expect(panel.locator(".annotation-list")).toContainText(
        labels[locale].orphan,
      );
      await screenshot(page, testInfo, locale + "-orphan-retained");
      expect(
        (
          await http(
            f.url(),
            `/api/projects/${f.project.id}/annotations/${note.id}`,
          )
        ).annotation.text,
      ).toBe("Independent constraint survives source");
      await writeFile(
        join(f.target, "b.ts"),
        "export function same(){return 2;}\n",
      );
      await page
        .getByRole("button", { name: labels[locale].refresh, exact: true })
        .click();
      await expect(panel.locator(".annotation-list")).toContainText(
        labels[locale].orphan,
      );
      const returned = await http(
        f.url(),
        `/api/projects/${f.project.id}/snapshot`,
      );
      await page
        .locator(
          `.react-flow__node[data-id=${JSON.stringify("fact:" + target.id)}]`,
        )
        .click();
      await panel.locator("[data-action=use-selection]").click();
      await expect(panel).toContainText(returned.id);
      await panel.locator("[data-action=confirm-binding]").click();
      await expect
        .poll(
          async () =>
            (
              await http(
                f.url(),
                `/api/projects/${f.project.id}/annotations/${note.id}`,
              )
            ).annotation.binding.state,
        )
        .toBe("bound");
      await panel.locator("[data-action=text]").fill("Edited retained body");
      await panel.locator("[data-action=save]").click();
      await expect(panel.locator(".annotation-list")).toContainText(
        "Edited retained body",
      );
      await panel
        .locator(".annotation-list li")
        .getByRole("button", { name: labels[locale].history, exact: true })
        .click();
      await expect(panel.locator(".annotation-history")).toContainText(
        "Independent constraint survives source",
      );
      expect(
        await panel
          .locator(".annotation-history input,.annotation-history textarea")
          .count(),
      ).toBe(0);
      await panel.locator(".annotation-history").scrollIntoViewIfNeeded();
      await screenshot(page, testInfo, locale + "-history-1600-light");
      if (locale === "en") {
        await page
          .getByRole("button", { name: "Toggle light/dark", exact: true })
          .click();
        await expect(page.locator(".app")).toHaveAttribute(
          "data-theme",
          "dark",
        );
        await page.setViewportSize({ width: 900, height: 1000 });
        await screenshot(page, testInfo, "en-history-900-dark");
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page
          .getByRole("button", { name: "Toggle light/dark", exact: true })
          .click();
        await expect(page.locator(".app")).toHaveAttribute(
          "data-theme",
          "light",
        );
      }
      await panel.locator("[data-action=delete-open]").click();
      const expected = (
        await http(
          f.url(),
          `/api/projects/${f.project.id}/annotations/${note.id}`,
        )
      ).annotation.revision;
      await panel.locator("[data-action=delete-confirm]").click();
      await expect(panel.locator(".annotation-list li")).toHaveCount(0);
      const history = await http(
        f.url(),
        `/api/projects/${f.project.id}/annotations/${note.id}/history`,
      );
      expect(history.items[0]).toMatchObject({
        action: "delete",
        annotation: {
          revision: expected + 1,
          author: "Actual note author",
          source: "user",
          isConstraint: true,
        },
      });
      await f.restart();
      await expect(page.locator(".annotation-list li")).toHaveCount(0);
      const durable = await http(
        f.url(),
        `/api/projects/${f.project.id}/annotations/${note.id}/history`,
      );
      expect(durable).toEqual(history);
    } finally {
      await f.close();
    }
  });
test("mounted production late actual ACK keeps later local edits; stale CAS keeps dirty body and creation source", async ({
  page,
  context,
}, testInfo) => {
  const f = await fixture(page, context, testInfo, "en");
  let release!: () => void;
  let committed!: () => void;
  const entered = new Promise<void>((resolve) => (committed = resolve)),
    hold = new Promise<void>((resolve) => (release = resolve));
  try {
    const seeded = await http(
      f.url(),
      `/api/projects/${f.project.id}/annotations`,
      "POST",
      {
        text: "agent body",
        author: "Agent author",
        source: "agent",
        isConstraint: true,
        binding: null,
      },
    );
    await page.locator("[data-action=reload]").click();
    const panel = page.locator(".annotations-panel");
    await panel
      .locator(
        `[data-action=${JSON.stringify("choose:" + seeded.annotation.id)}]`,
      )
      .click();
    await page.route(
      `**/api/projects/${encodeURIComponent(f.project.id)}/annotations/${seeded.annotation.id}`,
      async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        const actual = await route.fetch();
        committed();
        await hold;
        await route.fulfill({ response: actual });
      },
    );
    await panel.locator("[data-action=text]").fill("sent body");
    await panel.locator("[data-action=save]").click();
    await entered;
    await panel.locator("[data-action=text]").fill("later local body");
    release();
    await expect(panel.locator("[data-action=save]")).toBeEnabled();
    await expect(panel.locator("[data-action=text]")).toHaveValue(
      "later local body",
    );
    await expect(panel).toContainText("Unsaved changes");
    await page.unroute(
      `**/api/projects/${encodeURIComponent(f.project.id)}/annotations/${seeded.annotation.id}`,
    );
    const current = await http(
      f.url(),
      `/api/projects/${f.project.id}/annotations/${seeded.annotation.id}`,
    );
    await http(
      f.url(),
      `/api/projects/${f.project.id}/annotations/${seeded.annotation.id}`,
      "PUT",
      {
        text: "external body",
        author: "Other display author",
        isConstraint: true,
        expectedRevision: current.annotation.revision,
      },
    );
    await panel.locator("[data-action=save]").click();
    await expect(panel).toContainText("The record revision changed");
    await expect(panel.locator("[data-action=text]")).toHaveValue(
      "later local body",
    );
    await expect(panel).toContainText("Agent");
    await screenshot(page, testInfo, "late-ack-dirty-cas-conflict");
  } finally {
    release?.();
    await f.close();
  }
});
test("mounted production committed lost create ACK retains unknown UUID and draft across failed then authoritative current reread without duplicate write", async ({
  page,
  context,
}, testInfo) => {
  const f = await fixture(page, context, testInfo, "en");
  let writes = 0;
  try {
    const snapshot = await http(
        f.url(),
        `/api/projects/${f.project.id}/snapshot`,
      ),
      plan = await http(f.url(), "/api/plans", "POST", {
        projectId: f.project.id,
        title: "Notes recovery",
        baselineSnapshotId: snapshot.id,
      });
    await page.reload();
    await page
      .getByRole("button", { name: "Advanced editing", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Choose plan", exact: true })
      .selectOption(plan.plan.id);
    await page
      .getByRole("button", { name: "Knowledge notes", exact: true })
      .click();
    await page.route(`**/api/plans/${plan.plan.id}/approved`, (route) =>
      route.abort("failed"),
    );
    await page.route(
      `**/api/projects/${encodeURIComponent(f.project.id)}/annotations`,
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        writes++;
        await route.fetch();
        await route.abort("failed");
      },
    );
    const panel = page.locator(".annotations-panel");
    await panel.locator("[data-action=author]").fill("Explicit actor");
    await panel.locator("[data-action=text]").fill("Committed but ACK unknown");
    await panel.locator("[data-action=save]").click();
    await expect(panel).toContainText("The write outcome is unknown");
    await expect(page.locator("[data-action=recover-knowledge]")).toBeEnabled();
    await screenshot(page, testInfo, "lost-ack-current-read-failed-lock");
    await page.locator("[data-action=recover-knowledge]").click();
    await expect(page.locator("[data-action=recover-knowledge]")).toBeVisible();
    await expect(panel.locator("[data-action=text]")).toHaveValue(
      "Committed but ACK unknown",
    );
    expect(
      (await http(f.url(), `/api/projects/${f.project.id}/annotations`)).total,
    ).toBe(1);
    await page.unroute(`**/api/plans/${plan.plan.id}/approved`);
    await page.locator("[data-action=recover-knowledge]").click();
    await expect(page.locator("[data-action=recover-knowledge]")).toHaveCount(
      0,
    );
    await expect(panel.locator("[data-action=text]")).toHaveValue(
      "Committed but ACK unknown",
    );
    await expect(panel.locator("[data-action=save]")).toBeDisabled();
    expect(writes).toBe(1);
    await screenshot(
      page,
      testInfo,
      "lost-ack-unknown-draft-after-current-recovery",
    );
  } finally {
    await f.close();
  }
});
async function executionAttemptReceipt(
  page: Page,
  testInfo: TestInfo,
  endpoints: { method: string; url: string }[],
  name: string,
) {
  await page
    .getByRole("button", { name: "Advanced editing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm current revision", exact: true }),
  ).toBeEnabled();
  const before = endpoints.length;
  await page
    .getByRole("button", { name: "Confirm current revision", exact: true })
    .click();
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  await page
    .getByRole("button", { name: "Export Markdown", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Implementation check", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Check approved implementation",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Check approved implementation", exact: true }).click();
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
  const receipt = {
    boundary:
      "actual native clicks on enabled approve/current-export controls; enabled native verification control guarded by public workspace entry point",
    before,
    after: endpoints.length,
    delta: endpoints.slice(before),
  };
  await testInfo.attach(name + "-execution-requests", {
    body: JSON.stringify(receipt, null, 2),
    contentType: "application/json",
  });
  expect(receipt.delta).toEqual([]);
}
async function recoveryFixture(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
) {
  const f = await fixture(page, context, testInfo, "en");
  const endpoints: { method: string; url: string }[] = [];
  page.on("request", (request) => {
    if (
      /\/api\/plans\/[^/]+\/(approve|verify|export)$/.test(
        new URL(request.url()).pathname,
      )
    )
      endpoints.push({ method: request.method(), url: request.url() });
  });
  const seeded = await http(
    f.url(),
    `/api/projects/${f.project.id}/annotations`,
    "POST",
    {
      text: "second agent original",
      author: "Stable agent author",
      source: "agent",
      isConstraint: true,
      binding: null,
    },
  );
  const snapshot = await http(
    f.url(),
    `/api/projects/${f.project.id}/snapshot`,
  );
  const a = await http(f.url(), "/api/plans", "POST", {
    projectId: f.project.id,
    title: "Race A",
    baselineSnapshotId: snapshot.id,
  });
  const b = await http(f.url(), "/api/plans", "POST", {
    projectId: f.project.id,
    title: "Race B",
    baselineSnapshotId: snapshot.id,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Advanced editing", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Choose plan", exact: true })
    .selectOption(a.plan.id);
  await expect(
    page.getByRole("combobox", { name: "Choose plan", exact: true }),
  ).toHaveValue(a.plan.id);
  await page
    .getByRole("button", { name: "Knowledge notes", exact: true })
    .click();
  let failCurrent = true,
    holdApproval = false,
    approvalEntered = false,
    releaseApproval: () => void = () => {};
  const approvalHold = new Promise<void>((resolve) => {
    releaseApproval = resolve;
  });
  await page.route("**/api/plans/*/approved", async (route) => {
    const actual = await route.fetch();
    if (holdApproval) {
      holdApproval = false;
      approvalEntered = true;
      await approvalHold;
      await route.fulfill({ response: actual });
      return;
    }
    if (failCurrent) await route.abort("failed");
    else await route.fulfill({ response: actual });
  });
  let creates = 0;
  await page.route(
    `**/api/projects/${encodeURIComponent(f.project.id)}/annotations`,
    async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      creates++;
      await route.fetch();
      await route.abort("failed");
    },
  );
  const panel = page.locator(".annotations-panel");
  await panel
    .locator("[data-action=text]")
    .fill("Unknown original UUID; preserve my draft");
  await panel.locator("[data-action=save]").click();
  await expect(panel).toContainText("The write outcome is unknown");
  await expect(panel.locator(".annotation-list li")).toHaveCount(2);
  await expect(page.locator("[data-action=recover-knowledge]")).toBeEnabled();
  return {
    ...f,
    a,
    b,
    seeded,
    endpoints,
    panel,
    creates: () => creates,
    armApproval: () => {
      holdApproval = true;
    },
    approvalEntered: () => approvalEntered,
    releaseApproval,
    currentSucceeds: () => {
      failCurrent = false;
    },
  };
}
for (const scenario of [
  { phase: "strong", aba: false },
  { phase: "notes", aba: true },
] as const)
  test(`mounted I1 ${scenario.phase} real-read barrier ${scenario.aba ? "A→B→A" : "A→B"} keeps unknown draft and current execution locked`, async ({
    page,
    context,
  }, testInfo) => {
    const f = await recoveryFixture(page, context, testInfo);
    let releaseNotes: () => void = () => {};
    let notesEntered = false;
    try {
      if (scenario.phase === "strong") f.armApproval();
      else {
        f.currentSucceeds();
        const hold = new Promise<void>((resolve) => {
          releaseNotes = resolve;
        });
        let armed = true;
        await page.route(
          `**/api/projects/${encodeURIComponent(f.project.id)}/annotations?*`,
          async (route) => {
            const actual = await route.fetch();
            if (armed) {
              armed = false;
              notesEntered = true;
              await hold;
            }
            await route.fulfill({ response: actual });
          },
        );
      }
      await page.locator("[data-action=recover-knowledge]").click();
      await expect
        .poll(() =>
          scenario.phase === "strong" ? f.approvalEntered() : notesEntered,
        )
        .toBe(true);
      await page
        .getByRole("button", { name: "Advanced editing", exact: true })
        .click();
      const chooser = page.getByRole("combobox", {
        name: "Choose plan",
        exact: true,
      });
      await chooser.selectOption(f.b.plan.id);
      await expect(chooser).toHaveValue(f.b.plan.id);
      if (scenario.aba) {
        await chooser.selectOption(f.a.plan.id);
        await expect(chooser).toHaveValue(f.a.plan.id);
      }
      f.releaseApproval();
      releaseNotes();
      await page.waitForLoadState("networkidle");
      await expect(
        page.getByText(
          "The knowledge write has not been confirmed by a complete current read. Approval, verification and current plan export are unavailable. Reread knowledge and approval status; local drafts are retained.",
          { exact: true },
        ),
      ).toBeVisible();
      await executionAttemptReceipt(
        page,
        testInfo,
        f.endpoints,
        "I1-" + scenario.phase,
      );
      await screenshot(
        page,
        testInfo,
        "I1-" + scenario.phase + "-current-execution-blocked",
      );
      await page
        .getByRole("button", { name: "Knowledge notes", exact: true })
        .click();
      await expect(f.panel.locator("[data-action=text]")).toHaveValue(
        "Unknown original UUID; preserve my draft",
      );
      await expect(
        f.panel.getByRole("heading", { name: "New annotation", exact: true }),
      ).toBeVisible();
      await expect(f.panel.locator("[data-action=save]")).toBeDisabled();
      expect(f.creates()).toBe(1);
      await screenshot(
        page,
        testInfo,
        "I1-" + scenario.phase + "-unknown-UUID-dirty-retained",
      );
    } finally {
      f.releaseApproval();
      releaseNotes();
      await f.close();
    }
  });
test("mounted I2 older actual recovery cannot unlock newer committed lost ACK; fresh reread recovers without replay or dirty replacement", async ({
  page,
  context,
}, testInfo) => {
  const f = await recoveryFixture(page, context, testInfo);
  let releaseWrite: () => void = () => {};
  let putEntered = false,
    puts = 0;
  try {
    f.armApproval();
    await page.locator("[data-action=recover-knowledge]").click();
    await expect.poll(f.approvalEntered).toBe(true);
    await f.panel
      .locator(
        `[data-action=${JSON.stringify("choose:" + f.seeded.annotation.id)}]`,
      )
      .click();
    const hold = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    await page.route(
      `**/api/projects/${encodeURIComponent(f.project.id)}/annotations/${f.seeded.annotation.id}`,
      async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        puts++;
        await route.fetch();
        putEntered = true;
        await hold;
        await route.abort("failed");
      },
    );
    await f.panel
      .locator("[data-action=text]")
      .fill("Newer committed write; ACK unknown");
    await f.panel.locator("[data-action=save]").click();
    await expect.poll(() => putEntered).toBe(true);
    const oldRequestFinished = page.waitForEvent("requestfinished", { predicate: request => new URL(request.url()).pathname.endsWith("/approved") });
    f.releaseApproval();
    await oldRequestFinished;
    // Let fetch/body handling and the rendered lifecycle finish; this does not manufacture a receipt.
    await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    // This request has committed, but its ACK remains held while the old recovery completes.
    await expect(
      page.locator("[data-action=recover-knowledge]"),
    ).toBeDisabled();
    releaseWrite();
    await expect(page.locator("[data-action=recover-knowledge]")).toBeEnabled();
    await expect(f.panel).toContainText("The write outcome is unknown");
    await expect(f.panel.locator("[data-action=text]")).toHaveValue(
      "Newer committed write; ACK unknown",
    );
    await page.waitForLoadState("networkidle");
    await screenshot(page, testInfo, "I2-newer-unknown-lock-busy-finished");
    await executionAttemptReceipt(
      page,
      testInfo,
      f.endpoints,
      "I2-newer-unknown",
    );
    // Re-opening the panel mounts it again, and mounting starts its own
    // recovery read. Let that read finish while the current-approval read still
    // fails; if it were still in flight when currentSucceeds() flips below, it
    // would complete the recovery itself and remove the button under the click.
    const remountRead = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes(
          `/api/projects/${encodeURIComponent(f.project.id)}/annotations?`,
        ),
    );
    await page
      .getByRole("button", { name: "Knowledge notes", exact: true })
      .click();
    await remountRead;
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-action=recover-knowledge]")).toBeEnabled();
    await expect(
      f.panel.getByRole("heading", {
        name: "Edit annotation · " + f.seeded.annotation.id,
        exact: true,
      }),
    ).toBeVisible();
    await expect(f.panel.locator("[data-action=text]")).toHaveValue(
      "Newer committed write; ACK unknown",
    );
    await expect(f.panel.locator("[data-action=save]")).toBeDisabled();
    f.currentSucceeds();
    await page.locator("[data-action=recover-knowledge]").click();
    await expect(page.locator("[data-action=recover-knowledge]")).toHaveCount(
      0,
    );
    await expect(f.panel.locator("[data-action=text]")).toHaveValue(
      "Newer committed write; ACK unknown",
    );
    await expect(f.panel.locator("[data-action=save]")).toBeDisabled();
    expect(puts).toBe(1);
    expect(f.creates()).toBe(1);
    const actual = await http(
      f.url(),
      `/api/projects/${f.project.id}/annotations/${f.seeded.annotation.id}`,
    );
    expect(actual.annotation).toMatchObject({
      id: f.seeded.annotation.id,
      text: "Newer committed write; ACK unknown",
      source: "agent",
      author: "Stable agent author",
      revision: 2,
    });
    await screenshot(
      page,
      testInfo,
      "I2-authoritative-recovery-still-dirty-same-UUID",
    );
  } finally {
    f.releaseApproval();
    releaseWrite();
    await f.close();
  }
});
