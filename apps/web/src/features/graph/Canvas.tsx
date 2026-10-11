import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  applyNodeChanges,
  MarkerType,
  SelectionMode,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
  useNodes,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import type {
  CodeNode,
  FunctionGroup,
  Operation,
  SubgraphResult,
  ViewState,
  Relation,
} from "@codemap/core";
import { useStrings } from "../../i18n/index.js";
import {
  focusTargets,
  type GraphNode,
  type GraphEdge,
  type LayerFilter,
} from "./projection.js";
import type { EdgeReference, PlannedRelation } from "../planning/operations.js";
import { layoutFunnel, type FunnelState, type FunnelLane } from "./funnel.js";
import type { FocusRequest } from "./focus.js";
export type { FocusRequest } from "./focus.js";
import "@xyflow/react/dist/style.css";
import { NodeIdentity, nodeIdentity } from "./nodeIdentity.js";
import {
  inspectionHighlight,
  FunnelOffsets,
  inspectionPlacement,
} from "./inspection.js";
import { circleFunctions, circleSelectedNodes } from "../groups/selection.js";
import type {
  LayoutCapture,
  OverviewLayoutState,
} from "../../app/workspace.js";
import {
  guardedOverviewProjection,
  OverviewSession,
  measurementsChanged,
  sameOverviewCapture,
  saveCapturedVisualPosition,
  readOverviewMeasurements,
  resolveCurrentOverviewCapture,
  completeOverviewFrame,
  CompactOverviewCache,
  type OverviewMeasurementFrame,
  type OverviewSessionToken,
} from "./overview-session.js";
import {
  resolveVisualPins,
  type LayoutBox,
  type VisibleLayoutResult,
} from "./overview-visual.js";
import { GroupCard } from "../groups/GroupCard.js";
import { MapPanel } from "./MapPanel.js";
import "./graph-inspection.css";
function CodeCard({ data }: NodeProps<GraphNode>) {
  const zh = useStrings();
  const n = data.node,
    callable = n.kind === "function" || n.kind === "file",
    lane = data.funnelLane as FunnelLane | undefined;
  return (
    <div
      className={`code-card ${data.ownershipMode ? "nodrag nopan" : ""} ${data.layer} kind-${n.kind} ${lane ? `funnel-${lane}` : ""} inspection-${data.highlight ?? "idle"}`}
      draggable={
        !!data.ownershipMode && !!data.ownershipEnabled && n.kind === "function"
      }
      onDragStart={(event) => {
        if (!data.ownershipMode || n.kind !== "function") return;
        const nonce = (
          data.onOwnershipStart as
            ((node: CodeNode) => string | undefined) | undefined
        )?.(n);
        if (!nonce) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-atlas-ownership", nonce);
      }}
      onDragEnd={() => (data.onOwnershipEnd as (() => void) | undefined)?.()}
      onDragOver={(event) => {
        if (
          data.ownershipMode &&
          (n.kind === "file" || n.kind === "folder") &&
          event.dataTransfer.types.includes("application/x-atlas-ownership")
        )
          event.preventDefault();
      }}
      onDrop={(event) => {
        if (!data.ownershipMode || (n.kind !== "file" && n.kind !== "folder"))
          return;
        event.preventDefault();
        event.stopPropagation();
        const nonce = event.dataTransfer.getData(
          "application/x-atlas-ownership",
        );
        if (nonce)
          (
            data.onOwnershipDrop as
              ((node: CodeNode, nonce?: string) => void) | undefined
          )?.(n, nonce);
      }}
      data-domain-id={n.id}
      data-group-id={data.groupId}
      data-funnel-lane={lane}
      data-highlight={String(data.highlight ?? "idle")}
    >
      {callable && (
        <Handle type="target" position={lane ? Position.Top : Position.Left} />
      )}
      {lane && (
        <div className="funnel-card-lane">
          {
            zh[
              lane === "dependent"
                ? "funnelDependents"
                : lane === "dependency"
                  ? "funnelDependencies"
                  : lane === "selected"
                    ? "funnelCurrent"
                    : "funnelSide"
            ]
          }
          {data.reciprocal ? ` · ${zh.funnelReciprocal}` : ""}
        </div>
      )}
      <div className="card-meta">
        <span>
          {data.layer === "plan"
            ? zh.planned
            : data.layer === "anchor"
              ? zh.anchor
              : zh.code}
        </span>
        <span>{nodeIdentity(n, data.locale as "zh" | "en").typeLabel}</span>
      </div>
      {data.groupId && (
        <div className="group-mirror">
          {zh.groupMirror} · {data.groupTitle}
        </div>
      )}
      <strong title={n.qualifiedName ?? n.name}>
        <NodeIdentity node={n} locale={data.locale as "zh" | "en"} />
      </strong>
      <code title={n.filePath}>{n.filePath ?? n.qualifiedName ?? n.id}</code>
      {n.signature && <small title={n.signature}>{n.signature}</small>}
      {data.changes.map((change, i) => (
        <div className="card-change" key={i}>
          {change}
        </div>
      ))}
      {callable && (
        <Handle
          type="source"
          position={lane ? Position.Bottom : Position.Right}
        />
      )}
    </div>
  );
}
/** Consume explicit navigation only once, after the current projection has been
 * adopted and measured by React Flow. Layout/selection updates are not focus. */
function FocusViewport({
  request,
  targets,
  padding = 0.5,
  focusKey = "",
  blocked = false,
}: {
  request?: FocusRequest;
  targets: GraphNode[];
  padding?: number;
  focusKey?: string;
  blocked?: boolean;
}) {
  const { fitView, viewportInitialized } = useReactFlow<GraphNode, GraphEdge>();
  const initialized = useNodesInitialized();
  const rendered = useNodes<GraphNode>();
  const consumed = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      blocked ||
      !request ||
      !targets.length ||
      !initialized ||
      !viewportInitialized ||
      consumed.current === `${request.sequence}:${focusKey}`
    )
      return;
    // The old graph can contain the same ID. Wait until the newly supplied
    // projection reaches the canvas store, not just until any old node exists.
    const ready = targets.map((target) =>
      rendered.find((n) => n.id === target.id),
    );
    if (
      ready.some(
        (node, i) =>
          !node ||
          node.data.projectionData !== targets[i]!.data ||
          node.position.x !== targets[i]!.position.x ||
          node.position.y !== targets[i]!.position.y ||
          !node.measured?.width ||
          !node.measured.height,
      )
    )
      return;
    consumed.current = `${request.sequence}:${focusKey}`;
    void fitView({
      nodes: ready as GraphNode[],
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 250,
      // Explicit focus must fit even a widely spread saved layout. The manual
      // zoom controls retain their normal minimum; do not reposition targets.
      minZoom: 0,
      maxZoom: 1.1,
      padding,
    });
  }, [
    request,
    targets,
    rendered,
    initialized,
    viewportInitialized,
    fitView,
    padding,
    focusKey,
    blocked,
  ]);
  return null;
}
function OverviewViewport({
  active,
  saved,
}: {
  active: boolean;
  saved: { current: Viewport | undefined };
}) {
  const { getViewport, setViewport } = useReactFlow();
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) saved.current ??= getViewport();
    if (!active && wasActive.current && saved.current) {
      void setViewport(saved.current, { duration: 0 });
      saved.current = undefined;
    }
    wasActive.current = active;
  }, [active, saved, getViewport, setViewport]);
  return null;
}
/** Actual current cards only: an old projection with reused IDs is not a measurement. */
function OverviewMeasurements({
  targets,
  onMeasure,
}: {
  targets: GraphNode[];
  onMeasure: (boxes: Record<string, LayoutBox>) => void;
}) {
  const rendered = useNodes<GraphNode>(),
    initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized || !targets.length) return;
    const boxes: Record<string, LayoutBox> = {};
    for (const target of targets) {
      const node = rendered.find((item) => item.id === target.id);
      if (
        !node ||
        node.data.projectionData !== target.data ||
        !node.measured?.width ||
        !node.measured.height
      )
        return;
      boxes[node.id] = {
        width: node.measured.width,
        height: node.measured.height,
      };
    }
    onMeasure(boxes);
  }, [rendered, initialized, targets, onMeasure]);
  return null;
}
const nodeTypes = { code: CodeCard, group: GroupCard };
// React Flow queues explicit fit options. Stable overview options avoid a
// parent render overwriting that queued request with a fit of every node.
const overviewFitOptions = { padding: 0.25, minZoom: 0.8, maxZoom: 1 };
export function Canvas(props: {
  graph?: SubgraphResult;
  projectId?: string;
  selectedNodeId?: string;
  groups?: FunctionGroup[];
  ownershipMode?: boolean;
  ownershipEnabled?: boolean;
  overviewBlocked?: boolean;
  overviewScopeKey?: string;
  overviewLayout?: OverviewLayoutState;
  layoutCapture?: LayoutCapture;
  onCaptureLayout?: () => LayoutCapture | undefined;
  onSaveLayoutPositions?: (
    patch: ViewState["positions"],
    capture: LayoutCapture,
  ) => boolean;
  onRecomputeProjectLayout?: () => Promise<void>;
  onOwnershipStart?: (node: CodeNode) => string | undefined;
  onOwnershipEnd?: () => void;
  onOwnershipDrop?: (node: CodeNode, nonce?: string) => void;
  onToggleGroup?: (id: string) => void;
  groupSelectionMode?: boolean;
  groupSelectionIds?: string[];
  onGroupSelection?: (nodes: CodeNode[]) => void;
  relationPreviewId?: string;
  fixedOperationRelationId?: string;
  previewRelation?: Relation;
  previewNodes?: CodeNode[];
  inspection?: ReactNode;
  onCloseInspection?: () => void;
  onPreviewRelation?: (id?: string) => void;
  referenceNodes?: CodeNode[];
  operations: Operation[];
  view: ViewState;
  filter: LayerFilter;
  focusRequest?: FocusRequest;
  funnel?: FunnelState;
  funnelPending?: boolean;
  onFunnel: (node: CodeNode) => void;
  onExitFunnel: () => void;
  canEdit: boolean;
  relationType: PlannedRelation["type"];
  onSelect: (node: CodeNode) => void;
  onExpand?: (id: string) => void;
  onLayout: (positions: ViewState["positions"]) => void;
  onEdge: (edge: EdgeReference) => void;
  onConnect: (
    source: string,
    target: string,
    type: PlannedRelation["type"],
    edge?: EdgeReference,
  ) => void;
}) {
  const zh = useStrings();
  const canvas = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(3);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapSelection, setMapSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  const [hovered, setHovered] = useState<string>();
  const [groupEvidence, setGroupEvidence] = useState<GraphEdge>();
  useEffect(
    () => setGroupEvidence(undefined),
    [
      props.projectId,
      props.graph?.snapshotId,
      props.groupSelectionMode,
      props.funnel,
    ],
  );
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const layoutFrame = useRef(0);
  const dragging = useRef(false);
  const dragCapture = useRef<LayoutCapture | undefined>(undefined);
  const offsets = useRef(new FunnelOffsets());
  const [offsetVersion, setOffsetVersion] = useState(0);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const stopHover = () => {
    clearTimeout(hoverTimer.current);
    setHovered(undefined);
  };
  const previewNode = (id: string) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (!dragging.current) setHovered(id);
    }, 90);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    setCameraBlocked(false);
    setMapExpanded(false);
  }, [props.projectId, props.graph?.snapshotId]);
  useEffect(() => {
    setCameraBlocked(false);
  }, [props.focusRequest?.sequence, props.funnel?.sequence]);
  const [pages, setPages] = useState({
    sequence: -1,
    dependents: 0,
    dependencies: 0,
    focusSequence: 0,
  });
  const activePages =
    pages.sequence === props.funnel?.sequence
      ? pages
      : { dependents: 0, dependencies: 0, focusSequence: 0 };
  useEffect(() => {
    if (!canvas.current) return;
    const update = () => {
      const { width, height } = canvas.current!.getBoundingClientRect();
      setSize({ width, height });
      setPageSize(width < 500 ? 1 : width < 800 ? 2 : 3);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  const guarded = useMemo(
    () =>
      guardedOverviewProjection({
        graph: props.graph,
        operations: props.operations,
        filter: props.filter,
        references: props.referenceNodes ?? [],
        groups: props.groups ?? [],
        collapsed: props.view.collapsedGroupIds ?? [],
        positions: props.view.positions,
        locale: props.view.locale,
        skipGroups: !!props.groupSelectionMode || !!props.funnel,
      }),
    [
      props.graph,
      props.operations,
      props.filter,
      props.referenceNodes,
      props.groups,
      props.view.collapsedGroupIds,
      props.view.positions,
      props.view.locale,
      props.groupSelectionMode,
      props.funnel,
    ],
  );
  const baseProjection = guarded.base;
  const rawProjection = guarded.projection;
  const scopeKey = `${props.overviewScopeKey ?? "project"}:${props.filter}:${guarded.rejection ? "rejected" : (props.view.collapsedGroupIds ?? []).join("|")}`;
  const measurementKey = `${props.projectId}:${props.graph?.snapshotId}:${scopeKey}:${props.layoutCapture?.projectionGeneration}:${props.view.theme}:${props.view.locale}`;
  const auto = useRef(new CompactOverviewCache());
  const measurementBinding = useMemo(
    () => ({
      key: measurementKey,
      projection: rawProjection,
      projectionGeneration: props.layoutCapture?.projectionGeneration ?? -1,
    }),
    [measurementKey, rawProjection, props.layoutCapture?.projectionGeneration],
  );
  const latestMeasurement = useRef(measurementBinding);
  latestMeasurement.current = measurementBinding;
  const localProjection = useRef<typeof rawProjection | undefined>(undefined);
  const [autoVersion, setAutoVersion] = useState(0);
  const pins = useMemo(
    () =>
      resolveVisualPins(
        rawProjection.nodes,
        guarded.fallback || props.funnel || props.groupSelectionMode
          ? []
          : (props.groups ?? []),
        props.view.positions,
      ),
    [
      rawProjection,
      guarded.fallback,
      props.funnel,
      props.groupSelectionMode,
      props.groups,
      props.view.positions,
    ],
  );
  const projection = useMemo(
    () => ({
      ...rawProjection,
      nodes: rawProjection.nodes.map((node) => ({
        ...node,
        position:
          pins[node.id]?.position ??
          auto.current.current(
            props.projectId ?? "",
            scopeKey,
            props.graph?.snapshotId ?? "",
          )[node.id] ??
          node.position,
      })),
    }),
    [
      rawProjection,
      pins,
      props.projectId,
      props.graph?.snapshotId,
      scopeKey,
      autoVersion,
    ],
  );
  const session = useRef(new OverviewSession());
  const [dragActive, setDragActive] = useState(false);
  useEffect(() => {
    if (props.ownershipMode) {
      dragging.current = false;
      dragCapture.current = undefined;
      setDragActive(false);
      session.current.cancel();
    }
  }, [props.ownershipMode]);
  const blocked =
    !!props.overviewBlocked ||
    !!props.ownershipMode ||
    !!props.groupSelectionMode ||
    !!props.funnel ||
    !!props.funnelPending ||
    dragActive;
  const [localStatus, setLocalStatus] = useState<
    VisibleLayoutResult["status"] | "pending" | "idle"
  >("idle");
  const [localResult, setLocalResult] = useState<VisibleLayoutResult>();
  const [job, setJob] = useState<{
    token: OverviewSessionToken;
    explicit: boolean;
  }>();
  const [reflow, setReflow] = useState(0);
  const requestedReflow = useRef<
    { sequence: number; capture: LayoutCapture } | undefined
  >(undefined);
  const [actual, setActual] = useState<OverviewMeasurementFrame>({
    key: "",
    projection: rawProjection,
    projectionGeneration: -1,
    boxes: {},
    generation: 0,
  });
  const onMeasure = useCallback(
    (boxes: Record<string, LayoutBox>) => {
      // A queued callback from an obsolete producer cannot repopulate the cache.
      if (latestMeasurement.current !== measurementBinding) return;
      setActual((previous) => {
        if (latestMeasurement.current !== measurementBinding) return previous;
        return readOverviewMeasurements(previous, measurementBinding) &&
          !measurementsChanged(previous.boxes, boxes)
          ? previous
          : {
              ...measurementBinding,
              boxes,
              generation: previous.generation + 1,
            };
      });
    },
    [measurementBinding],
  );
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    session.current.cancel();
    setJob(undefined);
    const capture = resolveCurrentOverviewCapture(props),
      global = props.overviewLayout?.result;
    localProjection.current = rawProjection;
    if (
      blocked ||
      guarded.rejection ||
      !capture ||
      props.overviewLayout?.status !== "ready" ||
      !global
    ) {
      setLocalStatus("idle");
      return;
    }
    const request = requestedReflow.current;
    const explicit =
      request?.sequence === reflow &&
      sameOverviewCapture(request.capture, capture);
    if (request?.sequence === reflow && !explicit)
      requestedReflow.current = undefined;
    const result = session.current.begin({
      projection: rawProjection,
      global,
      pins,
      retained: auto.current.retained(
        capture.projectId,
        scopeKey,
        capture.snapshotId,
        rawProjection.nodes.map((node) => node.id),
        global,
      ),
      ignorePinsFor: explicit ? rawProjection.nodes.map((node) => node.id) : [],
      capture,
      measurementGeneration: actual.generation,
    });
    setLocalStatus(result.status === "cancelled" ? "idle" : result.status);
    if (result.status === "pending")
      setJob({ token: result.token, explicit: !!explicit });
    else if (result.status === "rejected") setLocalResult(result);
    return () => session.current.cancel();
  }, [
    rawProjection,
    pins,
    scopeKey,
    blocked,
    guarded.rejection,
    props.overviewLayout?.status,
    props.overviewLayout?.result,
    props.layoutCapture?.projectId,
    props.layoutCapture?.snapshotId,
    props.layoutCapture?.projectionGeneration,
    props.layoutCapture?.viewGeneration,
    actual.generation,
    reflow,
  ]);
  useEffect(() => {
    if (!job || !session.current.isCurrent(job.token)) return;
    const readCurrent = () => {
      const current = latest.current;
      return {
        capture: resolveCurrentOverviewCapture(current),
        blocked:
          latestMeasurement.current !== measurementBinding ||
          !!current.overviewBlocked ||
          !!current.ownershipMode ||
          !!current.groupSelectionMode ||
          !!current.funnel ||
          !!current.funnelPending ||
          dragging.current,
      };
    };
    const result = completeOverviewFrame(
      session.current,
      job.token,
      actual,
      measurementBinding,
      readCurrent,
      (ready, capture) => {
        if (latestMeasurement.current !== measurementBinding) return;
        const global = latest.current.overviewLayout?.result;
        if (!global) return;
        auto.current.commit(
          capture.projectId,
          scopeKey,
          capture.snapshotId,
          ready.positions,
          global,
        );
        localProjection.current = rawProjection;
        setAutoVersion((version) => version + 1);
      },
      job.explicit
        ? (patch, capture) =>
            !!latest.current.onSaveLayoutPositions?.(patch, capture)
        : undefined,
    );
    if (result.status === "pending") return;
    setJob(undefined);
    if (job.explicit) requestedReflow.current = undefined;
    if (result.status === "cancelled") {
      setLocalStatus("idle");
      return;
    }
    setLocalStatus(result.status);
    setLocalResult(result);
  }, [job, actual, measurementBinding, scopeKey, rawProjection]);
  useEffect(() => () => session.current.cancel(), []);
  const [nodes, setNodes] = useState(projection.nodes);
  const currentNodes = useRef(nodes);
  const instance = useRef<ReactFlowInstance<GraphNode, GraphEdge> | undefined>(
    undefined,
  );
  const savedViewport = useRef<Viewport | undefined>(undefined);
  const clickViewport = useRef<Viewport | undefined>(undefined);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(
    () => () => clearTimeout(clickTimer.current),
    [props.graph?.snapshotId, props.focusRequest?.sequence],
  );
  const [settled, setSettled] = useState<number | undefined>();
  const [measurements, setMeasurements] = useState<
    Record<string, { width?: number; height?: number }>
  >({});
  const funnelBase = useMemo(
    () =>
      props.funnel
        ? layoutFunnel(
            {
              ...projection,
              nodes: projection.nodes.map((n) => ({
                ...n,
                measured: measurements[n.id],
              })),
            },
            props.funnel.root.id,
            {
              dependentsPage: activePages.dependents,
              dependenciesPage: activePages.dependencies,
              pageSize,
            },
          )
        : undefined,
    [
      projection,
      props.funnel,
      measurements,
      activePages.dependents,
      activePages.dependencies,
      pageSize,
    ],
  );
  const funnelProjection = useMemo(
    () =>
      funnelBase && props.funnel
        ? {
            ...funnelBase,
            nodes: offsets.current.apply(
              props.projectId ?? "",
              props.funnel.root.id,
              funnelBase.nodes,
            ),
          }
        : funnelBase,
    [funnelBase, props.projectId, props.funnel, offsetVersion],
  );
  useEffect(() => {
    if (dragging.current) return;
    const target = funnelProjection?.nodes ?? projection.nodes;
    cancelAnimationFrame(layoutFrame.current);
    setSettled(undefined);
    const update = (next: GraphNode[]) => {
      currentNodes.current = next;
      setNodes(next);
    };
    if (
      !props.funnel ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update(target);
      setSettled(props.funnel?.sequence);
      return;
    }
    const previous = new Map(
      currentNodes.current.map((n) => [n.id, n.position]),
    );
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / 300);
      const eased = progress * progress * (3 - 2 * progress);
      if (progress === 1) {
        // Adopt exact destinations. Interpolation arithmetic can retain a tiny
        // rounding delta and prevent the viewport's adoption check from firing.
        update(target);
        setSettled(props.funnel?.sequence);
        return;
      }
      update(
        target.map((n) => {
          // New cards start at their normal overview position, not at the destination.
          const from =
            previous.get(n.id) ??
            projection.nodes.find((p) => p.id === n.id)!.position;
          return {
            ...n,
            position: {
              x: from.x + (n.position.x - from.x) * eased,
              y: from.y + (n.position.y - from.y) * eased,
            },
          };
        }),
      );
      layoutFrame.current = requestAnimationFrame(animate);
    };
    layoutFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(layoutFrame.current);
  }, [projection.nodes, funnelProjection, props.funnel]);
  useEffect(() => {
    const exit = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      clearTimeout(clickTimer.current);
      if (groupEvidence) {
        setGroupEvidence(undefined);
        event.preventDefault();
      } else if (mapExpanded) {
        setMapExpanded(false);
        event.preventDefault();
      } else if (props.inspection) {
        props.onCloseInspection?.();
        event.preventDefault();
      } else if (props.funnel || props.funnelPending) {
        props.onExitFunnel();
        event.preventDefault();
      }
      stopHover();
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [
    groupEvidence,
    mapExpanded,
    props.inspection,
    props.funnel,
    props.funnelPending,
    props.onCloseInspection,
    props.onExitFunnel,
  ]);
  const domain = (id: string) =>
    projection.nodes.find((n) => n.id === id && !n.data.group)?.data.node.id;
  const selectedFocus =
    props.funnel &&
    props.focusRequest &&
    props.focusRequest.sequence > props.funnel.sequence &&
    props.focusRequest.sequence > activePages.focusSequence
      ? props.focusRequest
      : undefined;
  const editable =
    !props.groupSelectionMode &&
    props.canEdit &&
    props.funnel?.root.kind !== "file";
  const rawEdges = [...(funnelProjection?.edges ?? projection.edges)];
  if (
    props.previewRelation &&
    !rawEdges.some((e) => e.data?.domainId === props.previewRelation!.id)
  ) {
    const relation = props.previewRelation;
    const related = new Map((props.previewNodes ?? []).map((n) => [n.id, n]));
    const endpoint = (id: string | null) =>
      id &&
      (nodes.find((n) => n.data.node.id === id) ??
        nodes.find(
          (n) =>
            n.data.node.kind === "file" &&
            n.data.node.filePath === related.get(id)?.filePath,
        ));
    const source = endpoint(relation.sourceId),
      target = endpoint(relation.targetId);
    if (source && target)
      rawEdges.push({
        id: `evidence:${relation.id}`,
        source: source.id,
        target: target.id,
        data: {
          layer: "fact",
          domainId: relation.id,
          relationType: relation.type,
        },
        label: `${props.view.locale === "en" ? "Evidence preview" : "证据预览"} · ${relation.evidence.filePath}:${relation.evidence.line}`,
        selectable: false,
        reconnectable: false,
      });
  }
  const highlighted = inspectionHighlight(
    nodes,
    rawEdges,
    props.groupSelectionMode ? undefined : props.selectedNodeId,
    props.groupSelectionMode
      ? undefined
      : (props.relationPreviewId ?? props.fixedOperationRelationId),
    props.groupSelectionMode ? undefined : hovered,
  );
  const edges = highlighted.edges.map((e) => ({
    ...e,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: e.style?.stroke as string,
    },
    reconnectable: editable && e.reconnectable,
  }));
  const selectedCard = nodes.find(
    (n) =>
      n.data.node.id === props.selectedNodeId ||
      n.data.group?.loadedMembers.some(
        (member) => member.id === props.selectedNodeId,
      ),
  );
  const viewport = instance.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
  const selectionRect = selectedCard
    ? {
        x: selectedCard.position.x * viewport.zoom + viewport.x,
        y: selectedCard.position.y * viewport.zoom + viewport.y,
        width: (selectedCard.measured?.width ?? 270) * viewport.zoom,
        height: (selectedCard.measured?.height ?? 150) * viewport.zoom,
      }
    : undefined;
  const detailPlacement = inspectionPlacement(
    size.width,
    size.height,
    selectionRect,
  );
  const mapSelectionRect = mapExpanded ? mapSelection : selectionRect;
  const mapDetailPlacement = inspectionPlacement(
    size.width,
    size.height,
    mapSelectionRect,
  );
  // Expanded-map navigation keeps both panels in the layout captured on opening.
  // Pin the details to the same placement that chooses the map's opposite side.
  const activeDetailPlacement = mapExpanded
    ? mapDetailPlacement
    : detailPlacement;
  const mapAbove = mapSelectionRect ? mapSelectionRect.y - 58 - 16 : 0;
  const mapBelow = mapSelectionRect
    ? size.height - mapSelectionRect.y - mapSelectionRect.height - 28
    : size.height - 70;
  const mapAtTop = mapExpanded && mapAbove > mapBelow;
  const mapHeight = mapExpanded
    ? Math.max(70, Math.min(168, (mapAtTop ? mapAbove : mapBelow) - 112))
    : undefined;
  const mapSide =
    props.inspection &&
    mapDetailPlacement.dock === "side" &&
    mapDetailPlacement.left > 12
      ? ("left" as const)
      : ("right" as const);
  const stopMotion = () => {
    cancelAnimationFrame(layoutFrame.current);
    clearTimeout(clickTimer.current);
    stopHover();
    setCameraBlocked(true);
    const flow = instance.current;
    if (flow) void flow.setViewport(flow.getViewport(), { duration: 0 });
  };
  const pageControls = (lane: "dependents" | "dependencies") => {
    const range = funnelProjection?.windows[lane];
    if (!range || range.total <= pageSize) return null;
    const label =
      lane === "dependents" ? zh.funnelDependents : zh.funnelDependencies;
    const choose = (page: number) => {
      stopHover();
      setCameraBlocked(false);
      setPages({
        ...activePages,
        sequence: props.funnel!.sequence,
        [lane]: page,
        focusSequence: props.focusRequest?.sequence ?? 0,
      });
    };
    return (
      <span className="funnel-pages">
        <button
          aria-label={`${label} · ${zh.funnelPrevious}`}
          disabled={range.page === 0}
          onClick={() => choose(range.page - 1)}
        >
          ←
        </button>
        {zh.funnelShowing} {range.start}–{range.end}/{range.total}
        <button
          aria-label={`${label} · ${zh.funnelNext}`}
          disabled={range.page + 1 >= range.pages}
          onClick={() => choose(range.page + 1)}
        >
          →
        </button>
      </span>
    );
  };
  return (
    <div
      className="canvas-shell"
      aria-label={zh.graph}
      ref={canvas}
      data-camera-version={cameraVersion}
      onFocusCapture={(event) => {
        const id = (event.target as HTMLElement)
          .closest(".react-flow__node")
          ?.getAttribute("data-id");
        const node = nodes.find((n) => n.id === id);
        if (node && !node.data.group) previewNode(node.data.node.id);
      }}
      onBlurCapture={stopHover}
    >
      <ReactFlow<GraphNode, GraphEdge>
        onInit={(flow) => {
          instance.current = flow;
        }}
        ariaLabelConfig={{
          "controls.zoomIn.ariaLabel": zh.zoomIn,
          "controls.zoomOut.ariaLabel": zh.zoomOut,
          "controls.fitView.ariaLabel": zh.fitView,
          "controls.interactive.ariaLabel": zh.toggleInteraction,
          "minimap.ariaLabel": zh.minimap,
        }}
        selectionOnDrag={!!props.groupSelectionMode}
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={props.groupSelectionMode ? null : "Shift"}
        multiSelectionKeyCode={props.groupSelectionMode ? null : "Meta"}
        panOnDrag={!props.groupSelectionMode && !props.ownershipMode}
        nodes={(props.groupSelectionMode
          ? circleSelectedNodes(
              highlighted.nodes,
              props.groupSelectionIds ?? [],
            )
          : highlighted.nodes
        ).map((n) => ({
          ...n,
          selectable:
            !props.groupSelectionMode ||
            (n.data.layer !== "plan" && n.data.node.kind === "function"),
          data: {
            ...n.data,
            locale: props.view.locale,
            ownershipMode: props.ownershipMode,
            ownershipEnabled: props.ownershipEnabled,
            onOwnershipStart: props.onOwnershipStart,
            onOwnershipEnd: props.onOwnershipEnd,
            onOwnershipDrop: props.onOwnershipDrop,
            onToggleGroup: props.onToggleGroup,
            onSelectMember: props.onSelect,
          },
        }))}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          const next = applyNodeChanges(
            changes,
            props.groupSelectionMode
              ? circleSelectedNodes(
                  currentNodes.current,
                  props.groupSelectionIds ?? [],
                )
              : currentNodes.current,
          );
          currentNodes.current = next;
          setNodes(next);
          if (
            props.groupSelectionMode &&
            changes.some((change) => change.type === "select")
          )
            props.onGroupSelection?.(
              circleFunctions(next.filter((node) => node.selected)),
            );
          const dimensions = changes.filter(
            (c) => c.type === "dimensions" && c.dimensions,
          );
          if (dimensions.length)
            setMeasurements((previous) => {
              const next = { ...previous };
              let changed = false;
              for (const change of dimensions)
                if (
                  change.type === "dimensions" &&
                  change.dimensions &&
                  (next[change.id]?.width !== change.dimensions.width ||
                    next[change.id]?.height !== change.dimensions.height)
                ) {
                  next[change.id] = change.dimensions;
                  changed = true;
                }
              return changed ? next : previous;
            });
        }}
        onPaneClick={() => {
          clearTimeout(clickTimer.current);
          stopHover();
          setGroupEvidence(undefined);
          props.onCloseInspection?.();
          props.onPreviewRelation?.();
        }}
        onNodeMouseEnter={(_, node) => {
          if (!node.data.group) previewNode(node.data.node.id);
        }}
        onNodeMouseLeave={stopHover}
        onEdgeMouseEnter={(_, edge) =>
          props.onPreviewRelation?.(edge.data?.domainId)
        }
        onEdgeMouseLeave={() => props.onPreviewRelation?.()}
        onMove={() => setCameraVersion((v) => v + 1)}
        onMoveStart={(event) => {
          if (event) {
            stopHover();
            clearTimeout(clickTimer.current);
          }
        }}
        onNodeClick={(event, node) => {
          if (props.groupSelectionMode || node.data.group) return;
          if (props.ownershipMode) {
            clearTimeout(clickTimer.current);
            if (node.data.node.kind === "function")
              props.onSelect(node.data.node);
            else props.onOwnershipDrop?.(node.data.node);
            return;
          }
          if (!props.funnel && event.detail < 2)
            clickViewport.current = instance.current?.getViewport();
          clearTimeout(clickTimer.current);
          // Wait for the double-click gesture before moving its target card.
          // Immediate single-click focus can move the card between click events.
          clickTimer.current = setTimeout(
            () => props.onSelect(node.data.node),
            200,
          );
        }}
        onNodeDoubleClick={(_, node) => {
          if (
            props.groupSelectionMode ||
            props.ownershipMode ||
            node.data.group
          )
            return;
          clearTimeout(clickTimer.current);
          if (
            node.data.node.kind === "file" ||
            node.data.node.kind === "function"
          ) {
            if (!props.funnel)
              savedViewport.current =
                clickViewport.current ?? instance.current?.getViewport();
            props.onFunnel(node.data.node);
          }
        }}
        onNodeDragStart={() => {
          if (props.ownershipMode) return;
          dragCapture.current = resolveCurrentOverviewCapture(props);
          dragging.current = true;
          setDragActive(true);
          session.current.cancel();
          stopMotion();
        }}
        onNodeDragStop={(_, node) => {
          if (props.ownershipMode) return;
          dragging.current = false;
          setDragActive(false);
          if (props.funnel) {
            const base = funnelBase?.nodes.find(
              (n) => n.id === node.id,
            )?.position;
            if (base)
              offsets.current.move(
                props.projectId ?? "",
                props.funnel.root.id,
                node.id,
                node.position,
                base,
              );
            setOffsetVersion((v) => v + 1);
          } else {
            const capture = dragCapture.current;
            dragCapture.current = undefined;
            if (props.onSaveLayoutPositions)
              saveCapturedVisualPosition(
                node.id,
                node.position,
                capture,
                resolveCurrentOverviewCapture(props),
                props.onSaveLayoutPositions,
              );
            else props.onLayout({ [node.id]: node.position });
          }
        }}
        nodesDraggable={!props.groupSelectionMode && !props.ownershipMode}
        zoomOnDoubleClick={false}
        onEdgeClick={(_, edge) => {
          if (props.groupSelectionMode) return;
          if (edge.data?.layer === "fact" && edge.data.groupProjection) {
            setGroupEvidence(edge);
            return;
          }
          if (props.funnel?.root.kind !== "file" && edge.data)
            props.onEdge({ id: edge.id, ...edge.data });
        }}
        onConnect={(connection) => {
          const a = domain(connection.source),
            b = domain(connection.target);
          if (editable && a && b) props.onConnect(a, b, props.relationType);
        }}
        onReconnect={(edge, connection) => {
          const a = domain(connection.source),
            b = domain(connection.target);
          if (editable && a && b && edge.data)
            props.onConnect(a, b, props.relationType, {
              id: edge.id,
              ...edge.data,
            });
        }}
        nodesConnectable={editable}
        deleteKeyCode={null}
        fitView
        fitViewOptions={overviewFitOptions}
        minZoom={0.1}
        maxZoom={2}
        colorMode={props.view.theme}
      >
        {!props.funnel && (
          <OverviewMeasurements
            targets={projection.nodes}
            onMeasure={onMeasure}
          />
        )}
        <OverviewViewport active={!!props.funnel} saved={savedViewport} />
        <FocusViewport
          blocked={cameraBlocked}
          padding={props.funnel && !selectedFocus ? 0.08 : 0.5}
          focusKey={
            props.funnel && !selectedFocus
              ? `${pageSize}:${funnelProjection?.windows.dependents.page}:${funnelProjection?.windows.dependencies.page}:${offsetVersion}`
              : ""
          }
          request={
            selectedFocus ??
            (props.funnel
              ? settled === props.funnel.sequence
                ? {
                    sequence: props.funnel.sequence,
                    nodeIds: funnelProjection?.nodes
                      .filter((n) => n.data.funnelLane !== "side")
                      .map((n) => n.data.node.id),
                  }
                : undefined
              : props.focusRequest)
          }
          targets={
            selectedFocus
              ? focusTargets(
                  funnelProjection?.nodes ?? projection.nodes,
                  selectedFocus,
                )
              : props.funnel
                ? (funnelProjection?.nodes.filter(
                    (n) => n.data.funnelLane !== "side",
                  ) ?? [])
                : focusTargets(projection.nodes, props.focusRequest)
          }
        />
        <Background gap={22} size={1} />
        <Controls position="bottom-left" orientation="horizontal" />
        <MapPanel
          expanded={mapExpanded}
          onExpanded={(expanded) => {
            if (expanded) setMapSelection(selectionRect);
            setMapExpanded(expanded);
          }}
          selectedNodeId={props.selectedNodeId}
          locale={props.view.locale}
          loaded={nodes.length}
          side={mapSide}
          top={mapAtTop ? 58 : undefined}
          mapHeight={mapHeight}
          mapWidth={Math.max(80, Math.min(420, size.width - 24))}
          hiddenDetails={
            !!props.inspection &&
            mapExpanded &&
            (size.width < 850 || mapDetailPlacement.dock !== "side")
          }
          bottom={
            props.inspection &&
            !mapExpanded &&
            detailPlacement.dock === "bottom"
              ? Math.min(
                  size.height * 0.4 + 12,
                  size.height - (mapExpanded ? 280 : 120) - 60,
                )
              : 12
          }
        />
      </ReactFlow>
      <section
        aria-label={zh.overviewLayout}
        className="overview-layout-controls"
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          maxWidth: "calc(100% - 24px)",
          zIndex: 5,
          background: "var(--panel-bg, var(--bg))",
          padding: 8,
        }}
      >
        <div className="button-row">
          <button
            disabled={
              blocked ||
              !props.onRecomputeProjectLayout ||
              props.overviewLayout?.status === "pending"
            }
            onClick={() => void props.onRecomputeProjectLayout?.()}
          >
            {zh.overviewRecompute}
          </button>
          <button
            disabled={
              blocked ||
              !!guarded.rejection ||
              !props.layoutCapture ||
              props.overviewLayout?.status !== "ready" ||
              !props.onSaveLayoutPositions ||
              localStatus === "pending"
            }
            onClick={() => {
              const capture = resolveCurrentOverviewCapture(props);
              if (!capture) return;
              requestedReflow.current = { sequence: reflow + 1, capture };
              setReflow((value) => value + 1);
            }}
          >
            {zh.overviewRearrange}
          </button>
        </div>
        <small>
          {zh.overviewReplace} {rawProjection.nodes.length} ·{" "}
          {zh.overviewKeepOther}
        </small>
        <div role="status">
          {zh.overviewProject}: {props.overviewLayout?.status ?? "idle"}
          {props.overviewLayout?.target &&
            ` · ${props.overviewLayout.target.counts.nodes} ${zh.overviewFacts} / ${props.overviewLayout.target.counts.relations} ${zh.overviewRelations}`}
          {props.overviewLayout?.reason && ` · ${props.overviewLayout.reason}`}
          {` · ${zh.overviewCurrent}: ${new Set(rawProjection.nodes.filter((node) => node.data.layer !== "plan" && !node.data.group).map((node) => node.data.node.id)).size} ${zh.overviewFacts} / ${rawProjection.nodes.length} ${zh.overviewCards} / ${rawProjection.edges.length} ${zh.overviewRelations}`}
          {props.graph?.truncated && ` · ${zh.overviewTruncated}`}
          {` · ${zh.overviewMeasured}: ${localProjection.current === rawProjection ? localStatus : "idle"}`}
        </div>
        {guarded.rejection && (
          <div role="status">
            {zh.overviewIncomplete}: {guarded.rejection.reason} ·{" "}
            {zh.overviewRawCounts} {guarded.rejection.counts.graphNodes}/
            {guarded.rejection.counts.graphRelations} ·{" "}
            {zh.overviewStoredOperations}{" "}
            {guarded.estimate.counts.storedOperations} ·{" "}
            {guarded.rejection.countStatus === "complete"
              ? zh.overviewExactCards
              : zh.overviewCardsLowerBound}{" "}
            {guarded.rejection.nodes ?? guarded.rejection.nodesLowerBound} ·{" "}
            {guarded.rejection.countStatus === "complete"
              ? zh.overviewRouteUpperBound
              : zh.overviewRouteEstimateSubtotal}{" "}
            {guarded.rejection.edgeUpperBound ??
              guarded.rejection.edgesLowerBound}{" "}
            ·{" "}
            {guarded.fallback === "facts"
              ? zh.overviewFactFallback
              : zh.overviewEmptyFallback}
          </div>
        )}
        {localStatus === "rejected" && localResult?.status === "rejected" && (
          <div role="status">
            {zh.overviewIncomplete}: {localResult.reason} · {localResult.stage}
          </div>
        )}
        {localStatus === "ready" &&
          localResult?.manualOverlaps.pairsObserved !== undefined &&
          localResult.manualOverlaps.pairsObserved > 0 && (
            <div role="status">
              {zh.overviewManualOverlap}:{" "}
              {localResult.manualOverlaps.complete
                ? zh.overviewExact
                : zh.overviewLowerBound}{" "}
              {localResult.manualOverlaps.pairsObserved}
            </div>
          )}
      </section>
      {groupEvidence?.data && (
        <section className="group-evidence" aria-label={zh.groupEvidence}>
          <button
            aria-label={zh.close}
            onClick={() => setGroupEvidence(undefined)}
          >
            ×
          </button>
          <h3>{zh.groupEvidence}</h3>
          <code>{groupEvidence.data.domainId}</code>
          {props.canEdit && (
            <button
              onClick={() => {
                props.onEdge({ id: groupEvidence.id, ...groupEvidence.data! });
                setGroupEvidence(undefined);
              }}
            >
              {props.view.locale === "en"
                ? "Plan a change to this relation"
                : "规划修改此关系"}
            </button>
          )}
          {[
            ["sourceId", zh.groupEvidenceSource],
            ["targetId", zh.groupEvidenceTarget],
          ].map(([key, label]) => {
            const id = groupEvidence.data?.[key as "sourceId" | "targetId"];
            const node = baseProjection.nodes.find(
              (item) => item.data.node.id === id,
            )?.data.node;
            return (
              node && (
                <div key={key}>
                  <strong>{node.name}</strong>
                  <code>{node.filePath}</code>
                  <button
                    onClick={() => {
                      setGroupEvidence(undefined);
                      props.onSelect(node);
                    }}
                  >
                    {label}
                  </button>
                </div>
              )
            );
          })}
          {groupEvidence.data.evidence && (
            <>
              <code>
                {groupEvidence.data.evidence.filePath}:
                {groupEvidence.data.evidence.line}
              </code>
              <pre>{groupEvidence.data.evidence.text}</pre>
            </>
          )}
          {groupEvidence.data.mirrored && (
            <small>
              {props.view.locale === "en"
                ? "Same relation mirrored"
                : "同一关系镜像"}
            </small>
          )}
        </section>
      )}
      {(props.selectedNodeId || hovered) && (
        <div className="inspection-legend">
          <span>
            ↑ {props.view.locale === "en" ? "Into selection" : "指向当前对象"}
          </span>
          <span>
            ↓ {props.view.locale === "en" ? "From selection" : "当前对象指向"}
          </span>
        </div>
      )}
      {props.inspection &&
        !(
          mapExpanded &&
          (size.width < 850 || mapDetailPlacement.dock !== "side")
        ) && (
          <div
            className={`inspection-overlay dock-${activeDetailPlacement.dock}`}
            style={{
              left: activeDetailPlacement.left,
              top: activeDetailPlacement.top,
              width: activeDetailPlacement.width,
              maxHeight: activeDetailPlacement.maxHeight,
            }}
          >
            {props.inspection}
          </div>
        )}
      {props.funnel && funnelProjection && (
        <div className="funnel-summary" role="status">
          <strong>{props.funnel.root.name}</strong>
          <span>
            ↑ {zh.funnelDependents} {funnelProjection.counts.dependents}
          </span>
          {pageControls("dependents")}
          <span>◇ {zh.funnelCurrent} 1</span>
          <span>
            ↓ {zh.funnelDependencies} {funnelProjection.counts.dependencies}
          </span>
          {pageControls("dependencies")}
          {funnelProjection.reciprocalCount > 0 && (
            <span>
              {zh.funnelReciprocal} {funnelProjection.reciprocalCount}
            </span>
          )}
          <span>
            {zh.funnelSide} {funnelProjection.counts.side} · {zh.funnelUnknown}{" "}
            {props.funnel.unknownCount}
          </span>
          <button
            onClick={() => {
              offsets.current.clear(
                props.projectId ?? "",
                props.funnel!.root.id,
              );
              setOffsetVersion((v) => v + 1);
              setCameraBlocked(false);
            }}
          >
            {zh.overviewRearrangeFunnel}
          </button>
          <button onClick={props.onExitFunnel}>{zh.exitFunnel}</button>
        </div>
      )}
      {projection.nodes.some((node) => node.data.group) && (
        <div className="group-projection-summary" role="status">
          <span>
            {zh.groupVisibleCards}:{" "}
            {projection.nodes.filter((node) => node.data.group).length} ·{" "}
            {zh.groupVisibleMirrors}:{" "}
            {projection.nodes.filter((node) => node.data.groupId).length}
          </span>
          <small>{zh.groupBudgetHint}</small>
        </div>
      )}
      {!nodes.length && <div className="canvas-empty">{zh.graphEmpty}</div>}
      {projection.notices.length > 0 && (
        <details className="canvas-notices">
          <summary>
            ⚠ {zh.notices} ({projection.notices.length})
          </summary>
          <ul>
            {projection.notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
