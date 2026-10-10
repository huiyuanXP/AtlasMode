import { expect, test } from "vitest";
import { readResponse, ApiRunError } from "./responses-stream.js";

const output = [
  {
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text: "你好" }],
  },
];
const event = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
function response(text: string, step = 7) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += step)
          controller.enqueue(bytes.slice(i, i + step));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}
const completed = (items: unknown[] = output) =>
  event({
    type: "response.completed",
    response: { status: "completed", output: items },
  });
test("fragmented UTF8 CRLF SSE streams public text before completion and preserves reasoning output", async () => {
  const chunks: string[] = [];
  const items = [
    ...output,
    { type: "reasoning", encrypted_content: "private", summary: [] },
  ];
  const result = await readResponse(
    response(
      ": heartbeat\r\n\r\n" +
        event({
          type: "response.output_text.delta",
          output_index: 0,
          content_index: 0,
          delta: "你好",
        }) +
        event({
          type: "response.reasoning_summary_text.delta",
          delta: "hidden",
        }) +
        completed(items),
    ),
    new AbortController().signal,
    { remaining: 10240 },
    (text) => chunks.push(text),
  );
  expect(chunks).toEqual(["你好"]);
  expect(result).toEqual(items);
});
test("completed final text fallback is emitted once", async () => {
  const chunks: string[] = [];
  await readResponse(
    response(completed()),
    new AbortController().signal,
    { remaining: 10240 },
    (text) => chunks.push(text),
  );
  expect(chunks).toEqual(["你好"]);
});
test.each([
  [
    event({
      type: "response.output_text.delta",
      output_index: 0,
      content_index: 0,
      delta: "partial",
    }),
    "AGENT_PROTOCOL",
  ],
  ["data: {broken}\n\n", "AGENT_PROTOCOL"],
  [event({ type: "error", message: "secret-provider-error" }), "AGENT_FAILED"],
  [
    event({ type: "response.incomplete", response: { status: "incomplete" } }),
    "AGENT_PROTOCOL",
  ],
  [
    event({ type: "response.failed", response: { status: "failed" } }),
    "AGENT_FAILED",
  ],
])(
  "rejects incomplete/error protocol without exposing provider body",
  async (wire, code) => {
    await expect(
      readResponse(
        response(wire),
        new AbortController().signal,
        { remaining: 10240 },
        () => {},
      ),
    ).rejects.toEqual(new ApiRunError(code));
  },
);
test("byte budget applies across responses including hidden output", async () => {
  await expect(
    readResponse(
      response(completed()),
      new AbortController().signal,
      { remaining: 10 },
      () => {},
    ),
  ).rejects.toEqual(new ApiRunError("AGENT_OUTPUT_LIMIT"));
});
test("non SSE response fails closed", async () => {
  await expect(
    readResponse(
      new Response("{}"),
      new AbortController().signal,
      { remaining: 10240 },
      () => {},
    ),
  ).rejects.toEqual(new ApiRunError("AGENT_PROTOCOL"));
});
test("streamed text must agree with final completed public output", async () => {
  await expect(
    readResponse(
      response(
        event({
          type: "response.output_text.delta",
          output_index: 0,
          content_index: 0,
          delta: "different",
        }) + completed(),
      ),
      new AbortController().signal,
      { remaining: 10240 },
      () => {},
    ),
  ).rejects.toEqual(new ApiRunError("AGENT_PROTOCOL"));
});
test("SSE supports lone carriage return framing split at any byte", async () => {
  const chunks: string[] = [];
  await readResponse(
    response(completed().replace(/\r\n/g, "\r"), 1),
    new AbortController().signal,
    { remaining: 10240 },
    (text) => chunks.push(text),
  );
  expect(chunks).toEqual(["你好"]);
});
