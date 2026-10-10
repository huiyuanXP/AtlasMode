import type { AgentEvent, RunningAgent } from "./process.js";
export type ChatChannel = "explore" | "plan";
export interface ChatInput {
  channel: ChatChannel;
  message: string;
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
export interface AgentContext {
  projectId: string;
  input: ChatInput;
  prompt: string;
  apiUrl: string;
  tools: readonly string[];
}
export interface AgentRunner {
  status(): Promise<AgentStatus>;
  start(
    context: AgentContext,
    emit: (event: AgentEvent) => void,
  ): Promise<RunningAgent>;
}
/** Trusted server-construction injection only; HTTP clients cannot choose a runner. */
export type AgentRunnerFactory = () => AgentRunner;
