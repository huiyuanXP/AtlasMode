import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { Canvas } from "./Canvas.js";
import { LocaleProvider } from "../../i18n/index.js";
import * as projection from "./projection.js";
import * as groups from "../groups/projection.js";
const base: ComponentProps<typeof Canvas> = {
  projectId: "p",
  operations: [],
  view: { positions: {}, collapsedGroupIds: [], theme: "light", locale: "en" },
  filter: "fact",
  onFunnel: () => {},
  onExitFunnel: () => {},
  canEdit: false,
  relationType: "calls",
  onSelect: () => {},
  onLayout: () => {},
  onEdge: () => {},
  onConnect: () => {},
};
const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <LocaleProvider locale="en">
      <Canvas {...base} {...props} />
    </LocaleProvider>,
  );
describe("overview Canvas controls and refusal", () => {
  it("shows both explicit overview actions with current-view replacement scope", () => {
    const html = render();
    expect(html).toContain("Recompute project auto layout");
    expect(html).toContain("Rearrange current view");
    expect(html).toContain("Other positions are retained");
  });
  it("renders a refused raw scope empty without allocating projected cards", () => {
    const p = vi.spyOn(projection, "projectGraph"),
      g = vi.spyOn(groups, "projectGroups");
    const html = render({
      graph: {
        snapshotId: "s",
        dataSource: "code",
        truncated: false,
        nodes: Array.from({ length: 301 }, (_, i) => ({
          id: String(i),
          name: String(i),
          kind: "function",
        })),
        relations: [],
      },
    });
    expect(html).toContain("Scope incomplete");
    expect(html).toContain("301");
    expect(p).not.toHaveBeenCalled();
    expect(g).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("states exact global target facts separately from visible card scope", () => {
    const html = render({
      overviewLayout: {
        status: "rejected",
        reason: "node_budget",
        target: { counts: { nodes: 5001, relations: 200 } },
      },
    });
    expect(html).toContain("5001");
    expect(html).toContain("200");
    expect(html).toContain("node_budget");
    expect(html).toContain("Current display");
  });
  it("disables overview actions for accepted ownership mode and unsaved editing", () => {
    const html = render({
      overviewBlocked: true,
      ownershipMode: true,
      onRecomputeProjectLayout: () => {},
      layoutCapture: {
        projectId: "p",
        snapshotId: "s",
        viewGeneration: 1,
        projectionGeneration: 1,
      },
    });
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Recompute project auto layout<\/button>/,
    );
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Rearrange current view<\/button>/,
    );
  });
});

it("labels complete group route estimates as an upper bound rather than emitted counts", () => {
  const groups = Array.from({ length: 120 }, (_, i) => ({
    id: "G" + i,
    projectId: "p",
    title: "G" + i,
    description: "",
    source: "user",
    memberIds: ["0", "1"],
  }));
  const html = render({
    graph: {
      snapshotId: "s",
      dataSource: "code",
      truncated: false,
      nodes: [
        { id: "0", name: "0", kind: "function" },
        { id: "1", name: "1", kind: "function" },
      ],
      relations: [
        {
          id: "r",
          sourceId: "0",
          targetId: "1",
          type: "calls",
          resolution: "resolved",
          evidence: { filePath: "a.ts", line: 1 },
        },
      ],
    },
    groups,
    view: { ...base.view, collapsedGroupIds: groups.map((g) => g.id) },
  });
  expect(html).toContain("projection_work");
  expect(html).toContain("Conservative route upper bound");
  expect(html).toContain("241");
  expect(html).not.toContain("Exact count 120/241");
});
