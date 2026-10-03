import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { normalizeRepoPath } from "@codemap/core";
import type { SourceFile } from "./scan.js";

const fileLimit = 262144;
const totalLimit = 4194304;
const countLimit = 512;
export type MetadataReader = Awaited<ReturnType<typeof createMetadataReader>>;

/** One successful byte observation per allowed path, independent category budgets.
 * Failed or partial reads never enter the shared cache.
 */
export async function createMetadataReader(
  root: string,
  allowedPaths: readonly string[],
) {
  root = await realpath(root);
  const allowed = new Set(allowedPaths.map((p) => normalizeRepoPath(p)));
  const successful = new Map<string, SourceFile>();
  return {
    category(label: string, reject: (path: string, reason: string) => void) {
      const captured = new Map<string, SourceFile>();
      const failed = new Set<string>();
      let total = 0;
      async function read(path: string): Promise<SourceFile | undefined> {
        path = normalizeRepoPath(path);
        if (!allowed.has(path)) {
          reject(path, `${label} input is unavailable in the allowed scan`);
          return;
        }
        if (captured.has(path)) return captured.get(path);
        if (failed.has(path)) return;
        failed.add(path);
        if (captured.size >= countLimit) {
          reject(path, `${label} file count exceeds the 512 file budget`);
          return;
        }
        const shared = successful.get(path);
        if (shared) {
          if (total + shared.bytes.length > totalLimit) {
            reject(
              path,
              `${label} exceeds the 4194304 byte total capture budget`,
            );
            return;
          }
          captured.set(path, shared);
          total += shared.bytes.length;
          return shared;
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
                `Excluded ${label.toLowerCase()} symlink: links are not followed`,
              );
              return;
            }
            if (i === parts.length ? !info.isFile() : !info.isDirectory()) {
              reject(
                path,
                `${label} path is not a regular file in the allowed scan`,
              );
              return;
            }
          }
          if ((await realpath(absolute)) !== absolute) {
            reject(
              path,
              `Excluded ${label.toLowerCase()} path outside its allowed location`,
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
              reject(path, `${label} input is not an opened regular file`);
              return;
            }
            if (info.size > fileLimit) {
              reject(
                path,
                `${label} exceeds the 262144 byte single-file budget`,
              );
              return;
            }
            if (total + info.size > totalLimit) {
              reject(
                path,
                `${label} exceeds the 4194304 byte total capture budget`,
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
                `${label} location changed or became a symlink during capture`,
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
                  ? `${label} exceeds the 262144 byte single-file budget after reading`
                  : `${label} exceeds the 4194304 byte total capture budget after reading`,
              );
              return;
            }
            const file = {
              path,
              bytes: Buffer.from(buffer.subarray(0, length)),
            };
            successful.set(path, file);
            captured.set(path, file);
            total += length;
            return file;
          } finally {
            await handle.close();
          }
        } catch {
          reject(path, `${label} input is missing or could not be read safely`);
          return;
        }
      }

      return {
        read,
        files: () =>
          [...captured.values()].sort((a, b) =>
            a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
          ),
      };
    },
  };
}
