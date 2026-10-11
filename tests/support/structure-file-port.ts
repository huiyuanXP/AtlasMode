import { createHash } from "node:crypto";
import type {
  StructureFilePort,
  StructureFileRead,
  StructurePublishResult,
} from "@codemap/core";
import { randomUUID } from "node:crypto";
import type { WorkspaceService } from "@codemap/service";

// Fixture callers explicitly read their owned project's CAS before each write.
export async function policyWrite(
  service: WorkspaceService,
  input: Parameters<WorkspaceService["savePolicy"]>[0],
) {
  const state = await service.getStructure(input.projectId);
  return service.savePolicy({
    ...input,
    mutationId: randomUUID(),
    expectedStructureRevision: state.structureRevision,
    expectedFileDigest: state.fileDigest,
  });
}

// Owned port double for existing pure scheduling fixtures. Real I/O has dedicated tests.
export class MemoryStructureFiles implements StructureFilePort {
  readonly documents = new Map<string, Uint8Array>();
  async read(root: string): Promise<StructureFileRead> {
    const bytes = this.documents.get(root);
    return {
      bytes: bytes ? Uint8Array.from(bytes) : null,
      digest: bytes ? createHash("sha256").update(bytes).digest("hex") : null,
      verifiedAt: new Date().toISOString(),
      diagnostics: [],
    };
  }
  async publish(
    root: string,
    input: {
      mutationId: string;
      expectedDigest: string | null;
      bytes: Uint8Array;
    },
  ): Promise<StructurePublishResult> {
    const before = await this.read(root);
    if (before.digest !== input.expectedDigest)
      return {
        phase: "not_published",
        actualDigest: before.digest,
        errorCode: "STRUCTURE_CONFLICT",
      };
    this.documents.set(root, Uint8Array.from(input.bytes));
    return { phase: "published", actualDigest: (await this.read(root)).digest };
  }
}
