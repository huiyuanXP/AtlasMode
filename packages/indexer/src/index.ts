import { makeId, type CodeSnapshot, type IndexerPort } from "@codemap/core";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readSourceBytes, scan } from "./scan.js";
import { Graph } from "./graph.js";
import { indexTypeScript } from "./typescript.js";
import { createPackageModeProvider } from "./packageMode.js";
import { indexPython } from "./python.js";
import { decodeSource } from "./source.js";
const exec = promisify(execFile);
export class SourceIndexer implements IndexerPort {
  async readSource(
    rootPath: string,
    filePath: string,
  ): Promise<{ filePath: string; content: string }> {
    const captured = await readSourceBytes(rootPath, filePath);
    return {
      filePath: captured.path,
      content: decodeSource(captured.bytes, captured.path),
    };
  }
  async index(rootPath: string, projectId: string): Promise<CodeSnapshot> {
    const capture = await scan(rootPath),
      graph = new Graph(projectId);
    graph.diagnostics.push(...capture.diagnostics);
    for (const f of capture.files) graph.file(f.path);
    indexTypeScript(
      capture.files.filter((f) => !f.path.endsWith(".py")),
      graph,
      capture.configurations,
      capture.diagnostics,
      createPackageModeProvider(capture.manifests, capture.diagnostics),
    );
    await indexPython(
      capture.files.filter((f) => f.path.endsWith(".py")),
      graph,
    );
    let gitRevision: string | null = null;
    try {
      gitRevision =
        (
          await exec("git", ["-C", capture.root, "rev-parse", "HEAD"], {
            timeout: 5000,
          })
        ).stdout.trim() || null;
    } catch {
      /* A project need not be a Git checkout. */
    }
    const facts = {
      nodes: [...graph.nodes.values()],
      relations: graph.relations,
      diagnostics: graph.diagnostics,
      coverage: {
        files: capture.files.map((f) => f.path),
        configurationFiles: capture.configurations.map((f) => f.path),
        packageFiles: capture.manifests.map((f) => f.path),
        excludedPatterns: capture.excludedPatterns,
        availability: capture.availability,
        unresolvedCount: graph.relations.filter(
          (r) => r.resolution === "unresolved",
        ).length,
      },
    };
    // Capabilities and diagnostics are part of immutable facts, while contentHash
    // identifies versioned captured source, configuration and package inputs.
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          ...facts,
          diagnostics: facts.diagnostics.map((d) => ({
            ...d,
            message: d.message.replaceAll(capture.root, "<root>"),
          })),
        }),
      )
      .digest("hex");
    return {
      id: makeId("snapshot", projectId, capture.contentHash, fingerprint),
      projectId,
      createdAt: new Date().toISOString(),
      gitRevision,
      contentHash: capture.contentHash,
      ...facts,
    };
  }
}
