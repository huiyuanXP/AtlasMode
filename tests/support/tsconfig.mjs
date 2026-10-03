import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SqliteStorage } from "@codemap/storage";
import { createFixtures } from "./production.mjs";

// Authored call and targets never change: only inherited paths mapping changes.
export async function createTsconfigFixture(root) {
  const fixture = await createFixtures(root);
  await mkdir(join(fixture.ts, "config"));
  await writeFile(
    join(fixture.ts, "entry.ts"),
    'import { target } from "@target";\nexport function entry() { return target(); }\n',
  );
  await writeFile(
    join(fixture.ts, "targetA.ts"),
    '// Authored A\nexport function target() { return "A 原文"; }\n',
  );
  await writeFile(
    join(fixture.ts, "targetB.ts"),
    '// Authored B\n\nexport function target() { return "B 原文"; }\n',
  );
  await writeFile(
    join(fixture.ts, "tsconfig.json"),
    '{"extends":"./config/shared.json","include":["**/*.ts"]}\n',
  );
  const mapTo = (target) =>
    writeFile(
      join(fixture.ts, "config/shared.json"),
      `// Captured JSONC configuration\n{"compilerOptions":{"baseUrl":"..","paths":{"@target":["${target}.ts"]}}}\n`,
    );
  await mapTo("targetA");
  return { ...fixture, mapTo };
}

// Only seed disposable test databases, while their production server is stopped.
// Give the historic record its own identity to model pre-upgrade snapshots.
export function seedLegacySnapshot(data, snapshot) {
  const legacy = structuredClone(snapshot);
  legacy.id = `legacy-${snapshot.id}`;
  legacy.contentHash = "0".repeat(64);
  delete legacy.coverage.configurationFiles;
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
