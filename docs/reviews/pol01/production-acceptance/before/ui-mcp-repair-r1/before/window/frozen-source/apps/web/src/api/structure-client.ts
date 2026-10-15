import type {
  DirectoryPolicy,
  StructureDiagnostic,
  StructureState,
  StructureStatus,
  StructureWriteInput,
} from "@codemap/core";
export type PolicyCapture = {
  structureRevision: number;
  fileDigest: string | null;
  verifiedAt: string;
};
export type PolicyRead = PolicyCapture & {
  policies: DirectoryPolicy[];
  status: StructureStatus;
};
export type LegacyPreview = PolicyCapture & { policies: DirectoryPolicy[] };
export type PolicyWrite = Omit<DirectoryPolicy, "id" | "projectId"> & {
  id?: string;
} & Omit<StructureWriteInput, "operation">;
export interface StructureTransport {
  readState(
    projectId: string,
    acceptExternalConflict?: boolean,
  ): Promise<StructureState>;
  readPolicies(projectId: string): Promise<PolicyRead>;
  preview(projectId: string): Promise<LegacyPreview>;
  savePolicy(projectId: string, input: PolicyWrite): Promise<DirectoryPolicy>;
  writeStructure(
    projectId: string,
    input: StructureWriteInput,
  ): Promise<StructureState>;
}
export class StructureClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly diagnostics: StructureDiagnostic[] = [],
  ) {
    super(message);
  }
}
/** Independent transport: writes never read/rebase/retry their captured preconditions. */
export class StructureClient implements StructureTransport {
  constructor(private readonly transport: typeof fetch = fetch) {}
  private async request<T>(
    projectId: string,
    suffix: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const transport = this.transport;
    const response = await transport(
      `/api/projects/${encodeURIComponent(projectId)}${suffix}`,
      {
        method,
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      },
    );
    const value = await response.json();
    if (!response.ok) {
      const error = value as {
        code?: string;
        message?: string;
        diagnostics?: StructureDiagnostic[];
      };
      throw new StructureClientError(
        error.code ?? "HTTP_ERROR",
        error.message ?? `HTTP ${response.status}`,
        response.status,
        error.diagnostics ?? [],
      );
    }
    return value as T;
  }
  readState = (id: string, accept = false) =>
    this.request<StructureState>(
      id,
      `/structure${accept ? "?acceptExternalConflict=1" : ""}`,
    );
  readPolicies = (id: string) =>
    this.request<PolicyRead>(id, "/policies?includeStructure=1");
  preview = (id: string) =>
    this.request<LegacyPreview>(id, "/structure/legacy-preview");
  savePolicy = (id: string, input: PolicyWrite) =>
    this.request<DirectoryPolicy>(id, "/policies", "POST", input);
  writeStructure = (id: string, input: StructureWriteInput) =>
    this.request<StructureState>(id, "/structure", "PUT", input);
}
