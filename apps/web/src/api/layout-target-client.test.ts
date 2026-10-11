import { afterEach, expect, test, vi } from "vitest";
import { createServer } from "node:http";
import {
  getLayoutTarget,
  LAYOUT_LIMITS,
  type CodeSnapshot,
} from "@codemap/core";
import { requestLayoutTarget } from "./layout-target-client.js";
import { ApiError } from "./client.js";
afterEach(() => vi.restoreAllMocks());
function value() {
  const s: CodeSnapshot = {
    id: "s",
    projectId: "p /界",
    contentHash: "hash",
    createdAt: "now",
    gitRevision: null,
    nodes: [{ id: "n界😀", kind: "external", name: "secret" }],
    relations: [],
    diagnostics: [],
    coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
  };
  return getLayoutTarget(s, "s");
}
function transport(response: Response) {
  return vi.fn<typeof fetch>(async function (this: void) {
    expect(this).toBeUndefined();
    return response;
  });
}
test("standalone fetch receives exact encoded readonly endpoint/body and strict complete result", async () => {
  const v = value(),
    fetcher = transport(new Response(JSON.stringify(v)));
  expect(await requestLayoutTarget(fetcher, "p /界", "s")).toEqual(v);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/projects/p%20%2F%E7%95%8C/layout-target",
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedSnapshotId: "s" }),
      signal: expect.any(AbortSignal),
    }),
  );
});
test("exact 8MiB actual streamed UTF8 bytes accepted before JSON.parse despite absent or lying Content-Length", async () => {
  const text = JSON.stringify(value()),
    encoded = new TextEncoder().encode(text),
    bytes = new Uint8Array(LAYOUT_LIMITS.bytes);
  bytes.set(encoded);
  bytes.fill(32, encoded.length);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 65537)
        c.enqueue(bytes.slice(i, i + 65537));
      c.close();
    },
  });
  const response = new Response(stream, { headers: { "Content-Length": "1" } }),
    json = vi.spyOn(response, "json"),
    txt = vi.spyOn(response, "text");
  expect(await requestLayoutTarget(transport(response), "p /界", "s")).toEqual(
    value(),
  );
  expect(json).not.toHaveBeenCalled();
  expect(txt).not.toHaveBeenCalled();
  expect(stream.locked).toBe(false);
});
test.each([200, 500])(
  "cap+1 response %i cancels/aborts before parse on success and error paths",
  async (status) => {
    const cancel = vi.fn();
    let signal: AbortSignal | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(LAYOUT_LIMITS.bytes));
        c.enqueue(new Uint8Array(1));
      },
      cancel,
    });
    const response = new Response(stream, {
      status,
      headers: { "Content-Length": "1" },
    });
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      signal = init?.signal ?? undefined;
      return response;
    });
    const parse = vi.spyOn(JSON, "parse");
    const calls = parse.mock.calls.length;
    await expect(
      requestLayoutTarget(fetcher, "p /界", "s"),
    ).rejects.toMatchObject({ code: "LAYOUT_RESPONSE_TOO_LARGE" });
    expect(parse.mock.calls.length).toBe(calls);
    expect(cancel).toHaveBeenCalledOnce();
    expect(signal?.aborted).toBe(true);
    expect(stream.locked).toBe(false);
  },
);
test("single oversize chunk is rejected without JSON parse or retaining a partial result", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(LAYOUT_LIMITS.bytes + 1));
    },
  });
  await expect(
    requestLayoutTarget(transport(new Response(stream)), "p /界", "s"),
  ).rejects.toMatchObject({ code: "LAYOUT_RESPONSE_TOO_LARGE" });
  expect(stream.locked).toBe(false);
});
test.each(["foreign", "stale", "extra", "malformed"])(
  "response %s fails strict validator after bounded parse",
  async (which) => {
    const v = value();
    let text = JSON.stringify(v);
    if (which === "foreign")
      text = JSON.stringify({ ...v, projectId: "other" });
    if (which === "stale") text = JSON.stringify({ ...v, snapshotId: "old" });
    if (which === "extra") text = JSON.stringify({ ...v, source: "secret" });
    if (which === "malformed") text = "{";
    await expect(
      requestLayoutTarget(transport(new Response(text)), "p /界", "s"),
    ).rejects.toMatchObject({ code: "INVALID_LAYOUT_TARGET" });
  },
);
test("bounded domain HTTP errors preserve existing ApiError status/code", async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          code: "SNAPSHOT_CHANGED",
          message: "snapshot changed",
        }),
        { status: 409 },
      ),
  );
  await expect(
    requestLayoutTarget(fetcher, "p /界", "s"),
  ).rejects.toBeInstanceOf(ApiError);
  await expect(
    requestLayoutTarget(fetcher, "p /界", "s"),
  ).rejects.toMatchObject({ code: "SNAPSHOT_CHANGED", status: 409 });
});
test("pre-aborted caller does not issue a request", async () => {
  const abort = new AbortController();
  abort.abort();
  const fetcher = transport(new Response("{}"));
  await expect(
    requestLayoutTarget(fetcher, "p /界", "s", abort.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
});
test("abort of pending stream settles promptly, cancels reader, releases lock and removes caller listener", async () => {
  const abort = new AbortController(),
    remove = vi.spyOn(abort.signal, "removeEventListener"),
    cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel });
  let received: AbortSignal | undefined;
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    received = init?.signal ?? undefined;
    return new Response(stream);
  });
  const pending = requestLayoutTarget(fetcher, "p /界", "s", abort.signal);
  await vi.waitFor(() => expect(stream.locked).toBe(true));
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(received?.aborted).toBe(true);
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});
test("success cleans the caller abort listener and detached late abort cannot cancel completed body", async () => {
  const abort = new AbortController(),
    remove = vi.spyOn(abort.signal, "removeEventListener");
  let signal: AbortSignal | undefined;
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    signal = init?.signal ?? undefined;
    return new Response(JSON.stringify(value()));
  });
  await requestLayoutTarget(fetcher, "p /界", "s", abort.signal);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  abort.abort();
  expect(signal?.aborted).toBe(false);
});

test("reused byte chunks are copied immediately and invalid UTF8 fails closed", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(value())),
    one = new Uint8Array(1);
  let i = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        if (i === bytes.length) {
          c.close();
          return;
        }
        one[0] = bytes[i++]!;
        c.enqueue(one);
      },
    },
    { highWaterMark: 0 },
  );
  expect(
    await requestLayoutTarget(transport(new Response(stream)), "p /界", "s"),
  ).toEqual(value());
  await expect(
    requestLayoutTarget(
      transport(
        new Response(new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125])),
      ),
      "p /界",
      "s",
    ),
  ).rejects.toMatchObject({ code: "INVALID_LAYOUT_TARGET" });
});
test("network and body read failures remove listeners and release reader without parse", async () => {
  const abort = new AbortController(),
    remove = vi.spyOn(abort.signal, "removeEventListener");
  const failure = Error("network");
  await expect(
    requestLayoutTarget(
      vi.fn<typeof fetch>(async () => {
        throw failure;
      }),
      "p /界",
      "s",
      abort.signal,
    ),
  ).rejects.toBe(failure);
  expect(remove).toHaveBeenCalled();
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      c.error(failure);
    },
  });
  await expect(
    requestLayoutTarget(
      transport(new Response(stream)),
      "p /界",
      "s",
      abort.signal,
    ),
  ).rejects.toBe(failure);
  expect(stream.locked).toBe(false);
});
test("missing body rejects and a falsely oversized Content-Length cannot replace actual counting", async () => {
  await expect(
    requestLayoutTarget(transport(new Response(null)), "p /界", "s"),
  ).rejects.toMatchObject({ code: "INVALID_LAYOUT_TARGET" });
  expect(
    await requestLayoutTarget(
      transport(
        new Response(JSON.stringify(value()), {
          headers: { "Content-Length": String(LAYOUT_LIMITS.bytes + 1) },
        }),
      ),
      "p /界",
      "s",
    ),
  ).toEqual(value());
});

test("caller abort settles even if transport cancellation never resolves", async () => {
  const abort = new AbortController();
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const stream = new ReadableStream<Uint8Array>({ cancel });
  let settled = false;
  const pending = requestLayoutTarget(
    transport(new Response(stream)),
    "p /界",
    "s",
    abort.signal,
  ).catch((error) => {
    settled = true;
    return error as Error;
  });
  await vi.waitFor(() => expect(stream.locked).toBe(true));
  abort.abort();
  await vi.waitFor(() => expect(settled).toBe(true), {
    timeout: 100,
    interval: 10,
  });
  expect(await pending).toMatchObject({ name: "AbortError" });
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});

test("native HTTP chunked body enforces actual cap before parse with the real fetch reader", async () => {
  const text = JSON.stringify(value());
  const prefix = Buffer.from(text);
  const exact = Buffer.alloc(LAYOUT_LIMITS.bytes, 32);
  prefix.copy(exact);
  let over = false;
  const requests: {
    path: string | undefined;
    method: string | undefined;
    body: string;
  }[] = [];
  const app = createServer(async (request, response) => {
    const body: Buffer[] = [];
    for await (const chunk of request) body.push(chunk as Buffer);
    requests.push({
      path: request.url,
      method: request.method,
      body: Buffer.concat(body).toString(),
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    for (let i = 0; i < exact.length; i += 65537)
      response.write(exact.subarray(i, i + 65537));
    response.end(over ? " " : undefined);
  });
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  const address = app.address();
  if (!address || typeof address === "string")
    throw Error("Missing HTTP address");
  const fetcher: typeof fetch = (path, init) =>
    fetch(new URL(String(path), `http://127.0.0.1:${address.port}`), init);
  try {
    expect(await requestLayoutTarget(fetcher, "p /界", "s")).toEqual(value());
    over = true;
    await expect(
      requestLayoutTarget(fetcher, "p /界", "s"),
    ).rejects.toMatchObject({ code: "LAYOUT_RESPONSE_TOO_LARGE" });
    expect(requests).toEqual(
      Array.from({ length: 2 }, () => ({
        path: "/api/projects/p%20%2F%E7%95%8C/layout-target",
        method: "POST",
        body: JSON.stringify({ expectedSnapshotId: "s" }),
      })),
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      app.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
