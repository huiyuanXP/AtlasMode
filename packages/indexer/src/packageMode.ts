import { posix } from "node:path";
import { normalizeRepoPath, type CodeSnapshot } from "@codemap/core";
import type { CommonJsMode, ModuleModeProvider } from "./commonjs.js";
import type { SourceFile } from "./scan.js";

/** Strict package syntax only; no Node loader, ancestor disk reads or exports lookup. */
export function packageMode(bytes: Buffer): CommonJsMode {
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      return "unknown";
    const type = (value as Record<string, unknown>).type;
    if (type === undefined || type === "commonjs") return "commonjs";
    return type === "module" ? "esm" : "unknown";
  } catch {
    return "unknown";
  }
}

export function createPackageModeProvider(
  manifests: readonly SourceFile[],
  captureDiagnostics: CodeSnapshot["diagnostics"] = [],
): ModuleModeProvider {
  const scopes = new Map<string, CommonJsMode>();
  function scope(path: string, mode: CommonJsMode) {
    try {
      path = normalizeRepoPath(path);
      if (posix.basename(path) === "package.json")
        scopes.set(posix.dirname(path), mode);
    } catch {
      /* Outside-root inputs provide no scope evidence. */
    }
  }
  for (const file of manifests) scope(file.path, packageMode(file.bytes));
  for (const diagnostic of captureDiagnostics)
    if (diagnostic.message.startsWith("PACKAGE_MANIFEST_UNAVAILABLE:"))
      scope(diagnostic.filePath, "unknown");
  return (sourcePath) => {
    try {
      sourcePath = normalizeRepoPath(sourcePath);
    } catch {
      return "unknown";
    }
    if (sourcePath.endsWith(".cjs")) return "commonjs";
    if (sourcePath.endsWith(".mjs")) return "esm";
    if (!sourcePath.endsWith(".js")) return "unknown";
    let directory = posix.dirname(sourcePath);
    for (;;) {
      const mode = scopes.get(directory);
      if (mode) return mode;
      if (directory === ".") return "unknown";
      directory = posix.dirname(directory);
    }
  };
}
