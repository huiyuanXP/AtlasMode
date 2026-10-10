/** Fixed codes only: raw provider errors never escape the server-side boundary. */
export class ApiRunError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export type ResponseItem = Record<string, unknown> & { type: string };
export interface ByteBudget {
  remaining: number;
}
const protocol = () => new ApiRunError("AGENT_PROTOCOL");

/** SSE framing is independent of TCP chunks; only public output_text is emitted. */
export async function readResponse(
  response: Response,
  signal: AbortSignal,
  budget: ByteBudget,
  emit: (text: string, key: string, first: boolean) => void,
): Promise<ResponseItem[]> {
  if (
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("text/event-stream") ||
    !response.body
  )
    throw protocol();
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "",
    data: string[] = [],
    skipLf = false;
  const texts = new Map<string, string>();
  let result: ResponseItem[] | undefined;
  function publish(text: string, key: string) {
    if (!text) return;
    const first = !texts.has(key);
    texts.set(key, (texts.get(key) ?? "") + text);
    emit(text, key, first);
  }
  function dispatch() {
    if (!data.length) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data.join("\n"));
    } catch {
      throw protocol();
    }
    data = [];
    if (!event || typeof event !== "object" || typeof event.type !== "string")
      throw protocol();
    if (event.type === "error" || event.type === "response.failed")
      throw new ApiRunError("AGENT_FAILED");
    if (event.type === "response.incomplete") throw protocol();
    if (event.type === "response.output_text.delta") {
      if (
        typeof event.delta !== "string" ||
        !Number.isInteger(event.output_index) ||
        !Number.isInteger(event.content_index) ||
        Number(event.output_index) < 0 ||
        Number(event.content_index) < 0
      )
        throw protocol();
      publish(event.delta, `${event.output_index}:${event.content_index}`);
    }
    if (event.type === "response.completed") {
      const value = event.response as Record<string, unknown> | undefined;
      if (
        !value ||
        value.status !== "completed" ||
        !Array.isArray(value.output)
      )
        throw protocol();
      result = value.output.map((item: unknown) => {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          typeof (item as ResponseItem).type !== "string"
        )
          throw protocol();
        return item as ResponseItem;
      });
      const matched = new Set<string>();
      result.forEach((item, outputIndex) => {
        if (item.type !== "message") return;
        if (item.role !== "assistant" || !Array.isArray(item.content))
          throw protocol();
        item.content.forEach((content: unknown, contentIndex: number) => {
          const value = content as Record<string, unknown> | undefined;
          if (!value || typeof value.type !== "string") throw protocol();
          if (value.type !== "output_text" && value.type !== "refusal")
            throw protocol();
          const text =
            value.type === "output_text" ? value.text : value.refusal;
          if (typeof text !== "string") throw protocol();
          const key = `${outputIndex}:${contentIndex}`;
          matched.add(key);
          if (texts.has(key)) {
            if (texts.get(key) !== text) throw protocol();
          } else publish(text, key);
        });
      });
      if ([...texts.keys()].some((key) => !matched.has(key))) throw protocol();
    }
  }
  try {
    while (!result) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) {
        buffer += decoder.decode();
        // A terminal event must have its SSE empty-line delimiter.
        throw protocol();
      }
      budget.remaining -= chunk.value.byteLength;
      if (budget.remaining < 0) throw new ApiRunError("AGENT_OUTPUT_LIMIT");
      let decoded = decoder.decode(chunk.value, { stream: true });
      if (decoded) {
        // A CR terminates a line immediately; consume its optional LF even across TCP chunks.
        if (skipLf && decoded.startsWith("\n")) decoded = decoded.slice(1);
        skipLf = decoded.endsWith("\r");
        buffer += decoded.replace(/\r\n?/g, "\n");
      }
      let newline: number;
      while (!result && (newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (line === "") dispatch();
        else if (line.startsWith("data:"))
          data.push(line.slice(5).replace(/^ /, ""));
        else if (!line.startsWith(":") && !/^(event|id|retry):/.test(line))
          throw protocol();
      }
    }
    return result;
  } catch (error) {
    if (signal.aborted || error instanceof ApiRunError) throw error;
    throw protocol();
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
