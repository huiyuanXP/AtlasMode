import { expect, it } from "vitest";
import { circleFunctions, circleSelectedNodes } from "./selection.js";
import type { GraphNode } from "../graph/projection.js";
const n = (id: string, kind = "function", layer = "fact", domain = id) =>
  ({
    id,
    position: { x: 0, y: 0 },
    data: { node: { id: domain, kind, name: domain }, layer, changes: [] },
  }) as GraphNode;
it("selects true fact functions including moved/deleted facts, excludes planned/file/folder and deduplicates domain IDs", () => {
  expect(
    circleFunctions([
      n("a"),
      n("alias", "function", "anchor", "a"),
      n("b", "function", "fact"),
      n("temp", "function", "plan"),
      n("file", "file"),
      n("folder", "folder"),
    ]).map((n) => n.id),
  ).toEqual(["a", "b"]);
});
it("controlled circle IDs override inspection selected state after projection replacements", () => {
  const result = circleSelectedNodes(
    [
      { ...n("a"), selected: false },
      { ...n("b"), selected: true },
      n("temp", "function", "plan"),
    ],
    ["a", "temp"],
  );
  expect(result.map((n) => n.selected)).toEqual([true, false, false]);
});
