import { describe, expect, it } from "vitest";
import { buildAgentJob, sourceDigest } from "./build-agent-job.mjs";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("standalone Windows owned Job build interface", () => {
  it.each([["linux", "x64"], ["darwin", "arm64"], ["win32", "arm64"], ["win32", "ia32"]])("refuses unsupported %s/%s before producing artifacts", async (platform, arch) => {
    await expect(buildAgentJob({ platform, arch })).rejects.toThrow(/Windows x64/u);
  });
  it("binds the digest to literal source path and exact bytes in deterministic order", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "atlas-job-build-"));
    try {
      await mkdir(path.join(root, "src"));
      await writeFile(path.join(root, "src/a.cpp"), "a\n"); await writeFile(path.join(root, "src/b.h"), "b\n");
      const first = await sourceDigest(root, ["src/a.cpp", "src/b.h"]);
      expect(await sourceDigest(root, ["src/b.h", "src/a.cpp"])).toBe(first);
      await writeFile(path.join(root, "src/a.cpp"), "changed\n");
      expect(await sourceDigest(root, ["src/a.cpp", "src/b.h"])).not.toBe(first);
      await expect(sourceDigest(root, ["../escape"])).rejects.toThrow();
      expect(await readFile(path.join(root, "src/b.h"), "utf8")).toBe("b\n");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
