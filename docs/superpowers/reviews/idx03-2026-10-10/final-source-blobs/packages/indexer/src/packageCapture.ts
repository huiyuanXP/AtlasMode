import { normalizeRepoPath, type CodeSnapshot } from "@codemap/core";
import type { MetadataReader } from "./metadataRead.js";
import { packageMode } from "./packageMode.js";

/** Scanner-owned eligible and opaque seeds; rejected paths are never read. */
export async function capturePackages(
  allowedPaths: readonly string[],
  rejected: ReadonlyMap<string, string>,
  reader: MetadataReader,
) {
  const diagnostics: CodeSnapshot["diagnostics"] = [];
  const reject = (filePath: string, reason: string) =>
    diagnostics.push({
      filePath: normalizeRepoPath(filePath),
      message: `PACKAGE_MANIFEST_UNAVAILABLE: ${reason}`,
    });
  const capture = reader.category("Package manifest", reject);
  for (const [path, reason] of rejected) reject(path, reason);
  for (const path of [...new Set(allowedPaths)].sort()) {
    if (rejected.has(path)) continue;
    const file = await capture.read(path);
    if (file && packageMode(file.bytes) === "unknown")
      diagnostics.push({
        filePath: file.path,
        message:
          "Invalid package manifest JSON or type; package mode is unknown",
      });
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
