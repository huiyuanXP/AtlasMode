import { layoutProjectFacts } from "./overview-layout.js";
import { describe, expect, it, vi } from "vitest";
import { OverviewLayoutController } from "./overview-layout-controller.js";
import type {
  LayoutToken,
  WorkerPort,
  OverviewWorkerOutcome,
} from "./overview-layout-controller.js";
import type { GlobalLayoutInput } from "./overview-layout.js";

const token: LayoutToken = {
  projectId: "p",
  snapshotId: "s",
  layoutGeneration: 1,
  viewGeneration: 1,
};
const input: GlobalLayoutInput = {
  target: {
    projectId: "p",
    snapshotId: "s",
    contentHash: "hash",
    scope: "project_indexed_facts",
    status: "ready",
    complete: true,
    counts: {
      nodes: 0,
      relations: 0,
      byKind: { function: 0, file: 0, folder: 0, external: 0 },
    },
    limits: { nodes: 5000, relations: 20000, bytes: 8388608 },
    nodes: [],
    relations: [],
  },
  pins: {},
  retained: {},
};
class FakeWorker implements WorkerPort {
  listeners = {
    message: new Set<(event: { data: unknown }) => void>(),
    error: new Set<(event: { data: unknown }) => void>(),
  };
  terminated = 0;
  messages: unknown[] = [];
  postMessage(v: unknown) {
    this.messages.push(v);
  }
  terminate() {
    this.terminated++;
  }
  addEventListener(t: "message" | "error", fn: (e: { data: unknown }) => void) {
    this.listeners[t].add(fn);
  }
  removeEventListener(
    t: "message" | "error",
    fn: (e: { data: unknown }) => void,
  ) {
    this.listeners[t].delete(fn);
  }
  emit(t: "message" | "error", data: unknown) {
    for (const fn of this.listeners[t]) fn({ data });
  }
}
function setup() {
  const workers: FakeWorker[] = [],
    results: { token: LayoutToken; outcome: OverviewWorkerOutcome }[] = [],
    timers = new Map<number, () => void>();
  let next = 0;
  const c = new OverviewLayoutController({
    createWorker: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    onResult: (token, outcome) => results.push({ token, outcome }),
    setTimer: (cb, ms) => {
      expect(ms).toBe(1000);
      timers.set(++next, cb);
      return next;
    },
    clearTimer: (id) => {
      timers.delete(id as number);
    },
  });
  return { c, workers, results, timers };
}
const result = {
  status: "rejected",
  reason: "invalid_input",
  stage: "input",
  geometry: {
    candidateProbes: 0,
    cellEntriesInserted: 0,
    liveCellEntries: 0,
    bucketEntryVisits: 0,
    rectangleComparisons: 0,
    manualPairObservations: 0,
    passes: 0,
  },
  manualOverlaps: {
    affectedPinIds: [],
    samplePairs: [],
    pairsObserved: 0,
    complete: false,
    truncated: false,
  },
};
describe("one active bounded worker", () => {
  it.each([1000, 1001])(
    "times out a valid999ms reply when complete validation reaches %ims",
    (deadline) => {
      const s = setup(),
        x = structuredClone(input);
      x.target.nodes = [{ id: "n", kind: "function" }];
      x.target.counts.nodes = 1;
      x.target.counts.byKind.function = 1;
      const complete = layoutProjectFacts(x);
      expect(complete.status).toBe("ready");
      if (complete.status !== "ready") return;
      let clock = 0;
      const now = vi.spyOn(performance, "now").mockImplementation(() => clock);
      try {
        s.c.request(token, x);
        const oldMessage = [...s.workers[0]!.listeners.message][0]!,
          oldTimer = [...s.timers.values()][0]!;
        const point = complete.positions.n!,
          coordinate = point.x;
        let validated = false;
        Object.defineProperty(point, "x", {
          enumerable: true,
          get() {
            validated = true;
            clock = deadline;
            return coordinate;
          },
        });
        clock = 999;
        s.workers[0]!.emit("message", {
          token,
          result: complete,
          computeMilliseconds: 1,
        });
        expect(validated).toBe(true);
        expect(s.results).toEqual([
          { token, outcome: { status: "failed", reason: "timeout" } },
        ]);
        expect(s.workers[0]!.terminated).toBe(1);
        expect(s.workers[0]!.listeners.message.size).toBe(0);
        expect(s.workers[0]!.listeners.error.size).toBe(0);
        expect(s.timers.size).toBe(0);
        oldMessage({
          data: { token, result: complete, computeMilliseconds: 1 },
        });
        oldTimer();
        expect(s.results).toHaveLength(1);
        expect(s.workers[0]!.terminated).toBe(1);
      } finally {
        now.mockRestore();
        s.c.dispose();
      }
    },
  );
  it("accepts a complete ready result against the detached captured target", () => {
    const s = setup(),
      x = structuredClone(input);
    s.c.request(token, x);
    const sent = s.workers[0]!.messages[0] as { input: GlobalLayoutInput };
    const complete = layoutProjectFacts(sent.input);
    x.target.nodes.push({ id: "later", kind: "function" });
    s.workers[0]!.emit("message", {
      token,
      result: complete,
      computeMilliseconds: 1,
    });
    expect(s.results).toEqual([
      {
        token,
        outcome: {
          status: "completed",
          result: complete,
          computeMilliseconds: 1,
        },
      },
    ]);
  });
  it("clones only known domain positions and numeric XY fields without scanning opaque keys", () => {
    const s = setup(),
      x: GlobalLayoutInput = structuredClone(input);
    x.target.nodes = [{ id: "__proto__", kind: "function" }];
    x.target.counts.nodes = 1;
    x.target.counts.byKind.function = 1;
    x.pins = Object.create(null);
    x.pins["__proto__"] = { x: 1, y: 2 };
    Object.assign(x.pins["__proto__"]!, { extra: "unbounded opaque text" });
    Object.defineProperty(x.pins, "opaque", {
      enumerable: true,
      get() {
        throw Error("must not read opaque key");
      },
    });
    x.retained.opaque = { x: NaN, y: Infinity };
    s.c.request(token, x);
    const sent = s.workers[0]!.messages[0] as { input: GlobalLayoutInput };
    expect(Object.keys(sent.input.pins)).toEqual(["__proto__"]);
    expect(sent.input.pins["__proto__"]).toEqual({ x: 1, y: 2 });
    expect(Object.keys(sent.input.retained)).toEqual([]);
    s.c.cancel();
    expect(Object.hasOwn(x.pins, "opaque")).toBe(true);
  });
  it("accepts a native Worker structurally without a hidden adapter", () => {
    const native = null as unknown as Worker;
    const port: WorkerPort = native;
    expect(port).toBeNull();
  });
  it("accepts current exact token once, releases listeners and timer", () => {
    const s = setup();
    s.c.request(token, input);
    s.workers[0]!.emit("message", { token, result, computeMilliseconds: 2 });
    expect(s.results).toHaveLength(1);
    expect(s.results[0]!.outcome.status).toBe("completed");
    expect(s.workers[0]!.terminated).toBe(1);
    expect(s.timers.size).toBe(0);
    expect(s.workers[0]!.listeners.message.size).toBe(0);
  });
  it("terminates at 1000ms and ignores a retained late listener", () => {
    const s = setup();
    s.c.request(token, input);
    const old = [...s.workers[0]!.listeners.message][0]!;
    [...s.timers.values()][0]!();
    old({ data: { token, result, computeMilliseconds: 2 } });
    expect(s.results).toEqual([
      { token, outcome: { status: "failed", reason: "timeout" } },
    ]);
    expect(s.workers[0]!.terminated).toBe(1);
    expect(s.workers[0]!.listeners.error.size).toBe(0);
  });
  it.each([
    "projectId",
    "snapshotId",
    "layoutGeneration",
    "viewGeneration",
  ] as const)("ignores different %s", (key) => {
    const s = setup();
    s.c.request(token, input);
    s.workers[0]!.emit("message", {
      token: { ...token, [key]: typeof token[key] === "number" ? 2 : "other" },
      result,
      computeMilliseconds: 2,
    });
    expect(s.results).toHaveLength(0);
    expect(s.timers.size).toBe(1);
    s.c.cancel();
  });
  it("retires prior job even with an identical reused token", () => {
    const s = setup();
    s.c.request(token, input);
    const old = [...s.workers[0]!.listeners.message][0]!;
    s.c.request(token, input);
    old({ data: { token, result, computeMilliseconds: 2 } });
    expect(s.results).toHaveLength(0);
    expect(s.workers[0]!.terminated).toBe(1);
    s.workers[1]!.emit("message", { token, result, computeMilliseconds: 2 });
    expect(s.results).toHaveLength(1);
  });
  it("emits one error and releases all resources", () => {
    const s = setup();
    s.c.request(token, input);
    s.workers[0]!.emit("error", {});
    s.workers[0]!.emit("error", {});
    expect(s.results[0]!.outcome).toEqual({
      status: "failed",
      reason: "worker_error",
    });
    expect(s.results).toHaveLength(1);
    expect(s.timers.size).toBe(0);
  });
  it("dispose cancels and prevents future work", () => {
    const s = setup();
    s.c.request(token, input);
    s.c.dispose();
    s.c.dispose();
    s.c.request(token, input);
    expect(s.workers).toHaveLength(1);
    expect(s.workers[0]!.terminated).toBe(1);
    expect(s.timers.size).toBe(0);
    expect(s.results).toHaveLength(0);
  });
  it("rejects malformed current reply rather than publishing it", () => {
    const s = setup();
    s.c.request(token, input);
    s.workers[0]!.emit("message", {
      token,
      result: { status: "ready" },
      computeMilliseconds: NaN,
    });
    expect(s.results[0]!.outcome).toEqual({
      status: "failed",
      reason: "worker_error",
    });
  });
  it("unsupported worker does not synchronously compute", () => {
    const results: OverviewWorkerOutcome[] = [];
    const c = new OverviewLayoutController({
      createWorker: () => undefined,
      onResult: (_, r) => results.push(r),
      setTimer: () => 1,
      clearTimer: () => {},
    });
    c.request(token, input);
    expect(results).toEqual([{ status: "failed", reason: "unsupported" }]);
  });
  it("factory and postMessage failures become worker_error", () => {
    for (const factory of [
      () => {
        throw Error("constructor");
      },
      () => {
        const w = new FakeWorker();
        w.postMessage = () => {
          throw Error("clone");
        };
        return w;
      },
    ]) {
      const results: OverviewWorkerOutcome[] = [];
      const c = new OverviewLayoutController({
        createWorker: factory,
        onResult: (_, r) => results.push(r),
        setTimer: () => 1,
        clearTimer: () => {},
      });
      c.request(token, input);
      expect(results).toEqual([{ status: "failed", reason: "worker_error" }]);
    }
  });
  it("starts the wall timer before worker construction and clears it on factory failure", () => {
    let armed = false,
      cleared = 0;
    const outcomes: OverviewWorkerOutcome[] = [];
    const c = new OverviewLayoutController({
      createWorker: () => {
        expect(armed).toBe(true);
        throw Error("factory");
      },
      setTimer: () => {
        armed = true;
        return 1;
      },
      clearTimer: () => {
        cleared++;
      },
      onResult: (_, r) => outcomes.push(r),
    });
    c.request(token, input);
    expect(cleared).toBe(1);
    expect(outcomes).toEqual([{ status: "failed", reason: "worker_error" }]);
  });
});
