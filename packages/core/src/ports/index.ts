import type { CodeSnapshot } from '../graph/code-snapshot.js';
export interface IndexerPort {
  scan(): Promise<CodeSnapshot>;
  fingerprint(): Promise<string>;
}
export type EntityKind =
  | 'annotation'
  | 'group'
  | 'policy'
  | 'view'
  | 'plan'
  | 'verification'
  | 'identity';
export interface StoredRecord {
  id: string;
  revision: number;
  [key: string]: unknown;
}
export interface Mutation {
  kind: EntityKind;
  record: StoredRecord;
  expectedRevision: number | null;
}
export interface StoragePort {
  saveSnapshot(snapshot: CodeSnapshot): void;
  getSnapshot(id?: string): CodeSnapshot | null;
  listSnapshots(
    offset: number,
    limit: number,
  ): { id: string; createdAt: string; baselineDigest: string }[];
  get(kind: EntityKind, id: string): unknown | null;
  list(kind: EntityKind, offset?: number, limit?: number): unknown[];
  save(
    kind: EntityKind,
    record: StoredRecord,
    expectedRevision: number | null,
  ): void;
  commit(mutations: Mutation[]): void;
  delete(kind: EntityKind, id: string, expectedRevision: number): void;
  history(planId: string, offset?: number, limit?: number): unknown[];
  backup(): Promise<string>;
  close(): void;
}
export interface KnowledgeFilePort {
  writePolicies(value: unknown): Promise<void>;
  writeKnowledge(value: unknown): Promise<void>;
}
