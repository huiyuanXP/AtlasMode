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

it("ownership makes only real loaded function endpoints draggable, preserving default inspection and excluding unknown members", () => {
  const member = {
    id: "real:a",
    kind: "function" as const,
    name: "alpha",
    filePath: "src/a.ts",
  };
  const group = {
    id: "group-alias",
    title: "G",
    total: 2,
    loadedMembers: [member],
    unknownMembers: 1,
    collapsed: true,
    portIds: [member.id, "unknown"],
    internalRelationIds: [],
    plannedInternalIds: [],
  };
  const render = (enabled: boolean) =>
    renderToStaticMarkup(
      <GroupCardContent
        group={group}
        locale="en"
        onToggle={() => {}}
        onSelect={() => {}}
        ownershipEnabled={enabled}
        onOwnershipStart={() => "captured-nonce"}
      />,
    );
  expect(render(false)).toContain('draggable="false"');
  const html = render(true);
  expect(html).toContain('draggable="true"');
  expect(html).toContain('data-domain-id="real:a"');
  expect(html).not.toContain('data-domain-id="group-alias"');
  expect(html).not.toContain('data-domain-id="unknown"');
  expect((html.match(/class="group-endpoint /g) ?? []).length).toBe(1);
});
