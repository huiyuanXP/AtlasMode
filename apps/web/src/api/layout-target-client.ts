import { LAYOUT_LIMITS, type LayoutTargetResult } from "@codemap/core";
import { ApiError } from "./client.js";
import { validateLayoutTarget } from "./layout-target.js";

/** Read-only transport boundary. The caller separately checks the summary hash
 * before applying this snapshot-bound target. Never use response.json/text:
 * all response bodies, including errors, have the same actual UTF8 byte cap. */
export async function requestLayoutTarget(
  transport: typeof fetch,
  projectId: string,
  expectedSnapshotId: string,
  signal?: AbortSignal,
): Promise<LayoutTargetResult> {
  signal?.throwIfAborted();
  const abort = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let finished = false;
  let cancellation: Promise<void> | undefined;
  const cancelReader = () => {
    if (reader && !finished && !cancellation)
      cancellation = reader.cancel().catch(() => {
        /* Preserve the original failure. */
      });
    return cancellation;
  };
  const onAbort = () => {
    abort.abort(signal?.reason);
    void cancelReader();
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await transport(
      `/api/projects/${encodeURIComponent(projectId)}/layout-target`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSnapshotId }),
        signal: abort.signal,
      },
    );
    abort.signal.throwIfAborted();
    if (!response.body)
      throw new ApiError(
        "INVALID_LAYOUT_TARGET",
        "Missing layout response body",
        response.status,
      );
    reader = response.body.getReader();
    // Fixed storage also bounds allocations for transports returning tiny chunks.
    const body = new Uint8Array(LAYOUT_LIMITS.bytes);
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      abort.signal.throwIfAborted();
      if (chunk.done) {
        finished = true;
        break;
      }
      if (!(chunk.value instanceof Uint8Array))
        throw new ApiError(
          "INVALID_LAYOUT_TARGET",
          "Invalid layout response bytes",
          response.status,
        );
      if (chunk.value.byteLength > LAYOUT_LIMITS.bytes - bytes) {
        abort.abort();
        throw new ApiError(
          "LAYOUT_RESPONSE_TOO_LARGE",
          "Layout response exceeds the 8MiB byte limit",
          response.status,
        );
      }
      // Copy only accepted bytes: transports may reuse their chunk buffer.
      body.set(chunk.value, bytes);
      bytes += chunk.value.byteLength;
    }
    let value: unknown;
    try {
      value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          body.subarray(0, bytes),
        ),
      );
    } catch {
      throw new ApiError(
        "INVALID_LAYOUT_TARGET",
        "Invalid layout response JSON",
        response.status,
      );
    }
    if (!response.ok) {
      const error = value as { code?: unknown; message?: unknown } | null;
      throw new ApiError(
        typeof error?.code === "string" ? error.code : "HTTP_ERROR",
        typeof error?.message === "string"
          ? error.message
          : "Layout request failed",
        response.status,
      );
    }
    try {
      const hash = (value as { contentHash?: unknown } | null)?.contentHash;
      if (typeof hash !== "string") throw new Error("Missing content hash");
      return validateLayoutTarget(value, {
        projectId,
        snapshotId: expectedSnapshotId,
        contentHash: hash,
      });
    } catch {
      throw new ApiError(
        "INVALID_LAYOUT_TARGET",
        "Invalid or stale complete layout target",
        response.status,
      );
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (!finished) {
      abort.abort();
      // A hostile/failed transport cancellation must not hold caller abort open.
      void cancelReader();
    }
    reader?.releaseLock();
  }
}
