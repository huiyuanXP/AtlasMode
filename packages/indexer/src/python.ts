import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { SourceFile } from "./scan.js";
import type { Graph } from "./graph.js";
import type { CodeSnapshot } from "@codemap/core";

type PythonOutput = {
  nodes: {
    path: string;
    qualified: string;
    kind: string;
    name: string;
    parent: string;
    startLine: number;
    endLine: number;
    signature: string;
    exported: boolean;
  }[];
  imports: {
    path: string;
    module: string;
    relative: boolean;
    target: string | null;
    line: number;
    text: string;
  }[];
  calls: {
    path: string;
    source: string;
    line: number;
    text: string;
    target: [string, string] | null;
  }[];
  diagnostics: CodeSnapshot["diagnostics"];
};
const exec = promisify(execFile);
async function pythonExecutable() {
  const configured = process.env.CODEMAP_PYTHON;
  const candidates = configured
    ? [{ command: configured, args: [] as string[] }]
    : [
        { command: "python3", args: [] },
        { command: "python", args: [] },
        ...(process.platform === "win32"
          ? [{ command: "py", args: ["-3"] }]
          : []),
      ];
  for (const candidate of candidates) {
    try {
      await exec(
        candidate.command,
        [
          ...candidate.args,
          "-I",
          "-c",
          "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)",
        ],
        { timeout: 5000 },
      );
      return candidate;
    } catch {
      /* Try the next supported executable, unless explicitly configured. */
    }
  }
  throw new Error(
    "Python 3.10+ is required to index .py files. Install Python 3 or set CODEMAP_PYTHON to its executable path.",
  );
}
async function parse(files: SourceFile[]): Promise<PythonOutput> {
  const executable = await pythonExecutable();
  // Both src/python.ts and dist/python.js are one level below package root.
  // npm ships the sibling python directory; this never depends on process cwd.
  const helper = fileURLToPath(new URL("../python/index.py", import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(
      executable.command,
      [...executable.args, "-I", helper],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    const output: Buffer[] = [],
      errors: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Python AST parser timed out after 60 seconds"));
    }, 60000);
    child.stdout.on("data", (b) => output.push(b));
    child.stderr.on("data", (b) => errors.push(b));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.stdin.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            `Python AST parser exited ${code}: ${Buffer.concat(errors).toString("utf8")}`,
          ),
        );
        return;
      }
      try {
        resolve(
          JSON.parse(Buffer.concat(output).toString("utf8")) as PythonOutput,
        );
      } catch (e) {
        reject(e);
      }
    });
    child.stdin.end(
      JSON.stringify(
        files.map((f) => ({ path: f.path, bytes: f.bytes.toString("base64") })),
      ),
    );
  });
}
export async function indexPython(files: SourceFile[], graph: Graph) {
  if (!files.length) return;
  let result: PythonOutput;
  try {
    result = await parse(files);
  } catch (error) {
    for (const file of files)
      graph.diagnostics.push({
        filePath: file.path,
        message: (error as Error).message,
      });
    return;
  }
  graph.diagnostics.push(...result.diagnostics);
  const nodeIds = new Map<string, string>();
  for (const node of result.nodes) {
    const parentId =
      nodeIds.get(`${node.path}:${node.parent}`) ?? graph.file(node.path).id;
    const n = graph.node(
      "function",
      node.path,
      node.qualified,
      {
        name: node.name,
        parentId,
        language: "python",
        startLine: node.startLine,
        endLine: node.endLine,
        signature: node.signature,
        exported: node.exported,
      },
      node.kind,
    );
    nodeIds.set(`${node.path}:${node.qualified}`, n.id);
    graph.edge(
      "contains",
      parentId,
      n.id,
      "resolved",
      node.path,
      node.startLine,
    );
  }
  for (const imp of result.imports) {
    const targetId = imp.target
      ? graph.file(imp.target).id
      : imp.relative
        ? null
        : graph.external(imp.module).id;
    graph.edge(
      "imports",
      graph.file(imp.path).id,
      targetId,
      imp.target ? "resolved" : imp.relative ? "unresolved" : "external",
      imp.path,
      imp.line,
      imp.text,
      targetId
        ? undefined
        : "Relative module was not included or could not be resolved",
    );
  }
  for (const call of result.calls) {
    const external = call.target?.[0] === "external";
    const targetId = call.target
      ? external
        ? graph.external(call.target[1]).id
        : (nodeIds.get(`${call.target[0]}:${call.target[1]}`) ?? null)
      : null;
    graph.edge(
      "calls",
      nodeIds.get(`${call.path}:${call.source}`) ?? graph.file(call.path).id,
      targetId,
      external ? "external" : targetId ? "resolved" : "unresolved",
      call.path,
      call.line,
      call.text,
      targetId
        ? undefined
        : "No unique indexed implementation for this call (dynamic, shadowed, or excluded target)",
    );
  }
}
