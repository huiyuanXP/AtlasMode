import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatPanel } from "./ChatPanel.js";
import { createChatController } from "./controller.js";
import type { ChatTransport } from "./types.js";
test("direct API connection labels Responses API accurately", () => {
  const controller = createChatController(
    {} as ChatTransport,
    "project",
    "plan",
  );
  controller.store.setState({
    connection: {
      provider: "responses",
      configured: true,
      available: true,
      model: "fixture-model",
    },
  });
  controller.store.getInitialState = () => controller.store.getState();
  const html = renderToStaticMarkup(
    <ChatPanel
      controller={controller}
      locale="en"
      context={() => ({})}
      onSend={() => () => {}}
    />,
  );
  expect(html).toContain("Responses API");
  expect(html).not.toContain("Claude");
});
