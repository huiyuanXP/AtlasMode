import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspace } from "../../app/workspace.js";
import { LocaleProvider } from "../../i18n/index.js";
import { GroupsPanel } from "./GroupsPanel.js";
function render(snapshotId: string) {
  const app = createWorkspace();
  app.store.setState({
    project: { id: "p", path: "/p", name: "p" },
    summary: {
      snapshotId: "current",
      entrypoints: [
        {
          id: "f",
          kind: "function",
          name: "Recovered function",
          filePath: "a.ts",
        },
      ],
    } as never,
    groupDraft: {
      id: "g",
      title: "g",
      description: "",
      source: "user",
      memberIds: ["f"],
    },
    memberPage: {
      groupId: "g",
      offset: 0,
      snapshotId,
      bindings: [{ id: "f", status: "missing" }],
    },
  });
  app.store.getInitialState = app.store.getState;
  return renderToStaticMarkup(
    <LocaleProvider locale="en">
      <GroupsPanel app={app} />
    </LocaleProvider>,
  );
}
it("ignores missing bindings from an older snapshot so recovered members can be saved", () => {
  const html = render("old");
  expect(html).not.toContain('disabled="">Save group</button>');
  expect(html).not.toContain(
    "Missing function; remove explicitly before saving",
  );
});
it("retains current missing member ID and requires explicit removal before saving", () => {
  const html = render("current");
  expect(html).toContain('disabled="">Save group</button>');
  expect(html).toContain("Missing function; remove explicitly before saving");
  expect(html).toContain("Remove member");
});
