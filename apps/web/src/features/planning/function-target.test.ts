import { describe, expect, it } from "vitest";
import type { CodeNode, Operation } from "@codemap/core";
import { effectiveFunctionPath, retargetFunction } from "./function-target.js";
import { editFunction } from "./operations.js";

const fact: CodeNode = {
  id: "f",
  kind: "function",
  name: "f",
  filePath: "src/a.ts",
};
const annotation: Operation = {
  kind: "annotate",
  targetId: "f",
  text: "keep rationale",
};
const move = (filePath: string): Operation => ({
  kind: "move_function",
  nodeId: "f",
  filePath,
});
describe("shared function target", () => {
  it("reads the last legacy target without changing physical identity or input", () => {
    const ops = [move("dest/b.ts"), annotation, move("dest/c.ts")];
    expect(effectiveFunctionPath(ops, fact)).toBe("dest/c.ts");
    expect(fact.filePath).toBe("src/a.ts");
    expect(ops).toHaveLength(3);
  });
  it("coalesces only selected moves at the first existing slot", () => {
    const other: Operation = {
      kind: "move_function",
      nodeId: "other",
      filePath: "other.ts",
    };
    const ops = [annotation, move("dest/b.ts"), other, move("dest/c.ts")];
    const before = structuredClone(ops);
    expect(retargetFunction(ops, fact, "dest/d.ts")).toEqual([
      annotation,
      move("dest/d.ts"),
      other,
    ]);
    expect(ops).toEqual(before);
  });
  it("returns the same array for a same-effective-target no-op and removes moves on baseline return", () => {
    const ops = [move("dest/b.ts"), annotation, move("dest/c.ts")];
    expect(retargetFunction(ops, fact, "dest/c.ts")).toBe(ops);
    expect(retargetFunction(ops, fact, "src/a.ts")).toEqual([annotation]);
  });
  it("folds temporary legacy moves into addition without losing metadata or relations", () => {
    const add: Operation = {
      kind: "add_function",
      tempId: "f",
      name: "new",
      filePath: "new/a.ts",
      signature: "()",
      description: "design",
      language: "typescript",
    };
    const relation: Operation = {
      kind: "add_relation",
      id: "r",
      sourceId: "f",
      targetId: "other",
      type: "calls",
    };
    const ops = [add, relation, move("new/b.ts"), annotation];
    expect(effectiveFunctionPath(ops, fact)).toBe("new/b.ts");
    expect(retargetFunction(ops, fact, "new/c.ts")).toEqual([
      { ...add, filePath: "new/c.ts" },
      relation,
      annotation,
    ]);
  });
  it("ownership -> advanced -> ownership preserves annotation logic and one target", () => {
    const first = retargetFunction([annotation], fact, "dest/b.ts");
    const second = editFunction(first, fact, {
      name: "renamed",
      filePath: "dest/c.ts",
      signature: "(x)",
      description: "intent",
    });
    expect(second.filter((o) => o.kind === "move_function")).toEqual([
      move("dest/c.ts"),
    ]);
    const third = retargetFunction(second, fact, "dest/d.ts");
    expect(effectiveFunctionPath(third, fact)).toBe("dest/d.ts");
    expect(third.filter((o) => o.kind === "annotate")).toEqual([
      annotation,
      {
        kind: "annotate",
        targetId: "f",
        text: "name: renamed\nsignature: (x)\nintent",
      },
    ]);
  });
  it("advanced temporary edits cannot leave an overriding legacy move", () => {
    const add: Operation = {
      kind: "add_function",
      tempId: "f",
      name: "new",
      filePath: "new/a.ts",
    };
    const next = editFunction([add, move("new/b.ts"), annotation], fact, {
      name: "updated",
      filePath: "new/c.ts",
      signature: "()",
      description: "intent",
    });
    expect(next).toEqual([
      {
        ...add,
        name: "updated",
        filePath: "new/c.ts",
        signature: "()",
        description: "intent",
      },
      annotation,
    ]);
  });
  it("rejects nonfunctions, removed identities and escaped paths", () => {
    expect(() =>
      retargetFunction([], { ...fact, kind: "file" }, "b.ts"),
    ).toThrow();
    expect(() =>
      retargetFunction(
        [{ kind: "remove_function", nodeId: "f" }],
        fact,
        "b.ts",
      ),
    ).toThrow();
    expect(() => retargetFunction([], fact, "../escape.ts")).toThrow();
    expect(() => retargetFunction([], fact, "dest")).toThrow();
  });
});
