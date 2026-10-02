import { expect, it } from "vitest";
import type { Operation } from "@codemap/core";
import {
  deleteTemporary,
  reconnectRelation,
  editFunction,
} from "./operations.js";
it("deleting a temporary node removes only its dependent planning operations", () => {
  const ops: Operation[] = [
    { kind: "add_function", tempId: "temp:a", name: "a", filePath: "a.ts" },
    {
      kind: "add_relation",
      id: "e",
      sourceId: "temp:a",
      targetId: "real",
      type: "calls",
    },
    { kind: "annotate", targetId: "temp:a", text: "note" },
    { kind: "move_function", nodeId: "temp:a", filePath: "b.ts" },
    { kind: "annotate", targetId: "real", text: "keep" },
  ];
  expect(deleteTemporary(ops, "temp:a")).toEqual([
    { kind: "annotate", targetId: "temp:a", text: "note" },
    { kind: "annotate", targetId: "real", text: "keep" },
  ]);
  expect(ops).toHaveLength(5);
});
it("reconnecting facts produces removal plus a typed planned relation", () => {
  expect(
    reconnectRelation(
      [],
      { id: "fact:r", domainId: "r", layer: "fact" },
      "a",
      "b",
      "must_call",
      "temp:e",
    ),
  ).toEqual([
    { kind: "remove_relation", relationId: "r" },
    {
      kind: "add_relation",
      id: "temp:e",
      sourceId: "a",
      targetId: "b",
      type: "must_call",
    },
  ]);
});
it("reconnecting a planned edge replaces it without leaving an old edge", () => {
  expect(
    reconnectRelation(
      [
        {
          kind: "add_relation",
          id: "e",
          sourceId: "a",
          targetId: "b",
          type: "calls",
        },
      ],
      { id: "plan:e", domainId: "e", layer: "plan" },
      "a",
      "c",
      "must_reuse",
      "unused",
    ),
  ).toEqual([
    {
      kind: "add_relation",
      id: "e",
      sourceId: "a",
      targetId: "c",
      type: "must_reuse",
    },
  ]);
});
it("existing function edits become explicit move and descriptive operations", () => {
  expect(
    editFunction(
      [],
      { id: "real", kind: "function", name: "old", filePath: "a.ts" },
      {
        name: "new",
        filePath: "b.ts",
        signature: "(x)",
        description: "intent",
      },
    ),
  ).toEqual([
    { kind: "move_function", nodeId: "real", filePath: "b.ts" },
    {
      kind: "annotate",
      targetId: "real",
      text: "name: new\nsignature: (x)\nintent",
    },
  ]);
});

it("retains authored annotations when their temporary target is removed", () => {
  expect(
    deleteTemporary(
      [
        { kind: "add_function", tempId: "temp:f", name: "f", filePath: "f.ts" },
        { kind: "annotate", targetId: "temp:f", text: "Keep design rationale" },
      ],
      "temp:f",
    ),
  ).toEqual([
    { kind: "annotate", targetId: "temp:f", text: "Keep design rationale" },
  ]);
});
