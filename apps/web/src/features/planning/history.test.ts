import { expect, it } from "vitest";
import type { Plan } from "@codemap/core";
import {
  observeHistory,
  commitHistory,
  historyTarget,
  historyKey,
} from "./history.js";
const plan = (
  revision: number,
  title: string,
  id = "p",
  projectId = "a",
): Plan => ({
  id,
  projectId,
  revision,
  title,
  description: "design",
  operations: [{ kind: "annotate", targetId: "missing", text: "retain" }],
  status: "draft",
  baselineSnapshotId: "s",
  baselineContentHash: "h",
  createdAt: "now",
  updatedAt: "now",
});
it("undo and redo restore content with the latest revision and new edits discard redo", () => {
  let h = observeHistory(undefined, plan(1, "A"));
  h = commitHistory(h, plan(1, "A"), plan(2, "B"), "edit");
  expect(historyTarget(h, plan(2, "B"), "undo")).toMatchObject({
    title: "A",
    operations: [{ targetId: "missing" }],
  });
  h = commitHistory(h, plan(2, "B"), plan(3, "A"), "undo");
  expect(historyTarget(h, plan(3, "A"), "redo")?.title).toBe("B");
  h = commitHistory(h, plan(3, "A"), plan(4, "C"), "edit");
  expect(historyTarget(h, plan(4, "C"), "redo")).toBeUndefined();
});
it("external revision and project or plan changes cannot reuse history", () => {
  const h = commitHistory(
    observeHistory(undefined, plan(1, "A")),
    plan(1, "A"),
    plan(2, "B"),
    "edit",
  );
  expect(historyTarget(h, plan(3, "remote"), "undo")).toBeUndefined();
  expect(historyTarget(h, plan(2, "B", "other"), "undo")).toBeUndefined();
  expect(historyTarget(h, plan(2, "B", "p", "b"), "undo")).toBeUndefined();
  expect(observeHistory(h, plan(3, "remote")).past).toEqual([]);
  expect(historyKey(plan(1, "A", "b:c", "a"))).not.toBe(
    historyKey(plan(1, "A", "c", "a:b")),
  );
});
it("history is bounded and observing approval-only changes preserves available undo", () => {
  let before = plan(1, "0"),
    h = observeHistory(undefined, before);
  for (let i = 1; i <= 65; i++) {
    const after = plan(i + 1, String(i));
    h = commitHistory(h, before, after, "edit");
    before = after;
  }
  expect(h.past).toHaveLength(50);
  expect(
    observeHistory(h, { ...before, status: "approved" }).past,
  ).toHaveLength(50);
});
