import type { CodeNode } from "@codemap/core";
import { ApiError } from "../../api/client.js";
export class SnapshotChangedError extends Error {}
export type MemberBinding = { id: string } & (
  | { status: "bound"; node: CodeNode }
  | { status: "missing" }
  | { status: "error"; message: string; messageKey?: "snapshotChanged" }
);
/** Read only the visible page with bounded concurrency. Missing != transport failure. */
export async function readMembers(
  ids: string[],
  offset: number,
  snapshotId: string,
  read: (id: string) => Promise<{ node: CodeNode; snapshotId: string }>,
): Promise<MemberBinding[]> {
  const page = ids.slice(offset, offset + 20),
    results: MemberBinding[] = new Array(page.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, page.length) }, async () => {
      while (next < page.length) {
        const index = next++,
          id = page[index]!;
        try {
          const result = await read(id);
          results[index] =
            result.snapshotId === snapshotId
              ? { id, status: "bound", node: result.node }
              : {
                  id,
                  status: "error",
                  message: "",
                  messageKey: "snapshotChanged",
                };
        } catch (error) {
          results[index] =
            error instanceof ApiError &&
            error.status === 404 &&
            error.code === "NOT_FOUND"
              ? { id, status: "missing" }
              : {
                  id,
                  status: "error",
                  message:
                    error instanceof Error ? error.message : String(error),
                };
        }
      }
    }),
  );
  return results;
}
