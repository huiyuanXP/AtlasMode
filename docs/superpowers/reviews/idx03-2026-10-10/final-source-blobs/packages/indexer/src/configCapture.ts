import { basename, dirname, posix } from "node:path";
import ts from "typescript";
import { normalizeRepoPath, type CodeSnapshot } from "@codemap/core";
import type { SourceFile } from "./scan.js";
import { createMetadataReader, type MetadataReader } from "./metadataRead.js";

import { configurationReferences } from "./projectReferences.js";

const depthLimit = 16;

/** Metadata capture from paths the scanner has already made eligible.
 * No compiler host, package lookup, or target execution participates here.
 */
export async function captureConfigurations(
  root: string,
  allowedPaths: readonly string[],
  metadataReader?: MetadataReader,
): Promise<{ files: SourceFile[]; diagnostics: CodeSnapshot["diagnostics"] }> {
  const allowed = new Set(allowedPaths.map((p) => normalizeRepoPath(p)));
  const inheritance = new Map<string, string[]>();
  const references = new Map<string, string[]>();
  let observedReferences = 0;
  const expanded = new Set<string>();
  const diagnostics: CodeSnapshot["diagnostics"] = [];
  const reported = new Set<string>();
  const diagnose = (filePath: string, message: string) => {
    const key = JSON.stringify([filePath, message]);
    if (reported.has(key)) return;
    reported.add(key);
    diagnostics.push({ filePath, message });
  };

  const reject = (filePath: string, reason: string) =>
    diagnose(filePath, `CONFIGURATION_UNAVAILABLE: ${reason}`);

  const capture = (
    metadataReader ?? (await createMetadataReader(root, allowedPaths))
  ).category("Configuration", reject);
  const read = capture.read;

  function parents(file: SourceFile): string[] {
    if (inheritance.has(file.path)) return inheritance.get(file.path)!;
    const parents: string[] = [];
    inheritance.set(file.path, parents);
    const parsed = ts.parseConfigFileTextToJson(
      file.path,
      file.bytes.toString("utf8"),
    );
    if (
      parsed.error ||
      !parsed.config ||
      typeof parsed.config !== "object" ||
      Array.isArray(parsed.config)
    ) {
      diagnose(
        file.path,
        "Invalid configuration JSONC; no configuration options may be applied",
      );
      return parents;
    }
    const value: unknown = parsed.config.extends;
    if (value === undefined) return parents;
    if (
      typeof value !== "string" &&
      (!Array.isArray(value) ||
        !value.every((v: unknown) => typeof v === "string"))
    ) {
      diagnose(
        file.path,
        "Unsupported configuration extends: expected a relative .json path or array of paths",
      );
      return parents;
    }
    for (const entry of typeof value === "string"
      ? [value]
      : (value as string[])) {
      const relative = entry.replaceAll("\\", "/");
      if (!/^(?:\.\/|\.\.\/)/.test(relative) || !relative.endsWith(".json")) {
        diagnose(
          file.path,
          "Unsupported configuration extends: only relative .json inputs are supported; no package or absolute lookup",
        );
        continue;
      }
      let path: string;
      try {
        path = normalizeRepoPath(
          posix.join(dirname(file.path).replaceAll("\\", "/"), relative),
        );
      } catch {
        diagnose(
          file.path,
          "Configuration extends escapes outside the repository",
        );
        continue;
      }
      if (!allowed.has(path)) {
        diagnose(
          file.path,
          `Configuration extends input ${path} is missing or unavailable in the allowed scan (excluded, ignored or symlinked)`,
        );
        continue;
      }
      parents.push(path);
    }
    const sorted = [...new Set(parents)].sort();
    inheritance.set(file.path, sorted);
    return sorted;
  }

  function targets(file: SourceFile): string[] {
    if (references.has(file.path)) return references.get(file.path)!;
    const targets: string[] = [];
    references.set(file.path, targets);
    const parsed = ts.parseConfigFileTextToJson(
      file.path,
      file.bytes.toString("utf8"),
    );
    if (
      parsed.error ||
      !parsed.config ||
      typeof parsed.config !== "object" ||
      Array.isArray(parsed.config)
    )
      return targets;
    const result = configurationReferences(
      file.path,
      parsed.config.references,
      Math.max(0, 2048 - observedReferences),
    );
    observedReferences += result.entries.length;
    if (result.reason)
      diagnose(
        file.path,
        `Configuration references rejected: ${result.reason}`,
      );
    if (result.truncated)
      diagnose(
        file.path,
        "Configuration references exceed the 2048 entry budget",
      );
    for (const entry of result.entries) {
      if (entry.reason)
        diagnose(
          file.path,
          `Configuration references rejected: ${entry.reason}`,
        );
      else if (!allowed.has(entry.target!))
        diagnose(
          file.path,
          `Configuration reference input ${entry.target} is missing or unavailable in the allowed scan (excluded, ignored or symlinked)`,
        );
      else targets.push(entry.target!);
    }
    const sorted = [...new Set(targets)].sort();
    references.set(file.path, sorted);
    return sorted;
  }

  async function visit(
    path: string,
    depth: number,
    stack: ReadonlySet<string>,
    owner: string,
    followReferences = true,
    referenceDepth = 1,
    referenceStack: ReadonlySet<string> = new Set(),
  ) {
    if (followReferences && referenceStack.has(path)) {
      diagnose(
        owner,
        "Configuration references cycle; no configuration options may be applied",
      );
      return;
    }
    if (followReferences && referenceDepth > depthLimit) {
      diagnose(
        owner,
        "Configuration references depth exceeds 16 levels; no configuration options may be applied",
      );
      return;
    }
    if (stack.has(path)) {
      diagnose(
        owner,
        "Configuration extends cycle; no configuration options may be applied",
      );
      return;
    }
    if (depth > depthLimit) {
      diagnose(
        owner,
        "Configuration extends depth exceeds 16 levels; no configuration options may be applied",
      );
      return;
    }
    const file = await read(path);
    if (!file) return;
    const key = JSON.stringify([path, depth, followReferences, referenceDepth]);
    // Bound repeated shared DAG traversal to 512 paths × 16 depths. Cycle and
    // depth checks precede memoization; bytes are never re-read.
    if (expanded.has(key)) return;
    expanded.add(key);
    const next = new Set(stack).add(path);
    for (const parent of parents(file))
      await visit(
        parent,
        depth + 1,
        next,
        path,
        false,
        referenceDepth,
        referenceStack,
      );
    if (followReferences) {
      const referenced = new Set(referenceStack).add(path);
      for (const target of targets(file))
        await visit(
          target,
          1,
          new Set(),
          path,
          true,
          referenceDepth + 1,
          referenced,
        );
    }
  }
  for (const path of [...allowed]
    .filter((p) => /^tsconfig.*\.json$/.test(basename(p)))
    .sort()) {
    await visit(path, 1, new Set(), path);
  }
  return {
    files: capture.files(),
    diagnostics: diagnostics.sort((a, b) =>
      a.filePath < b.filePath
        ? -1
        : a.filePath > b.filePath
          ? 1
          : a.message < b.message
            ? -1
            : a.message > b.message
              ? 1
              : 0,
    ),
  };
}
