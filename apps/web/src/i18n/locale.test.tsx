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
