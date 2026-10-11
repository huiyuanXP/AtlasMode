import { WorkspaceService } from "@codemap/service";
import { SqliteStorage, StructureFileStore } from "@codemap/storage";
import { SourceIndexer } from "@codemap/indexer";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const [root, database, projectId, phase, policyId] = process.argv.slice(2) as [
  string,
  string,
  string,
  string,
  string?,
];
const storage = new SqliteStorage(database),
  files = new StructureFileStore();
const service = new WorkspaceService({
  storage,
  indexer: new SourceIndexer(),
  structureFiles: {
    read: (path) => files.read(path),
    publish: async (path, request) => {
      if (phase === "after") await files.publish(path, request);
      if (phase === "third")
        await writeFile(
          join(root, ".codemap", "structure.json"),
          JSON.stringify({
            schemaVersion: 1,
            folders: [{ path: "src", purpose: "external C" }],
            dependencyRules: [],
          }),
        );
      const resolved = Object.fromEntries(
        ["service", "storage", "indexer"].map((name) => [
          name,
          import.meta.resolve(`@codemap/${name}`),
        ]),
      );
      const productMode = Object.values(resolved).every((path) =>
        path.includes("/dist/"),
      )
        ? "compiled"
        : "source";
      writeFileSync(
        join(root, "crash-checkpoint.json"),
        JSON.stringify({
          pid: process.pid,
          phase,
          database,
          projectId,
          productMode,
          resolved,
          boundary: "durable-intent/publish-hook",
          hardKill: "SIGKILL",
        }),
      );
      process.kill(process.pid, "SIGKILL");
      throw new Error("unreachable-after-crash");
    },
  },
});
const state = await service.getStructure(projectId);
await service.updateStructure(projectId, {
  mutationId: randomUUID(),
  expectedStructureRevision: state.structureRevision,
  expectedFileDigest: state.fileDigest,
  operation: policyId
    ? {
        kind: "upsertLegacyPolicy",
        id: policyId,
        pathPrefix: "src",
        purpose: "candidate B",
        forbiddenDependencies: [],
      }
    : {
        kind: "upsertFolder",
        previousPath: "src",
        path: "src",
        purpose: "candidate B",
      },
});
