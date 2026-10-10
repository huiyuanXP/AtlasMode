import ignore from "ignore";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import {
  DomainError,
  normalizeRepoPath,
  type CodeSnapshot,
} from "@codemap/core";
import { captureConfigurations } from "./configCapture.js";
import { capturePackages } from "./packageCapture.js";
import { createMetadataReader } from "./metadataRead.js";

export type SourceFile = { path: string; bytes: Buffer };
const excludedNames = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".agents",
  ".superpowers",
  ".next",
  ".cache",
  "vendor",
];
export const excludedPatterns = excludedNames.map((p) => `**/${p}/**`);
const configurationSeed = (path: string) =>
  /^tsconfig.*\.json$/.test(basename(path));
function contained(root: string, path: string) {
  const r = relative(root, path);
  return r !== ".." && !r.startsWith(`..${sep}`) && !isAbsolute(r);
}

async function rootDirectory(rootPath: string) {
  try {
    const root = await realpath(rootPath);
    if (!(await stat(root)).isDirectory()) throw new Error("Not a directory");
    return root;
  } catch {
    throw new DomainError(
      "INVALID_PATH",
      "Project root must be an accessible directory",
    );
  }
}

export async function readSourceBytes(rootPath: string, filePath: string) {
  const path = normalizeRepoPath(filePath),
    root = await rootDirectory(rootPath);
  try {
    const absolute = await realpath(join(root, path));
    if (!contained(root, absolute))
      throw new DomainError(
        "INVALID_PATH",
        "Source path is outside project root",
      );
    const handle = await open(
      absolute,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      if (!(await handle.stat()).isFile())
        throw new DomainError(
          "INVALID_PATH",
          "Source path must identify a file",
        );
      return { path, bytes: await handle.readFile() };
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    throw new DomainError(
      code === "ENOENT" ? "NOT_FOUND" : "INVALID_PATH",
      code === "ENOENT"
        ? "Source file was not found"
        : "Source file could not be read",
    );
  }
}

export async function scan(rootPath: string): Promise<{
  root: string;
  files: SourceFile[];
  configurations: SourceFile[];
  manifests: SourceFile[];
  contentHash: string;
  diagnostics: CodeSnapshot["diagnostics"];
  excludedPatterns: string[];
  availability: NonNullable<CodeSnapshot["coverage"]["availability"]>;
}> {
  const root = await rootDirectory(rootPath);
  const diagnostics: CodeSnapshot["diagnostics"] = [],
    files: SourceFile[] = [];
  const entries: string[] = [],
    directories: string[] = [];
  const unavailable = new Set<string>(),
    excluded: string[] = [];
  const configurationUnavailable = (filePath: string, reason: string) => {
    diagnostics.push({
      filePath,
      message: `CONFIGURATION_UNAVAILABLE: ${reason}`,
    });
  };
  const rejectedPackages = new Map<string, string>();
  const metadataSeed = (path: string) =>
    configurationSeed(path) || basename(path) === "package.json";
  const metadataUnavailable = (path: string, reason: string) => {
    if (basename(path) === "package.json") rejectedPackages.set(path, reason);
    else configurationUnavailable(path, reason);
  };
  let complete = true;
  // Enumerate eligible directories without following links or descending into
  // the fixed out-of-scope roots. Record every skipped subtree explicitly.
  async function walk(directory: string) {
    try {
      for (const entry of await readdir(join(root, directory), {
        withFileTypes: true,
      })) {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        if (excludedNames.includes(entry.name)) {
          excluded.push(path);
          continue;
        }
        entries.push(path);
        if (entry.isDirectory()) {
          directories.push(path);
          await walk(path);
        }
      }
    } catch (error) {
      complete = false;
      if (directory) unavailable.add(directory);
      diagnostics.push({
        filePath: directory || "<root>",
        message: `Could not enumerate source: ${(error as Error).message}`,
      });
    }
  }
  await walk("");
  entries.sort();
  const captures = new Map<string, Buffer>();
  const metadataCandidates: string[] = [];
  // All reads use the same captured bytes for parsing and hashing. Never let a
  // compiler or the Python helper read additional target files behind the scan.
  for (const entry of entries) {
    const path = normalizeRepoPath(entry),
      absolute = join(root, path);
    try {
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        if (metadataSeed(path)) {
          metadataUnavailable(path, "Metadata symlinks are not followed");
          continue;
        }
        unavailable.add(path);
        diagnostics.push({
          filePath: path,
          message:
            "Excluded symlink: source and directory symlinks are not followed",
        });
        continue;
      }
      if (metadataSeed(path) && !info.isFile()) {
        metadataUnavailable(path, "Metadata path is not a regular file");
        continue;
      }
      if (
        !info.isFile() ||
        (!/\.(?:[cm]?[jt]sx?|py)$/.test(path) &&
          !path.endsWith(".gitignore") &&
          !path.endsWith(".json"))
      )
        continue;
      const canonical = await realpath(absolute);
      if (!contained(root, canonical)) {
        if (metadataSeed(path)) {
          metadataUnavailable(path, "Metadata path is outside project root");
          continue;
        }
        unavailable.add(path);
        diagnostics.push({
          filePath: path,
          message: "Excluded path outside project root",
        });
        continue;
      }
      // Only eligibility is collected here; metadata bytes are captured
      // after ignore rules are known, through the bounded metadata reader.
      if (path.endsWith(".json")) {
        metadataCandidates.push(path);
        continue;
      }
      const handle = await open(
        canonical,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      try {
        captures.set(path, await handle.readFile());
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (metadataSeed(path)) {
        metadataUnavailable(
          path,
          "Metadata input is missing or could not be inspected safely",
        );
        continue;
      }
      unavailable.add(path);
      diagnostics.push({
        filePath: path,
        message: `Could not read source: ${(error as Error).message}`,
      });
    }
  }
  const candidates = [...captures]
    .filter(([p]) => p.endsWith(".gitignore"))
    .map(([path, bytes]) => ({
      path,
      dir:
        dirname(path) === "." ? "" : dirname(path).replaceAll("\\", "/") + "/",
      matcher: ignore().add(bytes.toString("utf8")),
    }))
    .sort((a, b) => a.dir.length - b.dir.length || (a.path < b.path ? -1 : 1));
  const rules: typeof candidates = [];
  const ignored = (path: string) => {
    let result = false;
    for (const rule of rules) {
      if (!path.startsWith(rule.dir) || path === rule.path || path === rule.dir)
        continue;
      const match = rule.matcher.test(path.slice(rule.dir.length));
      if (match.ignored) result = true;
      else if (match.unignored) result = false;
    }
    return result;
  };
  // Git never consults an ignore file inside a directory already excluded by
  // its parent. Otherwise deeper rules may override matching parent rules.
  for (const candidate of candidates)
    if (!ignored(candidate.path)) rules.push(candidate);
  for (const directory of directories)
    if (ignored(`${directory}/`)) unavailable.add(directory);
  for (const [path, bytes] of captures) {
    if (path.endsWith(".gitignore")) continue;
    if (ignored(path)) {
      unavailable.add(path);
      continue;
    }
    files.push({ path, bytes });
  }
  const allowedMetadata = metadataCandidates.filter((path) => {
    if (!ignored(path)) return true;
    if (metadataSeed(path))
      metadataUnavailable(
        path,
        "Metadata input is excluded by Git ignore rules",
      );
    return false;
  });
  const metadataReader = await createMetadataReader(root, allowedMetadata);
  const configurationCapture = await captureConfigurations(
    root,
    allowedMetadata,
    metadataReader,
  );
  diagnostics.push(...configurationCapture.diagnostics);
  const configurations = configurationCapture.files;
  const packageCapture = await capturePackages(
    allowedMetadata.filter((path) => basename(path) === "package.json"),
    rejectedPackages,
    metadataReader,
  );
  diagnostics.push(...packageCapture.diagnostics);
  const manifests = packageCapture.files;
  // Versioned, typed and length-framed inputs: no ambiguity between paths,
  // source/configuration/package records, or arbitrary bytes (including invalid JSONC).
  const hash = createHash("sha256").update("codemap-index-inputs-v3\0");
  for (const [type, inputs] of [
    ["source", files],
    ["configuration", configurations],
    ["package", manifests],
  ] as const) {
    for (const { path, bytes } of inputs) {
      hash.update(`${type}:${Buffer.byteLength(path)}:`);
      hash.update(path);
      hash.update(`:${bytes.length}:`);
      hash.update(bytes);
    }
  }
  return {
    root,
    files,
    configurations,
    manifests,
    availability: {
      complete,
      unavailablePaths: [...unavailable].sort(),
      excludedPaths: excluded.sort(),
    },
    contentHash: hash.digest("hex"),
    diagnostics,
    excludedPatterns: [
      ...excludedPatterns,
      ...rules.map(
        (r) => `${r.path}: ${captures.get(r.path)!.toString("utf8").trim()}`,
      ),
    ],
  };
}
