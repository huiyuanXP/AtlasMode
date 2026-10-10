import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourceIndexer } from "@codemap/indexer";
import { SqliteStorage } from "@codemap/storage";
import { WorkspaceService } from "@codemap/service";
import { createServer } from "./server.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
it("accepts old views and bounded collapse IDs over HTTP, rejects malformed arrays and filters foreign groups", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-grp02-http-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const storage = new SqliteStorage(join(root, "state.sqlite"));
  cleanups.push(async () => storage.close());
  const service = new WorkspaceService({
    storage,
    indexer: new SourceIndexer(),
  });
  const app = await createServer({ service });
  cleanups.push(() => app.close());
  const projects = [];
  for (const name of ["a", "b"]) {
    const path = join(root, name);
    await mkdir(path);
    await writeFile(
      join(path, "entry.ts"),
      "export function entry(){return 1;}",
    );
    const response = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { path },
    });
    expect(response.statusCode).toBe(200);
    projects.push(response.json());
  }
  const groups = [];
  for (const project of projects) {
    const snapshot = service.getSnapshot(project.id);
    const response = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/groups`,
      payload: {
        title: "G",
        description: "",
        source: "user",
        memberIds: [snapshot.nodes.find((n) => n.kind === "function")!.id],
      },
    });
    expect(response.statusCode).toBe(200);
    groups.push(response.json());
  }
  const url = `/api/projects/${projects[0].id}/view`,
    old = { positions: {}, theme: "dark", locale: "en" };
  expect(
    (await app.inject({ method: "PUT", url, payload: old })).json(),
  ).toEqual(old);
  const bounded = {
    ...old,
    collapsedGroupIds: [groups[0].id, groups[1].id, "unknown", groups[0].id],
  };
  const response = await app.inject({ method: "PUT", url, payload: bounded });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    ...old,
    collapsedGroupIds: [groups[0].id],
  });
  for (const ids of [
    Array(201).fill(groups[0].id),
    ["x".repeat(201)],
    [""],
    [1],
    "bad",
  ]) {
    expect(
      (
        await app.inject({
          method: "PUT",
          url,
          payload: { ...old, collapsedGroupIds: ids },
        })
      ).statusCode,
    ).toBe(400);
  }
  expect((await app.inject({ method: "GET", url })).json()).toEqual({
    ...old,
    collapsedGroupIds: [groups[0].id],
  });
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/api/projects/${projects[1].id}/view`,
      })
    ).json().collapsedGroupIds,
  ).toBeUndefined();
});
