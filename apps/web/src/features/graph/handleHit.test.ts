import { expect, it } from "vitest";
import { HANDLE_HIT_BELOW_ZOOM, handleHitSize } from "./Canvas.js";

it("adds an on-screen hit area only when the handle is too small to press", () => {
  // Overview zoom measured in CI: 0.38. 22 / 0.38 = 58 flow px = ~22 screen px.
  expect(handleHitSize(0.38)).toBe(58);
  expect(handleHitSize(0.38) * 0.38).toBeGreaterThanOrEqual(21);
  // Very small zoom is capped so neighbouring handles do not overlap.
  expect(handleHitSize(0.1)).toBe(72);
});

it("adds nothing at normal zoom so card-edge clicks are not swallowed", () => {
  expect(handleHitSize(HANDLE_HIT_BELOW_ZOOM)).toBe(0);
  expect(handleHitSize(1)).toBe(0);
  expect(handleHitSize(2)).toBe(0);
  expect(handleHitSize(HANDLE_HIT_BELOW_ZOOM - 0.01)).toBeGreaterThan(0);
});

it("adds nothing for a missing or invalid zoom", () => {
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    expect(handleHitSize(bad)).toBe(0);
});
