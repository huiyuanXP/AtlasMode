import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SqliteStorage } from "@codemap/storage";

// Source bytes are never executed or changed by the package-only lifecycle.
export async function createCommonjsFixture(root) {
  const path = join(root, "commonjs");
  const marker = join(root, "TARGET_EXECUTED");
  await mkdir(path);
  const files = {
    "entry.js":
      'const mod = require("./helper");\nfunction entry() { return mod.helper(); }\nexports.entry = entry;\n',
    "helper.js":
      '// 作者原文\nfunction helper() { return "中文 helper"; }\nexports.helper = helper;\n',
    "overwritten.js":
      'function oldHelper() { return "old"; }\nexports.helper = oldHelper;\nexports.helper = () => "new";\n',
    "unknown.js":
      'const mod = require("./overwritten");\nfunction overwritten() { return mod.helper(); }\nfunction shadowed(require) { const local = require("./helper"); return local.helper(); }\nexports.overwritten = overwritten;\nexports.shadowed = shadowed;\n',
    "never-execute.cjs": `const fs = require("node:fs");\nfs.writeFileSync(${JSON.stringify(marker)}, "executed");\nthrow new Error("Target source must never execute");\n`,
  };
  await Promise.all(
    Object.entries(files).map(([name, bytes]) =>
      writeFile(join(path, name), bytes),
    ),
  );
  const setType = (type) =>
    writeFile(join(path, "package.json"), JSON.stringify({ type }) + "\n");
  await setType("commonjs");
  return {
    path,
    marker,
    setType,
    assertNotExecuted: () => assert.rejects(access(marker)),
  };
}

// Only disposable stores, with the production process stopped. Omit ONLY package metadata.
export function seedLegacyPackageSnapshot(data, snapshot) {
  const legacy = structuredClone(snapshot);
  legacy.id = `legacy-package-${snapshot.id}`;
  legacy.contentHash = "1".repeat(64);
  delete legacy.coverage.packageFiles;
  const storage = new SqliteStorage(join(data, "atlasmode.sqlite"));
  try {
    const project = storage.get("projects", snapshot.projectId);
    storage.put("snapshots", legacy.id, legacy);
    storage.put("projects", project.id, { ...project, snapshotId: legacy.id });
  } finally {
    storage.close();
  }
  return legacy;
}
