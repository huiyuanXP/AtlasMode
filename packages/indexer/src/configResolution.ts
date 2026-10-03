import { posix } from "node:path";
import {
  getCompilerOptionsFromTsConfig,
  InMemoryFileSystemHost,
  Project,
  ts,
  type ResolutionHostFactory,
} from "ts-morph";
import { normalizeRepoPath, type CodeSnapshot } from "@codemap/core";
import type { SourceFile } from "./scan.js";

const virtualRoot = "/__codemap_captured__";
const virtualPath = (path: string) => virtualRoot + "/" + path;

type Scope = {
  path: string;
  options: ts.CompilerOptions;
  members: Set<string>;
};

/** All paths below are virtual, rooted below a synthetic directory, and backed only by captured bytes. */
export function createConfigurationResolver(
  sources: readonly SourceFile[],
  configurations: readonly SourceFile[],
  captureDiagnostics: readonly CodeSnapshot["diagnostics"][number][] = [],
): {
  resolutionHost: ResolutionHostFactory;
  diagnostics: CodeSnapshot["diagnostics"];
  configuredAlias(sourcePath: string, specifier: string): boolean;
} {
  const diagnostics: CodeSnapshot["diagnostics"] = [];
  const reported = new Set<string>();
  function diagnose(filePath: string, message: string) {
    const key = JSON.stringify([filePath, message]);
    if (!reported.has(key)) {
      reported.add(key);
      diagnostics.push({ filePath, message });
    }
  }
  const unavailable = new Set(
    captureDiagnostics
      .filter((d) => d.message.startsWith("CONFIGURATION_UNAVAILABLE:"))
      .map((d) => d.filePath),
  );
  const inputs = new Map(
    configurations.map((f) => [f.path, f.bytes.toString("utf8")]),
  );
  const sourcePaths = new Set(sources.map((f) => virtualPath(f.path)));
  // A synthetic child root prevents ../ paths from clamping to the filesystem
  // root and accidentally resolving back into the captured repository.
  const fs = new InMemoryFileSystemHost();
  for (const file of sources)
    fs.writeFileSync(virtualPath(file.path), file.bytes.toString("utf8"));
  for (const [path, text] of inputs) fs.writeFileSync(virtualPath(path), text);
  const candidates = new Set(
    [...inputs.keys(), ...unavailable].filter(
      (path) => posix.basename(path) === "tsconfig.json",
    ),
  );

  // Validation is per owning seed, not global captured membership. A rejected
  // extends chain must not contribute even the child's otherwise valid options.
  function validate(
    path: string,
    stack: Set<string>,
    depth: number,
    owner: string,
    validated: Set<string>,
  ): boolean {
    const reject = (reason: string) => {
      diagnose(
        owner,
        `Configuration rejected: ${reason}; no configuration options applied`,
      );
      return false;
    };
    if (depth > 16) return reject("extends depth exceeds 16 levels");
    if (stack.has(path)) return reject("extends cycle");
    if (unavailable.has(path) || !inputs.has(path))
      return reject("extends input unavailable in captured configuration");
    const key = JSON.stringify([path, depth]);
    if (validated.has(key)) return true;
    const parsed = ts.parseConfigFileTextToJson(
      virtualPath(path),
      inputs.get(path)!,
    );
    if (
      parsed.error ||
      !parsed.config ||
      typeof parsed.config !== "object" ||
      Array.isArray(parsed.config)
    )
      return reject("invalid JSONC");
    if (parsed.config.references !== undefined)
      diagnose(
        path,
        "Configuration project references are not expanded; only nearest tsconfig.json membership applies",
      );
    const value: unknown = parsed.config.extends;
    if (value === undefined) {
      validated.add(key);
      return true;
    }
    if (
      typeof value !== "string" &&
      (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    )
      return reject("extends must be a relative .json path or array");
    const next = new Set(stack).add(path);
    for (const entry of typeof value === "string"
      ? [value]
      : (value as string[])) {
      const relative = entry.replaceAll("\\", "/");
      if (!/^(?:\.\/|\.\.\/)/.test(relative) || !relative.endsWith(".json"))
        return reject("only relative .json extends inputs are supported");
      let parent: string;
      try {
        parent = normalizeRepoPath(posix.join(posix.dirname(path), relative));
      } catch {
        return reject("extends escapes the repository");
      }
      if (!validate(parent, next, depth + 1, owner, validated)) return false;
    }
    validated.add(key);
    return true;
  }
  const scopes = new Map<string, Scope | undefined>();
  function parse(path: string): Scope | undefined {
    if (scopes.has(path)) return scopes.get(path);
    scopes.set(path, undefined);
    if (!validate(path, new Set(), 1, path, new Set())) return;
    // Public ts-morph config APIs use TypeScript's JSONC/config parser and its
    // include/exclude matcher against this captured in-memory filesystem.
    const parsed = getCompilerOptionsFromTsConfig(virtualPath(path), {
      fileSystem: fs,
    });
    for (const error of parsed.errors)
      diagnose(
        path,
        `Invalid configuration (TypeScript TS${error.getCode()}); no configuration options applied`,
      );
    if (parsed.errors.length) return;
    const membership = new Project({
      fileSystem: fs,
      tsConfigFilePath: virtualPath(path),
      compilerOptions: { noLib: true },
      skipFileDependencyResolution: true,
    });
    const scope = {
      path,
      options: parsed.options,
      members: new Set(
        membership.getSourceFiles().map((f) => f.getFilePath() as string),
      ),
    };
    scopes.set(path, scope);
    return scope;
  }
  const bySource = new Map<string, Scope | undefined>();
  for (const file of sources) {
    let directory = posix.dirname(file.path);
    while (true) {
      const candidate = posix.join(directory, "tsconfig.json");
      if (candidates.has(candidate)) {
        const scope = parse(candidate);
        if (scope?.members.has(virtualPath(file.path)))
          bySource.set("/" + file.path, scope);
        break;
      }
      if (directory === ".") break;
      directory = posix.dirname(directory);
    }
  }
  function configuredAlias(sourcePath: string, specifier: string): boolean {
    const scope = bySource.get(
      sourcePath.startsWith("/") ? sourcePath : "/" + sourcePath,
    );
    return Object.keys(scope?.options.paths ?? {}).some((pattern) => {
      const star = pattern.indexOf("*");
      return star < 0
        ? pattern === specifier
        : specifier.length >= pattern.length - 1 &&
            specifier.startsWith(pattern.slice(0, star)) &&
            specifier.endsWith(pattern.slice(star + 1));
    });
  }
  const host: ts.ModuleResolutionHost = {
    fileExists: (path) => sourcePaths.has(path),
    readFile: (path) =>
      sourcePaths.has(path) ? fs.readFileSync(path) : undefined,
    directoryExists: (path) => fs.directoryExistsSync(path),
    getDirectories: (path) =>
      fs.directoryExistsSync(path)
        ? fs
            .readDirSync(path)
            .filter((entry) => entry.isDirectory)
            .map((entry) => entry.name)
        : [],
    realpath: (path) => path,
    getCurrentDirectory: () => virtualRoot,
  };
  const resolutionHost: ResolutionHostFactory = (_host, getCompilerOptions) => {
    const caches = new Map<string, ts.ModuleResolutionCache>();
    return {
      resolveModuleNames: (names, containingFile) => {
        const scope = bySource.get(containingFile);
        const options = { ...getCompilerOptions() };
        if (scope) {
          // Keep source extraction/checking policy unchanged. Other tsconfig
          // options, plugins, libraries and project references are not loaded.
          const selected = scope.options;
          for (const key of [
            "paths",
            "baseUrl",
            "module",
            "moduleResolution",
            "resolveJsonModule",
            "customConditions",
          ] as const) {
            if (selected[key] !== undefined)
              Object.assign(options, { [key]: selected[key] });
          }
          // TypeScript attaches the declaration directory for inherited paths
          // without baseUrl to its options; preserve that parser-owned metadata.
          Object.assign(options, {
            pathsBasePath: (
              selected as ts.CompilerOptions & { pathsBasePath?: string }
            ).pathsBasePath,
          });
        }
        const key = scope?.path ?? "";
        let cache = caches.get(key);
        if (!cache) {
          cache = ts.createModuleResolutionCache(
            virtualRoot,
            (path) => path,
            options,
          );
          caches.set(key, cache);
        }
        return names.map((name) => {
          const resolved = ts.resolveModuleName(
            name,
            virtualRoot + containingFile,
            options,
            host,
            cache,
          ).resolvedModule;
          if (resolved && sourcePaths.has(resolved.resolvedFileName))
            return {
              ...resolved,
              resolvedFileName: resolved.resolvedFileName.slice(
                virtualRoot.length,
              ),
            };
          if (scope && configuredAlias(containingFile, name))
            diagnose(
              scope.path,
              "Configured alias target is unavailable in captured sources (missing, excluded, ignored, symlinked or outside the repository)",
            );
          return undefined;
        });
      },
    };
  };
  return { resolutionHost, diagnostics, configuredAlias };
}
