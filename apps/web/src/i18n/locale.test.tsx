import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider, dictionaries } from "./index.js";
import { PlanningPanel } from "../features/planning/PlanningPanel.js";
import { projectGraph } from "../features/graph/projection.js";
it("English and Chinese render complete planning controls without translating authored names", () => {
  const props = {
    plans: [],
    busy: false,
    onChoose: () => {},
    onCreate: () => {},
    onSave: () => {},
    onValidate: () => {},
    onApprove: () => {},
    onExport: () => {},
    onClearEdge: () => {},
    nodes: [],
  };
  const en = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <PlanningPanel {...props} />
    </LocaleProvider>,
  );
  const zh = renderToStaticMarkup(
    <LocaleProvider locale="zh">
      <PlanningPanel {...props} />
    </LocaleProvider>,
  );
  expect(en).toContain("Create plan");
  expect(en).not.toMatch(/[\u3400-\u9fff]/);
  expect(zh).toContain("创建规划");
  expect(Object.keys(dictionaries.en).sort()).toEqual(
    Object.keys(dictionaries.zh).sort(),
  );
  expect(
    Object.values(dictionaries.en).every(
      (v) => v.trim() && !/[\u3400-\u9fff]/.test(v),
    ),
  ).toBe(true);
});
it("English graph changes translate labels while preserving authored annotation and paths", () => {
  const graph = projectGraph(
    {
      nodes: [
        { id: "f", kind: "function", name: "原名", filePath: "src/原名.ts" },
      ],
      relations: [],
      snapshotId: "s",
      dataSource: "code",
      truncated: false,
    },
    [
      { kind: "annotate", targetId: "f", text: "原始说明" },
      { kind: "remove_function", nodeId: "f" },
    ],
    "both",
    {},
    "en",
  );
  expect(graph.nodes[0]?.data.node.name).toBe("原名");
  expect(graph.nodes[0]?.data.changes).toContain("Annotation · 原始说明");
  expect(graph.nodes[0]?.data.changes).toContain("− Planned removal");
});

it("cached failure help follows current locale while backend diagnostics remain verbatim", async () => {
  const { createWorkspace } = await import("../app/workspace.js");
  const { HttpApi } = await import("../api/client.js");
  const { App } = await import("../app/App.js");
  for (const status of [409, 503]) {
    const app = createWorkspace(
      new HttpApi(
        (async () =>
          new Response(
            JSON.stringify({
              code: "DOMAIN_FAILURE",
              message: "Original backend diagnosis",
            }),
            { status },
          )) as typeof fetch,
      ),
    );
    await app.openProject("/fixture");
    app.store.getInitialState = app.store.getState;
    const render = () => renderToStaticMarkup(<App workspace={app} />);
    expect(render()).toContain(
      dictionaries.zh[status === 409 ? "conflictHelp" : "retryHelp"],
    );
    app.store.setState({
      view: { positions: {}, theme: "light", locale: "en" },
    });
    expect(render()).toContain("Original backend diagnosis");
    expect(render()).toContain(
      dictionaries.en[status === 409 ? "conflictHelp" : "retryHelp"],
    );
    expect(render()).not.toContain(dictionaries.zh.retryHelp);
    expect(render()).not.toContain(dictionaries.zh.conflictHelp);
  }
});
it("snapshot mismatch member help is rendered in the current locale", async () => {
  const { createWorkspace } = await import("../app/workspace.js");
  const { GroupsPanel } = await import("../features/groups/GroupsPanel.js");
  const { readMembers } = await import("../features/groups/memberBindings.js");
  const bindings = await readMembers(["f"], 0, "current", async () => ({
    snapshotId: "old",
    node: { id: "f", kind: "function", name: "f" },
  }));
  const app = createWorkspace();
  app.store.setState({
    groups: [
      {
        id: "g",
        projectId: "p",
        title: "Group",
        description: "",
        source: "user",
        memberIds: ["f"],
      },
    ],
    memberPage: { groupId: "g", offset: 0, bindings },
  });
  app.store.getInitialState = app.store.getState;
  const render = (locale: "zh" | "en") =>
    renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <GroupsPanel app={app} />
      </LocaleProvider>,
    );
  expect(render("zh")).toContain("快照已变化");
  expect(render("en")).toContain("Snapshot changed");
});
it("a snapshot change after member lookup renders local help without translating backend errors", async () => {
  const { createWorkspace } = await import("../app/workspace.js");
  const { HttpApi } = await import("../api/client.js");
  const { App } = await import("../app/App.js");
  const app = createWorkspace(
    new HttpApi(
      (async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith("/summary")
              ? { snapshotId: "changed" }
              : {
                  snapshotId: "current",
                  node: { id: "f", kind: "function", name: "f" },
                },
          ),
        )) as typeof fetch,
    ),
  );
  app.store.setState({
    project: { id: "p", path: "/p", name: "p" },
    summary: { snapshotId: "current" } as never,
    groups: [
      {
        id: "g",
        projectId: "p",
        title: "g",
        description: "",
        source: "user",
        memberIds: ["f"],
      },
    ],
  });
  await app.loadMembers("g");
  expect(app.store.getState().error).toBe("SNAPSHOT_CHANGED");
  // Render only the error shell; summary intentionally contains no unrelated graph data.
  app.store.setState({ project: undefined, summary: undefined });
  app.store.getInitialState = app.store.getState;
  expect(renderToStaticMarkup(<App workspace={app} />)).toContain("快照已变化");
  app.store.setState({ view: { positions: {}, theme: "light", locale: "en" } });
  expect(renderToStaticMarkup(<App workspace={app} />)).toContain(
    "Snapshot changed",
  );
});
