import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { GroupCardContent } from "./GroupCard.js";
it("shows loaded scope, mirrored identity and real external endpoints without claiming a complete neighborhood", () => {
  const member = {
    id: "real:a",
    kind: "function" as const,
    name: "alpha",
    filePath: "src/a.ts",
  };
  const html = renderToStaticMarkup(
    <GroupCardContent
      group={{
        id: "g",
        title: "G",
        total: 3,
        loadedMembers: [member],
        unknownMembers: 2,
        collapsed: true,
        portIds: [member.id],
        internalRelationIds: ["call"],
        plannedInternalIds: ["planned"],
      }}
      locale="en"
      onToggle={() => {}}
      onSelect={() => {}}
    />,
  );
  expect(html).toContain("1 / 3");
  expect(html).toContain("2 not loaded");
  expect(html).toContain("1 loaded internal calls");
  expect(html).toContain("Expand G");
  expect(html).toContain("src/a.ts");
  expect(html).toContain("Same function mirrored");
});
