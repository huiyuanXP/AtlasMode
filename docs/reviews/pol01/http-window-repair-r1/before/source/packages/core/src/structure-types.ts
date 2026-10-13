import { DomainError, type DirectoryPolicy } from "./model.js";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type StructureFolder = JsonObject & {
  path: string;
  purpose: string;
  allowed?: string[];
  forbidden?: string[];
};
export type StructureDependencyRule = JsonObject & {
  from: string;
  mustNotImport: string[];
  reason: string;
};
export type PortableLegacyPolicy = Omit<DirectoryPolicy, "projectId"> &
  JsonObject;
export type StructureDocumentV1 = JsonObject & {
  schemaVersion: 1;
  folders: StructureFolder[];
  dependencyRules: StructureDependencyRule[];
};
export type StructureDiagnostic = {
  pointer: string;
  kind: string;
  message: string;
};
export class StructureError extends DomainError {
  constructor(
    code: string,
    message: string,
    public readonly diagnostics: StructureDiagnostic[] = [],
  ) {
    super(code, message);
  }
}
export type StructureOperation =
  | {
      kind: "upsertFolder";
      previousPath?: string;
      path: string;
      purpose: string;
    }
  | {
      kind: "upsertLegacyPolicy";
      id?: string;
      pathPrefix: string;
      purpose: string;
      forbiddenDependencies: string[];
    }
  | { kind: "importLegacy" };
export type StructureWriteInput = {
  mutationId: string;
  expectedStructureRevision: number;
  expectedFileDigest: string | null;
  operation: StructureOperation;
};
export type StructureFileRead = {
  bytes: Uint8Array | null;
  digest: string | null;
  verifiedAt: string;
  diagnostics: StructureDiagnostic[];
};
export type StructurePublishResult = {
  phase: "published" | "not_published" | "uncertain";
  actualDigest: string | null;
  errorCode?: string;
};
export interface StructureFilePort {
  read(rootPath: string): Promise<StructureFileRead>;
  publish(
    rootPath: string,
    input: {
      mutationId: string;
      expectedDigest: string | null;
      bytes: Uint8Array;
    },
  ): Promise<StructurePublishResult>;
}
export type StructureStatus =
  | "ready"
  | "missing"
  | "invalid"
  | "conflict"
  | "recovery_pending"
  | "unavailable";
export type StructureState = {
  projectId: string;
  schemaVersion: 1;
  document?: StructureDocumentV1;
  structureRevision: number;
  fileDigest: string | null;
  semanticDigest: string | null;
  verifiedAt: string;
  status: StructureStatus;
  diagnostics: StructureDiagnostic[];
  legacyPendingCount: number;
  lastGood?: {
    document: StructureDocumentV1;
    fileDigest: string;
    semanticDigest: string;
  };
};
export type StructureAudit = {
  id: string;
  projectId: string;
  source: "ui" | "external" | "legacy_migration";
  outcome: "committed" | "failed" | "conflicted" | "aborted";
  target: "file" | "legacy_db";
  beforeDigest: string | null;
  attemptedAfterDigest: string | null;
  observedAfterDigest: string | null;
  observedAfterKnown: boolean;
  beforeSemanticDigest: string | null;
  attemptedSemanticDigest: string | null;
  validatedAt: string;
  observedAt?: string;
  committedAt?: string;
  recoveredAt?: string;
  structureRevision: number;
  affectedPlans: { id: string; revision: number }[];
  errorCode?: string;
  policyId?: string;
  beforePolicyDigest?: string;
  afterPolicyDigest?: string;
  migrationIds?: string[];
};
export type StructureAuditPage = {
  items: StructureAudit[];
  offset: number;
  limit: number;
  total: number;
};
export type StructureRecoverySummary = {
  recoveredProjectIds: string[];
  blockedProjectIds: string[];
};
