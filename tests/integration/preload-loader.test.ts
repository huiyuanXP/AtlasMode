import { expect, test } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  mkdir,
  copyFile,
  cp,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// A raw --import path treats # as a URL fragment (and Windows C: as a scheme).
// Exercise the actual launcher: losing its file-URL conversion must break startup.
test("production preload loads from a checkout path containing spaces and a hash", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas preload # "));
  try {
    await mkdir(join(root, "tests/support"), { recursive: true });
    await copyFile(
      resolve("tests/support/graceful-preload.mjs"),
      join(root, "tests/support/graceful-preload.mjs"),
    );
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    // Copy the entry: a symlink would intentionally fail its main-module guard.
    await cp(resolve("apps/server/dist"), join(root, "apps/server/dist"), {
      recursive: true,
    });
    await symlink(
      resolve("node_modules"),
      join(root, "node_modules"),
      "junction",
    );
    const helper = pathToFileURL(resolve("tests/support/production.mjs")).href;
    const script = `
      import assert from 'node:assert/strict';
      import { startProduction } from ${JSON.stringify(helper)};
      const server = await startProduction(${JSON.stringify(join(root, "data"))});
      try {
        assert.equal((await fetch(server.url + '/api/health')).ok, true);
        console.log('production ready');
      } finally {
        await server.stop();
      }
      console.log('handler stopped');
    `;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--input-type=module", "--eval", script],
      { cwd: root, timeout: 20000 },
    );
    expect(stdout).toContain("production ready");
    expect(stdout).toContain("handler stopped");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 25000);
