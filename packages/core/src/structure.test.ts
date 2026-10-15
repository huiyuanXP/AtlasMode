import { expect, test } from "vitest";
import {
  applyStructureOperation,
  canonicalStructure,
  parseStructure,
  projectStructurePolicies,
} from "./structure.js";

const base = () => ({ schemaVersion: 1, folders: [], dependencyRules: [] });
const policy = {
  id: "old-policy",
  projectId: "p",
  pathPrefix: "src",
  purpose: "Old",
  forbiddenDependencies: ["private"],
};

test("roundtrips v1 optional omission", () => {
  const text = JSON.stringify({
    ...base(),
    folders: [{ path: "src", purpose: "source" }],
  });
  expect(parseStructure(JSON.stringify(parseStructure(text)))).toEqual(
    JSON.parse(text),
  );
});
test("rename keeps nested unknowns and does not mutate source", () => {
  const input = parseStructure(
    JSON.stringify({
      ...base(),
      metadata: { a: [1, null, true] },
      folders: [{ path: "src/", purpose: "Old", extra: { nested: ["keep"] } }],
      dependencyRules: [
        {
          from: "src/**",
          mustNotImport: ["@scope/pkg"],
          reason: "why",
          extra: [false],
        },
      ],
      "x-atlasmode": {
        schemaVersion: 1,
        legacyPathPolicies: [],
        other: { retained: true },
      },
    }),
  );
  const before = JSON.stringify(input);
  const output = applyStructureOperation(
    input,
    { kind: "upsertFolder", previousPath: "src", path: "lib", purpose: "New" },
    [],
  );
  expect(output.folders[0]).toEqual({
    path: "lib",
    purpose: "New",
    extra: { nested: ["keep"] },
  });
  expect(output.metadata).toEqual(input.metadata);
  expect(output.dependencyRules).toEqual(input.dependencyRules);
  expect(output["x-atlasmode"]).toEqual(input["x-atlasmode"]);
  expect("allowed" in output.folders[0]!).toBe(false);
  expect("forbidden" in output.folders[0]!).toBe(false);
  expect(JSON.stringify(input)).toBe(before);
});
test.each([
  '{"schemaVersion":1,"schemaVersion":1,"folders":[],"dependencyRules":[]}',
  JSON.stringify({ ...base(), schemaVersion: 2 }),
  JSON.stringify({ ...base(), folders: [{ path: "../src", purpose: "x" }] }),
  JSON.stringify({ ...base(), folders: [{ path: "C:/src", purpose: "x" }] }),
  JSON.stringify({ ...base(), folders: [{ path: "/src", purpose: "x" }] }),
  JSON.stringify({
    ...base(),
    folders: [{ path: "src", purpose: "x", forbidden: "HTTP" }],
  }),
  JSON.stringify({
    ...base(),
    folders: [
      { path: "src/", purpose: "x" },
      { path: "src", purpose: "y" },
    ],
  }),
  JSON.stringify({
    ...base(),
    dependencyRules: [{ from: "../**", mustNotImport: [], reason: "x" }],
  }),
  '{"schemaVersion":1,"folders":[],"dependencyRules":[],"number":1e999}',
])("rejects schema/key/path/type input with a pointer: %s", (text) => {
  expect(() => parseStructure(text)).toThrowError(
    expect.objectContaining({
      code: "INVALID_STRUCTURE",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ pointer: expect.any(String) }),
      ]),
    }),
  );
});
test("root and portable slashes normalize without reinterpreting import specifiers", () => {
  const doc = parseStructure(
    JSON.stringify({
      ...base(),
      folders: [
        { path: ".", purpose: "root" },
        { path: "src\\api\\", purpose: "api", forbidden: ["HTTP"] },
      ],
      dependencyRules: [
        {
          from: "src\\**",
          mustNotImport: ["@scope/pkg/sub", "./internal"],
          reason: "why",
        },
      ],
    }),
  );
  const projected = projectStructurePolicies(doc, "p");
  expect(projected.map((p) => p.pathPrefix)).toEqual(["", "src/api"]);
  expect(projected.every((p) => p.forbiddenDependencies.length === 0)).toBe(
    true,
  );
  expect(doc.dependencyRules[0]?.mustNotImport).toEqual([
    "@scope/pkg/sub",
    "./internal",
  ]);
});
test("canonical equivalence does not rewrite serialized data", () => {
  const a = parseStructure(
    JSON.stringify({
      ...base(),
      folders: [{ path: "src/", purpose: "x", allowed: ["b", "a", "a"] }],
      extra: { b: 2, a: 1 },
    }),
  );
  const b = parseStructure(
    JSON.stringify({
      extra: { a: 1, b: 2 },
      ...base(),
      folders: [{ purpose: "x", path: "src", allowed: ["a", "b"] }],
    }),
  );
  expect(canonicalStructure(a)).toBe(canonicalStructure(b));
  expect(a.folders[0]?.allowed).toEqual(["b", "a", "a"]);
  b.extra = { a: 1, b: 3 };
  expect(canonicalStructure(a)).not.toBe(canonicalStructure(b));
});
test("reserved extension legacy policies are portable and preserve unknowns", () => {
  const doc = parseStructure(
    JSON.stringify({
      ...base(),
      "x-atlasmode": {
        schemaVersion: 1,
        legacyPathPolicies: [],
        other: { saved: true },
      },
    }),
  );
  const migrated = applyStructureOperation(doc, { kind: "importLegacy" }, [
    policy,
  ]);
  expect(projectStructurePolicies(migrated, "p")).toEqual([policy]);
  expect((migrated["x-atlasmode"] as Record<string, unknown>).other).toEqual({
    saved: true,
  });
  expect(() =>
    applyStructureOperation(migrated, { kind: "importLegacy" }, [
      { ...policy, purpose: "different" },
    ]),
  ).toThrowError(expect.objectContaining({ code: "STRUCTURE_CONFLICT" }));
});
test("patch rejects missing previous folder and occupied rename target", () => {
  const doc = parseStructure(
    JSON.stringify({
      ...base(),
      folders: [
        { path: "a", purpose: "A" },
        { path: "b", purpose: "B" },
      ],
    }),
  );
  expect(() =>
    applyStructureOperation(
      doc,
      {
        kind: "upsertFolder",
        previousPath: "missing",
        path: "c",
        purpose: "C",
      },
      [],
    ),
  ).toThrow();
  expect(() =>
    applyStructureOperation(
      doc,
      { kind: "upsertFolder", previousPath: "a", path: "b", purpose: "C" },
      [],
    ),
  ).toThrow();
});
test("prototype-shaped JSON keys remain own data without pollution", () => {
  const doc = parseStructure(
    '{"schemaVersion":1,"folders":[],"dependencyRules":[],"__proto__":{"polluted":true},"constructor":{"x":1}}',
  );
  expect(Object.prototype.hasOwnProperty.call(doc, "__proto__")).toBe(true);
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  expect(parseStructure(JSON.stringify(doc))).toEqual(doc);
});
test("portable legacy ids cannot shadow a generated folder projection", () => {
  const document = parseStructure(
    JSON.stringify({
      ...base(),
      folders: [{ path: "src", purpose: "folder" }],
    }),
  );
  const id = projectStructurePolicies(document, "p")[0]!.id;
  document["x-atlasmode"] = {
    schemaVersion: 1,
    legacyPathPolicies: [
      {
        id,
        pathPrefix: "src",
        purpose: "shadow",
        forbiddenDependencies: ["private"],
      },
    ],
  };
  expect(() => projectStructurePolicies(document, "p")).toThrowError(
    expect.objectContaining({ code: "STRUCTURE_CONFLICT" }),
  );
});
test.each(["/", "///", "\\"])(
  "absolute separator-only folder path %s is rejected before normalization",
  (path) => {
    expect(() =>
      parseStructure(
        JSON.stringify({ ...base(), folders: [{ path, purpose: "not root" }] }),
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_STRUCTURE" }));
  },
);
