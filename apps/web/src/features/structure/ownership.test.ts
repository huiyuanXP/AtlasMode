import { describe, expect, it } from "vitest";
import {
  completeTargetPath,
  captureOwnershipIntent,
  matchesOwnershipIntent,
} from "./ownership.js";
const tuple = { projectId: "p", snapshotId: "S0", planId: "plan", revision: 1 };
const fact = {
  id: "f",
  kind: "function" as const,
  name: "f",
  filePath: "src/a.ts",
};
describe("complete ownership target", () => {
  it("completes a folder with an explicit single filename and preserves full identity", () => {
    expect(completeTargetPath({ kind: "folder", path: "." }, "a.ts")).toBe(
      "a.ts",
    );
    expect(
      completeTargetPath({ kind: "folder", path: "dest/nested" }, "index.ts"),
    ).toBe("dest/nested/index.ts");
    expect(completeTargetPath({ kind: "file", path: "other/index.ts" })).toBe(
      "other/index.ts",
    );
  });
  it.each([
    "",
    ".",
    "..",
    "../a.ts",
    "a/b.ts",
    "a\\b.ts",
    "C:a.ts",
    "https:a.ts",
    "a\0.ts",
    "a\n.ts",
    "a.txt",
  ])("rejects filename %j before joining", (filename) => {
    expect(() =>
      completeTargetPath({ kind: "folder", path: "dest" }, filename),
    ).toThrow();
  });
  it("rejects directory-valued file target and escaped target folder", () => {
    expect(() => completeTargetPath({ kind: "file", path: "dest" })).toThrow();
    expect(() =>
      completeTargetPath({ kind: "folder", path: "../dest" }, "a.ts"),
    ).toThrow();
  });
  it("captures only eligible current-snapshot identities and detects every tuple change", () => {
    const intent = captureOwnershipIntent(tuple, fact, [], "nonce", "S0");
    expect(intent.effectivePath).toBe("src/a.ts");
    expect(matchesOwnershipIntent(intent, tuple, "f", "nonce")).toBe(true);
    for (const changed of [
      { ...tuple, projectId: "foreign" },
      { ...tuple, snapshotId: "S1" },
      { ...tuple, planId: "other" },
      { ...tuple, revision: 2 },
    ])
      expect(matchesOwnershipIntent(intent, changed, "f", "nonce")).toBe(false);
    expect(matchesOwnershipIntent(intent, tuple, "other", "nonce")).toBe(false);
    expect(matchesOwnershipIntent(intent, tuple, "f", "foreign-nonce")).toBe(
      false,
    );
    expect(() =>
      captureOwnershipIntent(
        tuple,
        { ...fact, kind: "file" },
        [],
        "nonce",
        "S0",
      ),
    ).toThrow();
    expect(() =>
      captureOwnershipIntent(
        tuple,
        fact,
        [{ kind: "remove_function", nodeId: "f" }],
        "nonce",
        "S0",
      ),
    ).toThrow();
  });
});

describe("Python ownership targets", () => {
  it("keeps full Python file identity and completes root/nested folders", () => {
    expect(completeTargetPath({ kind: "file", path: "other/index.py" })).toBe(
      "other/index.py",
    );
    expect(
      completeTargetPath({ kind: "folder", path: "dest/nested" }, "index.py"),
    ).toBe("dest/nested/index.py");
    expect(completeTargetPath({ kind: "folder", path: "." }, "main.py")).toBe(
      "main.py",
    );
  });
  it.each([
    "../main.py",
    "a/main.py",
    "a\\main.py",
    "C:main.py",
    "main.py/",
    "main\0.py",
    "main\n.py",
  ])("rejects unsafe Python filename %j before joining", (filename) => {
    expect(() =>
      completeTargetPath({ kind: "folder", path: "dest" }, filename),
    ).toThrow();
  });
});
