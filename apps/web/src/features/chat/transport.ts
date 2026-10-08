import { ApiError } from "../../api/client.js";
import type {
  AgentStatus,
  ChatInput,
  ChatRun,
  ChatTransport,
} from "./types.js";
export class ChatApi implements ChatTransport {
  constructor(private readonly transport: typeof fetch = fetch) {}
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const transport = this.transport;
    const response = await transport(
      `/api${path}`,
      body === undefined
        ? { method: "GET" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    if (!response.ok) {
      const error = (await response.json()) as {
        code?: string;
        message?: string;
      };
      throw new ApiError(
        error.code ?? "CHAT_CONNECTION_ERROR",
        error.message ?? `HTTP ${response.status}`,
        response.status,
      );
    }
    return response.json() as Promise<T>;
  }
  status = () => this.request<AgentStatus>("/agent/status");
  start = (id: string, input: ChatInput) =>
    this.request<ChatRun>(`/projects/${encodeURIComponent(id)}/chat`, input);
  poll = (id: string, runId: string) =>
    this.request<ChatRun>(
      `/projects/${encodeURIComponent(id)}/chat/${encodeURIComponent(runId)}`,
    );
  cancel = (id: string, runId: string) =>
    this.request<ChatRun>(
      `/projects/${encodeURIComponent(id)}/chat/${encodeURIComponent(runId)}/cancel`,
      {},
    );
}
