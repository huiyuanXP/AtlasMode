import { createStore } from "zustand/vanilla";
import type {
  BrowseRoute,
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
import type { FocusRequest } from "../features/graph/Canvas.js";
export type WorkspaceState = {
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
  notice: string;
};
const blank = (): Omit<WorkspaceState, "projects"> => ({
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
  const set = store.setState,
    get = store.getState;
  const fail = (key: string, error: unknown) =>
    set((s) => ({
      busy: { ...s.busy, [key]: false },
      error: `${error instanceof ApiError ? `${error.code}: ` : ""}${error instanceof Error ? error.message : String(error)}${error instanceof ApiError && error.status === 409 ? " 请刷新项目后重新选择规划，检查最新 revision。" : " 请检查本地服务和项目路径后重试。"}`,
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
      const deleted =
        selectedTemporary &&
        !plan.plan.operations.some(
          (o) => o.kind === "add_function" && o.tempId === s.selectedNode?.id,
        );
      return {
        plan,
        plans: [plan, ...s.plans.filter((p) => p.plan.id !== plan.plan.id)],
        report: undefined,
        ...(deleted
          ? { selectedNode: undefined, context: undefined, source: undefined }
          : {}),
      };
    });
  const load = async (project: Project) => {
    const [summary, view, plans, routes] = await Promise.all([
      api.summary(project.id),
      api.view(project.id),
      api.plans(project.id),
      api.routes(project.id),
    ]);
    const seeds = summary.entrypoints.slice(0, 8).map((n) => n.id);
    const graph = seeds.length
      ? await api.graph(project.id, seeds, 0)
      : undefined;
    return { summary, view, plans, routes, graph };
  };
  const selectProject = async (project: Project) => {
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
    focusGeneration++;
    scope.invalidate("graph");
    scope.invalidate("route");
    set((s) => ({
      selectedNode: node,
      focusRequest: undefined,
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
      (graph) => set({ graph, focusRequest: { nodeId, sequence } }),
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
    scope.select(project.id);
    set({ ...blank(), project });
    await run(
      "project",
      async () => {
        await api.refresh(project.id);
        return load(project);
      },
      (data) =>
        set({
          ...data,
          plan: data.plans.find((p) => p.plan.id === selectedPlan),
          notice: "已重新索引；规划和路线按新快照检查。",
        }),
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
  const savePlan = async (
    operations: Operation[],
    title?: string,
    description?: string,
  ) => {
    const detail = get().plan;
    if (!detail || get().busy.plan) return;
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
      acceptPlan,
    );
  };
  const choosePlan = async (id: string) => {
    scope.invalidate("plan");
    scope.invalidate("graph");
    const focusAtStart = focusGeneration;
    set((s) => ({
      plan: undefined,
      report: undefined,
      busy: { ...s.busy, plan: false, graph: false },
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
          const project = get().project;
          const temporary = new Set(
            detail.plan.operations.flatMap((o) =>
              o.kind === "add_function" ? [o.tempId] : [],
            ),
          );
          const ids = [
            ...new Set(
              detail.plan.operations.flatMap((o) => [
                ...("nodeId" in o ? [o.nodeId] : []),
                ...("sourceId" in o ? [o.sourceId] : []),
                ...("targetId" in o ? [o.targetId] : []),
              ]),
            ),
          ].filter((id) => !temporary.has(id));
          if (project && ids.length && focusAtStart === focusGeneration) {
            anchors = run(
              "graph",
              () => api.graph(project.id, ids, 0, 80),
              (graph) => set({ graph }),
            );
          }
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
        set({ notice: "校验完成，结果来自本地服务。" });
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
      (data) =>
        set({
          ...data,
          plan: data.plans.find((p) => p.plan.id === detail.plan.id),
          graph: undefined,
          context: undefined,
          source: undefined,
          selectedNode: undefined,
        }),
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
          set({ focusRequest: { nodeId: node.id, sequence: focusGeneration } });
        }
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
