import { validateLayoutTarget } from "../../api/layout-target.js";
import { GLOBAL_GEOMETRY_LIMITS } from "./overview-layout.js";
import type {
  GlobalLayoutInput,
  GlobalLayoutResult,
  GeometryWork,
  ManualOverlapDiagnostics,
} from "./overview-layout.js";

export type LayoutToken = {
  projectId: string;
  snapshotId: string;
  layoutGeneration: number;
  viewGeneration: number;
};
export type OverviewWorkerOutcome =
  | {
      status: "completed";
      result: GlobalLayoutResult;
      computeMilliseconds: number;
    }
  | { status: "failed"; reason: "timeout" | "worker_error" | "unsupported" };
export interface WorkerPort {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(
    type: "message" | "error",
    listener: (event: { data: unknown }) => void,
  ): void;
  removeEventListener(
    type: "message" | "error",
    listener: (event: { data: unknown }) => void,
  ): void;
}
function boundedWorkerInput(
  input: GlobalLayoutInput,
  token: LayoutToken,
): GlobalLayoutInput {
  if (!input || !record(input.pins) || !record(input.retained) || !input.target)
    throw Error("Invalid layout input");
  const target = validateLayoutTarget(input.target, {
    projectId: token.projectId,
    snapshotId: token.snapshotId,
    contentHash: input.target.contentHash,
  });
  if (target.status !== "ready")
    throw Error("Worker requires complete ready target");
  const pins: GlobalLayoutInput["pins"] = Object.create(null),
    retained: GlobalLayoutInput["retained"] = Object.create(null);
  for (const n of target.nodes)
    for (const [source, destination] of [
      [input.pins, pins],
      [input.retained, retained],
    ] as const) {
      if (!Object.hasOwn(source, n.id)) continue;
      const p = source[n.id];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number")
        throw Error("Invalid layout position");
      destination[n.id] = { x: p.x, y: p.y };
    }
  // Detach captured arrays/counts from mutable caller state before posting. Only
  // target-known keys and XY numbers travel; no opaque saved/view/source data.
  return {
    target: {
      ...target,
      counts: { ...target.counts, byKind: { ...target.counts.byKind } },
      nodes: target.nodes.map((n) => ({ ...n })),
      relations: target.relations.map((r) => ({ ...r })),
    },
    pins,
    retained,
  };
}

type Options = {
  createWorker: () => WorkerPort | undefined;
  onResult: (token: LayoutToken, outcome: OverviewWorkerOutcome) => void;
  setTimer: (callback: () => void, delay: number) => unknown;
  clearTimer: (handle: unknown) => void;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const natural = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export function isLayoutToken(v: unknown): v is LayoutToken {
  return (
    record(v) &&
    Object.keys(v).length === 4 &&
    typeof v.projectId === "string" &&
    !!v.projectId &&
    typeof v.snapshotId === "string" &&
    !!v.snapshotId &&
    natural(v.layoutGeneration) &&
    natural(v.viewGeneration)
  );
}
function sameToken(a: LayoutToken, b: LayoutToken) {
  return (
    a.projectId === b.projectId &&
    a.snapshotId === b.snapshotId &&
    a.layoutGeneration === b.layoutGeneration &&
    a.viewGeneration === b.viewGeneration
  );
}
function geometry(v: unknown): v is GeometryWork {
  if (!record(v) || !natural(v.passes) || v.passes > 1) return false;
  for (const k of Object.keys(
    GLOBAL_GEOMETRY_LIMITS,
  ) as (keyof typeof GLOBAL_GEOMETRY_LIMITS)[])
    if (!natural(v[k]) || v[k] > GLOBAL_GEOMETRY_LIMITS[k]) return false;
  return true;
}
function diagnostics(v: unknown): v is ManualOverlapDiagnostics {
  return (
    record(v) &&
    Array.isArray(v.affectedPinIds) &&
    v.affectedPinIds.length <= 64 &&
    v.affectedPinIds.every((id) => typeof id === "string") &&
    Array.isArray(v.samplePairs) &&
    v.samplePairs.length <= 32 &&
    v.samplePairs.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((id) => typeof id === "string"),
    ) &&
    natural(v.pairsObserved) &&
    v.pairsObserved <= 4096 &&
    typeof v.complete === "boolean" &&
    typeof v.truncated === "boolean"
  );
}
function result(v: unknown, input: GlobalLayoutInput): v is GlobalLayoutResult {
  if (!record(v) || !diagnostics(v.manualOverlaps)) return false;
  if (v.status === "rejected")
    return (
      ["invalid_input", "work_budget", "geometry_budget"].includes(
        String(v.reason),
      ) &&
      typeof v.stage === "string" &&
      geometry(v.geometry) &&
      v.manualOverlaps.complete === false &&
      !Object.hasOwn(v, "positions")
    );
  if (
    v.status !== "ready" ||
    !record(v.positions) ||
    !record(v.ranks) ||
    !Array.isArray(v.order) ||
    v.order.length > 5000 ||
    !record(v.stats) ||
    !geometry(v.stats.geometry) ||
    !v.manualOverlaps.complete ||
    !natural(v.stats.nodes) ||
    v.stats.nodes > 5000 ||
    !natural(v.stats.rawRelations) ||
    v.stats.rawRelations > 20000 ||
    !natural(v.stats.rankRelations) ||
    v.stats.rankRelations > v.stats.rawRelations ||
    !natural(v.stats.sccs) ||
    v.stats.sccs > v.stats.nodes
  )
    return false;
  const ids = new Set<string>();
  for (const id of v.order) {
    if (
      typeof id !== "string" ||
      !id ||
      ids.has(id) ||
      !Object.hasOwn(v.positions, id) ||
      !Object.hasOwn(v.ranks, id)
    )
      return false;
    ids.add(id);
    const point = v.positions[id];
    if (
      !record(point) ||
      typeof point.x !== "number" ||
      !Number.isFinite(point.x) ||
      typeof point.y !== "number" ||
      !Number.isFinite(point.y) ||
      !natural(v.ranks[id])
    )
      return false;
  }
  if (
    ids.size !== v.stats.nodes ||
    Object.keys(v.positions).length !== ids.size ||
    Object.keys(v.ranks).length !== ids.size ||
    !input.target ||
    input.target.nodes.length !== ids.size ||
    input.target.relations.length !== v.stats.rawRelations ||
    input.target.nodes.some((n) => !ids.has(n.id))
  )
    return false;
  return true;
}

/** A job owns its listeners/timer/worker. Closure identity also retires a reply
 * when a caller accidentally reuses an identical token after cancel/restart. */
export class OverviewLayoutController {
  private active: { cancel: () => void } | undefined;
  private disposed = false;
  constructor(private readonly options: Options) {}
  request(token: LayoutToken, input: GlobalLayoutInput): void {
    this.cancel();
    if (this.disposed) return;
    const capture = { ...token };
    if (!isLayoutToken(capture)) {
      this.options.onResult(capture, {
        status: "failed",
        reason: "worker_error",
      });
      return;
    }
    const start = performance.now();
    let payload: GlobalLayoutInput;
    let ownedWorker: WorkerPort | undefined,
      alive = true,
      timer: unknown,
      hasTimer = false;
    const cleanup = () => {
      if (!alive) return;
      alive = false;
      // Each independent release is attempted even if an adapter throws.
      try {
        ownedWorker?.removeEventListener("message", message);
      } catch {
        /* cleanup continues */
      }
      try {
        ownedWorker?.removeEventListener("error", error);
      } catch {
        /* cleanup continues */
      }
      if (hasTimer) {
        try {
          this.options.clearTimer(timer);
        } catch {
          /* terminate still required */
        }
      }
      try {
        ownedWorker?.terminate();
      } catch {
        /* already terminal */
      }
      if (this.active === job) this.active = undefined;
    };
    const finish = (outcome: OverviewWorkerOutcome) => {
      if (!alive) return;
      cleanup();
      this.options.onResult(capture, outcome);
    };
    const message = (event: { data: unknown }) => {
      if (!alive) return;
      if (performance.now() - start >= 1000) {
        finish({ status: "failed", reason: "timeout" });
        return;
      }
      const data = event.data;
      // Foreign/retired generations are ignored, leaving the timeout active.
      if (
        !record(data) ||
        !isLayoutToken(data.token) ||
        !sameToken(capture, data.token)
      )
        return;
      if (
        typeof data.computeMilliseconds !== "number" ||
        !Number.isFinite(data.computeMilliseconds) ||
        data.computeMilliseconds < 0 ||
        !result(data.result, payload)
      ) {
        finish({ status: "failed", reason: "worker_error" });
        return;
      }
      // Result validation is synchronous; a queued timer cannot run during it.
      // Recheck the hard wall deadline at the final success boundary.
      if (performance.now() - start >= 1000) {
        finish({ status: "failed", reason: "timeout" });
        return;
      }
      finish({
        status: "completed",
        result: data.result,
        computeMilliseconds: data.computeMilliseconds,
      });
    };
    const error = () => finish({ status: "failed", reason: "worker_error" });
    const job = { cancel: cleanup };
    this.active = job;
    try {
      timer = this.options.setTimer(
        () => finish({ status: "failed", reason: "timeout" }),
        1000,
      );
      hasTimer = true;
      if (!alive) {
        this.options.clearTimer(timer);
        return;
      }
      payload = boundedWorkerInput(input, capture);
      ownedWorker = this.options.createWorker();
      if (!ownedWorker) {
        finish({ status: "failed", reason: "unsupported" });
        return;
      }
      if (!alive) {
        ownedWorker.terminate();
        return;
      }
      if (performance.now() - start >= 1000) {
        finish({ status: "failed", reason: "timeout" });
        return;
      }
      ownedWorker.addEventListener("message", message);
      if (!alive) return;
      ownedWorker.addEventListener("error", error);
      if (!alive) return;
      ownedWorker.postMessage({ token: capture, input: payload });
    } catch {
      finish({ status: "failed", reason: "worker_error" });
    }
  }
  cancel(): void {
    this.active?.cancel();
  }
  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
}
