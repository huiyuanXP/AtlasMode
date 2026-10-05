import type {
  CodeNode,
  CodeRelation,
  FunctionNode,
  PlanRevision,
  Annotation,
  Group,
  FolderPolicy,
  ViewState,
} from '@codemap/core';
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  pathname: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch('/api' + pathname, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = data as {
      code?: string;
      message?: string;
      issues?: { message: string }[];
    };
    throw new ApiError(
      response.status,
      error.code ?? 'API_ERROR',
      error.issues?.map((issue) => issue.message).join('; ') ??
        error.message ??
        'Request failed',
    );
  }
  return data as T;
}
export const idPath = (id: string) => encodeURIComponent(id);
export interface ProjectSummary {
  repositoryId: string;
  snapshotId: string;
  source: 'code';
  createdAt: string;
  gitRevision: string | null;
  baselineDigest: string;
  counts: {
    functions: number;
    files: number;
    relations: number;
    unresolved: number;
  };
  scope: {
    includedCount: number;
    configuration: string[];
    exclusions: { path: string; reason: string }[];
    diagnostics: string[];
  };
}
export interface GraphData {
  snapshotId: string;
  source: 'code';
  nodes: CodeNode[];
  relations: CodeRelation[];
  unresolved: CodeRelation[];
  truncated: boolean;
  budget: number;
  depth: number;
}
export interface FunctionResults {
  snapshotId: string;
  source: 'code';
  items: FunctionNode[];
  offset: number;
  limit: number;
  total: number;
}
export interface FunctionContext {
  snapshotId: string;
  function: FunctionNode;
  file: Extract<CodeNode, { kind: 'file' }>;
  outgoing: CodeRelation[];
  incoming: CodeRelation[];
  unresolved: CodeRelation[];
  truncated: boolean;
}
export interface Records<T> {
  items: T[];
  offset: number;
  limit: number;
}
export type AnnotationRecord = Annotation & { binding: 'bound' | 'orphaned' };
export type GroupRecord = Group & { orphanedMembers: string[] };
export interface WorkspaceData {
  summary: ProjectSummary;
  graph: GraphData;
  annotations: AnnotationRecord[];
  groups: GroupRecord[];
  policies: FolderPolicy[];
  plans: PlanRevision[];
  view: ViewState | null;
}
