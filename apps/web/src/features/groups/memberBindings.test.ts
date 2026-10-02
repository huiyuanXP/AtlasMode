import { it, expect } from "vitest";
import { readMembers } from "./memberBindings.js";
import { ApiError } from "../../api/client.js";
it("bounds member reads, distinguishes missing bindings, and rejects mixed snapshots", async () => {
  let active = 0,
    maximum = 0;
  const results = await readMembers(
    Array.from({ length: 30 }, (_, i) => String(i)),
    0,
    "s",
    async (id) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      if (id === "1") throw new ApiError("NOT_FOUND", "Missing", 404);
      if (id === "2") throw new ApiError("HTTP_ERROR", "Offline", 503);
      return {
        snapshotId: id === "3" ? "old" : "s",
        node: { id, kind: "function", name: id },
      };
    },
  );
  expect(results).toHaveLength(20);
  expect(maximum).toBeLessThanOrEqual(4);
  expect(results[1]).toEqual({ id: "1", status: "missing" });
  expect(results[2]).toMatchObject({ status: "error", message: "Offline" });
  expect(results[3]).toMatchObject({ status: "error" });
  expect(results[0]).toMatchObject({ status: "bound", node: { id: "0" } });
});
