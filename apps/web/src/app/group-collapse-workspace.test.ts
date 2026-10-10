import { expect, it, vi } from "vitest";
import { HttpApi } from "../api/client.js";
import { createWorkspace } from "./workspace.js";
it("toggles only current-project groups, deduplicates IDs and persists view without changing approval", async () => {
  vi.useFakeTimers();
  const writes: unknown[] = [];
  const app = createWorkspace(
    new HttpApi((async (input: unknown, init?: RequestInit) => {
      if (init?.method === "PUT") {
        writes.push(JSON.parse(String(init.body)));
        return new Response("{}");
      }
      return new Response(
        JSON.stringify(
          String(input).endsWith("/summary")
            ? { snapshotId: "s", entrypoints: [] }
            : String(input).endsWith("/view")
              ? { positions: {}, theme: "dark", locale: "en" }
              : [],
        ),
      );
    }) as typeof fetch),
  );
  await app.selectProject({ id: "p", name: "p", path: "/p" });
  const plan = { valid: true, plan: { id: "approved" } } as never;
  app.store.setState({
    project: { id: "p", name: "p", path: "/p" },
    groups: [
      {
        id: "g",
        projectId: "p",
        title: "G",
        description: "",
        source: "user",
        memberIds: ["f"],
      },
      {
        id: "foreign",
        projectId: "other",
        title: "F",
        description: "",
        source: "user",
        memberIds: [],
      },
    ],
    plan,
    view: {
      ...app.store.getState().view,
      collapsedGroupIds: ["stale", "g", "g"],
    },
  });
  app.toggleGroupCollapse("foreign");
  expect(app.store.getState().view.collapsedGroupIds).toEqual([
    "stale",
    "g",
    "g",
  ]);
  app.toggleGroupCollapse("g");
  expect(app.store.getState().view.collapsedGroupIds).toEqual([]);
  app.toggleGroupCollapse("g");
  expect(app.store.getState().view.collapsedGroupIds).toEqual(["g"]);
  await vi.advanceTimersByTimeAsync(300);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ collapsedGroupIds: ["g"] });
  expect(app.store.getState().plan).toBe(plan);
  vi.useRealTimers();
});
