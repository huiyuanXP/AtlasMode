export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly issues?: unknown,
    readonly recovery?: { createdPlanId: string; createdRevision: number },
  ) {
    super(message);
  }
}

/** The bridge owns no workspace state: all reads and writes go to one HTTP service. */
export class ApiClient {
  private readonly base: string;
  private readonly lifecycle = new AbortController();
  constructor(apiUrl: string) {
    const url = new URL(apiUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error(
        "CODEMAP_API_URL must be an HTTP(S) service origin without credentials or a path.",
      );
    this.base = url.origin;
  }

  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const signal = AbortSignal.any([
      AbortSignal.timeout(30000),
      this.lifecycle.signal,
    ]);
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal,
      });
    } catch (error) {
      const timeout = error instanceof Error && error.name === "TimeoutError";
      throw new ApiError(
        timeout ? "API_TIMEOUT" : "API_UNAVAILABLE",
        timeout
          ? "AtlasMode HTTP service timed out. Check the service and retry."
          : "Cannot reach AtlasMode HTTP service. Start it and check CODEMAP_API_URL.",
      );
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      if (signal.aborted)
        throw new ApiError(
          signal.reason?.name === "TimeoutError"
            ? "API_TIMEOUT"
            : "API_UNAVAILABLE",
          signal.reason?.name === "TimeoutError"
            ? "AtlasMode HTTP service timed out. Check the service and retry."
            : "AtlasMode HTTP request was cancelled.",
          response.status,
        );
      throw new ApiError(
        "API_INVALID_RESPONSE",
        "AtlasMode HTTP service returned an invalid JSON response.",
        response.status,
      );
    }
    if (!response.ok) {
      const error = value as {
        code?: unknown;
        message?: unknown;
        issues?: unknown;
      } | null;
      throw new ApiError(
        typeof error?.code === "string" ? error.code : "API_ERROR",
        typeof error?.message === "string"
          ? error.message
          : "AtlasMode HTTP request failed.",
        response.status,
        error?.issues,
      );
    }
    return value as T;
  }

  close(): void {
    this.lifecycle.abort();
  }
}

export function errorValue(error: unknown): Record<string, unknown> {
  if (error instanceof ApiError)
    return {
      code: error.code,
      message: error.message,
      ...(error.status === undefined ? {} : { status: error.status }),
      ...(error.issues === undefined ? {} : { issues: error.issues }),
      ...error.recovery,
    };
  console.error("AtlasMode MCP encountered an unexpected tool failure.");
  return { code: "INTERNAL_ERROR", message: "Internal MCP bridge error." };
}
