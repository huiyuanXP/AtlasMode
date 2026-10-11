import { expect, it } from "vitest";
import type { TargetScope, TargetTrayState } from "./ownership-controller.js";
import { createTargetTrayController } from "./ownership-controller.js";
it("uses snapshot/project/path bounded requests and ignores late scope replies", async () => {
  const replies: ((value: TargetScope) => void)[] = [];
  const requests: unknown[] = [];
  const states: unknown[] = [];
  const controller = createTargetTrayController(
    (request) => {
      requests.push(request);
      return new Promise((resolve) => replies.push(resolve));
    },
    (state) => states.push(state),
  );
  const first = controller.load({
    projectId: "p",
    snapshotId: "S0",
    path: "src",
  });
  const second = controller.load({
    projectId: "p",
    snapshotId: "S0",
    path: "dest",
  });
  replies[1]!({
    snapshotId: "S0",
    path: "dest",
    kind: "folder",
    nodes: [],
    relations: [],
    dataSource: "code",
    truncated: true,
  });
  await second;
  const accepted = structuredClone(states.at(-1));
  replies[0]!({
    snapshotId: "S0",
    path: "src",
    kind: "folder",
    nodes: [],
    relations: [],
    dataSource: "code",
    truncated: false,
  });
  await first;
  expect(states.at(-1)).toEqual(accepted);
  expect(requests).toEqual([
    { projectId: "p", snapshotId: "S0", path: "src", budget: 100 },
    { projectId: "p", snapshotId: "S0", path: "dest", budget: 100 },
  ]);
});
it("rejects mismatched snapshot/path and invalidates on close without claiming target scope", async () => {
  let reply!: (value: TargetScope) => void;
  const states: TargetTrayState[] = [];
  const controller = createTargetTrayController(
    () =>
      new Promise((resolve) => {
        reply = resolve;
      }),
    (state) => states.push(state),
  );
  const pending = controller.load({
    projectId: "p",
    snapshotId: "S0",
    path: ".",
  });
  reply({
    snapshotId: "S1",
    path: ".",
    kind: "folder",
    nodes: [],
    relations: [],
    dataSource: "code",
    truncated: false,
  });
  await pending;
  expect(states.at(-1)?.status).toBe("error");
  const next = controller.load({ projectId: "p", snapshotId: "S0", path: "." });
  controller.cancel();
  reply({
    snapshotId: "S0",
    path: ".",
    kind: "folder",
    nodes: [],
    relations: [],
    dataSource: "code",
    truncated: false,
  });
  await next;
  expect(states.at(-1)?.status).toBe("idle");
});
