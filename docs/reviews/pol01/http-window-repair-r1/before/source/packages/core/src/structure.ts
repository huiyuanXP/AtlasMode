import { makeId } from "./validation.js";
import type { DirectoryPolicy } from "./model.js";
import {
  StructureError,
  type JsonObject,
  type JsonValue,
  type PortableLegacyPolicy,
  type StructureDocumentV1,
  type StructureOperation,
} from "./structure-types.js";

const pointerPart = (key: string) =>
  key.replaceAll("~", "~0").replaceAll("/", "~1");
function invalid(pointer: string, message: string, kind = "schema"): never {
  throw new StructureError("INVALID_STRUCTURE", message, [
    { pointer, kind, message },
  ]);
}
function object(
  value: JsonValue | undefined,
  pointer: string,
): asserts value is JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid(pointer, "Expected an object.");
}
function string(
  value: JsonValue | undefined,
  pointer: string,
): asserts value is string {
  if (typeof value !== "string") invalid(pointer, "Expected a string.");
}
function strings(
  value: JsonValue | undefined,
  pointer: string,
  nonblank = false,
): asserts value is string[] {
  if (!Array.isArray(value)) invalid(pointer, "Expected an array of strings.");
  value.forEach((item, i) => {
    string(item, `${pointer}/${i}`);
    if (nonblank && !item.trim())
      invalid(`${pointer}/${i}`, "Expected a nonempty string.");
  });
}
export function normalizeStructurePath(
  value: string,
  pointer = "",
  pattern = false,
): string {
  const slashes = value.replaceAll("\\", "/");
  if (slashes.startsWith("/"))
    invalid(
      pointer,
      "Expected a repository-relative path without parent traversal.",
      "path",
    );
  const path = slashes.replace(/\/+$/, "");
  if (
    /^[A-Za-z]:/.test(path) ||
    path.startsWith("/") ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    path.split("/").includes("..")
  )
    invalid(
      pointer,
      "Expected a repository-relative path without parent traversal.",
      "path",
    );
  if (pattern) {
    if (!path.trim())
      invalid(pointer, "Expected a nonempty source pattern.", "path");
    return path;
  }
  return path
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
}

/** Parse every JSON token so duplicate keys cannot silently replace an earlier value. */
function parseJson(text: string): JsonValue {
  let offset = 0;
  const whitespace = () => {
    while (/[\t\n\r ]/.test(text[offset] ?? "x")) offset++;
  };
  const quoted = (pointer: string): string => {
    const start = offset++;
    while (offset < text.length) {
      const char = text[offset++];
      if (char === "\\") offset++;
      else if (char === '"') {
        try {
          return JSON.parse(text.slice(start, offset)) as string;
        } catch {
          invalid(pointer, "Invalid JSON string.", "json");
        }
      }
    }
    return invalid(pointer, "Unterminated JSON string.", "json");
  };
  const value = (pointer: string): JsonValue => {
    whitespace();
    const char = text[offset];
    if (char === '"') return quoted(pointer);
    if (char === "{") {
      offset++;
      whitespace();
      const output: JsonObject = Object.create(null) as JsonObject;
      if (text[offset] === "}") {
        offset++;
        return output;
      }
      while (true) {
        whitespace();
        if (text[offset] !== '"')
          invalid(pointer, "Expected a JSON object key.", "json");
        const key = quoted(pointer),
          child = `${pointer}/${pointerPart(key)}`;
        if (Object.hasOwn(output, key))
          invalid(child, "Duplicate JSON object key.", "duplicate_key");
        whitespace();
        if (text[offset++] !== ":") invalid(child, "Expected a colon.", "json");
        output[key] = value(child);
        whitespace();
        const next = text[offset++];
        if (next === "}") return output;
        if (next !== ",")
          invalid(pointer, "Expected a comma or object end.", "json");
      }
    }
    if (char === "[") {
      offset++;
      whitespace();
      const output: JsonValue[] = [];
      if (text[offset] === "]") {
        offset++;
        return output;
      }
      while (true) {
        output.push(value(`${pointer}/${output.length}`));
        whitespace();
        const next = text[offset++];
        if (next === "]") return output;
        if (next !== ",")
          invalid(pointer, "Expected a comma or array end.", "json");
      }
    }
    for (const [word, result] of [
      ["null", null],
      ["true", true],
      ["false", false],
    ] as const) {
      if (text.startsWith(word, offset)) {
        offset += word.length;
        return result;
      }
    }
    const match = text
      .slice(offset)
      .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (match) {
      offset += match[0].length;
      const number = Number(match[0]);
      if (!Number.isFinite(number))
        invalid(pointer, "JSON numbers must be finite.", "json");
      return number;
    }
    return invalid(pointer, "Invalid JSON value.", "json");
  };
  const result = value("");
  whitespace();
  if (offset !== text.length) invalid("", "Trailing JSON input.", "json");
  return result;
}

function validateLegacy(value: JsonValue, pointer: string): void {
  object(value, pointer);
  string(value.id, `${pointer}/id`);
  if (!value.id) invalid(`${pointer}/id`, "Expected a policy id.");
  if (Object.hasOwn(value, "projectId"))
    invalid(`${pointer}/projectId`, "Portable policies cannot set projectId.");
  string(value.pathPrefix, `${pointer}/pathPrefix`);
  normalizeStructurePath(value.pathPrefix, `${pointer}/pathPrefix`);
  string(value.purpose, `${pointer}/purpose`);
  strings(value.forbiddenDependencies, `${pointer}/forbiddenDependencies`);
  value.forbiddenDependencies.forEach((item, i) => {
    if (!normalizeStructurePath(item, `${pointer}/forbiddenDependencies/${i}`))
      invalid(
        `${pointer}/forbiddenDependencies/${i}`,
        "Forbidden target prefix cannot be empty.",
        "path",
      );
  });
}
export function structureLegacyPolicies(
  document: StructureDocumentV1,
): PortableLegacyPolicy[] {
  const extension = document["x-atlasmode"] as JsonObject | undefined;
  return (extension?.legacyPathPolicies ?? []) as PortableLegacyPolicy[];
}
export function parseStructure(text: string): StructureDocumentV1 {
  let root: JsonValue;
  try {
    root = parseJson(text);
  } catch (error) {
    if (error instanceof StructureError) throw error;
    return invalid("", "Unable to parse JSON.", "json");
  }
  object(root, "");
  if (root.schemaVersion !== 1)
    invalid("/schemaVersion", "Supported schemaVersion is 1.", "version");
  if (!Array.isArray(root.folders))
    invalid("/folders", "Expected folders array.");
  if (!Array.isArray(root.dependencyRules))
    invalid("/dependencyRules", "Expected dependencyRules array.");
  const paths = new Set<string>();
  root.folders.forEach((folder, i) => {
    const pointer = `/folders/${i}`;
    object(folder, pointer);
    string(folder.path, `${pointer}/path`);
    string(folder.purpose, `${pointer}/purpose`);
    const path = normalizeStructurePath(folder.path, `${pointer}/path`);
    if (paths.has(path))
      invalid(
        `${pointer}/path`,
        "Duplicate normalized folder path.",
        "duplicate_path",
      );
    paths.add(path);
    for (const field of ["allowed", "forbidden"])
      if (Object.hasOwn(folder, field))
        strings(folder[field], `${pointer}/${field}`);
  });
  root.dependencyRules.forEach((rule, i) => {
    const pointer = `/dependencyRules/${i}`;
    object(rule, pointer);
    string(rule.from, `${pointer}/from`);
    normalizeStructurePath(rule.from, `${pointer}/from`, true);
    strings(rule.mustNotImport, `${pointer}/mustNotImport`, true);
    string(rule.reason, `${pointer}/reason`);
  });
  if (Object.hasOwn(root, "x-atlasmode")) {
    const extension = root["x-atlasmode"];
    object(extension, "/x-atlasmode");
    if (extension.schemaVersion !== undefined && extension.schemaVersion !== 1)
      invalid(
        "/x-atlasmode/schemaVersion",
        "Unsupported extension version.",
        "version",
      );
    if (extension.legacyPathPolicies !== undefined) {
      if (
        extension.schemaVersion !== 1 ||
        !Array.isArray(extension.legacyPathPolicies)
      )
        invalid(
          "/x-atlasmode/legacyPathPolicies",
          "Expected version 1 legacy policies array.",
        );
      const ids = new Set<string>();
      extension.legacyPathPolicies.forEach((policy, i) => {
        validateLegacy(policy, `/x-atlasmode/legacyPathPolicies/${i}`);
        const id = (policy as PortableLegacyPolicy).id;
        if (ids.has(id))
          invalid(
            `/x-atlasmode/legacyPathPolicies/${i}/id`,
            "Duplicate policy id.",
          );
        ids.add(id);
      });
    }
  }
  return root as StructureDocumentV1;
}
function sorted(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    const output: JsonObject = Object.create(null) as JsonObject;
    for (const key of Object.keys(value).sort())
      output[key] = sorted(value[key]!);
    return output;
  }
  return value;
}
export function canonicalStructure(document: StructureDocumentV1): string {
  const normalized = JSON.parse(
    JSON.stringify(document),
  ) as StructureDocumentV1;
  normalized.folders = normalized.folders
    .map((folder) => {
      const output = { ...folder, path: normalizeStructurePath(folder.path) };
      for (const field of ["allowed", "forbidden"] as const)
        if (folder[field] !== undefined)
          output[field] = [...new Set(folder[field])].sort();
      return output;
    })
    .sort((a, b) => a.path.localeCompare(b.path, "en"));
  normalized.dependencyRules = normalized.dependencyRules
    .map((rule) => ({
      ...rule,
      from: normalizeStructurePath(rule.from, "", true),
      mustNotImport: [...new Set(rule.mustNotImport)].sort(),
    }))
    .sort((a, b) =>
      JSON.stringify(sorted(a)).localeCompare(JSON.stringify(sorted(b)), "en"),
    );
  return JSON.stringify(sorted(normalized));
}
export function canonicalLegacyPolicy(
  policy: Omit<DirectoryPolicy, "projectId">,
): string {
  return JSON.stringify([
    policy.id,
    normalizeStructurePath(policy.pathPrefix),
    policy.purpose,
    [
      ...new Set(
        policy.forbiddenDependencies.map((path) =>
          normalizeStructurePath(path),
        ),
      ),
    ].sort(),
  ]);
}
export function applyStructureOperation(
  document: StructureDocumentV1,
  operation: StructureOperation,
  legacyPolicies: DirectoryPolicy[],
): StructureDocumentV1 {
  const result = parseStructure(JSON.stringify(document));
  if (operation.kind === "upsertFolder") {
    const path = normalizeStructurePath(operation.path),
      previous =
        operation.previousPath === undefined
          ? undefined
          : normalizeStructurePath(operation.previousPath);
    const index =
      previous === undefined
        ? -1
        : result.folders.findIndex(
            (folder) => normalizeStructurePath(folder.path) === previous,
          );
    if (previous !== undefined && index < 0)
      throw new StructureError(
        "STRUCTURE_CONFLICT",
        "The folder no longer exists.",
      );
    if (
      result.folders.some(
        (folder, i) =>
          i !== index && normalizeStructurePath(folder.path) === path,
      )
    )
      throw new StructureError(
        "STRUCTURE_CONFLICT",
        "The target folder already exists.",
      );
    const folder = {
      ...(index >= 0 ? result.folders[index] : {}),
      path: path || ".",
      purpose: operation.purpose,
    };
    if (index < 0) result.folders.push(folder);
    else result.folders[index] = folder;
  } else {
    const oldExtension = result["x-atlasmode"] as JsonObject | undefined;
    const policies = structureLegacyPolicies(result);
    const additions =
      operation.kind === "importLegacy"
        ? legacyPolicies
        : [
            {
              ...operation,
              id: operation.id ?? makeId("legacy-policy", operation.pathPrefix),
              projectId: "",
            },
          ];
    for (const addition of additions) {
      const portable = { ...addition } as Omit<typeof addition, "projectId"> & {
        projectId?: string;
        kind?: string;
      };
      delete portable.projectId;
      delete portable.kind;
      const old = policies.find((policy) => policy.id === portable.id);
      if (old && operation.kind === "importLegacy") {
        if (canonicalLegacyPolicy(old) !== canonicalLegacyPolicy(portable))
          throw new StructureError(
            "STRUCTURE_CONFLICT",
            "Legacy policy conflicts with the file.",
          );
        continue;
      }
      const normalized = {
        ...old,
        ...portable,
        pathPrefix: normalizeStructurePath(portable.pathPrefix),
        forbiddenDependencies: portable.forbiddenDependencies.map((path) =>
          normalizeStructurePath(path),
        ),
      } as PortableLegacyPolicy;
      const index = policies.findIndex((policy) => policy.id === normalized.id);
      if (index < 0) policies.push(normalized);
      else policies[index] = normalized;
    }
    result["x-atlasmode"] = {
      ...oldExtension,
      schemaVersion: 1,
      legacyPathPolicies: policies,
    };
  }
  return parseStructure(JSON.stringify(result));
}
export function projectStructurePolicies(
  document: StructureDocumentV1,
  projectId: string,
): DirectoryPolicy[] {
  const policies = [
    ...document.folders.map((folder) => ({
      id: makeId(
        "structure-folder",
        projectId,
        normalizeStructurePath(folder.path),
      ),
      projectId,
      pathPrefix: normalizeStructurePath(folder.path),
      purpose: folder.purpose,
      forbiddenDependencies: [],
    })),
    ...structureLegacyPolicies(document).map((policy) => ({
      ...policy,
      projectId,
      pathPrefix: normalizeStructurePath(policy.pathPrefix),
      forbiddenDependencies: policy.forbiddenDependencies.map((path) =>
        normalizeStructurePath(path),
      ),
    })),
  ];
  if (new Set(policies.map((policy) => policy.id)).size !== policies.length)
    throw new StructureError(
      "STRUCTURE_CONFLICT",
      "Legacy ids cannot shadow folder projections.",
    );
  return policies;
}
