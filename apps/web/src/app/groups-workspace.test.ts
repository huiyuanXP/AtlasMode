import { expect, it, vi } from "vitest";
import type { FunctionGroup, PlanDetail } from "@codemap/core";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
const node = (id: string) => ({
  id,
  kind: "function" as const,
  name: id,
  filePath: `${id}.ts`,
});
const group: FunctionGroup = {
  id: "g",
  projectId: "p",
  title: "original",
  description: "note",
  source: "agent",
  memberIds: Array.from({ length: 25 }, (_, i) => `f${i}`),
};
const project = { id: "p", name: "p", path: "/p" };
it("edits all 25 IDs independent of bindings; circle union, removal and cancel preserve saved group", () => {
  const app = createWorkspace();
  app.store.setState({
    project,
    groups: [group],
    memberPage: {
      groupId: "g",
      offset: 0,
      bindings: [{ id: "f0", status: "bound", node: node("f0") }],
    },
  });
  app.editGroup(group);
  expect(app.store.getState().groupDraft).toEqual({
    id: "g",
    title: "original",
    description: "note",
    source: "agent",
    memberIds: group.memberIds,
  });
  app.setGroupSelection([node("f0"), node("new"), node("new")]);
  app.addGroupSelection();
  app.removeGroupMember("f24");
  expect(app.store.getState().groupDraft?.memberIds).toHaveLength(25);
  expect(app.store.getState().groupDraft?.memberIds).toContain("f23");
  expect(app.store.getState().groupDraft?.memberIds).not.toContain("f24");
  expect(
    app.store.getState().groupDraft?.memberIds.filter((id) => id === "new"),
  ).toHaveLength(1);
  app.cancelGroupDraft();
  expect(app.store.getState().groupDraft).toBeUndefined();
  expect(app.store.getState().groupSelection).toEqual([]);
  expect(app.store.getState().groups[0]).toEqual(group);
});
it("clears draft, selection and mode immediately on project switch", async () => {
  const app = createWorkspace(
    new HttpApi(
      (async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith("/summary")
              ? { snapshotId: "s", entrypoints: [] }
              : [],
          ),
        )) as typeof fetch,
    ),
  );
  app.store.setState({ project, groups: [group] });
  app.editGroup(group);
  app.setGroupSelection([node("f1")]);
  app.setGroupSelectionMode(true);
  await app.selectProject({ id: "other", name: "other", path: "/other" });
  expect(app.store.getState()).toMatchObject({
    groupDraft: undefined,
    groupSelection: [],
    groupSelectionMode: false,
    groupEditorOpen: false,
  });
});
it("forwards edit ID, keeps one group, refreshes bindings and adopts server approval invalidation", async () => {
  let saved = group,
    submitted: unknown;
  let currentPlan = {
    plan: { id: "plan", projectId: "p", revision: 1, operations: [] },
    valid: true,
    issues: [],
  } as unknown as PlanDetail;
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    let result: unknown = [];
    if (path.endsWith("/groups")) {
      if (init?.method === "POST") {
        submitted = JSON.parse(String(init.body));
        saved = { ...group, ...(submitted as object) };
        currentPlan = {
          ...currentPlan,
          valid: false,
          plan: { ...currentPlan.plan, revision: 2 },
        };
      }
      result = init?.method === "POST" ? saved : [saved];
    }
    if (path.endsWith("/plans")) result = [currentPlan];
    if (path.endsWith("/summary")) result = { snapshotId: "s" };
    if (path.includes("/functions/"))
      result = {
        snapshotId: "s",
        node: node(
          decodeURIComponent(path.split("/functions/")[1]!.split("?")[0]!),
        ),
      };
    return new Response(JSON.stringify(result));
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project,
    groups: [group],
    summary: { snapshotId: "s" } as never,
    plan: currentPlan,
    plans: [currentPlan],
    memberPage: { groupId: "g", offset: 20, bindings: [] },
  });
  await app.saveGroup({
    id: "g",
    title: "edited",
    description: "changed",
    source: "agent",
    memberIds: ["f23", "f24"],
  });
  expect(submitted).toMatchObject({ id: "g", source: "agent" });
  expect(app.store.getState().groups).toHaveLength(1);
  expect(app.store.getState().groups[0]?.title).toBe("edited");
  expect(app.store.getState().plan?.valid).toBe(false);
  expect(app.store.getState().memberPage).toMatchObject({
    groupId: "g",
    offset: 0,
    bindings: [
      { id: "f23", status: "bound" },
      { id: "f24", status: "bound" },
    ],
  });
});
it("late group save does not override a newly selected member page", async () => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    if (init?.method === "POST") await delayed;
    return new Response(
      JSON.stringify(
        path.endsWith("/groups") ? [group, { ...group, id: "other" }] : [],
      ),
    );
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project,
    groups: [group],
    summary: { snapshotId: "s" } as never,
    memberPage: { groupId: "g", offset: 0, bindings: [] },
  });
  const pending = app.saveGroup({ ...group, title: "edited" });
  app.store.setState({
    memberPage: { groupId: "other", offset: 0, bindings: [] },
  });
  release();
  await pending;
  expect(app.store.getState().memberPage?.groupId).toBe("other");
});

it("refreshes removed members when the pre-save binding read completes during save", async () => {
  let releaseRead!: () => void, releaseSave!: () => void;
  const reading = new Promise<void>((r) => {
      releaseRead = r;
    }),
    saving = new Promise<void>((r) => {
      releaseSave = r;
    });
  let saved = { ...group, memberIds: ["f23", "f24"] };
  const api = new HttpApi((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const path = String(input);
    let value: unknown = [];
    if (path.includes("/functions/")) {
      await reading;
      value = {
        snapshotId: "s",
        node: node(
          decodeURIComponent(path.split("/functions/")[1]!.split("?")[0]!),
        ),
      };
    }
    if (path.endsWith("/summary")) value = { snapshotId: "s" };
    if (path.endsWith("/groups")) {
      if (init?.method === "POST") {
        await saving;
        saved = { ...saved, ...JSON.parse(String(init.body)) };
        value = saved;
      } else value = [saved];
    }
    return new Response(JSON.stringify(value));
  }) as typeof fetch);
  const app = createWorkspace(api);
  app.store.setState({
    project,
    groups: [saved],
    summary: { snapshotId: "s" } as never,
  });
  app.editGroup(saved);
  app.removeGroupMember("f24");
  const pending = app.saveGroup(app.store.getState().groupDraft!);
  releaseRead();
  await vi.waitFor(() =>
    expect(app.store.getState().memberPage?.bindings).toHaveLength(2),
  );
  releaseSave();
  await pending;
  expect(app.store.getState().memberPage?.bindings.map((b) => b.id)).toEqual([
    "f23",
  ]);
});
