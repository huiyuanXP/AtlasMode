import { posix } from "node:path";
import { normalizeRepoPath } from "@codemap/core";

/** Reject raw filesystem syntax before joining: join must never hide an absolute input. */
export function referenceTarget(
  sourcePath: string,
  raw: string,
): { path?: string; reason?: string } {
  if (
    !raw ||
    raw.includes("\0") ||
    raw.startsWith("/") ||
    raw.startsWith("\\") ||
    /^[a-zA-Z]:/.test(raw) ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw)
  )
    return {
      reason:
        "references require a relative path without absolute, drive, UNC, URL/scheme or NUL syntax",
    };
  const relative = raw.replaceAll("\\", "/");
  if (posix.extname(relative) && !relative.endsWith(".json"))
    return {
      reason:
        "reference target must be a directory or explicit .json configuration",
    };
  try {
    const target = posix.join(posix.dirname(sourcePath), relative);
    return {
      path: normalizeRepoPath(
        relative.endsWith(".json")
          ? target
          : posix.join(target, "tsconfig.json"),
      ),
    };
  } catch {
    return { reason: "reference path escapes outside the repository" };
  }
}

export type ReferenceEntry = { raw: string; target?: string; reason?: string };
export function configurationReferences(
  sourcePath: string,
  value: unknown,
  limit: number,
): {
  entries: ReferenceEntry[];
  reason?: string;
  truncated: boolean;
} {
  if (value === undefined) return { entries: [], truncated: false };
  if (!Array.isArray(value))
    return {
      entries: [],
      reason: "references must be a static array",
      truncated: false,
    };
  const entries = value
    .slice(0, limit)
    .map((entry: unknown): ReferenceEntry => {
      if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry) ||
        !("path" in entry) ||
        typeof entry.path !== "string" ||
        !entry.path
      )
        return {
          raw: "",
          reason: "reference entry must contain a nonempty static string path",
        };
      const target = referenceTarget(sourcePath, entry.path);
      return { raw: entry.path, target: target.path, reason: target.reason };
    });
  return { entries, truncated: value.length > limit };
}
