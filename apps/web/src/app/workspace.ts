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
export type WorkspaceState = {
  history?: PlanHistory;
  groups: FunctionGroup[];
  policies: DirectoryPolicy[];
  memberPage?: { groupId: string; offset: number; bindings: MemberBinding[] };
  projects: Project[];
  project?: Project;
  summary?: ProjectSummary;
  graph?: SubgraphResult;
  selectedNode?: CodeNode;
  focusRequest?: FocusRequest;
  context?: FunctionContextResult;
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
  notice: "" | "refreshNotice" | "validateNotice";
};
const blank = (): Omit<WorkspaceState, "projects"> => ({
  history: undefined,
  groups: [],
  policies: [],
  memberPage: undefined,
  project: undefined,
  summary: undefined,
  graph: undefined,
  selectedNode: undefined,
  focusRequest: undefined,
  context: undefined,
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
  let focusGeneration = 0;
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
          ? { selectedNode: undefined, context: undefined, source: undefined }
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
  const selectNode = async (node: CodeNode, offset = 0) => {
    const project = get().project;
    if (!project) return;
    const sequence = ++focusGeneration;
    scope.invalidate("graph");
    scope.invalidate("route");
    set((s) => ({
      selectedNode: node,
      focusRequest: { nodeId: node.id, nodeIds: [node.id], sequence },
      context: undefined,
      source: undefined,
      busy: { ...s.busy, graph: false, route: false },
    }));
    const isFact =
      get().graph?.nodes.some((n) => n.id === node.id) ||
      get().summary?.entrypoints.some((n) => n.id === node.id) ||
      get().search?.items.some((n) => n.id === node.id);
    await run(
      "inspect",
      async () => {
        const [context, source] = await Promise.all([
          isFact && node.kind === "function"
            ? api.context(project.id, node.id, offset)
            : undefined,
          isFact &&
          node.filePath &&
          node.kind !== "folder" &&
          node.kind !== "external"
            ? api.source(project.id, node.filePath)
            : undefined,
        ]);
        return { context, source };
      },
      (data) => set(data),
    );
  };
  const expand = async (nodeId: string, depth = 1, budget = 80) => {
    const project = get().project;
    if (!project) return;
    // A manual expansion supersedes route navigation, including a response still
    // in flight under the separate route request key.
    const sequence = ++focusGeneration;
    scope.invalidate("route");
    set((s) => ({
      focusRequest: undefined,
      busy: { ...s.busy, route: false },
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
      set({
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
    scope.invalidate("plan");
    scope.invalidate("graph");
    const sequence = ++focusGeneration;
    scope.invalidate("route");
    set((s) => ({
      plan: undefined,
      history: undefined,
      report: undefined,
      focusRequest: undefined,
      busy: { ...s.busy, plan: false, graph: false, route: false },
      ...(s.plan?.plan.operations.some(
        (o) => o.kind === "add_function" && o.tempId === s.selectedNode?.id,
      )
        ? { selectedNode: undefined, context: undefined, source: undefined }
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
          context: undefined,
          source: undefined,
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
    set({ memberPage: { groupId, offset, bindings: [] } });
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
          set({ memberPage: { groupId, offset, bindings } });
      },
    );
  };
  const saveKnowledge = async (
    kind: "group" | "policy",
    input:
      | Omit<FunctionGroup, "id" | "projectId">
      | (Omit<DirectoryPolicy, "projectId" | "id"> & { id?: string }),
  ) => {
    const { project, busy } = get();
    if (!project || busy.knowledge || busy.plan || busy.project) return;
    await run(
      "knowledge",
      async () => {
        if (kind === "group")
          await api.saveGroup(
            project.id,
            input as Omit<FunctionGroup, "id" | "projectId">,
          );
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
      },
    );
  };
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
    loadMembers,
    saveGroup: (input: Omit<FunctionGroup, "id" | "projectId">) =>
      saveKnowledge("group", input),
    savePolicy: (
      input: Omit<DirectoryPolicy, "projectId" | "id"> & { id?: string },
    ) => saveKnowledge("policy", input),
    init,
    openProject,
    selectProject,
    selectNode,
    focus,
    expand,
    search,
    refresh,
    saveView,
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
