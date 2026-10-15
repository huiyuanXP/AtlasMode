import type { HttpApi } from "../../api/client.js";
export type TargetScope = Awaited<ReturnType<HttpApi["scope"]>>;
export type TargetRequest = Readonly<{
  projectId: string;
  snapshotId: string;
  path: string;
  budget: number;
  epoch?: number;
}>;
export type TargetTrayState = {
  status: "idle" | "loading" | "ready" | "error";
  request?: TargetRequest;
  scope?: TargetScope;
  error?: string;
};
/** Independent of graph/funnel focus. Invalidated replies never publish a scope. */
export function createTargetTrayController(
  fetchScope: (request: TargetRequest) => Promise<TargetScope>,
  publish: (state: TargetTrayState) => void,
  isCurrent: (request: TargetRequest) => boolean = () => true,
) {
  let generation = 0;
  return {
    async load(input: Omit<TargetRequest, "budget">) {
      const current = ++generation;
      const request = Object.freeze({ ...input, budget: 100 });
      publish({ status: "loading", request });
      try {
        const scope = await fetchScope(request);
        if (current !== generation) return;
        if (!isCurrent(request)) {
          generation++;
          publish({ status: "idle" });
          return;
        }
        if (
          scope.snapshotId !== request.snapshotId ||
          scope.path !== request.path ||
          scope.kind !== "folder"
        )
          throw new Error("Target scope changed; choose it again.");
        publish({ status: "ready", request, scope });
      } catch {
        if (current === generation && !isCurrent(request)) {
          generation++;
          publish({ status: "idle" });
        } else if (current === generation)
          publish({
            status: "error",
            request,
            error: "Target scope unavailable; refresh and choose it again.",
          });
      }
    },
    cancel() {
      generation++;
      publish({ status: "idle" });
    },
  };
}
