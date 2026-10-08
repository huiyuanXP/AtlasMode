import { expect, it } from "vitest";
import { breadcrumbs, plannedScopeIds } from "./path.js";
const project = { id: "p", path: "/workspace/p", name: "Project" };
it("orders root, nested folder, exact file and qualified function without losing identity", () => {
  const node = {
    id: "stable-symbol",
    kind: "function" as const,
    name: "run",
    qualifiedName: "Service.run",
    filePath: "src/nested/index.ts",
  };
  expect(breadcrumbs(project, node)).toEqual([
    { label: "Project", kind: "folder", path: "." },
    { label: "src", kind: "folder", path: "src" },
    { label: "nested", kind: "folder", path: "src/nested" },
    { label: "index.ts", kind: "file", path: "src/nested/index.ts" },
    {
      label: "Service.run",
      kind: "function",
      path: "src/nested/index.ts",
      node,
    },
  ]);
});
it("distinguishes same-name files and replaces paths at folder or project scope", () => {
  expect(
    breadcrumbs(project, {
      id: "file-a",
      kind: "file",
      name: "index.ts",
      filePath: "other/index.ts",
    }).at(-1)?.path,
  ).toBe("other/index.ts");
  expect(
    breadcrumbs(project, undefined, { path: "src/nested", kind: "folder" }).map(
      (s) => s.label,
    ),
  ).toEqual(["Project", "src", "nested"]);
  expect(
    breadcrumbs(project, { id: "root", kind: "folder", name: "." }),
  ).toEqual([{ label: "Project", kind: "folder", path: "." }]);
});
it("keeps new planned files and nested folders tied to actual operation IDs", () => {
  const ops = [
    {
      kind: "add_function" as const,
      tempId: "new-function",
      name: "newFn",
      filePath: "planned/new.ts",
    },
    {
      kind: "add_function" as const,
      tempId: "other",
      name: "other",
      filePath: "planned-copy/new.ts",
    },
    {
      kind: "move_function" as const,
      nodeId: "existing",
      filePath: "planned/nested/old.ts",
    },
  ];
  expect(plannedScopeIds(ops, "planned/new.ts", "file")).toEqual([
    "new-function",
  ]);
  expect(plannedScopeIds(ops, "planned", "folder")).toEqual([
    "new-function",
    "existing",
  ]);
  expect(plannedScopeIds(ops, ".", "folder")).toEqual([
    "new-function",
    "other",
    "existing",
  ]);
});
