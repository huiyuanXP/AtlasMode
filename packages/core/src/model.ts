export type Language = "typescript" | "javascript" | "python" | "unknown";
export type CodeNode = {
  id: string;
  kind: "function" | "file" | "folder" | "external";
  name: string;
  qualifiedName?: string;
  filePath?: string;
  parentId?: string;
  language?: Language;
  signature?: string;
  startLine?: number;
  endLine?: number;
  exported?: boolean;
};
export type Relation = {
  id: string;
  type: "calls" | "imports" | "contains";
  sourceId: string;
  targetId: string | null;
  resolution: "resolved" | "unresolved" | "external";
  evidence: { filePath: string; line: number; text?: string };
  reason?: string;
};
export type CodeSnapshot = {
  id: string;
  projectId: string;
  createdAt: string;
  gitRevision: string | null;
  contentHash: string;
  nodes: CodeNode[];
  relations: Relation[];
  diagnostics: { filePath: string; line?: number; message: string }[];
  coverage: {
    files: string[];
    configurationFiles?: string[];
    excludedPatterns: string[];
    unresolvedCount: number;
    availability?: {
      complete: boolean;
      unavailablePaths: string[];
      excludedPaths?: string[];
    };
  };
};
export type Project = {
  id: string;
  path: string;
  name: string;
  snapshotId?: string;
};
export type Operation =
  | {
      kind: "add_function";
      tempId: string;
      name: string;
      filePath: string;
      signature?: string;
      description?: string;
      language?: Language;
    }
  | { kind: "remove_function"; nodeId: string }
  | {
      kind: "add_relation";
      id: string;
      sourceId: string;
      targetId: string;
      type: "calls" | "must_call" | "must_reuse";
    }
  | { kind: "remove_relation"; relationId: string }
  | { kind: "move_function"; nodeId: string; filePath: string }
  | { kind: "annotate"; targetId: string; text: string };
export type Plan = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  baselineSnapshotId: string;
  baselineContentHash: string;
  revision: number;
  operations: Operation[];
  status: "draft" | "approved" | "stale";
  createdAt: string;
  updatedAt: string;
};
export type Approval = {
  id: string;
  planId: string;
  revision: number;
  semanticHash: string;
  baselineSnapshotId: string;
  baselineContentHash: string;
  approvedAt: string;
  actor: "user";
};
export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  operationIndex?: number;
};
export type PlanDetail = {
  plan: Plan;
  approval?: Approval;
  valid: boolean;
  issues: ValidationIssue[];
};
export type BrowseRoute = {
  id: string;
  projectId: string;
  snapshotId: string;
  revision: number;
  title: string;
  description: string;
  source: "agent" | "user";
  kind: "walkthrough" | "call_chain";
  steps: { nodeId: string; note: string; relationId?: string }[];
  createdAt: string;
};
export type FunctionGroup = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  source: "agent" | "user";
  memberIds: string[];
};
export type DirectoryPolicy = {
  id: string;
  projectId: string;
  pathPrefix: string;
  purpose: string;
  forbiddenDependencies: string[];
};
export type ViewState = {
  positions: Record<string, { x: number; y: number }>;
  theme: "light" | "dark";
  locale: "zh" | "en";
};
export type VerificationReport = {
  planId: string;
  revision: number;
  snapshotId: string;
  items: {
    operationIndex: number;
    status: "satisfied" | "unmet" | "unknown";
    message: string;
    evidence: string[];
  }[];
};

export type RecordKind =
  | "projects"
  | "snapshots"
  | "plans"
  | "approvals"
  | "routes"
  | "views"
  | "groups"
  | "policies"
  | "settings";
export interface IndexerPort {
  index(rootPath: string, projectId: string): Promise<CodeSnapshot>;
  readSource?(
    rootPath: string,
    filePath: string,
  ): Promise<{ filePath: string; content: string }>;
}
export interface StoragePort {
  get<T>(kind: RecordKind, id: string): T | undefined;
  list<T>(kind: RecordKind): T[];
  put<T>(kind: RecordKind, id: string, value: T): void;
  delete(kind: RecordKind, id: string): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
