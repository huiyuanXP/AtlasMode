import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InspectionCard } from "./InspectionCard.js";
const node = {
  id: "a",
  kind: "function" as const,
  name: "same",
  filePath: "a.ts",
};
const peer = {
  id: "b",
  kind: "function" as const,
  name: "same",
  filePath: "b.ts",
};
const props = {
  node,
  locale: "en" as const,
  busy: false,
  planned: false,
  operations: [],
  onClose: () => {},
  onPage: () => {},
  onJump: () => {},
  onPreview: () => {},
  onSource: () => {},
};
it("resolved calls retain their unique evidence and exact same-name endpoint paths", () => {
  const html = renderToStaticMarkup(
    <InspectionCard
      {...props}
      context={{
        node,
        relatedNodes: [peer],
        incoming: [],
        outgoing: [1, 2].map((line) => ({
          id: `call${line}`,
          sourceId: "a",
          targetId: "b",
          type: "calls",
          resolution: "resolved",
          evidence: { filePath: "a.ts", line },
        })),
        totalIncoming: 0,
        totalOutgoing: 2,
        offset: 0,
        limit: 50,
        truncated: false,
        dataSource: "code",
        snapshotId: "s",
      }}
    />,
  );
  expect(html).toContain('data-relation-id="call1"');
  expect(html).toContain('data-relation-id="call2"');
  expect(html).toContain("b.ts");
  expect(html).toContain("Calls from this function");
});
it("planned functions present plan relationships with a planned target file", () => {
  const html = renderToStaticMarkup(
    <InspectionCard
      {...props}
      planned
      operations={[
        { kind: "add_function", tempId: "a", name: "same", filePath: "a.ts" },
        {
          kind: "add_relation",
          id: "planned-edge",
          sourceId: "a",
          targetId: "b",
          type: "must_reuse",
        },
      ]}
      relatedNodes={[peer]}
    />,
  );
  expect(html).toContain('data-relation-id="planned-edge"');
  expect(html).toContain("Planned target file");
  expect(html).not.toContain('data-action="source"');
});
