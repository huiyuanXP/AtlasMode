import { test, expect } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startProduction,
  http,
  denyExternalRequests,
} from "../support/production.mjs";
test("group collapse preserves shared function aliases, true external call endpoints, layout and view across owned restart", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), "atlas-grp02-"));
  let server;
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyExternalRequests(context, external);
  try {
    const target = join(root, "example");
    await mkdir(join(target, "one"), { recursive: true });
    await mkdir(join(target, "two"));
    const paths = ["one/a.ts", "two/b.ts", "outside.ts", "caller.ts"],
      sources = [
        'import { outside } from "../outside";\nexport function alpha(){return outside();}\n',
        'import { alpha } from "../one/a";\nexport function beta(){return alpha();}\n',
        "export function outside(){return 7;}\n",
        'import { alpha } from "./one/a";\nexport function caller(){return alpha();}\n',
      ];
    for (let i = 0; i < paths.length; i++)
      await writeFile(join(target, paths[i]!), sources[i]!);
    const before = await Promise.all(
      paths.map((p) => readFile(join(target, p))),
    );
    const data = join(root, "data");
    server = await startProduction(data);
    const project = await http(server.url, "/api/projects", "POST", {
      path: target,
    });
    const functions = await http(
      server.url,
      `/api/projects/${project.id}/functions?limit=100`,
    );
    const alpha = functions.items.find((n) => n.name === "alpha"),
      beta = functions.items.find((n) => n.name === "beta"),
      outside = functions.items.find((n) => n.name === "outside");
    const g1 = await http(
      server.url,
      `/api/projects/${project.id}/groups`,
      "POST",
      {
        title: "G1",
        description: "first",
        source: "user",
        memberIds: [alpha.id, beta.id],
      },
    );
    const g2 = await http(
      server.url,
      `/api/projects/${project.id}/groups`,
      "POST",
      {
        title: "G2",
        description: "shared",
        source: "user",
        memberIds: [alpha.id],
      },
    );
    const summary = await http(
      server.url,
      `/api/projects/${project.id}/summary`,
    );
    const plan = await http(server.url, "/api/plans", "POST", {
      projectId: project.id,
      title: "Approved",
      baselineSnapshotId: summary.snapshotId,
    });
    await page.goto(server.url);
    await page
      .getByRole("combobox", { name: "切换项目", exact: true })
      .selectOption(project.id);
    const card = (id: string) =>
      page.locator(`.group-card[data-group-id="${id}"]`);
    await expect(card(g1.id)).toBeVisible();
    await expect(card(g2.id)).toBeVisible();
    await expect(page.locator(".group-projection-summary")).toContainText(
      "分组卡片: 2 · 展开成员镜像: 3",
    );
    await expect(page.locator(".group-projection-summary")).toContainText(
      "不包含在事实查询预算中",
    );
    await expect(
      page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
    ).toHaveCount(2);
    await expect(
      page.locator(`.code-card[data-domain-id="${alpha.id}"]`).first(),
    ).toContainText("同一函数镜像");
    await page
      .getByRole("combobox", { name: "选择规划", exact: true })
      .selectOption(plan.plan.id);
    await page.getByRole("button", { name: "确认此规划", exact: true }).click();
    await expect(page.locator(".plan-overview")).toContainText("当前批准有效");
    await card(g1.id)
      .getByRole("button", { name: "折叠 G1", exact: true })
      .click();
    await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
    await expect(card(g1.id)).toContainText("1 已加载内部调用");
    await expect(
      page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
    ).toHaveCount(1);
    await card(g2.id)
      .getByRole("button", { name: "折叠 G2", exact: true })
      .click();
    await expect(card(g2.id)).toHaveAttribute("data-collapsed", "true");
    const firstBounds = await card(g1.id).boundingBox(),
      secondBounds = await card(g2.id).boundingBox();
    expect(firstBounds).not.toBeNull();
    expect(secondBounds).not.toBeNull();
    expect(
      Math.min(
        firstBounds!.y + firstBounds!.height,
        secondBounds!.y + secondBounds!.height,
      ) - Math.max(firstBounds!.y, secondBounds!.y),
    ).toBeLessThanOrEqual(0);

    await expect(
      page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
    ).toHaveCount(0);
    await expect(
      card(g1.id).locator(`.group-endpoint[data-domain-id="${alpha.id}"]`),
    ).toContainText("one/a.ts");
    const graph = await http(
      server.url,
      `/api/projects/${project.id}/subgraph`,
      "POST",
      { nodeIds: [alpha.id, beta.id, outside.id], depth: 1, budget: 100 },
    );
    const relation = graph.relations.find(
      (r) => r.sourceId === alpha.id && r.targetId === outside.id,
    );
    expect(relation).toBeTruthy();
    const projected = page.locator(
      `.react-flow__edge[data-id^="group-edge:fact:${relation.id}:"]`,
    );
    await expect(projected).toHaveCount(2);
    await page.getByRole("button", { name: "适应画布", exact: true }).click();
    const clickPoint = await projected
      .first()
      .locator(".react-flow__edge-interaction")
      .evaluate((path: SVGPathElement) => {
        const matrix = path.getScreenCTM()!,
          length = path.getTotalLength(),
          id = path.closest(".react-flow__edge")!.getAttribute("data-id");
        for (let fraction = 0.1; fraction < 0.95; fraction += 0.05) {
          const point = path
            .getPointAtLength(length * fraction)
            .matrixTransform(matrix);
          if (
            document
              .elementFromPoint(point.x, point.y)
              ?.closest(".react-flow__edge")
              ?.getAttribute("data-id") === id
          )
            return { x: point.x, y: point.y };
        }
        throw new Error(
          "No unobstructed real click point on the requested relation",
        );
      });
    await page.mouse.click(clickPoint.x, clickPoint.y);
    const evidence = page.getByRole("region", {
      name: "调用证据",
      exact: true,
    });
    await expect(evidence).toBeVisible();
    await expect(evidence).toContainText("alpha");
    await expect(evidence).toContainText("outside");
    await expect(evidence).toContainText(
      `${relation.evidence.filePath}:${relation.evidence.line}`,
    );
    await expect(evidence).toContainText(relation.id);
    await page.screenshot({
      path: resolve("artifacts/e2e/grp02-collapsed-endpoints.png"),
      fullPage: true,
    });
    await evidence
      .getByRole("button", { name: "查看调用方", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "引用详情", exact: true }),
    ).toContainText("alpha");
    await expect(
      page.getByRole("region", { name: "引用详情", exact: true }),
    ).toContainText("one/a.ts");
    await page
      .getByRole("region", { name: "引用详情", exact: true })
      .getByRole("button", { name: "查看源码", exact: true })
      .click();
    await expect(page.getByTestId("inspection-source")).toContainText(
      "return outside()",
    );
    await page.keyboard.press("Escape");
    const box = await card(g1.id).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 30, box!.y + 14);
    await page.mouse.down();
    await page.mouse.move(box!.x + 120, box!.y + 70, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(async () => {
        const view = await http(
          server!.url,
          `/api/projects/${project.id}/view`,
        );
        return Object.keys(view.positions).includes(`group:${g1.id}`);
      })
      .toBe(true);
    const saved = await http(server.url, `/api/projects/${project.id}/view`);
    expect(saved.collapsedGroupIds.sort()).toEqual([g1.id, g2.id].sort());
    expect((await http(server.url, `/api/plans/${plan.plan.id}`)).valid).toBe(
      true,
    );
    await page.getByRole("button", { name: "圈选函数", exact: true }).click();
    await expect(page.locator(".group-card")).toHaveCount(0);
    await expect(
      page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "完成圈选", exact: true }).click();
    await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
    await page.reload();
    await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
    const port = server.port;
    await server.stop();
    server = await startProduction(data, port);
    await page.reload();
    await expect(card(g1.id)).toHaveAttribute("data-collapsed", "true");
    await expect(card(g2.id)).toHaveAttribute("data-collapsed", "true");
    expect(
      (await http(server.url, `/api/projects/${project.id}/view`)).positions,
    ).toEqual(saved.positions);
    await card(g1.id)
      .getByRole("button", { name: "展开 G1", exact: true })
      .click();
    await expect(
      page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
    ).toHaveCount(1);
    await card(g2.id)
      .getByRole("button", { name: "展开 G2", exact: true })
      .click();
    await expect(
      page.locator(`.code-card[data-domain-id="${alpha.id}"]`),
    ).toHaveCount(2);
    await page.getByRole("button", { name: "适应画布", exact: true }).click();
    await page.screenshot({
      path: resolve("artifacts/e2e/grp02-expanded-shared.png"),
      fullPage: true,
    });
    // Alias inspection and new planning handles must resolve domain IDs, never view IDs.
    await page
      .getByRole("combobox", { name: "选择规划", exact: true })
      .selectOption(plan.plan.id);
    await page.getByRole("button", { name: "适应画布", exact: true }).click();
    await page
      .locator(
        `.code-card[data-group-id="${g1.id}"][data-domain-id="${alpha.id}"]`,
      )
      .click();
    await expect(
      page.getByRole("region", { name: "引用详情", exact: true }),
    ).toContainText("one/a.ts");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "适应画布", exact: true }).click();
    await page
      .getByRole("combobox", { name: "新增/改接关系类型", exact: true })
      .selectOption("must_call");
    const sourceHandle = page.locator(
        `.react-flow__node[data-id="group-member:${g1.id}:${alpha.id}"] .react-flow__handle.source`,
      ),
      targetHandle = page.locator(
        `.react-flow__node[data-id="fact:${outside.id}"] .react-flow__handle.target`,
      );
    const sourceBox = await sourceHandle.boundingBox(),
      targetBox = await targetHandle.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await page.mouse.move(
      sourceBox!.x + sourceBox!.width / 2,
      sourceBox!.y + sourceBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + targetBox!.height / 2,
      { steps: 16 },
    );
    await page.mouse.up();
    await expect
      .poll(async () => {
        const updated = await http(server!.url, `/api/plans/${plan.plan.id}`);
        return updated.plan.operations.some(
          (op) =>
            op.kind === "add_relation" &&
            op.sourceId === alpha.id &&
            op.targetId === outside.id &&
            op.type === "must_call",
        );
      })
      .toBe(true);
    for (let i = 0; i < paths.length; i++)
      expect(await readFile(join(target, paths[i]!))).toEqual(before[i]);
    expect((await readdir(target)).sort()).toEqual([
      "caller.ts",
      "one",
      "outside.ts",
      "two",
    ]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  } finally {
    await server?.stop();
    await rm(root, { recursive: true, force: true });
  }
});
