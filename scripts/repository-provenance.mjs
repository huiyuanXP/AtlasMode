import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Two checkpoints bound the acceptance capture. This is a clean-tree guard,
// not a filesystem lock or a claim to detect changes reverted between checks.
export function repositoryProvenance(path, expectedCommit) {
  const git = (...args) =>
    execFileSync("git", ["-C", path, ...args], { encoding: "utf8" });
  const gitRevision = git("rev-parse", "HEAD").trim();
  assert.equal(
    gitRevision,
    expectedCommit,
    "Target must be pinned to the reviewed full commit",
  );
  const status = git(
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=none",
  );
  assert.equal(
    status,
    "",
    "Target working tree must be clean, including staged and untracked files",
  );
  assert.equal(
    git("rev-parse", "HEAD").trim(),
    gitRevision,
    "Target revision changed during provenance capture",
  );
  return {
    gitRevision,
    clean: true,
    status,
    checkedAt: new Date().toISOString(),
  };
}
