import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OwnershipTargets, type TargetLabels } from "./OwnershipTargets.js";
const labels: TargetLabels = {
  title: "Structure targets",
  loading: "Loading",
  unavailable: "Unavailable",
  missing: "Planned path",
  truncated: "Loaded sample; more targets omitted",
  fact: "Fact",
  planned: "Planned",
  choose: "Choose",
  browse: "Browse",
};
it("discloses bounded facts/planned targets and preserves full-path distinctions", () => {
  const html = renderToStaticMarkup(
    <OwnershipTargets
      labels={labels}
      state={{
        status: "ready",
        request: { projectId: "p", snapshotId: "S0", path: ".", budget: 100 },
        scope: {
          snapshotId: "S0",
          path: ".",
          kind: "folder",
          dataSource: "code",
          truncated: true,
          nodes: [
            {
              id: "a",
              kind: "file",
              name: "index.ts",
              filePath: "src/index.ts",
            },
          ],
          relations: [],
        },
      }}
      plannedTargets={[{ kind: "file", path: "dest/index.ts", planned: true }]}
      onChoose={() => {}}
      onBrowse={() => {}}
      onDrop={() => {}}
    />,
  );
  expect(html).toContain("src/index.ts");
  expect(html).toContain("dest/index.ts");
  expect(html).toContain("more targets omitted");
  expect(html).toContain("Fact");
  expect(html).toContain("Planned");
});
it("a stale/unavailable scope exposes no active planned drop targets", () => {
  const html = renderToStaticMarkup(
    <OwnershipTargets
      labels={labels}
      state={{ status: "error" }}
      plannedTargets={[{ kind: "file", path: "dest.ts" }]}
      onChoose={() => {}}
      onBrowse={() => {}}
      onDrop={() => {}}
    />,
  );
  expect(html).toContain("Unavailable");
  expect(html).not.toContain("dest.ts");
  expect(html).toContain('<button type="button" disabled="">.</button>');
});

it.each(["idle", "loading", "ready"] as const)(
  "a requestless %s tray keeps a disabled root breadcrumb and no active planned targets",
  (status) => {
    const html = renderToStaticMarkup(
      <OwnershipTargets
        labels={labels}
        state={{ status }}
        plannedTargets={[
          { kind: "file", path: "not-authorized.ts", planned: true },
        ]}
        onChoose={() => {
          throw new Error("Unavailable target cannot choose");
        }}
        onBrowse={() => {
          throw new Error("Unavailable target cannot browse");
        }}
        onDrop={() => {
          throw new Error("Unavailable target cannot drop");
        }}
      />,
    );
    expect(html).toContain('<button type="button" disabled="">.</button>');
    expect(html).not.toContain("not-authorized.ts");
    if (status === "loading") expect(html).toContain('role="status">Loading');
  },
);
