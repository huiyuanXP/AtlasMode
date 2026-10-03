import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { basename, dirname, join, posix, resolve } from "node:path";
import ts from "typescript";
import { normalizeRepoPath, type CodeSnapshot } from "@codemap/core";
import type { SourceFile } from "./scan.js";

const fileLimit = 262144;
const totalLimit = 4194304;
const countLimit = 512;
const depthLimit = 16;

/** Metadata capture from paths the scanner has already made eligible.
 * No compiler host, package lookup, or target execution participates here.
 */
export async function captureConfigurations(
  root: string,
  allowedPaths: readonly string[],
): Promise<{ files: SourceFile[]; diagnostics: CodeSnapshot["diagnostics"] }> {
  root = await realpath(root);
  const allowed = new Set(allowedPaths.map((p) => normalizeRepoPath(p)));
  const captured = new Map<string, SourceFile>();
  const failed = new Set<string>();
  const inheritance = new Map<string, string[]>();
  const expanded = new Set<string>();
  const diagnostics: CodeSnapshot["diagnostics"] = [];
  const reported = new Set<string>();
  let total = 0;
  const diagnose = (filePath: string, message: string) => {
    const key = JSON.stringify([filePath, message]);
    if (reported.has(key)) return;
    reported.add(key);
    diagnostics.push({ filePath, message });
  };

  const reject = (filePath: string, reason: string) =>
    diagnose(filePath, `CONFIGURATION_UNAVAILABLE: ${reason}`);

  async function read(path: string): Promise<SourceFile | undefined> {
    if (captured.has(path)) return captured.get(path);
    if (failed.has(path)) return;
    failed.add(path);
    if (captured.size >= countLimit) {
      reject(path, "Configuration file count exceeds the 512 file budget");
      return;
    }
    // Recheck every component against replacements since enumeration. Open the
    // original path with NOFOLLOW rather than following a final symlink.
    const absolute = resolve(root, path);
    try {
      const parts = path.split("/");
      for (let i = 1; i <= parts.length; i++) {
        const info = await lstat(join(root, ...parts.slice(0, i)));
        if (info.isSymbolicLink()) {
          reject(
            path,
            "Excluded configuration symlink: links are not followed",
          );
          return;
        }
        if (i === parts.length ? !info.isFile() : !info.isDirectory()) {
          reject(
            path,
            "Configuration path is not a regular file in the allowed scan",
          );
          return;
        }
      }
      if ((await realpath(absolute)) !== absolute) {
        reject(
          path,
          "Excluded configuration path outside its allowed location",
        );
        return;
      }
      const handle = await open(
        absolute,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      try {
        const info = await handle.stat();
        if (!info.isFile()) {
          reject(path, "Configuration input is not an opened regular file");
          return;
        }
        if (info.size > fileLimit) {
          reject(
            path,
            "Configuration exceeds the 262144 byte single-file budget",
          );
          return;
        }
        if (total + info.size > totalLimit) {
          reject(
            path,
            "Configuration exceeds the 4194304 byte total capture budget",
          );
          return;
        }
        const current = await lstat(absolute);
        if (
          current.isSymbolicLink() ||
          current.dev !== info.dev ||
          current.ino !== info.ino ||
          (await realpath(absolute)) !== absolute
        ) {
          reject(
            path,
            "Configuration location changed or became a symlink during capture",
          );
          return;
        }
        // Bound allocation/read even if the file grows after stat; the extra
        // byte makes post-read budget overflow observable.
        const buffer = Buffer.alloc(
          Math.min(fileLimit, totalLimit - total) + 1,
        );
        let length = 0;
        while (length < buffer.length) {
          const { bytesRead } = await handle.read(
            buffer,
            length,
            buffer.length - length,
            null,
          );
          if (!bytesRead) break;
          length += bytesRead;
        }
        if (length > fileLimit || total + length > totalLimit) {
          reject(
            path,
            length > fileLimit
              ? "Configuration exceeds the 262144 byte single-file budget after reading"
              : "Configuration exceeds the 4194304 byte total capture budget after reading",
          );
          return;
        }
        const file = { path, bytes: Buffer.from(buffer.subarray(0, length)) };
        captured.set(path, file);
        total += length;
        return file;
      } finally {
        await handle.close();
      }
    } catch {
      reject(
        path,
        "Configuration input is missing or could not be read safely",
      );
      return;
    }
  }

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

  async function visit(
    path: string,
    depth: number,
    stack: ReadonlySet<string>,
    owner: string,
  ) {
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
    const key = JSON.stringify([path, depth]);
    // Bound repeated shared DAG traversal to 512 paths × 16 depths. Cycle and
    // depth checks precede memoization; bytes are never re-read.
    if (expanded.has(key)) return;
    expanded.add(key);
    const next = new Set(stack).add(path);
    for (const parent of parents(file))
      await visit(parent, depth + 1, next, path);
  }
  for (const path of [...allowed]
    .filter((p) => /^tsconfig.*\.json$/.test(basename(p)))
    .sort()) {
    await visit(path, 1, new Set(), path);
  }
  return {
    files: [...captured.values()].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    ),
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
