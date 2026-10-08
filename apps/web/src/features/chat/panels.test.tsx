import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../../i18n/index.js";
import { ChatPanel } from "./ChatPanel.js";
import { createChatController } from "./controller.js";
import { PlanOverview } from "../planning/PlanOverview.js";
import type { ChatTransport } from "./types.js";
it("disconnected chat is honest and tool activities are translated without raw protocol", () => {
  const controller = createChatController({} as ChatTransport, "p", "explore");
  controller.store.setState({
    connection: {
      provider: "codex",
      configured: true,
      available: false,
      reason: "Not logged in",
    },
    run: {
      runId: "r",
      status: "failed",
      messages: [],
      activity: [
        { tool: "get_function_context", status: "completed" },
        { tool: "unexpected_tool", status: "running" },
      ],
      errors: [],
      changedPlanIds: ["partial"],
      mayHaveSavedChanges: true,
    },
  });
  // SSR consumes the store initial snapshot; use this scenario as that snapshot.
  controller.store.getInitialState = () => controller.store.getState();
  const html = renderToStaticMarkup(
    <ChatPanel
      controller={controller}
      locale="en"
      context={() => ({})}
      onSend={() => () => {}}
    />,
  );
  expect(html).toContain("Local Agent disconnected");
  expect(html).toContain("Read function context");
  expect(html).toContain("Changes may have been saved");
  expect(html).not.toContain("get_function_context");
  expect(html).not.toContain("unexpected_tool");
  expect(html).not.toContain("Not logged in");
  expect(html).toContain("textarea");
});
it("plan overview presents readable changes and confirmation actions without raw schemas", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <PlanOverview
        plans={[]}
        detail={{
          plan: {
            id: "p",
            projectId: "project",
            title: "Retry notes",
            revision: 2,
            status: "draft",
            description: "",
            baselineSnapshotId: "s",
            baselineContentHash: "h",
            createdAt: "now",
            updatedAt: "now",
            operations: [
              {
                kind: "add_function",
                tempId: "t",
                name: "fetchNotes",
                filePath: "src/notes.ts",
              },
              {
                kind: "add_relation",
                id: "r",
                sourceId: "t",
                targetId: "retry",
                type: "must_reuse",
              },
            ],
          },
          valid: false,
          issues: [],
        }}
        nodes={[
          {
            id: "retry",
            kind: "function",
            name: "requestWithRetry",
            filePath: "src/http.ts",
          },
        ]}
        busy={false}
        canUndo
        canRedo={false}
        onChoose={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        onValidate={() => {}}
        onApprove={() => {}}
        onExport={() => {}}
        onVerify={() => {}}
      />
    </LocaleProvider>,
  );
  expect(html).toContain("fetchNotes");
  expect(html).toContain("requestWithRetry");
  expect(html).toContain("Confirm current revision");
  expect(html).toContain("Export Markdown");
  expect(html).toContain("Choose plan");
  expect(html).not.toContain("tempId");
  expect(html).not.toContain("sourceId");
  expect(html).not.toContain("baselineSnapshotId");
  expect(html).not.toContain("add_relation");
});
