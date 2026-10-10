import {
  makeId,
  type CodeNode,
  type CodeSnapshot,
  type Relation,
} from "@codemap/core";
import { posix } from "node:path";

/** Invocation-local graph accumulator; it is deliberately not a public API. */
export class Graph {
  nodes = new Map<string, CodeNode>();
  relations: Relation[] = [];
  diagnostics: CodeSnapshot["diagnostics"] = [];
  constructor(readonly projectId: string) {}
  node(
    kind: CodeNode["kind"],
    path: string,
    qualifiedName: string,
    data: Partial<CodeNode> = {},
    declarationKind?: string,
  ) {
    const id = declarationKind
      ? makeId(kind, this.projectId, path, qualifiedName, declarationKind)
      : makeId(kind, this.projectId, path, qualifiedName);
    const n: CodeNode = {
      id,
      kind,
      name: qualifiedName.split(".").at(-1) || qualifiedName,
      qualifiedName,
      ...(kind === "external" || (kind === "folder" && path === ".")
        ? {}
        : { filePath: path }),
      ...data,
    };
    this.nodes.set(id, n);
    return n;
  }
  file(path: string): CodeNode {
    const id = makeId("file", this.projectId, path, path),
      existing = this.nodes.get(id);
    if (existing) return existing;
    const parentPath = posix.dirname(path);
    const parent = this.folder(parentPath);
    const n = this.node("file", path, path, {
      name: posix.basename(path),
      parentId: parent.id,
      language: path.endsWith(".py")
        ? "python"
        : /\.[cm]?tsx?$/.test(path)
          ? "typescript"
          : "javascript",
    });
    this.edge("contains", parent.id, n.id, "resolved", path, 1);
    return n;
  }
  folder(path: string): CodeNode {
    const id = makeId("folder", this.projectId, path, path),
      existing = this.nodes.get(id);
    if (existing) return existing;
    const parent = path === "." ? undefined : this.folder(posix.dirname(path));
    const n = this.node("folder", path, path, {
      name: path === "." ? "." : posix.basename(path),
      ...(parent ? { parentId: parent.id } : {}),
    });
    if (parent) this.edge("contains", parent.id, n.id, "resolved", path, 1);
    return n;
  }
  external(name: string) {
    return this.node("external", "", name, { name });
  }
  edge(
    type: Relation["type"],
    sourceId: string,
    targetId: string | null,
    resolution: Relation["resolution"],
    filePath: string,
    line: number,
    text?: string,
    reason?: string,
  ) {
    this.relations.push({
      id: makeId(
        "relation",
        this.projectId,
        type,
        sourceId,
        targetId ?? "",
        filePath,
        String(line),
        String(this.relations.length),
      ),
      type,
      sourceId,
      targetId,
      resolution,
      evidence: { filePath, line, ...(text ? { text } : {}) },
      ...(reason ? { reason } : {}),
    });
  }
}
