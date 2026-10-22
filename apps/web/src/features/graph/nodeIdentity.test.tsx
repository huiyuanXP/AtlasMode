import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CodeNode } from "@codemap/core";
import { NodeIdentity, nodeIdentity } from "./nodeIdentity.js";

it("uses AST type for class, function and owning-class method labels while preserving raw names", () => {
  const cls: CodeNode = {
    id: "class",
    kind: "function",
    name: "Flask",
    declarationKind: "class",
  };
  const fn: CodeNode = {
    id: "fn",
    kind: "function",
    name: "FetchNotes",
    declarationKind: "function",
    signature: "class misleading",
  };
  const method: CodeNode = {
    id: "method",
    kind: "function",
    name: "run",
    qualifiedName: "Flask.run",
    declarationKind: "method",
  };
  expect(nodeIdentity(cls, "zh")).toMatchObject({
    label: "class Flask",
    typeLabel: "类",
  });
  expect(nodeIdentity(fn, "zh")).toMatchObject({
    label: "FetchNotes()",
    typeLabel: "函数",
  });
  expect(nodeIdentity(method, "en")).toMatchObject({
    label: "Flask.run()",
    typeLabel: "Method",
  });
  expect(fn.name).toBe("FetchNotes");
});

it("recognizes an explicit historical class signature and preserves uncertain declarations", () => {
  const legacy: CodeNode = {
    id: "legacy",
    kind: "function",
    name: "Flask",
    signature: "class Flask",
  };
  expect(nodeIdentity(legacy, "en")).toMatchObject({
    label: "class Flask",
    typeLabel: "Class",
  });
  expect(nodeIdentity({ ...legacy, signature: undefined }, "en")).toMatchObject(
    { label: "Flask", typeLabel: "Declaration" },
  );
  expect(
    nodeIdentity({ ...legacy, signature: "classFactory()" }, "zh"),
  ).toMatchObject({ label: "Flask", typeLabel: "声明" });
});

it("keeps file, folder and external identities distinct with type text available without fonts", () => {
  const folder: CodeNode = { id: "folder", kind: "folder", name: "flask" };
  const file: CodeNode = { id: "file", kind: "file", name: "app.py" };
  const external: CodeNode = {
    id: "external",
    kind: "external",
    name: "requests",
  };
  expect(nodeIdentity(folder, "zh")).toMatchObject({
    label: "flask/",
    typeLabel: "目录",
  });
  expect(nodeIdentity(file, "en")).toMatchObject({
    label: "app.py",
    typeLabel: "File",
  });
  expect(nodeIdentity(external, "en")).toMatchObject({
    label: "requests",
    typeLabel: "External dependency",
  });
  const markup = renderToStaticMarkup(
    <NodeIdentity node={folder} locale="zh" />,
  );
  expect(markup).toContain("flask/");
  expect(markup).toContain("目录");
  expect(markup).toContain('aria-hidden="true"');
});

it("shows anonymous callbacks as the receiving call in both languages without touching the raw identity", () => {
  const raw = `<callback:${JSON.stringify([[80, "it"]])}:1>`;
  const callback: CodeNode = {
    id: "cb",
    kind: "function",
    name: raw,
    declarationKind: "function",
  };
  expect(nodeIdentity(callback, "zh").label).toBe("it(…) 回调");
  expect(nodeIdentity(callback, "en").label).toBe("it(…) callback");
  expect(callback.name).toBe(raw);
  const nested: CodeNode = {
    id: "nested",
    kind: "function",
    name: "<anonymous>",
    qualifiedName: `${raw}.<anonymous>`,
    declarationKind: "method",
  };
  expect(nodeIdentity(nested, "en").label).toBe("it(…) callback › anonymous");
  expect(
    nodeIdentity(
      { ...nested, name: "<anonymous>", declarationKind: "function" },
      "zh",
    ).label,
  ).toBe("匿名函数");
});
