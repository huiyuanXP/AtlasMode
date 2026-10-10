import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snapshotSchema } from "@codemap/core";
import { SourceIndexer } from "./index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it.each([
  {
    extension: "ts",
    classId: "function:2b698580f152981bdf5faf6154455c41",
    methodId: "function:a8855f43c2dff472d8f219551444bacd",
    source:
      "export function plain() {}\nexport class C { constructor() {} run() { function nested() {} } field = () => {}; get value() { return 1; } }\nexport const arrow = () => {};\nconst object = { run() {} };",
    declarations: {
      plain: "function",
      C: "class",
      "C.constructor": "method",
      "C.run": "method",
      "C.run.nested": "function",
      "C.field": "method",
      "C.get value": "method",
      arrow: "function",
      run: "method",
    },
  },
  {
    extension: "py",
    classId: "function:0e66196104e48cab1ea499e51e7ca4ef",
    methodId: "function:939f279545ed194b021572aaca2660f6",
    source:
      "def plain(): pass\nclass C:\n    def run(self):\n        def nested(): pass\n    @staticmethod\n    async def static(): pass\n",
    declarations: {
      plain: "function",
      C: "class",
      "C.run": "method",
      "C.run.nested": "function",
      "C.static": "method",
    },
  },
])(
  "preserves AST declaration types and IDs for $extension snapshots and historical data",
  async ({ extension, source, declarations, classId, methodId }) => {
    const root = await mkdtemp(join(tmpdir(), "atlas-declarations-"));
    roots.push(root);
    const filePath = `main.${extension}`;
    await writeFile(join(root, filePath), source);
    const indexer = new SourceIndexer();
    const first = await indexer.index(root, "declarations");
    for (const [qualifiedName, declarationKind] of Object.entries(
      declarations,
    )) {
      expect(
        first.nodes.find((node) => node.qualifiedName === qualifiedName),
      ).toMatchObject({ kind: "function", declarationKind });
    }
    expect(snapshotSchema.safeParse(first).success).toBe(true);
    expect(first.nodes.find((node) => node.qualifiedName === "C")?.id).toBe(
      classId,
    );
    expect(first.nodes.find((node) => node.qualifiedName === "C.run")?.id).toBe(
      methodId,
    );
    const historical = structuredClone(first);
    for (const node of historical.nodes)
      delete (node as { declarationKind?: string }).declarationKind;
    expect(snapshotSchema.safeParse(historical).success).toBe(true);
    await writeFile(join(root, filePath), `\n${source}`);
    const second = await indexer.index(root, "declarations");
    for (const qualifiedName of Object.keys(declarations)) {
      expect(
        second.nodes.find((node) => node.qualifiedName === qualifiedName)?.id,
      ).toBe(
        first.nodes.find((node) => node.qualifiedName === qualifiedName)?.id,
      );
    }
  },
);
