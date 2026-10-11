import type {
  CodeNode,
  FunctionGroup,
  Operation,
  SubgraphResult,
  ViewState,
} from "@codemap/core";
import { projectGraph, type LayerFilter } from "./projection.js";
import { projectGroups } from "../groups/projection.js";
import {
  estimateBaseVisualWork,
  estimateVisualWork,
  layoutVisibleOverview,
  type LayoutBox,
  type Projection,
  type ProjectionEstimate,
  type VisibleLayoutInput,
  type VisibleLayoutResult,
} from "./overview-visual.js";
import type { GeometryWork } from "./overview-layout.js";
export type OverviewCapture = {
  projectId: string;
  snapshotId: string;
  projectionGeneration: number;
  viewGeneration: number;
};
export type OverviewProjectionInput = {
  graph?: SubgraphResult;
  operations: readonly Operation[];
  filter: LayerFilter;
  references: readonly CodeNode[];
  groups: readonly FunctionGroup[];
  collapsed: readonly string[];
  positions: ViewState["positions"];
  locale: ViewState["locale"];
  skipGroups?: boolean;
};
export type GuardedProjection = {
  projection: Projection;
  base: Projection;
  estimate: ProjectionEstimate;
  rejection?: Extract<ProjectionEstimate, { status: "rejected" }>;
  fallback?: "facts" | "empty";
};
/** Refused layers never reach their projector. Fallback earns its own budget,
 * with no operations, references or groups from the refused scope. */
export function guardedOverviewProjection(
  input: OverviewProjectionInput,
): GuardedProjection {
  const estimate = estimateBaseVisualWork(
    input.graph,
    input.operations,
    input.filter,
    input.references,
  );
  const fallback = (
    rejection: Extract<ProjectionEstimate, { status: "rejected" }>,
  ): GuardedProjection => {
    const safe = estimateBaseVisualWork(input.graph, [], "fact", []);
    const base: Projection =
      input.graph && safe.status === "ready"
        ? projectGraph(
            input.graph,
            [],
            "fact",
            input.positions,
            input.locale,
            [],
          )
        : { nodes: [], edges: [], notices: [] };
    return {
      projection: base,
      base,
      estimate,
      rejection,
      fallback: input.graph && safe.status === "ready" ? "facts" : "empty",
    };
  };
  if (estimate.status !== "ready") return fallback(estimate);
  const base = projectGraph(
    input.graph,
    input.filter === "fact" ? [] : [...input.operations],
    input.filter,
    input.positions,
    input.locale,
    [...input.references],
  );
  if (input.skipGroups) return { projection: base, base, estimate };
  const visual = estimateVisualWork(base, input.groups, input.collapsed);
  if (visual.status !== "ready")
    return fallback({ ...visual, counts: estimate.counts });
  return {
    projection: projectGroups(
      base,
      [...input.groups],
      [...input.collapsed],
      input.positions,
      input.locale,
    ),
    base,
    estimate: { ...visual, counts: estimate.counts },
  };
}
export function measurementsChanged(
  before: Record<string, Partial<LayoutBox>>,
  after: Record<string, Partial<LayoutBox>>,
): boolean {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const id of ids) {
    const a = before[id],
      b = after[id];
    if (
      !a ||
      !b ||
      a.width === undefined ||
      a.height === undefined ||
      b.width === undefined ||
      b.height === undefined ||
      Math.abs(a.width - b.width) > 1 ||
      Math.abs(a.height - b.height) > 1
    )
      return true;
  }
  return false;
}
export type OverviewSessionInput = Omit<
  VisibleLayoutInput,
  "priorGeometry" | "measurements"
> & {
  capture: OverviewCapture;
  measurementGeneration: number;
  blocked?: Record<string, boolean | undefined>;
};
export type OverviewSessionToken = OverviewCapture & {
  sequence: number;
  measurementGeneration: number;
};
type Pending = { status: "pending"; token: OverviewSessionToken };
export type OverviewSessionResult =
  Pending | VisibleLayoutResult | { status: "cancelled" };
const zero = (): GeometryWork => ({
  candidateProbes: 0,
  cellEntriesInserted: 0,
  liveCellEntries: 0,
  bucketEntryVisits: 0,
  rectangleComparisons: 0,
  manualPairObservations: 0,
  passes: 0,
});
export function sameOverviewCapture(
  a: OverviewCapture | undefined,
  b: OverviewCapture | undefined,
): boolean {
  return (
    !!a &&
    !!b &&
    a.projectId === b.projectId &&
    a.snapshotId === b.snapshotId &&
    a.projectionGeneration === b.projectionGeneration &&
    a.viewGeneration === b.viewGeneration
  );
}
/** Two pure layout passes form one atomic job. First positions remain private;
 * measured validation alone may publish positions, using cumulative counters. */
export class OverviewSession {
  private sequence = 0;
  private active?: {
    token: OverviewSessionToken;
    input: OverviewSessionInput;
    candidate: Extract<VisibleLayoutResult, { status: "ready" }>;
  };
  begin(input: OverviewSessionInput): OverviewSessionResult {
    this.cancel();
    if (Object.values(input.blocked ?? {}).some(Boolean))
      return { status: "cancelled" };
    const token = {
      ...input.capture,
      sequence: ++this.sequence,
      measurementGeneration: input.measurementGeneration,
    };
    const candidate = layoutVisibleOverview({
      ...input,
      measurements: {},
      priorGeometry: zero(),
    });
    if (candidate.status !== "ready") return candidate;
    this.active = { token, input, candidate };
    return { status: "pending", token };
  }
  measure(
    token: OverviewSessionToken,
    measurements: Record<string, LayoutBox>,
    current: OverviewCapture | undefined,
    measurementGeneration = token.measurementGeneration,
  ): OverviewSessionResult {
    const job = this.active;
    if (!job || job.token.sequence !== token.sequence)
      return { status: "cancelled" };
    if (
      !sameOverviewCapture(token, current) ||
      measurementGeneration !== token.measurementGeneration
    ) {
      this.cancel();
      return { status: "cancelled" };
    }
    // Read only the accepted visual scope. Unknown/old dimensions cannot complete it.
    const boxes: Record<string, LayoutBox> = {};
    for (const node of job.input.projection.nodes) {
      const box = measurements[node.id];
      if (!box) return { status: "pending", token };
      boxes[node.id] = { ...box };
    }
    this.active = undefined;
    return layoutVisibleOverview({
      ...job.input,
      measurements: boxes,
      priorGeometry: job.candidate.geometry,
    });
  }
  isCurrent(token: OverviewSessionToken) {
    return this.active?.token.sequence === token.sequence;
  }
  cancel() {
    this.active = undefined;
  }
}

export function saveCapturedVisualPosition(
  id: string,
  position: { x: number; y: number },
  capture: OverviewCapture | undefined,
  current: OverviewCapture | undefined,
  save: (
    patch: Record<string, { x: number; y: number }>,
    capture: OverviewCapture,
  ) => boolean,
): boolean {
  if (!capture || !sameOverviewCapture(capture, current)) return false;
  return save({ [id]: position }, capture);
}

export type OverviewMeasurementFrame = {
  key: string;
  projection: Projection;
  projectionGeneration: number;
  generation: number;
  boxes: Record<string, LayoutBox>;
};
/** Cache identity is exact: visual IDs alone cannot certify current contents. */
export function readOverviewMeasurements(
  frame: OverviewMeasurementFrame,
  expected: {
    key: string;
    projection: Projection;
    projectionGeneration: number;
  },
): Record<string, LayoutBox> | undefined {
  return frame.key === expected.key &&
    frame.projection === expected.projection &&
    frame.projectionGeneration === expected.projectionGeneration
    ? frame.boxes
    : undefined;
}
export function resolveCurrentOverviewCapture(input: {
  onCaptureLayout?: () => OverviewCapture | undefined;
  layoutCapture?: OverviewCapture;
}): OverviewCapture | undefined {
  return input.onCaptureLayout ? input.onCaptureLayout() : input.layoutCapture;
}
export type OverviewLiveState = {
  capture: OverviewCapture | undefined;
  blocked: boolean;
};
/** Both derived adoption and explicit persistence share the same final live
 * veto. The renderer never substitutes stale props for an authoritative veto. */
export function completeOverviewJob(
  session: OverviewSession,
  token: OverviewSessionToken,
  boxes: Record<string, LayoutBox>,
  measurementGeneration: number,
  readCurrent: () => OverviewLiveState,
  apply: (
    result: Extract<VisibleLayoutResult, { status: "ready" }>,
    capture: OverviewCapture,
  ) => void,
  save?: (
    patch: Record<string, { x: number; y: number }>,
    capture: OverviewCapture,
  ) => boolean,
): OverviewSessionResult {
  const first = readCurrent();
  if (first.blocked || !sameOverviewCapture(token, first.capture)) {
    session.cancel();
    return { status: "cancelled" };
  }
  const result = session.measure(
    token,
    boxes,
    first.capture,
    measurementGeneration,
  );
  if (result.status !== "ready") return result;
  const final = readCurrent();
  if (
    final.blocked ||
    !final.capture ||
    !sameOverviewCapture(token, final.capture)
  ) {
    session.cancel();
    return { status: "cancelled" };
  }
  if (save && !save(result.positions, final.capture))
    return { status: "cancelled" };
  apply(result, final.capture);
  return result;
}
type CompactEntry = {
  scope: string;
  snapshotId: string;
  positions: Record<string, { x: number; y: number }>;
  global: VisibleLayoutInput["global"];
};
/** At most two projects, one accepted bounded compact scope each. Retention
 * crosses snapshots, while current display requires exact snapshot freshness. */
export class CompactOverviewCache {
  private entries = new Map<string, CompactEntry>();
  commit(
    projectId: string,
    scope: string,
    snapshotId: string,
    positions: Record<string, { x: number; y: number }>,
    global: VisibleLayoutInput["global"],
  ) {
    const ids = Object.keys(positions);
    if (ids.length > 500) throw Error("visual_budget");
    const owned: typeof positions = {};
    for (const id of ids) owned[id] = { ...positions[id]! };
    this.entries.delete(projectId);
    this.entries.set(projectId, {
      scope,
      snapshotId,
      positions: owned,
      global,
    });
    if (this.entries.size > 2)
      this.entries.delete(this.entries.keys().next().value!);
  }
  current(
    projectId: string,
    scope: string,
    snapshotId: string,
  ): Record<string, { x: number; y: number }> {
    const entry = this.entries.get(projectId);
    return entry?.scope === scope && entry.snapshotId === snapshotId
      ? entry.positions
      : {};
  }
  retained(
    projectId: string,
    scope: string,
    snapshotId: string,
    ids: readonly string[],
    global: VisibleLayoutInput["global"],
  ): Record<string, { x: number; y: number }> {
    const entry = this.entries.get(projectId),
      positions: Record<string, { x: number; y: number }> = {};
    if (
      !entry ||
      entry.scope !== scope ||
      (entry.snapshotId === snapshotId && entry.global !== global)
    )
      return positions;
    for (const id of ids)
      if (Object.hasOwn(entry.positions, id))
        positions[id] = { ...entry.positions[id]! };
    return positions;
  }
}

export function completeOverviewFrame(
  session: OverviewSession,
  token: OverviewSessionToken,
  frame: OverviewMeasurementFrame,
  expected: {
    key: string;
    projection: Projection;
    projectionGeneration: number;
  },
  readCurrent: () => OverviewLiveState,
  apply: (
    result: Extract<VisibleLayoutResult, { status: "ready" }>,
    capture: OverviewCapture,
  ) => void,
  save?: (
    patch: Record<string, { x: number; y: number }>,
    capture: OverviewCapture,
  ) => boolean,
): OverviewSessionResult {
  const boxes = readOverviewMeasurements(frame, expected);
  if (!boxes) return { status: "pending", token };
  return completeOverviewJob(
    session,
    token,
    boxes,
    frame.generation,
    readCurrent,
    apply,
    save,
  );
}
