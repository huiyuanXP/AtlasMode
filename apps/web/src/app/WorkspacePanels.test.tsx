import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspace } from "./workspace.js";
import { PlanningPanel } from "../features/planning/PlanningPanel.js";
import { LocaleProvider } from "../i18n/index.js";
import { planningCandidates } from "./WorkspacePanels.js";

it("reconnect candidates include searched and entry functions outside the bounded current graph", () => {
  const app = createWorkspace();
  const a = { id: "a", kind: "function" as const, name: "A", filePath: "a.ts" };
  const b = { id: "b", kind: "function" as const, name: "B", filePath: "b.ts" };
  const c = {
    id: "c",
    kind: "function" as const,
    name: "searchedC",
    filePath: "c.ts",
  };
  const state = {
    ...app.store.getState(),
    graph: {
      nodes: [a],
      relations: [],
      snapshotId: "s",
      dataSource: "code" as const,
      truncated: false,
    },
    summary: { snapshotId: "s", entrypoints: [b] } as never,
    search: { snapshotId: "s", items: [c, b] } as never,
  };
  const candidates = planningCandidates(state);
  expect(candidates.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  expect(
    planningCandidates({
      ...state,
      search: { ...state.search, snapshotId: "old" } as never,
    }).map((n) => n.id),
  ).not.toContain("c");
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <PlanningPanel
        plans={[]}
        detail={{
          plan: {
            id: "p",
            projectId: "project",
            title: "Reconnect",
            description: "",
            revision: 1,
            operations: [],
            status: "draft",
            baselineSnapshotId: "s",
            baselineContentHash: "h",
            createdAt: "now",
            updatedAt: "now",
          },
          valid: false,
          issues: [],
        }}
        nodes={candidates}
        busy={false}
        onChoose={() => {}}
        onCreate={() => {}}
        onSave={() => {}}
        onValidate={() => {}}
        onApprove={() => {}}
        onExport={() => {}}
        onClearEdge={() => {}}
      />
    </LocaleProvider>,
  );
  expect(html).toContain('value="b"');
  expect(html).toContain('value="c"');
});
