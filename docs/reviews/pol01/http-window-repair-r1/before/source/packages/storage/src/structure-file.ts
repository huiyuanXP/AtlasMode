import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  DomainError,
  StructureError,
  type StructureFilePort,
  type StructureFileRead,
  type StructurePublishResult,
} from "@codemap/core";

type Operations = Pick<
  typeof fs,
  "realpath" | "lstat" | "mkdir" | "open" | "rename" | "unlink"
>;
const limit = 1024 * 1024;
const errno = (error: unknown) => (error as NodeJS.ErrnoException).code;

export class StructureFileStore implements StructureFilePort {
  private readonly fs: Operations;
  constructor(options: { fs?: Operations } = {}) {
    this.fs = options.fs ?? fs;
  }

  private async metadataPath(
    rootPath: string,
    create = false,
  ): Promise<string> {
    const root = await this.fs.realpath(rootPath);
    if (!(await this.fs.lstat(root)).isDirectory())
      throw new DomainError("INVALID_PATH", "Expected a project directory.");
    const directory = join(root, ".codemap");
    let metadata;
    try {
      metadata = await this.fs.lstat(directory);
    } catch (error) {
      if (errno(error) !== "ENOENT") throw error;
      if (create) {
        await this.fs.mkdir(directory, { mode: 0o700 });
        metadata = await this.fs.lstat(directory);
      }
    }
    if (metadata && (metadata.isSymbolicLink() || !metadata.isDirectory()))
      throw new DomainError(
        "INVALID_PATH",
        "Metadata directory must be a real project directory.",
      );
    const target = join(directory, "structure.json");
    try {
      const file = await this.fs.lstat(target);
      if (file.isSymbolicLink() || !file.isFile())
        throw new DomainError(
          "INVALID_PATH",
          "Structure metadata must be a regular file.",
        );
    } catch (error) {
      if (errno(error) !== "ENOENT") throw error;
    }
    return target;
  }

  async read(rootPath: string): Promise<StructureFileRead> {
    const target = await this.metadataPath(rootPath);
    let handle;
    try {
      handle = await this.fs.open(
        target,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
    } catch (error) {
      if (errno(error) !== "ENOENT") throw error;
      return {
        bytes: null,
        digest: null,
        verifiedAt: new Date().toISOString(),
        diagnostics: [],
      };
    }
    try {
      if (!(await handle.stat()).isFile())
        throw new DomainError(
          "INVALID_PATH",
          "Structure metadata must be a regular file.",
        );
      const hash = createHash("sha256"),
        chunks: Buffer[] = [];
      let length = 0;
      for await (const raw of handle.createReadStream({ autoClose: false })) {
        const chunk = Buffer.from(raw as Uint8Array);
        hash.update(chunk);
        length += chunk.length;
        if (length <= limit) chunks.push(chunk);
      }
      const digest = hash.digest("hex"),
        verifiedAt = new Date().toISOString();
      if (length > limit)
        return {
          bytes: null,
          digest,
          verifiedAt,
          diagnostics: [
            {
              pointer: "",
              kind: "size",
              message: "Structure file exceeds 1 MiB.",
            },
          ],
        };
      const bytes = Buffer.concat(chunks);
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return {
          bytes: null,
          digest,
          verifiedAt,
          diagnostics: [
            {
              pointer: "",
              kind: "utf8",
              message: "Structure file is not valid UTF-8.",
            },
          ],
        };
      }
      return { bytes, digest, verifiedAt, diagnostics: [] };
    } finally {
      await handle.close();
    }
  }

  async publish(
    rootPath: string,
    input: {
      mutationId: string;
      expectedDigest: string | null;
      bytes: Uint8Array;
    },
  ): Promise<StructurePublishResult> {
    let published = false,
      temporary: string | undefined;
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    const candidateDigest = createHash("sha256")
      .update(input.bytes)
      .digest("hex");
    try {
      if (input.bytes.length > limit)
        throw new StructureError(
          "INVALID_STRUCTURE",
          "Structure file exceeds 1 MiB.",
        );
      new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
      const before = await this.read(rootPath);
      if (before.digest !== input.expectedDigest || before.diagnostics.length)
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "Structure file changed before publication.",
        );
      const target = await this.metadataPath(rootPath, true);
      const mode =
        before.digest === null
          ? 0o600
          : (await this.fs.lstat(target)).mode & 0o777;
      temporary = join(
        target.slice(0, -"structure.json".length),
        `structure.${randomUUID()}.tmp`,
      );
      handle = await this.fs.open(temporary, "wx", mode);
      await handle.chmod(mode);
      await handle.writeFile(input.bytes);
      await handle.sync();
      await handle.close();
      handle = undefined;
      const current = await this.read(rootPath);
      if (current.digest !== input.expectedDigest || current.diagnostics.length)
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "Structure file changed during publication.",
        );
      // The project queue serializes cooperating writers; arbitrary editors still have a TOCTOU window here.
      await this.fs.rename(temporary, target);
      published = true;
      temporary = undefined;
      const directory = await this.fs.open(
        join(target, ".."),
        constants.O_RDONLY,
      );
      try {
        try {
          await directory.sync();
        } catch (error) {
          if (
            process.platform !== "win32" ||
            !["EINVAL", "EPERM", "EISDIR", "ENOTSUP"].includes(
              errno(error) ?? "",
            )
          )
            throw error;
        }
      } finally {
        await directory.close();
      }
      const observed = await this.read(rootPath);
      if (observed.digest !== candidateDigest || observed.diagnostics.length)
        throw new StructureError(
          "STRUCTURE_CONFLICT",
          "Structure file changed after publication.",
        );
      return { phase: "published", actualDigest: observed.digest };
    } catch (error) {
      let actualDigest: string | null = null;
      try {
        actualDigest = (await this.read(rootPath)).digest;
      } catch {
        /* Caller re-reads with an explicit known/unknown audit marker. */
      }
      return {
        phase: published ? "uncertain" : "not_published",
        actualDigest,
        errorCode:
          error instanceof DomainError
            ? error.code
            : published
              ? "STRUCTURE_RECOVERY_PENDING"
              : "STRUCTURE_WRITE_FAILED",
      };
    } finally {
      if (handle) await handle.close().catch(() => {});
      if (temporary) await this.fs.unlink(temporary).catch(() => {});
    }
  }
}
