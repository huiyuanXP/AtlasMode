/** HTTP transport types; the web does not import the server implementation. */
export type ChatChannel = "explore" | "plan";
export interface ChatContext {
  planId?: string;
  nodeId?: string;
  scope?: {
    kind: "folder" | "file" | "function";
    path: string;
    nodeId?: string;
  };
  snapshotId?: string;
  expectedRevision?: number;
}
export interface ChatInput extends ChatContext {
  channel: ChatChannel;
  message: string;
}
export interface AgentStatus {
  provider: "codex" | "claude" | "responses" | null;
  configured: boolean;
  available: boolean;
  reason?: string;
  profile?: string;
  model?: string;
  modelProvider?: string;
  authentication?: "api-environment" | "openai-account" | "none";
}
export interface ChatRun {
  runId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  messages: { role: "assistant"; text: string }[];
  activity: { tool: string; status: "running" | "completed" | "failed" }[];
  errors: { code: string; message: string }[];
  changedPlanIds: string[];
  mayHaveSavedChanges: boolean;
}
export interface ChatTransport {
  status(): Promise<AgentStatus>;
  start(projectId: string, input: ChatInput): Promise<ChatRun>;
  poll(projectId: string, runId: string): Promise<ChatRun>;
  cancel(projectId: string, runId: string): Promise<ChatRun>;
}
