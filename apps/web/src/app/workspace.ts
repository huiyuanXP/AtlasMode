import {
  readMembers,
  SnapshotChangedError,
  type MemberBinding,
} from "../features/groups/memberBindings.js";
import { createStore } from "zustand/vanilla";
import type {
  BrowseRoute,
  FunctionGroup,
  DirectoryPolicy,
  CodeNode,
  FunctionContextResult,
  FileContextResult,
  FunctionSearchResult,
  Operation,
  PlanDetail,
  Project,
  ProjectSummary,
  SubgraphResult,
  VerificationReport,
  ViewState,
} from "@codemap/core";
import { ApiError, HttpApi } from "../api/client.js";
import { ProjectScope } from "../api/scope.js";
import type { FunnelState } from "../features/graph/funnel.js";
import {
  plannedScopeIds,
  type NavigationLocation,
} from "../features/navigation/path.js";
import type { LayerFilter } from "../features/graph/projection.js";
import {
  affectedNodeIds,
  affectedOperations,
  type FocusRequest,
} from "../features/graph/focus.js";
import {
  observeHistory,
  commitHistory,
  historyTarget,
  historyKey,
  type PlanHistory,
  type HistoryAction,
} from "../features/planning/history.js";
export interface AgentSyncToken {
  projectId?: string;
  sequence: number;
  plans: PlanDetail[];
}
export type GroupDraft = Omit<FunctionGroup, "id" | "projectId"> & {
  id?: string;
};
export type WorkspaceState = {
  groupDraft?: GroupDraft;
  groupSelection: CodeNode[];
  groupSelectionMode: boolean;
  groupEditorOpen: boolean;
  history?: PlanHistory;
  groups: FunctionGroup[];
  policies: DirectoryPolicy[];
  memberPage?: {
    groupId: string;
    offset: number;
    bindings: MemberBinding[];
    snapshotId?: string;
  };
  projects: Project[];
  project?: Project;
  summary?: ProjectSummary;
  graph?: SubgraphResult;
  selectedNode?: CodeNode;
  focusRequest?: FocusRequest;
  funnel?: FunnelState;
  navigationLocation?: NavigationLocation;
  context?: FunctionContextResult;
  fileContext?: FileContextResult;
  detailsOpen: boolean;
  relationPreviewId?: string;
  fixedOperationRelationId?: string;
  source?: { filePath: string; content: string };
  search?: FunctionSearchResult;
  query: string;
  plans: PlanDetail[];
  plan?: PlanDetail;
  routes: BrowseRoute[];
  routeId: string;
  routeStep: number;
  report?: VerificationReport;
  view: ViewState;
  filter: LayerFilter;
  busy: Record<string, boolean>;
  error: string;
  errorHelp?: "conflictHelp" | "retryHelp";
  errorMessageKey?: "snapshotChanged";
  notice: "" | "refreshNotice" | "validateNotice" | "scopeMissingNotice";
};
const emptyInspection = {
  context: undefined,
  fileContext: undefined,
  source: undefined,
  detailsOpen: false,
  relationPreviewId: undefined,
  fixedOperationRelationId: undefined,
};
const blank = (): Omit<WorkspaceState, "projects"> => ({
  history: undefined,
  groupDraft: undefined,
  groupSelection: [],
  groupSelectionMode: false,
  groupEditorOpen: false,
  groups: [],
  policies: [],
  memberPage: undefined,
  project: undefined,
  summary: undefined,
  graph: undefined,
  selectedNode: undefined,
  focusRequest: undefined,
  funnel: undefined,
  navigationLocation: undefined,
  context: undefined,
  fileContext: undefined,
  detailsOpen: false,
  relationPreviewId: undefined,
  fixedOperationRelationId: undefined,
  source: undefined,
  search: undefined,
  query: "",
  plans: [],
  plan: undefined,
  routes: [],
  routeId: "",
  routeStep: 0,
  report: undefined,
  view: { positions: {}, theme: "light", locale: "zh" },
  filter: "both",
  busy: {},
  error: "",
  notice: "",
});
export function createWorkspace(
  api = new HttpApi(),
  preferences?: Pick<Storage, "getItem" | "setItem">,
) {
  const store = createStore<WorkspaceState>(() => ({
    projects: [],
    ...blank(),
  }));
  const scope = new ProjectScope();
  let memberNavigationSequence = 0;
  let focusGeneration = 0,
    dirtyPlanEditor = false;
  const histories = new Map<string, PlanHistory>();
  const set = store.setState,
    get = store.getState;
  const fail = (key: string, error: unknown) =>
    set((s) => ({
      busy: { ...s.busy, [key]: false },
      error:
        error instanceof SnapshotChangedError
          ? "SNAPSHOT_CHANGED"
          : `${error instanceof ApiError ? `${error.code}: ` : ""}${error instanceof Error ? error.message : String(error)}`,
      errorMessageKey:
        error instanceof SnapshotChangedError ? "snapshotChanged" : undefined,
      errorHelp:
        error instanceof SnapshotChangedError ||
        (error instanceof ApiError && error.status === 409)
          ? "conflictHelp"
          : "retryHelp",
    }));
  const run = <T>(
    key: string,
    task: () => Promise<T>,
    commit: (value: T) => void,
  ) => {
    set((s) => ({ busy: { ...s.busy, [key]: true }, error: "" }));
    return scope.run(
      key,
      task,
      (value) => {
        set((s) => ({ busy: { ...s.busy, [key]: false } }));
        commit(value);
      },
      (error) => fail(key, error),
    );
  };
  const remember = (id: string) => {
    try {
      preferences?.setItem("atlasmode.project", id);
    } catch {
      /* Local browser storage may be disabled; server data remains durable. */
    }
  };
  const acceptPlan = (plan: PlanDetail) =>
    set((s) => {
      const selectedTemporary = s.plan?.plan.operations.some(
        (o) => o.kind === "add_function" && o.tempId === s.selectedNode?.id,
      );
      const replacement = plan.plan.operations.find(
        (o) => o.kind === "add_function" && o.tempId === s.selectedNode?.id,
      );
      const history = observeHistory(
        histories.get(historyKey(plan.plan)),
        plan.plan,
      );
      histories.delete(history.key);
      histories.set(history.key, history);
      if (histories.size > 20) histories.delete(histories.keys().next().value!);
      const deleted =
        selectedTemporary &&
        !plan.plan.operations.some(
          (o) => o.kind === "add_function" && o.tempId === s.selectedNode?.id,
        );
      return {
        plan,
        history,
        ...(selectedTemporary && replacement?.kind === "add_function"
          ? {
              selectedNode: {
                id: replacement.tempId,
                kind: "function" as const,
                declarationKind: "function" as const,
                name: replacement.name,
                filePath: replacement.filePath,
                signature: replacement.signature,
                language: replacement.language,
              },
            }
          : {}),
        plans: [plan, ...s.plans.filter((p) => p.plan.id !== plan.plan.id)],
        report: undefined,
        ...(deleted
          ? {
              selectedNode: undefined,
              ...emptyInspection,
              navigationLocation: undefined,
            }
          : {}),
        ...(s.navigationLocation?.planned &&
        !plannedScopeIds(
          plan.plan.operations,
          s.navigationLocation.path,
          s.navigationLocation.kind,
        ).length
          ? { navigationLocation: undefined }
          : {}),
      };
    });
  const load = async (project: Project) => {
    const [summary, view, plans, routes, groups, policies] = await Promise.all([
      api.summary(project.id),
      api.view(project.id),
      api.plans(project.id),
      api.routes(project.id),
      api.groups(project.id),
      api.policies(project.id),
    ]);
    const seeds = summary.entrypoints.slice(0, 8).map((n) => n.id);
    const graph = seeds.length
      ? await api.graph(project.id, seeds, 0)
      : undefined;
    return { summary, view, plans, routes, groups, policies, graph };
  };
  const selectProject = async (project: Project) => {
    focusGeneration++;
    scope.select(project.id);
    set({ ...blank(), project });
    remember(project.id);
    await run(
      "project",
      () => load(project),
      (data) => set({ ...data, plan: undefined }),
    );
  };
  const openProject = async (path: string) => {
    focusGeneration++;
    scope.select("");
    set(blank());
    await run(
      "project",
      () => api.open(path),
      (project) => {
        set((s) => ({
          projects: [project, ...s.projects.filter((p) => p.id !== project.id)],
        }));
        void selectProject(project);
      },
    );
  };
  const selectNode = async (
    node: CodeNode,
    offset = 0,
    options: { focus?: boolean; source?: boolean } = {},
  ) => {
    const project = get().project,
      snapshotId = get().summary?.snapshotId;
    if (!project) return;
    const sequence = ++focusGeneration;
    scope.invalidate("source");
    scope.invalidate("graph");
    scope.invalidate("route");
    scope.invalidate("funnel");
    scope.invalidate("navigation");
    set((s) => ({
      selectedNode: node,
      navigationLocation: undefined,
      ...(options.focus !== false
        ? { focusRequest: { nodeId: node.id, nodeIds: [node.id], sequence } }
        : {}),
      detailsOpen: true,
      relationPreviewId: undefined,
      fixedOperationRelationId: undefined,
      fileContext: undefined,
      context: undefined,
      source: undefined,
      busy: {
        ...s.busy,
        graph: false,
        route: false,
        funnel: false,
        navigation: false,
        source: false,
      },
    }));
    const isFact =
      get().graph?.nodes.some((n) => n.id === node.id) ||
      get().summary?.entrypoints.some((n) => n.id === node.id) ||
      get().search?.items.some((n) => n.id === node.id);
    await run(
      "inspect",
      async () => {
        const [context, fileContext, source] = await Promise.all([
          isFact && node.kind === "function"
            ? api.context(project.id, node.id, offset)
            : undefined,
          isFact && node.kind === "file"
            ? api.fileContext(project.id, node.id, offset)
            : undefined,
          options.source !== false &&
          isFact &&
          node.filePath &&
          node.kind !== "folder" &&
          node.kind !== "external"
            ? api.source(project.id, node.filePath)
            : undefined,
        ]);
        return { context, fileContext, source };
      },
      (data) => {
        if (
          get().summary?.snapshotId !== snapshotId ||
          get().selectedNode?.id !== node.id ||
          !get().detailsOpen
        )
          return;
        if (
          (data.context && data.context.snapshotId !== snapshotId) ||
          (data.fileContext && data.fileContext.snapshotId !== snapshotId)
        )
          throw new SnapshotChangedError();
        set({
          ...data,
          selectedNode: data.context?.node ?? data.fileContext?.node ?? node,
        });
      },
    );
  };
  const inspectNode = (node: CodeNode, offset = 0) =>
    selectNode(node, offset, { focus: false, source: false });
  const closeInspection = () => {
    focusGeneration++;
    scope.invalidate("inspect");
    scope.invalidate("source");
    set((s) => ({
      detailsOpen: false,
      selectedNode: undefined,
      context: undefined,
      fileContext: undefined,
      source: undefined,
      relationPreviewId: undefined,
      fixedOperationRelationId: undefined,
      busy: { ...s.busy, inspect: false, source: false },
    }));
  };
  const previewRelation = (id?: string) => set({ relationPreviewId: id });
  const pageInspection = (offset: number) => {
    const node = get().selectedNode;
    return node ? inspectNode(node, offset) : Promise.resolve();
  };
  const loadSource = async () => {
    const { project, selectedNode: node, summary } = get();
    if (
      !project ||
      !node?.filePath ||
      node.kind === "folder" ||
      node.kind === "external" ||
      get().plan?.plan.operations.some(
        (o) => o.kind === "add_function" && o.tempId === node.id,
      )
    )
      return;
    await run(
      "source",
      () => api.source(project.id, node.filePath!),
      (source) => {
        if (
          get().selectedNode?.id === node.id &&
          get().summary?.snapshotId === summary?.snapshotId
        )
          set({ source });
      },
    );
  };
  const restoreFunnel = () => {
    scope.invalidate("funnel");
    set((s) => ({
      ...(s.funnel
        ? { graph: s.funnel.previousGraph, filter: s.funnel.previousFilter }
        : {}),
      funnel: undefined,
      ...(s.funnel || s.busy.funnel ? { focusRequest: undefined } : {}),
      busy: { ...s.busy, funnel: false },
    }));
  };
  const exitFunnel = () => {
    focusGeneration++;
    restoreFunnel();
  };
  const enterFunnel = async (node: CodeNode, budget = 80) => {
    const state = get(),
      project = state.project;
    if (!project || (node.kind !== "function" && node.kind !== "file")) return;
    const previousGraph = state.funnel
      ? state.funnel.previousGraph
      : state.graph;
    const previousFilter = state.funnel?.previousFilter ?? state.filter;
    // Selection starts source/context requests immediately; their scope guard
    // prevents an older double click from replacing this root's inspector.
    void selectNode(node);
    const sequence = ++focusGeneration;
    set({ focusRequest: undefined });
    const commit = (
      graph: SubgraphResult | undefined,
      unknownCount: number,
    ) => {
      if (sequence !== focusGeneration) return;
      if (graph && graph.snapshotId !== get().summary?.snapshotId)
        throw new SnapshotChangedError();
      const related = new Map((graph?.nodes ?? []).map((n) => [n.id, n]));
      const snapshotId = graph?.snapshotId ?? get().summary?.snapshotId;
      const previousGraphs = [previousGraph, state.graph].filter(
        (g): g is SubgraphResult => !!g && g.snapshotId === snapshotId,
      );
      // Keep old visible facts as a secondary lane. The related query and total
      // visible union both remain bounded; never recursively accumulate graphs.
      const retained = [
        ...new Map(
          previousGraphs.flatMap((g) => g.nodes).map((n) => [n.id, n]),
        ).values(),
      ].filter((n) => !related.has(n.id));
      const nodes = [...related.values(), ...retained].slice(0, 300);
      const visible = new Set(nodes.map((n) => n.id));
      const relations = [
        ...new Map(
          [
            ...(graph?.relations ?? []),
            ...previousGraphs
              .flatMap((g) => g.relations)
              .filter((r) => r.sourceId !== node.id && r.targetId !== node.id),
          ].map((r) => [r.id, r]),
        ).values(),
      ]
        .filter(
          (r) =>
            visible.has(r.sourceId) && (!r.targetId || visible.has(r.targetId)),
        )
        .slice(0, 900);
      set({
        graph:
          graph || previousGraphs[0]
            ? {
                ...(graph ?? previousGraphs[0]!),
                nodes,
                relations,
                truncated:
                  !!graph?.truncated || related.size + retained.length > 300,
              }
            : undefined,
        funnel: {
          root: node,
          sequence,
          previousGraph,
          previousFilter,
          unknownCount,
        },
        filter: "both",
        focusRequest: undefined,
      });
    };
    const planned = state.plan?.plan.operations.some(
      (o) => o.kind === "add_function" && o.tempId === node.id,
    );
    if (planned)
      commit(
        previousGraph?.snapshotId === get().summary?.snapshotId
          ? previousGraph
          : undefined,
        0,
      );
    else
      await run(
        "funnel",
        () => api.dependencies(project.id, node.id, budget),
        (graph) => commit(graph, graph.unknownCount),
      );
  };
  const navigateScope = async (path: string, kind: "folder" | "file") => {
    const state = get(),
      project = state.project,
      snapshotId = state.summary?.snapshotId;
    if (!project || !snapshotId) return;
    const sequence = ++focusGeneration;
    scope.invalidate("graph");
    scope.invalidate("route");
    scope.invalidate("inspect");
    scope.invalidate("funnel");
    set((s) => ({
      focusRequest: undefined,
      busy: {
        ...s.busy,
        graph: false,
        route: false,
        inspect: false,
        funnel: false,
      },
    }));
    let funneling: Promise<void> | undefined;
    await run(
      "navigation",
      async () => {
        const ids = plannedScopeIds(
          state.plan?.plan.operations ?? [],
          path,
          kind,
        );
        let capturedSnapshotId = snapshotId;
        try {
          const graph = await api.scope(
            project.id,
            path,
            kind,
            80,
            snapshotId,
            ids.length > 0,
          );
          if (!graph.missing) {
            const focusIds = [
              ...new Set([
                ...graph.nodes.map((n) => n.id),
                ...(kind === "folder" ? ids : []),
              ]),
            ];
            return {
              graph: {
                ...graph,
                truncated: graph.truncated || focusIds.length > 80,
              },
              planned: false,
              ids: focusIds.slice(0, 80),
            };
          }
          capturedSnapshotId = graph.snapshotId;
        } catch (error) {
          if (error instanceof ApiError && error.code === "SNAPSHOT_CHANGED")
            throw new SnapshotChangedError();
          throw error;
        }
        if (capturedSnapshotId !== get().summary?.snapshotId)
          throw new SnapshotChangedError();
        const temporary = new Set(
          (state.plan?.plan.operations ?? []).flatMap((o) =>
            o.kind === "add_function" ? [o.tempId] : [],
          ),
        );
        const facts = ids.slice(0, 80).filter((id) => !temporary.has(id));
        const graph = facts.length
          ? await api.graph(project.id, facts, 0, 80)
          : {
              snapshotId,
              nodes: [],
              relations: [],
              dataSource: "code" as const,
              truncated: false,
            };
        return {
          graph: { ...graph, truncated: graph.truncated || ids.length > 80 },
          planned: true,
          ids: ids.slice(0, 80),
        };
      },
      (result) => {
        if (sequence !== focusGeneration) return;
        if (result.graph.snapshotId !== get().summary?.snapshotId)
          throw new SnapshotChangedError();
        const root = "root" in result.graph ? result.graph.root : undefined;
        // Only a successful captured lookup exits the previous transient scene.
        restoreFunnel();
        if (!result.planned && kind === "file" && root) {
          funneling = enterFunnel(root);
        } else {
          set({
            graph: result.graph,
            selectedNode: result.planned ? undefined : root,
            ...emptyInspection,
            funnel: undefined,
            filter: "both",
            navigationLocation: { path, kind, planned: result.planned },
            focusRequest: {
              nodeIds: result.ids,
              nodeId: result.ids[0],
              sequence,
            },
          });
        }
      },
    );
    await funneling;
  };
  const expand = async (nodeId: string, depth = 1, budget = 80) => {
    exitFunnel();
    const project = get().project;
    if (!project) return;
    // A manual expansion supersedes route navigation, including a response still
    // in flight under the separate route request key.
    const sequence = ++focusGeneration;
    scope.invalidate("route");
    scope.invalidate("navigation");
    set((s) => ({
      focusRequest: undefined,
      busy: { ...s.busy, route: false, navigation: false },
    }));
    // Each expansion is bounded independently; never accumulate an unbounded graph.
    await run(
      "graph",
      () => api.graph(project.id, [nodeId], depth, budget),
      (graph) =>
        set({ graph, focusRequest: { nodeId, nodeIds: [nodeId], sequence } }),
    );
  };
  const focus = async (node: CodeNode) => {
    await Promise.all([selectNode(node), expand(node.id, 1)]);
  };
  const jumpToNode = async (id: string) => {
    const state = get(),
      project = state.project,
      snapshotId = state.summary?.snapshotId;
    if (!project || !snapshotId) return;
    const known = [
      ...(state.graph?.nodes ?? []),
      ...(state.context?.relatedNodes ?? []),
      ...(state.fileContext?.relatedNodes ?? []),
      ...(state.summary?.entrypoints ?? []),
      ...(state.search?.items ?? []),
    ].find((n) => n.id === id);
    const temporary = state.plan?.plan.operations.find(
      (o) => o.kind === "add_function" && o.tempId === id,
    );
    if (temporary?.kind === "add_function") {
      await selectNode(
        {
          id,
          kind: "function",
          declarationKind: "function",
          name: temporary.name,
          filePath: temporary.filePath,
          signature: temporary.signature,
        },
        0,
        { source: false },
      );
      return;
    }
    exitFunnel();
    const sequence = ++focusGeneration;
    scope.invalidate("inspect");
    scope.invalidate("navigation");
    await run(
      "graph",
      () => api.graph(project.id, [id], 1, 80),
      (graph) => {
        if (sequence !== focusGeneration) return;
        if (
          graph.snapshotId !== get().summary?.snapshotId ||
          graph.snapshotId !== snapshotId
        )
          throw new SnapshotChangedError();
        const node = graph.nodes.find((n) => n.id === id) ?? known;
        set({ graph });
        if (node) void selectNode(node, 0, { source: false });
      },
    );
  };
  const focusOperation = async (op: Operation) => {
    const state = get(),
      project = state.project,
      snapshotId = state.summary?.snapshotId;
    if (!project || !snapshotId) return;
    exitFunnel();
    const sequence = ++focusGeneration;
    const ids = affectedNodeIds([op], undefined, state.graph?.relations);
    const relationId =
      op.kind === "add_relation"
        ? op.id
        : op.kind === "remove_relation"
          ? op.relationId
          : undefined;
    const temporary = new Set(
      state.plan?.plan.operations.flatMap((o) =>
        o.kind === "add_function" ? [o.tempId] : [],
      ) ?? [],
    );
    const facts = ids.filter((id) => !temporary.has(id));
    scope.invalidate("inspect");
    scope.invalidate("navigation");
    const apply = (graph = get().graph) => {
      if (sequence !== focusGeneration) return;
      const endpoints = affectedNodeIds([op], undefined, graph?.relations);
      set({
        filter: "both",
        detailsOpen: false,
        selectedNode: undefined,
        context: undefined,
        fileContext: undefined,
        relationPreviewId: undefined,
        fixedOperationRelationId: relationId,
        focusRequest: { nodeIds: endpoints, nodeId: endpoints[0], sequence },
        graph,
      });
    };
    if (facts.length || op.kind === "remove_relation")
      await run(
        "graph",
        () =>
          api.graph(
            project.id,
            facts.slice(0, 80),
            0,
            80,
            op.kind === "remove_relation" ? [op.relationId] : [],
          ),
        (graph) => {
          if (
            graph.snapshotId !== snapshotId ||
            graph.snapshotId !== get().summary?.snapshotId
          )
            throw new SnapshotChangedError();
          apply(graph);
        },
      );
    else apply();
  };
  const search = async (query: string, offset = 0) => {
    const project = get().project;
    if (!project) return;
    set({ query });
    await run(
      "search",
      () => api.search(project.id, query, offset),
      (search) => set({ search }),
    );
  };
  const refresh = async () => {
    const project = get().project;
    if (!project) return;
    const selectedPlan = get().plan?.plan.id;
    focusGeneration++;
    scope.select(project.id);
    set({ ...blank(), project });
    await run(
      "project",
      async () => {
        await api.refresh(project.id);
        return load(project);
      },
      (data) => {
        set({ ...data, notice: "refreshNotice" });
        const current = data.plans.find((p) => p.plan.id === selectedPlan);
        if (current) acceptPlan(current);
      },
    );
  };
  const toggleGroupCollapse = (id: string) => {
    const state = get();
    const known = new Set(
      state.groups
        .filter((group) => group.projectId === state.project?.id)
        .map((group) => group.id),
    );
    if (!known.has(id) || id.length > 200) return;
    const ids = [...new Set(state.view.collapsedGroupIds ?? [])].filter(
      (value) => known.has(value) && value.length <= 200,
    );
    const next = ids.includes(id)
      ? ids.filter((value) => value !== id)
      : [...ids, id];
    if (next.length > 200) return;
    saveView({ ...state.view, collapsedGroupIds: next });
  };
  const saveView = (view: ViewState) => {
    if (!get().project || get().busy.project) return;
    set({ view });
    // Explicitly captured payload + scope-cancelled timer. Serialized writes avoid an
    // earlier drag overwriting a later theme/layout change in persistent storage.
    scope.schedule(
      "view",
      (id) => {
        viewWrites = viewWrites
          .catch(() => {})
          .then(() => api.saveView(id, view));
        void run(
          "view",
          () => viewWrites,
          () => {},
        );
      },
      250,
    );
  };
  let viewWrites: Promise<unknown> = Promise.resolve();
  const focusPlan = async (
    detail: PlanDetail,
    sequence: number,
    previous?: Operation[],
  ) => {
    const state = get(),
      project = state.project;
    const current = () =>
      sequence === focusGeneration &&
      get().plan?.plan.id === detail.plan.id &&
      get().plan?.plan.revision === detail.plan.revision;
    if (!project || !current()) return;
    const invalid = detail.issues.flatMap((issue) => {
      const op =
        issue.operationIndex === undefined
          ? undefined
          : detail.plan.operations[issue.operationIndex];
      return issue.code === "INVALID_TARGET" && op?.kind === "annotate"
        ? [op.targetId]
        : [];
    });
    let ids = affectedNodeIds(
      detail.plan.operations,
      previous,
      state.graph?.relations,
      invalid,
    );
    const missingRelations = affectedOperations(
      detail.plan.operations,
      previous,
    ).flatMap((o) =>
      o.kind === "remove_relation" &&
      !state.graph?.relations.some((r) => r.id === o.relationId)
        ? [o.relationId]
        : [],
    );
    if (!ids.length && !missingRelations.length) return;
    const temporary = new Set(
      detail.plan.operations.flatMap((o) =>
        o.kind === "add_function" ? [o.tempId] : [],
      ),
    );
    const facts = ids.filter((id) => !temporary.has(id));
    const loaded = new Set(
      [
        ...(state.graph && state.graph.snapshotId === state.summary?.snapshotId
          ? state.graph.nodes
          : []),
        ...(state.summary?.entrypoints ?? []),
        ...(state.search &&
        state.search.snapshotId === state.summary?.snapshotId
          ? state.search.items
          : []),
      ].map((n) => n.id),
    );
    const emit = () => {
      if (!current() || !ids.length) return;
      const s = get();
      const hidden =
        (s.filter === "fact" && ids.some((id) => temporary.has(id))) ||
        (s.filter === "plan" && ids.some((id) => !temporary.has(id)));
      const op =
        ids.length === 1
          ? detail.plan.operations.find(
              (o) => o.kind === "add_function" && o.tempId === ids[0],
            )
          : undefined;
      const fact =
        ids.length === 1
          ? [
              ...(s.graph?.snapshotId === s.summary?.snapshotId
                ? (s.graph?.nodes ?? [])
                : []),
              ...(s.summary?.entrypoints ?? []),
              ...(s.search?.snapshotId === s.summary?.snapshotId
                ? (s.search?.items ?? [])
                : []),
            ].find((n) => n.id === ids[0])
          : undefined;
      let selectedNode: CodeNode | undefined =
        op?.kind === "add_function"
          ? {
              id: op.tempId,
              kind: "function",
              declarationKind: "function",
              name: op.name,
              filePath: op.filePath,
              signature: op.signature,
              language: op.language,
            }
          : fact;
      const move = detail.plan.operations.find(
        (o) => o.kind === "move_function" && o.nodeId === selectedNode?.id,
      );
      if (selectedNode && move?.kind === "move_function")
        selectedNode = { ...selectedNode, filePath: move.filePath };
      const sameSelection =
        selectedNode &&
        selectedNode.id === s.selectedNode?.id &&
        selectedNode.filePath === s.selectedNode.filePath;
      scope.invalidate("inspect");
      scope.invalidate("navigation");
      set({
        selectedNode,
        navigationLocation:
          selectedNode?.filePath && (op || move)
            ? { path: selectedNode.filePath, kind: "file", planned: true }
            : undefined,
        ...(!sameSelection ? emptyInspection : {}),
        relationPreviewId: undefined,
        fixedOperationRelationId: undefined,
        busy: { ...s.busy, inspect: false, navigation: false },
        focusRequest: { nodeId: ids[0], nodeIds: ids, sequence },
        ...(hidden ? { filter: "both" as const } : {}),
      });
    };
    if (missingRelations.length || facts.some((id) => !loaded.has(id))) {
      await run(
        "graph",
        () =>
          api.graph(
            project.id,
            facts.slice(0, 300),
            0,
            Math.min(
              300,
              Math.max(80, facts.length + missingRelations.length * 2),
            ),
            missingRelations.slice(0, 300),
          ),
        (graph) => {
          if (!current()) return;
          if (graph.snapshotId !== get().summary?.snapshotId)
            throw new SnapshotChangedError();
          set({ graph });
          ids = affectedNodeIds(
            detail.plan.operations,
            previous,
            [...graph.relations, ...(state.graph?.relations ?? [])],
            invalid,
          );
          emit();
        },
      );
    } else emit();
  };
  const setPlanEditorDirty = (dirty: boolean) => {
    dirtyPlanEditor = dirty;
    if (!dirty && !get().busy.plan && !get().busy.knowledge) {
      const current = get().plan,
        latest = get().plans.find((p) => p.plan.id === current?.plan.id);
      if (current && latest && latest.plan.revision > current.plan.revision)
        acceptPlan(latest);
    }
  };
  const captureAgentSync = (): AgentSyncToken => ({
    projectId: get().project?.id,
    sequence: focusGeneration,
    plans: get().plans,
  });
  const syncAgentChanges = async (
    planIds: string[] = [],
    token: AgentSyncToken = captureAgentSync(),
  ) => {
    const project = get().project;
    if (!project || project.id !== token.projectId || get().busy.project)
      return;
    const scene = get(),
      sceneSequence = focusGeneration;
    let focusing: Promise<void> | undefined;
    await run(
      "agentSync",
      async () => {
        const [summary, plans, groups, routes, policies] = await Promise.all([
          api.summary(project.id),
          api.plans(project.id),
          api.groups(project.id),
          api.routes(project.id),
          api.policies(project.id),
        ]);
        let projection: SubgraphResult | undefined,
          unknownCount: number | undefined,
          missingScope = false;
        if (scene.summary?.snapshotId !== summary.snapshotId) {
          const temporary = new Set(
            scene.plan?.plan.operations.flatMap((o) =>
              o.kind === "add_function" ? [o.tempId] : [],
            ) ?? [],
          );
          try {
            if (scene.funnel && !temporary.has(scene.funnel.root.id)) {
              const result = await api.dependencies(
                project.id,
                scene.funnel.root.id,
              );
              projection = result;
              unknownCount = result.unknownCount;
            } else if (
              scene.navigationLocation &&
              !scene.navigationLocation.planned
            ) {
              projection = await api.scope(
                project.id,
                scene.navigationLocation.path,
                scene.navigationLocation.kind,
                80,
                summary.snapshotId,
              );
            } else {
              const roots = [
                ...new Set([
                  ...(scene.graph?.nodes.map((n) => n.id) ?? []),
                  ...(scene.selectedNode ? [scene.selectedNode.id] : []),
                ]),
              ]
                .filter((id) => !temporary.has(id))
                .slice(0, 300);
              if (roots.length)
                projection = await api.graph(project.id, roots, 0, 300);
            }
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              error.code !== "NOT_FOUND" ||
              error.status !== 404
            )
              throw error;
            missingScope = true;
          }
          if (projection && projection.snapshotId !== summary.snapshotId)
            throw new SnapshotChangedError();
        }
        return {
          summary,
          plans,
          groups,
          routes,
          policies,
          projection,
          unknownCount,
          missingScope,
        };
      },
      (data) => {
        const state = get();
        // A local save may finish while this reread is in flight. Never downgrade it.
        const plans = data.plans.map((detail) => {
          const newer = state.plans.find(
            (p) =>
              p.plan.id === detail.plan.id &&
              p.plan.revision > detail.plan.revision,
          );
          return newer ?? detail;
        });
        const editing =
          state.busy.plan || state.busy.knowledge || dirtyPlanEditor;
        const canFocus = token.sequence === focusGeneration && !editing;
        const changed = canFocus
          ? [...planIds]
              .reverse()
              .map((id) => plans.find((p) => p.plan.id === id))
              .find(Boolean)
          : undefined;
        const selected = plans.find((p) => p.plan.id === state.plan?.plan.id);
        set({
          summary: data.summary,
          plans,
          groups: data.groups,
          routes: data.routes,
          policies: data.policies,
        });
        if (!editing && (changed || selected))
          acceptPlan((changed ?? selected)!);
        if (data.missingScope && sceneSequence === focusGeneration) {
          for (const key of [
            "inspect",
            "funnel",
            "graph",
            "navigation",
            "route",
          ])
            scope.invalidate(key);
          set({
            graph: undefined,
            selectedNode: undefined,
            navigationLocation: undefined,
            funnel: undefined,
            focusRequest: undefined,
            ...emptyInspection,
            notice: "scopeMissingNotice",
            busy: {
              ...get().busy,
              inspect: false,
              funnel: false,
              graph: false,
              navigation: false,
              route: false,
            },
            ...(state.funnel ? { filter: state.funnel.previousFilter } : {}),
          });
        }
        if (changed) {
          restoreFunnel();
          if (data.projection && sceneSequence === focusGeneration)
            set({ graph: data.projection });
          scope.invalidate("graph");
          scope.invalidate("route");
          scope.invalidate("navigation");
          const sequence = ++focusGeneration;
          const previous = token.plans.find(
            (p) => p.plan.id === changed.plan.id,
          )?.plan.operations;
          focusing = focusPlan(changed, sequence, previous);
        }
        if (!changed && data.projection && sceneSequence === focusGeneration) {
          set({
            graph: data.projection,
            ...(state.funnel && data.unknownCount !== undefined
              ? { funnel: { ...state.funnel, unknownCount: data.unknownCount } }
              : {}),
          });
        }
        // Preserve the current projection when the snapshot has not changed.
        // Stale source/context is explicitly cleared; graph retains its old snapshot label.
        if (state.summary?.snapshotId !== data.summary.snapshotId)
          set({
            source: undefined,
            context: undefined,
            fileContext: undefined,
            relationPreviewId: undefined,
            fixedOperationRelationId: undefined,
            search: undefined,
          });
      },
    );
    await focusing;
  };
  const savePlan = async (
    operations: Operation[],
    title?: string,
    description?: string,
    action: HistoryAction = "edit",
  ) => {
    const detail = get().plan;
    if (
      !detail ||
      get().busy.plan ||
      get().busy.knowledge ||
      get().busy.project
    )
      return;
    const sequence = ++focusGeneration;
    scope.invalidate("funnel");
    scope.invalidate("graph");
    scope.invalidate("route");
    set((s) => ({ busy: { ...s.busy, graph: false, route: false } }));
    let focusing: Promise<void> | undefined;
    await run(
      "plan",
      () =>
        api.updatePlan(
          detail.plan.id,
          detail.plan.revision,
          operations,
          title ?? detail.plan.title,
          description ?? detail.plan.description,
        ),
      (accepted) => {
        restoreFunnel();
        histories.set(
          historyKey(accepted.plan),
          commitHistory(
            histories.get(historyKey(detail.plan)),
            detail.plan,
            accepted.plan,
            action,
          ),
        );
        acceptPlan(accepted);
        focusing = focusPlan(accepted, sequence, detail.plan.operations);
      },
    );
    await focusing;
  };
  const travel = async (direction: "undo" | "redo") => {
    const { plan, history } = get();
    if (!plan) return;
    const target = historyTarget(history, plan.plan, direction);
    if (target)
      await savePlan(
        target.operations,
        target.title,
        target.description,
        direction,
      );
  };
  const choosePlan = async (id: string) => {
    exitFunnel();
    scope.invalidate("plan");
    scope.invalidate("graph");
    const sequence = ++focusGeneration;
    scope.invalidate("route");
    set((s) => ({
      plan: undefined,
      history: undefined,
      report: undefined,
      focusRequest: undefined,
      navigationLocation: undefined,
      ...emptyInspection,
      busy: { ...s.busy, plan: false, graph: false, route: false },
      ...(s.plan?.plan.operations.some(
        (o) => o.kind === "add_function" && o.tempId === s.selectedNode?.id,
      )
        ? {
            selectedNode: undefined,
            context: undefined,
            fileContext: undefined,
            source: undefined,
          }
        : {}),
    }));
    let anchors: Promise<void> | undefined;
    if (id)
      await run(
        "plan",
        () => api.plan(id),
        (detail) => {
          acceptPlan(detail);
          anchors = focusPlan(detail, sequence);
        },
      );
    await anchors;
  };
  const createPlan = async (title: string) => {
    const { project, summary } = get();
    if (!project || !summary) return;
    await run(
      "plan",
      () => api.createPlan(project.id, title, summary.snapshotId),
      acceptPlan,
    );
  };
  const validate = async () => {
    const detail = get().plan;
    if (!detail) return;
    await run(
      "plan",
      async () => {
        await api.validate(detail.plan.id);
        return api.plan(detail.plan.id);
      },
      (p) => {
        acceptPlan(p);
        set({ notice: "validateNotice" });
      },
    );
  };
  const approve = async () => {
    const detail = get().plan;
    if (!detail) return;
    await run(
      "plan",
      () => api.approve(detail.plan.id, detail.plan.revision),
      acceptPlan,
    );
  };
  const verify = async () => {
    const detail = get().plan,
      project = get().project;
    if (!detail || !project) return;
    await run(
      "plan",
      async () => {
        const report = await api.verify(detail.plan.id);
        const summary = await api.summary(project.id);
        const plans = await api.plans(project.id);
        return { report, summary, plans };
      },
      (data) => {
        const current = data.plans.find((p) => p.plan.id === detail.plan.id);
        if (current) acceptPlan(current);
        set({
          ...data,
          plan: current,
          graph: undefined,
          ...emptyInspection,
          selectedNode: undefined,
        });
      },
    );
  };
  const exportPlan = async (
    format: "json" | "markdown",
    download: (content: string, filename: string) => void,
  ) => {
    const detail = get().plan;
    if (!detail) return;
    await run(
      "export",
      () => api.export(detail.plan.id, format),
      (content) =>
        download(
          content,
          `plan-${detail.plan.id}-r${detail.plan.revision}.${format === "json" ? "json" : "md"}`,
        ),
    );
  };
  const routeStep = async (routeId: string, index: number) => {
    exitFunnel();
    const state = get(),
      route = state.routes.find((r) => r.id === routeId),
      step = route?.steps[index];
    focusGeneration++;
    scope.invalidate("route");
    scope.invalidate("graph");
    set((s) => ({
      focusRequest: undefined,
      routeId,
      routeStep: index,
      busy: { ...s.busy, route: false, graph: false },
    }));
    if (
      !step ||
      !state.project ||
      route?.snapshotId !== state.summary?.snapshotId
    )
      return;
    const projectId = state.project.id;
    await run(
      "route",
      async () => {
        const graph = await api.graph(projectId, [step.nodeId], 1);
        return graph;
      },
      (graph) => {
        set({ graph });
        const node = graph.nodes.find((n) => n.id === step.nodeId);
        if (node) {
          void selectNode(node);
          set({
            focusRequest: {
              nodeId: node.id,
              nodeIds: [node.id],
              sequence: focusGeneration,
            },
          });
        }
      },
    );
  };
  const loadMembers = async (groupId: string, offset = 0) => {
    const { project, summary, groups } = get(),
      group = groups.find((g) => g.id === groupId);
    if (!project || !summary || !group) return;
    memberNavigationSequence++;
    set({
      memberPage: {
        groupId,
        offset,
        bindings: [],
        snapshotId: summary.snapshotId,
      },
    });
    await run(
      "members",
      async () => {
        const bindings = await readMembers(
          group.memberIds,
          offset,
          summary.snapshotId,
          (id) => api.context(project.id, id, 0, 1),
        );
        // A 404 carries no snapshot ID. Confirm the batch still observes this snapshot.
        if ((await api.summary(project.id)).snapshotId !== summary.snapshotId)
          throw new SnapshotChangedError();
        return bindings;
      },
      (bindings) => {
        if (get().summary?.snapshotId === summary.snapshotId)
          set({
            memberPage: {
              groupId,
              offset,
              bindings,
              snapshotId: summary.snapshotId,
            },
          });
      },
    );
  };
  const saveKnowledge = async (
    kind: "group" | "policy",
    input:
      | GroupDraft
      | (Omit<DirectoryPolicy, "projectId" | "id"> & { id?: string }),
  ) => {
    const { project, busy, memberPage, summary } = get();
    const memberSequence = memberNavigationSequence;
    const sameMemberNavigation = () =>
      memberNavigationSequence === memberSequence &&
      get().memberPage?.groupId === memberPage?.groupId &&
      get().memberPage?.offset === memberPage?.offset;
    let refreshPage: { groupId: string; offset: number } | undefined;
    if (!project || busy.knowledge || busy.plan || busy.project) return;
    await run(
      "knowledge",
      async () => {
        if (kind === "group")
          await api.saveGroup(project.id, input as GroupDraft);
        else
          await api.savePolicy(
            project.id,
            input as Omit<DirectoryPolicy, "projectId" | "id">,
          );
        const [groups, policies, plans] = await Promise.all([
          api.groups(project.id),
          api.policies(project.id),
          api.plans(project.id),
        ]);
        return { groups, policies, plans };
      },
      (data) => {
        const selected = get().plan?.plan.id;
        set(data);
        const current = data.plans.find((p) => p.plan.id === selected);
        if (current) acceptPlan(current);
        if (kind === "group" && get().groupDraft === input)
          set({
            groupDraft: undefined,
            groupSelection: [],
            groupSelectionMode: false,
          });
        if (
          kind === "group" &&
          memberPage &&
          sameMemberNavigation() &&
          get().summary?.snapshotId === summary?.snapshotId
        ) {
          const updated = data.groups.find((g) => g.id === memberPage.groupId);
          if (updated)
            refreshPage = {
              groupId: updated.id,
              offset: Math.min(
                memberPage.offset,
                Math.max(
                  0,
                  Math.floor((updated.memberIds.length - 1) / 20) * 20,
                ),
              ),
            };
        }
      },
    );
    if (
      refreshPage &&
      get().project?.id === project.id &&
      sameMemberNavigation() &&
      get().summary?.snapshotId === summary?.snapshotId
    )
      await loadMembers(refreshPage.groupId, refreshPage.offset);
  };
  const startGroup = () =>
    set({
      groupEditorOpen: true,
      groupDraft: { title: "", description: "", source: "user", memberIds: [] },
    });
  const editGroup = (group: FunctionGroup) => {
    if (group.projectId !== get().project?.id) return;
    set({
      groupEditorOpen: true,
      groupDraft: {
        id: group.id,
        title: group.title,
        description: group.description,
        source: group.source,
        memberIds: [...group.memberIds],
      },
    });
    void loadMembers(group.id);
  };
  const updateGroupDraft = (
    patch: Partial<Pick<GroupDraft, "title" | "description" | "memberIds">>,
  ) =>
    set((s) => ({
      groupDraft: s.groupDraft ? { ...s.groupDraft, ...patch } : undefined,
    }));
  const setGroupSelection = (nodes: CodeNode[]) =>
    set({
      groupSelection: [
        ...new Map(
          nodes.filter((n) => n.kind === "function").map((n) => [n.id, n]),
        ).values(),
      ],
    });
  const setGroupSelectionMode = (active: boolean) => {
    if (active) {
      closeInspection();
      exitFunnel();
      if (!get().groupDraft) startGroup();
    }
    set({
      groupSelectionMode: active,
      groupEditorOpen: active || get().groupEditorOpen,
    });
  };
  const addGroupSelection = () => {
    if (!get().groupDraft) startGroup();
    const { groupDraft, groupSelection } = get();
    updateGroupDraft({
      memberIds: [
        ...new Set([
          ...groupDraft!.memberIds,
          ...groupSelection.map((n) => n.id),
        ]),
      ],
    });
  };
  const removeGroupMember = (id: string) =>
    updateGroupDraft({
      memberIds:
        get().groupDraft?.memberIds.filter((member) => member !== id) ?? [],
    });
  const cancelGroupDraft = () =>
    set({
      groupDraft: undefined,
      groupSelection: [],
      groupSelectionMode: false,
    });
  const init = async () => {
    await run(
      "projects",
      () => api.projects(),
      (projects) => {
        set({ projects });
        let saved: string | null = null;
        try {
          saved = preferences?.getItem("atlasmode.project") ?? null;
        } catch {
          /* optional storage */
        }
        const last = projects.find((p) => p.id === saved);
        if (last) void selectProject(last);
      },
    );
  };
  return {
    store,
    setPlanEditorDirty,
    captureAgentSync,
    syncAgentChanges,
    loadMembers,
    startGroup,
    editGroup,
    updateGroupDraft,
    setGroupSelection,
    setGroupSelectionMode,
    addGroupSelection,
    removeGroupMember,
    cancelGroupDraft,
    saveGroup: (input: GroupDraft) => saveKnowledge("group", input),
    savePolicy: (
      input: Omit<DirectoryPolicy, "projectId" | "id"> & { id?: string },
    ) => saveKnowledge("policy", input),
    init,
    openProject,
    selectProject,
    selectNode,
    inspectNode,
    closeInspection,
    previewRelation,
    pageInspection,
    loadSource,
    jumpToNode,
    focusOperation,
    navigateScope,
    enterFunnel,
    exitFunnel,
    focus,
    expand,
    search,
    refresh,
    saveView,
    toggleGroupCollapse,
    savePlan,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    choosePlan,
    createPlan,
    validate,
    approve,
    verify,
    exportPlan,
    routeStep,
  };
}
export type Workspace = ReturnType<typeof createWorkspace>;
