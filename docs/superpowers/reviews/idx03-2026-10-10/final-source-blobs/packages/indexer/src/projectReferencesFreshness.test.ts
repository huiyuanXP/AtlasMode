import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { scan } from "./scan.js";
import { Graph } from "./graph.js";
import { indexTypeScript } from "./typescript.js";
import { createCapturedReferenceGraph } from "./projectReferenceGraph.js";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe("IDX03 captured freshness and public graph omission", () => {
  it("uses captured named configuration bytes after disk changes and changes hash only on fresh capture", async () => {
    const root = await mkdtemp(join(tmpdir(), "codemap-idx03-fresh-"));
    temps.push(root);
    const config = {
      compilerOptions: {
        composite: true,
        baseUrl: "../lib",
        paths: { "@leaf": ["main.ts"] },
      },
      include: ["../app"],
      references: [{ path: "./lib.json" }],
    };
    const inputs: Record<string, string> = {
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [{ path: "./configs/app.json" }],
      }),
      "configs/app.json": JSON.stringify(config),
      "configs/lib.json": JSON.stringify({
        compilerOptions: { composite: true },
        include: ["../lib"],
      }),
      "app/entry.ts":
        'import {helper} from "@leaf"; export function entry(){helper();}',
      "lib/main.ts": "export function helper(){}",
      "lib/other.ts": "export function helper(){}",
    };
    for (const [path, text] of Object.entries(inputs)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }
    const before = await scan(root);
    await writeFile(
      join(root, "configs/app.json"),
      JSON.stringify({
        ...config,
        compilerOptions: {
          ...config.compilerOptions,
          paths: { "@leaf": ["other.ts"] },
        },
      }),
    );
    const old = new Graph("fresh");
    indexTypeScript(
      before.files,
      old,
      before.configurations,
      before.diagnostics,
    );
    const target = (graph: Graph) =>
      graph.nodes.get(
        graph.relations.find(
          (r) => r.type === "calls" && r.evidence.filePath === "app/entry.ts",
        )!.targetId!,
      )?.filePath;
    expect(target(old)).toBe("lib/main.ts");
    const fresh = await scan(root),
      current = new Graph("fresh");
    indexTypeScript(
      fresh.files,
      current,
      fresh.configurations,
      fresh.diagnostics,
    );
    expect(fresh.contentHash).not.toBe(before.contentHash);
    expect(target(current)).toBe("lib/other.ts");
    expect(before.files).toEqual(fresh.files);
    expect([...old.nodes.keys()].sort()).toEqual(
      [...current.nodes.keys()].sort(),
    );
    await writeFile(
      join(root, "tsconfig.json"),
      JSON.stringify({
        files: [],
        references: [{ path: "./configs/app.json" }, { path: "./missing" }],
      }),
    );
    const afterReferences = await scan(root);
    expect(afterReferences.contentHash).not.toBe(fresh.contentHash);
    expect(afterReferences.files).toEqual(fresh.files);
  });
  it("omits overlong rows with accurate observed totals and all collection flags", () => {
    const config = "a".repeat(2049) + ".json",
      source = "s".repeat(2049) + ".ts";
    const result = createCapturedReferenceGraph(
      new Map([[config, "{}"]]),
      [config],
      () => true,
    );
    const graph = result.view([
      { sourcePath: source, configPath: config, status: "resolved" },
    ]);
    expect(graph.counts).toMatchObject({
      observedRoots: 1,
      observedProjects: 1,
      sourceScopes: 1,
      resolved: 1,
    });
    expect(graph.roots).toEqual([]);
    expect(graph.projects).toEqual([]);
    expect(graph.scopes).toEqual([]);
    expect(graph.truncated).toMatchObject({
      roots: true,
      projects: true,
      scopes: true,
    });
  });
  it("keeps configuration graph internal project storage within 512 even with additional unavailable roots", () => {
    const roots = Array.from(
      { length: 513 },
      (_, i) => "root" + i + "/tsconfig.json",
    );
    const inputs = new Map(roots.map((path) => [path, "{}"]));
    const graph = createCapturedReferenceGraph(inputs, roots, () => true).view(
      [],
    );
    expect(graph.counts.observedRoots).toBe(513);
    expect(graph.counts.observedProjects).toBe(512);
    expect(graph.status).toBe("partial");
    expect(graph.projects).toHaveLength(50);
    expect(graph.truncated.projects).toBe(true);
  });
});
