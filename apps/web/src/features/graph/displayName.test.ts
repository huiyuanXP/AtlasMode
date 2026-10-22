import { expect, it } from "vitest";
import { displayName, displaySegment, splitQualified } from "./displayName.js";

const zh = { callback: "回调", anonymous: "匿名函数" };
const en = { callback: "callback", anonymous: "anonymous" };
const cb = (text: string, index = 1) =>
  `<callback:${JSON.stringify([[80, text]])}:${index}>`;

it("turns a callback identity into the receiving call and a label", () => {
  expect(displaySegment(cb("describe"), en)).toBe("describe(…) callback");
  expect(displaySegment(cb("it"), zh)).toBe("it(…) 回调");
});

it("rebuilds member calls from their token text", () => {
  const name = `<callback:${JSON.stringify([
    [80, "page"],
    [25, "."],
    [80, "on"],
  ])}:1>`;
  expect(displaySegment(name, en)).toBe("page.on(…) callback");
});

it("keeps ordinary names and malformed callbacks untouched", () => {
  expect(displaySegment("createServer", en)).toBe("createServer");
  expect(displaySegment("<callback:not json:1>", en)).toBe(
    "<callback:not json:1>",
  );
  expect(displaySegment("<callback:[]:1>", en)).toBe("<callback:[]:1>");
  expect(displaySegment("<callback:[[80,5]]:1>", en)).toBe(
    "<callback:[[80,5]]:1>",
  );
});

it("labels anonymous functions", () => {
  expect(displaySegment("<anonymous>", zh)).toBe("匿名函数");
  expect(displaySegment("<anonymous>", en)).toBe("anonymous");
});

it("truncates a very long callee", () => {
  const out = displaySegment(cb("a".repeat(100)), en);
  expect(out.startsWith("a".repeat(39) + "…(…)")).toBe(true);
});

it("splits qualified names without breaking dots inside callbacks", () => {
  const member = `<callback:${JSON.stringify([
    [80, "server"],
    [25, "."],
    [80, "close"],
  ])}:0>`;
  const qualified = `${cb("test")}.<anonymous>.${member}`;
  expect(splitQualified(qualified)).toEqual([
    cb("test"),
    "<anonymous>",
    member,
  ]);
  expect(splitQualified("Class.method")).toEqual(["Class", "method"]);
});

it("does not split on dots or angle brackets inside string tokens", () => {
  const tricky = `<callback:${JSON.stringify([[11, '"a.b>c"']])}:0>`;
  expect(splitQualified(`${tricky}.inner`)).toEqual([tricky, "inner"]);
});

it("renders a whole qualified path readably", () => {
  const member = `<callback:${JSON.stringify([
    [80, "server"],
    [25, "."],
    [80, "close"],
  ])}:0>`;
  expect(displayName(`${cb("test")}.<anonymous>.${member}`, zh)).toBe(
    "test(…) 回调 › 匿名函数 › server.close(…) 回调",
  );
  expect(displayName("createMcpServer.<anonymous>", en)).toBe(
    "createMcpServer › anonymous",
  );
  expect(displayName("plain.name", en)).toBe("plain.name");
});
