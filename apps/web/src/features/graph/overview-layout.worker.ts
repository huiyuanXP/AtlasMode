import { layoutProjectFacts } from "./overview-layout.js";
import { isLayoutToken } from "./overview-layout-controller.js";
import type { GlobalLayoutInput } from "./overview-layout.js";

// Minimal worker-only surface avoids adding WebWorker lib declarations to the
// shared DOM tsconfig. This entry is loaded solely as a module Worker later.
const worker = globalThis as unknown as {
  addEventListener(
    type: "message",
    listener: (event: { data: unknown }) => void,
  ): void;
  postMessage(message: unknown): void;
};
worker.addEventListener("message", (event) => {
  const message = event.data;
  if (
    !message ||
    typeof message !== "object" ||
    !("token" in message) ||
    !("input" in message) ||
    !isLayoutToken(message.token)
  )
    throw new Error("Invalid layout worker request");
  const start = performance.now();
  // Helper validates the structured-cloned payload; failures are explicit
  // rejected results, never a main-thread synchronous fallback.
  const result = layoutProjectFacts(message.input as GlobalLayoutInput);
  worker.postMessage({
    token: message.token,
    result,
    computeMilliseconds: performance.now() - start,
  });
});
