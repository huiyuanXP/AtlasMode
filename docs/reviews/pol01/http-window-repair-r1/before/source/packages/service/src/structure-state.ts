import { createHash } from "node:crypto";
import type {
  DirectoryPolicy,
  Plan,
  StoragePort,
  StructureAudit,
  StructureOperation,
  StructureState,
} from "@codemap/core";

export type StructureIntent = {
  recordType: "structure_intent";
  projectId: string;
  mutationId: string;
  requestDigest: string;
  pending: boolean;
  phase: "prepared" | "committed" | "failed" | "conflicted" | "aborted";
  source: "ui" | "legacy_migration";
  operation: StructureOperation;
  beforeDigest: string | null;
  afterDigest: string;
  beforeSemanticDigest: string | null;
  afterSemanticDigest: string;
  beforeBytes: string | null;
  candidateBytes: string;
  migrationPolicies: DirectoryPolicy[];
  validatedAt: string;
  beforeRevision: number;
};
export type StoredStructureAudit = StructureAudit & {
  recordType: "structure_audit";
  requestDigest?: string;
};
type StructureNoOpReceipt = {
  recordType: "structure_no_op";
  projectId: string;
  mutationId: string;
  requestDigest: string;
  outcome: "no_op";
  structureRevision: number;
  fileDigest: string | null;
  verifiedAt: string;
  completedAt: string;
};
export const structureHash = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
export function requestHash(value: unknown): string {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input !== null && typeof input === "object") {
      const result: Record<string, unknown> = Object.create(null) as Record<
        string,
        unknown
      >;
      for (const key of Object.keys(input).sort())
        result[key] = stable((input as Record<string, unknown>)[key]);
      return result;
    }
    return input;
  };
  return structureHash(JSON.stringify(stable(value)));
}

export class StructureRecords {
  constructor(readonly storage: StoragePort) {}
  state(projectId: string): StructureState | undefined {
    return this.storage.get("settings", `structure:state:${projectId}`);
  }
  saveState(state: StructureState): void {
    this.storage.put("settings", `structure:state:${state.projectId}`, state);
  }
  noOp(
    projectId: string,
    mutationId: string,
  ): StructureNoOpReceipt | undefined {
    return this.storage.get(
      "settings",
      `structure:no-op:${projectId}:${mutationId}`,
    );
  }
  saveNoOp(receipt: StructureNoOpReceipt): void {
    this.storage.put(
      "settings",
      `structure:no-op:${receipt.projectId}:${receipt.mutationId}`,
      receipt,
    );
  }
  intent(projectId: string): StructureIntent | undefined {
    return this.storage.get("settings", `structure:intent:${projectId}`);
  }
  saveIntent(intent: StructureIntent): void {
    this.storage.put(
      "settings",
      `structure:intent:${intent.projectId}`,
      intent,
    );
  }
  intents(): StructureIntent[] {
    return this.storage
      .list<unknown>("settings")
      .filter(
        (record): record is StructureIntent =>
          record !== null &&
          typeof record === "object" &&
          (record as StructureIntent).recordType === "structure_intent" &&
          (record as StructureIntent).pending === true,
      );
  }
  audit(
    projectId: string,
    mutationId: string,
  ): StoredStructureAudit | undefined {
    return this.storage.get(
      "settings",
      `structure:audit:${projectId}:${mutationId}`,
    );
  }
  saveAudit(audit: StructureAudit, requestDigest?: string): void {
    this.storage.put(
      "settings",
      `structure:audit:${audit.projectId}:${audit.id}`,
      {
        ...audit,
        recordType: "structure_audit",
        ...(requestDigest === undefined ? {} : { requestDigest }),
      },
    );
  }
  audits(projectId: string): StructureAudit[] {
    return this.storage
      .list<unknown>("settings")
      .filter(
        (record): record is StoredStructureAudit =>
          record !== null &&
          typeof record === "object" &&
          (record as StoredStructureAudit).recordType === "structure_audit" &&
          (record as StoredStructureAudit).projectId === projectId,
      )
      .map(
        ({
          recordType: _recordType,
          requestDigest: _requestDigest,
          ...audit
        }) => audit,
      )
      .sort(
        (a, b) =>
          b.validatedAt.localeCompare(a.validatedAt) ||
          b.id.localeCompare(a.id),
      );
  }
  invalidate(projectId: string): { id: string; revision: number }[] {
    const affected: { id: string; revision: number }[] = [],
      updatedAt = new Date().toISOString();
    for (const plan of this.storage.list<Plan>("plans")) {
      if (plan.projectId !== projectId) continue;
      const revision = plan.revision + 1;
      this.storage.put("plans", plan.id, {
        ...plan,
        revision,
        status: "draft",
        updatedAt,
      });
      affected.push({ id: plan.id, revision });
    }
    return affected;
  }
}
