import { posix } from "node:path";
import { ts } from "ts-morph";
import type { CodeSnapshot } from "@codemap/core";
import type { SourceFile } from "./scan.js";

type Manifest = {
  path: string;
  directory: string;
  value?: Record<string, unknown>;
  name?: string;
};
type Owner = {
  manifest: Manifest;
  patterns?: string[];
  members: Set<string>;
  names: Map<string, Manifest[]>;
};
export type WorkspaceMapping = {
  known: boolean;
  targetPath?: string;
  reason?: string;
};
export type WorkspaceResolver = {
  resolve(sourcePath: string, specifier: string): WorkspaceMapping;
  recognizes(specifier: string): boolean;
  diagnostics: CodeSnapshot["diagnostics"];
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const validName = (name: unknown): name is string =>
  typeof name === "string" &&
  /^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(name) &&
  name !== "." &&
  name !== "..";
const INVALID_REQUEST = Symbol("invalid request");
function request(specifier: string) {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.includes("\\")
  )
    return;
  const parts = specifier.split("/");
  const count = specifier.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, count).join("/");
  if (!validName(name)) return;
  const subpath = parts.slice(count);
  if (
    subpath.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.toLowerCase() === "node_modules" ||
        /[\\%?#:*]/.test(part),
    )
  )
    return { name, subpath: INVALID_REQUEST };
  return {
    name,
    subpath: parts.length === count ? "." : "./" + parts.slice(count).join("/"),
  };
}
const NO_MATCH = Symbol("no condition matched"),
  BLOCKED = Symbol("blocked"),
  INVALID = Symbol("invalid");
type Outcome = string | typeof NO_MATCH | typeof BLOCKED | typeof INVALID;

/** Reads only the immutable scan capture. It never synthesizes installation or dist-to-src mappings. */
export function createWorkspaceResolver(
  sources: readonly SourceFile[],
  manifests: readonly SourceFile[],
  captureDiagnostics: readonly CodeSnapshot["diagnostics"][number][] = [],
): WorkspaceResolver {
  const diagnostics: CodeSnapshot["diagnostics"] = [];
  const reported = new Set<string>();
  const scopes = new Map<string, Manifest>();
  for (const file of manifests) {
    const manifest: Manifest = {
      path: file.path,
      directory: posix.dirname(file.path),
    };
    try {
      const value: unknown = JSON.parse(file.bytes.toString("utf8"));
      if (record(value)) {
        if (validName(value.name)) manifest.name = value.name;
        if (
          value.type === undefined ||
          value.type === "module" ||
          value.type === "commonjs"
        )
          manifest.value = value;
      }
    } catch {
      /* An opaque manifest still forms a package boundary. */
    }
    scopes.set(manifest.directory, manifest);
  }
  for (const diagnostic of captureDiagnostics) {
    if (!diagnostic.message.startsWith("PACKAGE_MANIFEST_UNAVAILABLE:"))
      continue;
    const directory = posix.dirname(diagnostic.filePath);
    if (!scopes.has(directory))
      scopes.set(directory, { path: diagnostic.filePath, directory });
  }
  const knownNames = new Set(
    [...scopes.values()].flatMap((m) => (m.name ? [m.name] : [])),
  );
  function nearestPackage(path: string): Manifest | undefined {
    let directory = posix.dirname(path);
    while (true) {
      const found = scopes.get(directory);
      if (found) return found;
      if (directory === ".") return;
      directory = posix.dirname(directory);
    }
  }
  const owners = new Map<string, Owner>();
  for (const manifest of scopes.values()) {
    const configured = manifest.value?.workspaces;
    if (configured === undefined) continue;
    const value = record(configured) ? configured.packages : configured;
    const patterns =
      Array.isArray(value) &&
      value.every(
        (p) =>
          typeof p === "string" &&
          p.length > 0 &&
          p
            .split("/")
            .every(
              (segment) =>
                segment === "*" ||
                (/^[a-zA-Z0-9._-]+$/.test(segment) &&
                  segment !== "." &&
                  segment !== ".."),
            ),
      )
        ? (value as string[])
        : undefined;
    const owner: Owner = {
      manifest,
      patterns,
      members: new Set(),
      names: new Map(),
    };
    if (patterns) {
      for (const candidate of scopes.values()) {
        const relative = posix.relative(
          manifest.directory,
          candidate.directory,
        );
        if (!relative || relative.startsWith("../")) continue;
        const segments = relative.split("/");
        if (
          !patterns.some((p) => {
            const parts = p.split("/");
            return (
              parts.length === segments.length &&
              parts.every((part, i) => part === "*" || part === segments[i])
            );
          })
        )
          continue;
        owner.members.add(candidate.directory);
        if (candidate.name) {
          const named = owner.names.get(candidate.name) ?? [];
          named.push(candidate);
          owner.names.set(candidate.name, named);
        }
      }
    }
    owners.set(manifest.directory, owner);
  }
  function nearestOwner(path: string): Owner | undefined {
    let directory = posix.dirname(path);
    while (true) {
      const found = owners.get(directory);
      if (found) return found;
      if (directory === ".") return;
      directory = posix.dirname(directory);
    }
  }
  const sourcePaths = new Set(sources.map((f) => f.path));
  const modes = new Map<string, Map<string, Set<"import" | "require">>>();
  for (const file of sources) {
    const source = ts.createSourceFile(
      file.path,
      file.bytes.toString("utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const requests = new Map<string, Set<"import" | "require">>();
    function add(value: ts.Expression | undefined, mode: "import" | "require") {
      if (!value || !ts.isStringLiteralLike(value)) return;
      const selected = requests.get(value.text) ?? new Set();
      selected.add(mode);
      requests.set(value.text, selected);
    }
    function bindsRequire(name: ts.BindingName): boolean {
      return ts.isIdentifier(name)
        ? name.text === "require"
        : name.elements.some(
            (e) => ts.isBindingElement(e) && bindsRequire(e.name),
          );
    }
    function declarationsRequire(scope: ts.Node, varOnly: boolean): boolean {
      let found = false;
      function walk(node: ts.Node) {
        if (node !== scope && ts.isFunctionLike(node)) {
          if (
            !varOnly &&
            ts.isFunctionDeclaration(node) &&
            node.name?.text === "require"
          )
            found = true;
          return;
        }
        if (
          ts.isVariableDeclaration(node) &&
          bindsRequire(node.name) &&
          ts.isVariableDeclarationList(node.parent) &&
          (!varOnly || !(node.parent.flags & ts.NodeFlags.BlockScoped))
        )
          found = true;
        if (
          !varOnly &&
          node !== scope &&
          (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
          node.name?.text === "require"
        )
          found = true;
        if (
          !varOnly &&
          ts.isImportClause(node) &&
          node.name?.text === "require"
        )
          found = true;
        if (
          !varOnly &&
          (ts.isImportSpecifier(node) ||
            ts.isNamespaceImport(node) ||
            ts.isImportEqualsDeclaration(node)) &&
          node.name.text === "require"
        )
          found = true;
        // Block-scoped bindings only belong to this block, not nested blocks.
        if (
          !varOnly &&
          node !== scope &&
          (ts.isBlock(node) || ts.isCaseBlock(node))
        )
          return;
        if (!found) ts.forEachChild(node, walk);
      }
      walk(scope);
      return found;
    }
    function shadowedRequire(call: ts.Node): boolean {
      for (
        let node: ts.Node | undefined = call.parent;
        node;
        node = node.parent
      ) {
        if (ts.isFunctionLike(node)) {
          if (
            node.parameters.some((p) => bindsRequire(p.name)) ||
            (ts.isFunctionExpression(node) && node.name?.text === "require") ||
            declarationsRequire(node, true)
          )
            return true;
        }
        if (
          (ts.isSourceFile(node) || ts.isBlock(node) || ts.isCaseBlock(node)) &&
          declarationsRequire(node, false)
        )
          return true;
        if (ts.isSourceFile(node) && declarationsRequire(node, true))
          return true;
        if (
          ts.isCatchClause(node) &&
          node.variableDeclaration &&
          bindsRequire(node.variableDeclaration.name)
        )
          return true;
        if (
          (ts.isForStatement(node) ||
            ts.isForInStatement(node) ||
            ts.isForOfStatement(node)) &&
          node.initializer &&
          ts.isVariableDeclarationList(node.initializer) &&
          node.initializer.declarations.some((d) => bindsRequire(d.name))
        )
          return true;
      }
      return false;
    }
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        add(node.moduleSpecifier, "import");
      else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      )
        add(node.moduleReference.expression, "require");
      else if (ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require" &&
          !shadowedRequire(node)
        )
          add(node.arguments[0], "require");
        else if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
          add(node.arguments[0], "import");
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    modes.set(file.path, requests);
  }
  function select(exports: unknown, subpath: string): unknown {
    if (!record(exports)) return subpath === "." ? exports : NO_MATCH;
    const keys = Object.keys(exports);
    if (!keys.some((key) => key.startsWith(".")))
      return subpath === "." ? exports : NO_MATCH;
    if (
      !keys.every(
        (key) =>
          key === "." ||
          (/^\.\//.test(key) &&
            !/[\\%?#]/.test(key) &&
            key
              .split("/")
              .slice(1)
              .every(
                (s) =>
                  s &&
                  s !== "." &&
                  s !== ".." &&
                  s.toLowerCase() !== "node_modules",
              ) &&
            (key.match(/\*/g)?.length ?? 0) <= 1),
      )
    )
      return INVALID;
    if (Object.hasOwn(exports, subpath)) return exports[subpath];
    const patterns = keys.filter(
      (key) =>
        key.includes("*") &&
        subpath.startsWith(key.slice(0, key.indexOf("*"))) &&
        subpath.endsWith(key.slice(key.indexOf("*") + 1)) &&
        subpath.length >= key.length,
    );
    patterns.sort(
      (a, b) => b.indexOf("*") - a.indexOf("*") || b.length - a.length,
    );
    const pattern = patterns[0];
    if (!pattern) return NO_MATCH;
    const star = pattern.indexOf("*");
    const matched = subpath.slice(
      star,
      subpath.length - (pattern.length - star - 1),
    );
    const substitutionBudget = { remaining: 2048 };
    function substitute(value: unknown, depth = 0): unknown {
      if (--substitutionBudget.remaining < 0 || depth > 16) return INVALID;
      if (typeof value === "string") return value.replaceAll("*", matched);
      if (record(value)) {
        const result: Record<string, unknown> = Object.create(null);
        for (const [key, branch] of Object.entries(value)) {
          result[key] = substitute(branch, depth + 1);
          if (substitutionBudget.remaining < 0) return INVALID;
        }
        return result;
      }
      return value;
    }
    return substitute(exports[pattern]);
  }
  function outcomes(
    value: unknown,
    mode: "import" | "require",
    budget: { remaining: number },
    depth = 0,
  ): Set<Outcome> {
    if (--budget.remaining < 0 || depth > 16) return new Set([INVALID]);
    if (typeof value === "string") return new Set([value]);
    if (value === NO_MATCH) return new Set([NO_MATCH]);
    if (value === null) return new Set([BLOCKED]);
    if (!record(value)) return new Set([INVALID]);
    const entries = Object.entries(value);
    if (
      entries.some(
        ([key]) => key.startsWith(".") || /^(?:0|[1-9]\d*)$/.test(key),
      )
    )
      return new Set([INVALID]);
    const result = new Set<Outcome>();
    let reachable = true;
    for (const [condition, branch] of entries) {
      if (!reachable) break;
      if (--budget.remaining < 0) return new Set([INVALID]);
      if (condition === (mode === "import" ? "require" : "import")) continue;
      const possible = outcomes(branch, mode, budget, depth + 1);
      for (const candidate of possible)
        if (candidate !== NO_MATCH) result.add(candidate);
      if (condition === "default" || condition === mode)
        reachable = possible.has(NO_MATCH);
      // Other conditions may be enabled or disabled. NO_MATCH continues in the parent.
    }
    if (reachable) result.add(NO_MATCH);
    return result;
  }
  function validateTarget(
    value: string,
    manifest: Manifest,
  ): string | undefined {
    if (!value.startsWith("./") || /[\\%?#:*]/.test(value)) return;
    const segments = value.slice(2).split("/");
    if (
      segments.some(
        (s) =>
          !s || s === "." || s === ".." || s.toLowerCase() === "node_modules",
      )
    )
      return;
    const target = posix.join(manifest.directory, value);
    if (
      !/\.(?:[cm]?[jt]s|[jt]sx)$/.test(target) ||
      /\.d\.[cm]?ts$/.test(target)
    )
      return;
    if (!sourcePaths.has(target) || nearestPackage(target) !== manifest) return;
    return target;
  }
  const cache = new Map<string, WorkspaceMapping>();
  function resolve(sourcePath: string, specifier: string): WorkspaceMapping {
    const path = sourcePath.replace(/^\//, "");
    const key = JSON.stringify([path, specifier]);
    const cached = cache.get(key);
    if (cached) return cached;
    const parsed = request(specifier);
    if (!parsed || !knownNames.has(parsed.name)) return { known: false };
    function reject(reason: string): WorkspaceMapping {
      const result = { known: true, reason };
      cache.set(key, result);
      if (!reported.has(key)) {
        reported.add(key);
        diagnostics.push({
          filePath: path,
          message: `WORKSPACE_MAPPING_UNAVAILABLE: ${specifier}: ${reason}`,
        });
      }
      return result;
    }
    if (typeof parsed.subpath !== "string")
      return reject("invalid requested package subpath");
    const consumer = nearestPackage(path);
    if (!consumer?.value)
      return reject(
        "nearest consumer package manifest is unavailable or invalid",
      );
    let target: Manifest | undefined;
    if (consumer?.name === parsed.name) target = consumer;
    else {
      const owner = nearestOwner(path);
      if (!owner || !owner.patterns)
        return reject("no supported captured workspace owner");
      if (
        !consumer ||
        (consumer !== owner.manifest && !owner.members.has(consumer.directory))
      )
        return reject(
          "consumer is outside the owner's registered package scope",
        );
      const candidates = owner.names.get(parsed.name) ?? [];
      if (candidates.length !== 1)
        return reject(
          candidates.length
            ? "duplicate package name in workspace"
            : "package is not registered in this workspace",
        );
      target = candidates[0];
    }
    if (!target?.value)
      return reject("target package manifest is unavailable or invalid");
    const requestedModes = modes.get(path)?.get(specifier);
    if (!requestedModes?.size)
      return reject("request mode is not statically captured");
    const selected = select(target.value?.exports, parsed.subpath);
    const paths = new Set<string>();
    const budget = { remaining: 2048 };
    for (const mode of requestedModes) {
      for (const outcome of outcomes(selected, mode, budget)) {
        if (typeof outcome !== "string")
          return reject(
            "exports blocked, invalid, unmatched or over the condition budget",
          );
        const candidate = validateTarget(outcome, target);
        if (!candidate)
          return reject(
            "exports target is not an exact captured implementation within its package",
          );
        paths.add(candidate);
      }
    }
    if (paths.size !== 1)
      return reject(
        "conditional exports or request modes do not converge to one source",
      );
    const result = { known: true, targetPath: [...paths][0] };
    cache.set(key, result);
    return result;
  }
  return {
    resolve,
    recognizes: (specifier) => {
      const parsed = request(specifier);
      return !!parsed && knownNames.has(parsed.name);
    },
    diagnostics,
  };
}
