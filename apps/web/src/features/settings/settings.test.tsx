import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsDialog, type SettingsTransport } from "./SettingsDialog.js";
import { toThreadMessages } from "../chat/ChatPanel.js";

const api = {} as SettingsTransport;
it("settings dialog renders the three providers with an honest key note", () => {
  const html = renderToStaticMarkup(
    <SettingsDialog api={api} locale="en" open={false} onClose={() => {}} onApplied={() => {}} />,
  );
  expect(html).toContain("Codex CLI");
  expect(html).toContain("Claude Code CLI");
  expect(html).toContain("Responses API");
  expect(html).toContain('type="password"');
});
it("maps run activity to tool-call parts on the assistant turn", () => {
  const out = toThreadMessages(
    [
      { role: "user", text: "hi" },
      { role: "assistant", text: "ok" },
    ],
    {
      runId: "r",
      status: "running",
      messages: [],
      activity: [
        { tool: "get_plan", status: "completed" },
        { tool: "propose_plan", status: "running" },
        { tool: "x", status: "failed" },
      ],
      errors: [],
      changedPlanIds: [],
      mayHaveSavedChanges: false,
    },
    true,
  );
  const parts = out[1]!.content as { type: string; result?: string; isError?: boolean }[];
  expect(parts.filter((p) => p.type === "tool-call")).toHaveLength(3);
  expect(parts[1]!.result).toBeUndefined();
  expect(parts[2]!.isError).toBe(true);
  expect(toThreadMessages([{ role: "user", text: "q" }], { ...({} as never), activity: [{ tool: "a", status: "running" }] }, true).at(-1)!.role).toBe("assistant");
});
