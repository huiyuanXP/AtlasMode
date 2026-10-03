import { afterEach, expect, test } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function repository() {
  const root = await mkdtemp(join(tmpdir(), "atlas-provenance-"));
  roots.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init");
  await writeFile(
    join(root, "main.ts"),
    "export function entry() { return 1; }\n",
  );
  git("add", ".");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "fixture",
  );
  return { root, git, commit: git("rev-parse", "HEAD") };
}
test.each(["modified", "staged", "untracked"])(
  "validator rejects %s supported source before capture",
  async (kind) => {
    const { root, git, commit } = await repository();
    await writeFile(
      join(root, kind === "untracked" ? "extra.py" : "main.ts"),
      kind === "untracked"
        ? "# changed\n"
        : "export function entry() { return 2; }\n",
    );
    if (kind === "staged") git("add", "main.ts");
    const run = spawnSync(
      process.execPath,
      [
        resolve("scripts/validate-repository.mjs"),
        "--path",
        root,
        "--commit",
        commit,
        "--symbol",
        "entry",
        "--file",
        "main.ts",
        "--label",
        "dirty-preflight",
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("Target working tree must be clean");
    expect(run.stdout).not.toContain("openMilliseconds");
  },
  20000,
);

test("clean provenance is recorded and completion rejects intervening source or revision changes", async () => {
  const { repositoryProvenance } =
    await import("../../scripts/repository-provenance.mjs");
  const { root, git, commit } = await repository();
  const before = repositoryProvenance(root, commit);
  expect(before).toMatchObject({
    gitRevision: commit,
    clean: true,
    status: "",
    checkedAt: expect.any(String),
  });
  await writeFile(join(root, "new.js"), "export function added() {}\n");
  expect(() => repositoryProvenance(root, before.gitRevision)).toThrow(
    /working tree must be clean/,
  );
  git("add", ".");
  expect(() => repositoryProvenance(root, before.gitRevision)).toThrow(
    /working tree must be clean/,
  );
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "intervening commit",
  );
  expect(() => repositoryProvenance(root, before.gitRevision)).toThrow(
    /pinned/,
  );
});
