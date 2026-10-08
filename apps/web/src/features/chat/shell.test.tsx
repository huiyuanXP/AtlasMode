import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkspace } from "../../app/workspace.js";
import { WorkspacePanels } from "../../app/WorkspacePanels.js";
import { LocaleProvider } from "../../i18n/index.js";
import { createChatSessions } from "./sessions.js";
it("default shell has separate exploration and planning conversations without default technical forms", () => {
  const app = createWorkspace();
  app.store.setState({
    project: { id: "p", name: "project", path: "/project" },
    view: { positions: {}, locale: "en", theme: "light" },
  });
  app.store.getInitialState = () => app.store.getState();
  const sessions = createChatSessions();
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <WorkspacePanels app={app} chatSessions={sessions} />
    </LocaleProvider>,
  );
  expect(html).toContain('aria-label="Explore code"');
  expect(html).toContain('aria-label="Discuss a plan"');
  expect(html).toContain("Local Agent disconnected");
  expect(html).toContain("View source");
  expect(html).toContain("Advanced editing");
  expect(html).toContain("Browse code");
  expect(html).not.toContain('class="plan-editor"');
  expect(html).not.toContain("New plan title");
  expect(html).not.toContain("Create group");
  expect(html).not.toContain("Save directory policy");
  expect(html).not.toContain("source-snippet");
  sessions.dispose();
});
