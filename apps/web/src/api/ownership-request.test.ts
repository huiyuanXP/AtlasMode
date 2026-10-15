import { expect, it } from "vitest";
import { HttpApi } from "./client.js";
it("serializes captured revision/snapshot and preserves omitted legacy field", async () => {
  const bodies: unknown[] = [];
  const api = new HttpApi(async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string));
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  await api.updateOwnershipPlan({
    planId: "plan",
    expectedRevision: 3,
    expectedSnapshotId: "S0",
    operations: [],
    title: "p",
    description: "",
  });
  expect(bodies[0]).toEqual({
    expectedRevision: 3,
    expectedSnapshotId: "S0",
    operations: [],
    title: "p",
    description: "",
  });
  await api.updatePlan("plan", 4, [], "p", "");
  expect(bodies[1]).not.toHaveProperty("expectedSnapshotId");
  await expect(
    api.updateOwnershipPlan({
      planId: "plan",
      expectedRevision: 4,
      expectedSnapshotId: "",
      operations: [],
      title: "p",
      description: "",
    }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(bodies).toHaveLength(2);
});
