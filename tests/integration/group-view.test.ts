import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodeSnapshot, IndexerPort, ViewState } from "@codemap/core";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
const snapshot = (id: string) =>
  ({
    id: `s-${id}`,
    projectId: id,
    nodes: [],
    relations: [],
    coverage: { files: [], excludedPatterns: [], unresolvedCount: 0 },
  }) as unknown as CodeSnapshot;
const indexer: IndexerPort = {
  index: async () => {
    throw new Error("Fresh storage read does not index source");
  },
};
const oldView: ViewState = {
  positions: { "fact:a": { x: 10, y: 20 } },
  theme: "dark",
  locale: "en",
};
it("restores collapse and visual layout from a fresh SQLite instance", () => {
  const root = mkdtempSync(join(tmpdir(), "atlas-grp02-view-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "state.sqlite");
  let storage = new SqliteStorage(path);
  storage.put("projects", "p", {
    id: "p",
    path: root,
    name: "p",
    snapshotId: "s-p",
  });
  storage.put("snapshots", "s-p", snapshot("p"));
  storage.put("groups", "g1", { id: "g1", projectId: "p", memberIds: [] });
  new WorkspaceService({ storage, indexer }).saveView("p", {
    ...oldView,
    collapsedGroupIds: ["g1"],
  });
  storage.close();
  storage = new SqliteStorage(path);
  cleanups.push(() => storage.close());
  expect(new WorkspaceService({ storage, indexer }).getView("p")).toEqual({
    ...oldView,
    collapsedGroupIds: ["g1"],
  });
});
